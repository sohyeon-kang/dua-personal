const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { parseLocations, createLocationStore } = require('../dist/data');
const { generateCourses, normalizeFilters, scoreLocation, getDistance } = require('../dist/recommendations');
const { createApp } = require('../dist/app');

const filters = { region: '수영구', companion: '가족', weather: '비' };
const header = 'id (고유번호),name (이름),address (주소),latitude (위도),longitude (경도),category (카테고리), view (분위기/뷰)';
function fixture(count = 3, address = '부산 수영구 광안동') {
    return ['식당', '카페', '소품샵'].flatMap((category, group) => Array.from({ length: count }, (_, index) => ({
        id: `${group}-${index}`, name: `${category} ${index}`, address, category,
        latitude: 35.15 + index * .001, longitude: 129.12 + group * .001, weather: '맑음, 비, 폭염',
        details: { access: '', parking: '', waiting: '', kids: '', seat: '', view: '가족, 친구, 데이트' },
    })));
}

test('CSV: 공백 헤더·카테고리 오타 정규화, 중복 ID·잘못된 좌표 제외', () => {
    const locations = parseLocations([header,
        '1, 장소 ,부산 수영구,35.1,129.1,소풉샵, 가족 ',
        '1,중복,부산 수영구,35.1,129.1,식당,친구',
        '2,좌표 없음,부산 수영구,,129.1,카페,친구',
        '3,잘못된 위도,부산 수영구,91,129.1,카페,친구',
        '4,잘못된 경도,부산 수영구,35,NaN,카페,친구',
    ].join('\n'));
    assert.equal(locations.length, 1);
    assert.equal(locations[0].name, '장소');
    assert.equal(locations[0].category, '소품샵');
    assert.equal(locations[0].details.view, '가족');
    assert.throws(() => parseLocations('<html>로그인이 필요합니다</html>'), /CSV/);
});

test('필터 검증과 서면 주소 매핑', () => {
    assert.deepEqual(normalizeFilters({ ...filters, region: '광안리', companion: '데이트' }), { ...filters, companion: '연인' });
    for (const patch of [{ region: '' }, { region: 'toString' }, { region: ['수영구'] }, { weather: '눈' }, { companion: '임의값' }]) {
        assert.equal(normalizeFilters({ ...filters, ...patch }), null);
    }
    assert.equal(generateCourses(fixture(1, '부산 부산진구 전포대로'), { ...filters, region: '서면' }).length, 1);
    assert.equal(generateCourses(fixture(1, '부산 부산진구 전포대로'), filters).length, 0);
});

test('세 코스가 모두 식당·카페·소품샵 순서이며 장소 중복과 원본 변경이 없다', () => {
    const source = fixture();
    const original = structuredClone(source);
    const courses = generateCourses(source, filters, () => .5);
    assert.equal(courses.length, 3);
    assert.equal(new Set(courses.flat().map(spot => spot.id)).size, 9);
    for (const course of courses) {
        assert.deepEqual(course.map(spot => spot.category), ['식당', '카페', '소품샵']);
        assert.deepEqual(course.map(spot => spot.order), [1, 2, 3]);
        assert.equal(course[0].distanceFromPreviousKm, 0);
        assert.ok(course.every(spot => Number.isFinite(spot.distanceFromPreviousKm) && spot.recommendationReasons.length));
    }
    assert.deepEqual(source, original);
    assert.equal(getDistance(35.1, 129.1, 35.1, 129.1), 0);
});

test('장소가 부족하면 완성된 코스만 반환하고 빈 카테고리를 건너뛰지 않는다', () => {
    const source = fixture().filter(spot => spot.id !== '2-2');
    assert.equal(generateCourses(source, filters).length, 2);
    assert.deepEqual(generateCourses(source.filter(spot => spot.category !== '카페'), filters), []);
    assert.deepEqual(generateCourses([], filters), []);
    assert.equal(generateCourses([...fixture(1), ...fixture(1)], filters).length, 1);
});

test('부정 표현을 편의시설 추천 이유로 바꾸지 않고 가족 조건을 반영한다', () => {
    const safe = fixture(1)[0];
    safe.details.kids = '아기 의자 구비';
    const unsafe = structuredClone(safe);
    unsafe.id = 'unsafe';
    unsafe.details.kids = '노키즈존 / 아기 의자 없음';
    unsafe.details.parking = '주차 불가능 / 주차장 없음';
    unsafe.details.waiting = '야외 대기 / 대기 공간 없음 / 비나 더위 피할 곳 없음';
    const good = scoreLocation(safe, filters);
    const bad = scoreLocation(unsafe, filters);
    assert.ok(good.score > bad.score);
    assert.ok(!bad.recommendationReasons.some(reason => /아기 의자|차량|대기 공간|가족이/.test(reason)));
    const course = generateCourses([unsafe, safe, ...fixture(1).slice(1)], filters, () => .99)[0];
    assert.equal(course[0].id, safe.id);
});

test('장소 로딩: 동시 요청 합치기, 캐시 사용, 실패 후 재시도', async () => {
    const csv = `${header}\n1,장소,부산 수영구,35.1,129.1,식당,가족`;
    let calls = 0;
    const get = createLocationStore('https://example.test/places.csv', async () => {
        calls++;
        if (calls === 1) throw new Error('일시적 연결 오류');
        return new Response(csv);
    });
    await assert.rejects(get(), /연결 오류/);
    const [first, second] = await Promise.all([get(), get()]);
    assert.equal(first.length, 1);
    assert.equal(first, second);
    await get();
    assert.equal(calls, 2);
});

test('HTTP: 화면 제공, 입력 검증, 두 코스/빈 결과/장애 응답, 재시도', async t => {
    let current = fixture(2);
    let fail = false;
    const app = createApp({ getLocations: async () => { if (fail) throw new Error('테스트 연결 오류'); return current; }, mapKey: 'test-key' });
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise(resolve => server.close(resolve)));
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const url = `${base}/api/recommend-course?${new URLSearchParams(filters)}`;
    const page = await fetch(base);
    assert.match(await page.text(), /search-form/);
    assert.equal((await fetch(`${base}/api/recommend-course`)).status, 400);
    const response = await fetch(url);
    const data = await response.json();
    assert.equal(data.courses.length, 2);
    assert.match(data.message, /2개/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const other = await fetch(`${base}/api/locations?region=${encodeURIComponent('해운대구')}`).then(r => r.json());
    assert.equal(other.count, 0);
    current = [];
    assert.deepEqual((await fetch(url).then(r => r.json())).courses, []);
    fail = true;
    assert.equal((await fetch(url)).status, 503);
    assert.equal((await fetch(`${base}/page1/`)).status, 200);
    fail = false; current = fixture(1);
    assert.equal((await fetch(url).then(r => r.json())).courses.length, 1);
});

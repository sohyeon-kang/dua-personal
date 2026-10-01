const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup() {
    const listeners = {};
    const values = new Map();
    const context = { URLSearchParams, AbortController, setTimeout, clearTimeout, fetch,
        location: { origin: 'http://localhost:8080', search: '' },
        sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
        window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../frontend/shared.js'), 'utf8'), context);
    return { api: context.window.DUA, listeners, context, values };
}
const filters = { region: '수영구', companion: '가족', weather: '비' };
const course = ['식당', '카페', '소품샵'].map((category, index) => ({ id: String(index), name: `장소 ${index}`, category, address: '부산 수영구', latitude: 35.1, longitude: 129.1 }));

test('손상된 저장소와 다른 검색 조건의 코스를 복원하지 않는다', () => {
    const { api, context, values } = setup();
    api.storage.write('results', { filters, courses: [course], selectedIndex: 0 });
    assert.equal(api.validResults(api.storage.read('results'), filters), true);
    assert.equal(api.validResults(api.storage.read('results'), { ...filters, weather: '맑음' }), false);
    assert.equal(api.validCourse(course.slice(0, 2)), false);
    values.set('dua.results.v1', '{broken');
    assert.equal(api.storage.read('results'), null);
    context.sessionStorage.setItem = () => { throw new Error('저장 금지'); };
    assert.equal(api.storage.write('selection', { course }), false);
});

test('지도와 API 로딩 순서 양쪽 모두에서 최신 선택 코스를 재전송한다', () => {
    const { api, listeners } = setup();
    const sent = [];
    let loaded;
    const target = { postMessage: (data, origin) => sent.push({ data, origin }) };
    const frame = { contentWindow: target, addEventListener: (_name, callback) => { loaded = callback; } };
    const bridge = api.connectMap(frame);
    // 지도가 먼저 준비된 뒤 API가 완료되는 기존 버그 재현 순서.
    loaded();
    bridge.update([course], 0);
    assert.equal(sent.at(-1).data.courses[0], course);
    // API 완료 뒤 iframe이 다시 로드되어도 이전 선택을 재전송.
    bridge.update([course, course], 1);
    loaded();
    listeners.message({ origin: 'http://localhost:8080', source: target, data: { type: 'dua:map-ready' } });
    assert.equal(sent.at(-1).data.selectedIndex, 1);
    assert.equal(sent.at(-1).origin, 'http://localhost:8080');
    const count = sent.length;
    listeners.message({ origin: 'https://other.test', source: target, data: { type: 'dua:map-ready' } });
    listeners.message({ origin: 'http://localhost:8080', source: {}, data: { type: 'dua:map-ready' } });
    assert.equal(sent.length, count);
});

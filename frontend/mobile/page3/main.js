const { storage, validFilters, validCourse, connectMap, filtersText, pageUrl, regionNames, distance, mapPoint } = DUA;
const saved = storage.read('selection');
const labels = { access: '이동·접근성', parking: '주차', waiting: '대기·예약', kids: '아이 동반', seat: '이용·좌석', view: '분위기' };
const companionTags = new Set(['가족', '친구', '연인', '데이트', '혼자']);

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

// 괄호 안 설명은 함께 유지하고, 조사 메모의 구분자는 읽기 쉬운 항목으로 나눈다.
function detailItems(value, key) {
    if (typeof value !== 'string') return [];
    const items = [];
    let current = '';
    let depth = 0;
    for (const character of value) {
        if (character === '(' || character === '（') depth++;
        if (character === ')' || character === '）') depth = Math.max(0, depth - 1);
        if ('/／\n\r'.includes(character)) {
            if (depth === 0) {
                items.push(current);
                current = '';
            } else current += ' · ';
        } else current += character;
    }
    items.push(current);
    const cleaned = items.map(item => {
        if (key === 'view') {
            // 동행 선택을 반복하는 태그만 제외하고 오션뷰 등의 실제 분위기 정보는 남긴다.
            item = item.split(/[,，·]/).map(tag => tag.trim()).filter(tag => !companionTags.has(tag)).join(' · ');
        }
        return item.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    return [...new Set(cleaned)];
}

function displayAddress(spot) {
    const address = spot.address.trim();
    const enclosedAddress = address.match(/\((부산(?:광역시)?\s[^()]*)\)\s*$/);
    if (enclosedAddress) return enclosedAddress[1];
    return address.startsWith(`${spot.name} `) ? address.slice(spot.name.length).trim() : address;
}
if (!validFilters(saved?.filters) || !validCourse(saved?.course)) {
    document.getElementById('detail-message').textContent = '아직 선택한 코스가 없습니다. 조건을 선택하고 마음에 드는 코스를 골라주세요.';
} else {
    const { filters, course } = saved;
    document.getElementById('course-detail').hidden = false;
    document.getElementById('selected-title').textContent = `${regionNames[filters.region]} 식당·카페 코스`;
    document.getElementById('filter-summary').textContent = filtersText(filters);
    document.getElementById('course-distance').textContent = `장소 간 직선거리 합계 약 ${distance(course)} km입니다. 실제 이동 경로와 소요 시간은 길찾기에서 확인해주세요.`;
    document.getElementById('change-filters').href = pageUrl('page1', filters);
    const back = document.getElementById('back-to-courses');
    back.href = pageUrl('page2', filters);
    back.hidden = false;
    connectMap(document.getElementById('map-frame')).update([course]);
    const routeUrl = `https://map.kakao.com/link/by/walk/${course.map(mapPoint).join('/')}`;
    document.getElementById('route-link').href = routeUrl;
    course.forEach((spot, index) => {
        const card = element('article', '', 'place-card');
        const heading = element('div', '', 'place-heading');
        const title = element('div', '', 'place-title');
        title.append(element('h2', spot.name, 'spot-name'), element('span', spot.category, 'place-category'));
        heading.append(element('span', String(index + 1), 'spot-circle'), title);
        card.append(heading, element('p', displayAddress(spot), 'place-address'));
        if (index > 0) card.append(element('p', `이전 장소에서 직선거리 약 ${Number(spot.distanceFromPreviousKm || 0).toFixed(2)} km`, 'distance-note'));
        const details = element('dl', '', 'place-details');
        Object.entries(labels).forEach(([key, label]) => {
            const items = detailItems(spot.details?.[key], key);
            if (!items.length) return;
            const row = element('div', '', 'detail-row');
            const description = element('dd');
            const list = element('ul', '', 'detail-items');
            items.forEach(item => list.append(element('li', item)));
            description.append(list);
            row.append(element('dt', label), description);
            details.append(row);
        });
        if (details.children.length) {
            const disclosure = element('details', '', 'place-disclosure');
            disclosure.append(element('summary', '방문 정보 더 보기'), details);
            card.append(disclosure);
        }
        else card.append(element('p', '추가 이용 정보는 아직 등록되지 않았습니다.', 'distance-note'));
        const links = element('div', '', 'page-actions place-actions');
        const view = element('a', '카카오맵에서 장소 보기', 'text-link');
        view.href = `https://map.kakao.com/link/map/${mapPoint(spot)}`;
        view.target = '_blank'; view.rel = 'noopener noreferrer';
        const directions = element('a', index ? '이전 장소에서 길찾기' : '첫 장소로 길찾기', 'text-link');
        directions.href = index ? `https://map.kakao.com/link/by/walk/${mapPoint(course[index - 1])}/${mapPoint(spot)}` :
            `https://map.kakao.com/link/to/${mapPoint(spot)}`;
        directions.target = '_blank'; directions.rel = 'noopener noreferrer';
        links.append(view, directions);
        card.append(links);
        document.getElementById('places').append(card);
    });
    document.getElementById('copy-course').addEventListener('click', async () => {
        const text = [`DUA ${filtersText(filters)}`, ...course.map((spot, index) => `${index + 1}. ${spot.name} (${spot.category})\n${displayAddress(spot)}`),
            `직선거리 합계 약 ${distance(course)} km`, `전체 도보 길찾기: ${routeUrl}`].join('\n\n');
        const status = document.getElementById('copy-message');
        try {
            await navigator.clipboard.writeText(text);
            status.textContent = '코스 내용을 복사했습니다.';
            document.getElementById('copy-fallback').hidden = true;
        } catch {
            const fallback = document.getElementById('copy-fallback');
            fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select();
            status.textContent = '자동 복사를 사용할 수 없습니다. 아래 내용을 직접 복사해주세요.';
        }
    });
}

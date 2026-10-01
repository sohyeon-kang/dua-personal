(() => {
    DUA.tabs(['courses-tab','places-tab'], ['saved-courses','saved-places']);
    let order = [];
    const status = document.getElementById('saved-message');
    const built = document.getElementById('built-route');
    const art = '<svg viewBox="0 0 100 90" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 59H97M25 20V76M76 20V76M3 49Q13 45 25 22Q50 65 76 22Q86 45 97 49M36 39V59M49 48V59M63 39V59M3 80Q20 72 36 80T70 80T103 80"/></svg>';
    function render() {
        const { courses, places } = DUA.bookmarks.read();
        document.getElementById('courses-tab').textContent = `코스 ${courses.length}`;
        document.getElementById('places-tab').textContent = `장소 ${places.length}`;
        order = order.filter(id => places.some(spot => spot.id === id));
        const courseList = document.getElementById('saved-courses'); courseList.replaceChildren();
        const placeList = document.getElementById('saved-places'); placeList.replaceChildren();
        for (const [list, empty, text] of [[courseList,!courses.length,'아직 저장한 코스가 없어요. 추천 코스의 북마크를 눌러보세요.'],[placeList,!places.length,'방문 일정에서 마음에 드는 장소를 저장해주세요.']]) {
            if (empty) { const p = document.createElement('p'); p.className = 'empty-state'; p.textContent = text; list.append(p); }
        }
        courses.forEach(item => {
            const card = document.createElement('article'); card.className = 'saved-card';
            card.innerHTML = `<div class="saved-art">${art}</div><div class="saved-content"><h2></h2><p></p><button class="text-button">상세 보기 →</button></div><button class="icon-button" aria-label="코스 저장 해제"><svg class="icon" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>`;
            const title = `${DUA.regionNames[item.filters.region]} 코스`;
            card.querySelector('h2').textContent = title;
            card.querySelector('p').textContent = item.course.map(spot => spot.name).join(' · ');
            card.querySelector('.text-button').addEventListener('click', () => {
                if (!DUA.storage.write('selection', item)) { status.textContent = '코스를 열 수 없습니다. 브라우저 저장 설정을 확인해주세요.'; return; }
                location.href = '../page3/';
            });
            card.querySelector('.icon-button').setAttribute('aria-label', `${title} 저장 해제`);
            card.querySelector('.icon-button').addEventListener('click', () => { const result = DUA.bookmarks.toggleCourse(item); status.textContent = result.ok ? '코스 저장을 해제했어요.' : '저장 내용을 변경할 수 없습니다.'; render(); });
            courseList.append(card);
        });
        places.forEach(spot => {
            const row = document.createElement('article'); row.className = 'saved-place';
            row.innerHTML = '<label><input type="checkbox"><span><b></b><small></small></span></label><button class="text-button">삭제</button>';
            row.querySelector('b').textContent = spot.name;
            row.querySelector('small').textContent = `${spot.category} ${order.includes(spot.id) ? '· 방문 순서 '+(order.indexOf(spot.id)+1) : ''}`;
            const input = row.querySelector('input'); input.checked = order.includes(spot.id);
            input.addEventListener('change', () => { order = input.checked ? [...order,spot.id] : order.filter(id => id !== spot.id); built.replaceChildren(); render(); const next = [...placeList.querySelectorAll('input')][places.indexOf(spot)]; next?.focus(); });
            row.querySelector('button').setAttribute('aria-label', `${spot.name} 저장 해제`);
            row.querySelector('button').addEventListener('click', () => { const result = DUA.bookmarks.togglePlace(spot); status.textContent = result.ok ? '장소 저장을 해제했어요.' : '저장 내용을 변경할 수 없습니다.'; built.replaceChildren(); render(); });
            placeList.append(row);
        });
    }
    document.getElementById('build-route').addEventListener('click', () => {
        built.replaceChildren();
        const places = DUA.bookmarks.read().places;
        const route = order.map(id => places.find(spot => spot.id === id)).filter(Boolean);
        if (route.length < 2) { built.textContent = '장소 탭에서 두 곳 이상 선택해주세요.'; return; }
        const heading = document.createElement('p'); heading.textContent = '선택 순서대로 만든 동선이에요. 최단 경로는 아닙니다.'; built.append(heading);
        route.slice(1).forEach((spot, i) => { const link = document.createElement('a'); link.textContent = `${i+1}. ${route[i].name} → ${spot.name} ↗`; link.href = `https://map.kakao.com/link/by/walk/${DUA.mapPoint(route[i])}/${DUA.mapPoint(spot)}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; built.append(link); });
    });
    window.addEventListener('storage', () => { built.replaceChildren(); render(); });
    render();
})();

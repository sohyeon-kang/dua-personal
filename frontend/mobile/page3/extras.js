(() => {
    DUA.tabs(['transit-tab','visit-tab'], ['transit-panel','visit-panel']);
    const selected = DUA.storage.read('selection');
    if (!DUA.validCourse(selected?.course) || !DUA.validFilters(selected?.filters)) return;
    const button = document.getElementById('save-course');
    const status = document.getElementById('save-message');
    function render() { const saved = DUA.bookmarks.hasCourse(selected.course); button.textContent = saved ? '코스 저장됨 · 해제' : '코스 저장'; button.setAttribute('aria-pressed', String(saved)); }
    render();
    button.addEventListener('click', () => { const result = DUA.bookmarks.toggleCourse(selected); status.textContent = result.ok ? (result.saved ? '저장 화면에서 다시 볼 수 있어요.' : '코스 저장을 해제했어요.') : '저장 공간을 사용할 수 없습니다.'; render(); });
    selected.course.forEach((spot, index) => {
        const node = document.createElement('article'); node.className = 'transit-stop';
        node.innerHTML = `<span class="spot-circle">${index + 1}</span><div class="transit-name"><strong></strong><small></small></div><a class="outline-button" target="_blank" rel="noopener noreferrer">${index ? '도보 경로' : '길찾기'}</a>`;
        node.querySelector('strong').textContent = spot.name;
        node.querySelector('small').textContent = `${spot.category} · 영업시간 확인 필요`;
        node.querySelector('a').href = index ? `https://map.kakao.com/link/by/walk/${DUA.mapPoint(selected.course[index - 1])}/${DUA.mapPoint(spot)}` : `https://map.kakao.com/link/to/${DUA.mapPoint(spot)}`;
        document.getElementById('transit-stops').append(node);
        const save = document.createElement('button'); save.className = 'outline-button place-save';
        const update = () => { const exists = DUA.bookmarks.hasPlace(spot); save.textContent = exists ? '장소 저장됨' : '장소 저장'; save.setAttribute('aria-pressed', String(exists)); save.setAttribute('aria-label', `${spot.name} ${exists ? '저장 해제' : '저장'}`); };
        update(); save.addEventListener('click', () => { const result = DUA.bookmarks.togglePlace(spot); status.textContent = result.ok ? (result.saved ? `${spot.name} 장소를 저장했어요.` : '장소 저장을 해제했어요.') : '저장 공간을 사용할 수 없습니다.'; update(); });
        document.querySelectorAll('.place-card')[index].append(save);
    });
})();

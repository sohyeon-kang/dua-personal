(() => {
    const icons = {
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
        sliders: '<path d="M3 7h18M3 17h18"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="16" cy="17" r="3" fill="white"/>',
        pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
        waves: '<path d="M2 7q3-3 6 0t6 0 8 0M2 12q3-3 6 0t6 0 8 0M2 17q3-3 6 0t6 0 8 0"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
        city: '<path d="M3 21V8h7v13M10 21V3h10v18M1 21h22M6 11h1m-1 4h1m7-8h2m-2 4h2m-2 4h2"/>',
        rain: '<path d="M6 15a4 4 0 1 1 .5-8A6 6 0 0 1 18 8a3.5 3.5 0 0 1 0 7M7 18l-1 3m6-3-1 3m6-3-1 3"/>',
        heat: '<path d="M10 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM13 8v10m5-12h3m-3 4h2"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
        map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
        bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
        arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
        back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
        chevron: '<path d="m7 10 5 5 5-5"/>',
        train: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M9 3v7M15 3v7M8 18l-2 3m10-3 2 3"/><circle cx="9" cy="14" r=".7"/><circle cx="15" cy="14" r=".7"/>',
        compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
    };
    document.querySelectorAll('[data-icon]').forEach(node => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = icons[node.dataset.icon] || icons.compass;
        node.replaceWith(svg);
    });
    const filters = DUA.readFilters() || DUA.storage.read('filters');
    document.querySelectorAll('[data-results-link]').forEach(link => {
        link.href = DUA.validFilters(filters) ? DUA.pageUrl('page2', filters) : '../page1/';
    });
})();

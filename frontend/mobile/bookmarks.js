(() => {
    const key = 'dua.mobile.bookmarks.v1';
    const id = course => course.map(spot => spot.id).join('|');
    const validPlace = spot => spot && typeof spot.id === 'string' && typeof spot.name === 'string' && typeof spot.address === 'string' && Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude);
    function read() {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return { courses: (Array.isArray(data?.courses) ? data.courses : []).filter(item => DUA.validFilters(item?.filters) && DUA.validCourse(item?.course)), places: (Array.isArray(data?.places) ? data.places : []).filter(validPlace) };
        } catch { return { courses: [], places: [] }; }
    }
    function toggle(kind, item, same) {
        const data = read();
        const exists = data[kind].some(same);
        data[kind] = exists ? data[kind].filter(entry => !same(entry)) : [...data[kind], item];
        try { localStorage.setItem(key, JSON.stringify(data)); return { ok: true, saved: !exists }; }
        catch { return { ok: false }; }
    }
    DUA.bookmarks = {
        read, id,
        hasCourse: course => read().courses.some(item => id(item.course) === id(course)),
        hasPlace: spot => read().places.some(item => item.id === spot.id),
        toggleCourse: item => DUA.validFilters(item?.filters) && DUA.validCourse(item?.course) ? toggle('courses', item, entry => id(entry.course) === id(item.course)) : { ok: false },
        togglePlace: spot => validPlace(spot) ? toggle('places', spot, entry => entry.id === spot.id) : { ok: false },
    };
    DUA.tabs = (ids, panels) => {
        const buttons = ids.map(id => document.getElementById(id));
        const select = index => buttons.forEach((button, i) => {
            button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1;
            document.getElementById(panels[i]).hidden = i !== index;
        });
        buttons.forEach((button, i) => {
            button.addEventListener('click', () => select(i));
            button.addEventListener('keydown', event => {
                if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
                event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
                select(next); buttons[next].focus();
            });
        });
    };
})();

(() => {
    const keys = { filters: 'dua.filters.v1', results: 'dua.results.v1', selection: 'dua.selection.v1' };
    const regionNames = { '수영구': '광안리', '해운대구': '해운대', '서면': '서면' };
    const storage = {
        read(key) { try { return JSON.parse(sessionStorage.getItem(keys[key])); } catch { return null; } },
        write(key, value) { try { sessionStorage.setItem(keys[key], JSON.stringify(value)); return true; } catch { return false; } },
        remove(key) { try { sessionStorage.removeItem(keys[key]); } catch { /* 저장소를 사용할 수 없어도 검색 가능 */ } },
    };
    function validFilters(filters) {
        return Boolean(filters && Object.hasOwn(regionNames, filters.region) &&
            ['가족', '연인', '친구', '혼자'].includes(filters.companion) && ['맑음', '비', '폭염'].includes(filters.weather));
    }
    function readFilters() {
        const params = new URLSearchParams(location.search);
        const filters = Object.fromEntries(['region', 'companion', 'weather'].map(key => [key, params.get(key)]));
        return validFilters(filters) ? filters : null;
    }
    const sameFilters = (first, second) => validFilters(first) && validFilters(second) &&
        ['region', 'companion', 'weather'].every(key => first[key] === second[key]);
    function validCourse(course) {
        return Array.isArray(course) && course.length === 3 && new Set(course.map(spot => spot?.id)).size === 3 &&
            course.every((spot, index) => spot && typeof spot.id === 'string' && spot.id && typeof spot.name === 'string' && spot.name &&
                spot.category === ['식당', '카페', '소품샵'][index] && typeof spot.address === 'string' &&
                Number.isFinite(spot.latitude) && Math.abs(spot.latitude) <= 90 && spot.latitude !== 0 &&
                Number.isFinite(spot.longitude) && Math.abs(spot.longitude) <= 180 && spot.longitude !== 0);
    }
    function validResults(data, filters) {
        return Boolean(data && sameFilters(data.filters, filters) && Array.isArray(data.courses) &&
            data.courses.length > 0 && data.courses.length <= 3 && data.courses.every(validCourse));
    }
    async function request(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다. 다시 시도해주세요.');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.');
            if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
            throw error;
        } finally { clearTimeout(timeout); }
    }
    // 데이터와 지도 중 어느 쪽이 먼저 준비되든 같은 상태를 다시 전달한다.
    function connectMap(frame) {
        let courses = [];
        let selectedIndex = 0;
        const send = () => frame.contentWindow?.postMessage({ type: 'dua:map-state', courses, selectedIndex }, location.origin);
        window.addEventListener('message', event => {
            if (event.origin === location.origin && event.source === frame.contentWindow && event.data?.type === 'dua:map-ready') send();
        });
        frame.addEventListener('load', send);
        return {
            update(nextCourses, nextIndex = 0) { courses = nextCourses; selectedIndex = nextIndex; send(); },
        };
    }
    const filtersText = filters => `${regionNames[filters.region]} · ${filters.companion} · ${filters.weather}`;
    const pageUrl = (page, filters) => `../${page}/index.html?${new URLSearchParams(filters)}`;
    const distance = course => course.reduce((sum, spot) => sum + (Number(spot.distanceFromPreviousKm) || 0), 0).toFixed(2);
    const mapPoint = spot => `${encodeURIComponent(spot.name)},${spot.latitude},${spot.longitude}`;
    window.DUA = { storage, regionNames, validFilters, readFilters, sameFilters, validCourse, validResults, request, connectMap,
        filtersText, pageUrl, distance, mapPoint };
})();

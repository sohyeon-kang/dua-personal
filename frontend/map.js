let map;
let state = { courses: [], selectedIndex: 0 };
let shapes = [];
let infoWindows = [];
const colors = ['#ef4444', '#22c55e', '#3b82f6'];
const panel = document.getElementById('map-message');
const status = document.getElementById('map-status');
const external = document.getElementById('external-map');

function updateExternalLink() {
    const course = state.courses[state.selectedIndex];
    external.hidden = !course;
    if (course) external.href = `https://map.kakao.com/link/by/walk/${course.map(DUA.mapPoint).join('/')}`;
}
window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'dua:map-state') return;
    const { courses, selectedIndex } = event.data;
    if (!Array.isArray(courses) || courses.length > 3 || !courses.every(DUA.validCourse)) return;
    state = { courses, selectedIndex: Number.isInteger(selectedIndex) && courses[selectedIndex] ? selectedIndex : 0 };
    updateExternalLink();
    if (map) draw();
});
window.parent.postMessage({ type: 'dua:map-ready' }, location.origin);
document.getElementById('retry-map').addEventListener('click', () => location.reload());

function draw() {
    shapes.forEach(shape => shape.setMap(null));
    infoWindows.forEach(info => info.close());
    shapes = []; infoWindows = [];
    const selected = state.courses[state.selectedIndex];
    if (!selected) {
        panel.hidden = false;
        status.textContent = '추천 코스가 준비되면 지도에 표시됩니다.';
        return;
    }
    panel.hidden = true;
    state.courses.forEach((course, index) => {
        const active = index === state.selectedIndex;
        const path = course.map(spot => new kakao.maps.LatLng(spot.latitude, spot.longitude));
        const line = new kakao.maps.Polyline({ path, strokeWeight: active ? 6 : 4,
            strokeColor: active ? colors[index] : '#bdbdbd', strokeOpacity: active ? 0.9 : 0.5, strokeStyle: 'solid', zIndex: active ? 2 : 1 });
        line.setMap(map); shapes.push(line);
        if (!active) return;
        const bounds = new kakao.maps.LatLngBounds();
        course.forEach((spot, spotIndex) => {
            const position = path[spotIndex];
            bounds.extend(position);
            const marker = new kakao.maps.Marker({ position, title: `${spotIndex + 1}. ${spot.name}` });
            marker.setMap(map); shapes.push(marker);
            const content = document.createElement('div');
            content.className = 'info-window';
            const title = document.createElement('div');
            title.className = 'info-title'; title.textContent = `${spotIndex + 1}. ${spot.name}`;
            const category = document.createElement('div'); category.textContent = spot.category;
            content.append(title, category);
            const info = new kakao.maps.InfoWindow({ content, removable: true });
            infoWindows.push(info);
            const open = () => { infoWindows.forEach(item => item.close()); info.open(map, marker); };
            kakao.maps.event.addListener(marker, 'click', open);
            kakao.maps.event.addListener(marker, 'mouseover', open);
        });
        map.relayout();
        map.setBounds(bounds, 40, 40, 40, 40);
    });
}

async function initialize() {
    try {
        const config = await DUA.request('/api/config');
        if (!config.kakaoMapAppKey) throw new Error('지도 키 없음');
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('지도 응답 시간 초과')), 12000);
            const script = document.createElement('script');
            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(config.kakaoMapAppKey)}&autoload=false`;
            script.onerror = () => { clearTimeout(timeout); reject(new Error('지도 연결 실패')); };
            script.onload = () => {
                if (!window.kakao?.maps?.load) { clearTimeout(timeout); reject(new Error('지도 SDK 없음')); return; }
                kakao.maps.load(() => { clearTimeout(timeout); resolve(); });
            };
            document.head.append(script);
        });
        map = new kakao.maps.Map(document.getElementById('map'), { center: new kakao.maps.LatLng(35.1537, 129.1185), level: 5 });
        draw();
        new ResizeObserver(() => draw()).observe(document.getElementById('map'));
    } catch (error) {
        console.warn('지도를 불러오지 못했습니다:', error.message);
        panel.hidden = false;
        status.textContent = '지도를 불러오지 못했습니다. 코스 정보는 계속 확인할 수 있으며 카카오맵에서 길찾기를 열 수 있습니다.';
        document.getElementById('retry-map').hidden = false;
        updateExternalLink();
    }
}
initialize();

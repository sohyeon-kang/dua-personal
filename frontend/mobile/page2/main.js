const { storage, readFilters, validResults, validCourse, request, connectMap, filtersText, pageUrl, regionNames, distance } = DUA;
const filters = readFilters();
const map = connectMap(document.getElementById('map-frame'));
const tabs = [...document.querySelectorAll('.tab-item')];
const message = document.getElementById('course-message');
const selectButton = document.getElementById('select-course');
const retryButton = document.getElementById('retry-course');
let courses = [];
let selectedIndex = 0;
let resultMessage = '';
let loading = false;

function saveResults() { storage.write('results', { filters, courses, selectedIndex, message: resultMessage }); }
function render() {
    const course = courses[selectedIndex];
    document.getElementById('course-section').setAttribute('aria-busy', String(loading));
    tabs.forEach((tab, index) => {
        tab.disabled = loading || !courses[index];
        tab.classList.toggle('active', index === selectedIndex);
        tab.setAttribute('aria-selected', String(index === selectedIndex && Boolean(course)));
        tab.tabIndex = index === selectedIndex && course ? 0 : -1;
        tab.title = courses[index] ? `${index + 1}번 코스` : '추천 가능한 코스가 없습니다.';
    });
    document.getElementById('course-panel').setAttribute('aria-labelledby', `course-tab-${selectedIndex}`);
    document.getElementById('course-panel').style.setProperty('--course-color', ['#03695e', '#6daf5f', '#a5c6db'][selectedIndex]);
    for (let index = 0; index < 3; index++) {
        document.getElementById(`spot${index + 1}`).textContent = course?.[index]?.name || (loading ? '불러오는 중...' : '추천 장소 없음');
    }
    selectButton.disabled = loading || !course;
    retryButton.disabled = loading || !filters;
    retryButton.textContent = courses.length ? '다시 추천받기' : '다시 시도';
    document.getElementById('course-distance').textContent = course ? `${distance(course)} km` : '';
    const bookmark = document.getElementById('bookmark-course');
    bookmark.disabled = loading || !course;
    bookmark.setAttribute('aria-pressed', String(!!course && DUA.bookmarks.hasCourse(course)));
    bookmark.setAttribute('aria-label', course && DUA.bookmarks.hasCourse(course) ? '코스 저장 해제' : '코스 저장');
    map.update(courses, selectedIndex);
}
function selectTab(index) {
    if (loading || !courses[index]) return;
    selectedIndex = index;
    saveResults();
    render();
}
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !courses.length) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? courses.length - 1 :
            (selectedIndex + (event.key === 'ArrowRight' ? 1 : -1) + courses.length) % courses.length;
        selectTab(next);
        tabs[next].focus();
    });
});
async function loadCourses() {
    if (!filters || loading) return;
    loading = true;
    courses = [];
    selectedIndex = 0;
    storage.remove('results');
    message.textContent = '추천 코스를 불러오는 중입니다.';
    render();
    try {
        const data = await request(`/api/recommend-course?${new URLSearchParams(filters)}`);
        if (!Array.isArray(data.courses) || data.courses.length > 3 || !data.courses.every(validCourse)) throw new Error('코스 정보를 읽지 못했습니다. 다시 시도해주세요.');
        courses = data.courses;
        resultMessage = typeof data.message === 'string' ? data.message : '';
        message.textContent = resultMessage || (courses.length ? '코스를 골라 자세한 정보를 확인해보세요.' : '추천 가능한 코스가 없습니다. 조건을 변경해주세요.');
        saveResults();
    } catch (error) { message.textContent = error.message; }
    finally { loading = false; render(); }
}
selectButton.addEventListener('click', () => {
    const course = courses[selectedIndex];
    if (!validCourse(course)) return;
    if (!storage.write('selection', { filters, course, selectedIndex })) {
        message.textContent = '선택한 코스를 저장할 수 없습니다. 브라우저의 사이트 저장을 허용한 뒤 다시 시도해주세요.';
        return;
    }
    saveResults();
    location.href = '../page3/index.html';
});
retryButton.addEventListener('click', loadCourses);
if (filters) {
    document.getElementById('dynamic-region-name').textContent = regionNames[filters.region];
    document.getElementById('filter-summary').textContent = filtersText(filters);
    document.getElementById('change-filters').href = pageUrl('page1', filters);
    const cached = storage.read('results');
    if (validResults(cached, filters)) {
        courses = cached.courses;
        selectedIndex = Number.isInteger(cached.selectedIndex) && courses[cached.selectedIndex] ? cached.selectedIndex : 0;
        resultMessage = typeof cached.message === 'string' ? cached.message : '';
        message.textContent = resultMessage || '코스를 골라 자세한 정보를 확인해보세요.';
        render();
    } else loadCourses();
} else {
    message.textContent = '선택한 조건이 없습니다. 조건 변경을 눌러 지역, 동행 유형, 날씨를 선택해주세요.';
    render();
}

document.getElementById('bookmark-course').addEventListener('click', () => { const result = DUA.bookmarks.toggleCourse({ filters, course: courses[selectedIndex], selectedIndex }); message.textContent = result.ok ? (result.saved ? '코스를 저장했어요.' : '코스 저장을 해제했어요.') : '저장 공간을 사용할 수 없습니다.'; render(); });

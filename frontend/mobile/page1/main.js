const { storage, readFilters, validFilters, validCourse, pageUrl } = DUA;
const regionOptions = [...document.querySelectorAll('input[name="region"]')];
const message = document.getElementById('search-message');
regionOptions.forEach(option => option.addEventListener('change', () => { message.textContent = ''; }));

function selectOption(button) {
    button.parentElement.querySelectorAll('.option-card').forEach(option => {
        const selected = option === button;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
    });
    message.textContent = '';
}
document.querySelectorAll('.option-card').forEach(button => button.addEventListener('click', () => selectOption(button)));
const restored = readFilters() || storage.read('filters');
if (validFilters(restored)) {
    regionOptions.forEach(option => { option.checked = option.value === restored.region; });
    ['companion', 'weather'].forEach(key => {
        const button = [...document.querySelectorAll(`#${key}-options .option-card`)].find(option => option.dataset.value === restored[key]);
        if (button) selectOption(button);
    });
}
document.getElementById('time-period').value = ['오전','오후'].includes(restored?.time) ? restored.time : '오후';
const saved = storage.read('selection');
document.getElementById('saved-course-link').hidden = !(validFilters(saved?.filters) && validCourse(saved?.course));

document.getElementById('search-form').addEventListener('submit', event => {
    event.preventDefault();
    const filters = {
        time: document.getElementById('time-period').value,
        region: regionOptions.find(option => option.checked)?.value,
        companion: document.querySelector('#companion-options .selected')?.dataset.value,
        weather: document.querySelector('#weather-options .selected')?.dataset.value,
    };
    if (!validFilters(filters)) {
        message.textContent = !filters.region ? '지역을 선택해주세요.' : !filters.companion ? '동행 유형을 선택해주세요.' : '날씨를 선택해주세요.';
        const target = !filters.region ? regionOptions[0] : document.querySelector(!filters.companion ? '#companion-options button' : '#weather-options button');
        target?.focus();
        return;
    }
    storage.write('filters', filters);
    storage.remove('results');
    location.href = pageUrl('page2', filters);
});

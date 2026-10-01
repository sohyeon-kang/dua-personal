export type Category = '식당' | '카페' | '소품샵' | '기타';
export interface Location {
    id: string; name: string; address: string; category: Category;
    latitude: number; longitude: number; weather: string;
    details: { access: string; parking: string; waiting: string; kids: string; seat: string; view: string };
}
export interface Filters { region: string; companion: string; weather: string }
export interface CourseStop extends Location {
    score: number; recommendationReasons: string[]; distanceFromPreviousKm: number; order: number;
}

const regions: Record<string, string> = {
    '광안리': '수영구', '수영구': '수영구', '해운대': '해운대구', '해운대구': '해운대구',
    '서면': '서면', '부산진구': '서면',
};
export function normalizeFilters(values: Record<string, unknown>): Filters | null {
    const get = (key: string) => typeof values[key] === 'string' ? (values[key] as string).trim() : '';
    const region = Object.hasOwn(regions, get('region')) ? regions[get('region')] : '';
    const companion = get('companion') === '데이트' ? '연인' : get('companion');
    const weather = get('weather');
    if (!region || !['가족', '연인', '친구', '혼자'].includes(companion) || !['맑음', '비', '폭염'].includes(weather)) return null;
    return { region, companion, weather };
}

export function matchesRegion(location: Location, region: string): boolean {
    const normalized = Object.hasOwn(regions, region) ? regions[region] : '';
    if (normalized === '서면') return /부산진구|서면|전포동|부전동/.test(location.address);
    return Boolean(normalized && location.address.includes(normalized));
}

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

export function scoreLocation(location: Location, filters: Filters) {
    const text = Object.values(location.details).join(' ');
    const contains = (words: string[]) => words.some(word => text.includes(word));
    let score = 10;
    const reasons = new Set<string>();
    const add = (points: number, reason: string, positive: string[], negative: string[] = []) => {
        if (contains(positive) && !contains(negative)) { score += points; reasons.add(reason); }
    };
    if (location.weather.includes(filters.weather)) {
        score += 8;
        reasons.add(`${filters.weather} 날씨에 적합한 장소입니다.`);
    }
    if (filters.companion === '가족') {
        add(6, '가족이 함께 방문하기 좋습니다.', ['가족', '키즈 동반 가능'], ['노키즈존', '키즈 동반 불가']);
        add(5, '아기 의자가 마련되어 있습니다.', ['아기의자 구비', '아기 의자 구비', '유아 의자 구비'],
            ['아기의자 없음', '아기 의자 없음', '유아 의자 없음', '아기 의자나 식기 없음']);
        add(3, '유모차로 접근하기 편리합니다.', ['유모차 출입 가능', '유모차 및 휠체어 출입 가능'], ['유모차 출입 어려움', '유모차 출입 불가']);
        if (contains(['노키즈존', '아기의자 없음', '아기 의자 없음', '유아 의자 없음'])) score -= 15;
    } else if (filters.companion === '연인') {
        add(6, '데이트 장소로 어울리는 분위기입니다.', ['데이트', '연인', '오션뷰', '바다 뷰', '분위기 좋음']);
    } else if (filters.companion === '친구') {
        add(5, '친구와 방문하기 좋습니다.', ['친구', '단체', '넓은 좌석', '좌석 간격 넓음']);
    } else if (filters.companion === '혼자') {
        add(7, '혼자 이용하기 좋은 좌석이 있습니다.', ['1인석', '1인 식사 가능', '바 좌석', '혼자 방문']);
    }
    if (filters.weather === '비') {
        add(5, '비를 피할 수 있는 대기 공간이 있습니다.', ['실내 대기', '대기 공간 존재', '비나 더위 피할 곳 있음', '비, 더위 피할 수 있는'], ['대기 공간 없음', '피할 곳 없음']);
        add(3, '차량으로 방문하기 편리합니다.', ['주차 가능', '주차장 있음', '주차장 존재', '공영주차장', '민영주차장'], ['주차장 없음', '주차 불가', '주차 불가능']);
        if (contains(['야외 대기', '피할 곳 없음', '인도 없음'])) score -= 6;
    } else if (filters.weather === '맑음') {
        add(6, '맑은 날 전망을 즐기기 좋습니다.', ['바다 뷰', '바다뷰', '오션뷰', '야외', '산책', '전망']);
    } else if (filters.weather === '폭염') {
        add(4, '더위를 피할 수 있는 공간이 있습니다.', ['실내 대기', '대기 공간 존재', '더위 피할 곳 있음', '비나 더위 피할 곳 있음'], ['대기 공간 없음', '피할 곳 없음']);
        if (contains(['야외 대기', '햇빛 아래', '더위 피할 곳 없음'])) score -= 6;
    }
    if (!reasons.size) reasons.add('선택 조건과 이동 거리를 종합해 추천되었습니다.');
    return { ...location, score, recommendationReasons: [...reasons] };
}

export function generateCourses(locations: Location[], filters: Filters, random: () => number = Math.random): CourseStop[][] {
    const order: Category[] = ['식당', '카페', '소품샵'];
    const seen = new Set<string>();
    const candidates = locations.filter(location => {
        if (!matchesRegion(location, filters.region) || seen.has(location.id)) return false;
        seen.add(location.id);
        return true;
    }).map(location => scoreLocation(location, filters));
    // 부족한 카테고리를 건너뛴 불완전한 코스는 만들지 않는다.
    const count = Math.min(3, ...order.map(category => candidates.filter(location => location.category === category).length));
    const used = new Set<string>();
    const courses: CourseStop[][] = [];
    for (let index = 0; index < count; index++) {
        const course: CourseStop[] = [];
        for (const category of order) {
            const previous = course[course.length - 1];
            const ranked = candidates.filter(location => location.category === category && !used.has(location.id))
                .map(location => {
                    const distance = previous ? getDistance(previous.latitude, previous.longitude, location.latitude, location.longitude) : 0;
                    return { location, distance, rank: location.score - Math.min(distance * 2, 10) };
                }).sort((first, second) => second.rank - first.rank);
            // 조건 점수의 의미를 유지하면서 비슷하게 좋은 후보끼리 변화를 준다.
            const top = ranked.filter(candidate => candidate.rank >= ranked[0].rank - 2).slice(0, 6);
            const selected = top[Math.min(top.length - 1, Math.max(0, Math.floor(random() * top.length)))];
            used.add(selected.location.id);
            course.push({ ...selected.location, distanceFromPreviousKm: Number(selected.distance.toFixed(2)), order: course.length + 1 });
        }
        courses.push(course);
    }
    return courses;
}

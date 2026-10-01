import Papa from 'papaparse';
import type { Location, Category } from './recommendations';

function normalizeCategory(value: string): Category {
    if (value.includes('식당')) return '식당';
    if (value.includes('카페')) return '카페';
    if (/소품|소풉/.test(value)) return '소품샵';
    return '기타';
}

export function parseLocations(csv: string): Location[] {
    const parsed = Papa.parse<Record<string, string>>(csv, {
        header: true, skipEmptyLines: 'greedy',
        transformHeader: header => header.trim(), transform: value => value.trim(),
    });
    const required = ['id (고유번호)', 'name (이름)', 'address (주소)', 'latitude (위도)', 'longitude (경도)', 'category (카테고리)'];
    if (parsed.errors.length || required.some(field => !parsed.meta.fields?.includes(field))) {
        throw new Error('장소 CSV 형식이 올바르지 않습니다.');
    }
    const seen = new Set<string>();
    const locations: Location[] = [];
    for (const row of parsed.data) {
        const id = row['id (고유번호)'];
        const name = row['name (이름)'];
        const address = row['address (주소)'];
        const latitude = Number(row['latitude (위도)']);
        const longitude = Number(row['longitude (경도)']);
        if (!id || seen.has(id) || !name || !address || !row['latitude (위도)'] || !row['longitude (경도)'] ||
            !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || latitude === 0 || longitude === 0) continue;
        seen.add(id);
        locations.push({
            id, name, address, latitude, longitude,
            category: normalizeCategory(row['category (카테고리)'] || ''),
            weather: row['weather (날씨)'] || '',
            details: {
                access: row['access (이동/접근성)'] || '', parking: row['parking (주차)'] || '',
                waiting: row['waiting (웨이팅)'] || '', kids: row['kids (키즈존/아기)'] || '',
                seat: row['seat (이용/좌석)'] || '', view: row['view (분위기/뷰)'] || '',
            },
        });
    }
    return locations;
}

// 동시 요청은 하나로 합치고, 실패한 요청은 다음 재시도에서 다시 불러온다.
export function createLocationStore(url: string, fetcher: typeof fetch = fetch) {
    let cache: Location[] | undefined;
    let loadedAt = 0;
    let pending: Promise<Location[]> | undefined;
    return async (): Promise<Location[]> => {
        if (cache && Date.now() - loadedAt < 5 * 60 * 1000) return cache;
        if (!pending) {
            pending = (async () => {
                const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
                if (!response.ok) throw new Error(`장소 CSV 요청 실패: ${response.status}`);
                const locations = parseLocations(await response.text());
                cache = locations;
                loadedAt = Date.now();
                return locations;
            })().finally(() => { pending = undefined; });
        }
        return pending;
    };
}

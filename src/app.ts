import express from 'express';
import path from 'node:path';
import 'dotenv/config';
import { createLocationStore } from './data';
import { generateCourses, normalizeFilters, matchesRegion } from './recommendations';
import type { Location } from './recommendations';

const DEFAULT_SHEET = 'https://docs.google.com/spreadsheets/d/1l1YE4MTuho5VgQXT-QhLiOJbiYvziIK1w1yL8LDMvFw/export?format=csv&gid=0';
const DEFAULT_MAP_KEY = 'dd88b9ca50995197b849e4ed9948edd1';

export function createApp(options: { getLocations?: () => Promise<Location[]>; mapKey?: string } = {}) {
    const app = express();
    const getLocations = options.getLocations ?? createLocationStore(process.env.SHEET_CSV_URL?.trim() || DEFAULT_SHEET);
    app.disable('x-powered-by');
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/config', (_req, res) => {
        // JavaScript SDK 키는 브라우저 공개용이며 서버용 REST 키와 다르다.
        res.json({ kakaoMapAppKey: options.mapKey ?? process.env.KAKAO_MAP_APP_KEY?.trim() ?? DEFAULT_MAP_KEY });
    });
    app.get('/api/locations', async (req, res) => {
        try {
            const region = typeof req.query.region === 'string' ? req.query.region.trim() : '';
            const locations = (await getLocations()).filter(location => !region || matchesRegion(location, region));
            res.json({ count: locations.length, locations });
        } catch (error) {
            console.error('장소 데이터 로드 실패:', error);
            res.status(503).json({ error: '장소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
        }
    });
    app.get('/api/recommend-course', async (req, res) => {
        const filters = normalizeFilters(req.query);
        if (!filters) {
            res.status(400).json({ error: '지역, 동행 유형, 날씨를 다시 선택해주세요.' });
            return;
        }
        try {
            const courses = generateCourses(await getLocations(), filters);
            const message = courses.length === 0
                ? '이 지역에는 식당·카페·소품샵을 모두 포함한 코스를 만들 장소가 아직 부족합니다. 다른 지역을 선택해주세요.'
                : courses.length < 3
                    ? `장소가 중복되지 않는 완성된 코스 ${courses.length}개를 찾았습니다.`
                    : '';
            res.set('Cache-Control', 'no-store').json({ ...filters, courses, message });
        } catch (error) {
            console.error('추천 데이터 로드 실패:', error);
            res.status(503).json({ error: '추천에 필요한 장소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
        }
    });
    app.use('/api', (_req, res) => res.status(404).json({ error: '요청한 기능을 찾을 수 없습니다.' }));
    app.get('/', (_req, res) => res.redirect('/mobile/page1/'));
    app.use(express.static(path.resolve(__dirname, '../frontend')));
    return app;
}

if (require.main === module) {
    const port = Number(process.env.PORT || 8080);
    createApp().listen(port, '127.0.0.1', () => console.log(`DUA 실행 중: http://localhost:${port}`));
}

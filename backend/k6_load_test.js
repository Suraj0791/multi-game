import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    'http_req_duration{endpoint:leaderboard}': ['p(95)<250'],
    'http_req_duration{endpoint:tournaments}': ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const leaderboardRes = http.get(`${BASE_URL}/leaderboard?limit=10`, {
    tags: { endpoint: 'leaderboard' },
  });

  check(leaderboardRes, {
    'leaderboard returned 200': (res) => res.status === 200,
    'leaderboard returned JSON': (res) =>
      String(res.headers['Content-Type'] || '').includes('application/json'),
  });

  sleep(1);

  const tournamentsRes = http.get(`${BASE_URL}/tournaments`, {
    tags: { endpoint: 'tournaments' },
  });

  check(tournamentsRes, {
    'tournaments returned 200': (res) => res.status === 200,
    'tournaments returned JSON': (res) =>
      String(res.headers['Content-Type'] || '').includes('application/json'),
  });

  sleep(1);
}

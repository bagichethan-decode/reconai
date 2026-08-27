import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 25 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 }
    ],

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<1000']
    }
};

const BASE_URL = 'http://localhost:3000';

export default function () {

    const responses = [
        http.get(`${BASE_URL}/api/health`),
        http.get(`${BASE_URL}/api/reconciliation/summary`),
        http.get(`${BASE_URL}/api/reconciliation/exceptions`),
        http.get(`${BASE_URL}/api/reconciliation/orders`)
    ];

    responses.forEach((response) => {
        check(response, {
            'status is 200': (r) => r.status === 200
        });
    });

    sleep(1);
}
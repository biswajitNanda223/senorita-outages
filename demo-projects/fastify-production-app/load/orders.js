import http from 'k6/http';
import { check, sleep } from 'k6';

function randomHex(length) {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += Math.floor(Math.random() * 16).toString(16);
  }
  return value;
}

function randomUUID() {
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
}

export const options = {
  scenarios: {
    two_thousand_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '3m', target: 2000 },
        { duration: '10m', target: 2000 },
        { duration: '2m', target: 0 }
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000']
  }
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const response = http.post(
    `${baseUrl}/v1/orders`,
    JSON.stringify({ userId: randomUUID(), amount: 49.99 }),
    {
      headers: {
        'content-type': 'application/json',
        'idempotency-key': randomUUID()
      }
    }
  );
  check(response, { 'created': (result) => result.status === 201 });
  sleep(1);
}

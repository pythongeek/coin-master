import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const wsLatency = new Trend('ws_latency');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 }, // Ramp up to 1000 users
    { duration: '5m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // 95% of requests under 200ms
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
    'errors': ['rate<0.05'],            // Less than 5% custom errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    'health status is 200': (r) => r.status === 200,
  });
  apiLatency.add(health.timings.duration);
  errorRate.add(health.status !== 200);

  // Game config
  const config = http.get(`${BASE_URL}/api/game/config`);
  check(config, {
    'config status is 200': (r) => r.status === 200,
  });
  apiLatency.add(config.timings.duration);

  // Get active seed
  const seed = http.get(`${BASE_URL}/api/game/seed`);
  check(seed, {
    'seed status is 200': (r) => r.status === 200,
  });
  apiLatency.add(seed.timings.duration);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-summary.json': JSON.stringify(data),
  };
}

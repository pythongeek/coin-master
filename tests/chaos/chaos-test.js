import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * CryptoFlip Chaos Engineering Tests
 * 
 * These tests simulate failures in infrastructure components
 * to verify the system's resilience.
 */

const errorRate = new Rate('chaos_errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Baseline normal load
    { duration: '2m', target: 50 },    // Inject failure
    { duration: '1m', target: 50 },    // Recovery
  ],
  thresholds: {
    'chaos_errors': ['rate<0.3'],       // Accept up to 30% errors during chaos
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const CHAOS_MODE = __ENV.CHAOS_MODE || 'redis'; // redis | db | network | all

export default function () {
  // Test health endpoint during chaos
  const health = http.get(`${BASE_URL}/health`, {
    timeout: '5s',
  });
  
  check(health, {
    'health returns within timeout': (r) => r.timings.waiting < 5000,
    'health status acceptable': (r) => r.status === 200 || r.status === 503,
  });
  
  errorRate.add(health.status >= 500);

  // Test game config (should work with cached data even if DB is down)
  const config = http.get(`${BASE_URL}/api/game/config`, {
    timeout: '5s',
  });
  
  check(config, {
    'config returns or fails gracefully': (r) => r.status === 200 || r.status === 503,
  });
  
  errorRate.add(config.status >= 500);

  // Test bet placement (should fail gracefully if Redis is down)
  const bet = http.post(`${BASE_URL}/api/game/bet`, JSON.stringify({
    amount: 1,
    currency: 'ETH',
    prediction: 'HEADS',
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s',
  });
  
  check(bet, {
    'bet handles failure gracefully': (r) => r.status === 200 || r.status === 503 || r.status === 500,
  });
  
  errorRate.add(bet.status >= 500);

  sleep(1);
}

export function handleSummary(data) {
  return {
    [`chaos-${CHAOS_MODE}-summary.json`]: JSON.stringify(data),
  };
}

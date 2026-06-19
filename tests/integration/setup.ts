import { Redis } from 'ioredis';

/**
 * Setup file for integration tests
 * Initializes test environment
 */

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/cryptoflip_test';
  process.env.REDIS_URL = 'redis://localhost:6380/1';
});

afterAll(async () => {
  // Cleanup connections if needed
  // const redis = new Redis(process.env.REDIS_URL!);
  // await redis.disconnect();
});

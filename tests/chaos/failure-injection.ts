import { Redis } from 'ioredis';
import { execSync } from 'child_process';

/**
 * Chaos Engineering Failure Injection Scripts
 * 
 * Usage: Run these scripts manually during a load test to inject failures
 * 
 * Example:
 *   # Terminal 1: Run load test
 *   k6 run tests/load/api-load-test.js
 *   
 *   # Terminal 2: Inject Redis failure
 *   npx ts-node tests/chaos/inject-redis-failure.ts
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DB_CONTAINER = process.env.DB_CONTAINER || 'cryptoflip-postgres-1';
const REDIS_CONTAINER = process.env.REDIS_CONTAINER || 'cryptoflip-redis-1';

/**
 * Inject Redis connection failure by pausing the container
 */
export async function injectRedisFailure(duration: number = 30000): Promise<void> {
  console.log(`[CHAOS] Injecting Redis failure for ${duration}ms...`);
  
  try {
    // Pause Redis container
    execSync(`docker pause ${REDIS_CONTAINER}`, { stdio: 'inherit' });
    console.log('[CHAOS] Redis container paused');
    
    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Resume Redis container
    execSync(`docker unpause ${REDIS_CONTAINER}`, { stdio: 'inherit' });
    console.log('[CHAOS] Redis container resumed');
  } catch (error) {
    console.error('[CHAOS] Redis failure injection failed:', error);
    // Ensure cleanup
    try {
      execSync(`docker unpause ${REDIS_CONTAINER}`);
    } catch { /* ignore */ }
  }
}

/**
 * Inject DB connection failure by pausing the container
 */
export async function injectDbFailure(duration: number = 30000): Promise<void> {
  console.log(`[CHAOS] Injecting DB failure for ${duration}ms...`);
  
  try {
    // Pause DB container
    execSync(`docker pause ${DB_CONTAINER}`, { stdio: 'inherit' });
    console.log('[CHAOS] DB container paused');
    
    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Resume DB container
    execSync(`docker unpause ${DB_CONTAINER}`, { stdio: 'inherit' });
    console.log('[CHAOS] DB container resumed');
  } catch (error) {
    console.error('[CHAOS] DB failure injection failed:', error);
    // Ensure cleanup
    try {
      execSync(`docker unpause ${DB_CONTAINER}`);
    } catch { /* ignore */ }
  }
}

/**
 * Inject network latency using tc (traffic control)
 */
export async function injectNetworkLatency(latency: number = 200, duration: number = 30000): Promise<void> {
  console.log(`[CHAOS] Injecting ${latency}ms network latency for ${duration}ms...`);
  
  try {
    // Add latency to network interface
    execSync(`docker exec ${REDIS_CONTAINER} tc qdisc add dev eth0 root netem delay ${latency}ms`, { stdio: 'inherit' });
    console.log('[CHAOS] Network latency added');
    
    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Remove latency
    execSync(`docker exec ${REDIS_CONTAINER} tc qdisc del dev eth0 root`, { stdio: 'inherit' });
    console.log('[CHAOS] Network latency removed');
  } catch (error) {
    console.error('[CHAOS] Network latency injection failed:', error);
    // Ensure cleanup
    try {
      execSync(`docker exec ${REDIS_CONTAINER} tc qdisc del dev eth0 root`);
    } catch { /* ignore */ }
  }
}

/**
 * Flush Redis data (simulates data corruption)
 */
export async function injectRedisDataLoss(): Promise<void> {
  console.log('[CHAOS] Injecting Redis data loss...');
  
  const redis = new Redis(REDIS_URL);
  try {
    await redis.flushall();
    console.log('[CHAOS] Redis data flushed');
  } catch (error) {
    console.error('[CHAOS] Redis data loss injection failed:', error);
  } finally {
    await redis.disconnect();
  }
}

/**
 * Run all chaos scenarios sequentially
 */
export async function runChaosScenarios(): Promise<void> {
  console.log('[CHAOS] Starting chaos engineering scenarios...');
  
  // Scenario 1: Redis failure
  await injectRedisFailure(10000);
  await new Promise(resolve => setTimeout(resolve, 5000)); // Recovery time
  
  // Scenario 2: DB failure
  await injectDbFailure(10000);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Scenario 3: Network latency
  await injectNetworkLatency(500, 10000);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('[CHAOS] All chaos scenarios completed');
}

// CLI entry point
if (require.main === module) {
  const scenario = process.argv[2] || 'all';
  const duration = parseInt(process.argv[3] || '30000', 10);
  
  switch (scenario) {
    case 'redis':
      injectRedisFailure(duration).then(() => process.exit(0));
      break;
    case 'db':
      injectDbFailure(duration).then(() => process.exit(0));
      break;
    case 'network':
      injectNetworkLatency(200, duration).then(() => process.exit(0));
      break;
    case 'data-loss':
      injectRedisDataLoss().then(() => process.exit(0));
      break;
    case 'all':
    default:
      runChaosScenarios().then(() => process.exit(0));
      break;
  }
}

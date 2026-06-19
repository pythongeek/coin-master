import { Request, Response, NextFunction } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Initialize default metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({ prefix: 'cryptoflip_' });

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'cryptoflip_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestsTotal = new Counter({
  name: 'cryptoflip_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const activeConnections = new Gauge({
  name: 'cryptoflip_active_connections',
  help: 'Number of active WebSocket connections',
});

export const betTotal = new Counter({
  name: 'cryptoflip_bets_total',
  help: 'Total number of bets placed',
  labelNames: ['currency', 'outcome'],
});

export const betAmount = new Histogram({
  name: 'cryptoflip_bet_amount',
  help: 'Bet amounts in USD equivalent',
  labelNames: ['currency'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
});

export const fraudEventsTotal = new Counter({
  name: 'cryptoflip_fraud_events_total',
  help: 'Total number of fraud events detected',
  labelNames: ['rule', 'action'],
});

export const contractBalance = new Gauge({
  name: 'cryptoflip_escrow_contract_balance',
  help: 'Smart contract escrow balance in ETH',
  labelNames: ['chain'],
});

export const dbConnections = new Gauge({
  name: 'cryptoflip_db_connections',
  help: 'Active database connections',
});

export const redisOperations = new Counter({
  name: 'cryptoflip_redis_operations_total',
  help: 'Total Redis operations',
  labelNames: ['operation'],
});

export const wsMessagesTotal = new Counter({
  name: 'cryptoflip_ws_messages_total',
  help: 'Total WebSocket messages',
  labelNames: ['event'],
});

export const chatMessagesTotal = new Counter({
  name: 'cryptoflip_chat_messages_total',
  help: 'Total chat messages sent',
  labelNames: ['room'],
});

export const rainEventsTotal = new Counter({
  name: 'cryptoflip_rain_events_total',
  help: 'Total rain events created',
});

export const withdrawalTotal = new Counter({
  name: 'cryptoflip_withdrawals_total',
  help: 'Total withdrawals processed',
  labelNames: ['chain', 'status'],
});

export const depositTotal = new Counter({
  name: 'cryptoflip_deposits_total',
  help: 'Total deposits processed',
  labelNames: ['chain', 'status'],
});

/**
 * Express middleware to measure HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const route = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const status = res.statusCode.toString();
    const method = req.method;

    httpRequestDuration.observe({ method, route, status }, duration);
    httpRequestsTotal.inc({ method, route, status });
  });

  next();
}

/**
 * Express handler for /metrics endpoint
 */
export async function metricsHandler(req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
}

/**
 * Update contract balance gauge
 */
export function updateContractBalance(chain: string, balance: number): void {
  contractBalance.set({ chain }, balance);
}

/**
 * Record a bet metric
 */
export function recordBet(currency: string, amount: number, outcome: 'win' | 'loss'): void {
  betTotal.inc({ currency, outcome });
  betAmount.observe({ currency }, amount);
}

/**
 * Record a fraud event
 */
export function recordFraudEvent(rule: string, action: string): void {
  fraudEventsTotal.inc({ rule, action });
}

/**
 * Record WebSocket event
 */
export function recordWsEvent(event: string): void {
  wsMessagesTotal.inc({ event });
}

/**
 * Record chat message
 */
export function recordChatMessage(room: string): void {
  chatMessagesTotal.inc({ room });
}

/**
 * Record rain event
 */
export function recordRainEvent(): void {
  rainEventsTotal.inc();
}

/**
 * Record withdrawal
 */
export function recordWithdrawal(chain: string, status: 'success' | 'failed'): void {
  withdrawalTotal.inc({ chain, status });
}

/**
 * Record deposit
 */
export function recordDeposit(chain: string, status: 'success' | 'failed'): void {
  depositTotal.inc({ chain, status });
}

/**
 * Set active WebSocket connections
 */
export function setActiveConnections(count: number): void {
  activeConnections.set(count);
}

/**
 * Set DB connections
 */
export function setDbConnections(count: number): void {
  dbConnections.set(count);
}

/**
 * Record Redis operation
 */
export function recordRedisOperation(operation: string): void {
  redisOperations.inc({ operation });
}

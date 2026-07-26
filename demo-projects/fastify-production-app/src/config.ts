export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  dbPoolSize: number;
  requestTimeoutMs: number;
  rateLimitMax: number;
}

function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: positiveInt('PORT', 8080),
    databaseUrl:
      process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/orders',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    dbPoolSize: positiveInt('DB_POOL_SIZE', 20),
    requestTimeoutMs: positiveInt('REQUEST_TIMEOUT_MS', 10_000),
    rateLimitMax: positiveInt('RATE_LIMIT_MAX', 300)
  };
}

import { Pool } from 'pg';
import { createClient } from 'redis';
import type { AppConfig } from './config';
import { OrderService } from './order-service';
import { PostgresOrderRepository } from './postgres-order-repository';
import { RedisOrderCache } from './redis-order-cache';

export async function createInfrastructure(config: AppConfig) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolSize,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 5_000
  });
  const redis = createClient({ url: config.redisUrl });
  await Promise.all([pool.query('SELECT 1'), redis.connect()]);

  return {
    orderService: new OrderService(
      new PostgresOrderRepository(pool),
      new RedisOrderCache(redis)
    ),
    async ready(): Promise<boolean> {
      try {
        await Promise.all([pool.query('SELECT 1'), redis.ping()]);
        return true;
      } catch {
        return false;
      }
    },
    async close(): Promise<void> {
      await Promise.allSettled([pool.end(), redis.quit()]);
    },
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimitMax: config.rateLimitMax
  };
}

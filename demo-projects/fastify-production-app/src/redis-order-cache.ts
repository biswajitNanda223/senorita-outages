import type { Order, OrderCache } from './domain';

interface RedisConnection {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options: { EX: number }
  ): Promise<unknown>;
}

export class RedisOrderCache implements OrderCache {
  constructor(private readonly redis: RedisConnection) {}

  async get(id: string): Promise<Order | null> {
    const value = await this.redis.get(`order:${id}`);
    return value ? JSON.parse(value) as Order : null;
  }

  async set(order: Order): Promise<void> {
    await this.redis.set(`order:${order.id}`, JSON.stringify(order), {
      EX: 60 + Math.floor(Math.random() * 15)
    });
  }
}

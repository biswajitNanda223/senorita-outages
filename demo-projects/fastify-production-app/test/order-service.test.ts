import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CreateOrder,
  Order,
  OrderCache,
  OrderRepository
} from '../src/domain';
import { NotFoundError } from '../src/domain';
import { OrderService } from '../src/order-service';

class MemoryRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async create(input: CreateOrder, key: string): Promise<Order> {
    const order: Order = {
      id: key.padEnd(36, '0').slice(0, 36),
      ...input,
      status: 'pending',
      createdAt: new Date(0).toISOString()
    };
    this.orders.set(order.id, order);
    return order;
  }
}

class MemoryCache implements OrderCache {
  readonly orders = new Map<string, Order>();
  async get(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }
  async set(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }
}

test('create writes repository result into cache', async () => {
  const cache = new MemoryCache();
  const service = new OrderService(new MemoryRepository(), cache);
  const order = await service.create(
    { userId: 'user-1', amount: 25 },
    'request-1'
  );
  assert.deepEqual(await cache.get(order.id), order);
});

test('get throws a typed error when absent', async () => {
  const service = new OrderService(new MemoryRepository(), new MemoryCache());
  await assert.rejects(() => service.get('missing'), NotFoundError);
});

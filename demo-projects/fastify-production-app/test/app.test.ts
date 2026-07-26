import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreateOrder, Order, OrderCache, OrderRepository } from '../src/domain';
import { OrderService } from '../src/order-service';
import { buildApp } from '../src/app';

const fixedOrder: Order = {
  id: '822a20f1-81dc-49c3-b06d-395e6f30a443',
  userId: 'd9428888-34c8-4d8a-9eb8-552c9b3665af',
  amount: 10,
  status: 'pending',
  createdAt: new Date(0).toISOString()
};

const repository: OrderRepository = {
  async findById() { return fixedOrder; },
  async create(_input: CreateOrder) { return fixedOrder; }
};
const cache: OrderCache = {
  async get() { return null; },
  async set() {}
};

test('POST /v1/orders validates and returns 201', async () => {
  const app = await buildApp({
    orderService: new OrderService(repository, cache),
    async ready() { return true; },
    async close() {},
    requestTimeoutMs: 1_000,
    rateLimitMax: 100
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    headers: { 'idempotency-key': 'request-123' },
    payload: { userId: fixedOrder.userId, amount: 10 }
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, fixedOrder.id);
  await app.close();
});

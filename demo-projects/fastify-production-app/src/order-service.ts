import {
  ConflictError,
  NotFoundError,
  type CreateOrder,
  type Order,
  type OrderCache,
  type OrderRepository
} from './domain';

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly cache: OrderCache
  ) {}

  async get(id: string): Promise<Order> {
    const cached = await this.cache.get(id);
    if (cached) return cached;

    const order = await this.repository.findById(id);
    if (!order) throw new NotFoundError(`Order ${id} not found`);
    await this.cache.set(order);
    return order;
  }

  async create(input: CreateOrder, idempotencyKey: string): Promise<Order> {
    if (!idempotencyKey) throw new ConflictError('Idempotency-Key is required');
    const order = await this.repository.create(input, idempotencyKey);
    await this.cache.set(order);
    return order;
  }
}

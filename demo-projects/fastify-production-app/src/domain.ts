export interface Order {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

export interface CreateOrder {
  userId: string;
  amount: number;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  create(input: CreateOrder, idempotencyKey: string): Promise<Order>;
}

export interface OrderCache {
  get(id: string): Promise<Order | null>;
  set(order: Order): Promise<void>;
}

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

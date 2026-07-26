import type { Pool, PoolClient } from 'pg';
import type { CreateOrder, Order, OrderRepository } from './domain';

interface OrderRow {
  id: string;
  user_id: string;
  amount: string;
  status: 'pending' | 'confirmed';
  created_at: Date;
}

const mapRow = (row: OrderRow): Order => ({
  id: row.id,
  userId: row.user_id,
  amount: Number(row.amount),
  status: row.status,
  createdAt: row.created_at.toISOString()
});

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query<OrderRow>(
      'SELECT id, user_id, amount, status, created_at FROM orders WHERE id = $1',
      [id]
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async create(input: CreateOrder, key: string): Promise<Order> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<OrderRow>(
        `SELECT o.id, o.user_id, o.amount, o.status, o.created_at
         FROM idempotency_keys i JOIN orders o ON o.id = i.order_id
         WHERE i.key = $1 FOR UPDATE`,
        [key]
      );
      const prior = existing.rows[0];
      if (prior) {
        await client.query('COMMIT');
        return mapRow(prior);
      }

      const inserted = await this.insertOrder(client, input);
      await client.query(
        'INSERT INTO idempotency_keys (key, order_id) VALUES ($1, $2)',
        [key, inserted.id]
      );
      await client.query(
        `INSERT INTO outbox_events (topic, aggregate_id, payload)
         VALUES ('order.created', $1, $2::jsonb)`,
        [inserted.id, JSON.stringify(inserted)]
      );
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertOrder(
    client: PoolClient,
    input: CreateOrder
  ): Promise<Order> {
    const result = await client.query<OrderRow>(
      `INSERT INTO orders (user_id, amount)
       VALUES ($1, $2)
       RETURNING id, user_id, amount, status, created_at`,
      [input.userId, input.amount]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Order insert returned no row');
    return mapRow(row);
  }
}

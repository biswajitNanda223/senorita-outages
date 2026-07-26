import { setTimeout as delay } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { loadConfig } from './config';

interface OutboxEvent {
  id: string;
  topic: string;
  aggregate_id: string;
  payload: unknown;
}

async function publish(event: OutboxEvent): Promise<void> {
  // Replace with Kafka, SQS, Pub/Sub, or Service Bus producer.
  // Await broker acknowledgement before marking the event processed.
  console.info(JSON.stringify({
    message: 'event published',
    eventId: event.id,
    topic: event.topic,
    aggregateId: event.aggregate_id
  }));
}

async function claimAndPublish(client: PoolClient): Promise<number> {
  await client.query('BEGIN');
  try {
    const result = await client.query<OutboxEvent>(
      `SELECT id, topic, aggregate_id, payload
       FROM outbox_events
       WHERE processed_at IS NULL
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT 100`
    );

    for (const event of result.rows) {
      await publish(event);
      await client.query(
        'UPDATE outbox_events SET processed_at = NOW() WHERE id = $1',
        [event.id]
      );
    }

    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    statement_timeout: 10_000
  });
  let running = true;
  process.once('SIGINT', () => { running = false; });
  process.once('SIGTERM', () => { running = false; });

  while (running) {
    const client = await pool.connect();
    try {
      const count = await claimAndPublish(client);
      if (count === 0) await delay(500);
    } catch (error: unknown) {
      console.error(error);
      await delay(1_000);
    } finally {
      client.release();
    }
  }

  await pool.end();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

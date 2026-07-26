import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ConflictError, NotFoundError, type CreateOrder } from './domain';
import type { OrderService } from './order-service';

interface Dependencies {
  orderService: OrderService;
  ready(): Promise<boolean>;
  close(): Promise<void>;
  requestTimeoutMs: number;
  rateLimitMax: number;
}

interface OrderParams {
  id: string;
}

export async function buildApp(deps: Dependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie']
    },
    requestTimeout: deps.requestTimeoutMs,
    bodyLimit: 1_048_576,
    trustProxy: true
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: deps.rateLimitMax,
    timeWindow: '1 minute'
  });

  app.get('/health/live', async () => ({ status: 'alive' }));
  app.get('/health/ready', async (_request, reply) => {
    const ready = await deps.ready();
    return ready
      ? { status: 'ready' }
      : reply.code(503).send({ status: 'not-ready' });
  });

  app.get<{ Params: OrderParams }>('/v1/orders/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } }
      }
    }
  }, async (request) => deps.orderService.get(request.params.id));

  app.post<{ Body: CreateOrder }>('/v1/orders', {
    schema: {
      headers: {
        type: 'object',
        required: ['idempotency-key'],
        properties: { 'idempotency-key': { type: 'string', minLength: 8 } }
      },
      body: {
        type: 'object',
        required: ['userId', 'amount'],
        additionalProperties: false,
        properties: {
          userId: { type: 'string', format: 'uuid' },
          amount: { type: 'number', exclusiveMinimum: 0, maximum: 1_000_000 }
        }
      }
    }
  }, async (request, reply) => {
    const key = String(request.headers['idempotency-key']);
    const order = await deps.orderService.create(request.body, key);
    return reply.code(201).send(order);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, 'Request failed');
    const isValidationError =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error;
    if (isValidationError) {
      return reply.code(400).send({ code: 'VALIDATION_ERROR' });
    }
    if (error instanceof NotFoundError) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: error.message });
    }
    if (error instanceof ConflictError) {
      return reply.code(409).send({ code: 'CONFLICT', message: error.message });
    }
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });

  app.addHook('onClose', deps.close);
  return app;
}

# Fastify + TypeScript: Beginner to Advanced

This guide explains Fastify from first route to production architecture. Examples
use strict TypeScript and match the structure used by `demo-app/`.

## 1. Mental model

Fastify processes one request through a lifecycle:

```text
request
  -> routing
  -> schema validation
  -> authentication hook
  -> handler
  -> response serialization
  -> logging
```

Fastify gives:

- Router: matches HTTP method and URL.
- Request: headers, params, query, and body.
- Reply: status, headers, and response body.
- Schema: validates input and serializes output.
- Plugin: encapsulates routes or infrastructure.
- Hook: runs at a lifecycle stage.
- Decorator: adds a typed shared capability.

## 2. Strict TypeScript setup

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3"
  }
}
```

Important compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

`strict` catches missing fields, unsafe `undefined`, wrong request shapes, and
unhandled `unknown` errors before deployment.

## 3. First server

```typescript
import process from 'node:process';
import Fastify from 'fastify';

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 8080);

app.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString()
}));

async function start(): Promise<void> {
  try {
    await app.listen({ host: '0.0.0.0', port });
  } catch (error: unknown) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
```

Use `0.0.0.0` in containers and managed app runtimes. `localhost` accepts only
traffic originating inside the container.

## 4. Typed route inputs

```typescript
interface ItemParams {
  id: string;
}

interface ItemQuery {
  includeDetails?: boolean;
}

interface CreateItemBody {
  title: string;
  description?: string;
}

app.post<{
  Params: ItemParams;
  Querystring: ItemQuery;
  Body: CreateItemBody;
}>('/items/:id', async (request, reply) => {
  const { id } = request.params;
  const { includeDetails = false } = request.query;
  const { title, description } = request.body;

  return reply.code(201).send({
    id,
    title,
    description,
    includeDetails
  });
});
```

TypeScript types help developers. Runtime schemas protect the server from
untrusted HTTP input. Use both.

## 5. Validation and response schemas

```typescript
app.post<{ Body: CreateItemBody }>('/items', {
  schema: {
    body: {
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string', maxLength: 2000 }
      }
    },
    response: {
      201: {
        type: 'object',
        required: ['id', 'title'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  return reply.code(201).send({
    id: crypto.randomUUID(),
    ...request.body
  });
});
```

Benefits:

- Reject bad requests before handler work.
- Strip unexpected response data through serialization.
- Improve speed with compiled validators/serializers.
- Provide source material for OpenAPI generation.

For large APIs, use TypeBox or a similar type provider so one schema produces
runtime validation and TypeScript inference.

## 6. Routes, services, and repositories

Avoid one giant `server.ts`:

```text
src/
  app.ts                 # create Fastify instance
  server.ts              # process startup and shutdown
  plugins/
    database.ts          # connection lifecycle
    auth.ts              # authentication
  modules/
    items/
      item.schema.ts     # request/response schemas
      item.repository.ts # SQL only
      item.service.ts    # business rules
      item.routes.ts     # HTTP mapping
```

Responsibilities:

```text
route      = HTTP details
service    = business rules
repository = database details
plugin     = shared infrastructure + lifecycle
```

Handlers stay short and testable. Business logic can run without HTTP.

## 7. Plugins and encapsulation

```typescript
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    itemService: {
      list(): Promise<Array<{ id: string; title: string }>>;
    };
  }
}

export default fp(async (app) => {
  const itemService = {
    async list() {
      return [{ id: '1', title: 'Example' }];
    }
  };

  app.decorate('itemService', itemService);
});
```

Register dependencies before routes:

```typescript
await app.register(itemServicePlugin);
await app.register(itemRoutes, { prefix: '/api' });
```

Fastify encapsulation prevents child-plugin decorators, hooks, and routes from
leaking into unrelated branches.

## 8. Hooks

Common lifecycle hooks:

| Hook | Use |
|:---|:---|
| `onRequest` | correlation IDs, early authentication |
| `preParsing` | transform raw payload |
| `preValidation` | derive data before validation |
| `preHandler` | authorization and request-scoped setup |
| `onSend` | response headers or final transformation |
| `onResponse` | metrics after response is sent |
| `onClose` | close DB, Redis, telemetry |

```typescript
app.addHook('onRequest', async (request) => {
  request.log.info({ requestId: request.id }, 'Request started');
});
```

Do not place slow remote calls in a global hook unless every request needs them.

## 9. Error handling

Caught values are `unknown` under strict TypeScript:

```typescript
const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
```

Centralize HTTP error mapping:

```typescript
app.setErrorHandler((error, request, reply) => {
  request.log.error({ error }, 'Request failed');

  if (error.validation) {
    return reply.code(400).send({
      code: 'VALIDATION_ERROR',
      message: error.message
    });
  }

  return reply.code(500).send({
    code: 'INTERNAL_ERROR',
    message: 'Unexpected server error'
  });
});
```

Log internal detail. Return stable public error codes. Never return stack traces,
SQL errors, tokens, or secret values.

## 10. Node.js event loop

Node executes JavaScript callbacks on one main thread. Async network and file
operations are delegated; completed work queues callbacks for the event loop.

```text
incoming request
  -> synchronous handler code
  -> await DB/network operation
  -> event loop serves other work
  -> operation completes
  -> handler resumes
```

Good async work:

- Database queries
- Redis commands
- HTTP calls
- Object-storage operations

Bad main-thread work:

- Huge JSON transformations
- Image/video processing
- Large compression jobs
- CPU-heavy cryptography
- Long synchronous loops

Move CPU-heavy work to worker threads, a job queue, or separate compute.

## 11. Loop patterns: choose by semantics

### Sequential loop

Use when order matters, each step depends on the previous step, or the target
system needs strict rate control:

```typescript
for (const item of items) {
  await processItem(item);
}
```

### Parallel loop

Use for a small, independent set:

```typescript
const results = await Promise.all(
  items.map((item) => processItem(item))
);
```

Failure of one promise rejects the whole `Promise.all`. Use
`Promise.allSettled` when all outcomes must be collected:

```typescript
const outcomes = await Promise.allSettled(
  items.map((item) => processItem(item))
);

const failures = outcomes.filter(
  (outcome): outcome is PromiseRejectedResult =>
    outcome.status === 'rejected'
);
```

### Bounded concurrency

Never launch 100,000 DB/API calls at once. Process batches:

```typescript
async function processInBatches<T>(
  items: readonly T[],
  batchSize: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    await Promise.all(batch.map(worker));
  }
}

await processInBatches(items, 10, processItem);
```

For advanced workloads, use a concurrency limiter or queue with retries,
backoff, idempotency keys, and dead-letter handling.

### Do not use `forEach` with `async`

```typescript
// Wrong: caller cannot await callbacks.
items.forEach(async (item) => {
  await processItem(item);
});

// Correct: sequential.
for (const item of items) {
  await processItem(item);
}

// Correct: parallel.
await Promise.all(items.map(processItem));
```

### Transform data declaratively

Prefer clear intent:

```typescript
const activeIds = users
  .filter((user) => user.active)
  .map((user) => user.id);
```

Use one `for...of` loop when multiple chained passes create excessive memory or
when early exit is useful:

```typescript
const activeIds: string[] = [];

for (const user of users) {
  if (!user.active) continue;
  activeIds.push(user.id);
  if (activeIds.length === 100) break;
}
```

## 12. Database and Redis patterns

- Create pools/clients once during startup, not per request.
- Use parameterized SQL.
- Add timeouts.
- Keep transactions short.
- Close clients during shutdown.
- Decide cache failure behavior explicitly.
- Prevent cache stampedes for popular missing keys.

```typescript
const result = await pool.query(
  'SELECT id, title FROM items WHERE id = $1',
  [itemId]
);
```

Never concatenate untrusted input into SQL.

## 13. Testing with `inject`

Build app separately from network startup:

```typescript
export function buildApp() {
  const app = Fastify();
  app.get('/health', async () => ({ status: 'healthy' }));
  return app;
}
```

Test without opening a port:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from './app';

test('GET /health', async () => {
  const app = buildApp();
  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'healthy' });
  await app.close();
});
```

Test:

- Happy paths
- Validation failures
- Authentication and authorization
- Dependency failure and timeout behavior
- Idempotency
- Shutdown cleanup

## 14. Graceful shutdown

```typescript
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await redis.quit();
  await pool.end();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
```

`app.close()` stops new work and runs `onClose` hooks. Kubernetes and managed
runtimes send `SIGTERM` during replacement or scale-down.

## 15. Production checklist

- [ ] Strict TypeScript typecheck passes.
- [ ] Request and response schemas cover every public route.
- [ ] Authentication and authorization are separate and tested.
- [ ] Logs are structured and exclude sensitive data.
- [ ] DB, cache, and outbound HTTP calls have timeouts.
- [ ] Async loops use deliberate sequential, parallel, or bounded concurrency.
- [ ] CPU-heavy work does not block the event loop.
- [ ] Health endpoints distinguish liveness from dependency readiness.
- [ ] Graceful shutdown closes server and clients.
- [ ] Container runs as non-root and contains compiled output only.
- [ ] Dependencies and images are scanned.
- [ ] Metrics, traces, alerts, retries, and rollback behavior are defined.

## Repository examples

- [`demo-app/src/server.ts`](../demo-app/src/server.ts): PostgreSQL, Redis,
  validation, static UI, error narrowing, shutdown.
- [`agent-engine/src/server.ts`](../agent-engine/src/server.ts): typed agent
  request/session routes, Redis history, GCS tools, OpenTelemetry spans.
- [`demo-projects/aws-ecs-fargate-app`](../demo-projects/aws-ecs-fargate-app):
  minimal AWS container.
- [`demo-projects/gcp-cloud-run-app`](../demo-projects/gcp-cloud-run-app):
  minimal Cloud Run service.
- [`demo-projects/azure-function-app`](../demo-projects/azure-function-app):
  Azure Functions v4 registration wrapping Fastify injection.

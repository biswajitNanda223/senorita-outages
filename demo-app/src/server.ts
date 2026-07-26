import 'dotenv/config';
import path from 'node:path';
import process from 'node:process';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Pool } from 'pg';
import { createClient } from 'redis';

interface CreateItemBody {
  title: string;
  description?: string;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fastify = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 8080);

// Register Fastify Static plugin to serve dashboard frontend
fastify.register(fastifyStatic, {
  root: path.resolve(process.cwd(), 'public'),
  prefix: '/'
});

//---------------------------------------------------------
// Datastore Connections
//---------------------------------------------------------
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'dbadmin'}:${process.env.DB_PASSWORD || 'SuperSecretPassword123!'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls: process.env.REDIS_SSL === 'true',
    rejectUnauthorized: false
  }
});

redisClient.on('error', (error: Error) => {
  fastify.log.error({ error }, 'Redis client error');
});

(async () => {
  try {
    await redisClient.connect();
    fastify.log.info('Connected to Redis Cache');
  } catch (error: unknown) {
    fastify.log.error({ error }, 'Could not connect to Redis');
  }
})();

// Auto-initialize DB Table
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_items (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    fastify.log.info('PostgreSQL Table Initialized');
  } catch (error: unknown) {
    fastify.log.error({ error }, 'PostgreSQL initialization failed');
  }
})();

//---------------------------------------------------------
// Fastify Routes
//---------------------------------------------------------

// 1. Health Liveness / Readiness Check
fastify.get('/health', async (request, reply) => {
  const status = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    db: 'disconnected',
    redis: 'disconnected'
  };

  try {
    await pool.query('SELECT 1');
    status.db = 'connected';
  } catch (error: unknown) {
    status.db = `error: ${errorMessage(error)}`;
  }

  if (redisClient.isOpen) {
    status.redis = 'connected';
  }

  const httpCode = (status.db === 'connected' && status.redis === 'connected') ? 200 : 500;
  reply.code(httpCode).send(status);
});

// 2. Info details about the cluster context
fastify.get('/api/info', async (request, reply) => {
  return {
    platform: process.platform,
    nodeVersion: process.version,
    hostname: process.env.HOSTNAME || 'localhost (local-machine)',
    cloudProvider: process.env.CLOUD_PROVIDER || 'unknown',
    databaseHost: dbConfig.connectionString.split('@')[1] || 'localhost',
    redisHost: redisUrl.split('@')[1] || '127.0.0.1',
    envVariables: {
      SPRING_PROFILES_ACTIVE: process.env.SPRING_PROFILES_ACTIVE || 'none',
      ENVIRONMENT: process.env.ENVIRONMENT || 'dev'
    }
  };
});

// 3. Get Items (PostgreSQL + Redis caching)
fastify.get('/api/data', async (request, reply) => {
  const cacheKey = 'demo:items:all';

  // Check Redis Cache
  if (redisClient.isOpen) {
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return {
          source: 'cache (Redis)',
          data: JSON.parse(cachedData)
        };
      }
    } catch (error: unknown) {
      fastify.log.error({ error }, 'Redis cache fetch failed');
    }
  }

  // Fallback to PostgreSQL
  try {
    const result = await pool.query('SELECT * FROM demo_items ORDER BY created_at DESC');
    const items = result.rows;

    // Cache in Redis for 60 seconds
    if (redisClient.isOpen) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(items), { EX: 60 });
      } catch (error: unknown) {
        fastify.log.error({ error }, 'Redis cache write failed');
      }
    }

    return {
      source: 'database (PostgreSQL)',
      data: items
    };
  } catch (error: unknown) {
    reply.code(500).send({ error: errorMessage(error) });
  }
});

// 4. Create new Item (Flushes Redis cache)
fastify.post<{ Body: CreateItemBody }>('/api/data', {
  schema: {
    body: {
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string', maxLength: 2000 }
      }
    }
  }
}, async (request, reply) => {
  const { title, description } = request.body;
  if (!title) {
    reply.code(400).send({ error: 'Title is required' });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO demo_items (title, description) VALUES ($1, $2) RETURNING *',
      [title, description || '']
    );

    // Flush cache
    if (redisClient.isOpen) {
      await redisClient.del('demo:items:all');
    }

    reply.code(201).send({
      message: 'Item created and cache invalidated',
      item: result.rows[0]
    });
  } catch (error: unknown) {
    reply.code(500).send({ error: errorMessage(error) });
  }
});

// 5. Mock SSO validation using JWT auth headers
fastify.get('/api/auth/sso', async (request, reply) => {
  const authHeader = request.headers['authorization'] || '';
  const injectedUser = request.headers['x-user-email'] || request.headers['x-ms-client-principal-name'] || request.headers['x-amzn-oidc-identity'] || 'Guest Nomad';

  if (authHeader.startsWith('Bearer ') || injectedUser !== 'Guest Nomad') {
    return {
      authenticated: true,
      user: injectedUser,
      claims: {
        roles: ['Developer', 'Administrator'],
        iss: 'sso.identity.private.internal',
        aud: 'enterprise-app-client'
      }
    };
  }

  reply.code(401).send({
    authenticated: false,
    message: 'Missing Bearer token or Gateway Identity headers'
  });
});

// Start Server listening on 0.0.0.0 (required for Docker containers)
const start = async () => {
  try {
    await fastify.listen({ port: port, host: '0.0.0.0' });
    fastify.log.info({ port }, 'Server listening');
  } catch (error: unknown) {
    fastify.log.error(error);
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  fastify.log.info({ signal }, 'Shutting down');
  await fastify.close();
  if (redisClient.isOpen) await redisClient.quit();
  await pool.end();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

void start();

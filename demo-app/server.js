// server.js
// High-performance demo application backend using the Fastify framework

const fastify = require('fastify')({ logger: true });
const path = require('path');
const { Pool } = require('pg');
const { createClient } = require('redis');
require('dotenv').config();

const port = process.env.PORT || 8080;

// Register Fastify Static plugin to serve dashboard frontend
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
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

redisClient.on('error', (err) => fastify.log.error('Redis Client Error: ' + err.message));

(async () => {
  try {
    await redisClient.connect();
    fastify.log.info('Connected to Redis Cache');
  } catch (err) {
    fastify.log.error('Could not connect to Redis: ' + err.message);
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
  } catch (err) {
    fastify.log.error('PostgreSQL Init Error: ' + err.message);
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
  } catch (e) {
    status.db = `error: ${e.message}`;
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
    } catch (err) {
      fastify.log.error('Redis cache fetch failure: ' + err.message);
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
      } catch (err) {
        fastify.log.error('Redis cache write failure: ' + err.message);
      }
    }

    return {
      source: 'database (PostgreSQL)',
      data: items
    };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

// 4. Create new Item (Flushes Redis cache)
fastify.post('/api/data', async (request, reply) => {
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
  } catch (err) {
    reply.code(500).send({ error: err.message });
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
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

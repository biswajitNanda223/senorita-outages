// server.js
// GCP Cloud Run container running a Fastify HTTP service

const fastify = require('fastify')({ logger: true });

const port = process.env.PORT || 8080;

fastify.get('/health', async (request, reply) => {
  return { status: 'healthy', platform: 'Google Cloud Run' };
});

fastify.get('/api/greeting', async (request, reply) => {
  return {
    message: "Greetings from serverless Google Cloud Run running Fastify!",
    project: process.env.GOOGLE_CLOUD_PROJECT || "enterprise-project",
    timestamp: new Date().toISOString()
  };
});

const start = async () => {
  try {
    // Must listen on 0.0.0.0 for GCP Cloud Run container instances
    await fastify.listen({ port: port, host: '0.0.0.0' });
    fastify.log.info(`Cloud Run service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

import process from 'node:process';
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 8080);

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
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Cloud Run service listening on port ${port}`);
  } catch (error: unknown) {
    fastify.log.error(error);
    process.exit(1);
  }
};

void start();

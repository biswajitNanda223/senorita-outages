// server.js
// AWS ECS Fargate task running a Fastify HTTP service

const fastify = require('fastify')({ logger: true });

const port = process.env.PORT || 8080;

fastify.get('/health', async (request, reply) => {
  return { status: 'healthy', platform: 'AWS ECS Fargate' };
});

fastify.get('/api/message', async (request, reply) => {
  return {
    message: "Greetings from AWS ECS Fargate container running Fastify!",
    awsRegion: process.env.AWS_REGION || "us-east-1",
    ecsClusterName: process.env.ECS_CLUSTER_NAME || "enterprise-ecs",
    timestamp: new Date().toISOString()
  };
});

const start = async () => {
  try {
    // Listen on 0.0.0.0 for AWS Fargate tasks
    await fastify.listen({ port: port, host: '0.0.0.0' });
    fastify.log.info(`ECS Fargate service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// index.js
// Azure Function HTTP trigger that delegates handling to a serverless Fastify instance

const fastify = require('fastify')({ logger: true });

// Declare endpoints
fastify.get('/api/hello', async (request, reply) => {
  return {
    message: "Hello from serverless Azure Functions running Fastify!",
    timestamp: new Date().toISOString()
  };
});

module.exports = async function (context, req) {
  context.log('JavaScript HTTP trigger function processed a request.');
  
  // Inject context metrics to Fastify logger
  fastify.log.info({ functionInvocationId: context.invocationId }, 'Processing serverless trigger');

  // Inject Azure Function request into Fastify routing
  const response = await fastify.inject({
    method: req.method,
    url: req.url || '/api/hello',
    headers: req.headers,
    payload: req.body
  });

  context.res = {
    status: response.statusCode,
    headers: response.headers,
    body: response.body
  };
};

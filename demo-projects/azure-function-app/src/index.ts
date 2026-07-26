import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

type SupportedMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

// Declare endpoints
fastify.get('/api/hello', async (request, reply) => {
  return {
    message: "Hello from serverless Azure Functions running Fastify!",
    timestamp: new Date().toISOString()
  };
});

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('TypeScript HTTP trigger processed a request.');

  // Inject context metrics to Fastify logger
  fastify.log.info(
    { functionInvocationId: context.invocationId },
    'Processing serverless trigger'
  );

  // Inject Azure Function request into Fastify routing
  const payload = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.text();

  const response = await fastify.inject({
    method: request.method as SupportedMethod,
    url: new URL(request.url).pathname || '/api/hello',
    headers: Object.fromEntries(request.headers.entries()),
    payload
  });

  return {
    status: response.statusCode,
    headers: Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [key, String(value)])
    ),
    body: response.body
  };
}

app.http('fastifyHttp', {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: '{*path}',
  handler
});

// server.js
// Enterprise AI Agent Engine using Fastify, OpenTelemetry, Redis session cache, and Cloud Storage persistence

//---------------------------------------------------------
// 1. OpenTelemetry Tracing Initialization (Must run first)
//---------------------------------------------------------
const opentelemetry = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { TraceExporter } = require('@google-cloud/opentelemetry-cloud-trace-exporter');

let sdk;
if (process.env.ENABLE_TRACING === 'true') {
  console.log('Initializing OpenTelemetry tracing exporter...');
  const traceExporter = new TraceExporter();
  
  sdk = new NodeSDK({
    traceExporter: traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
    serviceName: 'ai-agent-engine'
  });
  
  sdk.start();
  console.log('OpenTelemetry SDK started. Streaming traces to Cloud Trace.');
} else {
  console.log('Tracing disabled. Set ENABLE_TRACING=true to enable OpenTelemetry.');
}

const tracer = opentelemetry.trace.getTracer('agent-tracer');

//---------------------------------------------------------
// 2. Initialize Fastify & Datastores
//---------------------------------------------------------
const fastify = require('fastify')({ logger: true });
const { createClient } = require('redis');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const port = process.env.PORT || 8080;

// Redis Session Memory Client
const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls: process.env.REDIS_SSL === 'true',
    rejectUnauthorized: false
  }
});

redisClient.on('error', (err) => fastify.log.error('Agent Engine Redis Error: ' + err.message));

(async () => {
  try {
    await redisClient.connect();
    fastify.log.info('Agent Engine connected to Redis Cache.');
  } catch (err) {
    fastify.log.error('Agent Engine Redis Connection failure: ' + err.message);
  }
})();

// Cloud Storage Bucket Client
const storage = new Storage();
const bucketName = process.env.AGENT_WORKSPACE_BUCKET || 'enterprise-agent-workspace-dev';

//---------------------------------------------------------
// 3. Fastify Routes
//---------------------------------------------------------

// Health Liveness / Readiness Check
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    tracingEnabled: process.env.ENABLE_TRACING === 'true',
    redisConnected: redisClient.isOpen,
    bucketTarget: bucketName
  };
});

// Run Agent Loop (Traced via OpenTelemetry spans)
fastify.post('/api/agent/run', async (request, reply) => {
  const { sessionId, prompt } = request.body;
  
  if (!sessionId || !prompt) {
    reply.code(400).send({ error: 'sessionId and prompt are required' });
    return;
  }

  // Start Active Span for Agent Run
  return tracer.startActiveSpan('Agent::Invoke', async (parentSpan) => {
    try {
      parentSpan.setAttribute('session.id', sessionId);
      parentSpan.setAttribute('agent.prompt', prompt);

      fastify.log.info(`[Session: ${sessionId}] Executing agent loop...`);

      // 1. Fetch conversation history from Redis
      let history = [];
      await tracer.startActiveSpan('Agent::FetchHistory', async (span) => {
        if (redisClient.isOpen) {
          const cachedHistory = await redisClient.get(`session:${sessionId}:history`);
          if (cachedHistory) {
            history = JSON.parse(cachedHistory);
            span.setAttribute('cache.hit', true);
          } else {
            span.setAttribute('cache.hit', false);
          }
        }
        span.end();
      });

      // Append new user prompt to history
      history.push({ role: 'user', content: prompt });

      // 2. Simulate AI reasoning and Tool calls (Listing bucket files)
      let toolOutput = '';
      await tracer.startActiveSpan('Agent::ExecuteTool::SearchWorkspace', async (span) => {
        span.setAttribute('tool.name', 'GCSBucketSearch');
        try {
          const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${sessionId}/` });
          toolOutput = `Found ${files.length} workspace files.`;
          span.setAttribute('workspace.files_count', files.length);
        } catch (err) {
          toolOutput = 'GCS Bucket unavailable. Empty workspace assumed.';
          span.setAttribute('workspace.error', err.message);
        }
        span.end();
      });

      // 3. Write execution log file back to GCS workspace
      const logContent = `Agent execution at ${new Date().toISOString()}\nPrompt: ${prompt}\nStatus: Completed\n`;
      const fileName = `${sessionId}/run-${Date.now()}.log`;
      
      await tracer.startActiveSpan('Agent::SaveExecutionLog', async (span) => {
        span.setAttribute('gcs.filename', fileName);
        try {
          await storage.bucket(bucketName).file(fileName).save(logContent);
          span.setAttribute('gcs.write.success', true);
        } catch (err) {
          fastify.log.error('Storage bucket log save failed: ' + err.message);
          span.setAttribute('gcs.write.success', false);
          span.setAttribute('gcs.write.error', err.message);
        }
        span.end();
      });

      // Simulate final response
      const agentResponse = `I processed your request using the workspace files. Result: ${toolOutput}`;
      history.push({ role: 'assistant', content: agentResponse });

      // 4. Update session history in Redis
      await tracer.startActiveSpan('Agent::SaveHistory', async (span) => {
        if (redisClient.isOpen) {
          await redisClient.set(`session:${sessionId}:history`, JSON.stringify(history), { EX: 3600 });
          span.setAttribute('cache.write.success', true);
        }
        span.end();
      });

      parentSpan.setStatus({ code: opentelemetry.SpanStatusCode.OK });
      return {
        sessionId,
        status: 'success',
        response: agentResponse,
        workspaceLog: fileName
      };
    } catch (err) {
      parentSpan.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: err.message
      });
      fastify.log.error('Agent loop failed: ' + err.message);
      reply.code(500).send({ error: err.message });
    } finally {
      parentSpan.end();
    }
  });
});

// Fetch Session details
fastify.get('/api/agent/session/:id', async (request, reply) => {
  const sessionId = request.params.id;

  try {
    let history = [];
    if (redisClient.isOpen) {
      const cached = await redisClient.get(`session:${sessionId}:history`);
      if (cached) history = JSON.parse(cached);
    }

    let files = [];
    try {
      const [bucketFiles] = await storage.bucket(bucketName).getFiles({ prefix: `${sessionId}/` });
      files = bucketFiles.map(f => f.name);
    } catch (e) {
      files = ['GCS bucket unreadable or not provisioned'];
    }

    return {
      sessionId,
      chatHistoryLength: history.length,
      history,
      workspaceFiles: files
    };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

// Start Server listening on 0.0.0.0
const start = async () => {
  try {
    await fastify.listen({ port: port, host: '0.0.0.0' });
    fastify.log.info(`Agent Engine listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

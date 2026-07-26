import 'dotenv/config';
import process from 'node:process';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { Storage } from '@google-cloud/storage';
import Fastify from 'fastify';
import { createClient } from 'redis';

interface AgentRunBody {
  sessionId: string;
  prompt: string;
}

interface SessionParams {
  id: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

let sdk: NodeSDK | undefined;
if (process.env.ENABLE_TRACING === 'true') {
  console.log('Initializing OpenTelemetry tracing exporter...');
  const traceExporter = new TraceExporter();
  
  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()]
  });
  
  sdk.start();
  console.log('OpenTelemetry SDK started. Streaming traces to Cloud Trace.');
} else {
  console.log('Tracing disabled. Set ENABLE_TRACING=true to enable OpenTelemetry.');
}

const tracer = trace.getTracer('ai-agent-engine');

//---------------------------------------------------------
// 2. Initialize Fastify & Datastores
//---------------------------------------------------------
const fastify = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 8080);

// Redis Session Memory Client
const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls: process.env.REDIS_SSL === 'true',
    rejectUnauthorized: false
  }
});

redisClient.on('error', (error: Error) => {
  fastify.log.error({ error }, 'Agent Engine Redis error');
});

(async () => {
  try {
    await redisClient.connect();
    fastify.log.info('Agent Engine connected to Redis Cache.');
  } catch (error: unknown) {
    fastify.log.error({ error }, 'Agent Engine Redis connection failed');
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
fastify.post<{ Body: AgentRunBody }>('/api/agent/run', {
  schema: {
    body: {
      type: 'object',
      required: ['sessionId', 'prompt'],
      additionalProperties: false,
      properties: {
        sessionId: { type: 'string', minLength: 1, maxLength: 128 },
        prompt: { type: 'string', minLength: 1, maxLength: 10000 }
      }
    }
  }
}, async (request, reply) => {
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
      let history: ChatMessage[] = [];
      await tracer.startActiveSpan('Agent::FetchHistory', async (span) => {
        if (redisClient.isOpen) {
          const cachedHistory = await redisClient.get(`session:${sessionId}:history`);
          if (cachedHistory) {
            history = JSON.parse(cachedHistory) as ChatMessage[];
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
        } catch (error: unknown) {
          toolOutput = 'GCS Bucket unavailable. Empty workspace assumed.';
          span.setAttribute('workspace.error', errorMessage(error));
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
        } catch (error: unknown) {
          fastify.log.error({ error }, 'Storage bucket log save failed');
          span.setAttribute('gcs.write.success', false);
          span.setAttribute('gcs.write.error', errorMessage(error));
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

      parentSpan.setStatus({ code: SpanStatusCode.OK });
      return {
        sessionId,
        status: 'success',
        response: agentResponse,
        workspaceLog: fileName
      };
    } catch (error: unknown) {
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage(error)
      });
      fastify.log.error({ error }, 'Agent loop failed');
      return reply.code(500).send({ error: errorMessage(error) });
    } finally {
      parentSpan.end();
    }
  });
});

// Fetch Session details
fastify.get<{ Params: SessionParams }>('/api/agent/session/:id', async (request, reply) => {
  const sessionId = request.params.id;

  try {
    let history: ChatMessage[] = [];
    if (redisClient.isOpen) {
      const cached = await redisClient.get(`session:${sessionId}:history`);
      if (cached) history = JSON.parse(cached) as ChatMessage[];
    }

    let files: string[] = [];
    try {
      const [bucketFiles] = await storage.bucket(bucketName).getFiles({ prefix: `${sessionId}/` });
      files = bucketFiles.map((file) => file.name);
    } catch {
      files = ['GCS bucket unreadable or not provisioned'];
    }

    return {
      sessionId,
      chatHistoryLength: history.length,
      history,
      workspaceFiles: files
    };
  } catch (error: unknown) {
    return reply.code(500).send({ error: errorMessage(error) });
  }
});

// Start Server listening on 0.0.0.0
const start = async () => {
  try {
    await fastify.listen({ port: port, host: '0.0.0.0' });
    fastify.log.info({ port }, 'Agent Engine listening');
  } catch (error: unknown) {
    fastify.log.error(error);
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  fastify.log.info({ signal }, 'Shutting down');
  await fastify.close();
  if (redisClient.isOpen) await redisClient.quit();
  await sdk?.shutdown();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

void start();

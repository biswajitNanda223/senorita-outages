# 🤖 AI Agent Engine

The AI Agent Engine is a production-grade containerized service designed to execute autonomous reasoning loops and tool calls (like database queries, registry checks, or file indexing) while maintaining strict observability and state isolation.

---

## 🛠️ Architecture Components

The engine leverages three key layers to execute and persist agent runs:

```mermaid
graph TD
    Client[Client Request] -->|POST /api/agent/run| App[Agent Engine]
    App -->|1. Fetch context history| Redis[Redis Cache (Memory)]
    App -->|2. Search & save files| GCS[Cloud Storage Bucket]
    App -->|3. Export telemetry spans| Trace[OpenTelemetry / Cloud Trace]
```

### 1. Observability: OpenTelemetry & Cloud Trace
*   All agent reasoning steps, API requests, and tool executions are wrapped in **OpenTelemetry Spans**.
*   Spans are exported to **Google Cloud Trace** (or local collector) to trace latency, exceptions, and call chains, making the agent's "thinking process" fully transparent and auditable.
*   Required APIs enabled: `cloudtrace.googleapis.com` (Cloud Trace API).

### 2. State & Caching: Redis Memory
*   Conversational history and session states are cached in **Redis** with a 1-hour expiration.
*   This ensures instant context loading during chat-like multi-turn interactions.

### 3. File Persistence: Cloud Storage Buckets
*   The agent uses a dedicated **Cloud Storage Bucket** to save workspace files, generated reports, logs, and state checkpoints.
*   Workspaces are isolated via session folder prefixing (`session-id/`).

---

## ⚙️ Environment Configuration

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Listening port for the Express server. | `8080` |
| `ENABLE_TRACING` | Toggles OpenTelemetry Cloud Trace exporting. | `true` |
| `REDIS_HOST` | Host IP/Domain for the Redis cache. | `10.10.100.4` |
| `REDIS_PORT` | Port for the Redis cache. | `6379` |
| `REDIS_SSL` | Enable SSL encryption for Redis. | `false` |
| `AGENT_WORKSPACE_BUCKET` | The GCS bucket name for file storage. | `enterprise-agent-workspace-dev` |

---

## 🚀 Execution Instructions

### Running Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run server in development watch mode:
   ```bash
   npm run dev
   ```
3. Test the execution endpoint:
   ```bash
   curl -X POST http://localhost:8080/api/agent/run \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "test-session-123", "prompt": "Identify code vulnerability points"}'
   ```

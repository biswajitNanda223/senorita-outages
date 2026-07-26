# Runnable Demo Projects

Each project owns its source, dependencies, TypeScript configuration,
container definition, and deployment documentation.

| Project | Purpose | Source code |
|:---|:---|:---|
| [Production Fastify app](fastify-production-app/README.md) | Full API, HLD/LLD, PostgreSQL, Redis, worker, Docker, and 2,000-VU test | [`fastify-production-app/src/`](fastify-production-app/src/) |
| [AWS ECS Fargate app](aws-ecs-fargate-app/) | Typed Fastify container for ECS | [`src/server.ts`](aws-ecs-fargate-app/src/server.ts) |
| [GCP Cloud Run app](gcp-cloud-run-app/) | Typed Fastify service for Cloud Run | [`src/server.ts`](gcp-cloud-run-app/src/server.ts) |
| [Azure Function app](azure-function-app/) | Fastify through Azure Functions v4 | [`src/index.ts`](azure-function-app/src/index.ts) |

## Standard folder structure

```text
project/
├── src/                         # TypeScript source; developers edit this
├── test/                        # TypeScript unit and API tests
├── load/                        # Typed load-test scenarios
├── migrations/                  # Versioned database changes
├── package.json                 # Commands and direct dependencies
├── package-lock.json            # Reproducible dependency graph
├── tsconfig.json                # Editor/test typechecking
├── tsconfig.build.json          # Production source compilation
├── Dockerfile                   # Multi-stage production image
├── compose.yaml                 # Local services and dependencies
└── README.md                    # Setup, architecture, deployment, checks
```

After `npm run build`, TypeScript generates `dist/*.js`. Do not edit or commit
`dist/`; Node and the final Docker stage execute that generated JavaScript.

The most complete implementation is
[`fastify-production-app/`](fastify-production-app/).

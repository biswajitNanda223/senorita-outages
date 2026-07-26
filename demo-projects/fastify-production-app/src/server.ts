import { buildApp } from './app';
import { loadConfig } from './config';
import { createInfrastructure } from './infrastructure';

async function main(): Promise<void> {
  const config = loadConfig();
  const infrastructure = await createInfrastructure(config);
  const app = await buildApp(infrastructure);
  let closing = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'Shutdown started');
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    await app.close();
    clearTimeout(force);
  }

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  await app.listen({ host: '0.0.0.0', port: config.port });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

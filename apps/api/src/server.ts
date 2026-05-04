import { config } from './lib/config';
import './instrument';
import { createApp } from './app';
import { closeDb } from './db';
import { closeFileLog, logger } from './middleware/logger';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'API server started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received — draining connections');

  // Force-exit after 25 s — ECS sends SIGKILL at 30 s, so this gives us
  // 5 s to flush logs before the container is killed ungracefully.
  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out after 25 s — forcing exit');
    process.exit(1);
  }, 25_000);
  forceExit.unref();

  // Stop accepting new connections and wait for in-flight requests to finish.
  // server.close() expects a () => void callback — resolve via a wrapping Promise.
  await new Promise<void>((resolve) => server.close(() => resolve()));

  try {
    await closeDb();
    logger.info('Shutdown complete');
  } catch (err) {
    logger.error({ err }, 'Error closing DB pool during shutdown');
  }

  clearTimeout(forceExit);
  await closeFileLog();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

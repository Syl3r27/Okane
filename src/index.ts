import express from 'express';
import { Server } from 'http';
import { config } from './config';
import apiRouter from './router';
import { errorHandler } from './middleware/errorHandler';
import { disconnectPrisma } from './db/client';
import { disconnectRedis } from './db/redis';

const app = express();

app.use(express.json());
app.use('/', apiRouter);
app.use(errorHandler);

const server: Server = app.listen(config.port, () => {
  console.log(`Okane API listening on port ${config.port} [${config.env}]`);
});

const FORCE_EXIT_TIMEOUT_MS = 10_000;

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return; // ignore repeat signals mid-shutdown
  shuttingDown = true;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'server.shutdown_started',
    signal,
  }));

  const forceExitTimer = setTimeout(() => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'server.shutdown_forced',
      reason: 'drain_timeout_exceeded',
    }));
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);
  forceExitTimer.unref(); // don't let this timer itself keep the process alive

  try {
    // Stop accepting new connections; resolves once existing ones finish
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await Promise.all([disconnectPrisma(), disconnectRedis()]);

    clearTimeout(forceExitTimer);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'server.shutdown_complete',
    }));
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimer);
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'server.shutdown_error',
      message: (err as Error).message,
    }));
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
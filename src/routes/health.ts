import { Router } from 'express';
import { prisma } from '../db/client';
import { redisClient } from '../db/redis';
import { paymentQueue } from '../queues/payment.queue';

const router = Router();

const startTime = Date.now();

async function checkPostgres(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

router.get('/', async (req, res) => {
  const [postgresUp, redisUp] = await Promise.all([checkPostgres(), checkRedis()]);

  let queueCounts: Record<string, number> | null = null;
  let queueError: string | null = null;
  try {
    queueCounts = await paymentQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  } catch (err) {
    queueError = (err as Error).message;
  }

  const healthy = postgresUp && redisUp && queueCounts !== null;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    connectivity: {
      postgres: postgresUp ? 'connected' : 'disconnected',
      redis: redisUp ? 'connected' : 'disconnected',
    },
    queue: queueCounts ?? { error: queueError },
  });
});

export default router;
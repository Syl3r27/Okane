import IORedis, {RedisOptions} from 'ioredis'
import { config } from '../config'

function parsedRedisUrl(url: string): RedisOptions {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        password: config.redis.password || parsed.password || undefined,
    };
}

// Passed as OPTIONS (not a shared instance) to BullMQ's Queue and Worker constructors.
// BullMQ creates its own internal ioredis clients (command + blocking + subscriber) per
// Queue/Worker, so handing it a plain options object — rather than one shared IORedis
// instance — avoids cross-talk between the queue producer (API process) and the worker
// consumer (worker process)

export const bullMQConnectOptions: RedisOptions = {
    ...parsedRedisUrl(config.redis.url),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
}

// Standalone client for simple, non-blocking Redis ops: idempotency key lookups,
// rate-limiter INCR/EXPIRE. Normal retry behaviour is fine here.
export const redisClient = new IORedis(config.redis.url, {
  ...(config.redis.password ? { password: config.redis.password } : {}),
  maxRetriesPerRequest: 3,
});

redisClient.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
}
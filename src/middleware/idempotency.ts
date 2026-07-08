import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../db/redis';
import { config } from '../config';
import { MissingHeaderError } from './errorHandler';

const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';

interface StoredResponse {
  statusCode: number;
  body: unknown;
}

export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('Idempotency-Key');
    if (!key) return next(new MissingHeaderError('Idempotency-Key'));

    const redisKey = `${IDEMPOTENCY_KEY_PREFIX}${key}`;

    try {
      const cached = await redisClient.get(redisKey);
      if (cached) {
        const stored: StoredResponse = JSON.parse(cached);
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(stored.statusCode).json(stored.body);
      }
    } catch (err) {
      // Redis read failure shouldn't hard-fail the request — log and fall through
      // as if no cached response existed. The DB unique constraint on
      // idempotencyKey (s2) is the fallback if this leads to a double-write.
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'idempotency.redis_read_failed',
        message: (err as Error).message,
      }));
    }

    // Monkey-patch res.json so any route handler using it automatically gets
    // its successful response cached — no route needs to know this exists.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient
          .set(redisKey, JSON.stringify({ statusCode: res.statusCode, body }), 'EX', config.idempotency.ttlSeconds)
          .catch((err) => {
            console.error(JSON.stringify({
              timestamp: new Date().toISOString(),
              event: 'idempotency.redis_write_failed',
              message: (err as Error).message,
            }));
          });
      }
      return originalJson(body);
    }) as Response['json'];

    next();
  };
}
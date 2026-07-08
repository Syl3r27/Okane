import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../db/redis';
import { config } from '../config';
import { AppError, MissingHeaderError } from './errorHandler';

const RATE_LIMIT_KEY_PREFIX = 'ratelimit:';

export class RateLimitExceededError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMIT_EXCEEDED', 429, 'Rate limit exceeded. Try again later.', { retryAfterSeconds });
  }
}

export function rateLimiter() {
  const windowSeconds = Math.ceil(config.rateLimit.windowMs / 1000);
  const max = config.rateLimit.maxRequests;

  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.header('X-User-Id');
    if (!userId) return next(new MissingHeaderError('X-User-Id'));

    const key = `${RATE_LIMIT_KEY_PREFIX}${userId}`;

    try {
      const multi = redisClient.multi();
      multi.incr(key);
      multi.ttl(key);
      const results = await multi.exec();

      if (!results) throw new Error('Redis transaction returned null');

      const [[incrErr, count], [ttlErr, ttl]] = results as [
        [Error | null, number],
        [Error | null, number],
      ];
      if (incrErr) throw incrErr;
      if (ttlErr) throw ttlErr;

      let ttlSeconds = ttl;
      // ttl === -1 means the key exists but has no expiry (shouldn't normally
      // happen here) or count === 1 means this is a fresh window — set it.
      if (count === 1 || ttl === -1) {
        await redisClient.expire(key, windowSeconds);
        ttlSeconds = windowSeconds;
      }

      const remaining = Math.max(0, max - count);
      const resetEpochSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(resetEpochSeconds));

      if (count > max) {
        res.setHeader('Retry-After', String(ttlSeconds));
        return next(new RateLimitExceededError(ttlSeconds));
      }

      next();
    } catch (err) {
      // Fail open: a Redis outage shouldn't take down payment acceptance
      // entirely. Log loudly since this silently disables rate limiting.
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'ratelimiter.redis_failed',
        message: (err as Error).message,
      }));
      next();
    }
  };
}
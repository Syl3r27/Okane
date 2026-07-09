// Environment setup for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://okane:okane@localhost:5432/okane_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.WORKER_CONCURRENCY = '2';
process.env.MAX_JOB_RETRIES = '3';
process.env.BACKOFF_BASE_DELAY_MS = '100';
process.env.IDEMPOTENCY_TTL_SECONDS = '3600';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

import {z} from "zod";
import dotenv from "dotenv"


dotenv.config();

const envSchema = z.object({
    NODE_ENV : z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().min(1),
    // DATABASE_URL_TEST: z.string().min(1),

    REDIS_URL: z.string().min(1),
    REDIS_PASSWORD: z.string().optional(),

    WORKER_CONCURRENCY: z.coerce.number().default(5),
    MAX_JOB_RETRIES: z.coerce.number().default(3),
    BACKOFF_BASE_DELAY_MS: z.coerce.number().default(1000),

    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86400),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env)

if(!parsed.success){
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = Object.freeze({
    env: parsed.data.NODE_ENV,
    port: parsed.data.PORT,

    db: {
        url: parsed.data.DATABASE_URL,
        // testUrl: parsed.data.DATABASE_URL_TEST,
    },
    redis: {
        url: parsed.data.REDIS_URL,
        password: parsed.data.REDIS_PASSWORD,
    },
    worker: {
        concurrency: parsed.data.WORKER_CONCURRENCY,
        maxRetries: parsed.data.MAX_JOB_RETRIES,
        backoffBaseDelayMs: parsed.data.BACKOFF_BASE_DELAY_MS,
    },
    idempotency: {
        ttlSeconds: parsed.data.IDEMPOTENCY_TTL_SECONDS,
    },
    rateLimit:{
        windowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
        maxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS,
    }
})
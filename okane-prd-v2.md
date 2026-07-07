# Product Requirements Document (PRD)

## Okane — Async Payment Processing Backend

### 1. Product Overview

**Product Name:** Okane  
**Version:** 1.0.0  
**Product Type:** Backend API for Asynchronous Payment Processing

Okane (お金, Japanese for "money") is a RESTful backend service that simulates the internal architecture of production payment processors like Razorpay and Stripe. Instead of processing payments synchronously within a request-response cycle, Okane immediately acknowledges every payment request, enqueues it as a background job, and processes it asynchronously through isolated worker processes backed by Redis. The system guarantees exactly-once payment execution via idempotency keys, automatic retry with exponential backoff on failure, per-user rate limiting at the API layer, and graceful shutdown with in-flight job draining.

---

### 2. Target Users

- **Backend Developers:** Integrating payment acceptance into client applications via REST API
- **DevOps / Platform Engineers:** Deploying, monitoring, and scaling the API server and worker processes
- **QA Engineers:** Testing payment flows, failure scenarios, and retry behaviour through automated test suites

---

### 3. Core Features

#### 3.1 Payment Acceptance

- **Payment Enqueue:** Accept payment requests and enqueue them for background processing, returning immediately with a job ID
- **Idempotency:** Detect and suppress duplicate payment requests using client-supplied idempotency keys stored in Redis
- **Input Validation:** Validate all request fields (amount, currency, sender, receiver) with Zod before touching the queue or database
- **Instant Acknowledgment:** Return `202 Accepted` within 50ms regardless of payment processing duration

#### 3.2 Asynchronous Job Processing

- **Worker Process:** Process payment jobs in a separate Node.js process, fully decoupled from the API server
- **Concurrency Control:** Process up to 5 payment jobs simultaneously per worker instance
- **Throughput Limiting:** Cap job execution at 10 jobs per second to protect downstream services from burst traffic
- **Payment Simulation:** Simulate real-world payment processing with configurable delay and random failure rate

#### 3.3 Retry and Backoff

- **Automatic Retries:** Retry failed payment jobs up to 3 times before marking as permanently failed
- **Exponential Backoff:** Increase retry delay exponentially (1s → 2s → 4s) to avoid hammering a failing service
- **Stalled Job Recovery:** Automatically re-queue jobs whose worker process crashed mid-execution after lock expiry
- **Permanent Failure Handling:** Update payment status to `FAILED` with a human-readable reason after all retries are exhausted

#### 3.4 Rate Limiting

- **Per-User Throttling:** Limit each user to 10 payment requests per 60-second window
- **Distributed Enforcement:** Store rate limit counters in Redis so limits are shared across multiple API instances
- **Standard Headers:** Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` on every response
- **Retry Guidance:** Include `Retry-After` seconds in `429` responses so clients know when to retry

#### 3.5 Payment Status Polling

- **Status Endpoint:** Allow clients to poll the current state of any payment by its ID
- **Full Lifecycle Visibility:** Return all payment metadata including status, retry count, failure reason, and timestamps
- **State Transitions:** Track payments through a defined state machine: `PENDING → PROCESSING → COMPLETED | FAILED`

#### 3.6 Graceful Shutdown

- **Signal Handling:** Handle `SIGTERM` and `SIGINT` on both the API server and worker process
- **Job Draining:** Wait for all in-flight jobs to complete before the worker process exits
- **Connection Cleanup:** Flush database and Redis connection pools before process exit
- **Forced Exit Timeout:** Force exit after 10 seconds if drain hangs to prevent indefinite blocking

#### 3.7 System Health

- **Health Check Endpoint:** Expose a `/health` endpoint reporting server uptime and connectivity status for both PostgreSQL and Redis
- **Queue Metrics:** Include live queue depth counters (waiting, active, completed, failed, delayed) in the health response
- **Structured Logging:** Emit JSON-structured log entries for every job state transition across all worker instances

---

### 4. Technical Specifications

#### 4.1 API Endpoints

**Authentication**

All secured endpoints require the `X-User-Id` header for user identification and rate limiting.

**Payment Routes** (`/payments`)

- `POST /payments` — Enqueue a new payment job *(requires `Idempotency-Key` header)*
- `GET /payments/:id` — Poll payment status by payment ID

**Health Routes** (`/health`)

- `GET /health` — System health status, uptime, and queue metrics

#### 4.2 Queue and Worker Behaviour

| Behaviour | Configuration | Default |
|---|---|---|
| Queue backend | Redis via BullMQ | — |
| Worker concurrency | `WORKER_CONCURRENCY` | 5 jobs |
| Max job attempts | `MAX_JOB_RETRIES` | 3 |
| Backoff base delay | `BACKOFF_BASE_DELAY_MS` | 1000ms |
| Throughput cap | Hard-coded in worker | 10 jobs/sec |
| Completed job retention | Hard-coded | 1 hour / 1000 jobs |
| Failed job retention | Hard-coded | 24 hours |
| Stalled job check interval | Hard-coded | 30 seconds |
| Idempotency key TTL | `IDEMPOTENCY_TTL_SECONDS` | 86400s (24h) |
| Rate limit window | `RATE_LIMIT_WINDOW_MS` | 60000ms (1 min) |
| Rate limit max requests | `RATE_LIMIT_MAX_REQUESTS` | 10 |

#### 4.3 Data Models

**Payment Status:**

- `PENDING` — Job enqueued, not yet picked up by worker
- `PROCESSING` — Worker is actively executing the payment
- `COMPLETED` — Payment processed successfully
- `FAILED` — All retry attempts exhausted

**Payment Fields:**

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key, returned as `paymentId` to clients |
| `idempotencyKey` | String (unique) | Client-supplied deduplication token |
| `amount` | Float | Payment amount |
| `currency` | String (3 chars) | ISO 4217 currency code (e.g. `INR`, `USD`) |
| `senderId` | String | ID of the user initiating the payment |
| `receiverId` | String | ID of the payment recipient |
| `status` | Enum | Current state in the payment lifecycle |
| `jobId` | String (unique) | BullMQ job ID, matches `paymentId` |
| `failureReason` | String? | Human-readable reason for permanent failure |
| `retryCount` | Integer | Number of processing attempts made |
| `createdAt` | Timestamp | When the payment record was created |
| `processedAt` | Timestamp? | When the job completed (success or final failure) |

**Request / Response Shapes:**

`POST /payments` request body:

```json
{
  "amount": 1500.00,
  "currency": "INR",
  "senderId": "user_001",
  "receiverId": "user_002",
  "description": "Rent for June"
}
```

`POST /payments` response (`202 Accepted`):

```json
{
  "paymentId": "550e8400-e29b-41d4-a716-446655440000",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "Payment accepted and queued for processing",
  "pollUrl": "/payments/550e8400-e29b-41d4-a716-446655440000"
}
```

`GET /payments/:id` response (`200 OK`):

```json
{
  "paymentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "amount": 1500.00,
  "currency": "INR",
  "senderId": "user_001",
  "receiverId": "user_002",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "retryCount": 0,
  "failureReason": null,
  "createdAt": "2026-06-15T10:30:00.000Z",
  "processedAt": "2026-06-15T10:30:02.100Z"
}
```

**Standard Error Response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body validation failed",
    "details": [
      { "field": "amount", "issue": "Number must be greater than 0" }
    ]
  }
}
```

**Error Codes:**

| Code | HTTP Status | Trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body fails Zod schema |
| `MISSING_HEADER` | 400 | `Idempotency-Key` header absent on POST |
| `RATE_LIMIT_EXCEEDED` | 429 | User exceeded request quota |
| `PAYMENT_NOT_FOUND` | 404 | No payment exists with given ID |
| `INTERNAL_ERROR` | 500 | Unhandled server or database error |

---

### 5. Security Features

- Zod schema validation on all incoming request bodies before any business logic executes
- Idempotency keys stored in Redis with 24-hour TTL — prevents duplicate payments on client retries
- Per-user rate limiting enforced in Redis — shared across all API instances in distributed deployments
- All database queries routed through Prisma's parameterised query builder — no raw SQL, no injection surface
- Sensitive configuration (`DATABASE_URL`, `REDIS_PASSWORD`) loaded from environment variables, never hardcoded
- Process-level handlers for `uncaughtException` and `unhandledRejection` prevent silent failure in worker processes
- `X-User-Id` header used for rate limiting — designed to be set by an upstream auth gateway in production

---

### 6. Infrastructure

- **Database:** PostgreSQL 16 via Docker Compose for local development
- **Cache / Queue:** Redis 7 via Docker Compose for local development
- **ORM:** Prisma with migration-based schema management
- **Containerisation:** `docker-compose.yml` with health checks on both PostgreSQL and Redis services
- **Process Model:** API server and worker run as separate processes, started independently via `npm run dev` and `npm run worker`
- **CI/CD:** GitHub Actions pipeline — runs on every push and pull request to `main` and `dev` branches
  - Spins up PostgreSQL and Redis as service containers
  - Installs dependencies, generates Prisma client, runs migrations
  - Executes ESLint and full Jest test suite with coverage report
  - Uploads coverage to Codecov

---

### 7. Testing Strategy

- **Unit Tests:** Middleware functions (idempotency, rate limiter, validation), config loader, worker job handler
- **Integration Tests:** Full HTTP request-response cycle via Supertest against a real Express app instance
- **Test Isolation:** Separate test database (`DATABASE_URL_TEST`), Redis flushed between tests, Prisma table truncated before each suite
- **Coverage Threshold:** 90% across branches, functions, lines, and statements — enforced by Jest; CI fails if not met
- **Mocking Strategy:** Prisma and ioredis mocked in unit tests; real connections used in integration tests

---

### 8. Success Criteria

- `POST /payments` responds within 50ms p99 regardless of payment processing duration
- Zero duplicate payments processed for the same idempotency key under any retry scenario
- Failed jobs automatically retry up to 3 times with exponential backoff before marking as `FAILED`
- Rate limiting correctly rejects requests beyond 10 per minute per user with a `429` and `Retry-After` header
- Worker shuts down cleanly on `SIGTERM` without abandoning in-flight jobs
- Test coverage exceeds 90% across all business logic modules
- GitHub Actions CI pipeline completes in under 3 minutes on every push
- Zero unhandled promise rejections in both the API server and worker processes

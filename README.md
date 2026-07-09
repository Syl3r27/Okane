# Okane – Async Payment Processing System

Okane is a production-ready async payment processing demo built with Node.js/Express, featuring reliable job queuing, idempotent API endpoints, rate limiting, and real-time dashboard monitoring. Designed to showcase best practices for handling payments at scale.

## 🎯 Features

- **Async Payment Processing** — Reliable job-based processing via BullMQ/Redis with automatic retries
- **Idempotency** — Duplicate requests return cached responses, preventing double-processing
- **Rate Limiting** — Per-user request throttling to prevent abuse
- **Job Resilience** — Configurable retry logic, job draining on shutdown, and stalled job detection
- **Real-time Monitoring** — Interactive HTML dashboard for tracking payments and queue health
- **Health Checks** — Comprehensive endpoint for connectivity and system status
- **Structured Logging** — JSON-formatted logs for easy parsing and debugging

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│       Express API (REST Endpoints)          │
│  - POST /payments (create payment)          │
│  - GET /payments/:id (fetch status)         │
│  - GET /health (system health check)        │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼──────────┐  ┌──▼──────────────────┐
│  Prisma + DB   │  │  Redis + BullMQ     │
│  (PostgreSQL)  │  │  (Job Queue)        │
└────────────────┘  └──┬──────────────────┘
                       │
                ┌──────▼───────┐
                │ Payment      │
                │ Worker       │
                │ (Processing) │
                └──────────────┘
```

## 🛠️ Tech Stack

- **Runtime** — Node.js 18+ with TypeScript
- **API Framework** — Express.js
- **Database** — PostgreSQL with Prisma ORM
- **Job Queue** — Redis + BullMQ
- **Frontend** — HTML5/CSS3/Vanilla JavaScript dashboard
- **Deployment** — Docker Compose (dev) / Render (production)

## 📋 Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14+ (local installation or Docker)
- **Redis** 6+ (local installation or Docker)
- **npm** or **yarn** package manager

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root. Example configuration:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/okane

# Redis & Queueing
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=5
MAX_JOB_RETRIES=3
BACKOFF_BASE_DELAY_MS=1000

# API Behavior
IDEMPOTENCY_TTL_SECONDS=86400
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

**Key Configuration Details:**
- `WORKER_CONCURRENCY` — Number of jobs processed simultaneously (tune based on CPU/memory)
- `MAX_JOB_RETRIES` — Maximum attempts before marking a job as failed
- `RATE_LIMIT_MAX_REQUESTS` — Requests allowed per `RATE_LIMIT_WINDOW_MS`
- `IDEMPOTENCY_TTL_SECONDS` — How long to cache idempotent responses (24 hours default)

## 🚀 Quick Start

### Option 1: Local Setup (Node.js + Services)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL and Redis** (locally or via Docker):
   ```bash
   docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
   docker run -d --name redis -p 6379:6379 redis:7
   ```

3. **Set up database schema:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the API server:**
   ```bash
   npm run dev
   ```
   API will be available at `http://localhost:3000`

5. **In a new terminal, start the worker:**
   ```bash
   npm run worker
   ```

6. **Open the dashboard:**
   Navigate to `okane-dashboard.html` in your browser or serve via:
   ```bash
   npx http-server
   ```

### Option 2: Docker Compose (All-in-One)

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, the API server, and the worker in isolated containers.

**Access points:**
- API: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard` (if served via static middleware)

## 📖 API Documentation

### Health Check
```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-07-09T10:30:45.123Z",
  "database": "connected",
  "redis": "connected",
  "queue": { "active": 2, "waiting": 5, "failed": 0 }
}
```

### Create Payment
```http
POST /payments
Content-Type: application/json
Idempotency-Key: unique-request-id-12345

{
  "amount": 10000,
  "currency": "USD",
  "description": "Order #12345",
  "metadata": { "userId": "user-456" }
}
```

**Response (201 Created):**
```json
{
  "id": "pay_abc123xyz",
  "amount": 10000,
  "currency": "USD",
  "status": "PENDING",
  "createdAt": "2026-07-09T10:30:45.123Z"
}
```

### Get Payment Status
```http
GET /payments/pay_abc123xyz
```

**Response (200 OK):**
```json
{
  "id": "pay_abc123xyz",
  "amount": 10000,
  "currency": "USD",
  "status": "COMPLETED",
  "processedAt": "2026-07-09T10:30:50.456Z",
  "retryCount": 0
}
```

## 📁 Project Structure

```
.
├── src/
│   ├── index.ts              # Express app setup
│   ├── router.ts             # API route definitions
│   ├── config/               # Configuration management
│   ├── db/
│   │   ├── client.ts         # Prisma client setup
│   │   └── redis.ts          # Redis connection
│   ├── middleware/
│   │   ├── errorHandler.ts   # Global error handling
│   │   ├── idempotency.ts    # Idempotency middleware
│   │   ├── rateLimiter.ts    # Rate limiting middleware
│   │   └── validate.ts       # Request validation
│   ├── queues/
│   │   └── payment.queue.ts  # BullMQ queue setup
│   ├── routes/
│   │   ├── health.ts         # Health check endpoint
│   │   └── payment.ts        # Payment endpoints
│   ├── types/
│   │   └── payment.types.ts  # TypeScript interfaces
│   └── workers/
│       └── payment.worker.ts # Job processor logic
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── tests/                    # Test files
├── docker-compose.yml        # Docker Compose configuration
├── render.yaml              # Render deployment config
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies & scripts
```

## 🧪 Development

### Available Scripts

```bash
npm run dev       # Start API server with hot-reload
npm run worker    # Start the payment worker
npm run build     # Compile TypeScript
npm test          # Run test suite
npm run lint      # Run ESLint (if configured)
```

### Database Migrations

After modifying `prisma/schema.prisma`, create a migration:

```bash
npx prisma migrate dev --name your_migration_name
```

To reset the database (development only):

```bash
npx prisma migrate reset
```

### Debugging

- **API Logs:** Streamed to console (formatted as JSON for parsing)
- **Worker Logs:** Include job ID, payment ID, and processing status
- **Database:** Use Prisma Studio to browse data:
  ```bash
  npx prisma studio
  ```

## 🚢 Deployment

### Render Deployment

The `render.yaml` file defines the deployment configuration for Render.

**To deploy:**

1. Connect your GitHub repository to Render
2. Create a new Blueprint deployment
3. Render will automatically:
   - Build Docker images for the API and worker
   - Start PostgreSQL and Redis services
   - Run migrations
   - Deploy both services

**Environment Variables (set in Render dashboard):**
- `DATABASE_URL` — Render PostgreSQL connection string
- `REDIS_URL` — Render Redis connection string
- All other `.env` variables as needed

### Manual Docker Deployment

```bash
# Build images
docker build -t okane-api -f Dockerfile.api .
docker build -t okane-worker -f Dockerfile.worker .

# Push to registry (e.g., Docker Hub)
docker tag okane-api username/okane-api:latest
docker push username/okane-api:latest
```

## 🔍 Monitoring & Troubleshooting

### Common Issues

**"Connection refused" on Redis/PostgreSQL:**
- Verify services are running: `docker ps`
- Check connection strings in `.env`
- Ensure port mappings are correct

**Jobs stuck in "active" state:**
- Check worker logs for processing errors
- Inspect stalled jobs: `redis-cli LRANGE bull:payment:active 0 -1`
- Restart worker process to recover

**High memory usage:**
- Reduce `WORKER_CONCURRENCY` if too many jobs run simultaneously
- Check for memory leaks in Prisma client or job data

### Debugging Commands

```bash
# Redis CLI — inspect queue state
redis-cli
> LLEN bull:payment:waiting     # Waiting jobs
> LLEN bull:payment:active      # Active jobs
> LLEN bull:payment:failed      # Failed jobs

# Database — view payment records
npx prisma studio

# Worker logs — filter by event
npm run worker | grep "job.completed"
```

## 📊 Performance Tuning

| Setting | Impact | Notes |
|---------|--------|-------|
| `WORKER_CONCURRENCY` | Job throughput | Increase for CPU-bound work, monitor memory |
| `MAX_JOB_RETRIES` | Failure resilience | Higher = more retries, longer resolution time |
| `RATE_LIMIT_MAX_REQUESTS` | API throttling | Balance between DDoS protection and user experience |
| `IDEMPOTENCY_TTL_SECONDS` | Cache size | Shorter = less memory, risk of re-processing duplicates |

## 📝 License

MIT — See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

---

**Built with ❤️ as a modern payment processing system demo**

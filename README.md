# Okane

Okane is a small async payment processing demo with a Node.js/Express API, Prisma/Postgres persistence, Redis-backed queueing, and a simple HTML dashboard for submitting and tracking payments.

## Features

- Create payments via a REST API
- Enforce idempotency for duplicate submissions
- Apply rate limiting per user
- Process payments asynchronously through BullMQ/Redis
- Monitor health/connectivity and queue status from a dashboard

## Tech Stack

- Node.js + TypeScript
- Express
- Prisma + PostgreSQL
- Redis + BullMQ
- HTML/CSS/JS dashboard

## Prerequisites

- Node.js 18+
- PostgreSQL running locally or via Docker
- Redis running locally or via Docker

## Environment Variables

Create a `.env` file in the project root with values similar to:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/okane
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=5
MAX_JOB_RETRIES=3
BACKOFF_BASE_DELAY_MS=1000
IDEMPOTENCY_TTL_SECONDS=86400
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

## Installation

```bash
npm install
npx prisma generate
npx prisma db push
```

## Run the API

```bash
npm run dev
```

The API will start on `http://localhost:3000`.

## Run the worker

```bash
npm run worker
```

## Dashboard

Open the HTML dashboard file in a browser:

```bash
okane-dashboard.html
```

Or serve the project directory with a simple static server if needed.

## API Endpoints

- `GET /health` — health and connectivity check
- `POST /payments` — submit a payment
- `GET /payments/:id` — fetch payment status

## Notes

- The dashboard defaults to `http://localhost:3000` as the API base URL.
- If you change the port, update the dashboard input accordingly.

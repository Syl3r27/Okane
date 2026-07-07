import { Worker, Job } from 'bullmq';
import { bullMQConnectOptions } from '../db/redis';
import { config } from '../config';
import { prisma } from '../db/client';
import { PAYMENT_QUEUE_NAME } from '../queues/payment.queue';
import type { PaymentJobData, PaymentJobResult } from '../types/payment.types';

const SIMULATED_DELAY_MIN_MS = 500;
const SIMULATED_DELAY_MAX_MS = 2000;
const SIMULATED_FAILURE_RATE = 0.15; // tune freely; not specced by PRD as a fixed number

const FAILURE_REASONS = [
  'Insufficient funds',
  'Payment gateway timeout',
  'Issuing bank declined transaction',
  'Receiver account inactive',
];

function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields }));
}

async function simulatePaymentProcessing(): Promise<PaymentJobResult> {
  const delay = SIMULATED_DELAY_MIN_MS + Math.random() * (SIMULATED_DELAY_MAX_MS - SIMULATED_DELAY_MIN_MS);
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (Math.random() < SIMULATED_FAILURE_RATE) {
    return {
      success: false,
      failureReason: FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)],
    };
  }
  return { success: true, processedAt: new Date().toISOString() };
}

async function processPaymentJob(job: Job<PaymentJobData>): Promise<PaymentJobResult> {
  const { paymentId } = job.data;

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PROCESSING', retryCount: job.attemptsMade },
  });

  log('job.processing', { paymentId, jobId: job.id, attempt: job.attemptsMade + 1 });

  const result = await simulatePaymentProcessing();

  if (!result.success) {

    throw new Error(result.failureReason);
  }

  return result;
}

export const paymentWorker = new Worker<PaymentJobData, PaymentJobResult>(
  PAYMENT_QUEUE_NAME,
  processPaymentJob,
  {
    connection: bullMQConnectOptions,
    concurrency: config.worker.concurrency,
    limiter: { max: 10, duration: 1000 },
    stalledInterval: 30_000,              
  }
);

paymentWorker.on('completed', async (job, result: PaymentJobResult) => {
  try {
    if (!result.success) return; 
    await prisma.payment.update({
      where: { id: job.data.paymentId },
      data: { status: 'COMPLETED', processedAt: result.processedAt },
    });
    log('job.completed', { paymentId: job.data.paymentId, jobId: job.id, attempts: job.attemptsMade + 1 });
  } catch (err) {
    log('job.completed.db_write_failed', { paymentId: job.data.paymentId, error: (err as Error).message });
  }
});

paymentWorker.on('failed', async (job, err) => {
  if (!job) return;
  try {
    const maxAttempts = job.opts.attempts ?? config.worker.maxRetries;
    const exhausted = job.attemptsMade >= maxAttempts;

    if (exhausted) {
      await prisma.payment.update({
        where: { id: job.data.paymentId },
        data: {
          status: 'FAILED',
          failureReason: err.message,
          retryCount: job.attemptsMade,
          processedAt: new Date(),
        },
      });
      log('job.failed.permanent', {
        paymentId: job.data.paymentId, jobId: job.id, attempts: job.attemptsMade, reason: err.message,
      });
    } else {
      log('job.failed.retrying', {
        paymentId: job.data.paymentId, jobId: job.id, attempt: job.attemptsMade, reason: err.message,
      });
    }
  } catch (dbErr) {
    log('job.failed.db_write_failed', { paymentId: job.data.paymentId, error: (dbErr as Error).message });
  }
});

paymentWorker.on('error', (err) => log('worker.error', { message: err.message }));


process.on('uncaughtException', (err) => log('worker.uncaughtException', { message: err.message, stack: err.stack }));
process.on('unhandledRejection', (reason) => log('worker.unhandledRejection', { reason: String(reason) }));
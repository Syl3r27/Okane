import { prisma } from './src/db/client';
import { enqueuePaymentJob } from './src/queues/payment.queue';
async function main() {
  const paymentId = 'shutdown-test-1';
  await prisma.payment.create({
    data: { id: paymentId, idempotencyKey: 'shutdown-idem-1', amount: 100,
      currency: 'INR', senderId: 'u1', receiverId: 'u2', jobId: paymentId },
  });
  await enqueuePaymentJob({ paymentId, idempotencyKey: 'shutdown-idem-1',
    amount: 100, currency: 'INR', senderId: 'u1', receiverId: 'u2' });
  console.log('enqueued, now send SIGTERM to the worker process fast');
  process.exit(0);
}
main();

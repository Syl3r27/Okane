import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { enqueuePaymentJob } from '../queues/payment.queue';
import { validate } from '../middleware/validate';
import { idempotency } from '../middleware/idempotency';
import { asyncHandler, PaymentNotFoundError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(rateLimiter());

const createPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  senderId: z.string().min(1),
  receiverId: z.string().min(1),
  description: z.string().optional(),
});

router.post(
  '/',
  idempotency(),
  validate(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.header('Idempotency-Key')!;
    const { amount, currency, senderId, receiverId, description } = req.body;
    const paymentId = randomUUID();

    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          id: paymentId, idempotencyKey, amount, currency,
          senderId, receiverId, description, jobId: paymentId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
        if (existing) {
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(202).json({
            paymentId: existing.id,
            jobId: existing.jobId,
            status: existing.status,
            message: existing.status === 'FAILED'
              ? 'Payment previously failed to enqueue for processing'
              : 'Payment accepted and queued for processing',
            pollUrl: `/payments/${existing.id}`,
          });
        }
      }
      throw err;
    }

    try {
      await enqueuePaymentJob({
        paymentId, idempotencyKey, amount, currency, senderId, receiverId, description,
      });
    } catch (enqueueErr) {
      // Compensating write: the DB row exists but nothing will ever process it.
      // Mark it FAILED now rather than leaving a payment silently stuck at
      // PENDING forever. A client retry with the same Idempotency-Key will hit
      // the P2002 branch above and see status: "FAILED" instead of hanging.
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'payment.enqueue_failed',
        paymentId,
        message: (enqueueErr as Error).message,
      }));
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failureReason: 'Failed to enqueue payment for processing',
          processedAt: new Date(),
        },
      }).catch(() => { /* best-effort — if even this fails, row stays PENDING; logged above */ });

      // Not an AppError -> falls through to generic 500 INTERNAL_ERROR in
      // errorHandler, per PRD §4.3's declared error codes (no new code invented).
      throw new Error('Payment could not be queued for processing');
    }

    res.status(202).json({
      paymentId: payment.id,
      jobId: payment.jobId,
      status: payment.status,
      message: 'Payment accepted and queued for processing',
      pollUrl: `/payments/${payment.id}`,
    });
  })
);
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) throw new PaymentNotFoundError(String(rawId));
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new PaymentNotFoundError(id);

    res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      senderId: payment.senderId,
      receiverId: payment.receiverId,
      jobId: payment.jobId,
      retryCount: payment.retryCount,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      processedAt: payment.processedAt,
    });
  })
);

export default router;
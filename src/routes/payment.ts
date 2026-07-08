import { NextFunction, Router, Request, Response } from "express";
import z from "zod";
import { asyncHandler, MissingHeaderError, PaymentNotFoundError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { randomUUID } from "crypto";
import { prisma } from "../db/client";
import { enqueuePaymentJob } from "../queues/payment.queue";

const router = Router();

const createPaymentSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
    senderId: z.string().min(1),
    receiverId: z.string().min(1),
    description: z.string().optional()
});


function requireIdempotencyKey(req: Request, res: Response, next: NextFunction){
    const key = req.header('Idempotency-Key')!;
    if(!key) return next(new MissingHeaderError('Idempotency-Key'));
    next();
}

// Main Routes

router.post(
    '/',
    requireIdempotencyKey,
    validate(createPaymentSchema),
    asyncHandler(async(req, res)=>{
        const idempotencyKey = req.header('Idempotency-Key')!;
        const {amount, currency , senderId, receiverId , description} = req.body;
        const paymentId = randomUUID();

        // If a payment with this idempotency key already exists, return it
        const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
        if (existing) {
            return res.status(200).json({
                paymentId: existing.id,
                jobId: existing.jobId,
                status: existing.status,
                message: 'Payment already accepted for this idempotency key',
                pollUrl: `/payments/${existing.id}`,
            });
        }

        await prisma.payment.create({
            data:{
                id: paymentId,
                idempotencyKey,
                amount,
                currency,
                senderId,
                receiverId,
                description,
                jobId: paymentId,
            }
        });

        await enqueuePaymentJob({
                paymentId,
                idempotencyKey,
                amount,
                currency,
                senderId,
                receiverId,
                description
        });

        res.status(202).json({
            paymentId,
            jobId: paymentId,
            status: 'PENDING',
            message: 'Payment accepted and queued for processing',
            pollUrl: `/payments/${paymentId}`,
        });
    })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
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
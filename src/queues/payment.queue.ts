import {Queue, QueueEvents} from "bullmq"
import { bullMQConnectOptions } from "../db/redis"
import { prisma } from "../db/client"
import {config} from '../config'
import type { PaymentJobData } from "../types/payment.types"

export const PAYMENT_QUEUE_NAME = 'payments'

export const paymentQueue = new Queue<PaymentJobData>(PAYMENT_QUEUE_NAME, {
    connection: bullMQConnectOptions,
    defaultJobOptions: {
        attempts: config.worker.maxRetries,
        backoff: {
            type: 'exponential',
            delay: config.worker.backoffBaseDelayMs // 1000ms -> 1s, 2s, 4s, per attempt
        },
        removeOnComplete:{
            age: 3600,
            count: 1000 //Matches Job retention
        },
        removeOnFail:{
            age: 86400, //24 Hrs
        }
    }
});

export const paymentQueueEvents = new QueueEvents(PAYMENT_QUEUE_NAME, {
    connection: bullMQConnectOptions,
})

/**
 * Enqueues a payment job. jobId is set equal to paymentId so BullMQ's own
 * dedup-on-jobId acts as a second layer of defense on top of the Redis
 * idempotency-key check in middleware/idempotency.ts (s6) — belt and suspenders,
 * not a replacement for it, since the idempotency middleware runs first and
 * is keyed on the client-supplied Idempotency-Key, not the internal paymentId.
 */

export async function enqueuePaymentJob(data: PaymentJobData){
    // Ensure a payment record exists. Use upsert to avoid unique constraint
    // errors if the caller already created the payment (router already does).
    await prisma.payment.upsert({
        where: { id: data.paymentId },
        update: {},
        create: {
            id: data.paymentId,
            idempotencyKey: data.idempotencyKey,
            amount: data.amount,
            currency: data.currency,
            senderId: data.senderId,
            receiverId: data.receiverId,
            status: 'PENDING',
            jobId: data.paymentId,
        },
    });

    return paymentQueue.add(PAYMENT_QUEUE_NAME, data, {
        jobId: data.paymentId,
    });
}
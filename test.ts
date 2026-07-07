import { randomUUID } from "node:crypto";
import { enqueuePaymentJob } from "./src/queues/payment.queue.ts"

async function main() {
  const paymentId = randomUUID();
  const job = await enqueuePaymentJob({
    paymentId,
    idempotencyKey: `idem-${paymentId}`,
    amount: 100,
    currency: "INR",
    senderId: "u1",
    receiverId: "u2",
  });

  console.log("enqueued:", job.id);
  process.exit(0);
}

main();

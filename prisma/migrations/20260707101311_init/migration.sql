-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "description" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT NOT NULL,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_jobId_key" ON "payments"("jobId");

-- CreateIndex
CREATE INDEX "payments_senderId_idx" ON "payments"("senderId");

-- CreateIndex
CREATE INDEX "payments_receiverId_idx" ON "payments"("receiverId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

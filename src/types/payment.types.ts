export interface PaymentJobData {
    paymentId: string;
    idempotencyKey: string;
    amount: number;
    currency: string;
    senderId: string;
    receiverId: string;
    description?: string;
}

export type PaymentJobResult = 
    | {success: true; processedAt: string}
    | {success: false; failureReason: string}
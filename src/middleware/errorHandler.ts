import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(zodError: ZodError) {
    const details = zodError.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      issue: issue.message,
    }));
    super('VALIDATION_ERROR', 400, 'Request body validation failed', details);
  }
}

export class MissingHeaderError extends AppError {
  constructor(headerName: string) {
    super('MISSING_HEADER', 400, `Missing required header: ${headerName}`);
  }
}

export class PaymentNotFoundError extends AppError {
  constructor(paymentId: string) {
    super('PAYMENT_NOT_FOUND', 404, `No payment found with id ${paymentId}`);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'unhandled_error',
    message: err.message,
    stack: err.stack,
  }));

  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
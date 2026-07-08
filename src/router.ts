import { Router } from 'express';
import paymentsRouter from './routes/payment'
import healthRouter from './routes/health';

const router = Router();
router.use('/payments', paymentsRouter);
router.use('/health', healthRouter);

export default router;
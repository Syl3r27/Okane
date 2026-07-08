import { Router } from 'express';
import paymentsRouter from './routes/payment';

const router = Router();
router.use('/payments', paymentsRouter);

export default router;
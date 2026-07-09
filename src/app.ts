import express from 'express';
import apiRouter from './router';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(express.json());
app.use('/', apiRouter);
app.use(errorHandler);
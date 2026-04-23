import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import authRoutes from './auth.routes';
import readingsRoutes from './readings.routes';
import alarmsRoutes from './alarms.routes';
import reportsRoutes from './reports.routes';
import adminRoutes from './admin.routes';
import db from '../config/database';
import * as scadaPoller from '../workers/scadaPoller';

const router = Router();

router.use('/auth',     authRoutes);
router.use('/readings', authenticate, readingsRoutes);
router.use('/alarms',   authenticate, alarmsRoutes);
router.use('/reports',  authenticate, reportsRoutes);
router.use('/admin',    authenticate, adminRoutes);

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbInfo = await db.healthCheck();
    const poller = scadaPoller.status();
    res.json({ status: 'ok', db: dbInfo.now, poller });
  } catch (err) {
    res.status(503).json({ status: 'error', error: (err as Error).message });
  }
});

export default router;

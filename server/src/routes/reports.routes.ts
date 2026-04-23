import { Router } from 'express';
import * as ctrl from '../controllers/reports.controller';

const router = Router();

router.get('/daily',   ctrl.dailyReport);
router.get('/monthly', ctrl.monthlyReport);
router.get('/alarms',  ctrl.alarmReport);

export default router;

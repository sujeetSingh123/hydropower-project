import { Router } from 'express';
import * as ctrl from '../controllers/readings.controller';

const router = Router();

router.get('/live',       ctrl.getLive);
router.get('/history',    ...ctrl.getHistory);
router.get('/aggregated', ctrl.getAggregated);
router.get('/summaries',  ctrl.getSummaries);

export default router;

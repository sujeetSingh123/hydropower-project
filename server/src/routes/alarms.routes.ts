import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/alarms.controller';

const router = Router();

router.get('/',           ctrl.getAlarms);
router.get('/stats',      ctrl.getStats);
router.patch('/:id/acknowledge', requireRole('admin', 'operator'), ctrl.acknowledge);
router.patch('/:id/notes',       requireRole('admin', 'operator'), ctrl.addNote);

export default router;

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/auth.controller';

const router = Router();

router.post('/login', ctrl.loginValidation, ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.post('/change-password', authenticate, ctrl.changePassword);

// Admin only
router.post('/users', authenticate, requireRole('admin'), ctrl.createUser);
router.get('/users', authenticate, requireRole('admin'), ctrl.listUsers);
router.patch('/users/:id', authenticate, requireRole('admin'), ctrl.updateUser);

export default router;

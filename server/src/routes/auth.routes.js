const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

router.post('/login', ctrl.loginValidation, ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.post('/change-password', authenticate, ctrl.changePassword);

// Admin only
router.post('/users', authenticate, requireRole('admin'), ctrl.createUser);
router.get('/users', authenticate, requireRole('admin'), ctrl.listUsers);
router.patch('/users/:id', authenticate, requireRole('admin'), ctrl.updateUser);

module.exports = router;

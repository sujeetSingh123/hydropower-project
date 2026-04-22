const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

const adminOnly = requireRole('admin');

router.get('/scada-settings',       adminOnly, ctrl.getScadaSettings);
router.patch('/scada-settings',     adminOnly, ctrl.updateScadaSettings);
router.get('/tags',                 ctrl.getTags);
router.post('/tags',                adminOnly, ctrl.createTag);
router.patch('/tags/:id',           adminOnly, ctrl.updateTag);
router.get('/poller/status',        ctrl.getPollerStatus);
router.post('/daily-summary',       adminOnly, ctrl.triggerDailySummary);
router.get('/notifications',        adminOnly, ctrl.getNotificationSettings);
router.patch('/notifications/:id',  adminOnly, ctrl.updateNotificationSetting);
router.get('/audit-logs',           adminOnly, ctrl.getAuditLogs);

module.exports = router;

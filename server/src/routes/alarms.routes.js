const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/alarms.controller');

router.get('/',           ctrl.getAlarms);
router.get('/stats',      ctrl.getStats);
router.patch('/:id/acknowledge', requireRole('admin', 'operator'), ctrl.acknowledge);
router.patch('/:id/notes',       requireRole('admin', 'operator'), ctrl.addNote);

module.exports = router;

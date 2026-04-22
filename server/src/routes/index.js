const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

router.use('/auth',     require('./auth.routes'));
router.use('/readings', authenticate, require('./readings.routes'));
router.use('/alarms',   authenticate, require('./alarms.routes'));
router.use('/reports',  authenticate, require('./reports.routes'));
router.use('/admin',    authenticate, require('./admin.routes'));

router.get('/health', async (req, res) => {
  const db = require('../config/database');
  try {
    const dbInfo = await db.healthCheck();
    const poller = require('../workers/scadaPoller').status();
    res.json({ status: 'ok', db: dbInfo.now, poller });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

module.exports = router;

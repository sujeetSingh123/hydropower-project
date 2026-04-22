const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');

router.get('/daily',   ctrl.dailyReport);
router.get('/monthly', ctrl.monthlyReport);
router.get('/alarms',  ctrl.alarmReport);

module.exports = router;

const router = require('express').Router();
const ctrl = require('../controllers/readings.controller');

router.get('/live',       ctrl.getLive);
router.get('/history',    ctrl.getHistory);
router.get('/aggregated', ctrl.getAggregated);
router.get('/summaries',  ctrl.getSummaries);

module.exports = router;

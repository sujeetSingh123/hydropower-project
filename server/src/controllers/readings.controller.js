const { query, validationResult } = require('express-validator');
const readingsRepo = require('../repositories/readings.repository');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const getLive = asyncHandler(async (req, res) => {
  const readings = await readingsRepo.getLatest(req.query.plantId || 1);
  const map = {};
  readings.forEach((r) => { map[r.tag_name] = { value: r.value, quality: r.quality, timestamp: r.timestamp }; });
  res.json({ data: map, timestamp: new Date() });
});

const getHistory = [
  query('tagName').notEmpty(),
  query('from').isISO8601(),
  query('to').isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 5000 }),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const rows = await readingsRepo.getHistory({
      tagName: req.query.tagName,
      from: new Date(req.query.from),
      to: new Date(req.query.to),
      limit: parseInt(req.query.limit, 10) || 500,
      plantId: req.query.plantId || 1,
    });
    res.json({ data: rows });
  }),
];

const getAggregated = asyncHandler(async (req, res) => {
  const { tagName, from, to, bucket = '60' } = req.query;
  if (!tagName || !from || !to) return res.status(400).json({ error: 'tagName, from, to required' });

  const rows = await readingsRepo.getAggregated({
    tagName,
    from: new Date(from),
    to: new Date(to),
    bucketMinutes: parseInt(bucket, 10),
    plantId: req.query.plantId || 1,
  });
  res.json({ data: rows });
});

const getSummaries = asyncHandler(async (req, res) => {
  const { from, to, plantId = 1 } = req.query;
  const { rows } = await db.query(
    `SELECT * FROM daily_generation_summary
     WHERE plant_id = $1 AND date BETWEEN $2 AND $3
     ORDER BY date DESC`,
    [plantId, from || '2020-01-01', to || new Date().toISOString()]
  );
  res.json({ data: rows });
});

module.exports = { getLive, getHistory, getAggregated, getSummaries };

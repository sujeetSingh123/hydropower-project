const db = require('../config/database');
const alarmService = require('../services/alarm.service');
const { asyncHandler } = require('../middleware/errorHandler');

const getAlarms = asyncHandler(async (req, res) => {
  const { status, severity, from, to, plantId = 1, limit = 100, offset = 0 } = req.query;

  let where = ['plant_id = $1'];
  const params = [plantId];
  let idx = 2;

  if (status) { where.push(`status = $${idx++}`); params.push(status); }
  if (severity) { where.push(`severity = $${idx++}`); params.push(severity); }
  if (from) { where.push(`triggered_at >= $${idx++}`); params.push(from); }
  if (to)   { where.push(`triggered_at <= $${idx++}`); params.push(to); }

  const countResult = await db.query(`SELECT COUNT(*) FROM alarms WHERE ${where.join(' AND ')}`, params);

  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const { rows } = await db.query(
    `SELECT a.*, u.name AS acknowledged_by_name
     FROM alarms a LEFT JOIN users u ON u.id = a.acknowledged_by
     WHERE ${where.join(' AND ')}
     ORDER BY a.triggered_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  res.json({ data: rows, total: parseInt(countResult.rows[0].count, 10), limit, offset });
});

const acknowledge = asyncHandler(async (req, res) => {
  const alarm = await alarmService.acknowledge(req.params.id, req.user.id);
  res.json({ alarm });
});

const addNote = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'UPDATE alarms SET notes = $1 WHERE id = $2 AND plant_id = $3 RETURNING *',
    [req.body.notes, req.params.id, 1]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Alarm not found' });
  res.json({ alarm: rows[0] });
});

const getStats = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')::int                AS active_count,
      COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'active')::int AS critical_count,
      COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '24h')::int AS last_24h,
      COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '7d')::int  AS last_7d
    FROM alarms WHERE plant_id = 1
  `);
  res.json(rows[0]);
});

module.exports = { getAlarms, acknowledge, addNote, getStats };

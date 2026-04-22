const db = require('../config/database');
const scadaPoller = require('../workers/scadaPoller');
const dailySummaryWorker = require('../workers/dailySummary');
const { asyncHandler } = require('../middleware/errorHandler');

const getScadaSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM scada_settings WHERE plant_id = 1');
  res.json({ settings: rows[0] });
});

const updateScadaSettings = asyncHandler(async (req, res) => {
  const { endpoint_url, poll_interval_ms, reconnect_delay_ms, connection_type } = req.body;
  const { rows } = await db.query(
    `UPDATE scada_settings SET
       endpoint_url = COALESCE($1, endpoint_url),
       poll_interval_ms = COALESCE($2, poll_interval_ms),
       reconnect_delay_ms = COALESCE($3, reconnect_delay_ms),
       connection_type = COALESCE($4, connection_type),
       updated_at = NOW()
     WHERE plant_id = 1 RETURNING *`,
    [endpoint_url, poll_interval_ms, reconnect_delay_ms, connection_type]
  );
  res.json({ settings: rows[0] });
});

const getTags = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM scada_tags ORDER BY category, id');
  res.json({ tags: rows });
});

const updateTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { display_name, opc_node_id, unit, alarm_low, alarm_high, warn_low, warn_high, is_active, poll_interval_ms } = req.body;
  const { rows } = await db.query(
    `UPDATE scada_tags SET
       display_name = COALESCE($1, display_name),
       opc_node_id = COALESCE($2, opc_node_id),
       unit = COALESCE($3, unit),
       alarm_low = $4, alarm_high = $5, warn_low = $6, warn_high = $7,
       is_active = COALESCE($8, is_active),
       poll_interval_ms = COALESCE($9, poll_interval_ms)
     WHERE id = $10 RETURNING *`,
    [display_name, opc_node_id, unit, alarm_low, alarm_high, warn_low, warn_high, is_active, poll_interval_ms, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tag not found' });
  res.json({ tag: rows[0] });
});

const createTag = asyncHandler(async (req, res) => {
  const { tag_name, display_name, opc_node_id, unit, data_type = 'float', category, alarm_low, alarm_high, warn_low, warn_high } = req.body;
  const { rows } = await db.query(
    `INSERT INTO scada_tags (tag_name, display_name, opc_node_id, unit, data_type, category, alarm_low, alarm_high, warn_low, warn_high)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [tag_name, display_name, opc_node_id, unit, data_type, category, alarm_low, alarm_high, warn_low, warn_high]
  );
  res.status(201).json({ tag: rows[0] });
});

const getPollerStatus = asyncHandler(async (req, res) => {
  res.json(scadaPoller.status());
});

const triggerDailySummary = asyncHandler(async (req, res) => {
  const date = req.body.date || new Date(Date.now() - 86400_000).toISOString().split('T')[0];
  const result = await dailySummaryWorker.generateSummary(date);
  res.json({ message: 'Summary generated', result });
});

const getNotificationSettings = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT id, type, config, severities, is_active FROM notification_settings');
  res.json({ settings: rows });
});

const updateNotificationSetting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { config, severities, is_active } = req.body;
  const { rows } = await db.query(
    'UPDATE notification_settings SET config = COALESCE($1::jsonb, config), severities = COALESCE($2, severities), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *',
    [config ? JSON.stringify(config) : null, severities, is_active, id]
  );
  res.json({ setting: rows[0] });
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY created_at DESC LIMIT 200'
  );
  res.json({ logs: rows });
});

module.exports = {
  getScadaSettings, updateScadaSettings,
  getTags, updateTag, createTag,
  getPollerStatus, triggerDailySummary,
  getNotificationSettings, updateNotificationSetting,
  getAuditLogs,
};

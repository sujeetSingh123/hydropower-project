const db = require('../config/database');
const logger = require('../utils/logger');
const notificationService = require('./notification.service');

const _activeAlarmCache = new Map(); // tag_name -> alarm row

const evaluate = async (readings) => {
  for (const r of readings) {
    if (r.value === null) continue;

    const { rows: tagRows } = await db.query(
      'SELECT * FROM scada_tags WHERE tag_name = $1 AND is_active = TRUE',
      [r.tag_name]
    );
    const tag = tagRows[0];
    if (!tag) continue;

    const alarms = [];

    if (tag.alarm_low !== null && r.value < tag.alarm_low) {
      alarms.push({ type: 'LOW_CRITICAL', severity: 'critical', threshold: tag.alarm_low });
    } else if (tag.warn_low !== null && r.value < tag.warn_low) {
      alarms.push({ type: 'LOW_WARNING', severity: 'warning', threshold: tag.warn_low });
    }

    if (tag.alarm_high !== null && r.value > tag.alarm_high) {
      alarms.push({ type: 'HIGH_CRITICAL', severity: 'critical', threshold: tag.alarm_high });
    } else if (tag.warn_high !== null && r.value > tag.warn_high) {
      alarms.push({ type: 'HIGH_WARNING', severity: 'warning', threshold: tag.warn_high });
    }

    const cacheKey = r.tag_name;
    const existingAlarm = _activeAlarmCache.get(cacheKey);

    if (alarms.length > 0) {
      const alarm = alarms[0];
      if (!existingAlarm) {
        const msg = `${tag.display_name} ${alarm.type.replace('_', ' ')}: ${r.value} ${tag.unit || ''} (threshold: ${alarm.threshold})`;
        const { rows: inserted } = await db.query(
          `INSERT INTO alarms (tag_name, alarm_type, severity, message, value, threshold)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [r.tag_name, alarm.type, alarm.severity, msg, r.value, alarm.threshold]
        );
        _activeAlarmCache.set(cacheKey, inserted[0]);
        logger.warn('Alarm triggered', { tag: r.tag_name, type: alarm.type, value: r.value });

        await notificationService.send(alarm.severity, msg, tag.display_name);
      }
    } else if (existingAlarm) {
      await db.query(
        "UPDATE alarms SET status = 'resolved', resolved_at = NOW() WHERE id = $1 AND status = 'active'",
        [existingAlarm.id]
      );
      _activeAlarmCache.delete(cacheKey);
    }
  }
};

const getActiveAlarms = async (plantId = 1) => {
  const { rows } = await db.query(
    "SELECT * FROM alarms WHERE plant_id = $1 AND status = 'active' ORDER BY triggered_at DESC",
    [plantId]
  );
  return rows;
};

const acknowledge = async (alarmId, userId) => {
  const { rows } = await db.query(
    "UPDATE alarms SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1 WHERE id = $2 AND status = 'active' RETURNING *",
    [userId, alarmId]
  );
  if (!rows[0]) throw Object.assign(new Error('Alarm not found or already acknowledged'), { statusCode: 404 });
  return rows[0];
};

const triggerNoDataAlarm = async (tagName, lastSeenAt) => {
  const key = `no_data_${tagName}`;
  if (_activeAlarmCache.has(key)) return;
  const msg = `No data received from ${tagName} since ${lastSeenAt.toISOString()}`;
  const { rows } = await db.query(
    "INSERT INTO alarms (tag_name, alarm_type, severity, message) VALUES ($1, 'NO_DATA', 'critical', $2) RETURNING *",
    [tagName, msg]
  );
  _activeAlarmCache.set(key, rows[0]);
  logger.error('No data alarm', { tag: tagName });
  await notificationService.send('critical', msg, tagName);
};

module.exports = { evaluate, getActiveAlarms, acknowledge, triggerNoDataAlarm };

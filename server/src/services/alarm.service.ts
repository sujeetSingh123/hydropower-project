import db from '../config/database';
import logger from '../utils/logger';
import notificationService from './notification.service';
import { SensorReading, ScadaTag, AlarmRow, AlarmThreshold } from '../types';

const _activeAlarmCache = new Map<string, AlarmRow>();

export const evaluate = async (readings: SensorReading[]): Promise<void> => {
  for (const r of readings) {
    if (r.value === null) continue;

    const { rows: tagRows } = await db.query<ScadaTag>(
      'SELECT * FROM scada_tags WHERE tag_name = $1 AND is_active = TRUE',
      [r.tag_name]
    );
    const tag = tagRows[0];
    if (!tag) continue;

    const alarms: AlarmThreshold[] = [];

    const alarmLow = tag.alarm_low !== null ? parseFloat(tag.alarm_low as unknown as string) : null;
    const alarmHigh = tag.alarm_high !== null ? parseFloat(tag.alarm_high as unknown as string) : null;
    const warnLow = tag.warn_low !== null ? parseFloat(tag.warn_low as unknown as string) : null;
    const warnHigh = tag.warn_high !== null ? parseFloat(tag.warn_high as unknown as string) : null;

    if (alarmLow !== null && r.value < alarmLow) {
      alarms.push({ type: 'LOW_CRITICAL', severity: 'critical', threshold: alarmLow });
    } else if (warnLow !== null && r.value < warnLow) {
      alarms.push({ type: 'LOW_WARNING', severity: 'warning', threshold: warnLow });
    }

    if (alarmHigh !== null && r.value > alarmHigh) {
      alarms.push({ type: 'HIGH_CRITICAL', severity: 'critical', threshold: alarmHigh });
    } else if (warnHigh !== null && r.value > warnHigh) {
      alarms.push({ type: 'HIGH_WARNING', severity: 'warning', threshold: warnHigh });
    }

    const cacheKey = r.tag_name;
    const existingAlarm = _activeAlarmCache.get(cacheKey);

    if (alarms.length > 0) {
      const alarm = alarms[0];
      if (!existingAlarm) {
        const msg = `${tag.display_name} ${alarm.type.replace('_', ' ')}: ${r.value} ${tag.unit ?? ''} (threshold: ${alarm.threshold})`;
        const { rows: inserted } = await db.query<AlarmRow>(
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

export const getActiveAlarms = async (plantId = 1): Promise<AlarmRow[]> => {
  const { rows } = await db.query<AlarmRow>(
    "SELECT * FROM alarms WHERE plant_id = $1 AND status = 'active' ORDER BY triggered_at DESC",
    [plantId]
  );
  return rows;
};

export const acknowledge = async (alarmId: string, userId: string): Promise<AlarmRow> => {
  const { rows } = await db.query<AlarmRow>(
    "UPDATE alarms SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1 WHERE id = $2 AND status = 'active' RETURNING *",
    [userId, alarmId]
  );
  if (!rows[0]) throw Object.assign(new Error('Alarm not found or already acknowledged'), { statusCode: 404 });
  return rows[0];
};

export const triggerNoDataAlarm = async (tagName: string, lastSeenAt: Date): Promise<void> => {
  const key = `no_data_${tagName}`;
  if (_activeAlarmCache.has(key)) return;
  const msg = `No data received from ${tagName} since ${lastSeenAt.toISOString()}`;
  const { rows } = await db.query<AlarmRow>(
    "INSERT INTO alarms (tag_name, alarm_type, severity, message) VALUES ($1, 'NO_DATA', 'critical', $2) RETURNING *",
    [tagName, msg]
  );
  _activeAlarmCache.set(key, rows[0]);
  logger.error('No data alarm', { tag: tagName });
  await notificationService.send('critical', msg, tagName);
};

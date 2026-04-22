/**
 * Daily Summary Cron Worker
 * Runs at 00:05 every day to aggregate the previous day's readings.
 */
const cron = require('node-cron');
const { format, subDays, startOfDay, endOfDay } = require('date-fns');
const db = require('../config/database');
const logger = require('../utils/logger');

async function generateSummary(date, plantId = 1) {
  const d = new Date(date);
  const from = startOfDay(d);
  const to = endOfDay(d);
  const dateStr = format(d, 'yyyy-MM-dd');

  const aggSQL = `
    SELECT
      AVG(CASE WHEN tag_name = 'Generator.Power'       THEN value END) AS avg_load_kw,
      MAX(CASE WHEN tag_name = 'Generator.Power'       THEN value END) AS peak_load_kw,
      MIN(CASE WHEN tag_name = 'Generator.Power'       THEN value END) AS min_load_kw,
      AVG(CASE WHEN tag_name = 'Generator.Frequency'   THEN value END) AS avg_frequency,
      MIN(CASE WHEN tag_name = 'Generator.Frequency'   THEN value END) AS min_frequency,
      MAX(CASE WHEN tag_name = 'Generator.Frequency'   THEN value END) AS max_frequency,
      AVG(CASE WHEN tag_name = 'Generator.Voltage_RY'  THEN value END) AS avg_voltage_ry,
      MIN(CASE WHEN tag_name = 'Generator.Voltage_RY'  THEN value END) AS min_voltage,
      MAX(CASE WHEN tag_name = 'Generator.Voltage_RY'  THEN value END) AS max_voltage,
      AVG(CASE WHEN tag_name = 'Generator.PowerFactor' THEN value END) AS avg_power_factor,
      AVG(CASE WHEN tag_name = 'Plant.WaterLevel'      THEN value END) AS avg_water_level,
      MIN(CASE WHEN tag_name = 'Plant.WaterLevel'      THEN value END) AS min_water_level,
      COUNT(*)::int AS reading_count
    FROM scada_readings
    WHERE plant_id = $1 AND timestamp BETWEEN $2 AND $3
  `;

  const { rows: agg } = await db.query(aggSQL, [plantId, from, to]);
  const a = agg[0];

  // Energy = trapezoidal integration of power over time (kWh)
  const { rows: energyRows } = await db.query(
    `SELECT value, timestamp FROM scada_readings
     WHERE plant_id = $1 AND tag_name = 'Generator.Power' AND timestamp BETWEEN $2 AND $3
     ORDER BY timestamp`,
    [plantId, from, to]
  );

  let totalEnergy = 0;
  for (let i = 1; i < energyRows.length; i++) {
    const dt = (new Date(energyRows[i].timestamp) - new Date(energyRows[i - 1].timestamp)) / 3_600_000;
    const avgKw = (parseFloat(energyRows[i].value) + parseFloat(energyRows[i - 1].value)) / 2;
    totalEnergy += avgKw * dt;
  }

  const { rows: alarmCount } = await db.query(
    'SELECT COUNT(*)::int AS cnt FROM alarms WHERE plant_id = $1 AND triggered_at BETWEEN $2 AND $3',
    [plantId, from, to]
  );

  await db.query(
    `INSERT INTO daily_generation_summary
       (plant_id, date, total_generation_kwh, peak_load_kw, avg_load_kw, min_load_kw,
        avg_frequency, min_frequency, max_frequency, avg_voltage_ry, min_voltage, max_voltage,
        avg_power_factor, avg_water_level, min_water_level, alarm_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (plant_id, date) DO UPDATE SET
       total_generation_kwh = EXCLUDED.total_generation_kwh,
       peak_load_kw = EXCLUDED.peak_load_kw,
       avg_load_kw = EXCLUDED.avg_load_kw,
       avg_frequency = EXCLUDED.avg_frequency,
       avg_voltage_ry = EXCLUDED.avg_voltage_ry,
       avg_power_factor = EXCLUDED.avg_power_factor,
       alarm_count = EXCLUDED.alarm_count,
       updated_at = NOW()`,
    [
      plantId, dateStr,
      totalEnergy.toFixed(3),
      a.peak_load_kw, a.avg_load_kw, a.min_load_kw,
      a.avg_frequency, a.min_frequency, a.max_frequency,
      a.avg_voltage_ry, a.min_voltage, a.max_voltage,
      a.avg_power_factor, a.avg_water_level, a.min_water_level,
      alarmCount[0].cnt,
    ]
  );

  logger.info('Daily summary generated', { date: dateStr, energy: totalEnergy.toFixed(1) });
  return { date: dateStr, totalEnergy: totalEnergy.toFixed(3) };
}

function start() {
  // Run at 00:05 every day
  cron.schedule('5 0 * * *', async () => {
    const yesterday = subDays(new Date(), 1);
    try {
      await generateSummary(yesterday);
    } catch (err) {
      logger.error('Daily summary cron failed', { error: err.message });
    }
  });
  logger.info('Daily summary cron scheduled (00:05 daily)');
}

module.exports = { start, generateSummary };

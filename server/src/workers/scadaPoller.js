/**
 * SCADA Polling Worker
 *
 * Runs as a background loop inside the Node.js process.
 * Fetches all active tags, reads values via scadaService,
 * bulk-inserts into scada_readings, evaluates alarms,
 * and broadcasts live data over Socket.IO.
 */

const env = require('../config/env');
const db = require('../config/database');
const scadaService = require('../services/scada.service');
const alarmService = require('../services/alarm.service');
const logger = require('../utils/logger');

let _io = null;
let _timer = null;
let _running = false;
let _lastPollAt = null;
let _consecutiveErrors = 0;

const MAX_CONSECUTIVE_ERRORS = 5;
const NO_DATA_THRESHOLD_MS = 60_000;

async function loadActiveTags() {
  const { rows } = await db.query(
    'SELECT id, tag_name, opc_node_id, unit FROM scada_tags WHERE is_active = TRUE ORDER BY id'
  );
  return rows;
}

async function insertReadings(readings) {
  if (!readings.length) return;
  const values = [];
  const params = [];
  let idx = 1;
  for (const r of readings) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    params.push(1, r.tag_id, r.tag_name, r.value, r.timestamp);
  }
  await db.query(
    `INSERT INTO scada_readings (plant_id, tag_id, tag_name, value, timestamp) VALUES ${values.join(',')}`,
    params
  );
}

async function pollCycle() {
  if (_running) return;
  _running = true;
  try {
    const tags = await loadActiveTags();
    if (!tags.length) return;

    const readings = await scadaService.readAll(tags);
    if (!readings.length) return;

    await insertReadings(readings);
    await alarmService.evaluate(readings);

    _lastPollAt = new Date();
    _consecutiveErrors = 0;

    // Build a tag-name -> value map for live broadcast
    const liveData = {};
    readings.forEach((r) => { liveData[r.tag_name] = { value: r.value, quality: r.quality, ts: r.timestamp }; });
    _io?.emit('live_data', { plantId: 1, data: liveData, timestamp: _lastPollAt });

  } catch (err) {
    _consecutiveErrors += 1;
    logger.error('Poll cycle error', { error: err.message, consecutive: _consecutiveErrors });

    if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      await alarmService.triggerNoDataAlarm('SCADA', _lastPollAt || new Date()).catch(() => {});
    }
  } finally {
    _running = false;
  }
}

function start(io) {
  _io = io;
  logger.info('SCADA poller starting', { intervalMs: env.scada.pollIntervalMs, simulator: scadaService.isSimulator });

  scadaService.initialize().catch((err) => {
    logger.error('SCADA init failed, will retry in background', { error: err.message });
  });

  _timer = setInterval(pollCycle, env.scada.pollIntervalMs);
  // Run first cycle immediately
  pollCycle();
}

function stop() {
  clearInterval(_timer);
  return scadaService.shutdown();
}

function status() {
  return {
    running: !!_timer,
    connected: scadaService.isConnected,
    simulator: scadaService.isSimulator,
    lastPollAt: _lastPollAt,
    consecutiveErrors: _consecutiveErrors,
    pollIntervalMs: env.scada.pollIntervalMs,
  };
}

module.exports = { start, stop, status };

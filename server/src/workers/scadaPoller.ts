/**
 * SCADA Polling Worker
 *
 * Runs as a background loop inside the Node.js process.
 * Fetches all active tags, reads values via scadaService,
 * bulk-inserts into scada_readings, evaluates alarms,
 * and broadcasts live data over Socket.IO.
 */

import { Server as SocketServer } from 'socket.io';
import env from '../config/env';
import db from '../config/database';
import scadaService from '../services/scada.service';
import * as alarmService from '../services/alarm.service';
import logger from '../utils/logger';
import { ActiveTag, SensorReading, PollerStatus } from '../types';

let _io: SocketServer | null = null;
let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;
let _lastPollAt: Date | null = null;
let _consecutiveErrors = 0;

const MAX_CONSECUTIVE_ERRORS = 5;

async function loadActiveTags(): Promise<ActiveTag[]> {
  const { rows } = await db.query<ActiveTag>(
    'SELECT id, tag_name, opc_node_id, unit FROM scada_tags WHERE is_active = TRUE ORDER BY id'
  );
  return rows;
}

async function insertReadings(readings: SensorReading[]): Promise<void> {
  if (!readings.length) return;
  const values: string[] = [];
  const params: unknown[] = [];
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

async function pollCycle(): Promise<void> {
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
    const liveData: Record<string, { value: number | null; quality: number; ts: Date }> = {};
    readings.forEach((r) => { liveData[r.tag_name] = { value: r.value, quality: r.quality, ts: r.timestamp }; });
    _io?.emit('live_data', { plantId: 1, data: liveData, timestamp: _lastPollAt });

  } catch (err) {
    _consecutiveErrors += 1;
    logger.error('Poll cycle error', { error: (err as Error).message, consecutive: _consecutiveErrors });

    if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      await alarmService.triggerNoDataAlarm('SCADA', _lastPollAt ?? new Date()).catch(() => {});
    }
  } finally {
    _running = false;
  }
}

export function start(io: SocketServer): void {
  _io = io;
  logger.info('SCADA poller starting', { intervalMs: env.scada.pollIntervalMs, simulator: scadaService.isSimulator });

  scadaService.initialize().catch((err: Error) => {
    logger.error('SCADA init failed, will retry in background', { error: err.message });
  });

  _timer = setInterval(pollCycle, env.scada.pollIntervalMs);
  // Run first cycle immediately
  void pollCycle();
}

export function stop(): Promise<void> {
  if (_timer) clearInterval(_timer);
  return scadaService.shutdown();
}

export function status(): PollerStatus {
  return {
    running: !!_timer,
    connected: scadaService.isConnected,
    simulator: scadaService.isSimulator,
    lastPollAt: _lastPollAt,
    consecutiveErrors: _consecutiveErrors,
    pollIntervalMs: env.scada.pollIntervalMs,
  };
}

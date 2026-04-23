import { Request, Response } from 'express';
import db from '../config/database';
import * as alarmService from '../services/alarm.service';
import { asyncHandler } from '../middleware/errorHandler';

export const getAlarms = asyncHandler(async (req: Request, res: Response) => {
  const { status, severity, from, to } = req.query as Record<string, string | undefined>;
  const plantId = req.query.plantId ?? '1';
  const limit = req.query.limit ?? '100';
  const offset = req.query.offset ?? '0';

  const where: string[] = ['plant_id = $1'];
  const params: unknown[] = [plantId];
  let idx = 2;

  if (status)   { where.push(`status = $${idx++}`);          params.push(status); }
  if (severity) { where.push(`severity = $${idx++}`);        params.push(severity); }
  if (from)     { where.push(`triggered_at >= $${idx++}`);   params.push(from); }
  if (to)       { where.push(`triggered_at <= $${idx++}`);   params.push(to); }

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM alarms WHERE ${where.join(' AND ')}`,
    params
  );

  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));
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

export const acknowledge = asyncHandler(async (req: Request, res: Response) => {
  const alarm = await alarmService.acknowledge(req.params.id as string, req.user!.id);
  res.json({ alarm });
});

export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await db.query(
    'UPDATE alarms SET notes = $1 WHERE id = $2 AND plant_id = $3 RETURNING *',
    [(req.body as { notes: string }).notes, req.params.id, 1]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Alarm not found' }); return; }
  res.json({ alarm: rows[0] });
});

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
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

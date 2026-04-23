import { Request, Response } from 'express';
import db from '../config/database';
import * as scadaPoller from '../workers/scadaPoller';
import * as dailySummaryWorker from '../workers/dailySummary';
import { asyncHandler } from '../middleware/errorHandler';

interface UpdateScadaSettingsBody {
  endpoint_url?: string;
  poll_interval_ms?: number;
  reconnect_delay_ms?: number;
  connection_type?: string;
}

interface UpdateTagBody {
  display_name?: string;
  opc_node_id?: string;
  unit?: string;
  alarm_low?: number | null;
  alarm_high?: number | null;
  warn_low?: number | null;
  warn_high?: number | null;
  is_active?: boolean;
  poll_interval_ms?: number;
}

interface CreateTagBody {
  tag_name: string;
  display_name: string;
  opc_node_id?: string;
  unit?: string;
  data_type?: string;
  category?: string;
  alarm_low?: number | null;
  alarm_high?: number | null;
  warn_low?: number | null;
  warn_high?: number | null;
}

export const getScadaSettings = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await db.query('SELECT * FROM scada_settings WHERE plant_id = 1');
  res.json({ settings: rows[0] });
});

export const updateScadaSettings = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint_url, poll_interval_ms, reconnect_delay_ms, connection_type } =
    req.body as UpdateScadaSettingsBody;
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

export const getTags = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await db.query('SELECT * FROM scada_tags ORDER BY category, id');
  res.json({ tags: rows });
});

export const updateTag = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { display_name, opc_node_id, unit, alarm_low, alarm_high, warn_low, warn_high, is_active, poll_interval_ms } =
    req.body as UpdateTagBody;
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
  if (!rows[0]) { res.status(404).json({ error: 'Tag not found' }); return; }
  res.json({ tag: rows[0] });
});

export const createTag = asyncHandler(async (req: Request, res: Response) => {
  const {
    tag_name, display_name, opc_node_id, unit,
    data_type = 'float', category,
    alarm_low, alarm_high, warn_low, warn_high,
  } = req.body as CreateTagBody;
  const { rows } = await db.query(
    `INSERT INTO scada_tags (tag_name, display_name, opc_node_id, unit, data_type, category, alarm_low, alarm_high, warn_low, warn_high)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [tag_name, display_name, opc_node_id, unit, data_type, category, alarm_low, alarm_high, warn_low, warn_high]
  );
  res.status(201).json({ tag: rows[0] });
});

export const getPollerStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json(scadaPoller.status());
});

export const triggerDailySummary = asyncHandler(async (req: Request, res: Response) => {
  const date =
    (req.body as { date?: string }).date ??
    new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const result = await dailySummaryWorker.generateSummary(date);
  res.json({ message: 'Summary generated', result });
});

export const getNotificationSettings = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await db.query('SELECT id, type, config, severities, is_active FROM notification_settings');
  res.json({ settings: rows });
});

export const updateNotificationSetting = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { config, severities, is_active } = req.body as {
    config?: Record<string, unknown>;
    severities?: string[];
    is_active?: boolean;
  };
  const { rows } = await db.query(
    'UPDATE notification_settings SET config = COALESCE($1::jsonb, config), severities = COALESCE($2, severities), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *',
    [config ? JSON.stringify(config) : null, severities, is_active, id]
  );
  res.json({ setting: rows[0] });
});

export const getAuditLogs = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await db.query(
    'SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY created_at DESC LIMIT 200'
  );
  res.json({ logs: rows });
});

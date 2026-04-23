import { query, validationResult } from 'express-validator';
import { Request, Response, RequestHandler } from 'express';
import * as readingsRepo from '../repositories/readings.repository';
import db from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { ReadingRow } from '../types';

interface LiveReadingMap {
  [tagName: string]: { value: string | null; quality: number; timestamp: Date };
}

export const getLive = asyncHandler(async (req: Request, res: Response) => {
  const plantId = req.query.plantId ? Number(req.query.plantId) : 1;
  const readings = await readingsRepo.getLatest(plantId);
  const map: LiveReadingMap = {};
  readings.forEach((r: ReadingRow) => {
    map[r.tag_name] = { value: r.value, quality: r.quality, timestamp: r.timestamp };
  });
  res.json({ data: map, timestamp: new Date() });
});

export const getHistory: RequestHandler[] = [
  query('tagName').notEmpty(),
  query('from').isISO8601(),
  query('to').isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 5000 }),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const rows = await readingsRepo.getHistory({
      tagName: req.query.tagName as string,
      from: new Date(req.query.from as string),
      to: new Date(req.query.to as string),
      limit: parseInt(req.query.limit as string, 10) || 500,
      plantId: req.query.plantId ? Number(req.query.plantId) : 1,
    });
    res.json({ data: rows });
  }),
];

export const getAggregated = asyncHandler(async (req: Request, res: Response) => {
  const { tagName, from, to, bucket = '60' } = req.query as Record<string, string | undefined>;
  if (!tagName || !from || !to) { res.status(400).json({ error: 'tagName, from, to required' }); return; }

  const rows = await readingsRepo.getAggregated({
    tagName,
    from: new Date(from),
    to: new Date(to),
    bucketMinutes: parseInt(bucket, 10),
    plantId: req.query.plantId ? Number(req.query.plantId) : 1,
  });
  res.json({ data: rows });
});

export const getSummaries = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, plantId = '1' } = req.query as Record<string, string | undefined>;
  const { rows } = await db.query(
    `SELECT * FROM daily_generation_summary
     WHERE plant_id = $1 AND date BETWEEN $2 AND $3
     ORDER BY date DESC`,
    [plantId, from ?? '2020-01-01', to ?? new Date().toISOString()]
  );
  res.json({ data: rows });
});

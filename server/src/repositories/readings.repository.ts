import db from '../config/database';
import { ReadingRow, AggregatedReading } from '../types';

export interface HistoryParams {
  tagName: string;
  from: Date;
  to: Date;
  limit?: number;
  plantId?: number;
}

export interface AggregatedParams {
  tagName: string;
  from: Date;
  to: Date;
  bucketMinutes?: number;
  plantId?: number;
}

export const getLatest = async (plantId = 1): Promise<ReadingRow[]> => {
  const { rows } = await db.query<ReadingRow>(
    `SELECT DISTINCT ON (tag_name) tag_name, value, quality, timestamp
     FROM scada_readings
     WHERE plant_id = $1
     ORDER BY tag_name, timestamp DESC`,
    [plantId]
  );
  return rows;
};

export const getHistory = async ({
  tagName,
  from,
  to,
  limit = 500,
  plantId = 1,
}: HistoryParams): Promise<ReadingRow[]> => {
  const { rows } = await db.query<ReadingRow>(
    `SELECT tag_name, value, quality, timestamp
     FROM scada_readings
     WHERE plant_id = $1 AND tag_name = $2 AND timestamp BETWEEN $3 AND $4
     ORDER BY timestamp DESC
     LIMIT $5`,
    [plantId, tagName, from, to, limit]
  );
  return rows;
};

export const getAggregated = async ({
  tagName,
  from,
  to,
  bucketMinutes = 60,
  plantId = 1,
}: AggregatedParams): Promise<AggregatedReading[]> => {
  const { rows } = await db.query<AggregatedReading>(
    `SELECT
       time_bucket($1::interval, timestamp) AS bucket,
       AVG(value) AS avg_value,
       MIN(value) AS min_value,
       MAX(value) AS max_value,
       COUNT(*) AS sample_count
     FROM scada_readings
     WHERE plant_id = $2 AND tag_name = $3 AND timestamp BETWEEN $4 AND $5
     GROUP BY bucket
     ORDER BY bucket`,
    [`${bucketMinutes} minutes`, plantId, tagName, from, to]
  );
  return rows;
};

export const getMultiTagLatest = async (tagNames: string[], plantId = 1): Promise<ReadingRow[]> => {
  const placeholders = tagNames.map((_, i) => `$${i + 2}`).join(',');
  const { rows } = await db.query<ReadingRow>(
    `SELECT DISTINCT ON (tag_name) tag_name, value, quality, timestamp
     FROM scada_readings
     WHERE plant_id = $1 AND tag_name IN (${placeholders})
     ORDER BY tag_name, timestamp DESC`,
    [plantId, ...tagNames]
  );
  return rows;
};

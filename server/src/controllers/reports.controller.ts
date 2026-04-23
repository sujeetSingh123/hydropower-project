import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import db from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

export const dailyReport = asyncHandler(async (req: Request, res: Response) => {
  const date = (req.query.date as string | undefined) ?? format(new Date(), 'yyyy-MM-dd');
  const exportFmt = (req.query.format as string | undefined) ?? 'json';

  if (exportFmt === 'excel') {
    const wb = await reportService.buildDailyExcel(date);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
    return;
  }

  if (exportFmt === 'pdf') {
    const buf = await reportService.buildDailyPDF(date);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.pdf"`);
    res.send(buf);
    return;
  }

  const summary = await reportService.fetchDailySummary(date);
  res.json({ data: summary, date });
});

export const monthlyReport = asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
  const exportFmt = (req.query.format as string | undefined) ?? 'json';

  if (exportFmt === 'excel') {
    const wb = await reportService.buildMonthlyExcel(year, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly_report_${year}_${month}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
    return;
  }

  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(from);
  const { rows } = await db.query(
    'SELECT * FROM daily_generation_summary WHERE date BETWEEN $1 AND $2 ORDER BY date',
    [format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')]
  );
  res.json({ data: rows, year, month });
});

export const alarmReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const alarms = await reportService.fetchAlarmRange(
    from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000),
    to ? new Date(to) : new Date()
  );
  res.json({ data: alarms, count: alarms.length });
});

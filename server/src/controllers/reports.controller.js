const { format } = require('date-fns');
const reportService = require('../services/report.service');
const { asyncHandler } = require('../middleware/errorHandler');

const dailyReport = asyncHandler(async (req, res) => {
  const date = req.query.date || format(new Date(), 'yyyy-MM-dd');
  const exportFmt = req.query.format || 'json';

  if (exportFmt === 'excel') {
    const wb = await reportService.buildDailyExcel(date);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  if (exportFmt === 'pdf') {
    const buf = await reportService.buildDailyPDF(date);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.pdf"`);
    return res.send(buf);
  }

  const summary = await reportService.fetchDailySummary(date);
  res.json({ data: summary, date });
});

const monthlyReport = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
  const exportFmt = req.query.format || 'json';

  if (exportFmt === 'excel') {
    const wb = await reportService.buildMonthlyExcel(year, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly_report_${year}_${month}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  const { startOfMonth, endOfMonth } = require('date-fns');
  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(from);
  const db = require('../config/database');
  const { rows } = await db.query(
    'SELECT * FROM daily_generation_summary WHERE date BETWEEN $1 AND $2 ORDER BY date',
    [format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')]
  );
  res.json({ data: rows, year, month });
});

const alarmReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const alarms = await reportService.fetchAlarmRange(
    from ? new Date(from) : new Date(Date.now() - 30 * 86400_000),
    to ? new Date(to) : new Date()
  );
  res.json({ data: alarms, count: alarms.length });
});

module.exports = { dailyReport, monthlyReport, alarmReport };

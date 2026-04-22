const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { format, startOfDay, endOfDay, startOfMonth, endOfMonth } = require('date-fns');
const db = require('../config/database');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function fetchDailySummary(date, plantId = 1) {
  const d = new Date(date);
  const { rows } = await db.query(
    'SELECT * FROM daily_generation_summary WHERE date = $1 AND plant_id = $2',
    [format(d, 'yyyy-MM-dd'), plantId]
  );
  return rows[0];
}

async function fetchReadingsRange(from, to, tagNames, plantId = 1) {
  const placeholders = tagNames.map((_, i) => `$${i + 3}`).join(',');
  const { rows } = await db.query(
    `SELECT tag_name, value, timestamp FROM scada_readings
     WHERE plant_id = $1 AND timestamp BETWEEN $2 AND $3 AND tag_name IN (${placeholders})
     ORDER BY timestamp`,
    [plantId, from, to, ...tagNames]
  );
  return rows;
}

async function fetchAlarmRange(from, to, plantId = 1) {
  const { rows } = await db.query(
    'SELECT * FROM alarms WHERE plant_id = $1 AND triggered_at BETWEEN $2 AND $3 ORDER BY triggered_at',
    [plantId, from, to]
  );
  return rows;
}

// ─── Excel Builder ────────────────────────────────────────────────────────────

async function buildDailyExcel(date, plantId = 1) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hydropower Monitor';
  wb.created = new Date();

  const summary = await fetchDailySummary(date, plantId);
  const from = startOfDay(new Date(date));
  const to = endOfDay(new Date(date));
  const readings = await fetchReadingsRange(from, to, ['Generator.Power', 'Generator.Frequency', 'Generator.Voltage_RY', 'Generator.Current_R', 'Generator.PowerFactor'], plantId);
  const alarms = await fetchAlarmRange(from, to, plantId);

  // Sheet 1 – Summary
  const ws1 = wb.addWorksheet('Daily Summary');
  ws1.columns = [
    { header: 'Parameter', key: 'param', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
    { header: 'Unit', key: 'unit', width: 12 },
  ];
  ws1.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });

  if (summary) {
    const rows = [
      { param: 'Date', value: format(new Date(date), 'dd-MMM-yyyy'), unit: '' },
      { param: 'Total Generation', value: summary.total_generation_kwh, unit: 'kWh' },
      { param: 'Peak Load', value: summary.peak_load_kw, unit: 'kW' },
      { param: 'Average Load', value: summary.avg_load_kw, unit: 'kW' },
      { param: 'Average Frequency', value: summary.avg_frequency, unit: 'Hz' },
      { param: 'Min Frequency', value: summary.min_frequency, unit: 'Hz' },
      { param: 'Max Frequency', value: summary.max_frequency, unit: 'Hz' },
      { param: 'Average Voltage (R-Y)', value: summary.avg_voltage_ry, unit: 'V' },
      { param: 'Average Power Factor', value: summary.avg_power_factor, unit: '' },
      { param: 'Min Water Level', value: summary.min_water_level, unit: 'm' },
      { param: 'Downtime', value: summary.downtime_minutes, unit: 'minutes' },
      { param: 'Total Alarms', value: summary.alarm_count, unit: '' },
    ];
    rows.forEach((r) => ws1.addRow(r));
  }

  // Sheet 2 – Readings
  const ws2 = wb.addWorksheet('Hourly Readings');
  ws2.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 22 },
    { header: 'Tag', key: 'tag_name', width: 28 },
    { header: 'Value', key: 'value', width: 14 },
  ];
  ws2.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  readings.forEach((r) => ws2.addRow({ timestamp: format(new Date(r.timestamp), 'dd-MMM-yyyy HH:mm:ss'), tag_name: r.tag_name, value: r.value }));

  // Sheet 3 – Alarms
  const ws3 = wb.addWorksheet('Alarms');
  ws3.columns = [
    { header: 'Triggered At', key: 'triggered_at', width: 22 },
    { header: 'Tag', key: 'tag_name', width: 28 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Message', key: 'message', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  ws3.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  alarms.forEach((a) => ws3.addRow({ ...a, triggered_at: format(new Date(a.triggered_at), 'dd-MMM-yyyy HH:mm') }));

  return wb;
}

async function buildMonthlyExcel(year, month, plantId = 1) {
  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(from);
  const { rows } = await db.query(
    'SELECT * FROM daily_generation_summary WHERE plant_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date',
    [plantId, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')]
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Monthly Summary');
  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Generation (kWh)', key: 'total_generation_kwh', width: 18 },
    { header: 'Peak Load (kW)', key: 'peak_load_kw', width: 16 },
    { header: 'Avg Frequency (Hz)', key: 'avg_frequency', width: 18 },
    { header: 'Avg Voltage (V)', key: 'avg_voltage_ry', width: 16 },
    { header: 'Avg PF', key: 'avg_power_factor', width: 10 },
    { header: 'Downtime (min)', key: 'downtime_minutes', width: 15 },
    { header: 'Alarms', key: 'alarm_count', width: 10 },
  ];
  ws.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  rows.forEach((r) => ws.addRow({ ...r, date: format(new Date(r.date), 'dd-MMM-yyyy') }));

  // Totals row
  if (rows.length) {
    const total = rows.reduce((acc, r) => acc + parseFloat(r.total_generation_kwh || 0), 0);
    ws.addRow({ date: 'TOTAL', total_generation_kwh: total.toFixed(2) });
  }

  return wb;
}

// ─── PDF Builder ──────────────────────────────────────────────────────────────

async function buildDailyPDF(date, plantId = 1) {
  const summary = await fetchDailySummary(date, plantId);
  const alarms = await fetchAlarmRange(startOfDay(new Date(date)), endOfDay(new Date(date)), plantId);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];

  doc.on('data', (c) => chunks.push(c));

  // Title
  doc.fontSize(20).fillColor('#1E3A5F').text('HYDROPOWER PLANT', { align: 'center' });
  doc.fontSize(14).fillColor('#333').text(`Daily Generation Report — ${format(new Date(date), 'dd MMMM yyyy')}`, { align: 'center' });
  doc.moveDown();

  if (summary) {
    doc.fontSize(12).fillColor('#1E3A5F').text('GENERATION SUMMARY', { underline: true });
    doc.moveDown(0.5);
    const items = [
      ['Total Generation', `${summary.total_generation_kwh} kWh`],
      ['Peak Load', `${summary.peak_load_kw} kW`],
      ['Avg Frequency', `${summary.avg_frequency} Hz`],
      ['Avg Voltage (R-Y)', `${summary.avg_voltage_ry} V`],
      ['Avg Power Factor', summary.avg_power_factor],
      ['Downtime', `${summary.downtime_minutes} minutes`],
      ['Alarms', summary.alarm_count],
    ];
    items.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#333').text(`${label}:`, { continued: true, width: 200 }).fillColor('#000').text(`  ${value}`);
    });
  }

  doc.moveDown();
  doc.fontSize(12).fillColor('#1E3A5F').text(`ALARMS (${alarms.length})`, { underline: true });
  doc.moveDown(0.5);
  if (alarms.length === 0) {
    doc.fontSize(10).fillColor('#666').text('No alarms recorded.');
  } else {
    alarms.slice(0, 20).forEach((a) => {
      doc.fontSize(9).fillColor(a.severity === 'critical' ? 'red' : 'orange')
        .text(`[${format(new Date(a.triggered_at), 'HH:mm')}] ${a.severity.toUpperCase()} – ${a.message}`);
    });
  }

  doc.end();
  return Buffer.concat(chunks);
}

module.exports = { fetchDailySummary, fetchReadingsRange, fetchAlarmRange, buildDailyExcel, buildMonthlyExcel, buildDailyPDF };

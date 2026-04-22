require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { format, subDays } = require('date-fns');
const db = require('../src/config/database');

async function seed() {
  console.log('🌱 Seeding database...');

  // ── Users ────────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const opHash    = await bcrypt.hash('Operator@123', 12);
  const viewHash  = await bcrypt.hash('Viewer@123', 12);

  await db.query(`
    INSERT INTO users (name, email, password_hash, role_id) VALUES
      ('System Admin',     'admin@hydropower.local',    $1, 1),
      ('Plant Operator',   'operator@hydropower.local', $2, 2),
      ('Shift Viewer',     'viewer@hydropower.local',   $3, 3)
    ON CONFLICT (email) DO NOTHING
  `, [adminHash, opHash, viewHash]);
  console.log('  ✓ Users created');

  // ── Seed 30 days of daily summaries ──────────────────────────────────────────
  const summaryValues = [];
  for (let i = 30; i >= 1; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const gen  = (3000 + Math.random() * 1500).toFixed(2);
    const freq = (49.95 + Math.random() * 0.1).toFixed(3);
    const volt = (408 + Math.random() * 6).toFixed(2);
    const pf   = (0.88 + Math.random() * 0.08).toFixed(4);
    const wl   = (8 + Math.random() * 2).toFixed(3);
    const down = Math.floor(Math.random() * 20);
    summaryValues.push(`(1, '${date}', ${(parseFloat(gen) * 24).toFixed(2)}, ${gen}, ${(parseFloat(gen) * 0.8).toFixed(2)}, ${(parseFloat(gen) * 0.4).toFixed(2)}, ${freq}, ${(parseFloat(freq) - 0.05).toFixed(3)}, ${(parseFloat(freq) + 0.05).toFixed(3)}, ${volt}, ${(parseFloat(volt) - 10).toFixed(2)}, ${(parseFloat(volt) + 10).toFixed(2)}, ${pf}, ${wl}, ${(parseFloat(wl) - 0.5).toFixed(3)}, ${down}, ${Math.floor(Math.random() * 5)})`);
  }

  await db.query(`
    INSERT INTO daily_generation_summary
      (plant_id, date, total_generation_kwh, peak_load_kw, avg_load_kw, min_load_kw,
       avg_frequency, min_frequency, max_frequency, avg_voltage_ry, min_voltage, max_voltage,
       avg_power_factor, avg_water_level, min_water_level, downtime_minutes, alarm_count)
    VALUES ${summaryValues.join(',')}
    ON CONFLICT (plant_id, date) DO NOTHING
  `);
  console.log('  ✓ 30 days of daily summaries seeded');

  // ── Sample alarms ─────────────────────────────────────────────────────────────
  await db.query(`
    INSERT INTO alarms (tag_name, alarm_type, severity, status, message, value, threshold, triggered_at, resolved_at)
    VALUES
      ('Generator.Frequency', 'LOW_WARNING',  'warning',  'resolved', 'Frequency LOW WARNING: 49.3 Hz (threshold: 49.5)',  49.3, 49.5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '15 minutes'),
      ('Generator.Voltage_RY','HIGH_WARNING',  'warning',  'resolved', 'Voltage RY HIGH WARNING: 428 V (threshold: 425)',   428,  425,  NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '8 minutes'),
      ('Plant.WaterLevel',    'LOW_CRITICAL',  'critical', 'resolved', 'Water Level LOW CRITICAL: 4.8 m (threshold: 5.0)', 4.8,  5.0,  NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' + INTERVAL '45 minutes'),
      ('Generator.Temperature','HIGH_WARNING', 'warning',  'resolved', 'Temperature HIGH WARNING: 82°C (threshold: 80)',   82,   80,   NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day'  + INTERVAL '30 minutes')
    ON CONFLICT DO NOTHING
  `);
  console.log('  ✓ Sample alarms seeded');

  console.log('\n✅ Seed complete!');
  console.log('\nDefault credentials:');
  console.log('  Admin:    admin@hydropower.local    / Admin@123');
  console.log('  Operator: operator@hydropower.local / Operator@123');
  console.log('  Viewer:   viewer@hydropower.local   / Viewer@123');

  process.exit(0);
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });

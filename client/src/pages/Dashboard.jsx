import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readingsApi } from '../services/api';
import { useLiveData } from '../hooks/useSocket';
import KPICard from '../components/Dashboard/KPICard';
import LiveChart from '../components/Dashboard/LiveChart';
import AlarmPanel from '../components/Dashboard/AlarmPanel';
import GenerationChart from '../components/Dashboard/GenerationChart';
import { subDays, format } from 'date-fns';

const CHART_TAGS = [
  { tagName: 'Generator.Power',       label: 'Active Power',     unit: 'kW',  color: 'blue',  warnHigh: 5000, warnLow: 500 },
  { tagName: 'Generator.Frequency',   label: 'Frequency',        unit: 'Hz',  color: 'green', warnHigh: 50.5, warnLow: 49.5 },
  { tagName: 'Generator.Voltage_RY',  label: 'Voltage R-Y',      unit: 'V',   color: 'amber', warnHigh: 425, warnLow: 395 },
  { tagName: 'Generator.Current_R',   label: 'Current Phase R',  unit: 'A',   color: 'cyan',  warnHigh: 700 },
  { tagName: 'Plant.WaterLevel',      label: 'Water Level',      unit: 'm',   color: 'purple', warnLow: 6 },
  { tagName: 'Generator.Temperature', label: 'Gen Temperature',  unit: '°C',  color: 'red',   warnHigh: 80 },
];

function kpiStatus(value, warnLow, warnHigh, alarmLow, alarmHigh) {
  if (value === null || value === undefined) return 'default';
  if ((alarmHigh && value > alarmHigh) || (alarmLow && value < alarmLow)) return 'critical';
  if ((warnHigh  && value > warnHigh)  || (warnLow  && value < warnLow))  return 'warning';
  return 'ok';
}

export default function Dashboard() {
  const [liveMap, setLiveMap] = useState({});
  const historyRef = useRef({});

  // Initial REST fetch for live data
  const { data: initialLive } = useQuery({
    queryKey: ['live-readings'],
    queryFn: () => readingsApi.live().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  // 30-day summaries for trend chart
  const { data: summaries } = useQuery({
    queryKey: ['summaries-30d'],
    queryFn: () =>
      readingsApi.summaries({
        from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd'),
      }).then((r) => r.data.data),
  });

  const handleLiveData = useCallback(({ data }) => {
    setLiveMap((prev) => ({ ...prev, ...data }));
    // Append to rolling history
    Object.entries(data).forEach(([tag, d]) => {
      if (!historyRef.current[tag]) historyRef.current[tag] = [];
      historyRef.current[tag].push({ value: d.value, timestamp: d.ts });
      if (historyRef.current[tag].length > 60) historyRef.current[tag].shift();
    });
  }, []);

  useLiveData(handleLiveData);

  const live = { ...(initialLive || {}), ...liveMap };

  const get = (tagName) => live[tagName]?.value ?? null;

  const power   = get('Generator.Power');
  const freq    = get('Generator.Frequency');
  const voltRY  = get('Generator.Voltage_RY');
  const voltYB  = get('Generator.Voltage_YB');
  const voltBR  = get('Generator.Voltage_BR');
  const currR   = get('Generator.Current_R');
  const currY   = get('Generator.Current_Y');
  const currB   = get('Generator.Current_B');
  const pf      = get('Generator.PowerFactor');
  const kvar    = get('Generator.kVAR');
  const energy  = get('Plant.TotalEnergy');
  const wlevel  = get('Plant.WaterLevel');
  const turbRPM = get('Turbine.Speed');
  const genTemp = get('Generator.Temperature');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Plant Dashboard</h1>
          <p className="text-sm text-slate-400">Hydro Plant Alpha — Live Monitoring</p>
        </div>
        <span className="text-xs text-slate-500">{new Date().toLocaleString('en-IN')}</span>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <KPICard label="Active Power"   value={power?.toFixed(1)}    unit="kW"   icon="⚡" status={kpiStatus(power, 500, 5000, 100, 5500)} />
        <KPICard label="Frequency"      value={freq?.toFixed(3)}     unit="Hz"   icon="〰️" status={kpiStatus(freq, 49.5, 50.5, 49.0, 51.0)} />
        <KPICard label="Voltage R-Y"    value={voltRY?.toFixed(1)}   unit="V"    icon="🔋" status={kpiStatus(voltRY, 395, 425, 380, 440)} />
        <KPICard label="Power Factor"   value={pf?.toFixed(3)}       unit=""     icon="📐" status={kpiStatus(pf, 0.8, null, 0.7, null)} />
        <KPICard label="Water Level"    value={wlevel?.toFixed(2)}   unit="m"    icon="💧" status={kpiStatus(wlevel, 6.0, null, 5.0, null)} />
        <KPICard label="Turbine Speed"  value={turbRPM?.toFixed(0)}  unit="RPM"  icon="🔄" status={kpiStatus(turbRPM, 250, 550, 200, 600)} />
        <KPICard label="Gen Temperature" value={genTemp?.toFixed(1)} unit="°C"   icon="🌡️" status={kpiStatus(genTemp, null, 80, null, 90)} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Voltage Y-B"   value={voltYB?.toFixed(1)}   unit="V"   status={kpiStatus(voltYB, 395, 425, 380, 440)} />
        <KPICard label="Voltage B-R"   value={voltBR?.toFixed(1)}   unit="V"   status={kpiStatus(voltBR, 395, 425, 380, 440)} />
        <KPICard label="Current R"     value={currR?.toFixed(1)}    unit="A"   status={kpiStatus(currR, 50, 700, 0, 750)} />
        <KPICard label="Current Y"     value={currY?.toFixed(1)}    unit="A"   status={kpiStatus(currY, 50, 700, 0, 750)} />
        <KPICard label="Current B"     value={currB?.toFixed(1)}    unit="A"   status={kpiStatus(currB, 50, 700, 0, 750)} />
        <KPICard label="kVAR"          value={kvar?.toFixed(1)}     unit="kVAR" />
      </div>

      {/* Energy meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card col-span-1 flex flex-col justify-center items-center py-6">
          <p className="kpi-label">Total Energy (Meter)</p>
          <p className="text-4xl font-bold font-mono text-brand-400 mt-2">{energy ? Number(energy).toLocaleString('en-IN') : '—'}</p>
          <p className="text-sm text-slate-400 mt-1">kWh</p>
        </div>
        <div className="card col-span-2">
          <AlarmPanel compact />
        </div>
      </div>

      {/* Live Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CHART_TAGS.map((cfg) => (
          <LiveChart
            key={cfg.tagName}
            tagName={cfg.tagName}
            label={cfg.label}
            unit={cfg.unit}
            color={cfg.color}
            warnHigh={cfg.warnHigh}
            warnLow={cfg.warnLow}
            data={historyRef.current[cfg.tagName] || []}
          />
        ))}
      </div>

      {/* 30-day generation trend */}
      {summaries && (
        <GenerationChart data={summaries} title="30-Day Generation Trend" />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../services/api';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import GenerationChart from '../components/Dashboard/GenerationChart';
import type { DailyGenerationSummary } from '../types';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type TabType = 'daily' | 'monthly';

export default function Reports() {
  const [tab, setTab]               = useState<TabType>('daily');
  const [selectedDate, setSelectedDate]   = useState<string>(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedYear, setSelectedYear]   = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [downloading, setDownloading]     = useState<string | null>(null);

  const { data: dailyData } = useQuery<DailyGenerationSummary>({
    queryKey: ['report-daily', selectedDate],
    queryFn:  () => reportsApi.daily({ date: selectedDate }).then((r) => r.data.data),
  });

  const { data: monthlyData } = useQuery<DailyGenerationSummary[]>({
    queryKey: ['report-monthly', selectedYear, selectedMonth],
    queryFn:  () => reportsApi.monthly({ year: selectedYear, month: selectedMonth }).then((r) => r.data.data),
  });

  const handleDownload = async (type: string, fmt: string): Promise<void> => {
    setDownloading(`${type}-${fmt}`);
    try {
      if (type === 'daily') {
        const resp = await reportsApi.downloadDaily(selectedDate, fmt);
        const ext  = fmt === 'pdf' ? 'pdf' : 'xlsx';
        downloadBlob(new Blob([resp.data]), `daily_report_${selectedDate}.${ext}`);
      } else {
        const resp = await reportsApi.downloadMonthly(selectedYear, selectedMonth, fmt);
        downloadBlob(new Blob([resp.data]), `monthly_report_${selectedYear}_${selectedMonth}.xlsx`);
      }
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Reports</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-hydro-border pb-3">
        {(['daily', 'monthly'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t} Report
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                className="input w-48"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload('daily', 'excel')}
                disabled={!!downloading}
                className="btn-primary text-sm"
              >
                {downloading === 'daily-excel' ? 'Downloading...' : '⬇ Excel'}
              </button>
              <button
                onClick={() => handleDownload('daily', 'pdf')}
                disabled={!!downloading}
                className="btn-ghost text-sm"
              >
                {downloading === 'daily-pdf' ? 'Downloading...' : '⬇ PDF'}
              </button>
            </div>
          </div>

          {dailyData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Generation', value: dailyData.total_generation_kwh, unit: 'kWh' },
                { label: 'Peak Load',        value: dailyData.peak_load_kw,         unit: 'kW'  },
                { label: 'Avg Frequency',    value: dailyData.avg_frequency,        unit: 'Hz'  },
                { label: 'Avg Voltage R-Y',  value: dailyData.avg_voltage_ry,       unit: 'V'   },
                { label: 'Avg Power Factor', value: dailyData.avg_power_factor,     unit: ''    },
                { label: 'Min Water Level',  value: dailyData.min_water_level,      unit: 'm'   },
                { label: 'Downtime',         value: dailyData.downtime_minutes,     unit: 'min' },
                { label: 'Total Alarms',     value: dailyData.alarm_count,          unit: ''    },
              ].map((item) => (
                <div key={item.label} className="card text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-2xl font-bold font-mono text-white mt-2">
                    {item.value != null
                      ? Number(item.value).toFixed(item.unit === 'kWh' ? 0 : 2)
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{item.unit}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center text-slate-400 py-12">No data for selected date</div>
          )}
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Year</label>
              <select
                value={selectedYear}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedYear(+e.target.value)}
                className="input w-28"
              >
                {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Month</label>
              <select
                value={selectedMonth}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(+e.target.value)}
                className="input w-32"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <button
              onClick={() => handleDownload('monthly', 'excel')}
              disabled={!!downloading}
              className="btn-primary text-sm"
            >
              {downloading === 'monthly-excel' ? 'Downloading...' : '⬇ Excel'}
            </button>
          </div>

          {monthlyData != null && monthlyData.length > 0 ? (
            <>
              <GenerationChart
                data={monthlyData}
                title={`Monthly Generation — ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
              />
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hydro-border text-xs text-slate-400 uppercase tracking-wider">
                        {['Date','Generation (kWh)','Peak kW','Avg Freq','Avg V','Avg PF','Downtime','Alarms'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((row) => (
                        <tr key={row.date} className="table-row text-xs">
                          <td className="px-4 py-2 font-mono">{format(new Date(row.date), 'dd MMM')}</td>
                          <td className="px-4 py-2 font-mono text-blue-400">{Number(row.total_generation_kwh).toFixed(0)}</td>
                          <td className="px-4 py-2 font-mono">{Number(row.peak_load_kw).toFixed(0)}</td>
                          <td className="px-4 py-2 font-mono">{Number(row.avg_frequency).toFixed(3)}</td>
                          <td className="px-4 py-2 font-mono">{Number(row.avg_voltage_ry).toFixed(1)}</td>
                          <td className="px-4 py-2 font-mono">{Number(row.avg_power_factor).toFixed(3)}</td>
                          <td className="px-4 py-2 font-mono">{row.downtime_minutes}</td>
                          <td className="px-4 py-2 font-mono">{row.alarm_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center text-slate-400 py-12">No data for selected period</div>
          )}
        </div>
      )}
    </div>
  );
}

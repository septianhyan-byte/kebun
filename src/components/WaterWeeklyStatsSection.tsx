import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart2, ShieldCheck } from 'lucide-react';
import { WaterLogEntry } from '../types';
import { computeWeeklyWaterStats, WeeklyWaterStat } from '../utils/waterWeeklyStats';

interface WaterWeeklyStatsSectionProps {
  logs: WaterLogEntry[];
  targetPpmMin: number;
  targetPpmMax: number;
  targetPhMin: number;
  targetPhMax: number;
}

function fmtSigned(val: number, decimals = 0): string {
  const rounded = Number(val.toFixed(decimals));
  if (Math.abs(rounded) === 0) return decimals > 0 ? (0).toFixed(decimals) : '0';
  const sign = rounded > 0 ? '+' : '-';
  return `${sign}${Math.abs(rounded).toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export const WaterWeeklyStatsSection: React.FC<WaterWeeklyStatsSectionProps> = ({
  logs,
  targetPpmMin,
  targetPpmMax,
  targetPhMin,
  targetPhMax,
}) => {
  const [windowMode, setWindowMode] = useState<'4' | '8' | 'all'>('8');
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);

  const allWeeks = useMemo(
    () =>
      computeWeeklyWaterStats(
        logs,
        targetPpmMin,
        targetPpmMax,
        targetPhMin,
        targetPhMax
      ),
    [logs, targetPpmMin, targetPpmMax, targetPhMin, targetPhMax]
  );

  const visibleWeeks = useMemo(() => {
    if (windowMode === 'all') return allWeeks;
    const limit = Number(windowMode);
    return allWeeks.slice(-limit);
  }, [allWeeks, windowMode]);

  const latestWeek = allWeeks[allWeeks.length - 1] || null;
  const activeHoverWeek =
    hoveredWeekIdx !== null && visibleWeeks[hoveredWeekIdx]
      ? visibleWeeks[hoveredWeekIdx]
      : null;

  const overallAvgDeltaPpm = useMemo(() => {
    if (allWeeks.length === 0) return 0;
    return allWeeks.reduce((acc, w) => acc + w.avgDeltaPpm, 0) / allWeeks.length;
  }, [allWeeks]);

  const overallAvgDeltaPh = useMemo(() => {
    if (allWeeks.length === 0) return 0;
    return allWeeks.reduce((acc, w) => acc + w.avgDeltaPh, 0) / allWeeks.length;
  }, [allWeeks]);

  const stabilityMeta = useMemo(() => {
    if (!latestWeek) {
      return {
        label: 'Belum Ada Data',
        colorClass: '',
        badgeBg: 'var(--app-surface-muted)',
        badgeColor: 'var(--app-text-muted)',
      };
    }
    if (latestWeek.inTargetPct >= 80) {
      return {
        label: 'Stabil Optimal',
        colorClass: 'text-emerald-700 dark:text-emerald-400',
        badgeBg: 'rgba(22, 163, 74, 0.14)',
        badgeColor: '#15803D',
      };
    }
    if (latestWeek.inTargetPct >= 50) {
      return {
        label: 'Cukup Stabil',
        colorClass: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'rgba(217, 119, 6, 0.14)',
        badgeColor: '#B45309',
      };
    }
    return {
      label: 'Perlu Penyesuaian',
      colorClass: 'text-rose-700 dark:text-rose-400',
      badgeBg: 'rgba(225, 29, 72, 0.14)',
      badgeColor: '#BE123C',
    };
  }, [latestWeek]);

  return (
    <section
      className="rounded-xl border p-5 space-y-4"
      style={{
        backgroundColor: 'var(--app-surface)',
        borderColor: 'var(--app-border)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5"
            style={{
              backgroundColor: 'var(--app-accent-soft)',
              color: 'var(--app-accent)',
            }}
          >
            <BarChart2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">
              Statistik Mingguan: Rata-Rata Kenaikan PPM &amp; pH
            </h3>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
              Pantau rata-rata perubahan PPM &amp; pH per pemeriksaan serta tren mingguan untuk menjaga stabilitas nutrisi.
            </p>
          </div>
        </div>

        <div
          className="inline-flex items-center gap-1 rounded-lg p-1 self-start sm:self-auto"
          style={{ backgroundColor: 'var(--app-surface-muted)' }}
        >
          {(
            [
              { id: '4', label: '4 Minggu' },
              { id: '8', label: '8 Minggu' },
              { id: 'all', label: `Semua (${allWeeks.length})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setWindowMode(opt.id);
                setHoveredWeekIdx(null);
              }}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: windowMode === opt.id ? 'var(--app-surface)' : 'transparent',
                color: windowMode === opt.id ? 'var(--app-accent)' : 'var(--app-text-muted)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!latestWeek ? (
        <div
          className="rounded-lg border border-dashed py-8 text-center text-xs"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
        >
          Belum ada data log air untuk dihitung statistik mingguannya. Catat pengukuran PPM &amp; pH terlebih dahulu.
        </div>
      ) : (
        <>
          {/* 4 Summary KPI Tiles */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Rata² Kenaikan PPM (M{latestWeek.weekIndex})
              </div>
              <div className="mt-1 flex items-center gap-1 text-base font-bold font-mono-tabular">
                <span>{fmtSigned(latestWeek.avgDeltaPpm, 0)} ppm</span>
                {latestWeek.avgDeltaPpm >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
              <div className="mt-0.5 text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                Rata² semua minggu: {fmtSigned(overallAvgDeltaPpm, 0)} ppm/cek
              </div>
            </div>

            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Rata² Kenaikan pH (M{latestWeek.weekIndex})
              </div>
              <div className="mt-1 flex items-center gap-1 text-base font-bold font-mono-tabular">
                <span>{fmtSigned(latestWeek.avgDeltaPh, 2)} pH</span>
                {latestWeek.avgDeltaPh >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-sky-600" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
              <div className="mt-0.5 text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                Rata² semua minggu: {fmtSigned(overallAvgDeltaPh, 2)}/cek
              </div>
            </div>

            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Rata² PPM Akhir (M{latestWeek.weekIndex})
              </div>
              <div className="mt-1 text-base font-bold font-mono-tabular">
                {Math.round(latestWeek.avgPpm).toLocaleString('id-ID')} ppm
              </div>
              <div className="mt-0.5 text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                {latestWeek.wowPpmDiff !== null
                  ? `${fmtSigned(latestWeek.wowPpmDiff, 0)} ppm vs M${latestWeek.weekIndex - 1}`
                  : `pH rata² ${latestWeek.avgPh.toFixed(2)}`}
              </div>
            </div>

            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                <span>Stabilitas Nutrisi</span>
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
              </div>
              <div className="mt-1 text-base font-bold font-mono-tabular">
                {Math.round(latestWeek.inTargetPct)}% sesuai
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: stabilityMeta.badgeBg,
                    color: stabilityMeta.badgeColor,
                  }}
                >
                  {stabilityMeta.label}
                </span>
                <span className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  ({latestWeek.inTargetCount}/{latestWeek.count} cek)
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Hover Readout */}
          {activeHoverWeek && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-mono-tabular"
              style={{
                borderColor: 'var(--app-accent)',
                backgroundColor: 'var(--app-accent-soft)',
              }}
            >
              <span className="font-semibold">
                Minggu {activeHoverWeek.weekIndex} ({activeHoverWeek.weekLabel}
                {activeHoverWeek.hstRangeLabel ? ` · ${activeHoverWeek.hstRangeLabel}` : ''})
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  PPM: {Math.round(activeHoverWeek.avgPpmBefore)} →{' '}
                  <strong>{Math.round(activeHoverWeek.avgPpm)}</strong> (
                  <strong>{fmtSigned(activeHoverWeek.avgDeltaPpm, 0)} ppm</strong>/cek)
                </span>
                <span>
                  pH: {activeHoverWeek.avgPhBefore.toFixed(2)} →{' '}
                  <strong>{activeHoverWeek.avgPh.toFixed(2)}</strong> (
                  <strong>{fmtSigned(activeHoverWeek.avgDeltaPh, 2)}</strong>/cek)
                </span>
                <span>
                  Stabilitas: <strong>{Math.round(activeHoverWeek.inTargetPct)}%</strong>
                </span>
              </div>
            </div>
          )}

          {/* Dual Weekly Delta Bar Charts */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <WeeklyDeltaBarChart
              title="Rata-Rata Kenaikan PPM per Minggu"
              subtitle="Selisih rata-rata (PPM Akhir − PPM Awal) tiap minggu"
              unit="ppm"
              weeks={visibleWeeks}
              getValue={(w) => w.avgDeltaPpm}
              positiveColor="var(--app-accent)"
              negativeColor="#D97706"
              decimals={0}
              hoverIdx={hoveredWeekIdx}
              onHover={setHoveredWeekIdx}
            />
            <WeeklyDeltaBarChart
              title="Rata-Rata Kenaikan / Perubahan pH per Minggu"
              subtitle="Selisih rata-rata (pH Akhir − pH Awal) tiap minggu"
              unit="pH"
              weeks={visibleWeeks}
              getValue={(w) => w.avgDeltaPh}
              positiveColor="#0284C7"
              negativeColor="#D97706"
              decimals={2}
              hoverIdx={hoveredWeekIdx}
              onHover={setHoveredWeekIdx}
            />
          </div>

          {/* Mobile Weekly Cards (<768px) */}
          <div className="space-y-2 md:hidden">
            {[...visibleWeeks].reverse().map((w) => (
              <div
                key={w.weekKey}
                className="rounded-lg border p-3 space-y-2 text-xs"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">Minggu {w.weekIndex}</span>{' '}
                    <span className="font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                      ({w.weekLabel})
                    </span>
                    {w.hstRangeLabel && (
                      <span
                        className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono-tabular"
                        style={{
                          backgroundColor: 'var(--app-accent-soft)',
                          color: 'var(--app-accent)',
                        }}
                      >
                        {w.hstRangeLabel}
                      </span>
                    )}
                  </div>
                  <span className="font-mono-tabular text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    {w.count}x cek · {Math.round(w.inTargetPct)}% stabil
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono-tabular">
                  <div
                    className="rounded border px-2.5 py-1.5"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                      Kenaikan PPM / Cek
                    </div>
                    <div className="font-bold" style={{ color: 'var(--app-accent)' }}>
                      {fmtSigned(w.avgDeltaPpm, 0)} ppm
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                      Rata²: {Math.round(w.avgPpmBefore)} → {Math.round(w.avgPpm)}
                    </div>
                  </div>
                  <div
                    className="rounded border px-2.5 py-1.5"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                      Perubahan pH / Cek
                    </div>
                    <div className="font-bold text-sky-600 dark:text-sky-400">
                      {fmtSigned(w.avgDeltaPh, 2)} pH
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                      Rata²: {w.avgPhBefore.toFixed(2)} → {w.avgPh.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Weekly Summary Table (>=768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                >
                  <th className="py-2 pr-3 font-medium">Minggu</th>
                  <th className="py-2 px-2 font-medium text-right">Cek</th>
                  <th className="py-2 px-3 font-medium text-right">Rata² PPM (Awal → Akhir)</th>
                  <th className="py-2 px-3 font-medium text-right">Rata² Kenaikan PPM</th>
                  <th className="py-2 px-3 font-medium text-right">Rata² pH (Awal → Akhir)</th>
                  <th className="py-2 px-3 font-medium text-right">Rata² Kenaikan pH</th>
                  <th className="py-2 pl-3 font-medium text-right">Stabilitas Target</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                {[...visibleWeeks].reverse().map((w) => {
                  const visiblePos = visibleWeeks.findIndex((x) => x.weekKey === w.weekKey);
                  const isHighlighted = hoveredWeekIdx === visiblePos;
                  return (
                    <tr
                      key={w.weekKey}
                      onMouseEnter={() => setHoveredWeekIdx(visiblePos)}
                      onMouseLeave={() => setHoveredWeekIdx(null)}
                      style={{
                        backgroundColor: isHighlighted ? 'var(--app-accent-soft)' : 'transparent',
                      }}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <div className="font-semibold">
                          Minggu {w.weekIndex}{' '}
                          <span className="font-normal font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                            ({w.weekLabel})
                          </span>
                        </div>
                        {w.hstRangeLabel && (
                          <div className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-accent)' }}>
                            Usia: {w.hstRangeLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono-tabular">{w.count}x</td>
                      <td className="py-2 px-3 text-right font-mono-tabular whitespace-nowrap">
                        <span style={{ color: 'var(--app-text-muted)' }}>
                          {Math.round(w.avgPpmBefore)} →{' '}
                        </span>
                        <span className="font-semibold">{Math.round(w.avgPpm)}</span>
                        {w.wowPpmDiff !== null && (
                          <span
                            className="ml-1.5 text-[10px]"
                            style={{ color: 'var(--app-text-muted)' }}
                          >
                            ({fmtSigned(w.wowPpmDiff, 0)})
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-bold whitespace-nowrap">
                        <span
                          className={
                            w.avgDeltaPpm >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {fmtSigned(w.avgDeltaPpm, 0)} ppm
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular whitespace-nowrap">
                        <span style={{ color: 'var(--app-text-muted)' }}>
                          {w.avgPhBefore.toFixed(2)} →{' '}
                        </span>
                        <span className="font-semibold">{w.avgPh.toFixed(2)}</span>
                        {w.wowPhDiff !== null && (
                          <span
                            className="ml-1.5 text-[10px]"
                            style={{ color: 'var(--app-text-muted)' }}
                          >
                            ({fmtSigned(w.wowPhDiff, 2)})
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-bold whitespace-nowrap">
                        <span
                          className={
                            w.avgDeltaPh >= 0
                              ? 'text-sky-600 dark:text-sky-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {fmtSigned(w.avgDeltaPh, 2)} pH
                        </span>
                      </td>
                      <td className="py-2 pl-3 text-right font-mono-tabular whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Activity className="h-3 w-3" style={{ color: 'var(--app-accent)' }} />
                          {Math.round(w.inTargetPct)}%
                        </span>
                        <span className="ml-1 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          ({w.inTargetCount}/{w.count})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

interface WeeklyDeltaBarChartProps {
  title: string;
  subtitle: string;
  unit: string;
  weeks: WeeklyWaterStat[];
  getValue: (w: WeeklyWaterStat) => number;
  positiveColor: string;
  negativeColor: string;
  decimals: number;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
}

const WeeklyDeltaBarChart: React.FC<WeeklyDeltaBarChartProps> = ({
  title,
  subtitle,
  unit,
  weeks,
  getValue,
  positiveColor,
  negativeColor,
  decimals,
  hoverIdx,
  onHover,
}) => {
  const width = 340;
  const height = 165;
  const padX = 28;
  const padTop = 22;
  const padBottom = 24;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const vals = weeks.map(getValue);
  const maxPos = Math.max(0, ...vals);
  const minNeg = Math.min(0, ...vals);
  const rawSpan = maxPos - minNeg;
  const fallbackSpan = decimals > 0 ? 0.5 : 50;
  const effectiveMax = rawSpan === 0 ? fallbackSpan : maxPos === 0 ? fallbackSpan * 0.25 : maxPos * 1.15;
  const effectiveMin = rawSpan === 0 ? -fallbackSpan * 0.25 : minNeg === 0 ? 0 : minNeg * 1.15;
  const span = Math.max(0.01, effectiveMax - effectiveMin);

  const toY = (v: number) => padTop + ((effectiveMax - v) / span) * innerH;
  const zeroY = toY(0);
  const slotW = innerW / Math.max(1, weeks.length);
  const barW = Math.min(34, Math.max(10, slotW * 0.56));

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-canvas)',
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{title}</span>
        <span className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
          {unit}/cek
        </span>
      </div>
      <div className="mb-2 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
        {subtitle}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 overflow-visible"
        onMouseLeave={() => onHover(null)}
      >
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={padX + innerW}
          y2={zeroY}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="3 3"
        />
        <text
          x={padX - 4}
          y={zeroY + 3}
          textAnchor="end"
          fontSize="9"
          fill="currentColor"
          opacity={0.55}
        >
          0
        </text>
        <text
          x={padX - 4}
          y={padTop + 4}
          textAnchor="end"
          fontSize="9"
          fill="currentColor"
          opacity={0.55}
        >
          {effectiveMax.toFixed(decimals)}
        </text>

        {weeks.map((w, i) => {
          const val = vals[i];
          const cx = padX + slotW * i + slotW / 2;
          const x = cx - barW / 2;
          const yVal = toY(val);
          const barY = val >= 0 ? yVal : zeroY;
          const barH = Math.max(2, Math.abs(yVal - zeroY));
          const isHover = hoverIdx === i;
          const fill = val >= 0 ? positiveColor : negativeColor;
          const labelY = val >= 0 ? barY - 4 : barY + barH + 10;

          return (
            <g
              key={w.weekKey}
              className="cursor-pointer"
              onMouseEnter={() => onHover(i)}
              onClick={() => onHover(hoverIdx === i ? null : i)}
            >
              <rect
                x={padX + slotW * i}
                y={padTop - 4}
                width={slotW}
                height={innerH + padBottom}
                fill="transparent"
              />
              <rect
                x={x}
                y={barY}
                width={barW}
                height={barH}
                rx={4}
                fill={fill}
                fillOpacity={isHover ? 1 : 0.82}
                stroke={isHover ? 'var(--app-text)' : 'none'}
                strokeWidth={isHover ? 1.5 : 0}
              />
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight={isHover ? '700' : '600'}
                fill="currentColor"
                opacity={isHover ? 1 : 0.78}
              >
                {fmtSigned(val, decimals)}
              </text>
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                fontSize="9"
                fontWeight={isHover ? '700' : '500'}
                fill="currentColor"
                opacity={isHover ? 1 : 0.65}
              >
                M{w.weekIndex}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

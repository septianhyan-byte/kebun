import { WaterLogEntry } from '../types';

export interface WeeklyWaterStat {
  weekKey: string;
  weekIndex: number;
  weekLabel: string;
  hstRangeLabel: string | null;
  count: number;
  avgPpmBefore: number;
  avgPpm: number;
  avgDeltaPpm: number;
  wowPpmDiff: number | null;
  minPpm: number;
  maxPpm: number;
  avgPhBefore: number;
  avgPh: number;
  avgDeltaPh: number;
  wowPhDiff: number | null;
  minPh: number;
  maxPh: number;
  totalWaterLiters: number;
  totalNutrientLiters: number;
  inTargetCount: number;
  inTargetPct: number;
}

const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekRangeLabel(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const d1 = monday.getDate();
  const m1 = MONTH_SHORT_ID[monday.getMonth()];
  const d2 = sunday.getDate();
  const m2 = MONTH_SHORT_ID[sunday.getMonth()];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${d1}–${d2} ${m1}`;
  }
  return `${d1} ${m1}–${d2} ${m2}`;
}

export function computeWeeklyWaterStats(
  logs: WaterLogEntry[],
  targetPpmMin: number,
  targetPpmMax: number,
  targetPhMin: number,
  targetPhMax: number
): WeeklyWaterStat[] {
  if (!logs || logs.length === 0) return [];

  const buckets = new Map<
    string,
    {
      monday: Date;
      logs: WaterLogEntry[];
    }
  >();

  for (const log of logs) {
    const d = new Date(log.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const dow = d.getDay(); // 0 = Sun, 1 = Mon...
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetToMon);
    const weekKey = formatYmd(monday);
    let bucket = buckets.get(weekKey);
    if (!bucket) {
      bucket = { monday, logs: [] };
      buckets.set(weekKey, bucket);
    }
    bucket.logs.push(log);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  const results: WeeklyWaterStat[] = [];

  for (let idx = 0; idx < sortedKeys.length; idx++) {
    const key = sortedKeys[idx];
    const bucket = buckets.get(key)!;
    const items = bucket.logs;
    const n = items.length;

    let sumPpmBefore = 0;
    let sumPpm = 0;
    let sumDeltaPpm = 0;
    let minPpm = Infinity;
    let maxPpm = -Infinity;

    let sumPhBefore = 0;
    let sumPh = 0;
    let sumDeltaPh = 0;
    let minPh = Infinity;
    let maxPh = -Infinity;

    let totalWaterLiters = 0;
    let totalNutrientLiters = 0;
    let inTargetCount = 0;
    let hstMin = Infinity;
    let hstMax = -Infinity;

    for (const l of items) {
      const ppmEnd = Number(l.ppm) || 0;
      const ppmStart = typeof l.ppmBefore === 'number' ? l.ppmBefore : ppmEnd;
      sumPpmBefore += ppmStart;
      sumPpm += ppmEnd;
      sumDeltaPpm += ppmEnd - ppmStart;
      if (ppmEnd < minPpm) minPpm = ppmEnd;
      if (ppmEnd > maxPpm) maxPpm = ppmEnd;

      const phEnd = Number(l.ph) || 0;
      const phStart = typeof l.phBefore === 'number' ? l.phBefore : phEnd;
      sumPhBefore += phStart;
      sumPh += phEnd;
      sumDeltaPh += phEnd - phStart;
      if (phEnd < minPh) minPh = phEnd;
      if (phEnd > maxPh) maxPh = phEnd;

      totalWaterLiters += Number(l.waterAddedLiters) || 0;
      const nutL =
        typeof l.nutrientAddedLiters === 'number'
          ? l.nutrientAddedLiters
          : l.abMixAddedMl > 0
          ? l.abMixAddedMl / 1000
          : 0;
      totalNutrientLiters += nutL;

      const ppmOk = ppmEnd >= targetPpmMin && ppmEnd <= targetPpmMax;
      const phOk = phEnd >= targetPhMin && phEnd <= targetPhMax;
      if (ppmOk && phOk) inTargetCount += 1;

      if (typeof l.plantAgeHst === 'number' && l.plantAgeHst >= 1) {
        if (l.plantAgeHst < hstMin) hstMin = l.plantAgeHst;
        if (l.plantAgeHst > hstMax) hstMax = l.plantAgeHst;
      }
    }

    const avgPpm = sumPpm / n;
    const avgPh = sumPh / n;
    const prev = idx > 0 ? results[idx - 1] : null;

    const hstRangeLabel =
      hstMin <= hstMax
        ? hstMin === hstMax
          ? `${hstMin} HST`
          : `${hstMin}–${hstMax} HST`
        : null;

    results.push({
      weekKey: key,
      weekIndex: idx + 1,
      weekLabel: formatWeekRangeLabel(bucket.monday),
      hstRangeLabel,
      count: n,
      avgPpmBefore: sumPpmBefore / n,
      avgPpm,
      avgDeltaPpm: sumDeltaPpm / n,
      wowPpmDiff: prev ? avgPpm - prev.avgPpm : null,
      minPpm: minPpm === Infinity ? 0 : minPpm,
      maxPpm: maxPpm === -Infinity ? 0 : maxPpm,
      avgPhBefore: sumPhBefore / n,
      avgPh,
      avgDeltaPh: sumDeltaPh / n,
      wowPhDiff: prev ? avgPh - prev.avgPh : null,
      minPh: minPh === Infinity ? 0 : minPh,
      maxPh: maxPh === -Infinity ? 0 : maxPh,
      totalWaterLiters,
      totalNutrientLiters,
      inTargetCount,
      inTargetPct: (inTargetCount / n) * 100,
    });
  }

  return results;
}

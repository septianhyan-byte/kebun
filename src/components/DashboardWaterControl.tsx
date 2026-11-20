import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Droplets,
  Gauge,
  Plus,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Sprout,
  Thermometer,
  Trash2,
  Waves,
} from 'lucide-react';
import { GROWTH_PHASE_SPECS } from '../constants/themes';
import { GreenhouseData, GrowthPhase, NotificationSettings, WaterLogEntry } from '../types';
import {
  diffLocalCalendarDays,
  localDateTimeInputToIso,
  matchesLocalDate,
  toLocalDateInputValue,
  toLocalDateTimeInputValue,
} from '../utils/dateUtils';
import { OperatorField } from './OperatorField';
import { WaterWeeklyStatsSection } from './WaterWeeklyStatsSection';

function computeSuggestedPlantAgeHst(
  gh: GreenhouseData,
  targetDateTimeLocal: string
): number {
  const targetDateRef = targetDateTimeLocal || toLocalDateTimeInputValue();
  const latestWithHst = gh.waterLogs.find(
    (l) => typeof l.plantAgeHst === 'number' && l.plantAgeHst >= 1 && l.plantAgeHst <= 75
  );
  if (latestWithHst && typeof latestWithHst.plantAgeHst === 'number') {
    const dayDiff = diffLocalCalendarDays(latestWithHst.timestamp, targetDateRef);
    return Math.min(75, Math.max(1, latestWithHst.plantAgeHst + dayDiff));
  }
  if (gh.plantingDate) {
    const diffFromPlanting = diffLocalCalendarDays(gh.plantingDate, targetDateRef);
    return Math.min(75, Math.max(1, diffFromPlanting >= 0 ? diffFromPlanting + 1 : 1));
  }
  return 1;
}

interface DashboardWaterControlProps {
  gh: GreenhouseData;
  notifSettings: NotificationSettings;
  onUpdateGh: (updater: (gh: GreenhouseData) => GreenhouseData) => void;
}

export const DashboardWaterControl: React.FC<DashboardWaterControlProps> = ({
  gh,
  notifSettings,
  onUpdateGh,
}) => {
  const phaseSpec = GROWTH_PHASE_SPECS[gh.phase];
  const { currentWater } = gh;
  const latestLog = gh.waterLogs[0];

  const useCustomTargets = Boolean(gh.waterTargets?.useCustom);
  const effectivePpmMin = useCustomTargets
    ? Math.min(gh.waterTargets?.ppmMin ?? phaseSpec.ppmMin, gh.waterTargets?.ppmMax ?? phaseSpec.ppmMax)
    : phaseSpec.ppmMin;
  const effectivePpmMax = useCustomTargets
    ? Math.max(gh.waterTargets?.ppmMin ?? phaseSpec.ppmMin, gh.waterTargets?.ppmMax ?? phaseSpec.ppmMax)
    : phaseSpec.ppmMax;
  const effectivePhMin = useCustomTargets
    ? Math.min(gh.waterTargets?.phMin ?? phaseSpec.phMin, gh.waterTargets?.phMax ?? phaseSpec.phMax)
    : phaseSpec.phMin;
  const effectivePhMax = useCustomTargets
    ? Math.max(gh.waterTargets?.phMin ?? phaseSpec.phMin, gh.waterTargets?.phMax ?? phaseSpec.phMax)
    : phaseSpec.phMax;

  // Custom inspector PPM & pH limit editor state
  const [customPpmMinInput, setCustomPpmMinInput] = useState(String(effectivePpmMin));
  const [customPpmMaxInput, setCustomPpmMaxInput] = useState(String(effectivePpmMax));
  const [customPhMinInput, setCustomPhMinInput] = useState(effectivePhMin.toFixed(1));
  const [customPhMaxInput, setCustomPhMaxInput] = useState(effectivePhMax.toFixed(1));
  const [targetsSavedFeedback, setTargetsSavedFeedback] = useState(false);

  // Manual form state: Initial & Final PPM / pH (always start empty) + Air + Nutrisi 1-20L + KOH / Phosphoric
  const [ppmBefore, setPpmBefore] = useState('');
  const [ppmAfter, setPpmAfter] = useState('');
  const [phBefore, setPhBefore] = useState('');
  const [phAfter, setPhAfter] = useState('');
  const [waterAddedLiters, setWaterAddedLiters] = useState('0');
  const [nutrientAddedLiters, setNutrientAddedLiters] = useState('0');
  const [phChemical, setPhChemical] = useState<'none' | 'KOH' | 'Phosphoric'>('none');
  const [phAdjMl, setPhAdjMl] = useState('0');
  const [manualTemp, setManualTemp] = useState(String(currentWater.tempC));
  const [manualFlow, setManualFlow] = useState(String(currentWater.flowLpm));
  const [manualReservoir, setManualReservoir] = useState(String(currentWater.reservoirPct));
  const [manualOperator, setManualOperator] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [inspectionDateTime, setInspectionDateTime] = useState(() => toLocalDateTimeInputValue());
  const [plantAgeHst, setPlantAgeHst] = useState<number>(() =>
    computeSuggestedPlantAgeHst(gh, toLocalDateTimeInputValue())
  );
  const [hstManualOverride, setHstManualOverride] = useState(false);

  // Quick-jump focus & highlight from KPI result cards
  const [highlightedTarget, setHighlightedTarget] = useState<
    'ppm' | 'ph' | 'temp' | 'reservoir' | null
  >(null);
  const highlightTimerRef = useRef<number | null>(null);
  const ppmBoxRef = useRef<HTMLDivElement | null>(null);
  const ppmInputRef = useRef<HTMLInputElement | null>(null);
  const phBoxRef = useRef<HTMLDivElement | null>(null);
  const phInputRef = useRef<HTMLInputElement | null>(null);
  const tempBoxRef = useRef<HTMLDivElement | null>(null);
  const tempInputRef = useRef<HTMLInputElement | null>(null);
  const reservoirBoxRef = useRef<HTMLDivElement | null>(null);
  const reservoirInputRef = useRef<HTMLInputElement | null>(null);

  const jumpToTarget = (target: 'ppm' | 'ph' | 'temp' | 'reservoir') => {
    setHighlightedTarget(target);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedTarget(null);
      highlightTimerRef.current = null;
    }, 2400);

    const box =
      target === 'ppm'
        ? ppmBoxRef.current
        : target === 'ph'
        ? phBoxRef.current
        : target === 'temp'
        ? tempBoxRef.current
        : reservoirBoxRef.current;
    const input =
      target === 'ppm'
        ? ppmInputRef.current
        : target === 'ph'
        ? phInputRef.current
        : target === 'temp'
        ? tempInputRef.current
        : reservoirInputRef.current;

    box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      input?.focus({ preventScroll: true });
    }, 320);
  };

  // History filter, selection & chart hover
  const [logFilter, setLogFilter] = useState<'all' | 'manual' | 'dosing'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [confirmClearAllLogs, setConfirmClearAllLogs] = useState(false);

  // Sync custom limit inputs when GH, phase, or synced waterTargets change
  useEffect(() => {
    setCustomPpmMinInput(String(effectivePpmMin));
    setCustomPpmMaxInput(String(effectivePpmMax));
    setCustomPhMinInput(effectivePhMin.toFixed(1));
    setCustomPhMaxInput(effectivePhMax.toFixed(1));
  }, [gh.id, effectivePpmMin, effectivePpmMax, effectivePhMin, effectivePhMax]);

  // Sync form defaults when switching GH (keep PPM/pH & Petugas empty)
  useEffect(() => {
    const nowInput = toLocalDateTimeInputValue();
    setPpmBefore('');
    setPpmAfter('');
    setPhBefore('');
    setPhAfter('');
    setManualTemp(String(gh.currentWater.tempC));
    setManualFlow(String(gh.currentWater.flowLpm));
    setManualReservoir(String(gh.currentWater.reservoirPct));
    setWaterAddedLiters('0');
    setNutrientAddedLiters('0');
    setPhChemical('none');
    setPhAdjMl('0');
    setManualOperator('');
    setInspectionDateTime(nowInput);
    setPlantAgeHst(computeSuggestedPlantAgeHst(gh, nowInput));
    setHstManualOverride(false);
    setHighlightedTarget(null);
    setDateFilter('');
    setSelectedLogIds([]);
    setConfirmClearAllLogs(false);
    setTargetsSavedFeedback(false);
  }, [gh.id]);

  // Estimate reservoir percentage when water/nutrient added, without overwriting empty PPM/pH inputs
  const estimateAfterValues = (
    nextWaterL: number,
    nextNutrientL: number,
    _nextChem: 'none' | 'KOH' | 'Phosphoric',
    _nextPhMl: number
  ) => {
    if (nextWaterL <= 0 && nextNutrientL <= 0) return;
    const estRes = Math.min(
      100,
      Math.round(currentWater.reservoirPct + ((nextWaterL + nextNutrientL) / Math.max(100, gh.reservoirLiters)) * 100)
    );
    setManualReservoir(String(estRes));
  };

  const handleWaterChange = (val: string) => {
    setWaterAddedLiters(val);
    estimateAfterValues(
      Math.max(0, Number(val) || 0),
      Math.max(0, Number(nutrientAddedLiters) || 0),
      phChemical,
      Math.max(0, Number(phAdjMl) || 0)
    );
  };

  const handleNutrientChange = (val: string) => {
    setNutrientAddedLiters(val);
    estimateAfterValues(
      Math.max(0, Number(waterAddedLiters) || 0),
      Math.max(0, Number(val) || 0),
      phChemical,
      Math.max(0, Number(phAdjMl) || 0)
    );
  };

  const handlePhChemChange = (chem: 'none' | 'KOH' | 'Phosphoric') => {
    setPhChemical(chem);
    const ml = chem === 'none' ? 0 : Math.max(10, Number(phAdjMl) || 10);
    if (chem === 'none') setPhAdjMl('0');
    else if (Number(phAdjMl) === 0) setPhAdjMl('10');
    estimateAfterValues(
      Math.max(0, Number(waterAddedLiters) || 0),
      Math.max(0, Number(nutrientAddedLiters) || 0),
      chem,
      ml
    );
  };

  const handlePhMlChange = (val: string) => {
    setPhAdjMl(val);
    estimateAfterValues(
      Math.max(0, Number(waterAddedLiters) || 0),
      Math.max(0, Number(nutrientAddedLiters) || 0),
      phChemical,
      Math.max(0, Number(val) || 0)
    );
  };

  const ppmStatus = useMemo(() => {
    if (currentWater.ppm < effectivePpmMin) return { label: 'Rendah (Tambah Nutrisi)', ok: false };
    if (currentWater.ppm > effectivePpmMax) return { label: 'Tinggi (Tambah Air)', ok: false };
    return {
      label: useCustomTargets ? 'Optimal (Batas Pemeriksa)' : 'Optimal Sesuai Fase',
      ok: true,
    };
  }, [currentWater.ppm, effectivePpmMin, effectivePpmMax, useCustomTargets]);

  const phStatus = useMemo(() => {
    if (currentWater.ph < effectivePhMin) return { label: 'Terlalu Asam (Tambah KOH)', ok: false };
    if (currentWater.ph > effectivePhMax) return { label: 'Terlalu Basa (Tambah Phosphoric)', ok: false };
    return {
      label: useCustomTargets ? 'Ideal (Batas Pemeriksa)' : 'Ideal Penyerapan Akar',
      ok: true,
    };
  }, [currentWater.ph, effectivePhMin, effectivePhMax, useCustomTargets]);

  const handlePhaseChange = (phase: GrowthPhase) => {
    onUpdateGh((prev) => ({ ...prev, phase }));
  };

  const handleSetTargetMode = (custom: boolean) => {
    if (!custom) {
      onUpdateGh((prev) => ({
        ...prev,
        waterTargets: {
          useCustom: false,
          ppmMin: GROWTH_PHASE_SPECS[prev.phase].ppmMin,
          ppmMax: GROWTH_PHASE_SPECS[prev.phase].ppmMax,
          phMin: GROWTH_PHASE_SPECS[prev.phase].phMin,
          phMax: GROWTH_PHASE_SPECS[prev.phase].phMax,
        },
      }));
      setTargetsSavedFeedback(false);
    } else {
      const pMin = Math.min(5000, Math.max(0, Math.round(Number(customPpmMinInput) || phaseSpec.ppmMin)));
      const pMax = Math.min(5000, Math.max(0, Math.round(Number(customPpmMaxInput) || phaseSpec.ppmMax)));
      const hMin = Number(Math.min(14, Math.max(0, Number(customPhMinInput) || phaseSpec.phMin)).toFixed(2));
      const hMax = Number(Math.min(14, Math.max(0, Number(customPhMaxInput) || phaseSpec.phMax)).toFixed(2));
      onUpdateGh((prev) => ({
        ...prev,
        waterTargets: {
          useCustom: true,
          ppmMin: Math.min(pMin, pMax),
          ppmMax: Math.max(pMin, pMax),
          phMin: Math.min(hMin, hMax),
          phMax: Math.max(hMin, hMax),
        },
      }));
    }
  };

  const handleSaveCustomTargets = (e: React.FormEvent) => {
    e.preventDefault();
    const rawPpmMin = Math.min(5000, Math.max(0, Math.round(Number(customPpmMinInput) || 0)));
    const rawPpmMax = Math.min(5000, Math.max(0, Math.round(Number(customPpmMaxInput) || 0)));
    const rawPhMin = Number(Math.min(14, Math.max(0, Number(customPhMinInput) || 0)).toFixed(2));
    const rawPhMax = Number(Math.min(14, Math.max(0, Number(customPhMaxInput) || 0)).toFixed(2));

    const nextPpmMin = Math.min(rawPpmMin, rawPpmMax);
    const nextPpmMax = Math.max(rawPpmMin, rawPpmMax);
    const nextPhMin = Math.min(rawPhMin, rawPhMax);
    const nextPhMax = Math.max(rawPhMin, rawPhMax);

    setCustomPpmMinInput(String(nextPpmMin));
    setCustomPpmMaxInput(String(nextPpmMax));
    setCustomPhMinInput(nextPhMin.toFixed(1));
    setCustomPhMaxInput(nextPhMax.toFixed(1));

    onUpdateGh((prev) => ({
      ...prev,
      waterTargets: {
        useCustom: true,
        ppmMin: nextPpmMin,
        ppmMax: nextPpmMax,
        phMin: nextPhMin,
        phMax: nextPhMax,
      },
    }));
    setTargetsSavedFeedback(true);
    setTimeout(() => setTargetsSavedFeedback(false), 2500);
  };

  const handleEcFactorToggle = () => {
    onUpdateGh((prev) => {
      const nextFactor = prev.ecFactor === 500 ? 700 : 500;
      return {
        ...prev,
        ecFactor: nextFactor,
        currentWater: {
          ...prev.currentWater,
          ec: Number((prev.currentWater.ppm / nextFactor).toFixed(2)),
        },
      };
    });
  };

  const togglePump = (
    key: 'pumpCirculation' | 'pumpNutrientA' | 'pumpNutrientB' | 'pumpPhDown' | 'pumpPhUp'
  ) => {
    onUpdateGh((prev) => ({
      ...prev,
      currentWater: {
        ...prev.currentWater,
        [key]: !prev.currentWater[key],
      },
    }));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startPpm = Math.max(0, Math.round(Number(ppmBefore) || currentWater.ppm));
    const endPpm = Math.max(0, Math.round(Number(ppmAfter) || 0));
    const startPh = Number(Math.min(14, Math.max(0, Number(phBefore) || currentWater.ph)).toFixed(2));
    const endPh = Number(Math.min(14, Math.max(0, Number(phAfter) || 6.0)).toFixed(2));
    const waterL = Math.max(0, Number(waterAddedLiters) || 0);
    const nutrientL = Math.max(0, Number(nutrientAddedLiters) || 0);
    const phMl = phChemical === 'none' ? 0 : Math.max(0, Math.round(Number(phAdjMl) || 0));
    const phAdjType: 'none' | 'up' | 'down' =
      phChemical === 'KOH' ? 'up' : phChemical === 'Phosphoric' ? 'down' : 'none';

    const tempC = Number((Number(manualTemp) || 25).toFixed(1));
    const flowLpm = Number((Number(manualFlow) || 18).toFixed(1));
    const reservoirPct = Math.min(100, Math.max(0, Math.round(Number(manualReservoir) || 80)));
    const ec = Number((endPpm / gh.ecFactor).toFixed(2));

    const autoParts: string[] = [];
    if (waterL > 0) autoParts.push(`Air +${waterL} L`);
    if (nutrientL > 0) autoParts.push(`Nutrisi +${nutrientL} L`);
    if (phChemical !== 'none' && phMl > 0) autoParts.push(`${phChemical} +${phMl} ml`);

    const entryTimestamp = localDateTimeInputToIso(inspectionDateTime);
    const clampedHst = Math.min(75, Math.max(1, Math.round(Number(plantAgeHst) || 1)));

    const entry: WaterLogEntry = {
      id: `wlog-${Date.now()}`,
      timestamp: entryTimestamp,
      plantAgeHst: clampedHst,
      ppmBefore: startPpm,
      ppm: endPpm,
      ec,
      phBefore: startPh,
      ph: endPh,
      tempC,
      flowLpm,
      reservoirPct,
      waterAddedLiters: waterL,
      nutrientAddedLiters: nutrientL,
      abMixAddedMl: nutrientL * 1000,
      phAdjMl: phMl,
      phAdjType,
      phChemical,
      source: 'manual',
      operator: manualOperator.trim() || 'Petugas',
      note:
        manualNote.trim() ||
        (autoParts.length > 0 ? autoParts.join(' · ') : 'Pengukuran manual TDS & pH meter'),
    };

    onUpdateGh((prev) => {
      const sortedLogs = [entry, ...prev.waterLogs].sort((a, b) =>
        String(b.timestamp).localeCompare(String(a.timestamp))
      );
      const isNewest = sortedLogs[0]?.id === entry.id;
      return {
        ...prev,
        currentWater: isNewest
          ? {
              ...prev.currentWater,
              ppm: endPpm,
              ec,
              ph: endPh,
              tempC,
              flowLpm,
              reservoirPct,
            }
          : prev.currentWater,
        waterLogs: sortedLogs,
      };
    });

    // Keep PPM/pH initial & final and Petugas fields empty after saving
    setPpmBefore('');
    setPpmAfter('');
    setPhBefore('');
    setPhAfter('');
    setWaterAddedLiters('0');
    setNutrientAddedLiters('0');
    setPhChemical('none');
    setPhAdjMl('0');
    setManualOperator('');
    setManualNote('');
    setHstManualOverride(false);
  };

  const handleDeleteLog = (id: string) => {
    onUpdateGh((prev) => ({
      ...prev,
      waterLogs: prev.waterLogs.filter((l) => l.id !== id),
    }));
    setSelectedLogIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDeleteSelectedLogs = () => {
    if (selectedLogIds.length === 0) return;
    const idSet = new Set(selectedLogIds);
    onUpdateGh((prev) => ({
      ...prev,
      waterLogs: prev.waterLogs.filter((l) => !idSet.has(l.id)),
    }));
    setSelectedLogIds([]);
  };

  const handleDeleteAllLogs = () => {
    onUpdateGh((prev) => ({
      ...prev,
      waterLogs: [],
    }));
    setSelectedLogIds([]);
    setConfirmClearAllLogs(false);
  };

  const handleExportCsv = () => {
    const header =
      'Waktu,Usia_Tanaman(HST),PPM_Awal,PPM_Akhir,EC,pH_Awal,pH_Akhir,Tambah_Air(L),Tambah_Nutrisi(L),Pengatur_pH,Takaran_pH(ml),Suhu(C),Debit(L/m),Tandon(%),Operator,Catatan\n';
    const rows = gh.waterLogs
      .map((l) =>
        [
          new Date(l.timestamp).toLocaleString('id-ID').replace(/,/g, ''),
          l.plantAgeHst ? `${l.plantAgeHst} HST` : '-',
          l.ppmBefore ?? l.ppm,
          l.ppm,
          l.ec,
          l.phBefore ?? l.ph,
          l.ph,
          l.waterAddedLiters ?? 0,
          l.nutrientAddedLiters ?? (l.abMixAddedMl ? Number((l.abMixAddedMl / 1000).toFixed(2)) : 0),
          l.phChemical || (l.phAdjType === 'up' ? 'KOH' : l.phAdjType === 'down' ? 'Phosphoric' : 'Tidak ada'),
          l.phAdjMl,
          l.tempC,
          l.flowLpm,
          l.reservoirPct,
          `"${l.operator}"`,
          `"${l.note.replace(/"/g, '""')}"`,
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gh.name.replace(/\s+/g, '_')}_PPM_pH_Log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    return gh.waterLogs.filter((l) => {
      if (dateFilter && !matchesLocalDate(l.timestamp, dateFilter)) return false;
      if (logFilter === 'all') return true;
      if (logFilter === 'dosing') {
        return (
          (l.waterAddedLiters || 0) > 0 ||
          (l.nutrientAddedLiters || 0) > 0 ||
          l.abMixAddedMl > 0 ||
          l.phAdjMl > 0
        );
      }
      return l.source === logFilter;
    });
  }, [gh.waterLogs, logFilter, dateFilter]);

  const chartPoints = useMemo(() => {
    const base = dateFilter ? filteredLogs : gh.waterLogs;
    return [...base].slice(0, 16).reverse();
  }, [gh.waterLogs, filteredLogs, dateFilter]);

  return (
    <div className="space-y-6">
      {/* Phase Selector & Custom Inspector PPM / pH Bounds */}
      <section
        className="rounded-xl border p-4 sm:p-5 space-y-4"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Fase Pertumbuhan Melon — {gh.name} (Sistem Kontrol Manual)
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm" style={{ color: 'var(--app-text-muted)' }}>
              {phaseSpec.note} Target PPM{' '}
              <span className="font-mono-tabular font-semibold" style={{ color: 'var(--app-text)' }}>
                {effectivePpmMin}–{effectivePpmMax} ppm
              </span>{' '}
              · Target pH{' '}
              <span className="font-mono-tabular font-semibold" style={{ color: 'var(--app-text)' }}>
                {effectivePhMin.toFixed(1)}–{effectivePhMax.toFixed(1)}
              </span>{' '}
              <span className="font-medium" style={{ color: 'var(--app-accent)' }}>
                ({useCustomTargets ? 'Batas Kustom Pemeriksa' : 'Standar Fase'})
              </span>
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg p-1"
            style={{ backgroundColor: 'var(--app-surface-muted)' }}
          >
            {(Object.keys(GROWTH_PHASE_SPECS) as GrowthPhase[]).map((phaseKey) => {
              const spec = GROWTH_PHASE_SPECS[phaseKey];
              const active = gh.phase === phaseKey;
              return (
                <button
                  key={phaseKey}
                  type="button"
                  onClick={() => handlePhaseChange(phaseKey)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--app-surface)' : 'transparent',
                    color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {spec.label} ({spec.hstRange})
                </button>
              );
            })}
          </div>
        </div>

        {/* Batas Target PPM & pH Pemeriksa */}
        <div
          className="rounded-lg border p-3.5 space-y-3"
          style={{
            borderColor: useCustomTargets ? 'var(--app-accent)' : 'var(--app-border)',
            backgroundColor: 'var(--app-canvas)',
          }}
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
              <div>
                <div className="text-xs font-semibold">
                  Batas Target PPM &amp; pH ({gh.name})
                </div>
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Pemeriksa dapat memakai standar fase otomatis atau mengisi batas PPM &amp; pH sendiri.
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-1 rounded-lg p-1 self-start sm:self-auto"
              style={{ backgroundColor: 'var(--app-surface-muted)' }}
            >
              <button
                type="button"
                onClick={() => handleSetTargetMode(false)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                style={{
                  backgroundColor: !useCustomTargets ? 'var(--app-surface)' : 'transparent',
                  color: !useCustomTargets ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  boxShadow: !useCustomTargets ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Ikuti Standar Fase
              </button>
              <button
                type="button"
                onClick={() => handleSetTargetMode(true)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                style={{
                  backgroundColor: useCustomTargets ? 'var(--app-surface)' : 'transparent',
                  color: useCustomTargets ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  boxShadow: useCustomTargets ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Isi Sendiri (Pemeriksa)
              </button>
            </div>
          </div>

          {useCustomTargets && (
            <form
              onSubmit={handleSaveCustomTargets}
              className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-6 sm:items-end"
            >
              <div>
                <label
                  htmlFor="custom-ppm-min"
                  className="block text-[11px] font-medium mb-1"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  PPM Min (ppm)
                </label>
                <input
                  id="custom-ppm-min"
                  type="number"
                  min={0}
                  max={5000}
                  placeholder="0"
                  required
                  value={customPpmMinInput}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => setCustomPpmMinInput(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="custom-ppm-max"
                  className="block text-[11px] font-medium mb-1"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  PPM Maks (ppm)
                </label>
                <input
                  id="custom-ppm-max"
                  type="number"
                  min={0}
                  max={5000}
                  placeholder="0"
                  required
                  value={customPpmMaxInput}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => setCustomPpmMaxInput(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="custom-ph-min"
                  className="block text-[11px] font-medium mb-1"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  pH Min
                </label>
                <input
                  id="custom-ph-min"
                  type="number"
                  step="0.1"
                  min={0}
                  max={14}
                  required
                  value={customPhMinInput}
                  onChange={(e) => setCustomPhMinInput(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="custom-ph-max"
                  className="block text-[11px] font-medium mb-1"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  pH Maks
                </label>
                <input
                  id="custom-ph-max"
                  type="number"
                  step="0.1"
                  min={0}
                  max={14}
                  required
                  value={customPhMaxInput}
                  onChange={(e) => setCustomPhMaxInput(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <Check className="h-3.5 w-3.5" />
                {targetsSavedFeedback ? 'Tersimpan' : 'Terapkan Batas'}
              </button>

              <button
                type="button"
                onClick={() => handleSetTargetMode(false)}
                className="inline-flex h-[34px] items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-medium cursor-pointer"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-text-muted)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Fase
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 4-Column Interactive KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: PPM Awal -> Akhir & EC */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => jumpToTarget('ppm')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              jumpToTarget('ppm');
            }
          }}
          className="rounded-xl border p-4 sm:p-5 text-left transition-all hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
          title="Ketuk untuk langsung menuju kolom input PPM"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Kepekatan Nutrisi (PPM Awal → Akhir)
            </span>
            <Gauge className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono-tabular tracking-tight">
              {currentWater.ppm.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
              ppm
            </span>
            <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>·</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleEcFactorToggle();
              }}
              onKeyDown={(e) => e.stopPropagation()}
              title="Klik untuk ganti konversi EC (500 / 700)"
              className="text-xs font-mono-tabular underline decoration-dotted cursor-pointer"
              style={{ color: 'var(--app-text-muted)' }}
            >
              EC {currentWater.ec.toFixed(2)} ({gh.ecFactor})
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
            <span>
              Awal: {latestLog?.ppmBefore ?? currentWater.ppm} → Akhir: {latestLog?.ppm ?? currentWater.ppm} ppm
            </span>
            <span>
              Batas: {effectivePpmMin}–{effectivePpmMax}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              {ppmStatus.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className={ppmStatus.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                {ppmStatus.label}
              </span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold shrink-0" style={{ color: 'var(--app-accent)' }}>
              Isi PPM <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* KPI 2: pH Awal -> Akhir */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => jumpToTarget('ph')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              jumpToTarget('ph');
            }
          }}
          className="rounded-xl border p-4 sm:p-5 text-left transition-all hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
          title="Ketuk untuk langsung menuju kolom input pH"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Derajat Keasaman (pH Awal → Akhir)
            </span>
            <Droplets className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono-tabular tracking-tight">
              {currentWater.ph.toFixed(2)}
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
              pH (Target {effectivePhMin.toFixed(1)}–{effectivePhMax.toFixed(1)})
            </span>
          </div>
          <div className="mt-2 text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
            Awal: {(latestLog?.phBefore ?? currentWater.ph).toFixed(2)} → Akhir: {(latestLog?.ph ?? currentWater.ph).toFixed(2)}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              {phStatus.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span className={phStatus.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                {phStatus.label}
              </span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold shrink-0" style={{ color: 'var(--app-accent)' }}>
              Isi pH <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* KPI 3: Suhu & Sirkulasi */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => jumpToTarget('temp')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              jumpToTarget('temp');
            }
          }}
          className="rounded-xl border p-4 sm:p-5 text-left transition-all hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
          title="Ketuk untuk langsung menuju kolom input Suhu & Debit"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Suhu Larutan & Aliran NFT
            </span>
            <Thermometer className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono-tabular tracking-tight">
              {currentWater.tempC.toFixed(1)}°C
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
              {currentWater.flowLpm.toFixed(1)} L/mnt
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span style={{ color: 'var(--app-text-muted)' }}>
              Sirkulasi: {currentWater.pumpCirculation ? 'Aktif (24 jam NFT)' : 'Berhenti'} ·{' '}
              {gh.gulliesCount} talang
            </span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold shrink-0" style={{ color: 'var(--app-accent)' }}>
              Isi Suhu <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* KPI 4: Level Tandon */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => jumpToTarget('reservoir')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              jumpToTarget('reservoir');
            }
          }}
          className="rounded-xl border p-4 sm:p-5 text-left transition-all hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
          title="Ketuk untuk langsung menuju kolom input Volume Tandon"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Volume Tandon Utama
            </span>
            <Waves className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono-tabular tracking-tight">
              {currentWater.reservoirPct}%
            </span>
            <span className="text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
              ({Math.round((gh.reservoirLiters * currentWater.reservoirPct) / 100).toLocaleString('id-ID')} /{' '}
              {gh.reservoirLiters.toLocaleString('id-ID')} L)
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--app-surface-muted)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${currentWater.reservoirPct}%`,
                backgroundColor: currentWater.reservoirPct < 30 ? '#DC2626' : 'var(--app-accent)',
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-end">
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
              Isi Tandon <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </section>

      {/* Main Split: Left Manual Control Form (5 cols) + Right Charts & Logs (7 cols) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Manual Additions (Air, Nutrisi 1-20L, KOH / Phosphoric, PPM/pH Awal-Akhir) */}
        <div className="space-y-6 xl:col-span-5">
          <section
            className="rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--app-surface)',
              borderColor: 'var(--app-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Penambahan Air, Nutrisi & Pengatur pH Manual</h3>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  Catat penambahan air, nutrisi (1–20 L), KOH / Phosphoric, serta kondisi awal & akhir.
                </p>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
              {/* Pemilihan Tanggal & Jam Pemeriksaan + Usia Tanaman (1-75 HST) */}
              <div
                className="rounded-lg border p-3.5 space-y-3"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="water-inspection-datetime"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
                      <span>Tanggal &amp; Jam Pemeriksaan</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const nowInput = toLocalDateTimeInputValue();
                        setInspectionDateTime(nowInput);
                        if (!hstManualOverride) {
                          setPlantAgeHst(computeSuggestedPlantAgeHst(gh, nowInput));
                        }
                      }}
                      className="rounded border px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-accent)',
                      }}
                    >
                      Sekarang
                    </button>
                  </div>
                  <input
                    id="water-inspection-datetime"
                    type="datetime-local"
                    required
                    value={inspectionDateTime}
                    onChange={(e) => {
                      const nextDt = e.target.value;
                      setInspectionDateTime(nextDt);
                      if (!hstManualOverride && nextDt) {
                        setPlantAgeHst(computeSuggestedPlantAgeHst(gh, nextDt));
                      }
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-xs sm:text-sm font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>

                {/* Usia Tanaman (1 HST - 75 HST) */}
                <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="water-plant-age-hst"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <Sprout className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
                      <span>Usia Tanaman (1–75 HST)</span>
                    </label>
                    <span className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                      {latestLog?.plantAgeHst
                        ? `Terakhir: ${latestLog.plantAgeHst} HST (+1/hari otomatis)`
                        : 'Bertambah otomatis setiap hari'}
                    </span>
                  </div>
                  <select
                    id="water-plant-age-hst"
                    aria-label="Pilih usia tanaman 1 sampai 75 HST"
                    value={plantAgeHst}
                    onChange={(e) => {
                      setPlantAgeHst(Math.min(75, Math.max(1, Number(e.target.value) || 1)));
                      setHstManualOverride(true);
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-xs sm:text-sm font-mono-tabular font-semibold focus:outline-none cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  >
                    {Array.from({ length: 75 }, (_, i) => i + 1).map((hst) => (
                      <option key={hst} value={hst}>
                        {hst} HST (Hari Setelah Tanam)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 1. Tambah Air (Liter) */}
              <div
                className="rounded-lg border p-3.5 space-y-2.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold">1. Tambah Air Baku (Liter)</label>
                  <div className="flex flex-wrap gap-1">
                    {[10, 25, 50, 100].map((ltr) => (
                      <button
                        key={ltr}
                        type="button"
                        onClick={() => handleWaterChange(String(ltr))}
                        className="rounded border px-2 py-0.5 text-[11px] font-mono-tabular font-medium cursor-pointer"
                        style={{
                          borderColor:
                            Number(waterAddedLiters) === ltr ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor:
                            Number(waterAddedLiters) === ltr ? 'var(--app-accent-soft)' : 'var(--app-surface)',
                          color:
                            Number(waterAddedLiters) === ltr ? 'var(--app-accent)' : 'var(--app-text)',
                        }}
                      >
                        +{ltr} L
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step="1"
                    placeholder="0"
                    value={waterAddedLiters}
                    onFocus={(e) => {
                      if (e.currentTarget.value === '0') e.currentTarget.select();
                    }}
                    onChange={(e) => handleWaterChange(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                  <span className="text-xs font-mono-tabular shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                    Liter
                  </span>
                </div>
              </div>

              {/* 2. Tambah Nutrisi (1 sampai 20 Liter) */}
              <div
                className="rounded-lg border p-3.5 space-y-2.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold">2. Tambah Nutrisi AB Mix (1–20 Liter)</label>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 5, 10, 20].map((ltr) => (
                      <button
                        key={ltr}
                        type="button"
                        onClick={() => handleNutrientChange(String(ltr))}
                        className="rounded border px-2 py-0.5 text-[11px] font-mono-tabular font-medium cursor-pointer"
                        style={{
                          borderColor:
                            Number(nutrientAddedLiters) === ltr ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor:
                            Number(nutrientAddedLiters) === ltr ? 'var(--app-accent-soft)' : 'var(--app-surface)',
                          color:
                            Number(nutrientAddedLiters) === ltr ? 'var(--app-accent)' : 'var(--app-text)',
                        }}
                      >
                        +{ltr} L
                      </button>
                    ))}
                  </div>
                </div>
                <select
                  aria-label="Pilih volume nutrisi 1 sampai 20 liter"
                  value={nutrientAddedLiters}
                  onChange={(e) => handleNutrientChange(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                >
                  <option value="0">0 Liter (Tidak menambah nutrisi)</option>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((ltr) => (
                    <option key={ltr} value={String(ltr)}>
                      {ltr} Liter Pekatan Nutrisi AB Mix
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Tambah KOH (pH Up) atau Phosphoric (pH Down) */}
              <div
                className="rounded-lg border p-3.5 space-y-2.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <label className="block text-xs font-semibold">
                  3. Pengatur pH: KOH (pH Up) / Phosphoric (pH Down)
                </label>
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-lg p-1"
                  style={{ backgroundColor: 'var(--app-surface-muted)' }}
                >
                  {(
                    [
                      { id: 'none', label: 'Tidak Ada' },
                      { id: 'KOH', label: 'KOH (pH Up)' },
                      { id: 'Phosphoric', label: 'Phosphoric (pH Down)' },
                    ] as const
                  ).map((item) => {
                    const active = phChemical === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePhChemChange(item.id)}
                        className="rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        style={{
                          backgroundColor: active ? 'var(--app-surface)' : 'transparent',
                          color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {phChemical !== 'none' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex flex-1 min-w-[140px] items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={5000}
                        placeholder="0"
                        value={phAdjMl}
                        onFocus={(e) => {
                          if (e.currentTarget.value === '0') e.currentTarget.select();
                        }}
                        onChange={(e) => handlePhMlChange(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                      <span className="text-xs font-mono-tabular shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                        ml {phChemical}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {[10, 25, 50].map((ml) => (
                        <button
                          key={ml}
                          type="button"
                          onClick={() => handlePhMlChange(String(ml))}
                          className="rounded border px-2 py-1.5 text-[11px] font-mono-tabular cursor-pointer"
                          style={{
                            borderColor: 'var(--app-border)',
                            backgroundColor: 'var(--app-surface)',
                          }}
                        >
                          {ml}ml
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Keterangan PPM Awal & PPM Akhir, pH Awal & pH Akhir */}
              <div
                className="rounded-lg border p-3.5 space-y-3"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="text-xs font-semibold">
                  4. Pembacaan PPM & pH (Awal → Akhir)
                </div>

                <div
                  ref={ppmBoxRef}
                  className="grid grid-cols-2 gap-3 rounded-lg border p-2 transition-all"
                  style={{
                    borderColor: highlightedTarget === 'ppm' ? 'var(--app-accent)' : 'transparent',
                    backgroundColor:
                      highlightedTarget === 'ppm' ? 'var(--app-accent-soft)' : 'transparent',
                  }}
                >
                  <div>
                    <label
                      htmlFor="water-ppm-before"
                      className="block text-[11px] font-medium mb-1"
                      style={{ color: 'var(--app-text-muted)' }}
                    >
                      PPM Awal
                    </label>
                    <input
                      ref={ppmInputRef}
                      id="water-ppm-before"
                      type="number"
                      min={0}
                      max={5000}
                      required
                      placeholder="Kosong (isi PPM awal)"
                      value={ppmBefore}
                      onChange={(e) => setPpmBefore(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="water-ppm-after"
                      className="block text-[11px] font-medium mb-1"
                      style={{ color: 'var(--app-accent)' }}
                    >
                      PPM Akhir (Hasil Ukur)
                    </label>
                    <input
                      id="water-ppm-after"
                      type="number"
                      min={0}
                      max={5000}
                      required
                      placeholder="Kosong (isi PPM akhir)"
                      value={ppmAfter}
                      onChange={(e) => setPpmAfter(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular font-semibold focus:outline-none"
                      style={{
                        borderColor: 'var(--app-accent)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                </div>

                <div
                  ref={phBoxRef}
                  className="grid grid-cols-2 gap-3 rounded-lg border p-2 transition-all"
                  style={{
                    borderColor: highlightedTarget === 'ph' ? 'var(--app-accent)' : 'transparent',
                    backgroundColor:
                      highlightedTarget === 'ph' ? 'var(--app-accent-soft)' : 'transparent',
                  }}
                >
                  <div>
                    <label
                      htmlFor="water-ph-before"
                      className="block text-[11px] font-medium mb-1"
                      style={{ color: 'var(--app-text-muted)' }}
                    >
                      pH Awal
                    </label>
                    <input
                      ref={phInputRef}
                      id="water-ph-before"
                      type="number"
                      step="0.01"
                      min={0}
                      max={14}
                      required
                      placeholder="Kosong (isi pH awal)"
                      value={phBefore}
                      onChange={(e) => setPhBefore(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="water-ph-after"
                      className="block text-[11px] font-medium mb-1"
                      style={{ color: 'var(--app-accent)' }}
                    >
                      pH Akhir (Hasil Ukur)
                    </label>
                    <input
                      id="water-ph-after"
                      type="number"
                      step="0.01"
                      min={0}
                      max={14}
                      required
                      placeholder="Kosong (isi pH akhir)"
                      value={phAfter}
                      onChange={(e) => setPhAfter(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular font-semibold focus:outline-none"
                      style={{
                        borderColor: 'var(--app-accent)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                </div>

                {/* Live comparison badge */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs font-mono-tabular"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    PPM: {ppmBefore.trim() !== '' ? ppmBefore : '—'}{' '}
                    <ArrowRight className="h-3 w-3" />{' '}
                    <strong>{ppmAfter.trim() !== '' ? `${ppmAfter} ppm` : '—'}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    pH: {phBefore.trim() !== '' ? Number(phBefore).toFixed(2) : '—'}{' '}
                    <ArrowRight className="h-3 w-3" />{' '}
                    <strong>{phAfter.trim() !== '' ? Number(phAfter).toFixed(2) : '—'}</strong>
                  </span>
                </div>
              </div>

              {/* Additional manual sensor & note fields */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  ref={tempBoxRef}
                  className="rounded-lg border p-1.5 transition-all"
                  style={{
                    borderColor: highlightedTarget === 'temp' ? 'var(--app-accent)' : 'transparent',
                    backgroundColor:
                      highlightedTarget === 'temp' ? 'var(--app-accent-soft)' : 'transparent',
                  }}
                >
                  <label htmlFor="water-manual-temp" className="block text-[11px] font-medium mb-1">
                    Suhu (°C)
                  </label>
                  <input
                    ref={tempInputRef}
                    id="water-manual-temp"
                    type="number"
                    step="0.1"
                    min={5}
                    max={50}
                    value={manualTemp}
                    onChange={(e) => setManualTemp(e.target.value)}
                    className="w-full rounded-lg border px-2.5 py-2 text-xs font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div className="rounded-lg border border-transparent p-1.5">
                  <label htmlFor="water-manual-flow" className="block text-[11px] font-medium mb-1">
                    Debit (L/mnt)
                  </label>
                  <input
                    id="water-manual-flow"
                    type="number"
                    step="0.1"
                    min={0}
                    max={200}
                    value={manualFlow}
                    onChange={(e) => setManualFlow(e.target.value)}
                    className="w-full rounded-lg border px-2.5 py-2 text-xs font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div
                  ref={reservoirBoxRef}
                  className="rounded-lg border p-1.5 transition-all"
                  style={{
                    borderColor:
                      highlightedTarget === 'reservoir' ? 'var(--app-accent)' : 'transparent',
                    backgroundColor:
                      highlightedTarget === 'reservoir' ? 'var(--app-accent-soft)' : 'transparent',
                  }}
                >
                  <label
                    htmlFor="water-manual-reservoir"
                    className="block text-[11px] font-medium mb-1"
                  >
                    Tandon (%)
                  </label>
                  <input
                    ref={reservoirInputRef}
                    id="water-manual-reservoir"
                    type="number"
                    min={0}
                    max={100}
                    value={manualReservoir}
                    onChange={(e) => setManualReservoir(e.target.value)}
                    className="w-full rounded-lg border px-2.5 py-2 text-xs font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                <OperatorField
                  id="water-manual-operator"
                  label="Petugas"
                  value={manualOperator}
                  onChange={setManualOperator}
                />
                <div>
                  <label className="block text-[11px] font-medium mb-1">Catatan Lapangan</label>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Opsional (otomatis terisi bila kosong)"
                    className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <Plus className="h-4 w-4" />
                Simpan Pengukuran & Penambahan Manual
              </button>
            </form>
          </section>

          {/* Circulation Pump Relay */}
          <section
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--app-surface)',
              borderColor: 'var(--app-border)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold">Saklar Pompa Sirkulasi NFT ({gh.name})</span>
              <span className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                {useCustomTargets
                  ? `Pemeriksa: ${effectivePpmMin}–${effectivePpmMax} ppm · pH ${effectivePhMin.toFixed(1)}–${effectivePhMax.toFixed(1)}`
                  : `Notif: ${notifSettings.ppmMin}–${notifSettings.ppmMax} ppm`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => togglePump('pumpCirculation')}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer"
              style={{
                borderColor: currentWater.pumpCirculation ? 'var(--app-accent)' : 'var(--app-border)',
                backgroundColor: currentWater.pumpCirculation ? 'var(--app-accent-soft)' : 'transparent',
                color: currentWater.pumpCirculation ? 'var(--app-accent)' : 'var(--app-text-muted)',
              }}
            >
              <span>
                Pompa Sirkulasi Talang NFT: {currentWater.pumpCirculation ? 'MENYALA' : 'MATI'}
              </span>
              <Power className="h-4 w-4 shrink-0" />
            </button>
          </section>
        </div>

        {/* Right: Dual-Series Chart + History Table (7 cols) */}
        <div className="space-y-6 xl:col-span-7">
          {/* SVG Trend Chart */}
          <section
            className="rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--app-surface)',
              borderColor: 'var(--app-border)',
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Grafik Tren PPM & pH Larutan</h3>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  Area berbayang menunjukkan rentang target{' '}
                  {useCustomTargets ? 'kustom pemeriksa' : `fase ${phaseSpec.label}`}. Arahkan kursor pada titik untuk detail.
                </p>
              </div>
              {hoverIdx !== null && chartPoints[hoverIdx] && (
                <div
                  className="rounded-lg border px-3 py-1.5 text-xs font-mono-tabular"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface-muted)',
                  }}
                >
                  {new Date(chartPoints[hoverIdx].timestamp).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · <strong>{chartPoints[hoverIdx].ppm} ppm</strong> · pH{' '}
                  <strong>{chartPoints[hoverIdx].ph.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {chartPoints.length < 2 ? (
              <div
                className="mt-4 flex h-56 items-center justify-center rounded-lg border border-dashed text-sm"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
              >
                Tambahkan minimal 2 pencatatan PPM & pH untuk menampilkan grafik tren.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <TrendMiniChart
                  title="Tren Kepekatan Nutrisi (PPM)"
                  unit="ppm"
                  values={chartPoints.map((c) => c.ppm)}
                  minBound={Math.min(350, effectivePpmMin)}
                  maxBound={Math.max(1150, effectivePpmMax)}
                  targetMin={effectivePpmMin}
                  targetMax={effectivePpmMax}
                  strokeColor="var(--app-accent)"
                  hoverIdx={hoverIdx}
                  onHover={setHoverIdx}
                />
                <TrendMiniChart
                  title="Tren Derajat Keasaman (pH)"
                  unit="pH"
                  values={chartPoints.map((c) => c.ph)}
                  minBound={Math.min(5.5, effectivePhMin)}
                  maxBound={Math.max(7.8, effectivePhMax)}
                  targetMin={effectivePhMin}
                  targetMax={effectivePhMax}
                  strokeColor="#0284C7"
                  hoverIdx={hoverIdx}
                  onHover={setHoverIdx}
                  decimals={2}
                />
              </div>
            )}
          </section>

          {/* Statistik Mingguan Rata-Rata Kenaikan PPM & pH */}
          <WaterWeeklyStatsSection
            logs={gh.waterLogs}
            targetPpmMin={effectivePpmMin}
            targetPpmMax={effectivePpmMax}
            targetPhMin={effectivePhMin}
            targetPhMax={effectivePhMax}
          />

          {/* Water Log Table */}
          <section
            className="rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--app-surface)',
              borderColor: 'var(--app-border)',
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold">Riwayat Pengukuran & Penambahan Manual</h3>
                <span className="text-xs font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  {filteredLogs.length} catatan
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex items-center gap-1 rounded-lg p-1"
                  style={{ backgroundColor: 'var(--app-surface-muted)' }}
                >
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'dosing', label: 'Ada Penambahan' },
                      { id: 'manual', label: 'Ukur Manual' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLogFilter(f.id)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer"
                      style={{
                        backgroundColor: logFilter === f.id ? 'var(--app-surface)' : 'transparent',
                        color: logFilter === f.id ? 'var(--app-accent)' : 'var(--app-text-muted)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Filter Tanggal Pemeriksaan */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative flex items-center">
                    <Calendar
                      className="pointer-events-none absolute left-2.5 h-3.5 w-3.5"
                      style={{ color: 'var(--app-text-muted)' }}
                    />
                    <input
                      type="date"
                      aria-label="Filter tanggal pemeriksaan air"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="h-8 rounded-lg border pl-8 pr-2 text-xs font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: dateFilter ? 'var(--app-accent)' : 'var(--app-border)',
                        backgroundColor: dateFilter ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const today = toLocalDateInputValue();
                      setDateFilter((prev) => (prev === today ? '' : today));
                    }}
                    className="h-8 rounded-lg border px-2.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor:
                        dateFilter === toLocalDateInputValue()
                          ? 'var(--app-accent)'
                          : 'var(--app-border)',
                      backgroundColor:
                        dateFilter === toLocalDateInputValue()
                          ? 'var(--app-accent-soft)'
                          : 'transparent',
                      color:
                        dateFilter === toLocalDateInputValue()
                          ? 'var(--app-accent)'
                          : 'var(--app-text)',
                    }}
                  >
                    Hari Ini
                  </button>
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter('')}
                      className="h-8 rounded-lg border px-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                      style={{
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text-muted)',
                      }}
                    >
                      Semua Tgl
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={gh.waterLogs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
                  style={{
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Ekspor CSV
                </button>
              </div>
            </div>

            {/* Bulk Delete Controls Bar */}
            {gh.waterLogs.length > 0 && (
              <div
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600 cursor-pointer"
                      checked={
                        filteredLogs.length > 0 &&
                        filteredLogs.every((l) => selectedLogIds.includes(l.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLogIds(filteredLogs.map((l) => l.id));
                        } else {
                          setSelectedLogIds([]);
                        }
                      }}
                    />
                    <span>Pilih Semua ({filteredLogs.length})</span>
                  </label>
                  {selectedLogIds.length > 0 && (
                    <span className="font-mono-tabular" style={{ color: 'var(--app-accent)' }}>
                      {selectedLogIds.length} dipilih
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedLogIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedLogs}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Dipilih ({selectedLogIds.length})
                    </button>
                  )}

                  {!confirmClearAllLogs ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAllLogs(true)}
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Semua
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        Hapus semua {gh.waterLogs.length} log?
                      </span>
                      <button
                        type="button"
                        onClick={handleDeleteAllLogs}
                        className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                      >
                        Ya, Hapus Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAllLogs(false)}
                        className="rounded-md border px-2 py-1 text-xs cursor-pointer"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {filteredLogs.length === 0 ? (
              <div
                className="mt-4 rounded-lg border border-dashed py-10 text-center text-sm"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
              >
                Belum ada log pengukuran air pada dokumen ini. Gunakan formulir manual di samping.
              </div>
            ) : (
              <>
                {/* Mobile Card Layout (<768px): Neat & Zero Horizontal Scroll */}
                <div className="mt-4 space-y-2.5 md:hidden">
                  {filteredLogs.map((log) => {
                    const nutL =
                      log.nutrientAddedLiters ??
                      (log.abMixAddedMl > 0 ? Number((log.abMixAddedMl / 1000).toFixed(1)) : 0);
                    const waterL = log.waterAddedLiters ?? 0;
                    const chemLabel =
                      log.phChemical && log.phChemical !== 'none'
                        ? log.phChemical
                        : log.phAdjType === 'up'
                        ? 'KOH'
                        : log.phAdjType === 'down'
                        ? 'Phosphoric'
                        : '';
                    const isChecked = selectedLogIds.includes(log.id);

                    return (
                      <div
                        key={log.id}
                        className="rounded-lg border p-3 space-y-2 text-xs"
                        style={{
                          borderColor: isChecked ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor: isChecked ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 font-mono-tabular font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              aria-label={`Pilih log ${log.note}`}
                              className="h-4 w-4 accent-emerald-600 cursor-pointer"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLogIds((prev) => [...prev, log.id]);
                                } else {
                                  setSelectedLogIds((prev) => prev.filter((id) => id !== log.id));
                                }
                              }}
                            />
                            <span>
                              {new Date(log.timestamp).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {typeof log.plantAgeHst === 'number' && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                style={{
                                  backgroundColor: 'var(--app-accent-soft)',
                                  color: 'var(--app-accent)',
                                }}
                              >
                                {log.plantAgeHst} HST
                              </span>
                            )}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium text-rose-600 cursor-pointer"
                            style={{
                              borderColor: 'var(--app-border)',
                              backgroundColor: 'var(--app-surface)',
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            Hapus
                          </button>
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
                              PPM Awal → Akhir
                            </div>
                            <div className="font-semibold">
                              {log.ppmBefore ?? log.ppm} → {log.ppm}
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
                              pH Awal → Akhir
                            </div>
                            <div className="font-semibold">
                              {(log.phBefore ?? log.ph).toFixed(2)} → {log.ph.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {(waterL > 0 || nutL > 0 || log.phAdjMl > 0) && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono-tabular text-[11px]" style={{ color: 'var(--app-accent)' }}>
                            {waterL > 0 && <span>Air +{waterL} L</span>}
                            {nutL > 0 && <span>Nutrisi +{nutL} L</span>}
                            {log.phAdjMl > 0 && (
                              <span>
                                {chemLabel} +{log.phAdjMl} ml
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="font-medium" style={{ color: 'var(--app-text)' }}>
                            {log.note}
                          </span>{' '}
                          · {log.operator} · {log.tempC.toFixed(1)}°C
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tablet & Desktop Table (>=768px) */}
                <div className="mt-4 hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                        <th className="py-2.5 pr-2 w-8">
                          <input
                            type="checkbox"
                            aria-label="Pilih semua baris"
                            className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                            checked={
                              filteredLogs.length > 0 &&
                              filteredLogs.every((l) => selectedLogIds.includes(l.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLogIds(filteredLogs.map((l) => l.id));
                              } else {
                                setSelectedLogIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="py-2.5 pr-3 font-medium">Waktu</th>
                        <th className="py-2.5 px-3 font-medium text-right">PPM Awal → Akhir</th>
                        <th className="py-2.5 px-3 font-medium text-right">pH Awal → Akhir</th>
                        <th className="py-2.5 px-3 font-medium">Penambahan (Air / Nutrisi / pH)</th>
                        <th className="py-2.5 px-3 font-medium">Petugas & Catatan</th>
                        <th className="py-2.5 pl-2 text-right font-medium">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                      {filteredLogs.map((log) => {
                        const nutL =
                          log.nutrientAddedLiters ??
                          (log.abMixAddedMl > 0 ? Number((log.abMixAddedMl / 1000).toFixed(1)) : 0);
                        const waterL = log.waterAddedLiters ?? 0;
                        const chemLabel =
                          log.phChemical && log.phChemical !== 'none'
                            ? log.phChemical
                            : log.phAdjType === 'up'
                            ? 'KOH'
                            : log.phAdjType === 'down'
                            ? 'Phosphoric'
                            : '';
                        const isChecked = selectedLogIds.includes(log.id);

                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                            style={{
                              backgroundColor: isChecked ? 'var(--app-accent-soft)' : 'transparent',
                            }}
                          >
                            <td className="py-2.5 pr-2">
                              <input
                                type="checkbox"
                                aria-label={`Pilih log ${log.note}`}
                                className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLogIds((prev) => [...prev, log.id]);
                                  } else {
                                    setSelectedLogIds((prev) => prev.filter((id) => id !== log.id));
                                  }
                                }}
                              />
                            </td>
                            <td className="py-2.5 pr-3 font-mono-tabular whitespace-nowrap">
                              <div>
                                {new Date(log.timestamp).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              {typeof log.plantAgeHst === 'number' && (
                                <span
                                  className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{
                                    backgroundColor: 'var(--app-accent-soft)',
                                    color: 'var(--app-accent)',
                                  }}
                                >
                                  {log.plantAgeHst} HST
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                              <span style={{ color: 'var(--app-text-muted)' }}>
                                {log.ppmBefore ?? log.ppm} →{' '}
                              </span>
                              <span className="font-semibold">{log.ppm}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                              <span style={{ color: 'var(--app-text-muted)' }}>
                                {(log.phBefore ?? log.ph).toFixed(2)} →{' '}
                              </span>
                              <span className="font-semibold">{log.ph.toFixed(2)}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono-tabular">
                              {waterL > 0 || nutL > 0 || log.phAdjMl > 0 ? (
                                <div className="space-y-0.5">
                                  {waterL > 0 && <div>Air +{waterL} L</div>}
                                  {nutL > 0 && <div>Nutrisi +{nutL} L</div>}
                                  {log.phAdjMl > 0 && (
                                    <div>
                                      {chemLabel} +{log.phAdjMl} ml
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--app-text-muted)' }}>Ukur Manual</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 max-w-[220px]">
                              <div className="font-medium truncate">{log.note}</div>
                              <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                                {log.operator} · {log.tempC.toFixed(1)}°C
                              </div>
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id)}
                                title="Hapus log ini"
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:text-rose-600 cursor-pointer"
                                style={{ color: 'var(--app-text-muted)' }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                              </button>
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
        </div>
      </div>
    </div>
  );
};

interface TrendMiniChartProps {
  title: string;
  unit: string;
  values: number[];
  minBound: number;
  maxBound: number;
  targetMin: number;
  targetMax: number;
  strokeColor: string;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
  decimals?: number;
}

const TrendMiniChart: React.FC<TrendMiniChartProps> = ({
  title,
  unit,
  values,
  minBound,
  maxBound,
  targetMin,
  targetMax,
  strokeColor,
  hoverIdx,
  onHover,
  decimals = 0,
}) => {
  const width = 340;
  const height = 160;
  const padX = 28;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const dataMin = Math.min(minBound, ...values, targetMin);
  const dataMax = Math.max(maxBound, ...values, targetMax);
  const span = Math.max(0.01, dataMax - dataMin);

  const toY = (val: number) => padY + innerH - ((val - dataMin) / span) * innerH;
  const toX = (idx: number) =>
    values.length === 1 ? padX + innerW / 2 : padX + (idx / (values.length - 1)) * innerW;

  const pointsStr = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const bandTop = toY(targetMax);
  const bandHeight = Math.max(4, toY(targetMin) - bandTop);

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-canvas)',
      }}
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{title}</span>
        <span className="font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
          Target {targetMin.toFixed(decimals)}–{targetMax.toFixed(decimals)} {unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40 overflow-visible cursor-crosshair"
        onMouseLeave={() => onHover(null)}
      >
        <rect
          x={padX}
          y={bandTop}
          width={innerW}
          height={bandHeight}
          fill={strokeColor}
          fillOpacity={0.12}
          rx={3}
        />
        <line
          x1={padX}
          y1={bandTop}
          x2={padX + innerW}
          y2={bandTop}
          stroke={strokeColor}
          strokeOpacity={0.35}
          strokeDasharray="3 3"
        />
        <line
          x1={padX}
          y1={bandTop + bandHeight}
          x2={padX + innerW}
          y2={bandTop + bandHeight}
          stroke={strokeColor}
          strokeOpacity={0.35}
          strokeDasharray="3 3"
        />

        <text
          x={padX - 4}
          y={padY + 4}
          textAnchor="end"
          fontSize="9"
          fill="currentColor"
          opacity={0.55}
        >
          {dataMax.toFixed(decimals)}
        </text>
        <text
          x={padX - 4}
          y={padY + innerH}
          textAnchor="end"
          fontSize="9"
          fill="currentColor"
          opacity={0.55}
        >
          {dataMin.toFixed(decimals)}
        </text>

        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsStr}
        />

        {hoverIdx !== null && values[hoverIdx] !== undefined && (
          <line
            x1={toX(hoverIdx)}
            y1={padY}
            x2={toX(hoverIdx)}
            y2={padY + innerH}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeDasharray="2 2"
          />
        )}

        {values.map((v, i) => {
          const cx = toX(i);
          const cy = toY(v);
          const isHovered = hoverIdx === i;
          return (
            <g key={i} onMouseEnter={() => onHover(i)}>
              <circle cx={cx} cy={cy} r={10} fill="transparent" />
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 4.5 : 2.8}
                fill={isHovered ? strokeColor : 'var(--app-surface)'}
                stroke={strokeColor}
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

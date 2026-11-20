import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Apple,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Layers,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  FRUIT_QUALITY_META,
  FRUITING_STATUS_META,
  PLANT_STATUS_META,
} from '../constants/themes';
import {
  FruitQuality,
  FruitingStatus,
  GreenhouseData,
  PlantCondition,
  PlantHealthStatus,
} from '../types';
import {
  formatDateShortId,
  localDateInputToIsoWithCurrentTime,
  matchesLocalDate,
  toLocalDateInputValue,
} from '../utils/dateUtils';

interface DashboardPlantsMatrixProps {
  gh: GreenhouseData;
  onUpdateGh: (updater: (gh: GreenhouseData) => GreenhouseData) => void;
}

function getFruiting(p: PlantCondition): FruitingStatus {
  if (p.fruitingStatus) return p.fruitingStatus;
  return p.fruitCount > 0 ? 'berbuah' : 'tidak_berbuah';
}

function getFruitQuality(p: PlantCondition): FruitQuality {
  return p.fruitQuality === 'jelek' ? 'jelek' : 'bagus';
}

function getFruitWeights(p: PlantCondition): number[] {
  if (Array.isArray(p.fruitWeights) && p.fruitWeights.length > 0) {
    return p.fruitWeights.map((w) => Math.max(0, Number(w) || 0));
  }
  const count = Math.max(0, Math.round(Number(p.fruitCount) || 0));
  const total = Math.max(0, Number(p.estWeightKg) || 0);
  if (count <= 1) {
    return total > 0 ? [total] : [];
  }
  const arr = Array.from({ length: count }, () => 0);
  if (total > 0) arr[0] = total;
  return arr;
}

function adjustWeightsForCount(
  existingWeights: number[],
  nextCount: number,
  fallbackTotalKg: number
): { fruitWeights: number[]; estWeightKg: number } {
  const count = Math.max(0, Math.round(nextCount));
  if (count === 0) {
    return { fruitWeights: [], estWeightKg: 0 };
  }
  const base =
    existingWeights.length > 0
      ? existingWeights
      : fallbackTotalKg > 0
      ? [fallbackTotalKg]
      : [];
  const nextWeights = Array.from({ length: count }, (_, idx) =>
    Math.max(0, Number(base[idx] ?? 0) || 0)
  );
  const sum = Number(nextWeights.reduce((a, b) => a + b, 0).toFixed(2));
  return { fruitWeights: nextWeights, estWeightKg: sum };
}

function sanitizeDecimalDraft(raw: string): string {
  const normalized = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const firstDot = normalized.indexOf('.');
  if (firstDot === -1) return normalized;
  return (
    normalized.slice(0, firstDot + 1) +
    normalized.slice(firstDot + 1).replace(/\./g, '')
  );
}

function sanitizeIntDraft(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export const DashboardPlantsMatrix: React.FC<DashboardPlantsMatrixProps> = ({
  gh,
  onUpdateGh,
}) => {
  const inspectorRef = useRef<HTMLElement | null>(null);
  const matrixTopRef = useRef<HTMLElement | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const [inspectorPulse, setInspectorPulse] = useState(false);
  const [viewMode, setViewMode] = useState<'block' | 'all'>('block');
  const [colorMode, setColorMode] = useState<'health' | 'fruiting' | 'quality'>('health');
  const [activeBlock, setActiveBlock] = useState(0); // 0 = 1-100, 1 = 101-200...
  const [statusFilter, setStatusFilter] = useState<'all' | PlantHealthStatus>('all');
  const [fruitingFilter, setFruitingFilter] = useState<'all' | FruitingStatus>('all');
  const [qualityFilter, setQualityFilter] = useState<'all' | FruitQuality>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [jumpNumber, setJumpNumber] = useState('');
  const [selectedId, setSelectedId] = useState<number>(1);
  const [hoveredPlant, setHoveredPlant] = useState<PlantCondition | null>(null);

  // Sticky inspection date option for recording backdated plant inspections sequentially
  const [lockInspectionDate, setLockInspectionDate] = useState(false);
  const [lockedInspectionDate, setLockedInspectionDate] = useState(() => toLocalDateInputValue());

  // Batch range / all manual fill & multi-select
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchTargetMode, setBatchTargetMode] = useState<'all' | 'selected' | 'range'>('all');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState(String(gh.plants.length));
  const [batchStatus, setBatchStatus] = useState<'keep' | PlantHealthStatus>('keep');
  const [batchFruiting, setBatchFruiting] = useState<'keep' | FruitingStatus>('keep');
  const [batchFruitQuality, setBatchFruitQuality] = useState<'keep' | FruitQuality>('keep');
  const [batchFruitCount, setBatchFruitCount] = useState('');
  const [batchHeightCm, setBatchHeightCm] = useState('');
  const [batchEstWeightKg, setBatchEstWeightKg] = useState('');
  const [batchFruit1WeightKg, setBatchFruit1WeightKg] = useState('');
  const [batchFruit2WeightKg, setBatchFruit2WeightKg] = useState('');
  const [batchBrix, setBatchBrix] = useState('');
  const [batchSymptom, setBatchSymptom] = useState('');
  const [batchAction, setBatchAction] = useState('');
  const [batchHarvestDate, setBatchHarvestDate] = useState('');
  const [batchInspectionDate, setBatchInspectionDate] = useState(() => toLocalDateInputValue());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([]);
  const [confirmClearAllPlants, setConfirmClearAllPlants] = useState(false);
  const [quickTargetScope, setQuickTargetScope] = useState<'auto' | 'all' | 'visible'>('auto');
  const [lastBatchUndo, setLastBatchUndo] = useState<{
    label: string;
    plants: PlantCondition[];
  } | null>(null);

  // String draft states & input refs for Single Plant Inspector numeric fields (prevents activeElement clobbering)
  const [heightInput, setHeightInput] = useState('0');
  const [fruitCountInput, setFruitCountInput] = useState('0');
  const [weightInput, setWeightInput] = useState('0');
  const [fruitWeightInputs, setFruitWeightInputs] = useState<string[]>([]);
  const [brixInput, setBrixInput] = useState('0');

  const avgWeightInputRef = useRef<HTMLInputElement | null>(null);
  const heightInputRef = useRef<HTMLInputElement | null>(null);
  const fruitCountInputRef = useRef<HTMLInputElement | null>(null);
  const weightInputRef = useRef<HTMLInputElement | null>(null);
  const fruitWeightInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const brixInputRef = useRef<HTMLInputElement | null>(null);

  const lastSyncedPlantIdRef = useRef<number | null>(null);
  const lastExternalNumRef = useRef<{
    heightCm: number;
    fruitCount: number;
    estWeightKg: number;
    fruitWeightsSig: string;
    brix: number;
  } | null>(null);

  useEffect(() => {
    setSelectedPlantIds([]);
    setMultiSelectMode(false);
    setConfirmClearAllPlants(false);
    setDateFilter('');
    setRangeStart('1');
    setRangeEnd(String(gh.plants.length));
    setLastBatchUndo(null);
  }, [gh.id, gh.plants.length]);

  useEffect(() => {
    if (selectedId > gh.plants.length || selectedId < 1) {
      setSelectedId(1);
    }
  }, [gh.plants.length, selectedId]);

  const counts = useMemo(() => {
    const res = {
      total: gh.plants.length,
      sehat: 0,
      perhatian: 0,
      sakit: 0,
      panen: 0,
      kosong: 0,
      berbuah: 0,
      tidak_berbuah: 0,
      bagus: 0,
      jelek: 0,
    };
    for (const p of gh.plants) {
      res[p.status] += 1;
      const fruiting = getFruiting(p);
      res[fruiting] += 1;
      if (p.status !== 'kosong' && fruiting === 'berbuah') {
        res[getFruitQuality(p)] += 1;
      }
    }
    return res;
  }, [gh.plants]);

  const weightMetrics = useMemo(() => {
    let sampledCount = 0;
    let sampledFruitCount = 0;
    let totalSampleWeightKg = 0;
    let fruitingActiveCount = 0;
    let twoFruitCount = 0;
    let totalFruits = 0;
    let goodPlantCount = 0;
    let badPlantCount = 0;
    let goodFruits = 0;
    let badFruits = 0;
    let goodSampledCount = 0;
    let badSampledCount = 0;
    let goodSampleWeightKg = 0;
    let badSampleWeightKg = 0;

    for (const p of gh.plants) {
      if (p.status === 'kosong') continue;
      if (p.estWeightKg > 0) {
        sampledCount += 1;
        totalSampleWeightKg += p.estWeightKg;
        const weights = getFruitWeights(p);
        const positiveWeights = weights.filter((w) => w > 0);
        if (Array.isArray(p.fruitWeights) && p.fruitWeights.length > 0 && positiveWeights.length > 0) {
          sampledFruitCount += positiveWeights.length;
        } else {
          sampledFruitCount += Math.max(1, p.fruitCount || 1);
        }
      }
      if (getFruiting(p) === 'berbuah') {
        fruitingActiveCount += 1;
        const fruitQty = Math.max(1, p.fruitCount || 0);
        if (fruitQty >= 2) twoFruitCount += 1;
        totalFruits += fruitQty;
        if (getFruitQuality(p) === 'jelek') {
          badPlantCount += 1;
          badFruits += fruitQty;
          if (p.estWeightKg > 0) {
            badSampledCount += 1;
            badSampleWeightKg += p.estWeightKg;
          }
        } else {
          goodPlantCount += 1;
          goodFruits += fruitQty;
          if (p.estWeightKg > 0) {
            goodSampledCount += 1;
            goodSampleWeightKg += p.estWeightKg;
          }
        }
      }
    }

    const sampleAvgKg = sampledFruitCount > 0 ? totalSampleWeightKg / sampledFruitCount : 0;
    const effectiveAvgKg =
      typeof gh.avgMelonWeightKg === 'number' && !Number.isNaN(gh.avgMelonWeightKg)
        ? gh.avgMelonWeightKg
        : sampleAvgKg > 0
        ? Number(sampleAvgKg.toFixed(2))
        : 1.5;

    const estimatedTotalKg = totalFruits * effectiveAvgKg;
    const goodEstimatedKg = goodFruits * effectiveAvgKg;
    const badEstimatedKg = badFruits * effectiveAvgKg;
    return {
      sampledCount,
      sampledFruitCount,
      totalSampleWeightKg,
      sampleAvgKg,
      fruitingActiveCount,
      twoFruitCount,
      totalFruits,
      effectiveAvgKg,
      estimatedTotalKg,
      goodPlantCount,
      badPlantCount,
      goodFruits,
      badFruits,
      goodSampledCount,
      badSampledCount,
      goodSampleWeightKg,
      badSampleWeightKg,
      goodEstimatedKg,
      badEstimatedKg,
    };
  }, [gh.plants, gh.avgMelonWeightKg]);

  const [avgWeightInput, setAvgWeightInput] = useState<string>(() =>
    String(weightMetrics.effectiveAvgKg)
  );
  const lastAvgGhRef = useRef<string>(gh.id);
  const lastAvgExtRef = useRef<number | undefined>(gh.avgMelonWeightKg);

  useEffect(() => {
    if (lastAvgGhRef.current !== gh.id) {
      lastAvgGhRef.current = gh.id;
      lastAvgExtRef.current = gh.avgMelonWeightKg;
      setAvgWeightInput(String(weightMetrics.effectiveAvgKg));
      return;
    }
    if (lastAvgExtRef.current !== gh.avgMelonWeightKg) {
      lastAvgExtRef.current = gh.avgMelonWeightKg;
      if (
        typeof gh.avgMelonWeightKg === 'number' &&
        document.activeElement !== avgWeightInputRef.current
      ) {
        setAvgWeightInput(String(gh.avgMelonWeightKg));
      }
    }
  }, [gh.id, gh.avgMelonWeightKg, weightMetrics.effectiveAvgKg]);

  const blockCount = Math.max(1, Math.ceil(gh.plants.length / 100));

  const visiblePlants = useMemo(() => {
    const base =
      viewMode === 'all'
        ? gh.plants
        : gh.plants.slice(activeBlock * 100, (activeBlock + 1) * 100);
    return base.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (fruitingFilter !== 'all' && getFruiting(p) !== fruitingFilter) return false;
      if (
        qualityFilter !== 'all' &&
        (p.status === 'kosong' ||
          getFruiting(p) !== 'berbuah' ||
          getFruitQuality(p) !== qualityFilter)
      ) {
        return false;
      }
      if (dateFilter && !matchesLocalDate(p.inspectionDate || p.updatedAt, dateFilter)) return false;
      return true;
    });
  }, [gh.plants, viewMode, activeBlock, statusFilter, fruitingFilter, qualityFilter, dateFilter]);

  const selectedPlant = useMemo(() => {
    return gh.plants[selectedId - 1] || gh.plants[0];
  }, [gh.plants, selectedId]);

  // Keep numeric drafts in sync when switching plant or when external action changes a value,
  // NEVER overwriting an input that currently holds user focus.
  useEffect(() => {
    if (!selectedPlant) return;
    const weights = getFruitWeights(selectedPlant);
    const slotCount = selectedPlant.fruitCount >= 2 ? Math.min(5, selectedPlant.fruitCount) : 0;
    const normalizedWeights = Array.from({ length: slotCount }, (_, i) =>
      Math.max(0, Number(weights[i] ?? 0) || 0)
    );
    const weightsSig = normalizedWeights.join('|');

    if (lastSyncedPlantIdRef.current !== selectedPlant.id) {
      lastSyncedPlantIdRef.current = selectedPlant.id;
      setHeightInput(String(selectedPlant.heightCm));
      setFruitCountInput(String(selectedPlant.fruitCount));
      setWeightInput(String(selectedPlant.estWeightKg));
      setFruitWeightInputs(normalizedWeights.map((w) => String(w)));
      setBrixInput(String(selectedPlant.brix));
      lastExternalNumRef.current = {
        heightCm: selectedPlant.heightCm,
        fruitCount: selectedPlant.fruitCount,
        estWeightKg: selectedPlant.estWeightKg,
        fruitWeightsSig: weightsSig,
        brix: selectedPlant.brix,
      };
      return;
    }

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const prevExt = lastExternalNumRef.current;

    if (
      (!prevExt || prevExt.heightCm !== selectedPlant.heightCm) &&
      activeEl !== heightInputRef.current
    ) {
      setHeightInput(String(selectedPlant.heightCm));
    }
    if (
      (!prevExt || prevExt.fruitCount !== selectedPlant.fruitCount) &&
      activeEl !== fruitCountInputRef.current
    ) {
      setFruitCountInput(String(selectedPlant.fruitCount));
    }
    if (
      (!prevExt || prevExt.estWeightKg !== selectedPlant.estWeightKg) &&
      activeEl !== weightInputRef.current
    ) {
      setWeightInput(String(selectedPlant.estWeightKg));
    }
    if (!prevExt || prevExt.fruitWeightsSig !== weightsSig) {
      setFruitWeightInputs((prevDrafts) =>
        normalizedWeights.map((w, idx) =>
          activeEl === fruitWeightInputRefs.current[idx] && prevDrafts[idx] !== undefined
            ? prevDrafts[idx]
            : String(w)
        )
      );
    }
    if (
      (!prevExt || prevExt.brix !== selectedPlant.brix) &&
      activeEl !== brixInputRef.current
    ) {
      setBrixInput(String(selectedPlant.brix));
    }
    lastExternalNumRef.current = {
      heightCm: selectedPlant.heightCm,
      fruitCount: selectedPlant.fruitCount,
      estWeightKg: selectedPlant.estWeightKg,
      fruitWeightsSig: weightsSig,
      brix: selectedPlant.brix,
    };
  }, [selectedPlant]);

  const handleSelectPlant = (id: number, scrollToInspector = false) => {
    setSelectedId(id);
    const blockIdx = Math.floor((id - 1) / 100);
    if (blockIdx >= 0 && blockIdx < blockCount) {
      setActiveBlock(blockIdx);
    }
    if (scrollToInspector) {
      setInspectorPulse(true);
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
      pulseTimerRef.current = window.setTimeout(() => {
        setInspectorPulse(false);
      }, 1200);
      window.requestAnimationFrame(() => {
        inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpNumber, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= gh.plants.length) {
      setStatusFilter('all');
      setFruitingFilter('all');
      setQualityFilter('all');
      setDateFilter('');
      handleSelectPlant(num, true);
    }
  };

  const updateSinglePlant = (id: number, patch: Partial<PlantCondition>) => {
    onUpdateGh((prev) => {
      const nextPlants = [...prev.plants];
      const idx = id - 1;
      if (!nextPlants[idx]) return prev;
      const chosenDate =
        patch.inspectionDate !== undefined
          ? patch.inspectionDate
          : lockInspectionDate
          ? lockedInspectionDate
          : toLocalDateInputValue();
      const nextUpdatedAt =
        patch.inspectionDate !== undefined || lockInspectionDate
          ? localDateInputToIsoWithCurrentTime(chosenDate || toLocalDateInputValue())
          : new Date().toISOString();

      nextPlants[idx] = {
        ...nextPlants[idx],
        ...patch,
        inspectionDate: chosenDate,
        updatedAt: nextUpdatedAt,
      };
      return { ...prev, plants: nextPlants };
    });
  };

  const getQuickTargetIds = (): Set<number> => {
    if (quickTargetScope === 'all') {
      return new Set(gh.plants.map((p) => p.id));
    }
    if (quickTargetScope === 'visible') {
      return new Set(visiblePlants.map((p) => p.id));
    }
    if (selectedPlantIds.length > 0) {
      return new Set(selectedPlantIds);
    }
    return new Set(gh.plants.map((p) => p.id));
  };

  const quickTargetCount = useMemo(() => {
    if (quickTargetScope === 'all') return gh.plants.length;
    if (quickTargetScope === 'visible') return visiblePlants.length;
    return selectedPlantIds.length > 0 ? selectedPlantIds.length : gh.plants.length;
  }, [quickTargetScope, gh.plants.length, visiblePlants.length, selectedPlantIds.length]);

  const applyQuickBulkUpdate = (
    label: string,
    mutatePlant: (p: PlantCondition) => Partial<PlantCondition>
  ) => {
    const idSet = getQuickTargetIds();
    if (idSet.size === 0) return;

    const chosenInspectionDate = lockInspectionDate
      ? lockedInspectionDate
      : toLocalDateInputValue();
    const stampedIso = localDateInputToIsoWithCurrentTime(chosenInspectionDate);

    onUpdateGh((prev) => {
      setLastBatchUndo({
        label: `${label} (${idSet.size} pohon)`,
        plants: prev.plants.map((p) => ({ ...p })),
      });
      return {
        ...prev,
        plants: prev.plants.map((p) =>
          idSet.has(p.id)
            ? {
                ...p,
                ...mutatePlant(p),
                inspectionDate: chosenInspectionDate,
                updatedAt: stampedIso,
              }
            : p
        ),
      };
    });
  };

  const handleUndoLastBatch = () => {
    if (!lastBatchUndo) return;
    const snapshot = lastBatchUndo.plants;
    onUpdateGh((prev) => ({
      ...prev,
      plants: snapshot,
    }));
    setLastBatchUndo(null);
  };

  const handleBatchApply = (e: React.FormEvent) => {
    e.preventDefault();
    const start = Math.max(1, Math.min(gh.plants.length, parseInt(rangeStart, 10) || 1));
    const end = Math.max(start, Math.min(gh.plants.length, parseInt(rangeEnd, 10) || start));
    const selectedSet = new Set(selectedPlantIds);
    const chosenInspectionDate = batchInspectionDate || toLocalDateInputValue();
    const stampedIso = localDateInputToIsoWithCurrentTime(chosenInspectionDate);

    const parsedHeight =
      batchHeightCm.trim() !== '' && !Number.isNaN(Number(batchHeightCm))
        ? Math.max(0, Number(batchHeightCm))
        : null;
    const parsedFruitCount =
      batchFruitCount.trim() !== '' && !Number.isNaN(Number(batchFruitCount))
        ? Math.max(0, Math.round(Number(batchFruitCount)))
        : null;
    const parsedWeight =
      batchEstWeightKg.trim() !== '' && !Number.isNaN(Number(batchEstWeightKg))
        ? Math.max(0, Number(batchEstWeightKg))
        : null;
    const parsedFruit1W =
      batchFruit1WeightKg.trim() !== '' && !Number.isNaN(Number(batchFruit1WeightKg))
        ? Math.max(0, Number(batchFruit1WeightKg))
        : null;
    const parsedFruit2W =
      batchFruit2WeightKg.trim() !== '' && !Number.isNaN(Number(batchFruit2WeightKg))
        ? Math.max(0, Number(batchFruit2WeightKg))
        : null;
    const parsedBrix =
      batchBrix.trim() !== '' && !Number.isNaN(Number(batchBrix))
        ? Math.max(0, Number(batchBrix))
        : null;

    const targetLabel =
      batchTargetMode === 'all'
        ? `Semua 1–${gh.plants.length}`
        : batchTargetMode === 'selected'
        ? `${selectedSet.size} terpilih`
        : `No. ${start}–${end}`;

    onUpdateGh((prev) => {
      setLastBatchUndo({
        label: `Isi massal (${targetLabel})`,
        plants: prev.plants.map((p) => ({ ...p })),
      });
      const nextPlants = prev.plants.map((p) => {
        const matchesTarget =
          batchTargetMode === 'all'
            ? true
            : batchTargetMode === 'selected'
            ? selectedSet.has(p.id)
            : p.id >= start && p.id <= end;

        if (!matchesTarget) return p;

        const nextStatus = batchStatus === 'keep' ? p.status : batchStatus;
        let nextFruiting = batchFruiting === 'keep' ? getFruiting(p) : batchFruiting;
        let nextFruitCount = parsedFruitCount !== null ? parsedFruitCount : p.fruitCount;
        const nextQuality =
          batchFruitQuality === 'keep' ? getFruitQuality(p) : batchFruitQuality;

        if (parsedFruitCount !== null && batchFruiting === 'keep') {
          nextFruiting = parsedFruitCount > 0 ? 'berbuah' : 'tidak_berbuah';
        } else if (batchFruiting === 'berbuah' && parsedFruitCount === null) {
          nextFruitCount = Math.max(1, p.fruitCount);
        } else if (batchFruiting === 'tidak_berbuah' && parsedFruitCount === null) {
          nextFruitCount = 0;
        } else if (
          batchFruitQuality !== 'keep' &&
          batchFruiting === 'keep' &&
          parsedFruitCount === null
        ) {
          nextFruiting = 'berbuah';
          nextFruitCount = Math.max(1, p.fruitCount);
        }

        let nextFruitWeights = p.fruitWeights ? [...p.fruitWeights] : undefined;
        let nextEstWeightKg = parsedWeight !== null ? parsedWeight : p.estWeightKg;

        if (nextFruitCount === 2 && (parsedFruit1W !== null || parsedFruit2W !== null)) {
          const existing = getFruitWeights(p);
          const w1 = parsedFruit1W !== null ? parsedFruit1W : existing[0] ?? 0;
          const w2 = parsedFruit2W !== null ? parsedFruit2W : existing[1] ?? 0;
          nextFruitWeights = [w1, w2];
          nextEstWeightKg = Number((w1 + w2).toFixed(2));
        } else if (parsedFruitCount !== null) {
          if (parsedWeight !== null) {
            nextFruitWeights = nextFruitCount === 1 ? [parsedWeight] : nextFruitWeights;
          } else {
            const adjusted = adjustWeightsForCount(
              getFruitWeights(p),
              nextFruitCount,
              p.estWeightKg
            );
            nextFruitWeights = adjusted.fruitWeights;
            nextEstWeightKg = adjusted.estWeightKg;
          }
        } else if (parsedWeight !== null && nextFruitCount === 1) {
          nextFruitWeights = [parsedWeight];
        }

        return {
          ...p,
          status: nextStatus,
          fruitingStatus: nextFruiting,
          fruitQuality: nextQuality,
          fruitCount: nextFruitCount,
          heightCm: parsedHeight !== null ? parsedHeight : p.heightCm,
          estWeightKg: nextEstWeightKg,
          ...(nextFruitWeights !== undefined ? { fruitWeights: nextFruitWeights } : {}),
          brix: parsedBrix !== null ? parsedBrix : p.brix,
          symptom: batchSymptom.trim() || p.symptom,
          lastAction: batchAction.trim() || p.lastAction,
          harvestDate: batchHarvestDate || p.harvestDate,
          inspectionDate: chosenInspectionDate,
          updatedAt: stampedIso,
        };
      });
      return { ...prev, plants: nextPlants };
    });

    setShowBatchPanel(false);
  };

  const resetPlantFields = (p: PlantCondition, now: string): PlantCondition => ({
    ...p,
    status: 'kosong',
    fruitingStatus: 'tidak_berbuah',
    fruitQuality: 'bagus',
    symptom: 'Data dihapus / slot kosong',
    heightCm: 0,
    fruitCount: 0,
    estWeightKg: 0,
    fruitWeights: [],
    brix: 0,
    lastAction: 'Dihapus manual',
    notes: '',
    harvestDate: '',
    updatedAt: now,
  });

  const handleDeleteSinglePlant = (id: number) => {
    const now = new Date().toISOString();
    onUpdateGh((prev) => ({
      ...prev,
      plants: prev.plants.map((p) => (p.id === id ? resetPlantFields(p, now) : p)),
    }));
    setSelectedPlantIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDeleteSelectedPlants = () => {
    if (selectedPlantIds.length === 0) return;
    const idSet = new Set(selectedPlantIds);
    const now = new Date().toISOString();
    onUpdateGh((prev) => ({
      ...prev,
      plants: prev.plants.map((p) => (idSet.has(p.id) ? resetPlantFields(p, now) : p)),
    }));
    setSelectedPlantIds([]);
  };

  const handleDeleteAllPlants = () => {
    const now = new Date().toISOString();
    onUpdateGh((prev) => ({
      ...prev,
      plants: prev.plants.map((p) => resetPlantFields(p, now)),
    }));
    setSelectedPlantIds([]);
    setConfirmClearAllPlants(false);
  };

  const toggleMultiSelectPlant = (id: number) => {
    setSelectedPlantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const getCellColor = (plant: PlantCondition) => {
    if (colorMode === 'fruiting') {
      return FRUITING_STATUS_META[getFruiting(plant)].cellBg;
    }
    if (colorMode === 'quality') {
      if (plant.status === 'kosong') return PLANT_STATUS_META.kosong.cellBg;
      if (getFruiting(plant) === 'tidak_berbuah') {
        return FRUITING_STATUS_META.tidak_berbuah.cellBg;
      }
      return FRUIT_QUALITY_META[getFruitQuality(plant)].cellBg;
    }
    return PLANT_STATUS_META[plant.status].cellBg;
  };

  const getPlantConditionDot = (
    plant: PlantCondition
  ): { color: string; title: string } | null => {
    const fruiting = getFruiting(plant);
    const quality = getFruitQuality(plant);
    const healthMeta = PLANT_STATUS_META[plant.status];

    if (colorMode === 'health') {
      if (plant.status === 'kosong') return null;
      if (fruiting === 'berbuah') {
        return quality === 'jelek'
          ? { color: '#FB7185', title: `Kondisi Buah: Jelek (${plant.fruitCount || 1} buah)` }
          : { color: '#4ADE80', title: `Kondisi Buah: Bagus (${plant.fruitCount || 1} buah)` };
      }
      return { color: '#FBBF24', title: 'Status: Tidak Berbuah' };
    }

    return {
      color: healthMeta.cellBg,
      title: `Kesehatan: ${healthMeta.short}`,
    };
  };

  return (
    <div className="space-y-6">
      {/* Health + Fruiting Summary Strip */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setFruitingFilter('all');
              setQualityFilter('all');
            }}
            className="rounded-xl border p-3.5 text-left transition-colors cursor-pointer"
            style={{
              backgroundColor:
                statusFilter === 'all' && fruitingFilter === 'all' && qualityFilter === 'all'
                  ? 'var(--app-accent-soft)'
                  : 'var(--app-surface)',
              borderColor:
                statusFilter === 'all' && fruitingFilter === 'all' && qualityFilter === 'all'
                  ? 'var(--app-accent)'
                  : 'var(--app-border)',
            }}
          >
            <div className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
              Total Populasi
            </div>
            <div className="mt-1.5 text-2xl font-bold font-mono-tabular">
              {counts.total.toLocaleString('id-ID')}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              1 s/d {counts.total} pohon
            </div>
          </button>

          {(
            [
              { key: 'sehat', icon: CheckCircle2 },
              { key: 'perhatian', icon: AlertCircle },
              { key: 'sakit', icon: XCircle },
              { key: 'panen', icon: Sparkles },
              { key: 'kosong', icon: Layers },
            ] as Array<{ key: PlantHealthStatus; icon: React.ComponentType<{ className?: string }> }>
          ).map(({ key, icon: Icon }) => {
            const meta = PLANT_STATUS_META[key];
            const active = statusFilter === key;
            const pct = counts.total > 0 ? ((counts[key] / counts.total) * 100).toFixed(1) : '0.0';
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setColorMode('health');
                  setStatusFilter(active ? 'all' : key);
                }}
                className="rounded-xl border p-3.5 text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-surface-muted)' : 'var(--app-surface)',
                  borderColor: active ? meta.cellBg : 'var(--app-border)',
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${meta.colorClass}`}>{meta.short}</span>
                  <Icon className={`h-3.5 w-3.5 ${meta.colorClass}`} />
                </div>
                <div className="mt-1.5 text-2xl font-bold font-mono-tabular">
                  {counts[key].toLocaleString('id-ID')}
                </div>
                <div className="mt-1 text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  {pct}% populasi
                </div>
              </button>
            );
          })}
        </div>

        {/* Berbuah & Tidak Berbuah + Kondisi Buah (Bagus / Jelek) Summary Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['berbuah', 'tidak_berbuah'] as FruitingStatus[]).map((fKey) => {
            const meta = FRUITING_STATUS_META[fKey];
            const active = fruitingFilter === fKey;
            const pct = counts.total > 0 ? ((counts[fKey] / counts.total) * 100).toFixed(1) : '0.0';
            return (
              <button
                key={fKey}
                type="button"
                onClick={() => {
                  setColorMode('fruiting');
                  setQualityFilter('all');
                  setFruitingFilter(active ? 'all' : fKey);
                }}
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-surface-muted)' : 'var(--app-surface)',
                  borderColor: active ? meta.cellBg : 'var(--app-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ backgroundColor: meta.cellBg }}
                  >
                    <Apple className="h-4 w-4" />
                  </span>
                  <div>
                    <div className={`text-xs font-semibold ${meta.colorClass}`}>
                      {meta.label}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      {active ? 'Filter aktif — klik lagi' : 'Klik untuk filter peta'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="text-xl font-bold">{counts[fKey].toLocaleString('id-ID')}</div>
                  <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    {pct}%
                  </div>
                </div>
              </button>
            );
          })}

          {(['bagus', 'jelek'] as FruitQuality[]).map((qKey) => {
            const meta = FRUIT_QUALITY_META[qKey];
            const active = qualityFilter === qKey;
            const estKg =
              qKey === 'bagus' ? weightMetrics.goodEstimatedKg : weightMetrics.badEstimatedKg;
            const fruitQty =
              qKey === 'bagus' ? weightMetrics.goodFruits : weightMetrics.badFruits;
            const pctFruiting =
              weightMetrics.fruitingActiveCount > 0
                ? ((counts[qKey] / weightMetrics.fruitingActiveCount) * 100).toFixed(1)
                : '0.0';
            return (
              <button
                key={qKey}
                type="button"
                onClick={() => {
                  setColorMode('quality');
                  setFruitingFilter('all');
                  setQualityFilter(active ? 'all' : qKey);
                }}
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-surface-muted)' : 'var(--app-surface)',
                  borderColor: active ? meta.cellBg : 'var(--app-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ backgroundColor: meta.cellBg }}
                  >
                    {qKey === 'bagus' ? (
                      <ThumbsUp className="h-4 w-4" />
                    ) : (
                      <ThumbsDown className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <div className={`text-xs font-semibold ${meta.colorClass}`}>
                      Kondisi: {meta.label}
                    </div>
                    <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                      {counts[qKey].toLocaleString('id-ID')} phn ({pctFruiting}%) · {fruitQty.toLocaleString('id-ID')} buah
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className={`text-lg font-bold ${meta.colorClass}`}>
                    {estKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                    {active ? 'Filter aktif' : 'Klik filter'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Rata-Rata Berat Melon & Perkiraan Total Berat Melon */}
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  backgroundColor: 'var(--app-accent-soft)',
                  color: 'var(--app-accent)',
                }}
              >
                <Scale className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-bold">
                  Rata-Rata Berat Melon &amp; Perkiraan Total Panen ({gh.name})
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Hitung perkiraan total tonase panen dari rata-rata berat buah (kg/melon) dikalikan total buah yang berbuah.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
              {/* Editable Average Weight Input */}
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="avg-melon-weight-input"
                  className="block text-[11px] font-medium mb-1"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  Rata-Rata / Buah (kg)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={avgWeightInputRef}
                    id="avg-melon-weight-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={avgWeightInput}
                    onFocus={() => {
                      if (avgWeightInput === '0') setAvgWeightInput('');
                    }}
                    onBlur={() => {
                      if (avgWeightInput.trim() === '' || avgWeightInput === '.') {
                        setAvgWeightInput(String(gh.avgMelonWeightKg ?? 0));
                      } else {
                        const parsed = Number(avgWeightInput);
                        if (!Number.isNaN(parsed)) {
                          setAvgWeightInput(String(Math.min(50, Math.max(0, Number(parsed.toFixed(2))))));
                        }
                      }
                    }}
                    onChange={(e) => {
                      const raw = sanitizeDecimalDraft(e.target.value);
                      setAvgWeightInput(raw);
                      if (raw.trim() === '' || raw === '.') {
                        lastAvgExtRef.current = 0;
                        onUpdateGh((prev) => ({ ...prev, avgMelonWeightKg: 0 }));
                        return;
                      }
                      const num = Number(raw);
                      if (!Number.isNaN(num)) {
                        const clamped = Math.min(50, Math.max(0, Number(num.toFixed(2))));
                        lastAvgExtRef.current = clamped;
                        onUpdateGh((prev) => ({ ...prev, avgMelonWeightKg: clamped }));
                      }
                    }}
                    className="h-9 w-24 rounded-lg border px-2.5 text-sm font-bold font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                  {weightMetrics.sampleAvgKg > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const rounded = Number(weightMetrics.sampleAvgKg.toFixed(2));
                        lastAvgExtRef.current = rounded;
                        setAvgWeightInput(String(rounded));
                        onUpdateGh((prev) => ({ ...prev, avgMelonWeightKg: rounded }));
                      }}
                      title={`Gunakan rata-rata dari ${weightMetrics.sampledFruitCount} sampel buah (${weightMetrics.sampleAvgKg.toFixed(2)} kg/buah)`}
                      className="h-9 rounded-lg border px-2.5 text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface-muted)',
                        color: 'var(--app-accent)',
                      }}
                    >
                      Sampel ({weightMetrics.sampleAvgKg.toFixed(2)} kg)
                    </button>
                  )}
                </div>
              </div>

              {/* Buah Aktif */}
              <div
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Total Buah Aktif
                </div>
                <div className="text-sm font-bold font-mono-tabular">
                  {weightMetrics.totalFruits.toLocaleString('id-ID')} buah
                </div>
                <div className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  {weightMetrics.fruitingActiveCount.toLocaleString('id-ID')} phn
                  {weightMetrics.twoFruitCount > 0
                    ? ` (${weightMetrics.twoFruitCount} berbuah 2)`
                    : ' berbuah'}
                </div>
              </div>

              {/* Total Bobot Tercatat Sampel */}
              <div
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Total Sampel Input
                </div>
                <div className="text-sm font-bold font-mono-tabular">
                  {weightMetrics.totalSampleWeightKg.toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </div>
                <div className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  {weightMetrics.sampledCount.toLocaleString('id-ID')} pohon terisi bobot
                </div>
              </div>

              {/* Perkiraan Total Berat Melon */}
              <div
                className="col-span-2 sm:col-span-1 rounded-lg border px-3.5 py-2"
                style={{
                  borderColor: 'var(--app-accent)',
                  backgroundColor: 'var(--app-accent-soft)',
                }}
              >
                <div className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
                  Perkiraan Total Berat Melon
                </div>
                <div className="text-base sm:text-lg font-bold font-mono-tabular" style={{ color: 'var(--app-accent)' }}>
                  {weightMetrics.estimatedTotalKg.toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </div>
                <div className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  {(weightMetrics.estimatedTotalKg / 100).toLocaleString('id-ID', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  kuintal
                  {weightMetrics.estimatedTotalKg >= 1000
                    ? ` · ${(weightMetrics.estimatedTotalKg / 1000).toLocaleString('id-ID', {
                        maximumFractionDigits: 2,
                      })} ton`
                    : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Berat Buah Bagus vs Jelek */}
          <div
            className="mt-3 grid grid-cols-1 gap-2.5 border-t pt-3 sm:grid-cols-2"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <div
              className="flex items-center justify-between rounded-lg border px-3.5 py-2.5"
              style={{
                borderColor: FRUIT_QUALITY_META.bagus.cellBg,
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white shrink-0"
                  style={{ backgroundColor: FRUIT_QUALITY_META.bagus.cellBg }}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Total Buah Bagus
                  </div>
                  <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                    {weightMetrics.goodPlantCount.toLocaleString('id-ID')} pohon ·{' '}
                    {weightMetrics.goodFruits.toLocaleString('id-ID')} buah
                    {weightMetrics.goodSampleWeightKg > 0
                      ? ` · input bobot ${weightMetrics.goodSampleWeightKg.toLocaleString('id-ID', {
                          maximumFractionDigits: 1,
                        })} kg`
                      : ''}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono-tabular">
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {weightMetrics.goodEstimatedKg.toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </div>
                <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  {weightMetrics.estimatedTotalKg > 0
                    ? `${((weightMetrics.goodEstimatedKg / weightMetrics.estimatedTotalKg) * 100).toFixed(1)}% dari total`
                    : '0%'}
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-lg border px-3.5 py-2.5"
              style={{
                borderColor: FRUIT_QUALITY_META.jelek.cellBg,
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white shrink-0"
                  style={{ backgroundColor: FRUIT_QUALITY_META.jelek.cellBg }}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Total Buah Jelek
                  </div>
                  <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                    {weightMetrics.badPlantCount.toLocaleString('id-ID')} pohon ·{' '}
                    {weightMetrics.badFruits.toLocaleString('id-ID')} buah
                    {weightMetrics.badSampleWeightKg > 0
                      ? ` · input bobot ${weightMetrics.badSampleWeightKg.toLocaleString('id-ID', {
                          maximumFractionDigits: 1,
                        })} kg`
                      : ''}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono-tabular">
                <div className="text-base font-bold text-rose-700 dark:text-rose-400">
                  {weightMetrics.badEstimatedKg.toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </div>
                <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  {weightMetrics.estimatedTotalKg > 0
                    ? `${((weightMetrics.badEstimatedKg / weightMetrics.estimatedTotalKg) * 100).toFixed(1)}% dari total`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Left 1-1000 Matrix (8 cols) + Right Plant Inspector (4 cols) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Matrix Viewport */}
        <section
          ref={matrixTopRef}
          className="rounded-xl border p-4 sm:p-5 xl:col-span-8 scroll-mt-24"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          {/* Controls Header */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 rounded-lg p-1"
                style={{ backgroundColor: 'var(--app-surface-muted)' }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('block')}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: viewMode === 'block' ? 'var(--app-surface)' : 'transparent',
                    color: viewMode === 'block' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Per Blok (100)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: viewMode === 'all' ? 'var(--app-surface)' : 'transparent',
                    color: viewMode === 'all' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  Semua 1–{gh.plants.length}
                </button>
              </div>

              {/* Map Color Mode Toggle: Kesehatan vs Berbuah vs Kondisi Buah */}
              <div
                className="flex flex-wrap items-center gap-1 rounded-lg p-1"
                style={{ backgroundColor: 'var(--app-surface-muted)' }}
              >
                <button
                  type="button"
                  onClick={() => setColorMode('health')}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: colorMode === 'health' ? 'var(--app-surface)' : 'transparent',
                    color: colorMode === 'health' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  Warna: Kesehatan
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('fruiting')}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: colorMode === 'fruiting' ? 'var(--app-surface)' : 'transparent',
                    color: colorMode === 'fruiting' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  Warna: Berbuah
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('quality')}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: colorMode === 'quality' ? 'var(--app-surface)' : 'transparent',
                    color: colorMode === 'quality' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  Warna: Kondisi Buah
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBatchTargetMode(selectedPlantIds.length > 0 ? 'selected' : 'all');
                  setShowBatchPanel((v) => !v);
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-85 cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: showBatchPanel ? 'var(--app-accent)' : 'var(--app-border)',
                  backgroundColor: showBatchPanel ? 'var(--app-accent-soft)' : 'transparent',
                  color: showBatchPanel ? 'var(--app-accent)' : 'var(--app-text)',
                }}
              >
                Isi Semua / Rentang
              </button>

              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode((v) => !v);
                  if (multiSelectMode) setSelectedPlantIds([]);
                }}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-85 cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: multiSelectMode ? 'var(--app-accent)' : 'var(--app-border)',
                  backgroundColor: multiSelectMode ? 'var(--app-accent-soft)' : 'transparent',
                  color: multiSelectMode ? 'var(--app-accent)' : 'var(--app-text)',
                }}
              >
                {multiSelectMode ? 'Selesai Pilih' : 'Pilih Banyak'}
              </button>
            </div>

            {/* Jump to plant # + Filter Tanggal Pemeriksaan */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center">
                  <Calendar
                    className="pointer-events-none absolute left-2.5 h-3.5 w-3.5"
                    style={{ color: 'var(--app-text-muted)' }}
                  />
                  <input
                    type="date"
                    aria-label="Filter tanggal pemeriksaan tanaman"
                    title="Filter tanaman berdasarkan tanggal pemeriksaan"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="h-9 rounded-lg border pl-8 pr-2 text-xs font-mono-tabular focus:outline-none"
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
                  className="h-9 rounded-lg border px-2.5 text-xs font-medium cursor-pointer whitespace-nowrap"
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
                    className="h-9 rounded-lg border px-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text-muted)',
                    }}
                  >
                    Semua Tgl
                  </button>
                )}
              </div>

              <form onSubmit={handleJump} className="flex items-center gap-1.5">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                    style={{ color: 'var(--app-text-muted)' }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={gh.plants.length}
                    value={jumpNumber}
                    onChange={(e) => setJumpNumber(e.target.value)}
                    placeholder={`No. 1–${gh.plants.length}`}
                    className="h-9 w-28 rounded-lg border pl-8 pr-2 text-xs font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="h-9 rounded-lg px-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--app-accent)',
                    color: 'var(--app-accent-fg)',
                  }}
                >
                  Cari No.
                </button>
              </form>
            </div>
          </div>

          {/* Bulk Selection & Delete Controls Bar for Plants */}
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode(true);
                  const allIds = gh.plants.map((p) => p.id);
                  const allSelected =
                    allIds.length > 0 && selectedPlantIds.length === allIds.length;
                  if (allSelected) {
                    setSelectedPlantIds([]);
                  } else {
                    setSelectedPlantIds(allIds);
                  }
                }}
                className="rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer"
                style={{
                  borderColor:
                    gh.plants.length > 0 && selectedPlantIds.length === gh.plants.length
                      ? 'var(--app-accent)'
                      : 'var(--app-border)',
                  backgroundColor:
                    gh.plants.length > 0 && selectedPlantIds.length === gh.plants.length
                      ? 'var(--app-accent-soft)'
                      : 'var(--app-surface)',
                  color:
                    gh.plants.length > 0 && selectedPlantIds.length === gh.plants.length
                      ? 'var(--app-accent)'
                      : 'var(--app-text)',
                }}
              >
                {gh.plants.length > 0 && selectedPlantIds.length === gh.plants.length
                  ? `Batal Semua (1–${gh.plants.length})`
                  : `Pilih Semua (1–${gh.plants.length})`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode(true);
                  const visibleIds = visiblePlants.map((p) => p.id);
                  const allVisibleSelected =
                    visibleIds.length > 0 &&
                    visibleIds.every((id) => selectedPlantIds.includes(id));
                  if (allVisibleSelected) {
                    setSelectedPlantIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                  } else {
                    setSelectedPlantIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                  }
                }}
                className="rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                }}
              >
                {visiblePlants.length > 0 &&
                visiblePlants.every((p) => selectedPlantIds.includes(p.id))
                  ? `Batal Tampil (${visiblePlants.length})`
                  : `Pilih Semua Tampil (${visiblePlants.length})`}
              </button>

              {selectedPlantIds.length > 0 && (
                <>
                  <span className="font-mono-tabular font-semibold" style={{ color: 'var(--app-accent)' }}>
                    {selectedPlantIds.length} tanaman dipilih
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlantIds([])}
                    className="rounded-md border px-2 py-1 text-[11px] font-medium cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text-muted)',
                    }}
                  >
                    Bersihkan Pilihan
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedPlantIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedPlants}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Dipilih ({selectedPlantIds.length})
                </button>
              )}

              {!confirmClearAllPlants ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAllPlants(true)}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Semua
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    Kosongkan semua 1–{gh.plants.length}?
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteAllPlants}
                    className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                  >
                    Ya, Hapus Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAllPlants(false)}
                    className="rounded-md border px-2 py-1 text-xs cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 1-Click Simultaneous Condition Fill Strip */}
          <div
            className="mt-2.5 flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-surface-muted)',
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Aksi Cepat Bersamaan:</span>
              <div
                className="inline-flex items-center gap-1 rounded-md p-0.5 border"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setQuickTargetScope('auto')}
                  className="rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                  style={{
                    backgroundColor: quickTargetScope === 'auto' ? 'var(--app-accent-soft)' : 'transparent',
                    color: quickTargetScope === 'auto' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  {selectedPlantIds.length > 0
                    ? `Dipilih (${selectedPlantIds.length})`
                    : `Semua (${gh.plants.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTargetScope('visible')}
                  className="rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                  style={{
                    backgroundColor: quickTargetScope === 'visible' ? 'var(--app-accent-soft)' : 'transparent',
                    color: quickTargetScope === 'visible' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  Tampil ({visiblePlants.length})
                </button>
                {selectedPlantIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuickTargetScope('all')}
                    className="rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                    style={{
                      backgroundColor: quickTargetScope === 'all' ? 'var(--app-accent-soft)' : 'transparent',
                      color: quickTargetScope === 'all' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    }}
                  >
                    Semua ({gh.plants.length})
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Semua Berbuah', (p) => ({
                    fruitingStatus: 'berbuah',
                    fruitCount: Math.max(1, p.fruitCount),
                  }))
                }
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: FRUITING_STATUS_META.berbuah.cellBg }}
              >
                <Apple className="h-3.5 w-3.5" />
                {quickTargetCount === gh.plants.length
                  ? 'Semua Berbuah'
                  : `Set Berbuah (${quickTargetCount})`}
              </button>

              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Berbuah 2', (p) => {
                    const adjusted = adjustWeightsForCount(
                      getFruitWeights(p),
                      2,
                      p.estWeightKg
                    );
                    return {
                      fruitingStatus: 'berbuah',
                      fruitCount: 2,
                      fruitWeights: adjusted.fruitWeights,
                      estWeightKg: adjusted.estWeightKg,
                    };
                  })
                }
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-40"
                style={{
                  borderColor: FRUITING_STATUS_META.berbuah.cellBg,
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-accent)',
                }}
              >
                <Apple className="h-3.5 w-3.5" />
                {quickTargetCount === gh.plants.length
                  ? 'Semua Berbuah 2'
                  : `Berbuah 2 (${quickTargetCount})`}
              </button>

              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Semua Tidak Berbuah', () => ({
                    fruitingStatus: 'tidak_berbuah',
                    fruitCount: 0,
                    fruitWeights: [],
                    estWeightKg: 0,
                  }))
                }
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-40"
                style={{
                  borderColor: FRUITING_STATUS_META.tidak_berbuah.cellBg,
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-text)',
                }}
              >
                {quickTargetCount === gh.plants.length
                  ? 'Semua Tidak Berbuah'
                  : `Tidak Berbuah (${quickTargetCount})`}
              </button>

              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Buah Bagus', (p) => ({
                    fruitingStatus: 'berbuah',
                    fruitCount: Math.max(1, p.fruitCount),
                    fruitQuality: 'bagus',
                  }))
                }
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: FRUIT_QUALITY_META.bagus.cellBg }}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {quickTargetCount === gh.plants.length
                  ? 'Semua Buah Bagus'
                  : `Buah Bagus (${quickTargetCount})`}
              </button>

              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Buah Jelek', (p) => ({
                    fruitingStatus: 'berbuah',
                    fruitCount: Math.max(1, p.fruitCount),
                    fruitQuality: 'jelek',
                  }))
                }
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: FRUIT_QUALITY_META.jelek.cellBg }}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {quickTargetCount === gh.plants.length
                  ? 'Semua Buah Jelek'
                  : `Buah Jelek (${quickTargetCount})`}
              </button>

              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Semua Sehat', () => ({
                    status: 'sehat',
                    symptom: 'Pertumbuhan normal',
                  }))
                }
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: PLANT_STATUS_META.sehat.cellBg }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {quickTargetCount === gh.plants.length
                  ? 'Semua Sehat'
                  : `Set Sehat (${quickTargetCount})`}
              </button>

              <button
                type="button"
                disabled={quickTargetCount === 0}
                onClick={() =>
                  applyQuickBulkUpdate('Semua Siap Panen', () => ({
                    status: 'panen',
                  }))
                }
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: PLANT_STATUS_META.panen.cellBg }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {quickTargetCount === gh.plants.length
                  ? 'Semua Siap Panen'
                  : `Siap Panen (${quickTargetCount})`}
              </button>
            </div>
          </div>

          {/* Inline Undo Banner after Quick/Batch Update */}
          {lastBatchUndo && (
            <div
              className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: 'var(--app-accent)',
                backgroundColor: 'var(--app-accent-soft)',
              }}
            >
              <span className="font-medium">
                Berhasil menerapkan <strong>{lastBatchUndo.label}</strong>.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoLastBatch}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-accent)',
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Urungkan
                </button>
                <button
                  type="button"
                  onClick={() => setLastBatchUndo(null)}
                  className="text-[11px] underline cursor-pointer"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* Batch All / Selected / Range Manual Edit Drawer */}
          {showBatchPanel && (
            <form
              onSubmit={handleBatchApply}
              className="mt-4 rounded-lg border p-4 space-y-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-surface-muted)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  Pembaruan Kondisi Tanaman Bersamaan (Semua / Dipilih / Rentang)
                </span>
                <button
                  type="button"
                  onClick={() => setShowBatchPanel(false)}
                  className="text-xs underline cursor-pointer"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  Tutup
                </button>
              </div>

              {/* Target mode selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--app-text-muted)' }}>
                  Target:
                </span>
                {(
                  [
                    { id: 'all', label: `Semua Tanaman (1–${gh.plants.length})` },
                    {
                      id: 'selected',
                      label: `Dipilih (${selectedPlantIds.length})`,
                      disabled: selectedPlantIds.length === 0,
                    },
                    { id: 'range', label: 'Rentang Nomor' },
                  ] as Array<{ id: 'all' | 'selected' | 'range'; label: string; disabled?: boolean }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => setBatchTargetMode(opt.id)}
                    className="rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: batchTargetMode === opt.id ? 'var(--app-accent)' : 'var(--app-border)',
                      backgroundColor:
                        batchTargetMode === opt.id ? 'var(--app-accent)' : 'var(--app-surface)',
                      color:
                        batchTargetMode === opt.id ? 'var(--app-accent-fg)' : 'var(--app-text)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {batchTargetMode === 'range' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium mb-1">Dari No.</label>
                      <input
                        type="number"
                        min={1}
                        max={gh.plants.length}
                        placeholder="1"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1">Sampai No.</label>
                      <input
                        type="number"
                        min={1}
                        max={gh.plants.length}
                        placeholder={String(gh.plants.length)}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[11px] font-medium mb-1">Kesehatan</label>
                  <select
                    value={batchStatus}
                    onChange={(e) => setBatchStatus(e.target.value as 'keep' | PlantHealthStatus)}
                    className="w-full rounded-md border px-2 py-1.5 text-xs"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  >
                    <option value="keep">Tidak diubah</option>
                    <option value="sehat">Sehat / Optimal</option>
                    <option value="perhatian">Perlu Perhatian</option>
                    <option value="sakit">Sakit / Terinfeksi</option>
                    <option value="panen">Siap Panen</option>
                    <option value="kosong">Kosong / Sulam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Status Berbuah</label>
                  <select
                    value={batchFruiting}
                    onChange={(e) => setBatchFruiting(e.target.value as 'keep' | FruitingStatus)}
                    className="w-full rounded-md border px-2 py-1.5 text-xs"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  >
                    <option value="keep">Tidak diubah</option>
                    <option value="berbuah">Berbuah</option>
                    <option value="tidak_berbuah">Tidak Berbuah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Kondisi Buah</label>
                  <select
                    value={batchFruitQuality}
                    onChange={(e) => setBatchFruitQuality(e.target.value as 'keep' | FruitQuality)}
                    className="w-full rounded-md border px-2 py-1.5 text-xs"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  >
                    <option value="keep">Tidak diubah</option>
                    <option value="bagus">Bagus</option>
                    <option value="jelek">Jelek</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium">Jumlah Buah</label>
                    <div className="flex items-center gap-1">
                      {[1, 2].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setBatchFruitCount(String(qty))}
                          className="rounded border px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer"
                          style={{
                            borderColor:
                              batchFruitCount === String(qty)
                                ? 'var(--app-accent)'
                                : 'var(--app-border)',
                            backgroundColor:
                              batchFruitCount === String(qty)
                                ? 'var(--app-accent-soft)'
                                : 'var(--app-surface)',
                            color:
                              batchFruitCount === String(qty)
                                ? 'var(--app-accent)'
                                : 'var(--app-text-muted)',
                          }}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={batchFruitCount}
                    onChange={(e) => setBatchFruitCount(sanitizeIntDraft(e.target.value))}
                    placeholder="Tidak diubah"
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Tinggi Sulur (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={batchHeightCm}
                    onChange={(e) => setBatchHeightCm(sanitizeDecimalDraft(e.target.value))}
                    placeholder="Tidak diubah"
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                {batchFruitCount === '2' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium mb-1">
                        Bobot Buah 1 (kg)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={batchFruit1WeightKg}
                        onChange={(e) =>
                          setBatchFruit1WeightKg(sanitizeDecimalDraft(e.target.value))
                        }
                        placeholder="Opsional (kg)"
                        className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1">
                        Bobot Buah 2 (kg)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={batchFruit2WeightKg}
                        onChange={(e) =>
                          setBatchFruit2WeightKg(sanitizeDecimalDraft(e.target.value))
                        }
                        placeholder="Opsional (kg)"
                        className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Est. Bobot (kg)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={batchEstWeightKg}
                      onChange={(e) => setBatchEstWeightKg(sanitizeDecimalDraft(e.target.value))}
                      placeholder="Tidak diubah"
                      className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium mb-1">Kadar Brix (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={25}
                    value={batchBrix}
                    onChange={(e) => setBatchBrix(e.target.value)}
                    placeholder="Tidak diubah"
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Gejala / Kondisi</label>
                  <input
                    type="text"
                    value={batchSymptom}
                    onChange={(e) => setBatchSymptom(e.target.value)}
                    placeholder="Opsional..."
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Tindakan</label>
                  <input
                    type="text"
                    value={batchAction}
                    onChange={(e) => setBatchAction(e.target.value)}
                    placeholder="Opsional..."
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="block text-[11px] font-medium mb-1">Tanggal Pemeriksaan</label>
                  <input
                    type="date"
                    value={batchInspectionDate}
                    onChange={(e) => setBatchInspectionDate(e.target.value)}
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="block text-[11px] font-medium mb-1">Tanggal Panen Manual (Opsional)</label>
                  <input
                    type="date"
                    value={batchHarvestDate}
                    onChange={(e) => setBatchHarvestDate(e.target.value)}
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--app-accent)',
                    color: 'var(--app-accent-fg)',
                  }}
                >
                  {batchTargetMode === 'all'
                    ? `Terapkan ke Semua (${gh.plants.length} Tanaman)`
                    : batchTargetMode === 'selected'
                    ? `Terapkan ke ${selectedPlantIds.length} Terpilih`
                    : 'Terapkan ke Rentang Terpilih'}
                </button>
              </div>
            </form>
          )}

          {/* Block Tabs when in Block mode */}
          {viewMode === 'block' && (
            <div className="mt-4 flex flex-wrap gap-1.5 pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
              {Array.from({ length: blockCount }).map((_, idx) => {
                const start = idx * 100 + 1;
                const end = Math.min((idx + 1) * 100, gh.plants.length);
                const active = activeBlock === idx;
                const sickInBlock = gh.plants
                  .slice(start - 1, end)
                  .filter((p) => p.status === 'sakit').length;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveBlock(idx)}
                    className="rounded-md border px-2.5 py-1.5 text-xs font-mono-tabular font-medium transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                      backgroundColor: active ? 'var(--app-accent)' : 'var(--app-surface-muted)',
                      color: active ? 'var(--app-accent-fg)' : 'var(--app-text)',
                    }}
                  >
                    {start}–{end}
                    {sickInBlock > 0 && (
                      <span
                        className="ml-1.5 text-[10px]"
                        style={{ color: active ? 'var(--app-accent-fg)' : '#DC2626' }}
                      >
                        ({sickInBlock}!)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hover info bar + Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3" style={{ color: 'var(--app-text-muted)' }}>
              {colorMode === 'health' ? (
                <>
                  {(Object.keys(PLANT_STATUS_META) as PlantHealthStatus[]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: PLANT_STATUS_META[k].cellBg }}
                      />
                      <span>{PLANT_STATUS_META[k].short}</span>
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 pl-1 border-l" style={{ borderColor: 'var(--app-border)' }}>
                    <span>Titik:</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full border border-slate-400/60" style={{ backgroundColor: '#4ADE80' }} />
                      <span>Bagus</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full border border-slate-400/60" style={{ backgroundColor: '#FB7185' }} />
                      <span>Jelek</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full border border-slate-400/60" style={{ backgroundColor: '#FBBF24' }} />
                      <span>Tdk Berbuah</span>
                    </span>
                  </span>
                </>
              ) : colorMode === 'fruiting' ? (
                <>
                  {(['berbuah', 'tidak_berbuah'] as FruitingStatus[]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: FRUITING_STATUS_META[k].cellBg }}
                      />
                      <span>{FRUITING_STATUS_META[k].short}</span>
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 pl-1 border-l" style={{ borderColor: 'var(--app-border)' }}>
                    <span>Titik = Kesehatan</span>
                  </span>
                </>
              ) : (
                <>
                  {(['bagus', 'jelek'] as FruitQuality[]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: FRUIT_QUALITY_META[k].cellBg }}
                      />
                      <span>{FRUIT_QUALITY_META[k].label}</span>
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: FRUITING_STATUS_META.tidak_berbuah.cellBg }}
                    />
                    <span>Tidak Berbuah</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: PLANT_STATUS_META.kosong.cellBg }}
                    />
                    <span>Kosong</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 pl-1 border-l" style={{ borderColor: 'var(--app-border)' }}>
                    <span>Titik = Kesehatan</span>
                  </span>
                </>
              )}
            </div>
            <div className="font-mono-tabular text-xs min-h-[18px]">
              {hoveredPlant ? (
                <span>
                  <strong>#{hoveredPlant.id}</strong> · {PLANT_STATUS_META[hoveredPlant.status].short} ·{' '}
                  {getFruiting(hoveredPlant) === 'berbuah'
                    ? `Berbuah (${FRUIT_QUALITY_META[getFruitQuality(hoveredPlant)].short})`
                    : FRUITING_STATUS_META.tidak_berbuah.short}{' '}
                  · {formatDateShortId(hoveredPlant.inspectionDate || hoveredPlant.updatedAt)} ·{' '}
                  {hoveredPlant.symptom}
                </span>
              ) : (
                <span style={{ color: 'var(--app-text-muted)' }}>
                  Menampilkan {visiblePlants.length.toLocaleString('id-ID')} tanaman
                  {dateFilter ? ` (Tgl periksa: ${formatDateShortId(dateFilter)})` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Plant Matrix Grid */}
          {visiblePlants.length === 0 ? (
            <div
              className="mt-4 rounded-lg border border-dashed py-12 text-center text-sm"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            >
              Tidak ada tanaman dengan filter kondisi tersebut pada blok ini.
            </div>
          ) : viewMode === 'block' ? (
            <div className="mt-4 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {visiblePlants.map((plant) => {
                const meta = PLANT_STATUS_META[plant.status];
                const fruiting = getFruiting(plant);
                const isSelected = plant.id === selectedId;
                const isMultiChecked = selectedPlantIds.includes(plant.id);
                const dotMeta = getPlantConditionDot(plant);
                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() =>
                      multiSelectMode
                        ? toggleMultiSelectPlant(plant.id)
                        : handleSelectPlant(plant.id, true)
                    }
                    onMouseEnter={() => setHoveredPlant(plant)}
                    onMouseLeave={() => setHoveredPlant(null)}
                    className="relative flex h-10 flex-col items-center justify-center rounded-md text-[11px] font-mono-tabular font-semibold transition-transform hover:scale-105 cursor-pointer"
                    style={{
                      backgroundColor: getCellColor(plant),
                      color: '#FFFFFF',
                      outline: isMultiChecked
                        ? '3px solid #E11D48'
                        : isSelected
                        ? '3px solid var(--app-text)'
                        : 'none',
                      outlineOffset: isMultiChecked || isSelected ? '1px' : '0px',
                    }}
                    title={`Klik untuk inspeksi manual Tanaman #${plant.id} — ${meta.label} · ${FRUITING_STATUS_META[fruiting].short}`}
                  >
                    <span>{plant.id}</span>
                    {isMultiChecked && (
                      <span
                        className="absolute bottom-0.5 left-1 text-[9px] font-bold"
                        title="Dipilih"
                      >
                        ✓
                      </span>
                    )}
                    {dotMeta && (
                      <span
                        className="absolute top-1 right-1 h-2 w-2 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: dotMeta.color }}
                        title={dotMeta.title}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Full 1-1000 Micro Matrix */
            <div
              className="mt-4 grid gap-1"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(20px, 1fr))',
              }}
            >
              {visiblePlants.map((plant) => {
                const meta = PLANT_STATUS_META[plant.status];
                const fruiting = getFruiting(plant);
                const isSelected = plant.id === selectedId;
                const isMultiChecked = selectedPlantIds.includes(plant.id);
                const dotMeta = getPlantConditionDot(plant);
                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() =>
                      multiSelectMode
                        ? toggleMultiSelectPlant(plant.id)
                        : handleSelectPlant(plant.id, true)
                    }
                    onMouseEnter={() => setHoveredPlant(plant)}
                    onMouseLeave={() => setHoveredPlant(null)}
                    className="relative h-5 sm:h-4 w-full rounded-[3px] transition-transform hover:scale-125 cursor-pointer"
                    style={{
                      backgroundColor: getCellColor(plant),
                      outline: isMultiChecked
                        ? '2px solid #E11D48'
                        : isSelected
                        ? '2px solid var(--app-text)'
                        : 'none',
                      outlineOffset: '1px',
                    }}
                    aria-label={`Tanaman ${plant.id} ${meta.label} ${FRUITING_STATUS_META[fruiting].short}`}
                    title={`#${plant.id} · ${meta.short} · ${FRUITING_STATUS_META[fruiting].short}`}
                  >
                    {dotMeta && (
                      <span
                        className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full border border-white/90"
                        style={{ backgroundColor: dotMeta.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Mobile & Tablet quick jump bar to selected plant editor */}
          {selectedPlant && !multiSelectMode && (
            <div
              className="mt-4 flex xl:hidden items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-surface-muted)',
              }}
            >
              <span className="inline-flex items-center gap-1.5 font-mono-tabular font-semibold truncate">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0 border border-white/80"
                  style={{ backgroundColor: PLANT_STATUS_META[selectedPlant.status].cellBg }}
                />
                <span className="truncate">
                  Dipilih: #{selectedPlant.id} · {PLANT_STATUS_META[selectedPlant.status].short} ·{' '}
                  {getFruiting(selectedPlant) === 'berbuah'
                    ? `Berbuah (${FRUIT_QUALITY_META[getFruitQuality(selectedPlant)].short})`
                    : FRUITING_STATUS_META.tidak_berbuah.short}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold shrink-0 cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <span>Edit Detail</span>
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </section>

        {/* Right: Single Plant Detail & Manual Editor (4 cols) */}
        <section
          ref={inspectorRef}
          className={`rounded-xl border p-4 sm:p-5 xl:col-span-4 h-fit scroll-mt-24 transition-shadow ${
            inspectorPulse ? 'ring-2 ring-[var(--app-accent)] shadow-lg' : ''
          }`}
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: inspectorPulse ? 'var(--app-accent)' : 'var(--app-border)',
          }}
        >
          {selectedPlant ? (
            <div className="space-y-4">
              {/* Header with Prev/Next */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
                <div className="min-w-0">
                  <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                    Inspeksi Manual {gh.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0 border border-white/80 shadow-xs"
                      style={{ backgroundColor: PLANT_STATUS_META[selectedPlant.status].cellBg }}
                      title={`Kondisi Tanaman: ${PLANT_STATUS_META[selectedPlant.status].label}`}
                    />
                    <h3 className="text-lg font-bold font-mono-tabular">
                      Tanaman #{selectedPlant.id}
                    </h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        PLANT_STATUS_META[selectedPlant.status].textBadge
                      }`}
                    >
                      {PLANT_STATUS_META[selectedPlant.status].short}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      matrixTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="xl:hidden inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                    title="Kembali ke Peta Nomor Tanaman"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    <span>Peta</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedPlant.id <= 1}
                    onClick={() => handleSelectPlant(selectedPlant.id - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-40 cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                    aria-label="Tanaman sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedPlant.id >= gh.plants.length}
                    onClick={() => handleSelectPlant(selectedPlant.id + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-40 cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                    aria-label="Tanaman berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Pemilihan Tanggal Pemeriksaan Tanaman */}
              <div
                className="rounded-lg border p-3 space-y-2"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="plant-inspection-date"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
                    <span>Tanggal Pemeriksaan</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const today = toLocalDateInputValue();
                      setLockedInspectionDate(today);
                      updateSinglePlant(selectedPlant.id, { inspectionDate: today });
                    }}
                    className="rounded border px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-accent)',
                    }}
                  >
                    Hari Ini
                  </button>
                </div>
                <input
                  id="plant-inspection-date"
                  type="date"
                  value={
                    lockInspectionDate
                      ? lockedInspectionDate
                      : selectedPlant.inspectionDate || toLocalDateInputValue(selectedPlant.updatedAt)
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setLockedInspectionDate(val);
                      updateSinglePlant(selectedPlant.id, { inspectionDate: val });
                    }
                  }}
                  className="w-full rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
                <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none" style={{ color: 'var(--app-text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={lockInspectionDate}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setLockInspectionDate(checked);
                      if (checked) {
                        const currentVal =
                          selectedPlant.inspectionDate ||
                          toLocalDateInputValue(selectedPlant.updatedAt);
                        setLockedInspectionDate(currentVal);
                      }
                    }}
                    className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                  />
                  <span>Gunakan tanggal ini otomatis saat memeriksa tanaman lain</span>
                </label>
              </div>

              {/* Status Kesehatan */}
              <div>
                <label className="block text-xs font-medium mb-1.5">Kondisi Kesehatan</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {(Object.keys(PLANT_STATUS_META) as PlantHealthStatus[]).map((st) => {
                    const meta = PLANT_STATUS_META[st];
                    const active = selectedPlant.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          updateSinglePlant(selectedPlant.id, {
                            status: st,
                            symptom:
                              st === 'sehat'
                                ? 'Pertumbuhan normal'
                                : st === 'kosong'
                                ? 'Lubang netpot kosong'
                                : selectedPlant.symptom,
                          })
                        }
                        className="rounded-lg border px-2.5 py-2 text-xs font-semibold text-left transition-colors cursor-pointer"
                        style={{
                          borderColor: active ? meta.cellBg : 'var(--app-border)',
                          backgroundColor: active ? meta.cellBg : 'var(--app-canvas)',
                          color: active ? '#FFFFFF' : 'var(--app-text)',
                        }}
                      >
                        {meta.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kondisi Berbuah vs Tidak Berbuah & Kondisi Buah Bagus vs Jelek */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Status Pembuahan (Berbuah / Tidak Berbuah)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['berbuah', 'tidak_berbuah'] as FruitingStatus[]).map((fKey) => {
                      const meta = FRUITING_STATUS_META[fKey];
                      const active = getFruiting(selectedPlant) === fKey;
                      return (
                        <button
                          key={fKey}
                          type="button"
                          onClick={() => {
                            if (fKey === 'berbuah') {
                              const nextCount = Math.max(1, selectedPlant.fruitCount);
                              const adjusted = adjustWeightsForCount(
                                getFruitWeights(selectedPlant),
                                nextCount,
                                selectedPlant.estWeightKg
                              );
                              updateSinglePlant(selectedPlant.id, {
                                fruitingStatus: 'berbuah',
                                fruitCount: nextCount,
                                fruitWeights: adjusted.fruitWeights,
                                estWeightKg: adjusted.estWeightKg,
                                fruitQuality: getFruitQuality(selectedPlant),
                              });
                            } else {
                              updateSinglePlant(selectedPlant.id, {
                                fruitingStatus: 'tidak_berbuah',
                                fruitCount: 0,
                                fruitWeights: [],
                                estWeightKg: 0,
                                fruitQuality: 'bagus',
                              });
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                          style={{
                            borderColor: active ? meta.cellBg : 'var(--app-border)',
                            backgroundColor: active ? meta.cellBg : 'var(--app-canvas)',
                            color: active ? '#FFFFFF' : 'var(--app-text)',
                          }}
                        >
                          <Apple className="h-3.5 w-3.5" />
                          <span>{meta.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-medium">
                      Kondisi Buah (Bagus / Jelek)
                    </label>
                    {getFruiting(selectedPlant) === 'tidak_berbuah' && (
                      <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                        Pilih untuk tandai berbuah
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['bagus', 'jelek'] as FruitQuality[]).map((qKey) => {
                      const qMeta = FRUIT_QUALITY_META[qKey];
                      const isFruiting = getFruiting(selectedPlant) === 'berbuah';
                      const active = isFruiting && getFruitQuality(selectedPlant) === qKey;
                      return (
                        <button
                          key={qKey}
                          type="button"
                          onClick={() => {
                            const nextCount = Math.max(1, selectedPlant.fruitCount);
                            const adjusted = adjustWeightsForCount(
                              getFruitWeights(selectedPlant),
                              nextCount,
                              selectedPlant.estWeightKg
                            );
                            updateSinglePlant(selectedPlant.id, {
                              fruitingStatus: 'berbuah',
                              fruitCount: nextCount,
                              fruitWeights: adjusted.fruitWeights,
                              estWeightKg: adjusted.estWeightKg,
                              fruitQuality: qKey,
                            });
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
                          style={{
                            borderColor: active ? qMeta.cellBg : 'var(--app-border)',
                            backgroundColor: active ? qMeta.cellBg : 'var(--app-canvas)',
                            color: active ? '#FFFFFF' : 'var(--app-text)',
                          }}
                        >
                          {qKey === 'bagus' ? (
                            <ThumbsUp className="h-3.5 w-3.5" />
                          ) : (
                            <ThumbsDown className="h-3.5 w-3.5" />
                          )}
                          <span>{qMeta.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Fruit Count Selector: 1 Buah / 2 Buah */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-medium">
                      Jumlah Buah per Pohon
                    </label>
                    <span className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                      {selectedPlant.fruitCount > 0
                        ? `${selectedPlant.fruitCount} buah · ${selectedPlant.estWeightKg.toLocaleString('id-ID', {
                            maximumFractionDigits: 2,
                          })} kg`
                        : '0 buah'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2].map((qty) => {
                      const active =
                        getFruiting(selectedPlant) === 'berbuah' &&
                        selectedPlant.fruitCount === qty;
                      return (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => {
                            const adjusted = adjustWeightsForCount(
                              getFruitWeights(selectedPlant),
                              qty,
                              selectedPlant.estWeightKg
                            );
                            if (lastExternalNumRef.current) {
                              lastExternalNumRef.current.fruitCount = qty;
                              lastExternalNumRef.current.estWeightKg = adjusted.estWeightKg;
                              lastExternalNumRef.current.fruitWeightsSig =
                                adjusted.fruitWeights.join('|');
                            }
                            setFruitCountInput(String(qty));
                            setWeightInput(String(adjusted.estWeightKg));
                            setFruitWeightInputs(adjusted.fruitWeights.map((w) => String(w)));
                            updateSinglePlant(selectedPlant.id, {
                              fruitingStatus: 'berbuah',
                              fruitCount: qty,
                              fruitWeights: adjusted.fruitWeights,
                              estWeightKg: adjusted.estWeightKg,
                              fruitQuality: getFruitQuality(selectedPlant),
                            });
                          }}
                          className="flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer"
                          style={{
                            borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                            backgroundColor: active ? 'var(--app-accent)' : 'var(--app-canvas)',
                            color: active ? 'var(--app-accent-fg)' : 'var(--app-text)',
                          }}
                        >
                          <span>{qty} Buah</span>
                        </button>
                      );
                    })}
                    <input
                      ref={fruitCountInputRef}
                      type="text"
                      inputMode="numeric"
                      aria-label="Jumlah Buah Manual"
                      placeholder="0"
                      value={fruitCountInput}
                      onFocus={() => {
                        if (fruitCountInput === '0') setFruitCountInput('');
                      }}
                      onBlur={() => {
                        if (fruitCountInput.trim() === '') {
                          setFruitCountInput(String(selectedPlant.fruitCount));
                        }
                      }}
                      onChange={(e) => {
                        const raw = sanitizeIntDraft(e.target.value);
                        setFruitCountInput(raw);
                        if (raw.trim() === '') {
                          if (lastExternalNumRef.current) {
                            lastExternalNumRef.current.fruitCount = 0;
                            lastExternalNumRef.current.estWeightKg = 0;
                            lastExternalNumRef.current.fruitWeightsSig = '';
                          }
                          setFruitWeightInputs([]);
                          setWeightInput('0');
                          updateSinglePlant(selectedPlant.id, {
                            fruitCount: 0,
                            fruitingStatus: 'tidak_berbuah',
                            fruitWeights: [],
                            estWeightKg: 0,
                          });
                          return;
                        }
                        const num = parseInt(raw, 10);
                        if (!Number.isNaN(num)) {
                          const clamped = Math.min(20, Math.max(0, num));
                          const adjusted = adjustWeightsForCount(
                            getFruitWeights(selectedPlant),
                            clamped,
                            selectedPlant.estWeightKg
                          );
                          if (lastExternalNumRef.current) {
                            lastExternalNumRef.current.fruitCount = clamped;
                            lastExternalNumRef.current.estWeightKg = adjusted.estWeightKg;
                            lastExternalNumRef.current.fruitWeightsSig =
                              adjusted.fruitWeights.join('|');
                          }
                          setWeightInput(String(adjusted.estWeightKg));
                          setFruitWeightInputs(adjusted.fruitWeights.map((w) => String(w)));
                          updateSinglePlant(selectedPlant.id, {
                            fruitCount: clamped,
                            fruitingStatus: clamped > 0 ? 'berbuah' : 'tidak_berbuah',
                            fruitWeights: adjusted.fruitWeights,
                            estWeightKg: adjusted.estWeightKg,
                          });
                        }
                      }}
                      className="w-full rounded-lg border px-2.5 py-2 text-center text-xs font-bold font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-canvas)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Per-Fruit Weight Inputs when Berbuah >= 2, else Single Weight + Height + Brix */}
              {selectedPlant.fruitCount >= 2 ? (
                <div
                  className="rounded-lg border p-3 space-y-2.5"
                  style={{
                    borderColor: 'var(--app-accent)',
                    backgroundColor: 'var(--app-accent-soft)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--app-accent)' }}>
                      Bobot Masing-Masing Buah ({selectedPlant.fruitCount} Buah)
                    </span>
                    <span className="text-xs font-bold font-mono-tabular" style={{ color: 'var(--app-accent)' }}>
                      Total: {selectedPlant.estWeightKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Array.from({ length: Math.min(5, selectedPlant.fruitCount) }).map((_, idx) => {
                      const draftVal = fruitWeightInputs[idx] ?? '0';
                      return (
                        <div key={idx}>
                          <label className="block text-[11px] font-medium mb-1">
                            Bobot Buah {idx + 1} (kg)
                          </label>
                          <input
                            ref={(el) => {
                              fruitWeightInputRefs.current[idx] = el;
                            }}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={draftVal}
                            onFocus={() => {
                              if (draftVal === '0') {
                                setFruitWeightInputs((prev) => {
                                  const next = [...prev];
                                  next[idx] = '';
                                  return next;
                                });
                              }
                            }}
                            onBlur={() => {
                              setFruitWeightInputs((prev) => {
                                const next = [...prev];
                                const cur = (next[idx] || '').trim();
                                const weights = getFruitWeights(selectedPlant);
                                if (cur === '' || cur === '.') {
                                  next[idx] = String(weights[idx] ?? 0);
                                } else {
                                  const n = Number(cur);
                                  next[idx] = !Number.isNaN(n) ? String(Math.max(0, n)) : '0';
                                }
                                return next;
                              });
                            }}
                            onChange={(e) => {
                              const raw = sanitizeDecimalDraft(e.target.value);
                              setFruitWeightInputs((prev) => {
                                const next = [...prev];
                                next[idx] = raw;
                                return next;
                              });

                              const currentWeights = adjustWeightsForCount(
                                getFruitWeights(selectedPlant),
                                selectedPlant.fruitCount,
                                selectedPlant.estWeightKg
                              ).fruitWeights;

                              if (raw.trim() === '' || raw === '.') {
                                currentWeights[idx] = 0;
                              } else {
                                const parsed = Number(raw);
                                if (Number.isNaN(parsed)) return;
                                currentWeights[idx] = Math.min(20, Math.max(0, parsed));
                              }

                              const totalKg = Number(
                                currentWeights.reduce((a, b) => a + b, 0).toFixed(2)
                              );
                              if (lastExternalNumRef.current) {
                                lastExternalNumRef.current.estWeightKg = totalKg;
                                lastExternalNumRef.current.fruitWeightsSig =
                                  currentWeights.slice(0, 5).join('|');
                              }
                              setWeightInput(String(totalKg));
                              updateSinglePlant(selectedPlant.id, {
                                fruitingStatus: 'berbuah',
                                fruitWeights: currentWeights,
                                estWeightKg: totalKg,
                              });
                            }}
                            className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                            style={{
                              borderColor: 'var(--app-border)',
                              backgroundColor: 'var(--app-surface)',
                              color: 'var(--app-text)',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Manual Numeric Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Tinggi Sulur (cm)</label>
                  <input
                    ref={heightInputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={heightInput}
                    onFocus={() => {
                      if (heightInput === '0') setHeightInput('');
                    }}
                    onBlur={() => {
                      if (heightInput.trim() === '' || heightInput === '.') {
                        setHeightInput(String(selectedPlant.heightCm));
                      } else {
                        const n = Number(heightInput);
                        if (!Number.isNaN(n)) setHeightInput(String(Math.max(0, n)));
                      }
                    }}
                    onChange={(e) => {
                      const raw = sanitizeDecimalDraft(e.target.value);
                      setHeightInput(raw);
                      if (raw.trim() === '' || raw === '.') {
                        if (lastExternalNumRef.current) lastExternalNumRef.current.heightCm = 0;
                        updateSinglePlant(selectedPlant.id, { heightCm: 0 });
                        return;
                      }
                      const num = Number(raw);
                      if (!Number.isNaN(num)) {
                        const clamped = Math.min(500, Math.max(0, num));
                        if (lastExternalNumRef.current) lastExternalNumRef.current.heightCm = clamped;
                        updateSinglePlant(selectedPlant.id, { heightCm: clamped });
                      }
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                {selectedPlant.fruitCount < 2 && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Est. Bobot Buah (kg)</label>
                    <input
                      ref={weightInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={weightInput}
                      onFocus={() => {
                        if (weightInput === '0') setWeightInput('');
                      }}
                      onBlur={() => {
                        if (weightInput.trim() === '' || weightInput === '.') {
                          setWeightInput(String(selectedPlant.estWeightKg));
                        } else {
                          const n = Number(weightInput);
                          if (!Number.isNaN(n)) setWeightInput(String(Math.max(0, n)));
                        }
                      }}
                      onChange={(e) => {
                        const raw = sanitizeDecimalDraft(e.target.value);
                        setWeightInput(raw);
                        if (raw.trim() === '' || raw === '.') {
                          if (lastExternalNumRef.current) {
                            lastExternalNumRef.current.estWeightKg = 0;
                            lastExternalNumRef.current.fruitWeightsSig = '';
                          }
                          updateSinglePlant(selectedPlant.id, {
                            estWeightKg: 0,
                            fruitWeights: [],
                          });
                          return;
                        }
                        const num = Number(raw);
                        if (!Number.isNaN(num)) {
                          const clamped = Math.min(20, Math.max(0, num));
                          if (lastExternalNumRef.current) {
                            lastExternalNumRef.current.estWeightKg = clamped;
                            lastExternalNumRef.current.fruitWeightsSig =
                              clamped > 0 ? String(clamped) : '';
                          }
                          updateSinglePlant(selectedPlant.id, {
                            estWeightKg: clamped,
                            fruitWeights: clamped > 0 ? [clamped] : [],
                          });
                        }
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-canvas)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                )}
                <div className={selectedPlant.fruitCount >= 2 ? '' : 'col-span-2 sm:col-span-1'}>
                  <label className="block text-xs font-medium mb-1">Kadar Brix (%)</label>
                  <input
                    ref={brixInputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={brixInput}
                    onFocus={() => {
                      if (brixInput === '0') setBrixInput('');
                    }}
                    onBlur={() => {
                      if (brixInput.trim() === '' || brixInput === '.') {
                        setBrixInput(String(selectedPlant.brix));
                      } else {
                        const n = Number(brixInput);
                        if (!Number.isNaN(n)) setBrixInput(String(Math.max(0, n)));
                      }
                    }}
                    onChange={(e) => {
                      const raw = sanitizeDecimalDraft(e.target.value);
                      setBrixInput(raw);
                      if (raw.trim() === '' || raw === '.') {
                        if (lastExternalNumRef.current) lastExternalNumRef.current.brix = 0;
                        updateSinglePlant(selectedPlant.id, { brix: 0 });
                        return;
                      }
                      const num = Number(raw);
                      if (!Number.isNaN(num)) {
                        const clamped = Math.min(30, Math.max(0, num));
                        if (lastExternalNumRef.current) lastExternalNumRef.current.brix = clamped;
                        updateSinglePlant(selectedPlant.id, { brix: clamped });
                      }
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Gejala / Diagnosa</label>
                <input
                  type="text"
                  value={selectedPlant.symptom}
                  onChange={(e) =>
                    updateSinglePlant(selectedPlant.id, { symptom: e.target.value })
                  }
                  placeholder="Mis. Normal / Embun tepung / Kutu kebul"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Tindakan Terakhir</label>
                <input
                  type="text"
                  value={selectedPlant.lastAction}
                  onChange={(e) =>
                    updateSinglePlant(selectedPlant.id, { lastAction: e.target.value })
                  }
                  placeholder="Mis. Pengolesan fungisida / Polinasi"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">Tanggal Panen (Isi Manual)</label>
                  {selectedPlant.harvestDate && (
                    <button
                      type="button"
                      onClick={() =>
                        updateSinglePlant(selectedPlant.id, { harvestDate: '' })
                      }
                      className="text-[11px] underline cursor-pointer"
                      style={{ color: 'var(--app-text-muted)' }}
                    >
                      Kosongkan
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={selectedPlant.harvestDate || ''}
                  onChange={(e) =>
                    updateSinglePlant(selectedPlant.id, { harvestDate: e.target.value })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Catatan Manual</label>
                <textarea
                  rows={3}
                  value={selectedPlant.notes}
                  onChange={(e) =>
                    updateSinglePlant(selectedPlant.id, { notes: e.target.value })
                  }
                  placeholder="Catatan khusus untuk pohon ini..."
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <span className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                  Tgl Periksa: {formatDateShortId(selectedPlant.inspectionDate || selectedPlant.updatedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteSinglePlant(selectedPlant.id)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus #{selectedPlant.id}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

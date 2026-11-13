import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Apple,
  ArrowDown,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Layers,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { FRUITING_STATUS_META, PLANT_STATUS_META } from '../constants/themes';
import {
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

export const DashboardPlantsMatrix: React.FC<DashboardPlantsMatrixProps> = ({
  gh,
  onUpdateGh,
}) => {
  const inspectorRef = useRef<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<'block' | 'all'>('block');
  const [colorMode, setColorMode] = useState<'health' | 'fruiting'>('health');
  const [activeBlock, setActiveBlock] = useState(0); // 0 = 1-100, 1 = 101-200...
  const [statusFilter, setStatusFilter] = useState<'all' | PlantHealthStatus>('all');
  const [fruitingFilter, setFruitingFilter] = useState<'all' | FruitingStatus>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [jumpNumber, setJumpNumber] = useState('');
  const [selectedId, setSelectedId] = useState<number>(1);
  const [hoveredPlant, setHoveredPlant] = useState<PlantCondition | null>(null);

  // Sticky inspection date option for recording backdated plant inspections sequentially
  const [lockInspectionDate, setLockInspectionDate] = useState(false);
  const [lockedInspectionDate, setLockedInspectionDate] = useState(() => toLocalDateInputValue());

  // Batch range manual fill & multi-select delete
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('100');
  const [batchStatus, setBatchStatus] = useState<'keep' | PlantHealthStatus>('keep');
  const [batchFruiting, setBatchFruiting] = useState<'keep' | FruitingStatus>('keep');
  const [batchSymptom, setBatchSymptom] = useState('');
  const [batchAction, setBatchAction] = useState('');
  const [batchHarvestDate, setBatchHarvestDate] = useState('');
  const [batchInspectionDate, setBatchInspectionDate] = useState(() => toLocalDateInputValue());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([]);
  const [confirmClearAllPlants, setConfirmClearAllPlants] = useState(false);

  useEffect(() => {
    setSelectedPlantIds([]);
    setMultiSelectMode(false);
    setConfirmClearAllPlants(false);
    setDateFilter('');
  }, [gh.id]);

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
    };
    for (const p of gh.plants) {
      res[p.status] += 1;
      res[getFruiting(p)] += 1;
    }
    return res;
  }, [gh.plants]);

  const blockCount = Math.max(1, Math.ceil(gh.plants.length / 100));

  const visiblePlants = useMemo(() => {
    const base =
      viewMode === 'all'
        ? gh.plants
        : gh.plants.slice(activeBlock * 100, (activeBlock + 1) * 100);
    return base.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (fruitingFilter !== 'all' && getFruiting(p) !== fruitingFilter) return false;
      if (dateFilter && !matchesLocalDate(p.inspectionDate || p.updatedAt, dateFilter)) return false;
      return true;
    });
  }, [gh.plants, viewMode, activeBlock, statusFilter, fruitingFilter, dateFilter]);

  const selectedPlant = useMemo(() => {
    return gh.plants[selectedId - 1] || gh.plants[0];
  }, [gh.plants, selectedId]);

  const handleSelectPlant = (id: number) => {
    setSelectedId(id);
    const blockIdx = Math.floor((id - 1) / 100);
    if (blockIdx >= 0 && blockIdx < blockCount) {
      setActiveBlock(blockIdx);
    }
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpNumber, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= gh.plants.length) {
      setStatusFilter('all');
      setFruitingFilter('all');
      setDateFilter('');
      handleSelectPlant(num);
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

  const handleBatchApply = (e: React.FormEvent) => {
    e.preventDefault();
    const start = Math.max(1, Math.min(gh.plants.length, parseInt(rangeStart, 10) || 1));
    const end = Math.max(start, Math.min(gh.plants.length, parseInt(rangeEnd, 10) || start));
    const chosenInspectionDate = batchInspectionDate || toLocalDateInputValue();
    const stampedIso = localDateInputToIsoWithCurrentTime(chosenInspectionDate);

    onUpdateGh((prev) => {
      const nextPlants = prev.plants.map((p) => {
        if (p.id >= start && p.id <= end) {
          const nextStatus = batchStatus === 'keep' ? p.status : batchStatus;
          const nextFruiting = batchFruiting === 'keep' ? getFruiting(p) : batchFruiting;
          const nextFruitCount =
            batchFruiting === 'berbuah'
              ? Math.max(1, p.fruitCount)
              : batchFruiting === 'tidak_berbuah'
              ? 0
              : p.fruitCount;

          return {
            ...p,
            status: nextStatus,
            fruitingStatus: nextFruiting,
            fruitCount: nextFruitCount,
            symptom: batchSymptom.trim() || p.symptom,
            lastAction: batchAction.trim() || p.lastAction,
            harvestDate: batchHarvestDate || p.harvestDate,
            inspectionDate: chosenInspectionDate,
            updatedAt: stampedIso,
          };
        }
        return p;
      });
      return { ...prev, plants: nextPlants };
    });

    setShowBatchPanel(false);
  };

  const resetPlantFields = (p: PlantCondition, now: string): PlantCondition => ({
    ...p,
    status: 'kosong',
    fruitingStatus: 'tidak_berbuah',
    symptom: 'Data dihapus / slot kosong',
    heightCm: 0,
    fruitCount: 0,
    estWeightKg: 0,
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
    return PLANT_STATUS_META[plant.status].cellBg;
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
            }}
            className="rounded-xl border p-3.5 text-left transition-colors cursor-pointer"
            style={{
              backgroundColor:
                statusFilter === 'all' && fruitingFilter === 'all'
                  ? 'var(--app-accent-soft)'
                  : 'var(--app-surface)',
              borderColor:
                statusFilter === 'all' && fruitingFilter === 'all'
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

        {/* Berbuah & Tidak Berbuah Summary Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      Kondisi: {meta.label}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      {active ? 'Filter aktif — klik lagi untuk tampilkan semua' : 'Klik untuk memfilter & mewarnai peta'}
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
        </div>
      </section>

      {/* Main Split: Left 1-1000 Matrix (8 cols) + Right Plant Inspector (4 cols) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Matrix Viewport */}
        <section
          className="rounded-xl border p-4 sm:p-5 xl:col-span-8"
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

              {/* Map Color Mode Toggle: Kesehatan vs Berbuah */}
              <div
                className="flex items-center gap-1 rounded-lg p-1"
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
              </div>

              <button
                type="button"
                onClick={() => setShowBatchPanel((v) => !v)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-85 cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: showBatchPanel ? 'var(--app-accent)' : 'var(--app-border)',
                  backgroundColor: showBatchPanel ? 'var(--app-accent-soft)' : 'transparent',
                  color: showBatchPanel ? 'var(--app-accent)' : 'var(--app-text)',
                }}
              >
                Isi Rentang Manual
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

          {/* Bulk Delete Controls Bar for Plants */}
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
                  const visibleIds = visiblePlants.map((p) => p.id);
                  const allSelected =
                    visibleIds.length > 0 &&
                    visibleIds.every((id) => selectedPlantIds.includes(id));
                  if (allSelected) {
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
                  ? `Batal Pilih (${visiblePlants.length})`
                  : `Pilih Semua Tampil (${visiblePlants.length})`}
              </button>
              {selectedPlantIds.length > 0 && (
                <span className="font-mono-tabular font-semibold" style={{ color: 'var(--app-accent)' }}>
                  {selectedPlantIds.length} tanaman dipilih
                </span>
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

          {/* Batch Range Manual Edit Drawer */}
          {showBatchPanel && (
            <form
              onSubmit={handleBatchApply}
              className="mt-4 rounded-lg border p-4 space-y-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-surface-muted)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  Pembaruan Kondisi Rentang Tanaman Manual
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="block text-[11px] font-medium mb-1">Dari No.</label>
                  <input
                    type="number"
                    min={1}
                    max={gh.plants.length}
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
                  Terapkan ke Rentang Terpilih
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
              {colorMode === 'health'
                ? (Object.keys(PLANT_STATUS_META) as PlantHealthStatus[]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: PLANT_STATUS_META[k].cellBg }}
                      />
                      <span>{PLANT_STATUS_META[k].short}</span>
                    </span>
                  ))
                : (['berbuah', 'tidak_berbuah'] as FruitingStatus[]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: FRUITING_STATUS_META[k].cellBg }}
                      />
                      <span>{FRUITING_STATUS_META[k].short}</span>
                    </span>
                  ))}
            </div>
            <div className="font-mono-tabular text-xs min-h-[18px]">
              {hoveredPlant ? (
                <span>
                  <strong>#{hoveredPlant.id}</strong> · {PLANT_STATUS_META[hoveredPlant.status].short} ·{' '}
                  {FRUITING_STATUS_META[getFruiting(hoveredPlant)].short} ·{' '}
                  {formatDateShortId(hoveredPlant.inspectionDate || hoveredPlant.updatedAt)} ·{' '}
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
                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() =>
                      multiSelectMode
                        ? toggleMultiSelectPlant(plant.id)
                        : handleSelectPlant(plant.id)
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
                    title={`Tanaman #${plant.id} — ${meta.label} · ${FRUITING_STATUS_META[fruiting].short}`}
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
                    {colorMode === 'health' && fruiting === 'berbuah' && (
                      <span
                        className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-white/90"
                        title="Berbuah"
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
                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() =>
                      multiSelectMode
                        ? toggleMultiSelectPlant(plant.id)
                        : handleSelectPlant(plant.id)
                    }
                    onMouseEnter={() => setHoveredPlant(plant)}
                    onMouseLeave={() => setHoveredPlant(null)}
                    className="h-5 sm:h-4 w-full rounded-[3px] transition-transform hover:scale-125 cursor-pointer"
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
                  />
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
              <span className="font-mono-tabular font-semibold truncate">
                Dipilih: #{selectedPlant.id} · {PLANT_STATUS_META[selectedPlant.status].short} ·{' '}
                {FRUITING_STATUS_META[getFruiting(selectedPlant)].short}
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
          className="rounded-xl border p-4 sm:p-5 xl:col-span-4 h-fit scroll-mt-24"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          {selectedPlant ? (
            <div className="space-y-4">
              {/* Header with Prev/Next */}
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
                <div>
                  <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                    Inspeksi Manual {gh.name}
                  </div>
                  <h3 className="text-lg font-bold font-mono-tabular">
                    Tanaman #{selectedPlant.id}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
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

              {/* Kondisi Berbuah vs Tidak Berbuah */}
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
                        onClick={() =>
                          updateSinglePlant(selectedPlant.id, {
                            fruitingStatus: fKey,
                            fruitCount:
                              fKey === 'berbuah'
                                ? Math.max(1, selectedPlant.fruitCount)
                                : 0,
                          })
                        }
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

              {/* Manual Numeric Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Tinggi Sulur (cm)</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={selectedPlant.heightCm}
                    onChange={(e) =>
                      updateSinglePlant(selectedPlant.id, {
                        heightCm: Math.max(0, Number(e.target.value) || 0),
                      })
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
                  <label className="block text-xs font-medium mb-1">Jumlah Buah</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={selectedPlant.fruitCount}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      updateSinglePlant(selectedPlant.id, {
                        fruitCount: val,
                        fruitingStatus: val > 0 ? 'berbuah' : 'tidak_berbuah',
                      });
                    }}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Est. Bobot (kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={10}
                    value={selectedPlant.estWeightKg}
                    onChange={(e) =>
                      updateSinglePlant(selectedPlant.id, {
                        estWeightKg: Math.max(0, Number(e.target.value) || 0),
                      })
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
                  <label className="block text-xs font-medium mb-1">Kadar Brix (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={25}
                    value={selectedPlant.brix}
                    onChange={(e) =>
                      updateSinglePlant(selectedPlant.id, {
                        brix: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
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

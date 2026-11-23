import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  Calendar,
  CalendarClock,
  Check,
  Copy,
  Droplet,
  Pencil,
  Plus,
  Search,
  SprayCan,
  Trash2,
  X,
} from 'lucide-react';
import {
  MEDICINE_SUGGESTIONS,
  SPRAY_CATEGORY_LABELS,
  SPRAY_SUGGESTIONS,
  TREATMENT_TYPE_LABELS,
} from '../constants/themes';
import {
  GreenhouseData,
  SprayCategory,
  TreatmentRecord,
  TreatmentStatus,
  TreatmentType,
} from '../types';
import {
  localDateTimeInputToIso,
  matchesLocalDate,
  toLocalDateInputValue,
  toLocalDateTimeInputValue,
} from '../utils/dateUtils';
import { OperatorField } from './OperatorField';

interface DashboardTreatmentsProps {
  gh: GreenhouseData;
  onUpdateGh: (updater: (gh: GreenhouseData) => GreenhouseData) => void;
}

export const DashboardTreatments: React.FC<DashboardTreatmentsProps> = ({
  gh,
  onUpdateGh,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | TreatmentType>('all');
  const [sprayFilter, setSprayFilter] = useState<'all' | SprayCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TreatmentStatus>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  interface MixItem {
    category?: SprayCategory;
    name: string;
    active: string;
    dosage: string;
  }

  const formRef = useRef<HTMLElement | null>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);

  // Manual Treatment Form state
  const [formType, setFormType] = useState<TreatmentType>('penyemprotan');
  const [sprayCategory, setSprayCategory] = useState<SprayCategory>('pupuk');
  const [sprayMixMode, setSprayMixMode] = useState<'single' | 'dual'>('single');
  const [sprayDualSlot1, setSprayDualSlot1] = useState<MixItem>({
    category: 'pupuk',
    name: '',
    active: '',
    dosage: '',
  });
  const [sprayDualSlot2, setSprayDualSlot2] = useState<MixItem>({
    category: 'fungisida',
    name: '',
    active: '',
    dosage: '',
  });
  const [drenchMixMode, setDrenchMixMode] = useState<'single' | 'multi'>('single');
  const [drenchSelectedItems, setDrenchSelectedItems] = useState<MixItem[]>([]);
  const [customDrenchName, setCustomDrenchName] = useState('');
  const [customDrenchActive, setCustomDrenchActive] = useState('');
  const [customDrenchDosage, setCustomDrenchDosage] = useState('');

  const [medicineName, setMedicineName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dosage, setDosage] = useState('');
  const [targetPlants, setTargetPlants] = useState(`Semua Tanaman (1–${gh.capacity})`);
  const [scheduledAt, setScheduledAt] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 3600 * 1000))
  );
  const [completedAtInput, setCompletedAtInput] = useState(() => toLocalDateTimeInputValue());
  const [formStatus, setFormStatus] = useState<TreatmentStatus>('terjadwal');
  const [operator, setOperator] = useState('');
  const [notes, setNotes] = useState('');
  const [manualInputMode, setManualInputMode] = useState(false);

  const resetMixStates = () => {
    setSprayMixMode('single');
    setSprayDualSlot1({ category: 'pupuk', name: '', active: '', dosage: '' });
    setSprayDualSlot2({ category: 'fungisida', name: '', active: '', dosage: '' });
    setDrenchMixMode('single');
    setDrenchSelectedItems([]);
    setCustomDrenchName('');
    setCustomDrenchActive('');
    setCustomDrenchDosage('');
  };

  useEffect(() => {
    setSelectedIds([]);
    setConfirmClearAll(false);
    setDateFilter('');
    setEditingTreatmentId(null);
    setTargetPlants(`Semua Tanaman (1–${gh.capacity})`);
    setMedicineName('');
    setActiveIngredient('');
    setDosage('');
    setOperator('');
    setNotes('');
    setManualInputMode(false);
    resetMixStates();
  }, [gh.id, gh.capacity]);

  const summary = useMemo(() => {
    const byType = {
      penyemprotan: gh.treatments.filter((t) => t.type === 'penyemprotan'),
      pengolesan: gh.treatments.filter((t) => t.type === 'pengolesan'),
      pengocoran: gh.treatments.filter((t) => t.type === 'pengocoran'),
    };
    return {
      total: gh.treatments.length,
      pending: gh.treatments.filter((t) => t.status === 'terjadwal').length,
      done: gh.treatments.filter((t) => t.status === 'selesai').length,
      penyemprotan: byType.penyemprotan.length,
      pengolesan: byType.pengolesan.length,
      pengocoran: byType.pengocoran.length,
    };
  }, [gh.treatments]);

  const activeSuggestions = useMemo(() => {
    if (formType === 'penyemprotan') {
      return SPRAY_SUGGESTIONS[sprayCategory];
    }
    return MEDICINE_SUGGESTIONS[formType];
  }, [formType, sprayCategory]);

  const filteredTreatments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gh.treatments.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (
        (typeFilter === 'penyemprotan' || typeFilter === 'all') &&
        sprayFilter !== 'all'
      ) {
        if (t.type !== 'penyemprotan' || t.sprayCategory !== sprayFilter) return false;
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (dateFilter) {
        const matchSchedule = matchesLocalDate(t.scheduledAt, dateFilter);
        const matchComplete = t.completedAt ? matchesLocalDate(t.completedAt, dateFilter) : false;
        if (!matchSchedule && !matchComplete) return false;
      }
      if (q) {
        const hay = `${t.medicineName || ''} ${t.activeIngredient || ''} ${t.sprayCategory || ''} ${t.targetPlants || ''} ${t.operator || ''} ${t.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [gh.treatments, typeFilter, sprayFilter, statusFilter, dateFilter, searchQuery]);

  const syncMixItemsToForm = (items: MixItem[]) => {
    const valid = items.filter((item) => item.name.trim() !== '');
    setManualInputMode(false);
    setMedicineName(valid.map((item) => item.name.trim()).join(' + '));
    setActiveIngredient(
      valid
        .map((item) => item.active.trim())
        .filter(Boolean)
        .join(' + ')
    );
    setDosage(
      valid
        .map((item) => item.dosage.trim())
        .filter(Boolean)
        .join(' + ')
    );
  };

  const updateDualSlot = (slotNumber: 1 | 2, nextSlot: MixItem) => {
    if (slotNumber === 1) {
      setSprayDualSlot1(nextSlot);
      if (nextSlot.category) setSprayCategory(nextSlot.category);
      syncMixItemsToForm([nextSlot, sprayDualSlot2]);
    } else {
      setSprayDualSlot2(nextSlot);
      syncMixItemsToForm([sprayDualSlot1, nextSlot]);
    }
  };

  const toggleDrenchMultiItem = (item: { name: string; active: string; dosage: string }) => {
    setDrenchSelectedItems((prev) => {
      const exists = prev.some((x) => x.name === item.name);
      const next = exists
        ? prev.filter((x) => x.name !== item.name)
        : [...prev, { name: item.name, active: item.active, dosage: item.dosage }];
      syncMixItemsToForm(next);
      return next;
    });
  };

  const addCustomDrenchItem = () => {
    const name = customDrenchName.trim();
    if (!name) return;
    const newItem: MixItem = {
      name,
      active: customDrenchActive.trim() || 'Formula khusus kocor',
      dosage: customDrenchDosage.trim() || 'Sesuai takaran',
    };
    setDrenchSelectedItems((prev) => {
      const next = [...prev.filter((x) => x.name !== name), newItem];
      syncMixItemsToForm(next);
      return next;
    });
    setCustomDrenchName('');
    setCustomDrenchActive('');
    setCustomDrenchDosage('');
  };

  const applySuggestion = (s: { name: string; active: string; dosage: string }) => {
    setManualInputMode(false);
    setMedicineName(s.name);
    setActiveIngredient(s.active);
    setDosage(s.dosage);
  };

  const activateManualInput = () => {
    setManualInputMode(true);
    setMedicineName('');
    setActiveIngredient('');
    setDosage('');
  };

  const resetFormAfterSaveOrCancel = () => {
    setEditingTreatmentId(null);
    setMedicineName('');
    setActiveIngredient('');
    setDosage('');
    setOperator('');
    setNotes('');
    setManualInputMode(false);
    setFormStatus('terjadwal');
    setScheduledAt(toLocalDateTimeInputValue(new Date(Date.now() + 3600 * 1000)));
    setCompletedAtInput(toLocalDateTimeInputValue());
    setTargetPlants(`Semua Tanaman (1–${gh.capacity})`);
    resetMixStates();
  };

  const startEditingTreatment = (item: TreatmentRecord) => {
    setEditingTreatmentId(item.id);
    setFormType(item.type);
    setSprayCategory(item.sprayCategory || 'pupuk');
    resetMixStates();
    setManualInputMode(true);
    setMedicineName(item.medicineName);
    setActiveIngredient(item.activeIngredient);
    setDosage(item.dosage);
    setTargetPlants(item.targetPlants);
    const schedLocal = toLocalDateTimeInputValue(new Date(item.scheduledAt));
    setScheduledAt(schedLocal);
    setFormStatus(item.status);
    setCompletedAtInput(
      item.completedAt
        ? toLocalDateTimeInputValue(new Date(item.completedAt))
        : schedLocal
    );
    setOperator(item.operator);
    setNotes(item.notes);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) return;

    const isoDate = localDateTimeInputToIso(scheduledAt);
    const isoCompleted =
      formStatus === 'selesai'
        ? localDateTimeInputToIso(completedAtInput || scheduledAt)
        : undefined;
    const record: TreatmentRecord = {
      id: editingTreatmentId || `tr-${Date.now()}`,
      type: formType,
      sprayCategory: formType === 'penyemprotan' ? sprayCategory : undefined,
      medicineName: medicineName.trim(),
      activeIngredient: activeIngredient.trim() || 'Formula khusus kebun',
      dosage: dosage.trim() || 'Sesuai anjuran label',
      targetPlants: targetPlants.trim() || `Semua Tanaman (1–${gh.capacity})`,
      scheduledAt: isoDate,
      completedAt: isoCompleted,
      status: formStatus,
      operator: operator.trim() || 'Petugas',
      notes: notes.trim(),
    };

    if (editingTreatmentId) {
      onUpdateGh((prev) => ({
        ...prev,
        treatments: prev.treatments
          .map((t) => (t.id === editingTreatmentId ? record : t))
          .sort((a, b) => String(b.scheduledAt).localeCompare(String(a.scheduledAt))),
      }));
    } else {
      onUpdateGh((prev) => ({
        ...prev,
        treatments: [record, ...prev.treatments].sort((a, b) =>
          String(b.scheduledAt).localeCompare(String(a.scheduledAt))
        ),
      }));
    }

    resetFormAfterSaveOrCancel();
  };

  const toggleStatus = (id: string) => {
    onUpdateGh((prev) => ({
      ...prev,
      treatments: prev.treatments.map((t) => {
        if (t.id !== id) return t;
        const nextStatus: TreatmentStatus = t.status === 'terjadwal' ? 'selesai' : 'terjadwal';
        return {
          ...t,
          status: nextStatus,
          completedAt: nextStatus === 'selesai' ? new Date().toISOString() : undefined,
        };
      }),
    }));
  };

  const duplicateForNextCycle = (item: TreatmentRecord) => {
    const nextDate = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    const copy: TreatmentRecord = {
      ...item,
      id: `tr-${Date.now()}`,
      scheduledAt: nextDate,
      completedAt: undefined,
      status: 'terjadwal',
      notes: item.notes ? `${item.notes} (Ulangan siklus)` : 'Jadwal ulangan +3 hari',
    };
    onUpdateGh((prev) => ({
      ...prev,
      treatments: [copy, ...prev.treatments],
    }));
  };

  const deleteTreatment = (id: string) => {
    if (editingTreatmentId === id) {
      resetFormAfterSaveOrCancel();
    }
    onUpdateGh((prev) => ({
      ...prev,
      treatments: prev.treatments.filter((t) => t.id !== id),
    }));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const deleteSelectedTreatments = () => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    if (editingTreatmentId && idSet.has(editingTreatmentId)) {
      resetFormAfterSaveOrCancel();
    }
    onUpdateGh((prev) => ({
      ...prev,
      treatments: prev.treatments.filter((t) => !idSet.has(t.id)),
    }));
    setSelectedIds([]);
  };

  const deleteAllTreatments = () => {
    resetFormAfterSaveOrCancel();
    onUpdateGh((prev) => ({
      ...prev,
      treatments: [],
    }));
    setSelectedIds([]);
    setConfirmClearAll(false);
  };

  const renderTypeIcon = (type: TreatmentType) => {
    if (type === 'penyemprotan') return <SprayCan className="h-4 w-4" />;
    if (type === 'pengolesan') return <Brush className="h-4 w-4" />;
    return <Droplet className="h-4 w-4" />;
  };

  const formatSprayLabel = (cat?: SprayCategory) => {
    if (cat === 'pupuk') return 'Pupuk';
    if (cat === 'insektisida') return 'Insektisida';
    if (cat === 'fungisida') return 'Fungisida';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--app-text-muted)' }}>
            <span>Jadwal Menunggu</span>
            <CalendarClock className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular">
            {summary.pending}{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--app-text-muted)' }}>
              / {summary.total} total
            </span>
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--app-text-muted)' }}>
            <span>Penyemprotan Daun</span>
            <SprayCan className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular">
            {summary.penyemprotan}{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--app-text-muted)' }}>
              riwayat
            </span>
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--app-text-muted)' }}>
            <span>Pengolesan Obat Batang</span>
            <Brush className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular">
            {summary.pengolesan}{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--app-text-muted)' }}>
              riwayat
            </span>
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--app-text-muted)' }}>
            <span>Pengocoran Obat & Akar</span>
            <Droplet className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular">
            {summary.pengocoran}{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--app-text-muted)' }}>
              riwayat
            </span>
          </div>
        </div>
      </section>

      {/* Main Split: Left Manual Entry + Right Treatment Queue & Log */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Form (5 cols) */}
        <section
          ref={formRef}
          className="rounded-xl border p-5 xl:col-span-5 h-fit"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: editingTreatmentId ? 'var(--app-accent)' : 'var(--app-border)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">
                {editingTreatmentId ? 'Edit Catatan Perawatan Tanaman' : 'Input Perawatan Tanaman Manual'}
              </h3>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                {editingTreatmentId
                  ? `Ubah jenis obat, bahan aktif, dosis, jadwal, atau petugas untuk ${gh.name}.`
                  : `Catat aplikasi penyemprotan (1 atau 2 barang bersama), pengolesan batang, atau pengocoran (tunggal / bersama) untuk ${gh.name}.`}
              </p>
            </div>
            {editingTreatmentId && (
              <button
                type="button"
                onClick={resetFormAfterSaveOrCancel}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer shrink-0"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface-muted)',
                  color: 'var(--app-text)',
                }}
              >
                <X className="h-3.5 w-3.5" />
                Batal
              </button>
            )}
          </div>

          {editingTreatmentId && (
            <div
              className="mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
              style={{
                borderColor: 'var(--app-accent)',
                backgroundColor: 'var(--app-accent-soft)',
                color: 'var(--app-accent)',
              }}
            >
              <span>Sedang mengedit catatan perawatan — tekan Simpan Perubahan di bawah.</span>
            </div>
          )}

          <form onSubmit={handleSaveTreatment} className="mt-4 space-y-3.5">
            {/* Treatment Type Segmented Control */}
            <div>
              <label className="block text-xs font-medium mb-1.5">Metode Perawatan</label>
              <div
                className="grid grid-cols-3 gap-1 rounded-lg p-1"
                style={{ backgroundColor: 'var(--app-surface-muted)' }}
              >
                {(['penyemprotan', 'pengolesan', 'pengocoran'] as TreatmentType[]).map((t) => {
                  const active = formType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className="flex items-center justify-center gap-1.5 rounded-md py-2 px-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: active ? 'var(--app-surface)' : 'transparent',
                        color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      {renderTypeIcon(t)}
                      <span>{TREATMENT_TYPE_LABELS[t].short}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {TREATMENT_TYPE_LABELS[formType].desc}
              </p>
            </div>

            {/* Sub-options when Penyemprotan: Mode 1 Barang vs 2 Barang Bersama */}
            {formType === 'penyemprotan' && (
              <div
                className="rounded-lg border p-3 space-y-2.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold">
                    Mode Penyemprotan
                  </label>
                  <div
                    className="grid grid-cols-2 gap-1 rounded-lg p-1"
                    style={{ backgroundColor: 'var(--app-surface-muted)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSprayMixMode('single')}
                      className="rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: sprayMixMode === 'single' ? 'var(--app-surface)' : 'transparent',
                        color: sprayMixMode === 'single' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                      }}
                    >
                      1 Jenis Barang
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSprayMixMode('dual');
                        syncMixItemsToForm([sprayDualSlot1, sprayDualSlot2]);
                      }}
                      className="rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: sprayMixMode === 'dual' ? 'var(--app-accent)' : 'transparent',
                        color: sprayMixMode === 'dual' ? 'var(--app-accent-fg)' : 'var(--app-text-muted)',
                      }}
                    >
                      2 Barang (Semprot Bersama)
                    </button>
                  </div>
                </div>

                {sprayMixMode === 'single' ? (
                  <>
                    <div
                      className="grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-lg p-1"
                      style={{ backgroundColor: 'var(--app-surface-muted)' }}
                    >
                      {(['pupuk', 'insektisida', 'fungisida'] as SprayCategory[]).map((cat) => {
                        const active = sprayCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSprayCategory(cat)}
                            className="rounded-md py-1.5 px-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                            style={{
                              backgroundColor: active ? 'var(--app-accent)' : 'transparent',
                              color: active ? 'var(--app-accent-fg)' : 'var(--app-text-muted)',
                            }}
                          >
                            {formatSprayLabel(cat)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      {SPRAY_CATEGORY_LABELS[sprayCategory].desc}
                    </p>
                  </>
                ) : (
                  <div className="space-y-3 pt-1">
                    <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      Pilih 2 jenis barang yang dicampur dalam 1 tangki semprot (mis. Pupuk + Fungisida atau Insektisida + Fungisida). Hasil otomatis digabungkan di kolom bawah dan tetap bisa diedit.
                    </p>
                    {([1, 2] as const).map((slotNum) => {
                      const slot = slotNum === 1 ? sprayDualSlot1 : sprayDualSlot2;
                      const slotCat = slot.category || (slotNum === 1 ? 'pupuk' : 'fungisida');
                      const slotSuggestions = SPRAY_SUGGESTIONS[slotCat];
                      return (
                        <div
                          key={slotNum}
                          className="rounded-lg border p-2.5 space-y-2"
                          style={{
                            borderColor: slot.name ? 'var(--app-accent)' : 'var(--app-border)',
                            backgroundColor: 'var(--app-surface)',
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
                              Barang {slotNum} {slot.name ? `· ${slot.name}` : '(Pilih / ketik)'}
                            </span>
                            <div className="flex items-center gap-1">
                              {(['pupuk', 'insektisida', 'fungisida'] as SprayCategory[]).map((cat) => {
                                const active = slotCat === cat;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() =>
                                      updateDualSlot(slotNum, { ...slot, category: cat })
                                    }
                                    className="rounded px-2 py-0.5 text-[10px] font-semibold cursor-pointer"
                                    style={{
                                      backgroundColor: active ? 'var(--app-accent)' : 'var(--app-surface-muted)',
                                      color: active ? 'var(--app-accent-fg)' : 'var(--app-text-muted)',
                                    }}
                                  >
                                    {formatSprayLabel(cat)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {slotSuggestions.map((s) => {
                              const isPicked = slot.name === s.name;
                              return (
                                <button
                                  key={s.name}
                                  type="button"
                                  onClick={() =>
                                    updateDualSlot(slotNum, {
                                      category: slotCat,
                                      name: s.name,
                                      active: s.active,
                                      dosage: s.dosage,
                                    })
                                  }
                                  className="rounded border px-2 py-0.5 text-[11px] font-medium cursor-pointer"
                                  style={{
                                    borderColor: isPicked ? 'var(--app-accent)' : 'var(--app-border)',
                                    backgroundColor: isPicked ? 'var(--app-accent-soft)' : 'var(--app-surface-muted)',
                                    color: isPicked ? 'var(--app-accent)' : 'var(--app-text)',
                                  }}
                                >
                                  {s.name}
                                </button>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                            <input
                              type="text"
                              value={slot.name}
                              onChange={(e) =>
                                updateDualSlot(slotNum, {
                                  ...slot,
                                  category: slotCat,
                                  name: e.target.value,
                                })
                              }
                              placeholder={`Nama barang ${slotNum}...`}
                              className="rounded border px-2 py-1 text-xs focus:outline-none"
                              style={{
                                borderColor: 'var(--app-border)',
                                backgroundColor: 'var(--app-canvas)',
                                color: 'var(--app-text)',
                              }}
                            />
                            <input
                              type="text"
                              value={slot.dosage}
                              onChange={(e) =>
                                updateDualSlot(slotNum, {
                                  ...slot,
                                  category: slotCat,
                                  dosage: e.target.value,
                                })
                              }
                              placeholder={`Dosis barang ${slotNum}`}
                              className="rounded border px-2 py-1 text-xs focus:outline-none"
                              style={{
                                borderColor: 'var(--app-border)',
                                backgroundColor: 'var(--app-canvas)',
                                color: 'var(--app-text)',
                              }}
                            />
                            <input
                              type="text"
                              value={slot.active}
                              onChange={(e) =>
                                updateDualSlot(slotNum, {
                                  ...slot,
                                  category: slotCat,
                                  active: e.target.value,
                                })
                              }
                              placeholder={`Bahan aktif ${slotNum}`}
                              className="rounded border px-2 py-1 text-xs focus:outline-none"
                              style={{
                                borderColor: 'var(--app-border)',
                                backgroundColor: 'var(--app-canvas)',
                                color: 'var(--app-text)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Mode Pengocoran: Tunggal vs Pengocoran Bersama (Multi-Obat) */}
            {formType === 'pengocoran' && (
              <div
                className="rounded-lg border p-3 space-y-2"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold">
                    Mode Pengocoran Obat
                  </label>
                  <div
                    className="grid grid-cols-2 gap-1 rounded-lg p-1"
                    style={{ backgroundColor: 'var(--app-surface-muted)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setDrenchMixMode('single')}
                      className="rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: drenchMixMode === 'single' ? 'var(--app-surface)' : 'transparent',
                        color: drenchMixMode === 'single' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                      }}
                    >
                      1 Jenis Obat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDrenchMixMode('multi');
                        if (drenchSelectedItems.length > 0) {
                          syncMixItemsToForm(drenchSelectedItems);
                        }
                      }}
                      className="rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                      style={{
                        backgroundColor: drenchMixMode === 'multi' ? 'var(--app-accent)' : 'transparent',
                        color: drenchMixMode === 'multi' ? 'var(--app-accent-fg)' : 'var(--app-text-muted)',
                      }}
                    >
                      Pengocoran Bersama (Multi)
                    </button>
                  </div>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  {drenchMixMode === 'multi'
                    ? 'Klik beberapa obat sekaligus (mis. Agrept + Besromil + Velum) untuk dicampur kocor bersama.'
                    : 'Pilih satu obat kocor (Agrept, Besromil, Velum, Trichoderma, dll.) atau isi manual.'}
                </p>
              </div>
            )}

            {/* Quick Medicine Presets + Opsi Isi Manual */}
            {(formType !== 'penyemprotan' || sprayMixMode === 'single') && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                    {formType === 'pengocoran' && drenchMixMode === 'multi'
                      ? `Pilih Lebih Dari 1 Obat Kocor (${drenchSelectedItems.length} dipilih):`
                      : `Pilih ${formType === 'penyemprotan' ? formatSprayLabel(sprayCategory) : TREATMENT_TYPE_LABELS[formType].short} atau Isi Manual:`}
                  </span>
                  {manualInputMode && (
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
                      Mode Isi Manual Aktif
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeSuggestions.map((s) => {
                    const isDrenchMulti = formType === 'pengocoran' && drenchMixMode === 'multi';
                    const selected = isDrenchMulti
                      ? drenchSelectedItems.some((x) => x.name === s.name)
                      : !manualInputMode && medicineName === s.name;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() =>
                          isDrenchMulti ? toggleDrenchMultiItem(s) : applySuggestion(s)
                        }
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer"
                        style={{
                          borderColor: selected ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor: selected ? 'var(--app-accent-soft)' : 'var(--app-surface-muted)',
                          color: selected ? 'var(--app-accent)' : 'var(--app-text)',
                        }}
                      >
                        {isDrenchMulti && selected && <Check className="h-3 w-3" />}
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                  {!(formType === 'pengocoran' && drenchMixMode === 'multi') && (
                    <button
                      type="button"
                      onClick={activateManualInput}
                      className="rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                      style={{
                        borderColor: manualInputMode ? 'var(--app-accent)' : 'var(--app-border)',
                        backgroundColor: manualInputMode ? 'var(--app-accent)' : 'var(--app-surface)',
                        color: manualInputMode ? 'var(--app-accent-fg)' : 'var(--app-accent)',
                      }}
                    >
                      + Isi Manual ({formType === 'penyemprotan' ? formatSprayLabel(sprayCategory) : TREATMENT_TYPE_LABELS[formType].short})
                    </button>
                  )}
                </div>

                {/* Tambah obat manual ke campuran pengocoran bersama */}
                {formType === 'pengocoran' && drenchMixMode === 'multi' && (
                  <div
                    className="mt-2.5 rounded-lg border p-2.5 space-y-2"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                    }}
                  >
                    <div className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                      Tambah Obat Lain ke Campuran Kocor (Opsional):
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <input
                        type="text"
                        value={customDrenchName}
                        onChange={(e) => setCustomDrenchName(e.target.value)}
                        placeholder="Nama obat..."
                        className="rounded border px-2 py-1 text-xs focus:outline-none"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                      <input
                        type="text"
                        value={customDrenchActive}
                        onChange={(e) => setCustomDrenchActive(e.target.value)}
                        placeholder="Bahan aktif..."
                        className="rounded border px-2 py-1 text-xs focus:outline-none"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                          color: 'var(--app-text)',
                        }}
                      />
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={customDrenchDosage}
                          onChange={(e) => setCustomDrenchDosage(e.target.value)}
                          placeholder="Dosis..."
                          className="w-full rounded border px-2 py-1 text-xs focus:outline-none"
                          style={{
                            borderColor: 'var(--app-border)',
                            backgroundColor: 'var(--app-surface)',
                            color: 'var(--app-text)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={addCustomDrenchItem}
                          className="rounded px-2 py-1 text-[11px] font-semibold shrink-0 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--app-accent)',
                            color: 'var(--app-accent-fg)',
                          }}
                        >
                          +Tambah
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {formType === 'penyemprotan'
                    ? `Nama ${formatSprayLabel(sprayCategory)} (Isi Manual / Pilihan)`
                    : 'Nama Obat / Formula'}
                </label>
                <input
                  type="text"
                  required
                  value={medicineName}
                  onChange={(e) => {
                    setManualInputMode(true);
                    setMedicineName(e.target.value);
                  }}
                  placeholder={
                    formType === 'penyemprotan'
                      ? `Ketik manual nama ${formatSprayLabel(sprayCategory).toLowerCase()}...`
                      : 'Ketik manual...'
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Dosis & Konsentrasi</label>
                <input
                  type="text"
                  required
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="Mis. 1,5 ml/L atau 5 gr/L"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Bahan Aktif / Kandungan</label>
                <input
                  type="text"
                  value={activeIngredient}
                  onChange={(e) => setActiveIngredient(e.target.value)}
                  placeholder="Mis. Fungisida Embun Tepung"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Target Tanaman / Blok</label>
                <input
                  type="text"
                  value={targetPlants}
                  onChange={(e) => setTargetPlants(e.target.value)}
                  placeholder="Mis. Semua (1–1000) atau #83, #190"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="inline-flex items-center gap-1 text-xs font-medium">
                    <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
                    <span>Tanggal & Jam Pemeriksaan / Jadwal</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = toLocalDateTimeInputValue();
                      setScheduledAt(nowStr);
                      setCompletedAtInput(nowStr);
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
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => {
                    const next = e.target.value as TreatmentStatus;
                    setFormStatus(next);
                    if (next === 'selesai' && scheduledAt) {
                      setCompletedAtInput(scheduledAt);
                    }
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                >
                  <option value="terjadwal">Terjadwal</option>
                  <option value="selesai">Sudah Selesai</option>
                </select>
              </div>
            </div>

            {formStatus === 'selesai' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">
                    Tanggal & Jam Selesai Pemeriksaan
                  </label>
                  <button
                    type="button"
                    onClick={() => setCompletedAtInput(toLocalDateTimeInputValue())}
                    className="text-[11px] underline cursor-pointer"
                    style={{ color: 'var(--app-accent)' }}
                  >
                    Samakan Sekarang
                  </button>
                </div>
                <input
                  type="datetime-local"
                  value={completedAtInput}
                  onChange={(e) => setCompletedAtInput(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
              <OperatorField
                id="treatment-operator"
                label="Petugas Pelaksana"
                value={operator}
                onChange={setOperator}
                textSizeClass="text-sm"
              />
              <div>
                <label className="block text-xs font-medium mb-1">Catatan Teknis</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mis. Semprot sore pukul 16.30"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {editingTreatmentId && (
                <button
                  type="button"
                  onClick={resetFormAfterSaveOrCancel}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium cursor-pointer"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface-muted)',
                    color: 'var(--app-text)',
                  }}
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                {editingTreatmentId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingTreatmentId ? 'Simpan Perubahan Perawatan' : `Simpan Perawatan ke ${gh.name}`}
              </button>
            </div>
          </form>
        </section>

        {/* Right Treatment Log & Schedule (7 cols) */}
        <section
          className="rounded-xl border p-5 xl:col-span-7"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Daftar Jadwal & Riwayat Perawatan</h3>
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                Kelola aplikasi penyemprotan (pupuk/insektisida/fungisida), pengolesan, dan pengocoran {gh.name}.
              </p>
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: 'var(--app-text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari obat, pupuk, target..."
                className="h-9 w-full sm:w-56 rounded-lg border pl-8 pr-3 text-xs focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <div
              className="flex flex-wrap items-center gap-1 rounded-lg p-1"
              style={{ backgroundColor: 'var(--app-surface-muted)' }}
            >
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'penyemprotan', label: 'Penyemprotan' },
                  { id: 'pengolesan', label: 'Pengolesan' },
                  { id: 'pengocoran', label: 'Pengocoran' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTypeFilter(tab.id);
                    if (tab.id !== 'penyemprotan' && tab.id !== 'all') {
                      setSprayFilter('all');
                    }
                  }}
                  className="rounded-md px-3 py-1 text-xs font-medium cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: typeFilter === tab.id ? 'var(--app-surface)' : 'transparent',
                    color: typeFilter === tab.id ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(typeFilter === 'penyemprotan' || typeFilter === 'all') && (
                <select
                  aria-label="Filter kategori penyemprotan"
                  value={sprayFilter}
                  onChange={(e) => setSprayFilter(e.target.value as 'all' | SprayCategory)}
                  className="h-8 rounded-lg border px-2.5 text-xs font-medium"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface-muted)',
                    color: 'var(--app-text)',
                  }}
                >
                  <option value="all">Semua Semprot</option>
                  <option value="pupuk">Semprot: Pupuk</option>
                  <option value="insektisida">Semprot: Insektisida</option>
                  <option value="fungisida">Semprot: Fungisida</option>
                </select>
              )}

              <div
                className="flex items-center gap-1 rounded-lg p-1"
                style={{ backgroundColor: 'var(--app-surface-muted)' }}
              >
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'terjadwal', label: 'Terjadwal' },
                    { id: 'selesai', label: 'Selesai' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: statusFilter === st.id ? 'var(--app-surface)' : 'transparent',
                      color: statusFilter === st.id ? 'var(--app-text)' : 'var(--app-text-muted)',
                    }}
                  >
                    {st.label}
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
                    aria-label="Filter tanggal pemeriksaan perawatan"
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
            </div>
          </div>

          {/* Bulk Delete Controls Bar */}
          {gh.treatments.length > 0 && (
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
                      filteredTreatments.length > 0 &&
                      filteredTreatments.every((t) => selectedIds.includes(t.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredTreatments.map((t) => t.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                  <span>Pilih Semua ({filteredTreatments.length})</span>
                </label>
                {selectedIds.length > 0 && (
                  <span className="font-mono-tabular" style={{ color: 'var(--app-accent)' }}>
                    {selectedIds.length} dipilih
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={deleteSelectedTreatments}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Dipilih ({selectedIds.length})
                  </button>
                )}

                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Semua
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      Hapus semua {gh.treatments.length} data?
                    </span>
                    <button
                      type="button"
                      onClick={deleteAllTreatments}
                      className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                    >
                      Ya, Hapus Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
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

          {/* Treatment Items */}
          {filteredTreatments.length === 0 ? (
            <div
              className="mt-4 rounded-lg border border-dashed py-12 text-center text-sm"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            >
              Belum ada catatan perawatan yang cocok. Tambahkan jadwal atau log baru menggunakan formulir di samping.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
              {filteredTreatments.map((item) => {
                const isDone = item.status === 'selesai';
                const isChecked = selectedIds.includes(item.id);
                const spraySub = item.type === 'penyemprotan' && item.sprayCategory
                  ? ` · ${formatSprayLabel(item.sprayCategory)}`
                  : '';

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-4 px-2 sm:flex-row sm:items-start sm:justify-between rounded-lg transition-colors"
                    style={{
                      backgroundColor: isChecked ? 'var(--app-accent-soft)' : 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${item.medicineName}`}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, item.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                          }
                        }}
                        className="mt-1 h-4 w-4 accent-emerald-600 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--app-accent)' }}>
                            {renderTypeIcon(item.type)}
                            {TREATMENT_TYPE_LABELS[item.type]?.short || item.type}
                            {spraySub}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {new Date(item.scheduledAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              isDone
                                ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'font-semibold text-amber-700 dark:text-amber-400'
                            }
                          >
                            {isDone ? 'Selesai' : 'Terjadwal'}
                          </span>
                          {isDone && item.completedAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular text-[11px]">
                                Selesai{' '}
                                {new Date(item.completedAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="text-sm font-semibold">
                          {item.medicineName}{' '}
                          <span className="font-mono-tabular font-normal text-xs" style={{ color: 'var(--app-text-muted)' }}>
                            ({item.dosage})
                          </span>
                        </div>

                        <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                          {item.activeIngredient} · Target: <strong style={{ color: 'var(--app-text)' }}>{item.targetPlants}</strong> · Petugas: {item.operator}
                        </div>

                        {item.notes && (
                          <p className="text-xs pt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                      <button
                        type="button"
                        onClick={() => toggleStatus(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        style={{
                          borderColor: isDone ? 'var(--app-border)' : 'var(--app-accent)',
                          backgroundColor: isDone ? 'transparent' : 'var(--app-accent-soft)',
                          color: isDone ? 'var(--app-text-muted)' : 'var(--app-accent)',
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {isDone ? 'Buka Ulang' : 'Tandai Selesai'}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditingTreatment(item)}
                        title="Edit catatan perawatan ini"
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        style={{
                          borderColor: editingTreatmentId === item.id ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor: editingTreatmentId === item.id ? 'var(--app-accent-soft)' : 'transparent',
                          color: editingTreatmentId === item.id ? 'var(--app-accent)' : 'var(--app-text)',
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => duplicateForNextCycle(item)}
                        title="Jadwalkan ulang (+3 hari)"
                        className="rounded-lg border p-1.5 transition-opacity hover:opacity-80 cursor-pointer"
                        style={{
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)',
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTreatment(item.id)}
                        title="Hapus perawatan ini"
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:text-rose-600 cursor-pointer"
                        style={{
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)',
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

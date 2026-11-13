import React, { useEffect, useMemo, useState } from 'react';
import {
  Brush,
  CalendarClock,
  Check,
  Copy,
  Droplet,
  Plus,
  Search,
  SprayCan,
  Trash2,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setConfirmClearAll(false);
    setTargetPlants(`Semua Tanaman (1–${gh.capacity})`);
  }, [gh.id, gh.capacity]);

  // Manual Treatment Form state
  const [formType, setFormType] = useState<TreatmentType>('penyemprotan');
  const [sprayCategory, setSprayCategory] = useState<SprayCategory>('pupuk');
  const [medicineName, setMedicineName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dosage, setDosage] = useState('');
  const [targetPlants, setTargetPlants] = useState(`Semua Tanaman (1–${gh.capacity})`);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 3600 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [formStatus, setFormStatus] = useState<TreatmentStatus>('terjadwal');
  const [operator, setOperator] = useState('Budi Santoso');
  const [notes, setNotes] = useState('');
  const [manualInputMode, setManualInputMode] = useState(false);

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
      if (q) {
        const hay = `${t.medicineName} ${t.activeIngredient} ${t.sprayCategory || ''} ${t.targetPlants} ${t.operator} ${t.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [gh.treatments, typeFilter, sprayFilter, statusFilter, searchQuery]);

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

  const handleAddTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) return;

    const isoDate = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();
    const record: TreatmentRecord = {
      id: `tr-${Date.now()}`,
      type: formType,
      sprayCategory: formType === 'penyemprotan' ? sprayCategory : undefined,
      medicineName: medicineName.trim(),
      activeIngredient: activeIngredient.trim() || 'Formula khusus kebun',
      dosage: dosage.trim() || 'Sesuai anjuran label',
      targetPlants: targetPlants.trim() || `Semua Tanaman (1–${gh.capacity})`,
      scheduledAt: isoDate,
      completedAt: formStatus === 'selesai' ? new Date().toISOString() : undefined,
      status: formStatus,
      operator: operator.trim() || 'Operator',
      notes: notes.trim(),
    };

    onUpdateGh((prev) => ({
      ...prev,
      treatments: [record, ...prev.treatments],
    }));

    setMedicineName('');
    setActiveIngredient('');
    setDosage('');
    setNotes('');
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
    onUpdateGh((prev) => ({
      ...prev,
      treatments: prev.treatments.filter((t) => t.id !== id),
    }));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const deleteSelectedTreatments = () => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    onUpdateGh((prev) => ({
      ...prev,
      treatments: prev.treatments.filter((t) => !idSet.has(t.id)),
    }));
    setSelectedIds([]);
  };

  const deleteAllTreatments = () => {
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
          className="rounded-xl border p-5 xl:col-span-5 h-fit"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <h3 className="text-sm font-semibold">Input Perawatan Tanaman Manual</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--app-text-muted)' }}>
            Catat aplikasi penyemprotan (pupuk, insektisida, fungisida), pengolesan batang, atau pengocoran obat untuk {gh.name}.
          </p>

          <form onSubmit={handleAddTreatment} className="mt-4 space-y-3.5">
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

            {/* Sub-options when Penyemprotan: Pupuk, Insektisida, Fungisida */}
            {formType === 'penyemprotan' && (
              <div
                className="rounded-lg border p-3 space-y-2"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <label className="block text-xs font-semibold">
                  Kategori Penyemprotan
                </label>
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
              </div>
            )}

            {/* Quick Medicine Presets + Opsi Isi Manual */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                  Pilih {formType === 'penyemprotan' ? formatSprayLabel(sprayCategory) : TREATMENT_TYPE_LABELS[formType].short} atau Isi Manual:
                </span>
                {manualInputMode && (
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
                    Mode Isi Manual Aktif
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeSuggestions.map((s) => {
                  const selected = !manualInputMode && medicineName === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer"
                      style={{
                        borderColor: selected ? 'var(--app-accent)' : 'var(--app-border)',
                        backgroundColor: selected ? 'var(--app-accent-soft)' : 'var(--app-surface-muted)',
                        color: selected ? 'var(--app-accent)' : 'var(--app-text)',
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
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
              </div>
            </div>

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
                <label className="block text-xs font-medium mb-1">Tanggal & Jam</label>
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
                  onChange={(e) => setFormStatus(e.target.value as TreatmentStatus)}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Petugas Pelaksana</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
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

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--app-accent)',
                color: 'var(--app-accent-fg)',
              }}
            >
              <Plus className="h-4 w-4" />
              Simpan Perawatan ke {gh.name}
            </button>
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
                            {TREATMENT_TYPE_LABELS[item.type].short}
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

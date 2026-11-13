import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { GROWTH_PHASE_SPECS } from '../constants/themes';
import { GreenhouseData, GrowthPhase } from '../types';

interface GreenhouseModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  activeGh: GreenhouseData;
  ghCount: number;
  onSaveNew: (payload: {
    name: string;
    variety: string;
    capacity: number;
    gulliesCount: number;
    reservoirLiters: number;
    plantingDate: string;
    harvestDate: string;
    phase: GrowthPhase;
    ppm: number;
    ph: number;
  }) => void;
  onSaveEdit: (payload: {
    name: string;
    variety: string;
    capacity: number;
    gulliesCount: number;
    reservoirLiters: number;
    plantingDate: string;
    harvestDate: string;
    phase: GrowthPhase;
    ppm: number;
    ph: number;
  }) => void;
  onDeleteGh: (ghId: string) => void;
  onClose: () => void;
}

export const GreenhouseModal: React.FC<GreenhouseModalProps> = ({
  isOpen,
  mode,
  activeGh,
  ghCount,
  onSaveNew,
  onSaveEdit,
  onDeleteGh,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [capacity, setCapacity] = useState('1000');
  const [gulliesCount, setGulliesCount] = useState('20');
  const [reservoirLiters, setReservoirLiters] = useState('2000');
  const [plantingDate, setPlantingDate] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [phase, setPhase] = useState<GrowthPhase>('vegetatif');
  const [ppm, setPpm] = useState('1100');
  const [ph, setPh] = useState('6.0');

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'add') {
      setName(`GH ${ghCount + 1}`);
      setVariety('Melon Inthanon RZ');
      setCapacity('1000');
      setGulliesCount('20');
      setReservoirLiters('2000');
      setPlantingDate(new Date().toISOString().slice(0, 10));
      setHarvestDate('');
      setPhase('semai');
      setPpm('750');
      setPh('6.7');
    } else {
      setName(activeGh.name);
      setVariety(activeGh.variety);
      setCapacity(String(activeGh.capacity));
      setGulliesCount(String(activeGh.gulliesCount));
      setReservoirLiters(String(activeGh.reservoirLiters));
      setPlantingDate(activeGh.plantingDate);
      setHarvestDate(activeGh.harvestDate || '');
      setPhase(activeGh.phase);
      setPpm(String(activeGh.currentWater.ppm));
      setPh(String(activeGh.currentWater.ph));
    }
  }, [isOpen, mode, activeGh, ghCount]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim() || `GH ${ghCount + 1}`,
      variety: variety.trim() || 'Melon Hidroponik NFT',
      capacity: Math.max(10, Math.min(2000, parseInt(capacity, 10) || 1000)),
      gulliesCount: Math.max(1, parseInt(gulliesCount, 10) || 20),
      reservoirLiters: Math.max(100, parseInt(reservoirLiters, 10) || 2000),
      plantingDate: plantingDate || new Date().toISOString().slice(0, 10),
      harvestDate: harvestDate || '',
      phase,
      ppm: Math.max(0, parseInt(ppm, 10) || 1000),
      ph: Number(Math.min(14, Math.max(0, Number(ph) || 6.0)).toFixed(2)),
    };
    if (mode === 'add') {
      onSaveNew(payload);
    } else {
      onSaveEdit(payload);
    }
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Greenhouse Manual"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl border shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5 sm:py-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold truncate">
              {mode === 'add' ? 'Tambah Greenhouse Baru (Manual)' : `Isi Manual / Edit ${activeGh.name}`}
            </h2>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
              Atur identitas GH 1, GH 2, dan seterusnya beserta kapasitas tanaman & nilai awal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1">Nama Greenhouse</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: GH 1, GH 4, Blok Timur"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Varietas Melon</label>
              <input
                type="text"
                required
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="Mis. Inthanon RZ / Fujisawa"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Kapasitas (Pohon)</label>
              <input
                type="number"
                min={10}
                max={2000}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Jumlah Talang NFT</label>
              <input
                type="number"
                min={1}
                value={gulliesCount}
                onChange={(e) => setGulliesCount(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tandon (Liter)</label>
              <input
                type="number"
                min={100}
                value={reservoirLiters}
                onChange={(e) => setReservoirLiters(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium mb-1">Tanggal Tanam</label>
              <input
                type="date"
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium">Tanggal Panen (Manual)</label>
                {harvestDate && (
                  <button
                    type="button"
                    onClick={() => setHarvestDate('')}
                    className="text-[11px] underline cursor-pointer"
                    style={{ color: 'var(--app-text-muted)' }}
                  >
                    Kosongkan
                  </button>
                )}
              </div>
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fase Pertumbuhan</label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as GrowthPhase)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              >
                {(Object.keys(GROWTH_PHASE_SPECS) as GrowthPhase[]).map((k) => (
                  <option key={k} value={k}>
                    {GROWTH_PHASE_SPECS[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Nilai PPM Manual</label>
              <input
                type="number"
                min={0}
                max={5000}
                value={ppm}
                onChange={(e) => setPpm(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nilai pH Manual</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={14}
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono-tabular focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {mode === 'edit' && ghCount > 1 ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteGh(activeGh.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-rose-600 cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus {activeGh.name}
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                {mode === 'add' ? 'Tambah Greenhouse' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

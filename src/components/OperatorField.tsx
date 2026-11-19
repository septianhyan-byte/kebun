import React, { useEffect, useState } from 'react';
import { Check, Trash2, UserPlus } from 'lucide-react';
import { loadOperatorNames, saveOperatorNames } from '../utils/storage';

interface OperatorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  inputBgVar?: string;
  textSizeClass?: string;
}

export const OperatorField: React.FC<OperatorFieldProps> = ({
  id,
  label,
  value,
  onChange,
  inputBgVar = 'var(--app-canvas)',
  textSizeClass = 'text-xs',
}) => {
  const [savedNames, setSavedNames] = useState<string[]>(() => loadOperatorNames());
  const [addingNew, setAddingNew] = useState(false);
  const [newNameDraft, setNewNameDraft] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setSavedNames(detail);
      } else {
        setSavedNames(loadOperatorNames());
      }
    };
    window.addEventListener('melonflow:operators-updated', onUpdated);
    return () => window.removeEventListener('melonflow:operators-updated', onUpdated);
  }, []);

  const handleSaveName = (rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;
    const updated = saveOperatorNames([...savedNames, clean]);
    setSavedNames(updated);
    onChange(clean);
    setNewNameDraft('');
    setAddingNew(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const handleDeleteSavedName = (target: string) => {
    const updated = saveOperatorNames(
      savedNames.filter((n) => n.toLowerCase() !== target.toLowerCase())
    );
    setSavedNames(updated);
    if (value.trim().toLowerCase() === target.toLowerCase()) {
      onChange('');
    }
  };

  const selectedMatch =
    savedNames.find((n) => n.toLowerCase() === value.trim().toLowerCase()) || '';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label htmlFor={id} className="block text-[11px] font-medium">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {savedFlash && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              Tersimpan
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setAddingNew((prev) => !prev);
              setNewNameDraft('');
            }}
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium cursor-pointer whitespace-nowrap"
            style={{
              borderColor: addingNew ? 'var(--app-accent)' : 'var(--app-border)',
              backgroundColor: addingNew ? 'var(--app-accent-soft)' : 'var(--app-surface)',
              color: addingNew ? 'var(--app-accent)' : 'var(--app-text-muted)',
            }}
          >
            <UserPlus className="h-3 w-3" />
            {addingNew ? 'Tutup' : 'Tambah Nama'}
          </button>
        </div>
      </div>

      {/* Inline quick-add new officer name */}
      {addingNew && (
        <div
          className="flex items-center gap-1.5 rounded-lg border p-1.5"
          style={{
            borderColor: 'var(--app-accent)',
            backgroundColor: 'var(--app-surface)',
          }}
        >
          <input
            type="text"
            maxLength={80}
            value={newNameDraft}
            onChange={(e) => setNewNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveName(newNameDraft);
              }
            }}
            placeholder="Ketik nama petugas baru..."
            className="h-8 flex-1 rounded border px-2.5 text-xs focus:outline-none"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
              color: 'var(--app-text)',
            }}
          />
          <button
            type="button"
            disabled={!newNameDraft.trim()}
            onClick={() => handleSaveName(newNameDraft)}
            className="h-8 rounded px-2.5 text-[11px] font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            style={{
              backgroundColor: 'var(--app-accent)',
              color: 'var(--app-accent-fg)',
            }}
          >
            Simpan
          </button>
        </div>
      )}

      {/* Single clean selector dropdown (always empty by default & after submit) */}
      <div className="flex items-center gap-1.5">
        <select
          id={id}
          aria-label={`Pilih ${label}`}
          value={selectedMatch}
          onChange={(e) => onChange(e.target.value)}
          className={`h-9 flex-1 rounded-lg border px-3 ${textSizeClass} font-medium cursor-pointer focus:outline-none`}
          style={{
            borderColor: selectedMatch ? 'var(--app-accent)' : 'var(--app-border)',
            backgroundColor: inputBgVar,
            color: selectedMatch ? 'var(--app-text)' : 'var(--app-text-muted)',
          }}
        >
          <option value="">
            {savedNames.length > 0
              ? '— Pilih nama petugas —'
              : '— Kosong (klik Tambah Nama untuk mengisi daftar) —'}
          </option>
          {savedNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {selectedMatch && (
          <button
            type="button"
            onClick={() => handleDeleteSavedName(selectedMatch)}
            title={`Hapus "${selectedMatch}" dari daftar nama`}
            aria-label={`Hapus ${selectedMatch} dari daftar nama`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-rose-600 dark:text-rose-400 cursor-pointer"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-surface)',
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

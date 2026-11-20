import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Check, Trash2 } from 'lucide-react';
import { loadBuyerNames, saveBuyerNames } from '../utils/storage';

interface BuyerFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  inputBgVar?: string;
  maxLength?: number;
}

export const BuyerField: React.FC<BuyerFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Ketik nama pembeli manual...',
  inputBgVar = 'var(--app-surface)',
  maxLength = 120,
}) => {
  const [savedNames, setSavedNames] = useState<string[]>(() => loadBuyerNames());
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setSavedNames(detail);
      } else {
        setSavedNames(loadBuyerNames());
      }
    };
    window.addEventListener('melonflow:buyers-updated', onUpdated);
    return () => window.removeEventListener('melonflow:buyers-updated', onUpdated);
  }, []);

  const trimmed = value.trim();
  const matchedSaved =
    savedNames.find((n) => n.toLowerCase() === trimmed.toLowerCase()) || '';
  const canSaveCurrent = trimmed.length > 0 && !matchedSaved;

  const handleSaveCurrentName = () => {
    if (!trimmed) return;
    const updated = saveBuyerNames([...savedNames, trimmed]);
    setSavedNames(updated);
    onChange(trimmed);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const handleDeleteSavedName = (target: string) => {
    const updated = saveBuyerNames(
      savedNames.filter((n) => n.toLowerCase() !== target.toLowerCase())
    );
    setSavedNames(updated);
    if (trimmed.toLowerCase() === target.toLowerCase()) {
      onChange('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label htmlFor={id} className="block text-[11px] font-medium">
          {label}
        </label>
        {savedFlash && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            Nama tersimpan
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {/* Opsi 1: Pilih dari daftar nama pembeli tersimpan */}
        <div className="flex items-center gap-1">
          <select
            aria-label={`Pilih ${label} tersimpan`}
            value={matchedSaved}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 flex-1 min-w-0 rounded-lg border px-2.5 text-xs font-medium cursor-pointer focus:outline-none"
            style={{
              borderColor: matchedSaved ? 'var(--app-accent)' : 'var(--app-border)',
              backgroundColor: inputBgVar,
              color: matchedSaved ? 'var(--app-text)' : 'var(--app-text-muted)',
            }}
          >
            <option value="">
              {savedNames.length > 0
                ? '— Pilih nama tersimpan —'
                : '— Belum ada nama tersimpan —'}
            </option>
            {savedNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {matchedSaved && (
            <button
              type="button"
              onClick={() => handleDeleteSavedName(matchedSaved)}
              title={`Hapus "${matchedSaved}" dari daftar tersimpan`}
              aria-label={`Hapus ${matchedSaved} dari daftar tersimpan`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-rose-600 dark:text-rose-400 cursor-pointer"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: inputBgVar,
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Opsi 2: Ketik manual + tombol simpan cepat */}
        <div className="flex items-center gap-1">
          <input
            id={id}
            type="text"
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-9 flex-1 min-w-0 rounded-lg border px-2.5 text-xs focus:outline-none"
            style={{
              borderColor: canSaveCurrent ? 'var(--app-accent)' : 'var(--app-border)',
              backgroundColor: inputBgVar,
              color: 'var(--app-text)',
            }}
          />
          {canSaveCurrent && (
            <button
              type="button"
              onClick={handleSaveCurrentName}
              title="Simpan nama pembeli ini ke daftar pilihan"
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--app-accent)',
                color: 'var(--app-accent-fg)',
              }}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Simpan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  CheckCircle2,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import type { SupervisionActivity } from '../types';

interface AccountSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  authReady: boolean;
  syncBusy: boolean;
  syncError: string;
  deviceLabel: string;
  onChangeDeviceLabel: (label: string) => void;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUploadLocalToCloud: () => Promise<void>;
  activities: SupervisionActivity[];
  lastModifiedBy: string;
  localDocCount: number;
}

const CATEGORY_LABELS: Record<SupervisionActivity['category'], string> = {
  water: 'PPM & pH',
  treatment: 'Perawatan',
  plants: 'Tanaman',
  greenhouse: 'Greenhouse',
  document: 'Dokumen',
};

export const AccountSyncModal: React.FC<AccountSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  authReady,
  syncBusy,
  syncError,
  deviceLabel,
  onChangeDeviceLabel,
  onSignInGoogle,
  onSignOut,
  onUploadLocalToCloud,
  activities,
  lastModifiedBy,
  localDocCount,
}) => {
  const [labelInput, setLabelInput] = useState(deviceLabel);
  const [savedLabelFeedback, setSavedLabelFeedback] = useState(false);

  if (!isOpen) return null;

  const handleSaveLabel = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeDeviceLabel(labelInput);
    setSavedLabelFeedback(true);
    setTimeout(() => setSavedLabelFeedback(false), 1800);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sinkronisasi Online Akun Google & Pengawasan"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5 sm:py-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Cloud className="h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
              <span className="truncate">Mode Online & Berbagi Akun Google</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              Masuk dengan Akun Google yang sama di beberapa HP, tablet, atau PC untuk berbagi data real-time & saling mengawasi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog Akun Google"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Google Auth Card */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              borderColor: user ? 'var(--app-accent)' : 'var(--app-border)',
              backgroundColor: user ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
            }}
          >
            {!authReady ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Memeriksa status sesi Google...
              </div>
            ) : user ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Foto Profil Google'}
                      className="h-11 w-11 rounded-full border shrink-0 object-cover"
                      style={{ borderColor: 'var(--app-border)' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-sm shrink-0"
                      style={{
                        backgroundColor: 'var(--app-accent)',
                        color: 'var(--app-accent-fg)',
                      }}
                    >
                      {(user.displayName || user.email || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold truncate">
                        {user.displayName || 'Pengguna Google'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Online Real-Time
                      </span>
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>
                      {user.email}
                    </div>
                    {lastModifiedBy && (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                        Pembaruan terakhir: <strong>{lastModifiedBy}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={syncBusy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-60"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Keluar Akun
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <CloudOff className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Saat Ini Mode Lokal (Belum Terhubung Cloud)</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                    Masuk dengan Akun Google agar data GH 1, GH 2, PPM/pH, perawatan obat, dan kondisi 1–1000 tanaman langsung sinkron antar semua perangkat yang memakai akun yang sama.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onSignInGoogle}
                  disabled={syncBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer shrink-0 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--app-accent)',
                    color: 'var(--app-accent-fg)',
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  {syncBusy ? 'Menghubungkan...' : 'Masuk dengan Google'}
                </button>
              </div>
            )}

            {syncError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-200">
                {syncError}
              </div>
            )}
          </div>

          {/* Device / Operator Identity for Supervision */}
          <form
            onSubmit={handleSaveLabel}
            className="rounded-xl border p-4 space-y-2.5"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <Smartphone className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
              <span>Identitas Perangkat / Petugas di Perangkat Ini</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              Jika beberapa anggota tim login dengan <strong>Akun Google yang sama</strong>, beri nama perangkat berbeda (misalnya <em>"HP Kebun GH 1"</em>, <em>"Tablet Mandor"</em>, atau <em>"Laptop Pemilik"</em>) agar terlihat siapa yang menginput atau mengubah data.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                maxLength={80}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Contoh: HP Kebun GH 1 / Pak Budi"
                className="flex-1 rounded-lg border px-3 py-2 text-xs focus:outline-none"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-text)',
                }}
              />
              <button
                type="submit"
                className="rounded-lg border px-3.5 py-2 text-xs font-semibold cursor-pointer shrink-0"
                style={{
                  borderColor: 'var(--app-accent)',
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-accent)',
                }}
              >
                {savedLabelFeedback ? 'Tersimpan!' : 'Simpan Nama Perangkat'}
              </button>
            </div>
          </form>

          {/* Local -> Cloud Upload helper when signed in */}
          {user && (
            <div
              className="rounded-xl border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Users className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
                  <span>Sinkronisasi Dokumen Musim Tanam ({localDocCount} dokumen)</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Setiap perubahan di GH, PPM/pH, Obat, & Tanaman tersimpan otomatis ke Cloud. Gunakan tombol di samping jika ingin mengunggah ulang seluruh dokumen lokal ke Cloud.
                </p>
              </div>
              <button
                type="button"
                onClick={onUploadLocalToCloud}
                disabled={syncBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-60"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                }}
              >
                <UploadCloud className={`h-4 w-4 ${syncBusy ? 'animate-pulse' : ''}`} style={{ color: 'var(--app-accent)' }} />
                {syncBusy ? 'Menyinkronkan...' : 'Unggah ke Cloud'}
              </button>
            </div>
          )}

          {/* Real-Time Supervision Feed */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Activity className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
                <span>Log Pengawasan Aktivitas Real-Time</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Terpantau lintas perangkat
              </span>
            </div>

            {!user ? (
              <div
                className="rounded-lg border border-dashed p-4 text-center text-xs"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
              >
                Silakan masuk dengan Akun Google terlebih dahulu untuk melihat riwayat pengawasan antar perangkat secara real-time.
              </div>
            ) : activities.length === 0 ? (
              <div
                className="rounded-lg border border-dashed p-4 text-center text-xs"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
              >
                Belum ada catatan aktivitas di Cloud untuk musim tanam ini. Lakukan perubahan pada PPM/pH, Obat, atau Kondisi Tanaman untuk menguji sinkronisasi live.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-lg border p-2.5 text-xs space-y-1"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: 'var(--app-accent-soft)',
                            color: 'var(--app-accent)',
                          }}
                        >
                          {CATEGORY_LABELS[act.category] || act.category}
                        </span>
                        <span className="font-semibold truncate">{act.ghName}</span>
                        <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                          oleh <strong>{act.deviceLabel}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                        {new Date(act.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-xs leading-snug">{act.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

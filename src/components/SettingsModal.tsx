import React, { useEffect, useState } from 'react';
import { Bell, Check, Palette, Type, Volume2, X } from 'lucide-react';
import { ACCENT_PRESETS, BOTANICAL_THEMES, FONT_OPTIONS } from '../constants/themes';
import { AppSettings } from '../types';
import { playNotificationChime, requestBrowserNotificationPermission } from '../utils/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [section, setSection] = useState<'tema' | 'font' | 'warna' | 'notifikasi'>('tema');
  const [browserPermMsg, setBrowserPermMsg] = useState<string>('');

  const [ppmMinDraft, setPpmMinDraft] = useState(String(settings.notifications.ppmMin));
  const [ppmMaxDraft, setPpmMaxDraft] = useState(String(settings.notifications.ppmMax));
  const [phMinDraft, setPhMinDraft] = useState(String(settings.notifications.phMin));
  const [phMaxDraft, setPhMaxDraft] = useState(String(settings.notifications.phMax));
  const [sickThresholdDraft, setSickThresholdDraft] = useState(
    String(settings.notifications.sickPlantThreshold)
  );

  useEffect(() => {
    if (!isOpen) return;
    setPpmMinDraft(String(settings.notifications.ppmMin));
    setPpmMaxDraft(String(settings.notifications.ppmMax));
    setPhMinDraft(String(settings.notifications.phMin));
    setPhMaxDraft(String(settings.notifications.phMax));
    setSickThresholdDraft(String(settings.notifications.sickPlantThreshold));
    // Sync drafts only when opening modal so clearing 0 while typing never snaps back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleThresholdChange = (
    field: 'ppmMin' | 'ppmMax' | 'phMin' | 'phMax' | 'sickPlantThreshold',
    raw: string
  ) => {
    if (field === 'ppmMin') setPpmMinDraft(raw);
    else if (field === 'ppmMax') setPpmMaxDraft(raw);
    else if (field === 'phMin') setPhMinDraft(raw);
    else if (field === 'phMax') setPhMaxDraft(raw);
    else setSickThresholdDraft(raw);

    if (raw.trim() === '') {
      if (field === 'ppmMin' || field === 'ppmMax' || field === 'phMin' || field === 'phMax') {
        onUpdateSettings({
          ...settings,
          notifications: {
            ...settings.notifications,
            [field]: 0,
          },
        });
      }
      return;
    }

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;

    const clamped =
      field === 'sickPlantThreshold'
        ? Math.max(1, Math.round(parsed))
        : Math.max(0, parsed);

    onUpdateSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [field]: clamped,
      },
    });
  };

  const handleThresholdBlur = (
    field: 'ppmMin' | 'ppmMax' | 'phMin' | 'phMax' | 'sickPlantThreshold'
  ) => {
    if (field === 'sickPlantThreshold') {
      const parsed = Number(sickThresholdDraft);
      if (sickThresholdDraft.trim() !== '' && (Number.isNaN(parsed) || parsed < 1)) {
        setSickThresholdDraft('1');
        onUpdateSettings({
          ...settings,
          notifications: { ...settings.notifications, sickPlantThreshold: 1 },
        });
      }
    }
  };

  const handleBrowserNotifyToggle = async () => {
    if (!settings.notifications.browserNotify) {
      const perm = await requestBrowserNotificationPermission();
      if (perm === 'granted') {
        setBrowserPermMsg('Notifikasi browser aktif.');
        onUpdateSettings({
          ...settings,
          notifications: { ...settings.notifications, browserNotify: true },
        });
      } else if (perm === 'unsupported') {
        setBrowserPermMsg('Browser ini tidak mendukung API Notifikasi Desktop.');
      } else {
        setBrowserPermMsg('Izin notifikasi ditolak di pengaturan browser.');
      }
    } else {
      onUpdateSettings({
        ...settings,
        notifications: { ...settings.notifications, browserNotify: false },
      });
      setBrowserPermMsg('');
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Aplikasi"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div>
            <h2 className="text-base font-bold">Pengaturan Aplikasi</h2>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
              Sesuaikan tema tanaman, jenis huruf, warna aksen, dan ambang notifikasi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="flex h-9 w-9 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div
          className="flex gap-1 overflow-x-auto border-b px-5 py-2"
          style={{
            borderColor: 'var(--app-border)',
            backgroundColor: 'var(--app-surface-muted)',
          }}
        >
          {(
            [
              { id: 'tema', label: 'Tema Tanaman', icon: Palette },
              { id: 'font', label: 'Jenis Huruf (6)', icon: Type },
              { id: 'warna', label: 'Warna Aksen', icon: Palette },
              { id: 'notifikasi', label: 'Pengatur Notifikasi', icon: Bell },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-surface)' : 'transparent',
                  color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {section === 'tema' && (
            <div className="space-y-3">
              <div className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                Pilih tema nuansa tanaman & rumah kaca hidroponik (4 tema terang & 3 tema gelap):
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {BOTANICAL_THEMES.map((theme) => {
                  const selected = settings.themeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          themeId: theme.id,
                          accentColor: theme.defaultAccent,
                        })
                      }
                      className="flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer"
                      style={{
                        borderColor: selected ? 'var(--app-accent)' : 'var(--app-border)',
                        backgroundColor: selected ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{theme.name}</span>
                          <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                            {theme.isDark ? 'Gelap' : 'Terang'}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                          {theme.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          {theme.swatches.map((hex, i) => (
                            <span
                              key={i}
                              className="h-4 w-4 rounded-full border border-black/15"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        {selected && (
                          <Check className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {section === 'font' && (
            <div className="space-y-3">
              <div className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                Tersedia 6 pilihan jenis huruf untuk keterbacaan angka dan laporan kebun:
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FONT_OPTIONS.map((font) => {
                  const selected = settings.fontId === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, fontId: font.id })}
                      className="flex items-center justify-between rounded-xl border p-4 text-left transition-colors cursor-pointer"
                      style={{
                        fontFamily: font.family,
                        borderColor: selected ? 'var(--app-accent)' : 'var(--app-border)',
                        backgroundColor: selected ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
                      }}
                    >
                      <div>
                        <div className="text-sm font-bold">{font.name}</div>
                        <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                          {font.category}
                        </div>
                        <div className="mt-2 text-xs font-medium">{font.sample}</div>
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {section === 'warna' && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium mb-3" style={{ color: 'var(--app-text-muted)' }}>
                  Warna Aksen Botani Terkurasi:
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {ACCENT_PRESETS.map((preset) => {
                    const active = settings.accentColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, accentColor: preset.hex })}
                        className="flex items-center gap-2.5 rounded-lg border p-3 text-left cursor-pointer"
                        style={{
                          borderColor: active ? preset.hex : 'var(--app-border)',
                          backgroundColor: active ? 'var(--app-surface-muted)' : 'var(--app-canvas)',
                        }}
                      >
                        <span
                          className="h-5 w-5 rounded-md shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{preset.name}</div>
                          <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                            {preset.hex}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div>
                  <div className="text-sm font-semibold">Pilih Warna Kustom Manual</div>
                  <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                    Sesuaikan warna tombol, tab aktif, dan grafik sesuai preferensi Anda.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pilih warna aksen kustom"
                    value={settings.accentColor}
                    onChange={(e) => onUpdateSettings({ ...settings, accentColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded border bg-transparent p-0.5"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                  <span className="font-mono-tabular text-xs font-semibold">
                    {settings.accentColor.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {section === 'notifikasi' && (
            <div className="space-y-4">
              {/* Toggle rows */}
              <div
                className="divide-y rounded-xl border"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-semibold">Aktifkan Peringatan & Notifikasi</div>
                    <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                      Tampilkan peringatan jika PPM, pH, atau kesehatan tanaman keluar batas.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.enabled}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        notifications: { ...settings.notifications, enabled: e.target.checked },
                      })
                    }
                    className="h-5 w-5 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-semibold">Suara Alarm Lembut (Audio Chime)</div>
                    <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                      Putar nada peringatan saat input manual melewati batas PPM/pH.
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => playNotificationChime('warning')}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      Uji Suara
                    </button>
                    <input
                      type="checkbox"
                      checked={settings.notifications.soundEnabled}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          notifications: { ...settings.notifications, soundEnabled: e.target.checked },
                        })
                      }
                      className="h-5 w-5 accent-emerald-600 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-semibold">Notifikasi Desktop / Browser</div>
                    <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                      Kirim notifikasi sistem saat tab diminimalkan. {browserPermMsg}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowserNotifyToggle}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    style={{
                      borderColor: settings.notifications.browserNotify
                        ? 'var(--app-accent)'
                        : 'var(--app-border)',
                      backgroundColor: settings.notifications.browserNotify
                        ? 'var(--app-accent-soft)'
                        : 'transparent',
                      color: settings.notifications.browserNotify
                        ? 'var(--app-accent)'
                        : 'var(--app-text)',
                    }}
                  >
                    {settings.notifications.browserNotify ? 'Aktif' : 'Aktifkan Izin'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-semibold">Pengingat Jadwal Perawatan</div>
                    <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                      Tampilkan pengingat bila ada penyemprotan, pengolesan, atau pengocoran tertunda.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.treatmentReminder}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          treatmentReminder: e.target.checked,
                        },
                      })
                    }
                    className="h-5 w-5 accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Threshold Inputs */}
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="text-sm font-semibold">Ambang Batas Peringatan Otomatis</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">PPM Min</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={ppmMinDraft}
                      onFocus={(e) => {
                        if (e.currentTarget.value === '0') e.currentTarget.select();
                      }}
                      onChange={(e) => handleThresholdChange('ppmMin', e.target.value)}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono-tabular"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">PPM Maks</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={ppmMaxDraft}
                      onFocus={(e) => {
                        if (e.currentTarget.value === '0') e.currentTarget.select();
                      }}
                      onChange={(e) => handleThresholdChange('ppmMax', e.target.value)}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono-tabular"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">pH Min</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={14}
                      placeholder="0"
                      value={phMinDraft}
                      onFocus={(e) => {
                        if (e.currentTarget.value === '0') e.currentTarget.select();
                      }}
                      onChange={(e) => handleThresholdChange('phMin', e.target.value)}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono-tabular"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">pH Maks</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={14}
                      placeholder="0"
                      value={phMaxDraft}
                      onFocus={(e) => {
                        if (e.currentTarget.value === '0') e.currentTarget.select();
                      }}
                      onChange={(e) => handleThresholdChange('phMax', e.target.value)}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono-tabular"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Batas Sakit (Pohon)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={sickThresholdDraft}
                      onFocus={(e) => {
                        if (e.currentTarget.value === '0') e.currentTarget.select();
                      }}
                      onChange={(e) => handleThresholdChange('sickPlantThreshold', e.target.value)}
                      onBlur={() => handleThresholdBlur('sickPlantThreshold')}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono-tabular"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end border-t px-5 py-3"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: 'var(--app-accent)',
              color: 'var(--app-accent-fg)',
            }}
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};

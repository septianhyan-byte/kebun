import React from 'react';
import type { User } from 'firebase/auth';
import {
  Bell,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  FilePlus2,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  Smartphone,
  Sprout,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppAlert, DashboardTab, GreenhouseData, SeasonDocument } from '../types';

interface TopToolbarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  document: SeasonDocument;
  activeGh: GreenhouseData;
  onSelectGh: (ghId: string) => void;
  onOpenGhModal: (mode: 'add' | 'edit') => void;
  onOpenNewDocModal: () => void;
  onOpenPrintModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenMobileApkModal: () => void;
  onOpenAccountModal: () => void;
  cloudUser: User | null;
  syncBusy: boolean;
  isBrowserOnline: boolean;
  manualOfflineMode: boolean;
  pendingSyncCount: number;
  onToggleManualOffline: () => void;
  alerts: AppAlert[];
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeTab,
  onSelectTab,
  document,
  activeGh,
  onSelectGh,
  onOpenGhModal,
  onOpenNewDocModal,
  onOpenPrintModal,
  onOpenSettingsModal,
  onOpenMobileApkModal,
  onOpenAccountModal,
  cloudUser,
  syncBusy,
  isBrowserOnline,
  manualOfflineMode,
  pendingSyncCount,
  onToggleManualOffline,
  alerts,
}) => {
  const criticalCount = alerts.filter((a) => a.level === 'critical').length;
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isOffline = !isBrowserOnline || manualOfflineMode;

  return (
    <header
      className="no-print sticky top-0 z-30 border-b transition-colors"
      style={{
        backgroundColor: 'var(--app-surface)',
        borderColor: 'var(--app-border)',
      }}
    >
      {/* Main Toolbar Row */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              backgroundColor: 'var(--app-accent-soft)',
              color: 'var(--app-accent)',
            }}
            aria-hidden="true"
          >
            <Sprout className="h-4 w-4" />
          </span>
          <span className="text-sm sm:text-base font-bold tracking-tight whitespace-nowrap shrink-0">
            MelonFlow NFT
          </span>
        </div>

        {/* Desktop Navigation Zone: 3 Dashboards */}
        <nav
          aria-label="Navigasi Dashboard"
          className="hidden xl:flex items-center gap-6"
        >
          {(
            [
              { id: 'water', label: '1. Kontrol PPM & pH' },
              { id: 'treatment', label: '2. Perawatan Obat' },
              { id: 'plants', label: '3. Kondisi 1–1000' },
            ] as Array<{ id: DashboardTab; label: string }>
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className="relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
                style={{
                  color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)',
                }}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--app-accent)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Toolbar Actions Zone */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* GH Selector + Manual Option (shown inline on sm+, dedicated row below on tiny phones) */}
          <div
            className="hidden sm:flex items-center rounded-lg border overflow-hidden"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-surface-muted)',
            }}
          >
            <div className="relative flex items-center">
              <select
                aria-label="Pilih Greenhouse"
                value={activeGh.id}
                onChange={(e) => onSelectGh(e.target.value)}
                className="h-9 appearance-none bg-transparent pl-3 pr-7 text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer"
                style={{ color: 'var(--app-text)' }}
              >
                {document.greenhouses.map((gh) => (
                  <option
                    key={gh.id}
                    value={gh.id}
                    style={{
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  >
                    {gh.name} ({gh.capacity})
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 h-3.5 w-3.5"
                style={{ color: 'var(--app-text-muted)' }}
              />
            </div>
            <button
              type="button"
              onClick={() => onOpenGhModal('edit')}
              title="Ubah GH atau isi manual"
              className="h-9 border-l px-2.5 text-xs font-medium transition-opacity hover:opacity-80 whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)',
              }}
            >
              Isi Manual
            </button>
            <button
              type="button"
              onClick={() => onOpenGhModal('add')}
              title="Tambah Greenhouse baru"
              aria-label="Tambah Greenhouse baru"
              className="flex h-9 w-9 items-center justify-center border-l transition-opacity hover:opacity-80 shrink-0 cursor-pointer"
              style={{
                borderColor: 'var(--app-border)',
                color: 'var(--app-accent)',
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Mode Offline Toggle */}
          <button
            type="button"
            onClick={onToggleManualOffline}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85"
            style={{
              borderColor: isOffline ? '#d97706' : 'var(--app-border)',
              backgroundColor: isOffline ? 'rgba(245, 158, 11, 0.14)' : 'var(--app-surface)',
              color: isOffline ? '#b45309' : 'var(--app-text)',
            }}
            title={
              !isBrowserOnline
                ? 'Perangkat sedang offline — data disimpan di perangkat'
                : manualOfflineMode
                ? 'Mode Offline aktif — klik untuk kembali Online'
                : 'Klik untuk mengaktifkan Mode Offline (bekerja tanpa internet / hemat kuota)'
            }
          >
            {isOffline ? (
              <WifiOff className="h-4 w-4 text-amber-600" />
            ) : (
              <Wifi className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
            )}
            <span className="text-[11px] sm:text-xs font-semibold">
              {isOffline ? 'Mode Offline' : 'Online'}
            </span>
          </button>

          {/* Google Account Online Sync & Supervision */}
          <button
            type="button"
            onClick={onOpenAccountModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85"
            style={{
              borderColor: cloudUser && !isOffline ? '#16a34a' : 'var(--app-border)',
              backgroundColor:
                cloudUser && !isOffline ? 'rgba(22, 163, 74, 0.1)' : 'var(--app-surface)',
              color: cloudUser && !isOffline ? '#15803d' : 'var(--app-text)',
            }}
            title={
              cloudUser
                ? `Akun Google (${cloudUser.email}) — Klik untuk pengawasan & sinkronisasi`
                : 'Masuk Akun Google untuk berbagi data real-time & saling mengawasi'
            }
          >
            {syncBusy ? (
              <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'var(--app-accent)' }} />
            ) : cloudUser && !isOffline ? (
              <Cloud className="h-4 w-4 text-emerald-600" />
            ) : (
              <CloudOff className="h-4 w-4" style={{ color: 'var(--app-text-muted)' }} />
            )}
            <span className="text-[11px] sm:text-xs font-semibold">
              {cloudUser ? (isOffline ? 'Antre Sync' : 'Cloud Sync') : 'Google Sync'}
            </span>
            {pendingSyncCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-mono-tabular font-bold text-white">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Direct PWA Install button when browser supports one-tap install */}
          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90"
              style={{
                borderColor: 'var(--app-accent)',
                backgroundColor: 'var(--app-accent-soft)',
                color: 'var(--app-accent)',
              }}
              title="Install MelonFlow sebagai Aplikasi Offline di perangkat ini"
            >
              <Download className="h-4 w-4" />
              <span className="text-[11px] sm:text-xs">Install</span>
            </button>
          )}

          {/* 4. Versi HP / Tablet & APK */}
          <button
            type="button"
            onClick={onOpenMobileApkModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-surface)',
              color: 'var(--app-text)',
            }}
            title="Install di HP/Tablet atau Unduh Paket APK Android"
          >
            <Smartphone className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
            <span className="text-[11px] sm:text-xs font-semibold">APK / HP</span>
          </button>

          {/* 2. New Document */}
          <button
            type="button"
            onClick={onOpenNewDocModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-surface)',
              color: 'var(--app-text)',
            }}
            title="Buat Dokumen Musim Tanam Baru"
          >
            <FilePlus2 className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
            <span className="hidden md:inline">New Document</span>
          </button>

          {/* 3. Print / PDF & Direct Printer */}
          <button
            type="button"
            onClick={onOpenPrintModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-surface)',
              color: 'var(--app-text)',
            }}
            title="Cetak ke PDF atau Printer + Preview"
          >
            <Printer className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
            <span className="hidden md:inline">Print / PDF</span>
          </button>

          {/* 1. Setting */}
          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="relative inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 text-xs sm:text-sm font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: 'var(--app-accent)',
              color: 'var(--app-accent-fg)',
            }}
            title="Pengaturan Tema, Font, Warna & Notifikasi"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Setting</span>
            {criticalCount > 0 && (
              <span
                className="ml-0.5 inline-flex items-center gap-0.5 text-[11px] font-mono-tabular"
                title={`${criticalCount} peringatan aktif`}
              >
                <Bell className="h-3 w-3" />
                {criticalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dedicated Compact GH Bar on Mobile (<640px) so toolbar never overflows */}
      <div
        className="flex sm:hidden items-center justify-between gap-2 border-t px-3 py-2"
        style={{
          borderColor: 'var(--app-border)',
          backgroundColor: 'var(--app-canvas)',
        }}
      >
        <div
          className="flex flex-1 items-center rounded-lg border overflow-hidden"
          style={{
            borderColor: 'var(--app-border)',
            backgroundColor: 'var(--app-surface)',
          }}
        >
          <div className="relative flex flex-1 items-center min-w-0">
            <select
              aria-label="Pilih Greenhouse (HP)"
              value={activeGh.id}
              onChange={(e) => onSelectGh(e.target.value)}
              className="h-8 w-full appearance-none bg-transparent pl-2.5 pr-6 text-xs font-semibold focus:outline-none cursor-pointer truncate"
              style={{ color: 'var(--app-text)' }}
            >
              {document.greenhouses.map((gh) => (
                <option
                  key={gh.id}
                  value={gh.id}
                  style={{
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                >
                  {gh.name} ({gh.capacity} pohon)
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 h-3.5 w-3.5"
              style={{ color: 'var(--app-text-muted)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => onOpenGhModal('edit')}
            className="h-8 border-l px-2.5 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-text-muted)',
            }}
          >
            Isi Manual
          </button>
          <button
            type="button"
            onClick={() => onOpenGhModal('add')}
            aria-label="Tambah Greenhouse"
            className="flex h-8 w-8 items-center justify-center border-l shrink-0 cursor-pointer"
            style={{
              borderColor: 'var(--app-border)',
              color: 'var(--app-accent)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Dashboard Tabs (hidden on xl+) */}
      <div
        className="grid grid-cols-3 xl:hidden border-t px-2 sm:px-6 sm:flex sm:gap-6"
        style={{ borderColor: 'var(--app-border)' }}
      >
        {(
          [
            { id: 'water', shortLabel: '1. PPM & pH', tabletLabel: '1. Kontrol PPM & pH' },
            { id: 'treatment', shortLabel: '2. Obat', tabletLabel: '2. Perawatan Obat' },
            { id: 'plants', shortLabel: '3. 1–1000', tabletLabel: '3. Kondisi 1–1000' },
          ] as Array<{ id: DashboardTab; shortLabel: string; tabletLabel: string }>
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className="relative py-2.5 text-center sm:text-left text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer"
              style={{
                color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)',
              }}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.tabletLabel}</span>
              {isActive && (
                <span
                  className="absolute inset-x-1 sm:inset-x-0 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--app-accent)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};

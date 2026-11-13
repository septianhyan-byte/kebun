import React from 'react';
import { CloudUpload, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useSWOfflineStatus } from '../hooks/usePWAInstall';

interface OfflineIndicatorProps {
  isBrowserOnline: boolean;
  manualOfflineMode: boolean;
  pendingCount: number;
  syncBusy: boolean;
  isSignedIn: boolean;
  onExitManualOffline: () => void;
  onSyncNow: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isBrowserOnline,
  manualOfflineMode,
  pendingCount,
  syncBusy,
  isSignedIn,
  onExitManualOffline,
  onSyncNow,
}) => {
  const { needRefresh, applyUpdate } = useSWOfflineStatus();
  const isOffline = !isBrowserOnline || manualOfflineMode;

  if (!isOffline && !(isSignedIn && pendingCount > 0) && !needRefresh) {
    return null;
  }

  return (
    <div className="no-print fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex flex-col gap-2 max-w-md">
      {needRefresh && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-accent)',
            color: 'var(--app-text)',
          }}
        >
          <span className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--app-accent)' }} />
            <span>Versi offline terbaru siap digunakan.</span>
          </span>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--app-accent)',
              color: 'var(--app-accent-fg)',
            }}
          >
            Perbarui
          </button>
        </div>
      )}

      {isOffline && (
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg"
          style={{
            backgroundColor: '#B45309',
            borderColor: '#F59E0B',
            color: '#FFFFFF',
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              {!isBrowserOnline
                ? 'Jaringan Offline — Data tetap tersimpan aman di perangkat.'
                : 'Mode Offline Aktif — Perubahan disimpan lokal di perangkat.'}
              {pendingCount > 0 ? ` (${pendingCount} menunggu sinkronisasi)` : ''}
            </span>
          </div>
          {isBrowserOnline && manualOfflineMode && (
            <button
              type="button"
              onClick={onExitManualOffline}
              className="inline-flex items-center gap-1 rounded bg-white/20 hover:bg-white/30 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer shrink-0"
            >
              <Wifi className="h-3 w-3" />
              Kembali Online
            </button>
          )}
        </div>
      )}

      {!isOffline && isSignedIn && pendingCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg"
          style={{
            backgroundColor: '#047857',
            borderColor: '#10B981',
            color: '#FFFFFF',
          }}
          role="status"
          aria-live="polite"
        >
          <span className="flex items-center gap-2">
            <CloudUpload className={`h-3.5 w-3.5 shrink-0 ${syncBusy ? 'animate-pulse' : ''}`} />
            <span>
              {syncBusy
                ? `Menyinkronkan ${pendingCount} perubahan offline ke Cloud...`
                : `${pendingCount} perubahan offline siap disinkronkan.`}
            </span>
          </span>
          {!syncBusy && (
            <button
              type="button"
              onClick={onSyncNow}
              className="rounded bg-white/20 hover:bg-white/30 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer shrink-0"
            >
              Sinkronkan
            </button>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="no-print fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg"
      style={{
        backgroundColor: '#B45309',
        borderColor: '#F59E0B',
        color: '#FFFFFF',
      }}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Mode Offline — Data tetap tersimpan otomatis di perangkat Anda.</span>
    </div>
  );
};

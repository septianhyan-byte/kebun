import { AppAlert, GreenhouseData, NotificationSettings } from '../types';

export function playNotificationChime(level: 'warning' | 'critical' | 'info' = 'warning') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    const baseFreq = level === 'critical' ? 880 : level === 'warning' ? 660 : 520;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore audio block
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

export function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export function evaluateGreenhouseAlerts(
  gh: GreenhouseData,
  notif: NotificationSettings
): AppAlert[] {
  if (!notif.enabled) return [];

  const alerts: AppAlert[] = [];
  const now = new Date().toISOString();

  if (gh.currentWater.ppm < notif.ppmMin || gh.currentWater.ppm > notif.ppmMax) {
    alerts.push({
      id: `alert-ppm-${gh.id}`,
      level: 'critical',
      title: `${gh.name}: PPM di Luar Batas (${gh.currentWater.ppm} ppm)`,
      message: `Target notifikasi: ${notif.ppmMin}–${notif.ppmMax} ppm. Sesuaikan dosing Nutrisi AB atau air baku.`,
      timestamp: now,
    });
  }

  if (gh.currentWater.ph < notif.phMin || gh.currentWater.ph > notif.phMax) {
    alerts.push({
      id: `alert-ph-${gh.id}`,
      level: 'critical',
      title: `${gh.name}: pH Air di Luar Batas (${gh.currentWater.ph.toFixed(2)})`,
      message: `Target notifikasi: pH ${notif.phMin.toFixed(1)}–${notif.phMax.toFixed(1)}. Lakukan dosing pH Up/Down.`,
      timestamp: now,
    });
  }

  if (notif.treatmentReminder) {
    const dueCount = gh.treatments.filter((t) => t.status === 'terjadwal').length;
    if (dueCount > 0) {
      alerts.push({
        id: `alert-tr-${gh.id}`,
        level: 'info',
        title: `${gh.name}: ${dueCount} Jadwal Perawatan Menunggu`,
        message: 'Periksa Dashboard 2 untuk melihat jadwal penyemprotan, pengolesan, atau pengocoran obat.',
        timestamp: now,
      });
    }
  }

  const sickCount = gh.plants.filter((p) => p.status === 'sakit').length;
  if (sickCount >= notif.sickPlantThreshold) {
    alerts.push({
      id: `alert-sick-${gh.id}`,
      level: 'warning',
      title: `${gh.name}: ${sickCount} Tanaman Sakit`,
      message: `Melebihi batas ambang ${notif.sickPlantThreshold} tanaman pada matriks kondisi 1–${gh.capacity}.`,
      timestamp: now,
    });
  }

  return alerts;
}

import { GreenhouseData, SeasonDocument } from '../types';
import { GROWTH_PHASE_SPECS, TREATMENT_TYPE_LABELS } from '../constants/themes';

export interface PrinterConnectionResult {
  success: boolean;
  printerName?: string;
  message: string;
}

export function getPrinterCapabilities() {
  const nav = navigator as unknown as {
    serial?: { requestPort: (opts?: unknown) => Promise<unknown> };
    usb?: { requestDevice: (opts?: unknown) => Promise<unknown> };
  };
  return {
    hasWebSerial: Boolean(nav.serial),
    hasWebUsb: Boolean(nav.usb),
    hasSystemPrint: typeof window !== 'undefined' && typeof window.print === 'function',
  };
}

export function formatEscPosReport(doc: SeasonDocument, gh: GreenhouseData): string {
  const phaseSpec = GROWTH_PHASE_SPECS[gh.phase];
  const healthy = gh.plants.filter((p) => p.status === 'sehat').length;
  const attention = gh.plants.filter((p) => p.status === 'perhatian').length;
  const sick = gh.plants.filter((p) => p.status === 'sakit').length;
  const harvest = gh.plants.filter((p) => p.status === 'panen').length;
  const fruiting = gh.plants.filter((p) =>
    p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0
  ).length;
  const notFruiting = gh.plants.length - fruiting;
  const latestLog = gh.waterLogs[0];
  const pendingTreatments = gh.treatments.filter((t) => t.status === 'terjadwal');

  const lines = [
    '================================',
    '     MELONFLOW NFT REPORT       ',
    '================================',
    `Dokumen : ${doc.title}`,
    `GH      : ${gh.name} (${gh.variety})`,
    `Tanam   : ${gh.plantingDate}`,
    `Panen   : ${gh.harvestDate || 'Belum diisi'}`,
    `Fase    : ${phaseSpec.label}`,
    `Cetak   : ${new Date().toLocaleString('id-ID')}`,
    '--------------------------------',
    '[1] KONTROL NUTRISI & AIR',
    `PPM     : ${latestLog?.ppmBefore ?? gh.currentWater.ppm} -> ${gh.currentWater.ppm} ppm`,
    `EC      : ${gh.currentWater.ec.toFixed(2)} mS/cm`,
    `pH Air  : ${(latestLog?.phBefore ?? gh.currentWater.ph).toFixed(2)} -> ${gh.currentWater.ph.toFixed(2)}`,
    `Suhu    : ${gh.currentWater.tempC.toFixed(1)} C`,
    `Tandon  : ${gh.currentWater.reservoirPct}% (${gh.reservoirLiters}L)`,
    '--------------------------------',
    '[2] PERAWATAN TERJADWAL',
    ...(pendingTreatments.length === 0
      ? ['Tidak ada jadwal tertunda']
      : pendingTreatments.slice(0, 5).map(
          (t) =>
            `- ${TREATMENT_TYPE_LABELS[t.type].short}${
              t.type === 'penyemprotan' && t.sprayCategory ? ` (${t.sprayCategory})` : ''
            }: ${t.medicineName} (${t.dosage}) -> ${t.targetPlants}`
        )),
    '--------------------------------',
    `[3] KONDISI TANAMAN (1-${gh.capacity})`,
    `Sehat       : ${healthy}`,
    `Perhatian   : ${attention}`,
    `Sakit       : ${sick}`,
    `Panen       : ${harvest}`,
    `Berbuah     : ${fruiting}`,
    `Tdk Berbuah : ${notFruiting}`,
    '================================',
    '\n\n\n',
  ];

  return lines.join('\n');
}

export async function printViaWebSerial(reportText: string): Promise<PrinterConnectionResult> {
  const nav = navigator as unknown as {
    serial?: {
      requestPort: () => Promise<{
        open: (opts: { baudRate: number }) => Promise<void>;
        writable: WritableStream<Uint8Array>;
        close: () => Promise<void>;
      }>;
    };
  };

  if (!nav.serial) {
    return {
      success: false,
      message: 'Browser atau mode preview tidak mendukung Web Serial API. Gunakan Cetak PDF / Printer Sistem.',
    };
  }

  try {
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    // ESC/POS init + text + partial cut
    const initBytes = new Uint8Array([0x1b, 0x40]);
    const textBytes = encoder.encode(reportText);
    const cutBytes = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
    await writer.write(initBytes);
    await writer.write(textBytes);
    await writer.write(cutBytes);
    writer.releaseLock();
    await port.close();
    return {
      success: true,
      printerName: 'Thermal Serial Printer (9600 baud)',
      message: 'Laporan berhasil dikirim ke printer serial ESC/POS.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Koneksi printer dibatalkan atau gagal.';
    return { success: false, message: msg };
  }
}

export async function printViaWebUsb(reportText: string): Promise<PrinterConnectionResult> {
  const nav = navigator as unknown as {
    usb?: {
      requestDevice: (opts: { filters: unknown[] }) => Promise<{
        productName?: string;
        open: () => Promise<void>;
        selectConfiguration: (cfg: number) => Promise<void>;
        claimInterface: (iface: number) => Promise<void>;
        transferOut: (endpoint: number, data: BufferSource) => Promise<void>;
        close: () => Promise<void>;
        configuration?: {
          interfaces: Array<{
            interfaceNumber: number;
            alternates: Array<{
              endpoints: Array<{ direction: string; endpointNumber: number }>;
            }>;
          }>;
        };
      }>;
    };
  };

  if (!nav.usb) {
    return {
      success: false,
      message: 'Browser tidak mendukung WebUSB. Gunakan Cetak PDF / Printer Sistem.',
    };
  }

  try {
    const device = await nav.usb.requestDevice({ filters: [] });
    await device.open();
    await device.selectConfiguration(1);
    const iface = device.configuration?.interfaces[0];
    if (!iface) {
      await device.close();
      return { success: false, message: 'Interface USB printer tidak ditemukan.' };
    }
    await device.claimInterface(iface.interfaceNumber);
    const outEp = iface.alternates[0]?.endpoints.find((ep) => ep.direction === 'out');
    if (!outEp) {
      await device.close();
      return { success: false, message: 'Endpoint output printer USB tidak ditemukan.' };
    }
    const encoder = new TextEncoder();
    await device.transferOut(outEp.endpointNumber, encoder.encode(reportText));
    await device.close();
    return {
      success: true,
      printerName: device.productName || 'USB Thermal Printer',
      message: `Laporan berhasil dikirim ke ${device.productName || 'printer USB'}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Koneksi WebUSB dibatalkan atau terhalang izin perangkat.';
    return { success: false, message: msg };
  }
}

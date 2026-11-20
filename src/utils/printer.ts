import {
  ExpenseCategory,
  GreenhouseData,
  PrintSelection,
  SeasonDocument,
  SelfSalePaymentProfile,
  SelfSaleReceipt,
} from '../types';
import {
  EXPENSE_CATEGORY_META,
  GROWTH_PHASE_SPECS,
  SALE_GRADE_OPTIONS,
  TREATMENT_TYPE_LABELS,
} from '../constants/themes';

export interface PrinterConnectionResult {
  success: boolean;
  printerName?: string;
  message: string;
}

export const DEFAULT_PRINT_SELECTION: PrintSelection = {
  water: true,
  treatment: true,
  plants: true,
  accountingExpenses: true,
  accountingSales: true,
  accountingProfit: true,
};

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

function fmtRpShort(val: number): string {
  const prefix = val < 0 ? '-Rp ' : 'Rp ';
  return `${prefix}${Math.round(Math.abs(val)).toLocaleString('id-ID')}`;
}

export function formatEscPosReport(
  doc: SeasonDocument,
  gh: GreenhouseData,
  selection: PrintSelection = DEFAULT_PRINT_SELECTION
): string {
  const phaseSpec = GROWTH_PHASE_SPECS[gh.phase];
  const healthy = gh.plants.filter((p) => p.status === 'sehat').length;
  const attention = gh.plants.filter((p) => p.status === 'perhatian').length;
  const sick = gh.plants.filter((p) => p.status === 'sakit').length;
  const harvest = gh.plants.filter((p) => p.status === 'panen').length;
  const fruiting = gh.plants.filter((p) =>
    p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0
  ).length;
  const notFruiting = gh.plants.length - fruiting;

  // Weight metrics
  let sampledCount = 0;
  let totalSampleKg = 0;
  let totalFruits = 0;
  let goodPlants = 0;
  let badPlants = 0;
  let goodFruits = 0;
  let badFruits = 0;
  for (const p of gh.plants) {
    if (p.status === 'kosong') continue;
    if (p.estWeightKg > 0) {
      sampledCount += 1;
      totalSampleKg += p.estWeightKg;
    }
    const isFruit = p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0;
    if (isFruit) {
      const qty = Math.max(1, p.fruitCount || 0);
      totalFruits += qty;
      if (p.fruitQuality === 'jelek') {
        badPlants += 1;
        badFruits += qty;
      } else {
        goodPlants += 1;
        goodFruits += qty;
      }
    }
  }
  const sampleAvgKg = sampledCount > 0 ? totalSampleKg / sampledCount : 0;
  const effAvgKg =
    typeof gh.avgMelonWeightKg === 'number' && !Number.isNaN(gh.avgMelonWeightKg)
      ? gh.avgMelonWeightKg
      : sampleAvgKg > 0
      ? Number(sampleAvgKg.toFixed(2))
      : 1.5;
  const estTotalWeightKg = totalFruits * effAvgKg;
  const goodEstWeightKg = goodFruits * effAvgKg;
  const badEstWeightKg = badFruits * effAvgKg;

  const latestLog = gh.waterLogs[0];
  const pendingTreatments = gh.treatments.filter((t) => t.status === 'terjadwal');

  const lines: string[] = [
    '================================',
    '     MELONFLOW NFT REPORT       ',
    '================================',
    `Dokumen : ${doc.title}`,
    `GH      : ${gh.name} (${gh.variety})`,
    `Tanam   : ${gh.plantingDate}`,
    `Panen   : ${gh.harvestDate || 'Belum diisi'}`,
    `Fase    : ${phaseSpec.label}`,
    `Cetak   : ${new Date().toLocaleString('id-ID')}`,
  ];

  if (selection.water) {
    lines.push(
      '--------------------------------',
      '[1] KONTROL NUTRISI & AIR',
      `PPM     : ${latestLog?.ppmBefore ?? gh.currentWater.ppm} -> ${gh.currentWater.ppm} ppm`,
      `EC      : ${gh.currentWater.ec.toFixed(2)} mS/cm`,
      `pH Air  : ${(latestLog?.phBefore ?? gh.currentWater.ph).toFixed(2)} -> ${gh.currentWater.ph.toFixed(2)}`,
      `Suhu    : ${gh.currentWater.tempC.toFixed(1)} C`,
      `Tandon  : ${gh.currentWater.reservoirPct}% (${gh.reservoirLiters}L)`
    );
  }

  if (selection.treatment) {
    lines.push(
      '--------------------------------',
      '[2] PERAWATAN TERJADWAL',
      ...(pendingTreatments.length === 0
        ? ['Tidak ada jadwal tertunda']
        : pendingTreatments.slice(0, 5).map(
            (t) =>
              `- ${TREATMENT_TYPE_LABELS[t.type].short}${
                t.type === 'penyemprotan' && t.sprayCategory ? ` (${t.sprayCategory})` : ''
              }: ${t.medicineName} (${t.dosage}) -> ${t.targetPlants}`
          ))
    );
  }

  if (selection.plants) {
    lines.push(
      '--------------------------------',
      `[3] KONDISI TANAMAN (1-${gh.capacity})`,
      `Sehat       : ${healthy}`,
      `Perhatian   : ${attention}`,
      `Sakit       : ${sick}`,
      `Panen       : ${harvest}`,
      `Berbuah     : ${fruiting}`,
      `Buah Bagus  : ${goodPlants} phn (${goodEstWeightKg.toFixed(1)} kg)`,
      `Buah Jelek  : ${badPlants} phn (${badEstWeightKg.toFixed(1)} kg)`,
      `Tdk Berbuah : ${notFruiting}`,
      `Rata2 Berat : ${effAvgKg.toFixed(2)} kg/buah`,
      `Est. Panen  : ${estTotalWeightKg.toFixed(1)} kg (${totalFruits} buah)`
    );
  }

  const expenses = gh.expenses || [];
  const sales = gh.sales || [];
  const totalExp = expenses.reduce((s, e) => s + (e.totalCost || 0), 0);
  const totalSale = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalSaleKg = sales.reduce((s, x) => s + (x.weightKg || 0), 0);

  if (selection.accountingExpenses) {
    lines.push('--------------------------------', '[4A] BIAYA PRODUKSI');
    (Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).forEach((cat) => {
      const catSum = expenses
        .filter((e) => e.category === cat)
        .reduce((s, e) => s + (e.totalCost || 0), 0);
      lines.push(`${EXPENSE_CATEGORY_META[cat].short.padEnd(12)}: ${fmtRpShort(catSum)}`);
    });
    lines.push(`TOTAL BIAYA : ${fmtRpShort(totalExp)}`);
  }

  if (selection.accountingSales) {
    lines.push('--------------------------------', '[4B] PENJUALAN MELON');
    SALE_GRADE_OPTIONS.forEach((opt) => {
      const items = sales.filter((s) => s.grade === opt.grade);
      const kg = items.reduce((s, x) => s + (x.weightKg || 0), 0);
      const rp = items.reduce((s, x) => s + (x.totalAmount || 0), 0);
      if (kg > 0 || rp > 0) {
        lines.push(`${opt.grade.padEnd(12)}: ${kg.toFixed(1)}kg = ${fmtRpShort(rp)}`);
      }
    });
    lines.push(`TOTAL BERAT : ${totalSaleKg.toFixed(1)} kg`);
    lines.push(`TOTAL UANG  : ${fmtRpShort(totalSale)}`);
  }

  if (selection.accountingProfit) {
    const net = totalSale - totalExp;
    const seasonExp = doc.greenhouses.reduce(
      (a, g) => a + (g.expenses || []).reduce((x, e) => x + (e.totalCost || 0), 0),
      0
    );
    const seasonSale = doc.greenhouses.reduce(
      (a, g) => a + (g.sales || []).reduce((x, s) => x + (s.totalAmount || 0), 0),
      0
    );
    lines.push(
      '--------------------------------',
      '[4C] KEUNTUNGAN PEMBUKUAN',
      `Penjualan GH : ${fmtRpShort(totalSale)}`,
      `Biaya GH     : ${fmtRpShort(totalExp)}`,
      `Laba/Rugi GH : ${fmtRpShort(net)}`,
      `Laba Semua GH: ${fmtRpShort(seasonSale - seasonExp)}`
    );
  }

  lines.push('================================', '\n\n\n');
  return lines.join('\n');
}

export function formatEscPosSelfSaleReceipt(
  receipt: SelfSaleReceipt,
  profile: SelfSalePaymentProfile
): string {
  const lines: string[] = [
    '================================',
    (profile.storeName || 'MELONFLOW NFT').toUpperCase().slice(0, 32),
    ...(profile.storeAddress ? [profile.storeAddress.slice(0, 32)] : []),
    ...(profile.storePhone ? [`Telp/WA: ${profile.storePhone}`] : []),
    '================================',
    `No Nota : ${receipt.receiptNumber}`,
    `Tanggal : ${receipt.date}`,
    `GH      : ${receipt.ghName}`,
    `Pembeli : ${receipt.buyerName || 'Pelanggan Langsung'}`,
    `Bayar   : ${receipt.paymentMethod}`,
    ...(receipt.paymentStatus
      ? [
          `Status  : ${
            receipt.paymentStatus === 'sudah_dibayar' ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'
          }`,
        ]
      : []),
    '--------------------------------',
  ];

  for (const item of receipt.items) {
    lines.push(item.name.slice(0, 32));
    lines.push(
      `  ${item.weightKg.toLocaleString('id-ID')} kg x ${fmtRpShort(item.pricePerKg)} = ${fmtRpShort(item.subtotal)}`
    );
  }

  lines.push(
    '--------------------------------',
    `TOTAL BERAT : ${receipt.totalWeightKg.toLocaleString('id-ID')} kg`,
    `TOTAL BAYAR : ${fmtRpShort(receipt.totalAmount)}`
  );

  if (receipt.notes) {
    lines.push(`Catatan     : ${receipt.notes.slice(0, 60)}`);
  }

  const hasBank =
    profile.bankName.trim() ||
    profile.accountNumber.trim() ||
    profile.accountHolderName.trim();

  if (hasBank || profile.qrisImageDataUrl) {
    lines.push('--------------------------------', 'INFO PEMBAYARAN:');
    if (profile.bankName.trim()) lines.push(`Bank   : ${profile.bankName.trim()}`);
    if (profile.accountNumber.trim()) lines.push(`No Rek : ${profile.accountNumber.trim()}`);
    if (profile.accountHolderName.trim()) lines.push(`A/N    : ${profile.accountHolderName.trim()}`);
    if (profile.qrisImageDataUrl) {
      lines.push('QRIS   : Tersedia (cetak PDF/layar untuk scan barcode)');
    }
  }

  lines.push(
    '--------------------------------',
    (profile.footerNote || 'Terima kasih!').slice(0, 32),
    '================================',
    '\n\n\n'
  );
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

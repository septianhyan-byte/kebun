import React from 'react';
import {
  EXPENSE_CATEGORY_META,
  GROWTH_PHASE_SPECS,
  PLANT_STATUS_META,
  SALE_GRADE_OPTIONS,
  TREATMENT_TYPE_LABELS,
} from '../constants/themes';
import {
  ExpenseCategory,
  GreenhouseData,
  PrintSelection,
  SeasonDocument,
} from '../types';
import { formatDateShortId } from '../utils/dateUtils';

interface PrintableReportProps {
  document: SeasonDocument;
  allDocuments: SeasonDocument[];
  activeGh: GreenhouseData;
  printSelection: PrintSelection;
  previewMode?: boolean;
}

function fmtRp(val: number): string {
  const prefix = val < 0 ? '-Rp ' : 'Rp ';
  return `${prefix}${Math.round(Math.abs(val)).toLocaleString('id-ID')}`;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  document,
  allDocuments,
  activeGh,
  printSelection,
  previewMode = false,
}) => {
  const phaseSpec = GROWTH_PHASE_SPECS[activeGh.phase];
  const useCustomTargets = Boolean(activeGh.waterTargets?.useCustom);
  const targetPpmMin = useCustomTargets
    ? activeGh.waterTargets?.ppmMin ?? phaseSpec.ppmMin
    : phaseSpec.ppmMin;
  const targetPpmMax = useCustomTargets
    ? activeGh.waterTargets?.ppmMax ?? phaseSpec.ppmMax
    : phaseSpec.ppmMax;
  const targetPhMin = useCustomTargets
    ? activeGh.waterTargets?.phMin ?? phaseSpec.phMin
    : phaseSpec.phMin;
  const targetPhMax = useCustomTargets
    ? activeGh.waterTargets?.phMax ?? phaseSpec.phMax
    : phaseSpec.phMax;

  const counts = {
    sehat: activeGh.plants.filter((p) => p.status === 'sehat').length,
    perhatian: activeGh.plants.filter((p) => p.status === 'perhatian').length,
    sakit: activeGh.plants.filter((p) => p.status === 'sakit').length,
    panen: activeGh.plants.filter((p) => p.status === 'panen').length,
    kosong: activeGh.plants.filter((p) => p.status === 'kosong').length,
    berbuah: activeGh.plants.filter((p) =>
      p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0
    ).length,
    tidak_berbuah: activeGh.plants.filter((p) =>
      p.fruitingStatus ? p.fruitingStatus === 'tidak_berbuah' : p.fruitCount === 0
    ).length,
  };
  const flaggedPlants = activeGh.plants.filter(
    (p) => p.status === 'sakit' || p.status === 'perhatian'
  );

  // Average melon weight & total harvest estimate
  let sampledCount = 0;
  let totalSampleKg = 0;
  let totalFruits = 0;
  for (const p of activeGh.plants) {
    if (p.status === 'kosong') continue;
    if (p.estWeightKg > 0) {
      sampledCount += 1;
      totalSampleKg += p.estWeightKg;
    }
    const isFruit = p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0;
    if (isFruit) {
      totalFruits += Math.max(1, p.fruitCount || 0);
    }
  }
  const sampleAvgKg = sampledCount > 0 ? totalSampleKg / sampledCount : 0;
  const effectiveAvgKg =
    typeof activeGh.avgMelonWeightKg === 'number' && !Number.isNaN(activeGh.avgMelonWeightKg)
      ? activeGh.avgMelonWeightKg
      : sampleAvgKg > 0
      ? Number(sampleAvgKg.toFixed(2))
      : 1.5;
  const estimatedTotalKg = totalFruits * effectiveAvgKg;

  // Accounting metrics
  const expenses = activeGh.expenses || [];
  const sales = activeGh.sales || [];
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalCost || 0), 0);
  const totalSalesRp = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalSalesKg = sales.reduce((s, x) => s + (x.weightKg || 0), 0);
  const netProfitGh = totalSalesRp - totalExpenses;
  const seasonExpAllGh = document.greenhouses.reduce(
    (a, g) => a + (g.expenses || []).reduce((x, e) => x + (e.totalCost || 0), 0),
    0
  );
  const seasonSaleAllGh = document.greenhouses.reduce(
    (a, g) => a + (g.sales || []).reduce((x, s) => x + (s.totalAmount || 0), 0),
    0
  );
  const seasonKgAllGh = document.greenhouses.reduce(
    (a, g) => a + (g.sales || []).reduce((x, s) => x + (s.weightKg || 0), 0),
    0
  );

  // Annual summary across allDocuments
  const annualMap = new Map<string, { exp: number; sal: number; kg: number }>();
  for (const docItem of allDocuments) {
    for (const g of docItem.greenhouses) {
      for (const e of g.expenses || []) {
        const yr = /^\d{4}/.test(e.date) ? e.date.slice(0, 4) : docItem.createdAt.slice(0, 4);
        if (!annualMap.has(yr)) annualMap.set(yr, { exp: 0, sal: 0, kg: 0 });
        annualMap.get(yr)!.exp += e.totalCost || 0;
      }
      for (const s of g.sales || []) {
        const yr = /^\d{4}/.test(s.date) ? s.date.slice(0, 4) : docItem.createdAt.slice(0, 4);
        if (!annualMap.has(yr)) annualMap.set(yr, { exp: 0, sal: 0, kg: 0 });
        annualMap.get(yr)!.sal += s.totalAmount || 0;
        annualMap.get(yr)!.kg += s.weightKg || 0;
      }
    }
  }
  const annualRows = [...annualMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const hasAnySelected =
    printSelection.water ||
    printSelection.treatment ||
    printSelection.plants ||
    printSelection.accountingExpenses ||
    printSelection.accountingSales ||
    printSelection.accountingProfit;

  return (
    <div
      className={
        previewMode
          ? 'block text-gray-900 bg-white p-4 sm:p-6 space-y-5 rounded-lg border border-gray-300 shadow-sm min-w-[540px]'
          : 'hidden print:block text-black bg-white p-2 space-y-5'
      }
    >
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Laporan Kontrol Melon Hidroponik NFT</h1>
          <div className="text-xs text-gray-700 mt-1">
            Dokumen: <strong>{document.title}</strong> · Greenhouse:{' '}
            <strong>{activeGh.name}</strong> ({activeGh.variety})
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            Tanggal Tanam: {activeGh.plantingDate} · Tanggal Panen:{' '}
            <strong>{activeGh.harvestDate || 'Belum diisi'}</strong> · Fase: {phaseSpec.label} (
            {phaseSpec.hstRange}) · Kapasitas: {activeGh.capacity} tanaman ({activeGh.gulliesCount} talang)
          </div>
        </div>
        <div className="text-right text-xs text-gray-600 font-mono-tabular">
          <div>Dicetak: {new Date().toLocaleString('id-ID')}</div>
          <div>MelonFlow NFT</div>
        </div>
      </div>

      {!hasAnySelected && (
        <div className="rounded border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
          Pilih minimal 1 bagian laporan pada menu sebelah kiri untuk menampilkan pratinjau cetak.
        </div>
      )}

      {/* Section 1: PPM & pH */}
      {printSelection.water && (
        <section className="print-break-inside-avoid space-y-2">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            1. Kontrol PPM &amp; pH Air Tandon (Sistem Manual)
          </h2>
          <div className="grid grid-cols-4 gap-3 text-xs border border-gray-300 p-2.5 rounded">
            <div>
              <div className="text-gray-500">PPM / EC</div>
              <div className="font-bold font-mono-tabular text-sm">
                {activeGh.currentWater.ppm} ppm ({activeGh.currentWater.ec.toFixed(2)} mS)
              </div>
              <div className="text-[10px] text-gray-500 font-mono-tabular">
                Target: {targetPpmMin}–{targetPpmMax} ppm{useCustomTargets ? ' (Pemeriksa)' : ''}
              </div>
            </div>
            <div>
              <div className="text-gray-500">pH Larutan</div>
              <div className="font-bold font-mono-tabular text-sm">
                {activeGh.currentWater.ph.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 font-mono-tabular">
                Target: {targetPhMin.toFixed(1)}–{targetPhMax.toFixed(1)}
                {useCustomTargets ? ' (Pemeriksa)' : ''}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Suhu &amp; Debit</div>
              <div className="font-bold font-mono-tabular text-sm">
                {activeGh.currentWater.tempC.toFixed(1)}°C · {activeGh.currentWater.flowLpm} L/mnt
              </div>
            </div>
            <div>
              <div className="text-gray-500">Tandon Utama</div>
              <div className="font-bold font-mono-tabular text-sm">
                {activeGh.currentWater.reservoirPct}% ({activeGh.reservoirLiters} L)
              </div>
            </div>
          </div>

          {activeGh.waterLogs.length > 0 && (
            <table className="w-full text-[11px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">Waktu</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">PPM Awal → Akhir</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">pH Awal → Akhir</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Penambahan Manual</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {activeGh.waterLogs.slice(0, 12).map((l) => {
                  const nutL =
                    l.nutrientAddedLiters ??
                    (l.abMixAddedMl > 0 ? Number((l.abMixAddedMl / 1000).toFixed(1)) : 0);
                  const chem =
                    l.phChemical && l.phChemical !== 'none'
                      ? l.phChemical
                      : l.phAdjType === 'up'
                      ? 'KOH'
                      : l.phAdjType === 'down'
                      ? 'Phosphoric'
                      : '';
                  return (
                    <tr key={l.id}>
                      <td className="border border-gray-300 px-2 py-1 font-mono-tabular">
                        {new Date(l.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono-tabular">
                        {l.ppmBefore ?? l.ppm} → {l.ppm}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono-tabular">
                        {(l.phBefore ?? l.ph).toFixed(2)} → {l.ph.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 font-mono-tabular">
                        {(l.waterAddedLiters || 0) > 0 ? `Air +${l.waterAddedLiters}L ` : ''}
                        {nutL > 0 ? `Nutrisi +${nutL}L ` : ''}
                        {l.phAdjMl > 0 ? `${chem} +${l.phAdjMl}ml` : ''}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {l.note} ({l.operator})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Section 2: Treatments */}
      {printSelection.treatment && (
        <section className="print-break-inside-avoid space-y-2">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            2. Catatan Perawatan (Penyemprotan, Pengolesan &amp; Pengocoran)
          </h2>
          {activeGh.treatments.length === 0 ? (
            <p className="text-xs text-gray-600">Belum ada catatan perawatan.</p>
          ) : (
            <table className="w-full text-[11px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">Metode</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Nama Obat &amp; Dosis</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Target</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Jadwal</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeGh.treatments.map((t) => (
                  <tr key={t.id}>
                    <td className="border border-gray-300 px-2 py-1 font-medium">
                      {TREATMENT_TYPE_LABELS[t.type].short}
                      {t.type === 'penyemprotan' && t.sprayCategory
                        ? ` (${t.sprayCategory})`
                        : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {t.medicineName} ({t.dosage})
                    </td>
                    <td className="border border-gray-300 px-2 py-1">{t.targetPlants}</td>
                    <td className="border border-gray-300 px-2 py-1 font-mono-tabular">
                      {new Date(t.scheduledAt).toLocaleString('id-ID')}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 uppercase">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Section 3: Plants 1-1000 + Average Melon Weight Estimate */}
      {printSelection.plants && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            3. Rekap Kondisi Tanaman (1 s/d {activeGh.capacity}) &amp; Perkiraan Berat Melon
          </h2>
          <div className="grid grid-cols-7 gap-2 text-xs border border-gray-300 p-2.5 rounded">
            <div>
              <div className="text-gray-500">Sehat</div>
              <div className="font-bold font-mono-tabular">{counts.sehat}</div>
            </div>
            <div>
              <div className="text-gray-500">Perhatian</div>
              <div className="font-bold font-mono-tabular">{counts.perhatian}</div>
            </div>
            <div>
              <div className="text-gray-500">Sakit</div>
              <div className="font-bold font-mono-tabular">{counts.sakit}</div>
            </div>
            <div>
              <div className="text-gray-500">Siap Panen</div>
              <div className="font-bold font-mono-tabular">{counts.panen}</div>
            </div>
            <div>
              <div className="text-gray-500">Kosong</div>
              <div className="font-bold font-mono-tabular">{counts.kosong}</div>
            </div>
            <div>
              <div className="text-gray-500">Berbuah</div>
              <div className="font-bold font-mono-tabular">{counts.berbuah}</div>
            </div>
            <div>
              <div className="text-gray-500">Tdk Berbuah</div>
              <div className="font-bold font-mono-tabular">{counts.tidak_berbuah}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs border border-gray-300 bg-gray-50 p-2.5 rounded">
            <div>
              <div className="text-gray-500">Rata-Rata Berat / Buah</div>
              <div className="font-bold font-mono-tabular">{effectiveAvgKg.toFixed(2)} kg</div>
            </div>
            <div>
              <div className="text-gray-500">Total Buah Aktif</div>
              <div className="font-bold font-mono-tabular">
                {totalFruits.toLocaleString('id-ID')} buah
              </div>
            </div>
            <div>
              <div className="text-gray-500">Sampel Bobot Tercatat</div>
              <div className="font-bold font-mono-tabular">
                {totalSampleKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg ({sampledCount} phn)
              </div>
            </div>
            <div>
              <div className="text-gray-500 font-semibold">Perkiraan Total Berat Melon</div>
              <div className="font-bold font-mono-tabular text-sm">
                {estimatedTotalKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg (
                {(estimatedTotalKg / 100).toFixed(2)} kuintal)
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold pt-1">
            Daftar Tanaman Perlu Tindakan ({flaggedPlants.length} pohon):
          </div>
          {flaggedPlants.length === 0 ? (
            <p className="text-xs text-gray-600">Seluruh tanaman dalam kondisi sehat/normal.</p>
          ) : (
            <table className="w-full text-[11px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">No. Pohon</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Tgl Periksa</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Status</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Gejala / Diagnosa</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Tindakan &amp; Catatan</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPlants.slice(0, 50).map((p) => (
                  <tr key={p.id}>
                    <td className="border border-gray-300 px-2 py-1 font-mono-tabular font-bold">
                      #{p.id}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 font-mono-tabular whitespace-nowrap">
                      {p.inspectionDate || new Date(p.updatedAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {PLANT_STATUS_META[p.status].short} (
                      {(p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0)
                        ? 'Berbuah'
                        : 'Tdk Berbuah'}
                      )
                    </td>
                    <td className="border border-gray-300 px-2 py-1">{p.symptom}</td>
                    <td className="border border-gray-300 px-2 py-1">
                      {p.lastAction}
                      {p.notes ? ` — ${p.notes}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Section 4A: Pembukuan - Dashboard 1 Biaya Produksi */}
      {printSelection.accountingExpenses && (
        <section className="print-break-inside-avoid space-y-2">
          <div className="flex items-center justify-between border-b border-gray-300 pb-1">
            <h2 className="text-sm font-bold">
              4A. Pembukuan Melon — Biaya Produksi ({activeGh.name})
            </h2>
            <span className="text-xs font-bold font-mono-tabular">
              Total Biaya: {fmtRp(totalExpenses)}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 text-[11px] border border-gray-300 p-2 rounded">
            {(Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).map((cat) => {
              const sum = expenses
                .filter((e) => e.category === cat)
                .reduce((a, b) => a + (b.totalCost || 0), 0);
              return (
                <div key={cat}>
                  <div className="text-gray-500">{EXPENSE_CATEGORY_META[cat].short}</div>
                  <div className="font-bold font-mono-tabular">{fmtRp(sum)}</div>
                </div>
              );
            })}
          </div>

          {expenses.length === 0 ? (
            <p className="text-xs text-gray-600">Belum ada catatan biaya produksi.</p>
          ) : (
            <table className="w-full text-[11px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">Tanggal</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Kategori</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Nama Item</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Harga Satuan</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="border border-gray-300 px-2 py-1 font-mono-tabular">
                      {formatDateShortId(e.date)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {EXPENSE_CATEGORY_META[e.category]?.short || e.category}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 font-medium">
                      {e.itemName}
                      {e.notes ? ` (${e.notes})` : ''}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-mono-tabular">
                      {e.quantity} {e.unit}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-mono-tabular">
                      {fmtRp(e.unitPrice)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono-tabular">
                      {fmtRp(e.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Section 4B: Pembukuan - Dashboard 2 Penjualan */}
      {printSelection.accountingSales && (
        <section className="print-break-inside-avoid space-y-2">
          <div className="flex items-center justify-between border-b border-gray-300 pb-1">
            <h2 className="text-sm font-bold">
              4B. Pembukuan Melon — Penjualan ({activeGh.name})
            </h2>
            <span className="text-xs font-bold font-mono-tabular">
              Total: {totalSalesKg.toLocaleString('id-ID')} kg · {fmtRp(totalSalesRp)}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2 text-[11px] border border-gray-300 p-2 rounded">
            {SALE_GRADE_OPTIONS.map((opt) => {
              const items = sales.filter((s) => s.grade === opt.grade);
              const kg = items.reduce((a, b) => a + (b.weightKg || 0), 0);
              const rp = items.reduce((a, b) => a + (b.totalAmount || 0), 0);
              return (
                <div key={opt.grade}>
                  <div className="text-gray-500 font-semibold">{opt.grade}</div>
                  <div className="font-mono-tabular">{kg.toFixed(1)} kg</div>
                  <div className="font-bold font-mono-tabular">{fmtRp(rp)}</div>
                </div>
              );
            })}
          </div>

          {sales.length === 0 ? (
            <p className="text-xs text-gray-600">Belum ada catatan penjualan melon.</p>
          ) : (
            <table className="w-full text-[11px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">Tanggal</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Grade</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Berat (kg)</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Harga / kg</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Total Uang</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Pembeli / Ket.</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="border border-gray-300 px-2 py-1 font-mono-tabular">
                      {formatDateShortId(s.date)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 font-semibold">{s.grade}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-mono-tabular">
                      {s.weightKg.toLocaleString('id-ID')} kg
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-mono-tabular">
                      {fmtRp(s.pricePerKg)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono-tabular">
                      {fmtRp(s.totalAmount)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {s.buyer}
                      {s.notes ? ` — ${s.notes}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Section 4C: Pembukuan - Dashboard 3 Keuntungan & Rekap Periode/Tahunan */}
      {printSelection.accountingProfit && (
        <section className="print-break-inside-avoid space-y-2.5">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            4C. Pembukuan Melon — Keuntungan, Rekap Periode Panen &amp; Tahunan
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs border border-gray-300 p-2.5 rounded">
            <div className="space-y-1">
              <div className="font-bold">{activeGh.name} Saja</div>
              <div className="flex justify-between font-mono-tabular">
                <span className="text-gray-600">Total Penjualan ({totalSalesKg.toFixed(1)} kg):</span>
                <span>{fmtRp(totalSalesRp)}</span>
              </div>
              <div className="flex justify-between font-mono-tabular">
                <span className="text-gray-600">Total Biaya Produksi:</span>
                <span>{fmtRp(totalExpenses)}</span>
              </div>
              <div className="flex justify-between font-mono-tabular font-bold border-t border-gray-200 pt-1">
                <span>Keuntungan Bersih:</span>
                <span>{fmtRp(netProfitGh)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-bold">Gabungan Semua GH ({document.title})</div>
              <div className="flex justify-between font-mono-tabular">
                <span className="text-gray-600">Total Penjualan ({seasonKgAllGh.toFixed(1)} kg):</span>
                <span>{fmtRp(seasonSaleAllGh)}</span>
              </div>
              <div className="flex justify-between font-mono-tabular">
                <span className="text-gray-600">Total Biaya Produksi:</span>
                <span>{fmtRp(seasonExpAllGh)}</span>
              </div>
              <div className="flex justify-between font-mono-tabular font-bold border-t border-gray-200 pt-1">
                <span>Keuntungan Bersih:</span>
                <span>{fmtRp(seasonSaleAllGh - seasonExpAllGh)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Rekap per Periode */}
            <div>
              <div className="text-[11px] font-bold mb-1">Rekap Tiap Periode Panen</div>
              <table className="w-full text-[10.5px] border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1.5 py-1 text-left">Periode</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Biaya</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Jual</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {allDocuments.map((d) => {
                    const e = d.greenhouses.reduce(
                      (a, g) => a + (g.expenses || []).reduce((x, y) => x + (y.totalCost || 0), 0),
                      0
                    );
                    const s = d.greenhouses.reduce(
                      (a, g) => a + (g.sales || []).reduce((x, y) => x + (y.totalAmount || 0), 0),
                      0
                    );
                    return (
                      <tr key={d.id}>
                        <td className="border border-gray-300 px-1.5 py-1">{d.title}</td>
                        <td className="border border-gray-300 px-1.5 py-1 text-right font-mono-tabular">
                          {fmtRp(e)}
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1 text-right font-mono-tabular">
                          {fmtRp(s)}
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1 text-right font-bold font-mono-tabular">
                          {fmtRp(s - e)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rekap Tahunan */}
            <div>
              <div className="text-[11px] font-bold mb-1">Rekap Tahunan</div>
              <table className="w-full text-[10.5px] border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1.5 py-1 text-left">Tahun</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Kg</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Biaya</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Jual</th>
                    <th className="border border-gray-300 px-1.5 py-1 text-right">Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {annualRows.map(([yr, v]) => (
                    <tr key={yr}>
                      <td className="border border-gray-300 px-1.5 py-1 font-bold">{yr}</td>
                      <td className="border border-gray-300 px-1.5 py-1 text-right font-mono-tabular">
                        {v.kg.toLocaleString('id-ID')}
                      </td>
                      <td className="border border-gray-300 px-1.5 py-1 text-right font-mono-tabular">
                        {fmtRp(v.exp)}
                      </td>
                      <td className="border border-gray-300 px-1.5 py-1 text-right font-mono-tabular">
                        {fmtRp(v.sal)}
                      </td>
                      <td className="border border-gray-300 px-1.5 py-1 text-right font-bold font-mono-tabular">
                        {fmtRp(v.sal - v.exp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Signature block */}
      <div className="pt-8 grid grid-cols-2 gap-12 text-xs">
        <div>
          <div>Disiapkan oleh Petugas Kebun,</div>
          <div className="mt-12 border-t border-gray-400 w-48 pt-1">Nama &amp; Tanda Tangan</div>
        </div>
        <div>
          <div>Disetujui oleh Kepala Operasional GH,</div>
          <div className="mt-12 border-t border-gray-400 w-48 pt-1">Nama &amp; Tanda Tangan</div>
        </div>
      </div>
    </div>
  );
};

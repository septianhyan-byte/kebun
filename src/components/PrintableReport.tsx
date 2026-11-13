import React from 'react';
import {
  GROWTH_PHASE_SPECS,
  PLANT_STATUS_META,
  TREATMENT_TYPE_LABELS,
} from '../constants/themes';
import { GreenhouseData, SeasonDocument } from '../types';
import { PrintScope } from './PrintModal';

interface PrintableReportProps {
  document: SeasonDocument;
  activeGh: GreenhouseData;
  printScope: PrintScope;
  previewMode?: boolean;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  document,
  activeGh,
  printScope,
  previewMode = false,
}) => {
  const phaseSpec = GROWTH_PHASE_SPECS[activeGh.phase];
  const counts = {
    sehat: activeGh.plants.filter((p) => p.status === 'sehat').length,
    perhatian: activeGh.plants.filter((p) => p.status === 'perhatian').length,
    sakit: activeGh.plants.filter((p) => p.status === 'sakit').length,
    panen: activeGh.plants.filter((p) => p.status === 'panen').length,
    kosong: activeGh.plants.filter((p) => p.status === 'kosong').length,
    berbuah: activeGh.plants.filter((p) => (p.fruitingStatus ? p.fruitingStatus === 'berbuah' : p.fruitCount > 0)).length,
    tidak_berbuah: activeGh.plants.filter((p) => (p.fruitingStatus ? p.fruitingStatus === 'tidak_berbuah' : p.fruitCount === 0)).length,
  };
  const flaggedPlants = activeGh.plants.filter(
    (p) => p.status === 'sakit' || p.status === 'perhatian'
  );

  const showWater = printScope === 'all' || printScope === 'water';
  const showTreatment = printScope === 'all' || printScope === 'treatment';
  const showPlants = printScope === 'all' || printScope === 'plants';

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

      {/* Section 1: PPM & pH */}
      {showWater && (
        <section className="print-break-inside-avoid space-y-2">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            1. Kontrol PPM & pH Air Tandon (Sistem Manual)
          </h2>
          <div className="grid grid-cols-4 gap-3 text-xs border border-gray-300 p-2.5 rounded">
            <div>
              <div className="text-gray-500">PPM / EC</div>
              <div className="font-bold font-mono-tabular text-sm">
                {activeGh.currentWater.ppm} ppm ({activeGh.currentWater.ec.toFixed(2)} mS)
              </div>
            </div>
            <div>
              <div className="text-gray-500">pH Larutan</div>
              <div className="font-bold font-mono-tabular text-sm">
                {activeGh.currentWater.ph.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Suhu & Debit</div>
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
      {showTreatment && (
        <section className="print-break-inside-avoid space-y-2">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            2. Catatan Perawatan (Penyemprotan, Pengolesan & Pengocoran)
          </h2>
          {activeGh.treatments.length === 0 ? (
            <p className="text-xs text-gray-600">Belum ada catatan perawatan.</p>
          ) : (
            <table className="w-full text-[11px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">Metode</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Nama Obat & Dosis</th>
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
                    <td className="border border-gray-300 px-2 py-1 uppercase">
                      {t.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Section 3: Plants 1-1000 */}
      {showPlants && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold border-b border-gray-300 pb-1">
            3. Rekap Kondisi Tanaman (1 s/d {activeGh.capacity})
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
                  <th className="border border-gray-300 px-2 py-1 text-left">Status</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Gejala / Diagnosa</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Tindakan & Catatan</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPlants.slice(0, 50).map((p) => (
                  <tr key={p.id}>
                    <td className="border border-gray-300 px-2 py-1 font-mono-tabular font-bold">
                      #{p.id}
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

      {/* Signature block */}
      <div className="pt-8 grid grid-cols-2 gap-12 text-xs">
        <div>
          <div>Disiapkan oleh Petugas Kebun,</div>
          <div className="mt-12 border-t border-gray-400 w-48 pt-1">Nama & Tanda Tangan</div>
        </div>
        <div>
          <div>Disetujui oleh Kepala Operasional GH,</div>
          <div className="mt-12 border-t border-gray-400 w-48 pt-1">Nama & Tanda Tangan</div>
        </div>
      </div>
    </div>
  );
};

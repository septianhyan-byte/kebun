import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileText,
  Printer,
  Receipt,
  Usb,
  Wifi,
  X,
} from 'lucide-react';
import { GreenhouseData, SeasonDocument } from '../types';
import {
  formatEscPosReport,
  getPrinterCapabilities,
  printViaWebSerial,
  printViaWebUsb,
} from '../utils/printer';
import { PrintableReport } from './PrintableReport';

export type PrintScope = 'all' | 'water' | 'treatment' | 'plants';

interface PrintModalProps {
  isOpen: boolean;
  document: SeasonDocument;
  activeGh: GreenhouseData;
  printScope: PrintScope;
  onChangePrintScope: (scope: PrintScope) => void;
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  document,
  activeGh,
  printScope,
  onChangePrintScope,
  onClose,
}) => {
  const [printerFeedback, setPrinterFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [connectedPrinter, setConnectedPrinter] = useState<string>('');
  const [previewTab, setPreviewTab] = useState<'a4' | 'thermal'>('a4');
  const caps = useMemo(() => getPrinterCapabilities(), []);
  const escPosText = useMemo(
    () => formatEscPosReport(document, activeGh),
    [document, activeGh]
  );

  if (!isOpen) return null;

  const handleSystemPrintPdf = () => {
    setPrinterFeedback(null);
    onClose();
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleSerialPrint = async () => {
    const res = await printViaWebSerial(escPosText);
    setPrinterFeedback({ ok: res.success, msg: res.message });
    if (res.success && res.printerName) {
      setConnectedPrinter(res.printerName);
    }
  };

  const handleUsbPrint = async () => {
    const res = await printViaWebUsb(escPosText);
    setPrinterFeedback({ ok: res.success, msg: res.message });
    if (res.success && res.printerName) {
      setConnectedPrinter(res.printerName);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cetak Laporan PDF dan Printer"
    >
      <div
        className="flex max-h-[94vh] sm:max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border shadow-xl"
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
            <h2 className="text-sm sm:text-base font-bold truncate">
              Cetak Laporan (PDF, Printer Sistem & Thermal) + Live Preview
            </h2>
            <p className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>
              {document.title} · {activeGh.name} ({activeGh.variety})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu printer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: Responsive 2 columns on desktop, stacked on HP/tablet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left: Print Options & Controls (5 cols) */}
            <div className="space-y-4 lg:col-span-5">
              {/* Scope selection */}
              <div>
                <div className="text-xs font-semibold mb-2">
                  1. Pilih Isi Laporan yang Akan Dicetak
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'all', label: 'Semua Dashboard (1–3)' },
                      { id: 'water', label: 'Dashboard 1: PPM & pH' },
                      { id: 'treatment', label: 'Dashboard 2: Perawatan' },
                      { id: 'plants', label: 'Dashboard 3: 1–1000' },
                    ] as Array<{ id: PrintScope; label: string }>
                  ).map((item) => {
                    const active = printScope === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChangePrintScope(item.id)}
                        className="rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer"
                        style={{
                          borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor: active ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
                          color: active ? 'var(--app-accent)' : 'var(--app-text)',
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option A: System Printer / Save as PDF */}
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
                    <span>Cetak PDF / Printer Standar (A4)</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                    Simpan ke <strong>PDF</strong> atau kirim langsung ke printer Inkjet / Laser / Wi-Fi / Bluetooth di HP, Tablet, atau PC.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSystemPrintPdf}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer"
                    style={{
                      backgroundColor: 'var(--app-accent)',
                      color: 'var(--app-accent-fg)',
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    Cetak / Simpan sebagai PDF
                  </button>
                  <span className="text-[11px] text-center" style={{ color: 'var(--app-text-muted)' }}>
                    Format kertas A4 Portrait · Sesuai pratinjau di samping
                  </span>
                </div>
              </div>

              {/* Option B: Direct Hardware Printer Detection (Web Serial / Web USB) */}
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Usb className="h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
                    <span>Printer Thermal Langsung (ESC/POS)</span>
                  </div>
                  {connectedPrinter && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {connectedPrinter}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  Cetak struk ringkasan kebun ke printer thermal 58mm/80mm melalui kabel USB OTG atau Serial Bluetooth tanpa dialog OS.
                </p>

                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  <span>Serial: {caps.hasWebSerial ? 'Tersedia' : 'Tidak didukung'}</span>
                  <span>·</span>
                  <span>USB: {caps.hasWebUsb ? 'Tersedia' : 'Tidak didukung'}</span>
                  <span>·</span>
                  <span>Spooler OS: {caps.hasSystemPrint ? 'Siap' : 'Tidak tersedia'}</span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewTab('thermal');
                      handleSerialPrint();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    Deteksi & Cetak via Serial / Bluetooth
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewTab('thermal');
                      handleUsbPrint();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <Usb className="h-3.5 w-3.5" />
                    Deteksi & Cetak via USB Printer
                  </button>
                </div>

                {printerFeedback && (
                  <div
                    className={`rounded-lg border p-2.5 text-xs ${
                      printerFeedback.ok
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {printerFeedback.msg}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Live Print Preview (7 cols) */}
            <div
              className="flex flex-col rounded-xl border overflow-hidden lg:col-span-7"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-surface-muted)',
              }}
            >
              {/* Preview Toolbar */}
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Eye className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
                  <span>Pratinjau Dokumen Cetak</span>
                </div>

                <div
                  className="flex items-center gap-1 rounded-lg p-1"
                  style={{ backgroundColor: 'var(--app-surface-muted)' }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewTab('a4')}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: previewTab === 'a4' ? 'var(--app-surface)' : 'transparent',
                      color: previewTab === 'a4' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Preview PDF / A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('thermal')}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: previewTab === 'thermal' ? 'var(--app-surface)' : 'transparent',
                      color: previewTab === 'thermal' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    }}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Preview Struk Thermal
                  </button>
                </div>
              </div>

              {/* Scrollable Paper Sheet Preview */}
              <div className="flex-1 overflow-auto p-3 sm:p-4 max-h-[55vh] lg:max-h-[68vh]">
                {previewTab === 'a4' ? (
                  <div className="overflow-x-auto">
                    <PrintableReport
                      document={document}
                      activeGh={activeGh}
                      printScope={printScope}
                      previewMode
                    />
                  </div>
                ) : (
                  <div className="mx-auto max-w-[300px] rounded-lg border border-gray-300 bg-white p-4 text-gray-900 shadow-sm">
                    <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-center text-[10px] font-mono-tabular text-gray-500">
                      KERTAS THERMAL 58MM / ESC-POS
                    </div>
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono-tabular text-gray-900">
                      {escPosText}
                    </pre>
                    <div className="border-t border-dashed border-gray-300 pt-2 mt-3 text-center text-[10px] font-mono-tabular text-gray-400">
                      --- POTONG DI SINI ---
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

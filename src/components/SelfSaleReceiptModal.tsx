import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Cloud,
  CloudOff,
  CreditCard,
  ImagePlus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Save,
  Trash2,
  Usb,
  Wifi,
  X,
} from 'lucide-react';
import {
  GreenhouseData,
  SaleRecord,
  SelfSalePaymentProfile,
  SelfSaleReceipt,
} from '../types';
import { toLocalDateInputValue } from '../utils/dateUtils';
import {
  formatEscPosSelfSaleReceipt,
  printViaWebSerial,
  printViaWebUsb,
} from '../utils/printer';
import { compressQrisImageFile } from '../utils/qrisImage';
import { PrintableReceipt } from './PrintableReceipt';

interface DraftReceiptItem {
  id: string;
  name: string;
  weightDraft: string;
  priceDraft: string;
}

interface SelfSaleReceiptModalProps {
  isOpen: boolean;
  gh: GreenhouseData;
  initialSale?: SaleRecord | null;
  initialDraft?: {
    date: string;
    weightKg: number;
    pricePerKg: number;
    buyer: string;
    notes: string;
  } | null;
  paymentProfile: SelfSalePaymentProfile;
  onUpdatePaymentProfile: (next: SelfSalePaymentProfile) => void;
  onSaveSaleRecord: (sale: SaleRecord, isUpdate?: boolean) => void;
  onPrintReceiptSheet: (receipt: SelfSaleReceipt) => void;
  cloudEmail?: string | null;
  onOpenAccountSync: () => void;
  onClose: () => void;
}

function buildReceiptNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = String(now.getTime()).slice(-4);
  return `NF-${y}${m}${d}-${suffix}`;
}

function fmtRp(val: number): string {
  const abs = Math.round(Math.abs(val));
  const prefix = val < 0 ? '-Rp ' : 'Rp ';
  return `${prefix}${abs.toLocaleString('id-ID')}`;
}

export const SelfSaleReceiptModal: React.FC<SelfSaleReceiptModalProps> = ({
  isOpen,
  gh,
  initialSale,
  initialDraft,
  paymentProfile,
  onUpdatePaymentProfile,
  onSaveSaleRecord,
  onPrintReceiptSheet,
  cloudEmail,
  onOpenAccountSync,
  onClose,
}) => {
  const qrisInputRef = useRef<HTMLInputElement | null>(null);

  const [receiptNumber, setReceiptNumber] = useState(buildReceiptNumber);
  const [date, setDate] = useState(() => toLocalDateInputValue());
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<SelfSaleReceipt['paymentMethod']>('QRIS / Transfer');
  const [notes, setNotes] = useState('');
  const [paperFormat, setPaperFormat] =
    useState<SelfSaleReceipt['paperFormat']>('thermal80');
  const [items, setItems] = useState<DraftReceiptItem[]>([]);
  const [saveAlsoToSales, setSaveAlsoToSales] = useState(true);
  const [savedSaleNotice, setSavedSaleNotice] = useState('');

  const [qrisLoading, setQrisLoading] = useState(false);
  const [qrisError, setQrisError] = useState('');
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const [thermalFeedback, setThermalFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  // Initialize draft fields whenever modal opens or target sale changes
  useEffect(() => {
    if (!isOpen) return;
    setThermalFeedback(null);
    setQrisError('');
    setSavedSaleNotice('');

    if (initialSale) {
      setReceiptNumber(initialSale.receiptNo || buildReceiptNumber());
      setDate(initialSale.date || toLocalDateInputValue());
      setBuyerName(initialSale.buyer || '');
      setBuyerPhone('');
      setNotes(initialSale.notes || '');
      setSaveAlsoToSales(false);
      setItems([
        {
          id: `item-${Date.now()}`,
          name: `${gh.variety || 'Melon Segar'} (${gh.name})`,
          weightDraft: initialSale.weightKg > 0 ? String(initialSale.weightKg) : '',
          priceDraft: initialSale.pricePerKg > 0 ? String(initialSale.pricePerKg) : '',
        },
      ]);
    } else if (initialDraft) {
      setReceiptNumber(buildReceiptNumber());
      setDate(initialDraft.date || toLocalDateInputValue());
      setBuyerName(initialDraft.buyer || '');
      setBuyerPhone('');
      setNotes(initialDraft.notes || '');
      setSaveAlsoToSales(true);
      setItems([
        {
          id: `item-${Date.now()}`,
          name: `${gh.variety || 'Melon Segar'} (${gh.name})`,
          weightDraft: initialDraft.weightKg > 0 ? String(initialDraft.weightKg) : '',
          priceDraft: initialDraft.pricePerKg > 0 ? String(initialDraft.pricePerKg) : '',
        },
      ]);
    } else {
      setReceiptNumber(buildReceiptNumber());
      setDate(toLocalDateInputValue());
      setBuyerName('');
      setBuyerPhone('');
      setNotes('');
      setSaveAlsoToSales(true);
      setItems([
        {
          id: `item-${Date.now()}`,
          name: `${gh.variety || 'Melon Segar'} (${gh.name})`,
          weightDraft: '',
          priceDraft: '',
        },
      ]);
    }
  }, [isOpen, initialSale, initialDraft, gh.name, gh.variety]);

  const builtReceipt = useMemo<SelfSaleReceipt>(() => {
    const resolvedItems = items.map((it) => {
      const w = Math.max(0, Number(it.weightDraft) || 0);
      const p = Math.max(0, Number(it.priceDraft) || 0);
      return {
        id: it.id,
        name: it.name.trim() || 'Melon Segar',
        weightKg: w,
        pricePerKg: p,
        subtotal: Math.round(w * p),
      };
    });
    const totalWeightKg = resolvedItems.reduce((acc, x) => acc + x.weightKg, 0);
    const totalAmount = resolvedItems.reduce((acc, x) => acc + x.subtotal, 0);

    return {
      id: initialSale?.id || `nota-${Date.now()}`,
      receiptNumber: receiptNumber.trim() || buildReceiptNumber(),
      date: date || toLocalDateInputValue(),
      saleId: initialSale?.id,
      ghName: gh.name,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      paymentMethod,
      items: resolvedItems,
      totalWeightKg,
      totalAmount,
      notes: notes.trim(),
      paperFormat,
      createdAt: new Date().toISOString(),
    };
  }, [
    items,
    initialSale?.id,
    receiptNumber,
    date,
    gh.name,
    buyerName,
    buyerPhone,
    paymentMethod,
    notes,
    paperFormat,
  ]);

  const escPosReceiptText = useMemo(
    () => formatEscPosSelfSaleReceipt(builtReceipt, paymentProfile),
    [builtReceipt, paymentProfile]
  );

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: `${gh.variety || 'Melon Segar'} (${gh.name})`,
        weightDraft: '',
        priceDraft: '',
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== id) : prev));
  };

  const handlePickQrisFromGallery = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setQrisLoading(true);
    setQrisError('');
    try {
      const compressed = await compressQrisImageFile(file);
      onUpdatePaymentProfile({
        ...paymentProfile,
        qrisImageDataUrl: compressed,
        updatedAt: new Date().toISOString(),
      });
      setProfileSavedNotice(true);
      setTimeout(() => setProfileSavedNotice(false), 2000);
    } catch (err) {
      setQrisError(
        err instanceof Error ? err.message : 'Gagal memproses gambar QRIS.'
      );
    } finally {
      setQrisLoading(false);
    }
  };

  const handleUpdateField = (
    key: keyof SelfSalePaymentProfile,
    value: string
  ) => {
    onUpdatePaymentProfile({
      ...paymentProfile,
      [key]: value,
      updatedAt: new Date().toISOString(),
    });
  };

  const persistSaleIfRequested = () => {
    if (!saveAlsoToSales && !initialSale) return;
    if (builtReceipt.totalWeightKg <= 0 && builtReceipt.totalAmount <= 0) return;

    const avgPrice =
      builtReceipt.totalWeightKg > 0
        ? Math.round(builtReceipt.totalAmount / builtReceipt.totalWeightKg)
        : 0;
    const itemDesc = builtReceipt.items
      .filter((i) => i.weightKg > 0 || i.subtotal > 0)
      .map((i) => `${i.name} ${i.weightKg}kg`)
      .join(', ');
    const combinedNotes = [
      `Nota ${builtReceipt.receiptNumber}`,
      itemDesc ? `(${itemDesc})` : '',
      builtReceipt.notes,
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 480);

    if (initialSale) {
      onSaveSaleRecord(
        {
          ...initialSale,
          date: builtReceipt.date,
          grade: 'Jual sendiri',
          weightKg: builtReceipt.totalWeightKg,
          pricePerKg: avgPrice,
          totalAmount: builtReceipt.totalAmount,
          buyer: builtReceipt.buyerName || initialSale.buyer,
          notes: combinedNotes,
          receiptNo: builtReceipt.receiptNumber,
        },
        true
      );
    } else if (saveAlsoToSales) {
      onSaveSaleRecord(
        {
          id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: builtReceipt.date,
          grade: 'Jual sendiri',
          weightKg: builtReceipt.totalWeightKg,
          pricePerKg: avgPrice,
          totalAmount: builtReceipt.totalAmount,
          buyer: builtReceipt.buyerName || 'Pembeli Langsung',
          notes: combinedNotes,
          receiptNo: builtReceipt.receiptNumber,
          createdAt: new Date().toISOString(),
        },
        false
      );
      setSaveAlsoToSales(false);
      setSavedSaleNotice('Tercatat ke daftar Penjualan (Jual sendiri)');
    }
  };

  const handleSaveSaleOnly = () => {
    if (builtReceipt.totalWeightKg <= 0 && builtReceipt.totalAmount <= 0) {
      setSavedSaleNotice('Isi berat atau harga melon terlebih dahulu.');
      return;
    }
    if (!initialSale) {
      const avgPrice =
        builtReceipt.totalWeightKg > 0
          ? Math.round(builtReceipt.totalAmount / builtReceipt.totalWeightKg)
          : 0;
      const itemDesc = builtReceipt.items
        .filter((i) => i.weightKg > 0 || i.subtotal > 0)
        .map((i) => `${i.name} ${i.weightKg}kg`)
        .join(', ');
      onSaveSaleRecord(
        {
          id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: builtReceipt.date,
          grade: 'Jual sendiri',
          weightKg: builtReceipt.totalWeightKg,
          pricePerKg: avgPrice,
          totalAmount: builtReceipt.totalAmount,
          buyer: builtReceipt.buyerName || 'Pembeli Langsung',
          notes: [`Nota ${builtReceipt.receiptNumber}`, itemDesc, builtReceipt.notes]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 480),
          receiptNo: builtReceipt.receiptNumber,
          createdAt: new Date().toISOString(),
        },
        false
      );
      setSaveAlsoToSales(false);
      setSavedSaleNotice('Berhasil disimpan ke Penjualan (Jual sendiri)');
    } else {
      persistSaleIfRequested();
      setSavedSaleNotice('Perubahan penjualan & nomor nota diperbarui.');
    }
  };

  const handlePrintPdfOrSystem = () => {
    persistSaleIfRequested();
    onPrintReceiptSheet(builtReceipt);
  };

  const handleSerialPrint = async () => {
    persistSaleIfRequested();
    const res = await printViaWebSerial(escPosReceiptText);
    setThermalFeedback({ ok: res.success, msg: res.message });
  };

  const handleUsbPrint = async () => {
    persistSaleIfRequested();
    const res = await printViaWebUsb(escPosReceiptText);
    setThermalFeedback({ ok: res.success, msg: res.message });
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Buat dan Cetak Nota Penjualan Jual Sendiri"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border shadow-xl"
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
            <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 truncate">
              <Receipt
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--app-accent)' }}
              />
              <span className="truncate">
                Nota Penjualan Mandiri (Jual Sendiri) — QRIS &amp; Rekening
              </span>
            </h2>
            <div
              className="mt-0.5 flex flex-wrap items-center gap-2 text-xs"
              style={{ color: 'var(--app-text-muted)' }}
            >
              <span>{gh.name}</span>
              <span aria-hidden="true">·</span>
              <span>{gh.variety}</span>
              <span aria-hidden="true">·</span>
              {cloudEmail ? (
                <button
                  type="button"
                  onClick={onOpenAccountSync}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                >
                  <Cloud className="h-3 w-3" />
                  Sync Akun Google Aktif ({cloudEmail})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAccountSync}
                  className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  <CloudOff className="h-3 w-3" />
                  Klik untuk Sync ke Akun Google
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pembuatan nota"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Form Column (6 cols) */}
            <div className="space-y-4 lg:col-span-6">
              {/* 1. Data Pembeli & Item Nota */}
              <div
                className="rounded-xl border p-4 space-y-3.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold">
                    1. Detail Nota &amp; Daftar Melon
                  </div>
                  <span
                    className="text-[11px] font-mono-tabular"
                    style={{ color: 'var(--app-text-muted)' }}
                  >
                    Total: <strong>{fmtRp(builtReceipt.totalAmount)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Nomor Nota
                    </label>
                    <input
                      type="text"
                      maxLength={48}
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Tanggal Nota
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Nama Pembeli
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Nama pelanggan..."
                      className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      aria-label="Metode pembayaran nota"
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(
                          e.target.value as SelfSaleReceipt['paymentMethod']
                        )
                      }
                      className="h-9 w-full rounded-lg border px-2.5 text-xs cursor-pointer"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    >
                      <option value="QRIS / Transfer">QRIS / Transfer</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Transfer Rekening">Transfer Rekening</option>
                      <option value="Tunai">Tunai</option>
                    </select>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold">
                      Item Melon Dibeli
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                      style={{
                        borderColor: 'var(--app-accent)',
                        color: 'var(--app-accent)',
                        backgroundColor: 'var(--app-surface)',
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Tambah Item
                    </button>
                  </div>

                  {items.map((item, idx) => {
                    const rowTotal = Math.round(
                      (Number(item.weightDraft) || 0) *
                        (Number(item.priceDraft) || 0)
                    );
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border p-2.5 space-y-2"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={100}
                            aria-label={`Nama item ${idx + 1}`}
                            value={item.name}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === item.id
                                    ? { ...x, name: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Nama buah / varietas melon"
                            className="h-8 flex-1 rounded-md border px-2.5 text-xs focus:outline-none"
                            style={{
                              borderColor: 'var(--app-border)',
                              backgroundColor: 'var(--app-canvas)',
                              color: 'var(--app-text)',
                            }}
                          />
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label="Hapus baris item"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-rose-600 dark:text-rose-400 cursor-pointer"
                              style={{ borderColor: 'var(--app-border)' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <div>
                            <label className="block text-[10px] mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
                              Berat (kg)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              placeholder="0"
                              value={item.weightDraft}
                              onFocus={(e) => {
                                if (e.currentTarget.value === '0')
                                  e.currentTarget.select();
                              }}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id
                                      ? { ...x, weightDraft: e.target.value }
                                      : x
                                  )
                                )
                              }
                              className="h-8 w-full rounded-md border px-2 text-xs font-mono-tabular focus:outline-none"
                              style={{
                                borderColor: 'var(--app-border)',
                                backgroundColor: 'var(--app-canvas)',
                                color: 'var(--app-text)',
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
                              Harga / kg (Rp)
                            </label>
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={item.priceDraft}
                              onFocus={(e) => {
                                if (e.currentTarget.value === '0')
                                  e.currentTarget.select();
                              }}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id
                                      ? { ...x, priceDraft: e.target.value }
                                      : x
                                  )
                                )
                              }
                              className="h-8 w-full rounded-md border px-2 text-xs font-mono-tabular focus:outline-none"
                              style={{
                                borderColor: 'var(--app-border)',
                                backgroundColor: 'var(--app-canvas)',
                                color: 'var(--app-text)',
                              }}
                            />
                          </div>
                          <div className="text-right">
                            <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                              Subtotal
                            </div>
                            <div className="text-xs font-bold font-mono-tabular">
                              {fmtRp(rowTotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Catatan Nota (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={240}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Melon petik langsung, Brix 14%..."
                    className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAlsoToSales}
                      onChange={(e) => setSaveAlsoToSales(e.target.checked)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span>
                      {initialSale
                        ? 'Perbarui data di tabel Penjualan'
                        : 'Otomatis catat ke Penjualan (Jual sendiri)'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveSaleOnly}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--app-accent)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-accent)',
                    }}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {initialSale ? 'Perbarui Penjualan' : 'Catat Penjualan'}
                  </button>
                </div>

                {savedSaleNotice && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                    {savedSaleNotice}
                  </div>
                )}
              </div>

              {/* 2. QRIS dari Galeri & Nomor Rekening + Atas Nama */}
              <div
                className="rounded-xl border p-4 space-y-3.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <CreditCard
                      className="h-4 w-4"
                      style={{ color: 'var(--app-accent)' }}
                    />
                    <span>2. QRIS (Galeri) &amp; Nomor Rekening Pembayaran</span>
                  </div>
                  {profileSavedNotice && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Tersimpan
                    </span>
                  )}
                </div>

                {/* Kolom kosong untuk mengisi Nomor Rekening beserta Nama */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Nama Bank / E-Wallet
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={paymentProfile.bankName}
                      onChange={(e) => handleUpdateField('bankName', e.target.value)}
                      placeholder="Kosong (mis. BCA / BRI)"
                      className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Nomor Rekening
                    </label>
                    <input
                      type="text"
                      maxLength={64}
                      value={paymentProfile.accountNumber}
                      onChange={(e) =>
                        handleUpdateField('accountNumber', e.target.value)
                      }
                      placeholder="Isi nomor rekening..."
                      className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">
                      Nama Pemilik Rekening
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={paymentProfile.accountHolderName}
                      onChange={(e) =>
                        handleUpdateField('accountHolderName', e.target.value)
                      }
                      placeholder="Isi atas nama rekening..."
                      className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </div>
                </div>

                {/* Galeri QRIS Upload */}
                <div
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {paymentProfile.qrisImageDataUrl ? (
                      <img
                        src={paymentProfile.qrisImageDataUrl}
                        alt="Preview Barcode QRIS"
                        referrerPolicy="no-referrer"
                        className="h-16 w-16 shrink-0 rounded-md border object-contain bg-white p-0.5"
                        style={{ borderColor: 'var(--app-border)' }}
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed"
                        style={{
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)',
                        }}
                      >
                        <QrCode className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-semibold">
                        Gambar Barcode QRIS
                      </div>
                      <p
                        className="text-[11px]"
                        style={{ color: 'var(--app-text-muted)' }}
                      >
                        {paymentProfile.qrisImageDataUrl
                          ? 'Barcode QRIS siap tampil & dicetak di nota.'
                          : 'Pilih gambar barcode QRIS dari galeri HP atau file komputer.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={qrisInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePickQrisFromGallery}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={qrisLoading}
                      onClick={() => qrisInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
                      style={{
                        backgroundColor: 'var(--app-accent)',
                        color: 'var(--app-accent-fg)',
                      }}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      {qrisLoading
                        ? 'Memproses...'
                        : paymentProfile.qrisImageDataUrl
                        ? 'Ganti dari Galeri'
                        : 'Pilih dari Galeri'}
                    </button>
                    {paymentProfile.qrisImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleUpdateField('qrisImageDataUrl', '')}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer whitespace-nowrap"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

                {qrisError && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-300">
                    {qrisError}
                  </div>
                )}

                {/* Identitas Kebun / Toko pada Nota */}
                <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
                    <span>Identitas Kebun di Kepala &amp; Kaki Nota</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      maxLength={120}
                      value={paymentProfile.storeName}
                      onChange={(e) => handleUpdateField('storeName', e.target.value)}
                      placeholder="Nama Kebun / Toko"
                      className="h-8 rounded-lg border px-2.5 text-xs focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                    <input
                      type="text"
                      maxLength={40}
                      value={paymentProfile.storePhone}
                      onChange={(e) => handleUpdateField('storePhone', e.target.value)}
                      placeholder="No. HP / WhatsApp Kebun (opsional)"
                      className="h-8 rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                    <input
                      type="text"
                      maxLength={250}
                      value={paymentProfile.storeAddress}
                      onChange={(e) => handleUpdateField('storeAddress', e.target.value)}
                      placeholder="Alamat singkat kebun (opsional)"
                      className="h-8 rounded-lg border px-2.5 text-xs focus:outline-none"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                        color: 'var(--app-text)',
                      }}
                    />
                    <input
                      type="text"
                      maxLength={250}
                      value={paymentProfile.footerNote}
                      onChange={(e) => handleUpdateField('footerNote', e.target.value)}
                      placeholder="Ucapan bawah nota..."
                      className="h-8 rounded-lg border px-2.5 text-xs focus:outline-none"
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

            {/* Right Preview & Print Column (6 cols) */}
            <div
              className="flex flex-col rounded-xl border overflow-hidden lg:col-span-6"
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
                <span className="text-xs font-bold">Pratinjau Nota Siap Cetak</span>
                <div
                  className="flex items-center gap-1 rounded-lg p-1"
                  style={{ backgroundColor: 'var(--app-surface-muted)' }}
                >
                  <button
                    type="button"
                    onClick={() => setPaperFormat('thermal80')}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor:
                        paperFormat === 'thermal80'
                          ? 'var(--app-surface)'
                          : 'transparent',
                      color:
                        paperFormat === 'thermal80'
                          ? 'var(--app-accent)'
                          : 'var(--app-text-muted)',
                    }}
                  >
                    Struk 58/80mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperFormat('a4')}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor:
                        paperFormat === 'a4' ? 'var(--app-surface)' : 'transparent',
                      color:
                        paperFormat === 'a4'
                          ? 'var(--app-accent)'
                          : 'var(--app-text-muted)',
                    }}
                  >
                    Nota A4 / A5
                  </button>
                </div>
              </div>

              {/* Scrollable Preview Sheet */}
              <div className="flex-1 overflow-auto p-3 sm:p-4 max-h-[52vh] lg:max-h-[56vh]">
                <PrintableReceipt
                  receipt={builtReceipt}
                  paymentProfile={paymentProfile}
                  previewMode
                />
              </div>

              {/* Print Actions Bar */}
              <div
                className="border-t p-3.5 space-y-2.5"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                }}
              >
                <button
                  type="button"
                  onClick={handlePrintPdfOrSystem}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--app-accent)',
                    color: 'var(--app-accent-fg)',
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Print Nota Sendiri / Simpan PDF (Dengan Barcode QRIS)
                </button>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleSerialPrint}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                    }}
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    Thermal Serial / Bluetooth
                  </button>
                  <button
                    type="button"
                    onClick={handleUsbPrint}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                    }}
                  >
                    <Usb className="h-3.5 w-3.5" />
                    Thermal USB OTG
                  </button>
                </div>

                {thermalFeedback && (
                  <div
                    className={`rounded-lg border p-2 text-xs ${
                      thermalFeedback.ok
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {thermalFeedback.msg}
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

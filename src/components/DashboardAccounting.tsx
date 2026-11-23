import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  Download,
  Eye,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Scale,
  Search,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  EXPENSE_CATEGORY_META,
  EXPENSE_PRESET_OPTIONS,
  SALE_GRADE_OPTIONS,
} from '../constants/themes';
import {
  ExpenseCategory,
  GreenhouseData,
  ProductionExpenseEntry,
  SaleGrade,
  SalePaymentStatus,
  SaleRecord,
  SeasonDocument,
  SelfSalePaymentProfile,
  SelfSaleReceipt,
} from '../types';
import { formatDateShortId, toLocalDateInputValue } from '../utils/dateUtils';
import { BuyerField } from './BuyerField';
import { SelfSaleReceiptModal } from './SelfSaleReceiptModal';

interface DashboardAccountingProps {
  document: SeasonDocument;
  allDocuments: SeasonDocument[];
  gh: GreenhouseData;
  onUpdateGh: (updater: (gh: GreenhouseData) => GreenhouseData) => void;
  paymentProfile: SelfSalePaymentProfile;
  onUpdatePaymentProfile: (next: SelfSalePaymentProfile) => void;
  onPrintReceiptSheet: (receipt: SelfSaleReceipt) => void;
  cloudEmail?: string | null;
  onOpenAccountSync: () => void;
}

type AccountingSubView = 'all' | 'expenses' | 'sales' | 'profit';

function formatRp(amount: number): string {
  const abs = Math.round(Math.abs(amount));
  const prefix = amount < 0 ? '-Rp ' : 'Rp ';
  return `${prefix}${abs.toLocaleString('id-ID')}`;
}

function formatCompactRp(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}rb`;
  return `${sign}${Math.round(abs)}`;
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function extractYear(dateStr: string | undefined, fallbackIso: string): string {
  if (dateStr && /^\d{4}/.test(dateStr)) {
    return dateStr.slice(0, 4);
  }
  if (fallbackIso && /^\d{4}/.test(fallbackIso)) {
    return fallbackIso.slice(0, 4);
  }
  return String(new Date().getFullYear());
}

interface GroupedBarDatum {
  key: string;
  label: string;
  subLabel?: string;
  expense: number;
  sales: number;
  profit: number;
  weightKg: number;
}

interface GroupedFinancialChartProps {
  data: GroupedBarDatum[];
  emptyMessage: string;
}

const GroupedFinancialChart: React.FC<GroupedFinancialChartProps> = ({
  data,
  emptyMessage,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-10 text-center text-xs"
        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
      >
        {emptyMessage}
      </div>
    );
  }

  const maxAbsVal = Math.max(
    100_000,
    ...data.flatMap((d) => [d.expense, d.sales, Math.abs(d.profit)])
  );
  const svgHeight = 250;
  const padTop = 18;
  const padBottom = 46;
  const padLeft = 56;
  const padRight = 16;
  const groupWidth = Math.max(82, Math.min(130, Math.floor(680 / Math.max(1, data.length))));
  const svgWidth = Math.max(540, padLeft + padRight + data.length * groupWidth);
  const plotHeight = svgHeight - padTop - padBottom;
  const barWidth = Math.min(22, Math.floor((groupWidth - 22) / 3));

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="space-y-2.5">
      {/* Legend & Hover Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            <span>Biaya Produksi</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" />
            <span>Penjualan</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
            <span>Keuntungan (+ / - merah)</span>
          </span>
        </div>
        {hovered && (
          <div
            className="rounded-md border px-2.5 py-1 text-[11px] font-mono-tabular"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <strong>{hovered.label}</strong>: Biaya {formatRp(hovered.expense)} · Jual{' '}
            {formatRp(hovered.sales)} · Laba{' '}
            <span className={hovered.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
              {formatRp(hovered.profit)}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[500px] h-[230px]"
          role="img"
          aria-label="Grafik perbandingan biaya produksi, penjualan, dan keuntungan"
        >
          {/* Horizontal grid lines */}
          {yTicks.map((ratio) => {
            const val = maxAbsVal * ratio;
            const y = padTop + plotHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="var(--app-border)"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--app-text-muted)"
                  className="font-mono-tabular"
                >
                  {formatCompactRp(val)}
                </text>
              </g>
            );
          })}

          {/* Grouped Bars */}
          {data.map((d, idx) => {
            const groupX = padLeft + idx * groupWidth;
            const centerX = groupX + groupWidth / 2;
            const barsTotalW = barWidth * 3 + 8;
            const startX = centerX - barsTotalW / 2;

            const hExp = Math.max(d.expense > 0 ? 3 : 0, (d.expense / maxAbsVal) * plotHeight);
            const hSale = Math.max(d.sales > 0 ? 3 : 0, (d.sales / maxAbsVal) * plotHeight);
            const hProf = Math.max(
              d.profit !== 0 ? 3 : 0,
              (Math.abs(d.profit) / maxAbsVal) * plotHeight
            );
            const baseY = padTop + plotHeight;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={d.key}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {isHovered && (
                  <rect
                    x={groupX + 3}
                    y={padTop - 4}
                    width={groupWidth - 6}
                    height={plotHeight + 8}
                    rx={6}
                    fill="var(--app-accent-soft)"
                  />
                )}
                {/* Expense Bar */}
                <rect
                  x={startX}
                  y={baseY - hExp}
                  width={barWidth}
                  height={hExp}
                  rx={3}
                  fill="#D97706"
                />
                {/* Sales Bar */}
                <rect
                  x={startX + barWidth + 4}
                  y={baseY - hSale}
                  width={barWidth}
                  height={hSale}
                  rx={3}
                  fill="#0284C7"
                />
                {/* Profit Bar */}
                <rect
                  x={startX + (barWidth + 4) * 2}
                  y={baseY - hProf}
                  width={barWidth}
                  height={hProf}
                  rx={3}
                  fill={d.profit >= 0 ? '#16A34A' : '#DC2626'}
                />
                {/* X-axis label */}
                <text
                  x={centerX}
                  y={baseY + 15}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={isHovered ? '700' : '600'}
                  fill="var(--app-text)"
                >
                  {d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label}
                </text>
                {d.subLabel && (
                  <text
                    x={centerX}
                    y={baseY + 28}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--app-text-muted)"
                    className="font-mono-tabular"
                  >
                    {d.subLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const DashboardAccounting: React.FC<DashboardAccountingProps> = ({
  document: activeDoc,
  allDocuments,
  gh,
  onUpdateGh,
  paymentProfile,
  onUpdatePaymentProfile,
  onPrintReceiptSheet,
  cloudEmail,
  onOpenAccountSync,
}) => {
  const [subView, setSubView] = useState<AccountingSubView>('all');

  // === NOTA JUAL SENDIRI MODAL STATE ===
  const [notaModalState, setNotaModalState] = useState<{
    open: boolean;
    initialSale?: SaleRecord | null;
    initialDraft?: {
      date: string;
      weightKg: number;
      pricePerKg: number;
      buyer: string;
      notes: string;
      paymentStatus?: SalePaymentStatus;
    } | null;
  }>({ open: false, initialSale: null, initialDraft: null });

  // === DASHBOARD 1: BIAYA PRODUKSI STATE ===
  const expenses = useMemo(() => gh.expenses || [], [gh.expenses]);
  const [expDate, setExpDate] = useState(() => toLocalDateInputValue());
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('pupuk');
  const [expPreset, setExpPreset] = useState<string>(EXPENSE_PRESET_OPTIONS.pupuk[0].name);
  const [expManualName, setExpManualName] = useState('');
  const [expQtyDraft, setExpQtyDraft] = useState('1');
  const [expUnit, setExpUnit] = useState(EXPENSE_PRESET_OPTIONS.pupuk[0].defaultUnit);
  const [expWorkHoursDraft, setExpWorkHoursDraft] = useState('');
  const [expUnitPriceDraft, setExpUnitPriceDraft] = useState('');
  const [expTotalDraft, setExpTotalDraft] = useState('');
  const [expTotalManualOverride, setExpTotalManualOverride] = useState(false);
  const [expNotes, setExpNotes] = useState('');

  const [expCatFilter, setExpCatFilter] = useState<'all' | ExpenseCategory>('all');
  const [expDateFilter, setExpDateFilter] = useState('');
  const [expSearch, setExpSearch] = useState('');
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [confirmClearExp, setConfirmClearExp] = useState(false);

  // === DASHBOARD 2: PENJUALAN STATE ===
  const sales = useMemo(() => gh.sales || [], [gh.sales]);
  const [saleDate, setSaleDate] = useState(() => toLocalDateInputValue());
  const [saleGrade, setSaleGrade] = useState<SaleGrade>('Grade A');
  const [saleWeightDraft, setSaleWeightDraft] = useState('');
  const [salePriceDraft, setSalePriceDraft] = useState('');
  const [saleTotalDraft, setSaleTotalDraft] = useState('');
  const [saleTotalManualOverride, setSaleTotalManualOverride] = useState(false);
  const [saleBuyer, setSaleBuyer] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [salePaymentStatus, setSalePaymentStatus] = useState<SalePaymentStatus>('belum_dibayar');

  const [saleGradeFilter, setSaleGradeFilter] = useState<'all' | SaleGrade>('all');
  const [saleDateFilter, setSaleDateFilter] = useState('');
  const [saleSearch, setSaleSearch] = useState('');
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [confirmClearSales, setConfirmClearSales] = useState(false);
  const [selfPayFilter, setSelfPayFilter] = useState<'all' | SalePaymentStatus>('all');
  const [buyerPreviewSaleId, setBuyerPreviewSaleId] = useState<string | null>(null);

  // === DASHBOARD 3: KEUNTUNGAN & GRAFIK STATE ===
  const [profitScope, setProfitScope] = useState<'gh' | 'season'>('gh');
  const [periodChartMode, setPeriodChartMode] = useState<'seasons' | 'greenhouses'>('seasons');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('');

  // Helpers when changing category / preset in Expense form
  const handleSelectExpenseCategory = (cat: ExpenseCategory) => {
    setExpCategory(cat);
    const first = EXPENSE_PRESET_OPTIONS[cat][0];
    if (first) {
      setExpPreset(first.name);
      setExpUnit(first.defaultUnit);
    } else {
      setExpPreset('__manual__');
      setExpUnit(EXPENSE_CATEGORY_META[cat].defaultUnit);
    }
  };

  const handleSelectExpensePreset = (presetVal: string) => {
    setExpPreset(presetVal);
    if (presetVal !== '__manual__') {
      const found = EXPENSE_PRESET_OPTIONS[expCategory].find((o) => o.name === presetVal);
      if (found) {
        setExpUnit(found.defaultUnit);
      }
    }
  };

  const recomputeExpenseTotal = (qtyStr: string, priceStr: string, manualOverride: boolean) => {
    if (manualOverride) return;
    const q = Number(qtyStr);
    const p = Number(priceStr);
    if (!Number.isNaN(q) && !Number.isNaN(p) && q >= 0 && p >= 0 && priceStr.trim() !== '') {
      setExpTotalDraft(String(Math.round(q * p)));
    } else if (priceStr.trim() === '') {
      setExpTotalDraft('');
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedName =
      expPreset === '__manual__' ? expManualName.trim() : expPreset.trim();
    if (!resolvedName) return;

    const quantity = Math.max(0, Number(expQtyDraft) || 0);
    const unitPrice = Math.max(0, Number(expUnitPriceDraft) || 0);
    const computedTotal = Math.round(quantity * unitPrice);
    const totalCost =
      expTotalDraft.trim() !== '' && !Number.isNaN(Number(expTotalDraft))
        ? Math.max(0, Math.round(Number(expTotalDraft)))
        : computedTotal;

    const parsedHours = Number(expWorkHoursDraft);
    const workHours =
      expWorkHoursDraft.trim() !== '' && !Number.isNaN(parsedHours) && parsedHours >= 0
        ? Number(parsedHours.toFixed(2))
        : undefined;

    const newItem: ProductionExpenseEntry = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: expDate || toLocalDateInputValue(),
      category: expCategory,
      itemName: resolvedName,
      quantity,
      unit: expUnit.trim() || EXPENSE_CATEGORY_META[expCategory].defaultUnit,
      ...(workHours !== undefined ? { workHours } : {}),
      unitPrice,
      totalCost,
      notes: expNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    onUpdateGh((prev) => ({
      ...prev,
      expenses: [newItem, ...(prev.expenses || [])],
    }));

    setExpManualName('');
    setExpQtyDraft('1');
    setExpWorkHoursDraft('');
    setExpUnitPriceDraft('');
    setExpTotalDraft('');
    setExpTotalManualOverride(false);
    setExpNotes('');
  };

  const handleDeleteExpense = (id: string) => {
    onUpdateGh((prev) => ({
      ...prev,
      expenses: (prev.expenses || []).filter((item) => item.id !== id),
    }));
    setSelectedExpIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDeleteSelectedExpenses = () => {
    if (selectedExpIds.length === 0) return;
    const idSet = new Set(selectedExpIds);
    onUpdateGh((prev) => ({
      ...prev,
      expenses: (prev.expenses || []).filter((item) => !idSet.has(item.id)),
    }));
    setSelectedExpIds([]);
  };

  const handleClearAllExpenses = () => {
    onUpdateGh((prev) => ({ ...prev, expenses: [] }));
    setSelectedExpIds([]);
    setConfirmClearExp(false);
  };

  // Filtered expenses & totals
  const filteredExpenses = useMemo(() => {
    const q = expSearch.trim().toLowerCase();
    return expenses
      .filter((item) => {
        if (expCatFilter !== 'all' && item.category !== expCatFilter) return false;
        if (expDateFilter && item.date !== expDateFilter) return false;
        if (
          q &&
          !String(item.itemName || '').toLowerCase().includes(q) &&
          !String(item.notes || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [expenses, expCatFilter, expDateFilter, expSearch]);

  const expenseTotalsByCategory = useMemo(() => {
    const map: Record<ExpenseCategory, number> = {
      pupuk: 0,
      fungisida: 0,
      insektisida: 0,
      tenaga_kerja: 0,
      lainnya: 0,
    };
    let grand = 0;
    let totalWorkHours = 0;
    for (const e of expenses) {
      const cat = map[e.category] !== undefined ? e.category : 'lainnya';
      map[cat] = (map[cat] || 0) + (e.totalCost || 0);
      grand += e.totalCost || 0;
      if (typeof e.workHours === 'number' && !Number.isNaN(e.workHours)) {
        totalWorkHours += e.workHours;
      }
    }
    return { byCat: map, grand, totalWorkHours };
  }, [expenses]);

  const handleExportExpensesCsv = () => {
    const headers = [
      'Tanggal',
      'Greenhouse',
      'Kategori',
      'Nama Item',
      'Jumlah',
      'Satuan',
      'Jam Kerja (jam)',
      'Harga Satuan (Rp)',
      'Total Biaya (Rp)',
      'Catatan',
    ];
    const rows = filteredExpenses.map((e) => [
      e.date,
      gh.name,
      EXPENSE_CATEGORY_META[e.category]?.short || e.category,
      e.itemName,
      e.quantity,
      e.unit,
      typeof e.workHours === 'number' ? e.workHours : '',
      e.unitPrice,
      e.totalCost,
      e.notes,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsvCell).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biaya-produksi-${gh.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === SALES HANDLERS ===
  const recomputeSaleTotal = (wStr: string, pStr: string, manualOverride: boolean) => {
    if (manualOverride) return;
    const w = Number(wStr);
    const p = Number(pStr);
    if (!Number.isNaN(w) && !Number.isNaN(p) && w >= 0 && p >= 0 && wStr.trim() !== '' && pStr.trim() !== '') {
      setSaleTotalDraft(String(Math.round(w * p)));
    } else if (wStr.trim() === '' || pStr.trim() === '') {
      setSaleTotalDraft('');
    }
  };

  const handleAddSale = (e: React.FormEvent) => {
    e.preventDefault();
    const weightKg = Math.max(0, Number(saleWeightDraft) || 0);
    const pricePerKg = Math.max(0, Number(salePriceDraft) || 0);
    const computed = Math.round(weightKg * pricePerKg);
    const totalAmount =
      saleTotalDraft.trim() !== '' && !Number.isNaN(Number(saleTotalDraft))
        ? Math.max(0, Math.round(Number(saleTotalDraft)))
        : computed;

    if (weightKg <= 0 && totalAmount <= 0) return;

    const effectivePrice =
      pricePerKg > 0 ? pricePerKg : weightKg > 0 ? Math.round(totalAmount / weightKg) : 0;

    const newSale: SaleRecord = {
      id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: saleDate || toLocalDateInputValue(),
      grade: saleGrade,
      weightKg,
      pricePerKg: effectivePrice,
      totalAmount,
      buyer: saleBuyer.trim(),
      notes: saleNotes.trim(),
      ...(saleGrade === 'Jual sendiri' ? { paymentStatus: salePaymentStatus } : {}),
      createdAt: new Date().toISOString(),
    };

    onUpdateGh((prev) => ({
      ...prev,
      sales: [newSale, ...(prev.sales || [])],
    }));

    setSaleWeightDraft('');
    setSalePriceDraft('');
    setSaleTotalDraft('');
    setSaleTotalManualOverride(false);
    setSaleBuyer('');
    setSaleNotes('');
    setSalePaymentStatus('belum_dibayar');
  };

  const handleToggleSalePaymentStatus = (saleId: string) => {
    onUpdateGh((prev) => ({
      ...prev,
      sales: (prev.sales || []).map((item) => {
        if (item.id !== saleId) return item;
        const current: SalePaymentStatus = item.paymentStatus || 'belum_dibayar';
        return {
          ...item,
          paymentStatus: current === 'sudah_dibayar' ? 'belum_dibayar' : 'sudah_dibayar',
        };
      }),
    }));
  };

  const handleSaveSaleFromReceipt = (sale: SaleRecord, isUpdate?: boolean) => {
    onUpdateGh((prev) => {
      const current = prev.sales || [];
      if (isUpdate || current.some((item) => item.id === sale.id)) {
        return {
          ...prev,
          sales: current.map((item) => (item.id === sale.id ? sale : item)),
        };
      }
      return {
        ...prev,
        sales: [sale, ...current],
      };
    });
  };

  const handleOpenNotaFromForm = () => {
    const w = Math.max(0, Number(saleWeightDraft) || 0);
    const p = Math.max(0, Number(salePriceDraft) || 0);
    const tot = Math.max(0, Number(saleTotalDraft) || 0);
    const resolvedPrice = p > 0 ? p : w > 0 && tot > 0 ? Math.round(tot / w) : 0;
    setNotaModalState({
      open: true,
      initialSale: null,
      initialDraft: {
        date: saleDate || toLocalDateInputValue(),
        weightKg: w,
        pricePerKg: resolvedPrice,
        buyer: saleBuyer.trim(),
        notes: saleNotes.trim(),
        paymentStatus: salePaymentStatus,
      },
    });
  };

  const handleDeleteSale = (id: string) => {
    onUpdateGh((prev) => ({
      ...prev,
      sales: (prev.sales || []).filter((item) => item.id !== id),
    }));
    setSelectedSaleIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDeleteSelectedSales = () => {
    if (selectedSaleIds.length === 0) return;
    const idSet = new Set(selectedSaleIds);
    onUpdateGh((prev) => ({
      ...prev,
      sales: (prev.sales || []).filter((item) => !idSet.has(item.id)),
    }));
    setSelectedSaleIds([]);
  };

  const handleClearAllSales = () => {
    onUpdateGh((prev) => ({ ...prev, sales: [] }));
    setSelectedSaleIds([]);
    setConfirmClearSales(false);
  };

  const filteredSales = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    return sales
      .filter((s) => {
        if (saleGradeFilter !== 'all' && s.grade !== saleGradeFilter) return false;
        if (saleDateFilter && s.date !== saleDateFilter) return false;
        if (
          q &&
          !String(s.grade || '').toLowerCase().includes(q) &&
          !String(s.buyer || '').toLowerCase().includes(q) &&
          !String(s.notes || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [sales, saleGradeFilter, saleDateFilter, saleSearch]);

  const salesSummary = useMemo(() => {
    let totalWeightKg = 0;
    let totalRevenueRp = 0;
    const byGrade: Record<SaleGrade, { weightKg: number; revenueRp: number; count: number }> = {
      'Grade A': { weightKg: 0, revenueRp: 0, count: 0 },
      'Grade B': { weightKg: 0, revenueRp: 0, count: 0 },
      'Grade C': { weightKg: 0, revenueRp: 0, count: 0 },
      'Grade D': { weightKg: 0, revenueRp: 0, count: 0 },
      Plonco: { weightKg: 0, revenueRp: 0, count: 0 },
      'Jual sendiri': { weightKg: 0, revenueRp: 0, count: 0 },
    };

    for (const s of sales) {
      totalWeightKg += s.weightKg || 0;
      totalRevenueRp += s.totalAmount || 0;
      const bucket = byGrade[s.grade];
      if (bucket) {
        bucket.weightKg += s.weightKg || 0;
        bucket.revenueRp += s.totalAmount || 0;
        bucket.count += 1;
      }
    }

    const avgPricePerKg = totalWeightKg > 0 ? totalRevenueRp / totalWeightKg : 0;
    return { totalWeightKg, totalRevenueRp, avgPricePerKg, byGrade };
  }, [sales]);

  const selfSalesTracker = useMemo(() => {
    const allSelf = sales
      .filter((s) => s.grade === 'Jual sendiri')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    let unpaidCount = 0;
    let unpaidWeightKg = 0;
    let unpaidAmountRp = 0;
    let paidCount = 0;
    let paidWeightKg = 0;
    let paidAmountRp = 0;

    for (const s of allSelf) {
      const status: SalePaymentStatus = s.paymentStatus || 'belum_dibayar';
      if (status === 'sudah_dibayar') {
        paidCount += 1;
        paidWeightKg += s.weightKg || 0;
        paidAmountRp += s.totalAmount || 0;
      } else {
        unpaidCount += 1;
        unpaidWeightKg += s.weightKg || 0;
        unpaidAmountRp += s.totalAmount || 0;
      }
    }

    const filtered = allSelf.filter((s) => {
      const status: SalePaymentStatus = s.paymentStatus || 'belum_dibayar';
      if (selfPayFilter !== 'all' && status !== selfPayFilter) return false;
      const q = saleSearch.trim().toLowerCase();
      if (
        q &&
        !String(s.buyer || '').toLowerCase().includes(q) &&
        !String(s.notes || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return {
      allSelf,
      filtered,
      unpaidCount,
      unpaidWeightKg,
      unpaidAmountRp,
      paidCount,
      paidWeightKg,
      paidAmountRp,
    };
  }, [sales, selfPayFilter, saleSearch]);

  const buyerPreviewSale = useMemo(
    () => sales.find((s) => s.id === buyerPreviewSaleId) || null,
    [sales, buyerPreviewSaleId]
  );

  const handleExportSalesCsv = () => {
    const headers = [
      'Tanggal',
      'Greenhouse',
      'Grade',
      'Berat (kg)',
      'Harga per kg (Rp)',
      'Total Uang (Rp)',
      'Pembeli / Saluran',
      'Status Pembayaran',
      'Catatan',
    ];
    const rows = filteredSales.map((s) => [
      s.date,
      gh.name,
      s.grade,
      s.weightKg,
      s.pricePerKg,
      s.totalAmount,
      s.buyer,
      s.grade === 'Jual sendiri' || s.paymentStatus
        ? (s.paymentStatus || 'belum_dibayar') === 'sudah_dibayar'
          ? 'Sudah Dibayar'
          : 'Belum Dibayar'
        : '-',
      s.notes,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsvCell).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `penjualan-melon-${gh.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === DASHBOARD 3: KEUNTUNGAN, PERIODE PANEN & TAHUNAN ===
  const profitSummary = useMemo(() => {
    const targetGhs = profitScope === 'gh' ? [gh] : activeDoc.greenhouses;
    let totalExp = 0;
    let totalSale = 0;
    let totalKg = 0;
    for (const g of targetGhs) {
      for (const e of g.expenses || []) totalExp += e.totalCost || 0;
      for (const s of g.sales || []) {
        totalSale += s.totalAmount || 0;
        totalKg += s.weightKg || 0;
      }
    }
    const netProfit = totalSale - totalExp;
    const marginPct = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;
    const hppPerKg = totalKg > 0 ? totalExp / totalKg : 0;
    const avgSellPerKg = totalKg > 0 ? totalSale / totalKg : 0;
    return { totalExp, totalSale, totalKg, netProfit, marginPct, hppPerKg, avgSellPerKg };
  }, [profitScope, gh, activeDoc.greenhouses]);

  const periodChartData = useMemo<GroupedBarDatum[]>(() => {
    if (periodChartMode === 'greenhouses') {
      return activeDoc.greenhouses.map((g) => {
        const exp = (g.expenses || []).reduce((acc, e) => acc + (e.totalCost || 0), 0);
        const sal = (g.sales || []).reduce((acc, s) => acc + (s.totalAmount || 0), 0);
        const kg = (g.sales || []).reduce((acc, s) => acc + (s.weightKg || 0), 0);
        return {
          key: g.id,
          label: g.name,
          subLabel: `${kg.toLocaleString('id-ID')} kg`,
          expense: exp,
          sales: sal,
          profit: sal - exp,
          weightKg: kg,
        };
      });
    }

    const sortedDocs = [...allDocuments].sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );
    return sortedDocs.map((docItem, idx) => {
      let exp = 0;
      let sal = 0;
      let kg = 0;
      for (const g of docItem.greenhouses) {
        for (const e of g.expenses || []) exp += e.totalCost || 0;
        for (const s of g.sales || []) {
          sal += s.totalAmount || 0;
          kg += s.weightKg || 0;
        }
      }
      const harvestDates = docItem.greenhouses
        .map((g) => g.harvestDate)
        .filter((d): d is string => Boolean(d));
      const periodSub = harvestDates[0]
        ? `Panen ${formatDateShortId(harvestDates[0])}`
        : `${kg.toLocaleString('id-ID')} kg`;
      return {
        key: docItem.id,
        label: docItem.title || `Periode ${idx + 1}`,
        subLabel: periodSub,
        expense: exp,
        sales: sal,
        profit: sal - exp,
        weightKg: kg,
      };
    });
  }, [periodChartMode, activeDoc.greenhouses, allDocuments]);

  const annualChartBundle = useMemo(() => {
    const yearMap = new Map<string, { exp: number; sal: number; kg: number }>();
    const monthlyByYear = new Map<string, Array<{ exp: number; sal: number; kg: number }>>();

    const ensureYear = (yr: string) => {
      if (!yearMap.has(yr)) {
        yearMap.set(yr, { exp: 0, sal: 0, kg: 0 });
      }
      if (!monthlyByYear.has(yr)) {
        monthlyByYear.set(
          yr,
          Array.from({ length: 12 }, () => ({ exp: 0, sal: 0, kg: 0 }))
        );
      }
    };

    const extractMonthIdx = (dateStr: string | undefined, fallbackIso: string | undefined): number => {
      if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
        const parsed = parseInt(dateStr.slice(5, 7), 10) - 1;
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.min(11, parsed));
        }
      }
      const d = fallbackIso ? new Date(fallbackIso) : new Date();
      const m = d.getMonth();
      return Number.isFinite(m) && m >= 0 && m <= 11 ? m : new Date().getMonth();
    };

    for (const docItem of allDocuments) {
      for (const g of docItem.greenhouses) {
        for (const e of g.expenses || []) {
          const yr = extractYear(e.date, docItem.createdAt);
          ensureYear(yr);
          yearMap.get(yr)!.exp += e.totalCost || 0;
          const mIdx = extractMonthIdx(e.date, docItem.createdAt);
          monthlyByYear.get(yr)![mIdx].exp += e.totalCost || 0;
        }
        for (const s of g.sales || []) {
          const yr = extractYear(s.date, docItem.createdAt);
          ensureYear(yr);
          yearMap.get(yr)!.sal += s.totalAmount || 0;
          yearMap.get(yr)!.kg += s.weightKg || 0;
          const mIdx = extractMonthIdx(s.date, docItem.createdAt);
          monthlyByYear.get(yr)![mIdx].sal += s.totalAmount || 0;
          monthlyByYear.get(yr)![mIdx].kg += s.weightKg || 0;
        }
      }
    }

    const years = [...yearMap.keys()].sort();
    const annualBars: GroupedBarDatum[] = years.map((yr) => {
      const b = yearMap.get(yr)!;
      return {
        key: yr,
        label: `Tahun ${yr}`,
        subLabel: `${b.kg.toLocaleString('id-ID')} kg`,
        expense: b.exp,
        sales: b.sal,
        profit: b.sal - b.exp,
        weightKg: b.kg,
      };
    });

    const activeYear =
      selectedYearFilter && yearMap.has(selectedYearFilter)
        ? selectedYearFilter
        : years[years.length - 1] || String(new Date().getFullYear());

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const rawMonthly = monthlyByYear.get(activeYear) || [];
    const monthlyBars: GroupedBarDatum[] = rawMonthly
      .map((m, idx) => ({
        key: `${activeYear}-${idx + 1}`,
        label: MONTH_NAMES[idx],
        subLabel: m.kg > 0 ? `${m.kg.toLocaleString('id-ID')}kg` : undefined,
        expense: m.exp,
        sales: m.sal,
        profit: m.sal - m.exp,
        weightKg: m.kg,
      }))
      .filter((m) => m.expense > 0 || m.sales > 0);

    return { years, activeYear, annualBars, monthlyBars };
  }, [allDocuments, selectedYearFilter]);

  const showD1 = subView === 'all' || subView === 'expenses';
  const showD2 = subView === 'all' || subView === 'sales';
  const showD3 = subView === 'all' || subView === 'profit';

  return (
    <div className="space-y-6">
      {/* Sub-Dashboard Switcher inside Pembukuan Melon */}
      <section
        className="rounded-xl border p-4 sm:px-5 sm:py-4"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span style={{ color: 'var(--app-accent)' }}>
                Pembukuan Melon · {gh.name} ({gh.variety})
              </span>
              <span aria-hidden="true" style={{ color: 'var(--app-text-muted)' }}>·</span>
              <button
                type="button"
                onClick={onOpenAccountSync}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: cloudEmail ? '#16A34A' : 'var(--app-border)',
                  backgroundColor: cloudEmail ? 'rgba(22, 163, 74, 0.1)' : 'var(--app-surface-muted)',
                  color: cloudEmail ? '#15803D' : 'var(--app-text)',
                }}
              >
                {cloudEmail ? (
                  <>
                    <Cloud className="h-3 w-3" />
                    Sync Akun Google: {cloudEmail}
                  </>
                ) : (
                  <>
                    <CloudOff className="h-3 w-3" />
                    Hubungkan Sync Akun Google
                  </>
                )}
              </button>
            </div>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold tracking-tight">
              Dashboard Pembukuan: Biaya Produksi, Penjualan &amp; Keuntungan
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              Dashboard 1, 2, dan 3 tampil sekaligus dalam Pembukuan Melon atau pilih salah satu untuk fokus pengisian.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 rounded-lg p-1"
            style={{ backgroundColor: 'var(--app-surface-muted)' }}
          >
            {(
              [
                { id: 'all', label: 'Semua (1–3)' },
                { id: 'expenses', label: 'Dashboard 1: Biaya Produksi' },
                { id: 'sales', label: 'Dashboard 2: Penjualan' },
                { id: 'profit', label: 'Dashboard 3: Keuntungan & Grafik' },
              ] as Array<{ id: AccountingSubView; label: string }>
            ).map((tab) => {
              const active = subView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubView(tab.id)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--app-surface)' : 'transparent',
                    color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* DASHBOARD 1: BIAYA PRODUKSI                              */}
      {/* ======================================================= */}
      {showD1 && (
        <section
          className="rounded-xl border p-4 sm:p-5 space-y-5"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  backgroundColor: 'var(--app-accent-soft)',
                  color: 'var(--app-accent)',
                }}
              >
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold">
                  Dashboard 1 — Biaya Produksi ({gh.name})
                </h3>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  Pupuk, Fungisida, Insektisida, Tenaga Kerja (orang &amp; jam kerja), serta Benih, AB MIX, Mulsa, Cocopeat &amp; Flanel.
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Total Biaya Produksi ({gh.name})
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono-tabular text-amber-600 dark:text-amber-400">
                {formatRp(expenseTotalsByCategory.grand)}
              </div>
            </div>
          </div>

          {/* 5 Category Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).map((cat) => {
              const meta = EXPENSE_CATEGORY_META[cat];
              const total = expenseTotalsByCategory.byCat[cat] || 0;
              const pct =
                expenseTotalsByCategory.grand > 0
                  ? ((total / expenseTotalsByCategory.grand) * 100).toFixed(1)
                  : '0.0';
              const active = expCatFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setExpCatFilter(active ? 'all' : cat)}
                  className="rounded-xl border p-3 text-left transition-colors cursor-pointer"
                  style={{
                    borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                    backgroundColor: active ? 'var(--app-accent-soft)' : 'var(--app-canvas)',
                  }}
                >
                  <div className="text-xs font-semibold truncate">{meta.label}</div>
                  <div className="mt-1 text-base font-bold font-mono-tabular">
                    {formatRp(total)}
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                    {pct}% dari biaya
                    {cat === 'tenaga_kerja' && expenseTotalsByCategory.totalWorkHours > 0
                      ? ` · ${expenseTotalsByCategory.totalWorkHours.toLocaleString('id-ID')} jam`
                      : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Add Expense Form */}
          <form
            onSubmit={handleAddExpense}
            className="rounded-xl border p-4 space-y-3.5"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="text-xs font-bold flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
              <span>Input Pengeluaran / Biaya Produksi</span>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).map((cat) => {
                const active = expCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectExpenseCategory(cat)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    style={{
                      borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                      backgroundColor: active ? 'var(--app-accent)' : 'var(--app-surface)',
                      color: active ? 'var(--app-accent-fg)' : 'var(--app-text)',
                    }}
                  >
                    {EXPENSE_CATEGORY_META[cat].label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="block text-[11px] font-medium mb-1">Tanggal</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium mb-1">
                  Pilihan {EXPENSE_CATEGORY_META[expCategory].short} / Item
                </label>
                <select
                  value={expPreset}
                  onChange={(e) => handleSelectExpensePreset(e.target.value)}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-medium focus:outline-none cursor-pointer"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                >
                  {EXPENSE_PRESET_OPTIONS[expCategory].map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {opt.name} ({opt.defaultUnit})
                    </option>
                  ))}
                  <option value="__manual__">+ Isi Nama Manual...</option>
                </select>
              </div>

              {expPreset === '__manual__' && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-[11px] font-medium mb-1">Nama Item Manual</label>
                  <input
                    type="text"
                    required
                    value={expManualName}
                    onChange={(e) => setExpManualName(e.target.value)}
                    placeholder={`Tulis nama ${EXPENSE_CATEGORY_META[expCategory].short.toLowerCase()} manual...`}
                    className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium mb-1">Jumlah</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  placeholder="0"
                  value={expQtyDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setExpQtyDraft(val);
                    recomputeExpenseTotal(val, expUnitPriceDraft, expTotalManualOverride);
                  }}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Satuan</label>
                <input
                  type="text"
                  value={expUnit}
                  onChange={(e) => setExpUnit(e.target.value)}
                  placeholder="SET / kg / orang"
                  className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Jam Kerja (jam)</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  placeholder={expCategory === 'tenaga_kerja' ? 'Misal: 8' : 'Opsional'}
                  value={expWorkHoursDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => setExpWorkHoursDraft(e.target.value)}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Harga Satuan (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={expUnitPriceDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setExpUnitPriceDraft(val);
                    recomputeExpenseTotal(expQtyDraft, val, expTotalManualOverride);
                  }}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Total Biaya (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={expTotalDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    setExpTotalManualOverride(e.target.value.trim() !== '');
                    setExpTotalDraft(e.target.value);
                  }}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-bold font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-medium mb-1">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Keterangan toko / batch pemakaian..."
                  className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--app-accent)',
                    color: 'var(--app-accent-fg)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Biaya
                </button>
              </div>
            </div>
          </form>

          {/* Filter & Bulk Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--app-text-muted)' }}
                />
                <input
                  type="text"
                  value={expSearch}
                  onChange={(e) => setExpSearch(e.target.value)}
                  placeholder="Cari nama item / catatan..."
                  className="h-8 rounded-lg border pl-8 pr-2.5 text-xs focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <select
                aria-label="Filter kategori biaya"
                value={expCatFilter}
                onChange={(e) => setExpCatFilter(e.target.value as 'all' | ExpenseCategory)}
                className="h-8 rounded-lg border px-2 text-xs cursor-pointer"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              >
                <option value="all">Semua Kategori</option>
                {(Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {EXPENSE_CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>

              <div className="relative flex items-center">
                <Calendar
                  className="pointer-events-none absolute left-2 h-3.5 w-3.5"
                  style={{ color: 'var(--app-text-muted)' }}
                />
                <input
                  type="date"
                  value={expDateFilter}
                  onChange={(e) => setExpDateFilter(e.target.value)}
                  className="h-8 rounded-lg border pl-7 pr-2 text-xs font-mono-tabular"
                  style={{
                    borderColor: expDateFilter ? 'var(--app-accent)' : 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
              {expDateFilter && (
                <button
                  type="button"
                  onClick={() => setExpDateFilter('')}
                  className="h-8 rounded-lg border px-2 text-[11px] cursor-pointer"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                >
                  Semua Tgl
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportExpensesCsv}
                className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium cursor-pointer"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              {selectedExpIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedExpenses}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Dipilih ({selectedExpIds.length})
                </button>
              )}
              {expenses.length > 0 &&
                (!confirmClearExp ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearExp(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Semua
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleClearAllExpenses}
                      className="h-8 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Ya, Kosongkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearExp(false)}
                      className="h-8 rounded-lg border px-2 text-xs cursor-pointer"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      Batal
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Expenses Table */}
          {filteredExpenses.length === 0 ? (
            <div
              className="rounded-lg border border-dashed py-10 text-center text-xs"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            >
              Belum ada catatan biaya produksi yang sesuai filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      backgroundColor: 'var(--app-surface-muted)',
                      borderColor: 'var(--app-border)',
                    }}
                  >
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua biaya tampil"
                        checked={
                          filteredExpenses.length > 0 &&
                          filteredExpenses.every((e) => selectedExpIds.includes(e.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpIds(filteredExpenses.map((x) => x.id));
                          } else {
                            setSelectedExpIds([]);
                          }
                        }}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                    <th className="px-3 py-2.5 font-semibold">Kategori</th>
                    <th className="px-3 py-2.5 font-semibold">Nama Item</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Qty &amp; Satuan</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Jam Kerja</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Harga Satuan</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Total Biaya</th>
                    <th className="px-3 py-2.5 font-semibold">Catatan</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((item) => {
                    const checked = selectedExpIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className="border-b last:border-b-0"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: checked ? 'var(--app-accent-soft)' : 'transparent',
                        }}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${item.itemName}`}
                            checked={checked}
                            onChange={() =>
                              setSelectedExpIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((x) => x !== item.id)
                                  : [...prev, item.id]
                              )
                            }
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono-tabular whitespace-nowrap">
                          {formatDateShortId(item.date)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className="rounded px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: 'var(--app-surface-muted)',
                              color: 'var(--app-text)',
                            }}
                          >
                            {EXPENSE_CATEGORY_META[item.category]?.short || item.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold">{item.itemName}</td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {item.quantity.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {typeof item.workHours === 'number' && item.workHours > 0
                            ? `${item.workHours.toLocaleString('id-ID')} jam`
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {formatRp(item.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold font-mono-tabular whitespace-nowrap">
                          {formatRp(item.totalCost)}
                        </td>
                        <td className="px-3 py-2.5 max-w-[220px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                          {item.notes || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(item.id)}
                            aria-label={`Hapus ${item.itemName}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            style={{ borderColor: 'var(--app-border)' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ======================================================= */}
      {/* DASHBOARD 2: PENJUALAN                                   */}
      {/* ======================================================= */}
      {showD2 && (
        <section
          className="rounded-xl border p-4 sm:p-5 space-y-5"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  backgroundColor: 'var(--app-accent-soft)',
                  color: 'var(--app-accent)',
                }}
              >
                <ShoppingBag className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold">
                  Dashboard 2 — Penjualan Melon ({gh.name})
                </h3>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  Grade A, Grade B, Grade C, Grade D, Plonco, dan Jual sendiri dalam satuan berat (kg) &amp; harga (Rupiah).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setNotaModalState({ open: true, initialSale: null, initialDraft: null })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <QrCode className="h-3.5 w-3.5" />
                Buat &amp; Cetak Nota (Jual Sendiri)
              </button>
              <div className="text-left sm:text-right">
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Total Berat Terjual
                </div>
                <div className="text-lg font-bold font-mono-tabular">
                  {salesSummary.totalWeightKg.toLocaleString('id-ID', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  kg
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Total Uang Penjualan
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400">
                  {formatRp(salesSummary.totalRevenueRp)}
                </div>
              </div>
            </div>
          </div>

          {/* Per-Grade Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SALE_GRADE_OPTIONS.map((opt) => {
              const bucket = salesSummary.byGrade[opt.grade];
              const avgPrice = bucket.weightKg > 0 ? bucket.revenueRp / bucket.weightKg : 0;
              const active = saleGradeFilter === opt.grade;
              return (
                <button
                  key={opt.grade}
                  type="button"
                  onClick={() => setSaleGradeFilter(active ? 'all' : opt.grade)}
                  className="rounded-xl border p-3 text-left transition-colors cursor-pointer"
                  style={{
                    borderColor: active ? opt.badgeColor : 'var(--app-border)',
                    backgroundColor: active ? 'var(--app-surface-muted)' : 'var(--app-canvas)',
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">{opt.grade}</span>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.badgeColor }}
                    />
                  </div>
                  <div className="mt-1.5 text-sm font-bold font-mono-tabular">
                    {bucket.weightKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg
                  </div>
                  <div className="mt-0.5 text-xs font-semibold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                    {formatRp(bucket.revenueRp)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                    {avgPrice > 0 ? `Rata² ${formatRp(avgPrice)}/kg` : 'Belum terjual'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Add Sale Form */}
          <form
            onSubmit={handleAddSale}
            className="rounded-xl border p-4 space-y-3.5"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="text-xs font-bold flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
              <span>Catat Penjualan Melon Baru</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SALE_GRADE_OPTIONS.map((opt) => {
                const active = saleGrade === opt.grade;
                return (
                  <button
                    key={opt.grade}
                    type="button"
                    onClick={() => {
                      setSaleGrade(opt.grade);
                      if (opt.grade === 'Jual sendiri') {
                        setSalePaymentStatus('belum_dibayar');
                      }
                    }}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    style={{
                      borderColor: active ? opt.badgeColor : 'var(--app-border)',
                      backgroundColor: active ? opt.badgeColor : 'var(--app-surface)',
                      color: active ? '#FFFFFF' : 'var(--app-text)',
                    }}
                  >
                    {opt.grade}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-[11px] font-medium mb-1">Tanggal Jual</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Berat (kg)</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  placeholder="0"
                  value={saleWeightDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSaleWeightDraft(val);
                    recomputeSaleTotal(val, salePriceDraft, saleTotalManualOverride);
                  }}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Harga / kg (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={salePriceDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSalePriceDraft(val);
                    recomputeSaleTotal(saleWeightDraft, val, saleTotalManualOverride);
                  }}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">Total Uang (Rp)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={saleTotalDraft}
                  onFocus={(e) => {
                    if (e.currentTarget.value === '0') e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    setSaleTotalManualOverride(e.target.value.trim() !== '');
                    setSaleTotalDraft(e.target.value);
                  }}
                  className="h-9 w-full rounded-lg border px-2.5 text-xs font-bold font-mono-tabular focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <BuyerField
                  id="sale-buyer-input"
                  label="Pembeli / Pasar"
                  value={saleBuyer}
                  onChange={setSaleBuyer}
                  placeholder="Ketik manual (Supermarket / Eceran)..."
                  maxLength={160}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-[11px] font-medium mb-1">Catatan</label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Kualitas / Brix / dll..."
                  className="h-9 w-full rounded-lg border px-2.5 text-xs focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
            </div>

            {saleGrade === 'Jual sendiri' && (
              <div
                className="flex flex-col gap-3 rounded-lg border p-3.5"
                style={{
                  borderColor: 'var(--app-accent)',
                  backgroundColor: 'var(--app-accent-soft)',
                }}
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5 text-xs">
                    <div className="font-bold flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5" style={{ color: 'var(--app-accent)' }} />
                      <span>Opsi Jual Sendiri: Status Bayar, Nota, QRIS &amp; Rekening</span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      {paymentProfile.accountNumber || paymentProfile.qrisImageDataUrl
                        ? `Rekening: ${paymentProfile.bankName || 'Bank'} ${paymentProfile.accountNumber || '-'} (${paymentProfile.accountHolderName || '-'}) · QRIS: ${paymentProfile.qrisImageDataUrl ? 'Sudah ada' : 'Belum dipilih'}`
                        : 'Status awal otomatis Belum Dibayar. Tinggal ubah per pembeli saat sudah lunas.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenNotaFromForm}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      borderColor: 'var(--app-accent)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-accent)',
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Buka Pembuat Nota &amp; QRIS
                  </button>
                </div>

                {/* Pilihan Status Pembayaran Awal (Default: Belum Dibayar) */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="text-xs font-semibold">Status Pembayaran Awal:</span>
                  <div
                    className="flex items-center gap-1 rounded-lg p-1"
                    style={{ backgroundColor: 'var(--app-surface)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSalePaymentStatus('belum_dibayar')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        salePaymentStatus === 'belum_dibayar'
                          ? 'bg-amber-600 text-white'
                          : ''
                      }`}
                      style={
                        salePaymentStatus === 'belum_dibayar'
                          ? undefined
                          : { color: 'var(--app-text-muted)' }
                      }
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Belum Dibayar (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalePaymentStatus('sudah_dibayar')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        salePaymentStatus === 'sudah_dibayar'
                          ? 'bg-emerald-600 text-white'
                          : ''
                      }`}
                      style={
                        salePaymentStatus === 'sudah_dibayar'
                          ? undefined
                          : { color: 'var(--app-text-muted)' }
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sudah Dibayar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                Rata-rata harga terjual saat ini:{' '}
                <strong>{formatRp(salesSummary.avgPricePerKg)}/kg</strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {saleGrade === 'Jual sendiri' && (
                  <button
                    type="button"
                    onClick={handleOpenNotaFromForm}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--app-accent)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-accent)',
                    }}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Buat Nota
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--app-accent)',
                    color: 'var(--app-accent-fg)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Catat Penjualan
                </button>
              </div>
            </div>
          </form>

          {/* ======================================================= */}
          {/* PANEL KHUSUS JUAL SENDIRI: PEMBELI, BERAT BUAH & TAGIHAN */}
          {/* ======================================================= */}
          {(selfSalesTracker.allSelf.length > 0 ||
            saleGrade === 'Jual sendiri' ||
            saleGradeFilter === 'Jual sendiri') && (
            <div
              className="rounded-xl border p-4 space-y-3.5"
              style={{
                borderColor: 'var(--app-accent)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <Receipt className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
                    <span>Daftar Pembeli &amp; Tagihan Jual Sendiri</span>
                  </h4>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                    Menampilkan Pembeli, Berat Buah, dan Total yang Harus Dibayar. Klik status untuk mengubah Belum Dibayar ↔ Sudah Dibayar per pembeli.
                  </p>
                </div>

                <div
                  className="flex flex-wrap items-center gap-1 rounded-lg p-1 self-start sm:self-center"
                  style={{ backgroundColor: 'var(--app-surface-muted)' }}
                >
                  {(
                    [
                      { id: 'all', label: `Semua (${selfSalesTracker.allSelf.length})` },
                      { id: 'belum_dibayar', label: `Belum Dibayar (${selfSalesTracker.unpaidCount})` },
                      { id: 'sudah_dibayar', label: `Sudah Dibayar (${selfSalesTracker.paidCount})` },
                    ] as const
                  ).map((f) => {
                    const active = selfPayFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelfPayFilter(f.id)}
                        className="rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                        style={{
                          backgroundColor: active ? 'var(--app-surface)' : 'transparent',
                          color: active ? 'var(--app-accent)' : 'var(--app-text-muted)',
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ringkasan Belum Dibayar vs Sudah Dibayar */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Belum Dibayar ({selfSalesTracker.unpaidCount} pembeli)
                    </div>
                    <div className="text-[11px] font-mono-tabular text-amber-700/80 dark:text-amber-200/80">
                      Berat buah: {selfSalesTracker.unpaidWeightKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg
                    </div>
                  </div>
                  <div className="text-base sm:text-lg font-bold font-mono-tabular text-amber-800 dark:text-amber-200">
                    {formatRp(selfSalesTracker.unpaidAmountRp)}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sudah Dibayar ({selfSalesTracker.paidCount} pembeli)
                    </div>
                    <div className="text-[11px] font-mono-tabular text-emerald-700/80 dark:text-emerald-200/80">
                      Berat buah: {selfSalesTracker.paidWeightKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg
                    </div>
                  </div>
                  <div className="text-base sm:text-lg font-bold font-mono-tabular text-emerald-700 dark:text-emerald-300">
                    {formatRp(selfSalesTracker.paidAmountRp)}
                  </div>
                </div>
              </div>

              {selfSalesTracker.filtered.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed py-6 text-center text-xs"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                >
                  Belum ada catatan pembeli Jual sendiri pada filter ini.
                </div>
              ) : (
                <>
                  {/* Mobile Cards (<768px) */}
                  <div className="space-y-2.5 md:hidden">
                    {selfSalesTracker.filtered.map((item) => {
                      const isPaid = (item.paymentStatus || 'belum_dibayar') === 'sudah_dibayar';
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border p-3 space-y-2.5"
                          style={{
                            borderColor: isPaid ? '#16A34A' : '#D97706',
                            backgroundColor: 'var(--app-surface)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold truncate">
                                {item.buyer || 'Pembeli Langsung'}
                              </div>
                              <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                                {formatDateShortId(item.date)}
                                {item.receiptNo ? ` · ${item.receiptNo}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleSalePaymentStatus(item.id)}
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold cursor-pointer shrink-0 ${
                                isPaid
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {isPaid ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {isPaid ? 'Sudah Dibayar' : 'Belum Dibayar'}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 rounded-md border p-2.5" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}>
                            <div>
                              <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                                Berat Buah
                              </div>
                              <div className="text-sm font-bold font-mono-tabular">
                                {(item.weightKg ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                                Total yang Harus Dibayar
                              </div>
                              <div className="text-base font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                                {formatRp(item.totalAmount)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setBuyerPreviewSaleId(item.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold cursor-pointer"
                              style={{
                                borderColor: 'var(--app-border)',
                                backgroundColor: 'var(--app-canvas)',
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Tunjukkan ke Pembeli
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setNotaModalState({
                                  open: true,
                                  initialSale: item,
                                  initialDraft: null,
                                })
                              }
                              className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold cursor-pointer"
                              style={{
                                borderColor: 'var(--app-accent)',
                                color: 'var(--app-accent)',
                                backgroundColor: 'var(--app-accent-soft)',
                              }}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Nota
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop/Tablet Table (>=768px) */}
                  <div
                    className="hidden md:block overflow-x-auto rounded-lg border"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <table className="w-full text-xs">
                      <thead>
                        <tr
                          className="border-b text-left"
                          style={{
                            backgroundColor: 'var(--app-surface-muted)',
                            borderColor: 'var(--app-border)',
                          }}
                        >
                          <th className="px-3 py-2.5 font-semibold">Pembeli</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Berat Buah</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Total yang Harus Dibayar</th>
                          <th className="px-3 py-2.5 font-semibold text-center">Status Pembayaran</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Tampilkan / Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selfSalesTracker.filtered.map((item) => {
                          const isPaid = (item.paymentStatus || 'belum_dibayar') === 'sudah_dibayar';
                          return (
                            <tr
                              key={item.id}
                              className="border-b last:border-b-0"
                              style={{ borderColor: 'var(--app-border)' }}
                            >
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-sm">
                                  {item.buyer || 'Pembeli Langsung'}
                                </div>
                                <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                                  {formatDateShortId(item.date)}
                                  {item.receiptNo ? ` · ${item.receiptNo}` : ''}
                                  {item.pricePerKg > 0 ? ` · ${formatRp(item.pricePerKg)}/kg` : ''}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold font-mono-tabular text-sm whitespace-nowrap">
                                {(item.weightKg ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold font-mono-tabular text-sm whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                                {formatRp(item.totalAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSalePaymentStatus(item.id)}
                                  title="Klik untuk mengganti status Sudah Dibayar / Belum Dibayar"
                                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer transition-opacity hover:opacity-90 ${
                                    isPaid
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-amber-600 text-white'
                                  }`}
                                >
                                  {isPaid ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <Clock className="h-3.5 w-3.5" />
                                  )}
                                  {isPaid ? 'Sudah Dibayar' : 'Belum Dibayar'}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setBuyerPreviewSaleId(item.id)}
                                    className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold cursor-pointer"
                                    style={{
                                      borderColor: 'var(--app-border)',
                                      backgroundColor: 'var(--app-canvas)',
                                    }}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Tunjukkan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNotaModalState({
                                        open: true,
                                        initialSale: item,
                                        initialDraft: null,
                                      })
                                    }
                                    className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold cursor-pointer"
                                    style={{
                                      borderColor: 'var(--app-accent)',
                                      color: 'var(--app-accent)',
                                      backgroundColor: 'var(--app-accent-soft)',
                                    }}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    Nota
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Filter & Bulk Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--app-text-muted)' }}
                />
                <input
                  type="text"
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  placeholder="Cari pembeli / catatan..."
                  className="h-8 rounded-lg border pl-8 pr-2.5 text-xs focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>

              <select
                aria-label="Filter grade penjualan"
                value={saleGradeFilter}
                onChange={(e) => setSaleGradeFilter(e.target.value as 'all' | SaleGrade)}
                className="h-8 rounded-lg border px-2 text-xs cursor-pointer"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                  color: 'var(--app-text)',
                }}
              >
                <option value="all">Semua Grade</option>
                {SALE_GRADE_OPTIONS.map((opt) => (
                  <option key={opt.grade} value={opt.grade}>
                    {opt.grade}
                  </option>
                ))}
              </select>

              <div className="relative flex items-center">
                <Calendar
                  className="pointer-events-none absolute left-2 h-3.5 w-3.5"
                  style={{ color: 'var(--app-text-muted)' }}
                />
                <input
                  type="date"
                  value={saleDateFilter}
                  onChange={(e) => setSaleDateFilter(e.target.value)}
                  className="h-8 rounded-lg border pl-7 pr-2 text-xs font-mono-tabular"
                  style={{
                    borderColor: saleDateFilter ? 'var(--app-accent)' : 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
              {saleDateFilter && (
                <button
                  type="button"
                  onClick={() => setSaleDateFilter('')}
                  className="h-8 rounded-lg border px-2 text-[11px] cursor-pointer"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                >
                  Semua Tgl
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportSalesCsv}
                className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium cursor-pointer"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              {selectedSaleIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedSales}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Dipilih ({selectedSaleIds.length})
                </button>
              )}
              {sales.length > 0 &&
                (!confirmClearSales ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearSales(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Semua
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleClearAllSales}
                      className="h-8 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Ya, Kosongkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearSales(false)}
                      className="h-8 rounded-lg border px-2 text-xs cursor-pointer"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      Batal
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Sales Table */}
          {filteredSales.length === 0 ? (
            <div
              className="rounded-lg border border-dashed py-10 text-center text-xs"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            >
              Belum ada catatan penjualan untuk greenhouse / filter ini.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{
                      backgroundColor: 'var(--app-surface-muted)',
                      borderColor: 'var(--app-border)',
                    }}
                  >
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua penjualan tampil"
                        checked={
                          filteredSales.length > 0 &&
                          filteredSales.every((s) => selectedSaleIds.includes(s.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSaleIds(filteredSales.map((x) => x.id));
                          } else {
                            setSelectedSaleIds([]);
                          }
                        }}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                    <th className="px-3 py-2.5 font-semibold">Grade</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Berat (kg)</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Harga / kg</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Total Uang (Rp)</th>
                    <th className="px-3 py-2.5 font-semibold">Pembeli</th>
                    <th className="px-3 py-2.5 font-semibold">Catatan</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((item) => {
                    const checked = selectedSaleIds.includes(item.id);
                    const gradeMeta = SALE_GRADE_OPTIONS.find((g) => g.grade === item.grade);
                    return (
                      <tr
                        key={item.id}
                        className="border-b last:border-b-0"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: checked ? 'var(--app-accent-soft)' : 'transparent',
                        }}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Pilih penjualan ${item.grade}`}
                            checked={checked}
                            onChange={() =>
                              setSelectedSaleIds((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((x) => x !== item.id)
                                  : [...prev, item.id]
                              )
                            }
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono-tabular whitespace-nowrap">
                          {formatDateShortId(item.date)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className="rounded px-2 py-0.5 text-[11px] font-bold text-white"
                              style={{ backgroundColor: gradeMeta?.badgeColor || '#15803D' }}
                            >
                              {item.grade}
                            </span>
                            {item.receiptNo && (
                              <span
                                className="text-[10px] font-mono-tabular"
                                style={{ color: 'var(--app-text-muted)' }}
                              >
                                {item.receiptNo}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold font-mono-tabular whitespace-nowrap">
                          {(item.weightKg ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {formatRp(item.pricePerKg)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold font-mono-tabular whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                          {formatRp(item.totalAmount)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{item.buyer || '—'}</div>
                          {item.grade === 'Jual sendiri' && (
                            <button
                              type="button"
                              onClick={() => handleToggleSalePaymentStatus(item.id)}
                              className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                                (item.paymentStatus || 'belum_dibayar') === 'sudah_dibayar'
                                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-600/15 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {(item.paymentStatus || 'belum_dibayar') === 'sudah_dibayar'
                                ? 'Sudah Dibayar'
                                : 'Belum Dibayar'}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                          {item.notes || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {(item.grade === 'Jual sendiri' || Boolean(item.receiptNo)) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setNotaModalState({
                                    open: true,
                                    initialSale: item,
                                    initialDraft: null,
                                  })
                                }
                                className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                                style={{
                                  borderColor: 'var(--app-accent)',
                                  color: 'var(--app-accent)',
                                  backgroundColor: 'var(--app-accent-soft)',
                                }}
                              >
                                <Printer className="h-3 w-3" />
                                Nota
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteSale(item.id)}
                              aria-label={`Hapus penjualan ${item.grade}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              style={{ borderColor: 'var(--app-border)' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ======================================================= */}
      {/* DASHBOARD 3: KEUNTUNGAN & GRAFIK PERIODE / TAHUNAN      */}
      {/* ======================================================= */}
      {showD3 && (
        <section
          className="rounded-xl border p-4 sm:p-5 space-y-5"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{
                  backgroundColor: 'var(--app-accent-soft)',
                  color: 'var(--app-accent)',
                }}
              >
                <BarChart3 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold">
                  Dashboard 3 — Keuntungan &amp; Grafik Periode Panen / Tahunan
                </h3>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  Analisis laba bersih, margin keuntungan, grafik per periode panen, serta rekap tahunan &amp; bulanan.
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1 rounded-lg p-1 self-start sm:self-center"
              style={{ backgroundColor: 'var(--app-surface-muted)' }}
            >
              <button
                type="button"
                onClick={() => setProfitScope('gh')}
                className="rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: profitScope === 'gh' ? 'var(--app-surface)' : 'transparent',
                  color: profitScope === 'gh' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                }}
              >
                {gh.name} Saja
              </button>
              <button
                type="button"
                onClick={() => setProfitScope('season')}
                className="rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: profitScope === 'season' ? 'var(--app-surface)' : 'transparent',
                  color: profitScope === 'season' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                }}
              >
                Gabungan Semua GH ({activeDoc.greenhouses.length})
              </button>
            </div>
          </div>

          {/* 4 Profit KPI Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                Total Penjualan ({profitScope === 'gh' ? gh.name : 'Semua GH'})
              </div>
              <div className="mt-1.5 text-xl font-bold font-mono-tabular text-sky-700 dark:text-sky-400">
                {formatRp(profitSummary.totalSale)}
              </div>
              <div className="mt-1 text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                Total berat: {profitSummary.totalKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg
              </div>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
            >
              <div className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                Total Biaya Produksi
              </div>
              <div className="mt-1.5 text-xl font-bold font-mono-tabular text-amber-600 dark:text-amber-400">
                {formatRp(profitSummary.totalExp)}
              </div>
              <div className="mt-1 text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                HPP/kg: {profitSummary.totalKg > 0 ? `${formatRp(profitSummary.hppPerKg)}/kg` : '—'}
              </div>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: profitSummary.netProfit >= 0 ? '#16A34A' : '#DC2626',
                backgroundColor:
                  profitSummary.netProfit >= 0
                    ? 'rgba(22, 163, 74, 0.08)'
                    : 'rgba(220, 38, 38, 0.08)',
              }}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Keuntungan Bersih</span>
                {profitSummary.netProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <div
                className={`mt-1.5 text-xl font-bold font-mono-tabular ${
                  profitSummary.netProfit >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatRp(profitSummary.netProfit)}
              </div>
              <div className="mt-1 text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                {profitSummary.netProfit >= 0 ? 'Status: Laba / Untung' : 'Status: Belum BEP / Rugi'}
              </div>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
            >
              <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                <span>Margin &amp; Rata² Jual</span>
                <Scale className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1.5 text-xl font-bold font-mono-tabular">
                {(Number(profitSummary.marginPct) || 0).toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                Rata² jual: {profitSummary.totalKg > 0 ? `${formatRp(profitSummary.avgSellPerKg)}/kg` : '—'}
              </div>
            </div>
          </div>

          {/* Charts Grid: Per Periode Panen + Tahunan */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Grafik Tiap Periode Panen */}
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    Grafik Tiap Periode Panen
                  </h4>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Perbandingan biaya produksi, penjualan, dan keuntungan antar musim/periode atau per GH.
                  </p>
                </div>
                <div
                  className="flex items-center gap-1 rounded-md p-0.5 border"
                  style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}
                >
                  <button
                    type="button"
                    onClick={() => setPeriodChartMode('seasons')}
                    className="rounded px-2 py-1 text-[11px] font-semibold cursor-pointer"
                    style={{
                      backgroundColor: periodChartMode === 'seasons' ? 'var(--app-accent-soft)' : 'transparent',
                      color: periodChartMode === 'seasons' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    }}
                  >
                    Antar Periode ({allDocuments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodChartMode('greenhouses')}
                    className="rounded px-2 py-1 text-[11px] font-semibold cursor-pointer"
                    style={{
                      backgroundColor: periodChartMode === 'greenhouses' ? 'var(--app-accent-soft)' : 'transparent',
                      color: periodChartMode === 'greenhouses' ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    }}
                  >
                    Per GH ({activeDoc.greenhouses.length})
                  </button>
                </div>
              </div>

              <GroupedFinancialChart
                data={periodChartData}
                emptyMessage="Belum ada data transaksi pembukuan pada periode panen."
              />

              {/* Compact Period Summary Table */}
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface-muted)' }}>
                      <th className="px-2.5 py-1.5 font-semibold">Periode / GH</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Kg</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Biaya</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Penjualan</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Keuntungan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodChartData.map((row) => (
                      <tr key={row.key} className="border-b last:border-b-0" style={{ borderColor: 'var(--app-border)' }}>
                        <td className="px-2.5 py-1.5 font-medium">
                          {row.label}
                          {row.subLabel && (
                            <span className="ml-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                              ({row.subLabel})
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono-tabular">
                          {row.weightKg.toLocaleString('id-ID')}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono-tabular">
                          {formatRp(row.expense)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono-tabular">
                          {formatRp(row.sales)}
                        </td>
                        <td
                          className={`px-2.5 py-1.5 text-right font-bold font-mono-tabular ${
                            row.profit >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatRp(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grafik Tahunan (+ Rincian Bulanan Tahun Terpilih) */}
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-canvas)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    Grafik Tahunan &amp; Bulanan ({annualChartBundle.activeYear})
                  </h4>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Akumulasi biaya produksi, penjualan, dan laba per tahun serta rincian bulan berjalan.
                  </p>
                </div>
                {annualChartBundle.years.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {annualChartBundle.years.map((yr) => {
                      const active = annualChartBundle.activeYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedYearFilter(yr)}
                          className="rounded-md border px-2 py-1 text-[11px] font-mono-tabular font-semibold cursor-pointer"
                          style={{
                            borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                            backgroundColor: active ? 'var(--app-accent)' : 'var(--app-surface)',
                            color: active ? 'var(--app-accent-fg)' : 'var(--app-text)',
                          }}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <GroupedFinancialChart
                data={annualChartBundle.annualBars}
                emptyMessage="Belum ada transaksi pembukuan untuk dirangkum per tahun."
              />

              {annualChartBundle.monthlyBars.length > 0 && (
                <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                    Rincian Bulanan Tahun {annualChartBundle.activeYear}
                  </div>
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b text-left" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface-muted)' }}>
                          <th className="px-2.5 py-1.5 font-semibold">Bulan</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Kg</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Biaya</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Penjualan</th>
                          <th className="px-2.5 py-1.5 text-right font-semibold">Keuntungan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {annualChartBundle.monthlyBars.map((row) => (
                          <tr key={row.key} className="border-b last:border-b-0" style={{ borderColor: 'var(--app-border)' }}>
                            <td className="px-2.5 py-1.5 font-semibold">
                              {row.label} {annualChartBundle.activeYear}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono-tabular">
                              {row.weightKg.toLocaleString('id-ID')}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono-tabular">
                              {formatRp(row.expense)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono-tabular">
                              {formatRp(row.sales)}
                            </td>
                            <td
                              className={`px-2.5 py-1.5 text-right font-bold font-mono-tabular ${
                                row.profit >= 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatRp(row.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Kartu Tunjukkan Tagihan ke Pembeli (Jual Sendiri) */}
      {buyerPreviewSale && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Rincian Pembayaran Pembeli"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-surface)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)',
            }}
          >
            <div className="flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-accent)' }}>
                  {paymentProfile.storeName || 'MelonFlow NFT'} · Jual Sendiri
                </div>
                <h3 className="text-base font-bold mt-0.5">
                  Rincian Tagihan Pembeli
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBuyerPreviewSaleId(null)}
                aria-label="Tutup rincian tagihan"
                className="flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Pembeli
                  </div>
                  <div className="text-lg font-bold">
                    {buyerPreviewSale.buyer || 'Pembeli Langsung'}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-white ${
                    (buyerPreviewSale.paymentStatus || 'belum_dibayar') === 'sudah_dibayar'
                      ? 'bg-emerald-600'
                      : 'bg-amber-600'
                  }`}
                >
                  {(buyerPreviewSale.paymentStatus || 'belum_dibayar') === 'sudah_dibayar'
                    ? 'Sudah Dibayar'
                    : 'Belum Dibayar'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Berat Buah
                  </div>
                  <div className="text-lg font-bold font-mono-tabular">
                    {(buyerPreviewSale.weightKg ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
                  </div>
                  {buyerPreviewSale.pricePerKg > 0 && (
                    <div className="text-[11px] font-mono-tabular" style={{ color: 'var(--app-text-muted)' }}>
                      @ {formatRp(buyerPreviewSale.pricePerKg)}/kg
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Total yang Harus Dibayar
                  </div>
                  <div className="text-2xl font-extrabold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                    {formatRp(buyerPreviewSale.totalAmount)}
                  </div>
                </div>
              </div>
            </div>

            {(paymentProfile.accountNumber || paymentProfile.qrisImageDataUrl) && (
              <div
                className="rounded-xl border p-3.5 space-y-2.5 text-center"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                {paymentProfile.qrisImageDataUrl && (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-bold">Scan QRIS untuk Membayar</span>
                    <img
                      src={paymentProfile.qrisImageDataUrl}
                      alt="Barcode QRIS"
                      referrerPolicy="no-referrer"
                      className="max-h-44 w-auto rounded-lg border bg-white p-1.5 object-contain"
                      style={{ borderColor: 'var(--app-border)' }}
                    />
                  </div>
                )}
                {paymentProfile.accountNumber && (
                  <div className="text-xs space-y-0.5 pt-1">
                    <div className="font-semibold">
                      Transfer {paymentProfile.bankName || 'Bank'}:{' '}
                      <span className="font-mono-tabular font-bold">
                        {paymentProfile.accountNumber}
                      </span>
                    </div>
                    {paymentProfile.accountHolderName && (
                      <div style={{ color: 'var(--app-text-muted)' }}>
                        a.n. {paymentProfile.accountHolderName}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleToggleSalePaymentStatus(buyerPreviewSale.id)}
                className={`flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white cursor-pointer ${
                  (buyerPreviewSale.paymentStatus || 'belum_dibayar') === 'sudah_dibayar'
                    ? 'bg-amber-600'
                    : 'bg-emerald-600'
                }`}
              >
                {(buyerPreviewSale.paymentStatus || 'belum_dibayar') === 'sudah_dibayar' ? (
                  <>
                    <Clock className="h-4 w-4" />
                    Ubah ke Belum Dibayar
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Tandai Sudah Dibayar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = buyerPreviewSale;
                  setBuyerPreviewSaleId(null);
                  setNotaModalState({
                    open: true,
                    initialSale: target,
                    initialDraft: null,
                  });
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold cursor-pointer"
                style={{
                  borderColor: 'var(--app-accent)',
                  color: 'var(--app-accent)',
                  backgroundColor: 'var(--app-accent-soft)',
                }}
              >
                <Printer className="h-4 w-4" />
                Cetak Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembuatan & Cetak Nota Jual Sendiri + QRIS & Rekening */}
      <SelfSaleReceiptModal
        isOpen={notaModalState.open}
        gh={gh}
        initialSale={notaModalState.initialSale}
        initialDraft={notaModalState.initialDraft}
        paymentProfile={paymentProfile}
        onUpdatePaymentProfile={onUpdatePaymentProfile}
        onSaveSaleRecord={handleSaveSaleFromReceipt}
        onPrintReceiptSheet={onPrintReceiptSheet}
        cloudEmail={cloudEmail}
        onOpenAccountSync={onOpenAccountSync}
        onClose={() =>
          setNotaModalState({ open: false, initialSale: null, initialDraft: null })
        }
      />
    </div>
  );
};

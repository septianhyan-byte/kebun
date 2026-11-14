import {
  AppSettings,
  GreenhouseData,
  GrowthPhase,
  PlantCondition,
  PlantHealthStatus,
  ProductionExpenseEntry,
  SaleRecord,
  SeasonDocument,
  SelfSalePaymentProfile,
  TreatmentRecord,
  WaterLogEntry,
} from '../types';

const SETTINGS_KEY = 'melonflow_settings_v1';
const DOCS_KEY = 'melonflow_documents_v1';
const ACTIVE_DOC_KEY = 'melonflow_active_doc_id_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'daun-melon',
  fontId: 'jakarta',
  accentColor: '#15803D',
  notifications: {
    enabled: true,
    soundEnabled: true,
    browserNotify: false,
    ppmMin: 500,
    ppmMax: 1000,
    phMin: 6.5,
    phMax: 7.0,
    treatmentReminder: true,
    sickPlantThreshold: 15,
  },
};

export function generatePlants(
  capacity: number,
  seedOffset: number,
  phase: GrowthPhase,
  freshBlank = false
): PlantCondition[] {
  const now = new Date().toISOString();
  const list: PlantCondition[] = [];

  for (let i = 1; i <= capacity; i++) {
    let status: PlantHealthStatus = 'sehat';
    let symptom = 'Pertumbuhan normal';
    let notes = '';
    let lastAction = freshBlank ? 'Baru tanam' : 'Monitoring rutin';
    let brix = phase === 'pembesaran' ? 12.8 : 0;
    let estWeightKg = phase === 'pembesaran' ? 1.45 : phase === 'generatif' ? 0.55 : 0;
    let fruitCount = phase === 'semai' || phase === 'vegetatif' ? 0 : 1;
    let heightCm =
      phase === 'semai' ? 18 : phase === 'vegetatif' ? 115 : phase === 'generatif' ? 175 : 210;

    if (!freshBlank) {
      const code = (i * 37 + seedOffset * 13) % 199;
      if (code === 7 || code === 83) {
        status = 'sakit';
        symptom = i % 2 === 0 ? 'Bercak batang (Gummy Stem Blight)' : 'Embun tepung (Powdery Mildew)';
        lastAction = 'Perlu pengolesan fungisida';
        notes = 'Segera isolasi sulur dan lakukan pengolesan pasta fungisida pada pangkal.';
      } else if (code === 19 || code === 52 || code === 114 || code === 161) {
        status = 'perhatian';
        symptom = i % 2 === 0 ? 'Daun bawah agak menguning' : 'Serangan ringan kutu kebul';
        lastAction = 'Jadwal penyemprotan sore';
        notes = 'Pantau perkembangan daun muda 24 jam ke depan.';
      } else if (phase === 'pembesaran' && (i % 41 === 0)) {
        status = 'panen';
        symptom = 'Netting penuh & tangkai mulai mengering';
        brix = 14.4;
        estWeightKg = 1.72;
        lastAction = 'Siap petik batch pagi';
        notes = 'Kadar gula Brix telah mencapai target panen premium.';
      } else if (i === capacity - 3 || i === capacity - 12) {
        status = 'kosong';
        symptom = 'Lubang netpot kosong / perlu sulam';
        heightCm = 0;
        fruitCount = 0;
        estWeightKg = 0;
        brix = 0;
        lastAction = 'Menunggu bibit sulam';
      } else {
        // subtle realistic variance
        heightCm += (i % 15) - 7;
        if (brix > 0) brix = Number((12.4 + ((i % 18) * 0.1)).toFixed(1));
        if (estWeightKg > 0) estWeightKg = Number((estWeightKg + ((i % 7) - 3) * 0.05).toFixed(2));
      }
    }

    list.push({
      id: i,
      status,
      fruitingStatus: fruitCount > 0 ? 'berbuah' : 'tidak_berbuah',
      symptom,
      heightCm,
      fruitCount,
      estWeightKg,
      brix,
      lastAction,
      notes,
      updatedAt: now,
    });
  }

  return list;
}

function buildSampleWaterLogs(basePpm: number, basePh: number, ecFactor: 500 | 700): WaterLogEntry[] {
  const now = Date.now();
  const entries: WaterLogEntry[] = [];
  const deltas = [
    { h: 20, prevPpm: -80, dPpm: -65, prevPh: 0.3, dPh: 0.25, waterL: 40, nutL: 0, phMl: 0, phType: 'none' as const, chem: 'none' as const, note: 'Tambah air baku 40L pagi' },
    { h: 16, prevPpm: -65, dPpm: -40, prevPh: 0.25, dPh: 0.18, waterL: 0, nutL: 4, phMl: 25, phType: 'down' as const, chem: 'Phosphoric' as const, note: 'Tambah Nutrisi 4L + Phosphoric 25ml' },
    { h: 12, prevPpm: -40, dPpm: 20, prevPh: 0.18, dPh: -0.08, waterL: 0, nutL: 6, phMl: 15, phType: 'down' as const, chem: 'Phosphoric' as const, note: 'Tambah Nutrisi 6L + kalibrasi siang' },
    { h: 8, prevPpm: 20, dPpm: -25, prevPh: -0.08, dPh: 0.1, waterL: 50, nutL: 0, phMl: 10, phType: 'up' as const, chem: 'KOH' as const, note: 'Top up air baku 50L + KOH 10ml' },
    { h: 4, prevPpm: -25, dPpm: 10, prevPh: 0.1, dPh: 0.02, waterL: 0, nutL: 3, phMl: 10, phType: 'down' as const, chem: 'Phosphoric' as const, note: 'Penyesuaian sore 3L nutrisi' },
    { h: 1, prevPpm: 10, dPpm: 0, prevPh: 0.02, dPh: 0, waterL: 0, nutL: 0, phMl: 0, phType: 'none' as const, chem: 'none' as const, note: 'Ukur manual tandon utama' },
  ];

  deltas.forEach((d, idx) => {
    const ppm = Math.round(basePpm + d.dPpm);
    const ppmBefore = Math.round(basePpm + d.prevPpm);
    const ph = Number((basePh + d.dPh).toFixed(2));
    const phBefore = Number((basePh + d.prevPh).toFixed(2));
    entries.push({
      id: `wlog-${idx}-${now}`,
      timestamp: new Date(now - d.h * 3600 * 1000).toISOString(),
      ppmBefore,
      ppm,
      ec: Number((ppm / ecFactor).toFixed(2)),
      phBefore,
      ph,
      tempC: Number((24.8 + (idx % 3) * 0.6).toFixed(1)),
      flowLpm: Number((18.5 - (idx % 2) * 0.4).toFixed(1)),
      reservoirPct: Math.min(96, 78 + idx * 3),
      waterAddedLiters: d.waterL,
      nutrientAddedLiters: d.nutL,
      abMixAddedMl: d.nutL * 1000,
      phAdjMl: d.phMl,
      phAdjType: d.phType,
      phChemical: d.chem,
      source: 'manual',
      operator: idx % 2 === 0 ? 'Budi Santoso' : 'Rina Wijaya',
      note: d.note,
    });
  });

  return entries.reverse();
}

function buildSampleTreatments(ghName: string): TreatmentRecord[] {
  const now = Date.now();
  return [
    {
      id: `tr-1-${ghName}`,
      type: 'penyemprotan',
      sprayCategory: 'fungisida',
      medicineName: 'Azoxistrobin + Difenokonazol',
      activeIngredient: 'Fungisida Preventif Embun Tepung',
      dosage: '1,5 ml/L (30 ml / tangki 20L)',
      targetPlants: 'Semua Tanaman (1–1000)',
      scheduledAt: new Date(now + 4 * 3600 * 1000).toISOString(),
      status: 'terjadwal',
      operator: 'Budi Santoso',
      notes: 'Lakukan penyemprotan kabut halus pada permukaan bawah daun pukul 16.30.',
    },
    {
      id: `tr-2-${ghName}`,
      type: 'pengolesan',
      medicineName: 'Pasta Mankozeb + Tembaga',
      activeIngredient: 'Mankozeb & Cu(OH)2 (Gummy Stem)',
      dosage: 'Pasta pekat 1:2 air',
      targetPlants: 'Tanaman #83, #190, #422, #715',
      scheduledAt: new Date(now + 2 * 3600 * 1000).toISOString(),
      status: 'terjadwal',
      operator: 'Rina Wijaya',
      notes: 'Oles langsung pada luka pangkal batang setelah pemangkasan tunas air.',
    },
    {
      id: `tr-3-${ghName}`,
      type: 'pengocoran',
      medicineName: 'Trichoderma harzianum',
      activeIngredient: 'Agen Hayati Akar & Anti Fusarium',
      dosage: '5 gr/L (50 ml per netpot)',
      targetPlants: 'Blok 1–5 (1–500)',
      scheduledAt: new Date(now - 18 * 3600 * 1000).toISOString(),
      completedAt: new Date(now - 17 * 3600 * 1000).toISOString(),
      status: 'selesai',
      operator: 'Budi Santoso',
      notes: 'Pompa UV dimatikan 24 jam pasca pengocoran agen hayati.',
    },
    {
      id: `tr-4-${ghName}`,
      type: 'penyemprotan',
      sprayCategory: 'pupuk',
      medicineName: 'Kalsium Boron Foliar',
      activeIngredient: 'CaO 12% + Boron 1,5%',
      dosage: '2 gr/L',
      targetPlants: 'Semua Tanaman (1–1000)',
      scheduledAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      completedAt: new Date(now - 47 * 3600 * 1000).toISOString(),
      status: 'selesai',
      operator: 'Rina Wijaya',
      notes: 'Aplikasi pagi hari untuk mencegah pecah buah dan memperkuat tangkai.',
    },
  ];
}

function buildSampleExpenses(ghName: string, variety: string): ProductionExpenseEntry[] {
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400 * 1000).toISOString().slice(0, 10);
  const cleanTag = ghName.replace(/\s+/g, '-').toLowerCase();
  const seedName = variety.toLowerCase().includes('inthanon')
    ? 'Benih: Inthanon'
    : variety.toLowerCase().includes('blues')
    ? 'Benih: The Blues'
    : variety.toLowerCase().includes('kirin')
    ? 'Benih: Kirin'
    : variety.toLowerCase().includes('honey')
    ? 'Benih: Honey Globe'
    : 'Benih: Petravany';

  return [
    {
      id: `exp-1-${cleanTag}`,
      date: daysAgo(38),
      category: 'lainnya',
      itemName: seedName,
      quantity: 2,
      unit: 'Pack',
      unitPrice: 425000,
      totalCost: 850000,
      notes: 'Pembelian benih awal musim untuk 1000 lubang tanam + cadangan sulam',
    },
    {
      id: `exp-2-${cleanTag}`,
      date: daysAgo(35),
      category: 'lainnya',
      itemName: 'AB MIX',
      quantity: 4,
      unit: 'SET',
      unitPrice: 310000,
      totalCost: 1240000,
      notes: 'Stok nutrisi pekatan A & B kemasan SET',
    },
    {
      id: `exp-3-${cleanTag}`,
      date: daysAgo(24),
      category: 'pupuk',
      itemName: 'MKP',
      quantity: 3,
      unit: 'kg',
      unitPrice: 68000,
      totalCost: 204000,
      notes: 'Booster pembungaan & pembuahan fase generatif',
    },
    {
      id: `exp-4-${cleanTag}`,
      date: daysAgo(19),
      category: 'pupuk',
      itemName: 'Calcium Active',
      quantity: 2,
      unit: 'Liter',
      unitPrice: 115000,
      totalCost: 230000,
      notes: 'Pencegahan pecah buah & penguatan tangkai',
    },
    {
      id: `exp-5-${cleanTag}`,
      date: daysAgo(15),
      category: 'fungisida',
      itemName: 'Antracol',
      quantity: 2,
      unit: 'Bungkus',
      unitPrice: 95000,
      totalCost: 190000,
      notes: 'Proteksi bercak daun dan embun bulu',
    },
    {
      id: `exp-6-${cleanTag}`,
      date: daysAgo(12),
      category: 'insektisida',
      itemName: 'Abacel',
      quantity: 2,
      unit: 'Botol',
      unitPrice: 135000,
      totalCost: 270000,
      notes: 'Pengendalian thrips & tungau daun',
    },
    {
      id: `exp-7-${cleanTag}`,
      date: daysAgo(10),
      category: 'tenaga_kerja',
      itemName: 'Tenaga Polinasi & Seleksi Buah',
      quantity: 6,
      unit: 'HOK',
      unitPrice: 125000,
      totalCost: 750000,
      notes: '3 pekerja x 2 hari polinasi serempak',
    },
  ];
}

function buildSampleSales(ghName: string, phase: GrowthPhase): SaleRecord[] {
  if (phase !== 'pembesaran' && phase !== 'generatif') return [];
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400 * 1000).toISOString().slice(0, 10);
  const cleanTag = ghName.replace(/\s+/g, '-').toLowerCase();

  if (phase === 'generatif') {
    return [
      {
        id: `sale-1-${cleanTag}`,
        date: daysAgo(3),
        grade: 'Plonco',
        weightKg: 35,
        pricePerKg: 9000,
        totalAmount: 315000,
        buyer: 'Pedagang Lokal',
        notes: 'Hasil seleksi buah awal (1 pohon 1 buah optimal)',
      },
    ];
  }

  return [
    {
      id: `sale-1-${cleanTag}`,
      date: daysAgo(4),
      grade: 'Grade A',
      weightKg: 480,
      pricePerKg: 28000,
      totalAmount: 13440000,
      buyer: 'Mitra Supermarket Segar',
      notes: 'Panen gelombang 1 Brix 13.5–14.4%, netting penuh',
    },
    {
      id: `sale-2-${cleanTag}`,
      date: daysAgo(3),
      grade: 'Grade B',
      weightKg: 210,
      pricePerKg: 22000,
      totalAmount: 4620000,
      buyer: 'Pasar Buah Induk',
      notes: 'Ukuran 1.2–1.35 kg standar',
    },
    {
      id: `sale-3-${cleanTag}`,
      date: daysAgo(2),
      grade: 'Grade C',
      weightKg: 85,
      pricePerKg: 16000,
      totalAmount: 1360000,
      buyer: 'Kios Buah Kota',
      notes: 'Sortiran grade C',
    },
    {
      id: `sale-4-${cleanTag}`,
      date: daysAgo(1),
      grade: 'Jual sendiri',
      weightKg: 64,
      pricePerKg: 32000,
      totalAmount: 2048000,
      buyer: 'Pembeli Kebun / Wisata Petik',
      notes: 'Penjualan langsung pengunjung kebun',
    },
  ];
}

export function createGreenhouse(
  id: string,
  name: string,
  variety: string,
  capacity: number,
  phase: GrowthPhase,
  basePpm: number,
  basePh: number,
  seedOffset: number,
  freshBlank = false
): GreenhouseData {
  const ecFactor: 500 | 700 = 500;
  return {
    id,
    name,
    variety,
    capacity,
    gulliesCount: Math.max(4, Math.ceil(capacity / 50)),
    reservoirLiters: 2000,
    plantingDate: new Date(Date.now() - (freshBlank ? 0 : 38 * 86400 * 1000)).toISOString().slice(0, 10),
    harvestDate: '',
    phase,
    ecFactor,
    avgMelonWeightKg: phase === 'pembesaran' ? 1.45 : phase === 'generatif' ? 0.55 : 1.5,
    currentWater: {
      ppm: basePpm,
      ec: Number((basePpm / ecFactor).toFixed(2)),
      ph: basePh,
      tempC: 25.2,
      flowLpm: 18.4,
      reservoirPct: 86,
      pumpCirculation: true,
      pumpNutrientA: false,
      pumpNutrientB: false,
      pumpPhDown: false,
      pumpPhUp: false,
    },
    waterLogs: freshBlank ? [] : buildSampleWaterLogs(basePpm, basePh, ecFactor),
    treatments: freshBlank ? [] : buildSampleTreatments(name),
    plants: generatePlants(capacity, seedOffset, phase, freshBlank),
    expenses: freshBlank ? [] : buildSampleExpenses(name, variety),
    sales: freshBlank ? [] : buildSampleSales(name, phase),
  };
}

export function createInitialSeasonDocument(): SeasonDocument {
  const now = new Date().toISOString();
  return {
    id: `season-${Date.now()}`,
    title: 'Musim Tanam 1 — Batch November 2026',
    createdAt: now,
    updatedAt: now,
    notes: 'Budidaya Melon Premium NFT 3 Greenhouse (Inthanon, Fujisawa, Golden Apollo).',
    activeGhId: 'gh-1',
    greenhouses: [
      createGreenhouse('gh-1', 'GH 1', 'Melon Inthanon RZ', 1000, 'pembesaran', 760, 6.7, 1),
      createGreenhouse('gh-2', 'GH 2', 'Melon Fujisawa F1', 1000, 'vegetatif', 650, 6.6, 7),
      createGreenhouse('gh-3', 'GH 3', 'Melon Golden Apollo', 1000, 'generatif', 850, 6.8, 13),
    ],
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const savedNotif = parsed.notifications || {};
    const isOldDefaultNotif =
      savedNotif.ppmMin === 900 &&
      savedNotif.ppmMax === 1650 &&
      savedNotif.phMin === 5.7 &&
      savedNotif.phMax === 6.4;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...savedNotif,
        ...(isOldDefaultNotif
          ? { ppmMin: 500, ppmMax: 1000, phMin: 6.5, phMax: 7.0 }
          : {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

export function loadDocuments(): { documents: SeasonDocument[]; activeDocId: string } {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    const activeId = localStorage.getItem(ACTIVE_DOC_KEY) || '';
    if (!raw) {
      const initial = createInitialSeasonDocument();
      saveDocuments([initial], initial.id);
      return { documents: [initial], activeDocId: initial.id };
    }
    const parsed: SeasonDocument[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = createInitialSeasonDocument();
      saveDocuments([initial], initial.id);
      return { documents: [initial], activeDocId: initial.id };
    }
    const normalized: SeasonDocument[] = parsed.map((doc) => ({
      ...doc,
      greenhouses: Array.isArray(doc.greenhouses)
        ? doc.greenhouses.map((gh) => ({
            ...gh,
            waterLogs: Array.isArray(gh.waterLogs) ? gh.waterLogs : [],
            treatments: Array.isArray(gh.treatments) ? gh.treatments : [],
            plants: Array.isArray(gh.plants) ? gh.plants : [],
            expenses: Array.isArray(gh.expenses) ? gh.expenses : [],
            sales: Array.isArray(gh.sales) ? gh.sales : [],
          }))
        : [],
    }));
    const validActive = normalized.some((d) => d.id === activeId) ? activeId : normalized[0].id;
    return { documents: normalized, activeDocId: validActive };
  } catch {
    const initial = createInitialSeasonDocument();
    return { documents: [initial], activeDocId: initial.id };
  }
}

export function saveDocuments(documents: SeasonDocument[], activeDocId: string): void {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(documents));
    localStorage.setItem(ACTIVE_DOC_KEY, activeDocId);
  } catch {
    // ignore storage quota errors
  }
}

const OFFLINE_MODE_KEY = 'melonflow_offline_mode_v1';
const PENDING_SYNC_KEY = 'melonflow_pending_sync_seasons_v1';
const PENDING_DELETE_KEY = 'melonflow_pending_delete_seasons_v1';

export function loadOfflineModePref(): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveOfflineModePref(enabled: boolean): void {
  try {
    localStorage.setItem(OFFLINE_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage quota errors
  }
}

export function loadPendingSyncQueue(): { upsertIds: string[]; deleteIds: string[] } {
  try {
    const upRaw = localStorage.getItem(PENDING_SYNC_KEY);
    const delRaw = localStorage.getItem(PENDING_DELETE_KEY);
    const upsertIds = upRaw ? (JSON.parse(upRaw) as string[]) : [];
    const deleteIds = delRaw ? (JSON.parse(delRaw) as string[]) : [];
    return {
      upsertIds: Array.isArray(upsertIds) ? upsertIds : [],
      deleteIds: Array.isArray(deleteIds) ? deleteIds : [],
    };
  } catch {
    return { upsertIds: [], deleteIds: [] };
  }
}

export function savePendingSyncQueue(upsertIds: string[], deleteIds: string[]): void {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(Array.from(new Set(upsertIds))));
    localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(Array.from(new Set(deleteIds))));
  } catch {
    // ignore storage quota errors
  }
}

const PAYMENT_PROFILE_KEY = 'melonflow_payment_profile_v1';
const PENDING_PAYMENT_SYNC_KEY = 'melonflow_pending_payment_sync_v1';

export const DEFAULT_PAYMENT_PROFILE: SelfSalePaymentProfile = {
  storeName: 'Kebun MelonFlow NFT',
  storePhone: '',
  storeAddress: '',
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  qrisImageDataUrl: '',
  footerNote: 'Terima kasih telah berbelanja melon segar kebun kami.',
};

export function loadPaymentProfile(): SelfSalePaymentProfile {
  try {
    const raw = localStorage.getItem(PAYMENT_PROFILE_KEY);
    if (!raw) return DEFAULT_PAYMENT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<SelfSalePaymentProfile>;
    return {
      ...DEFAULT_PAYMENT_PROFILE,
      ...parsed,
    };
  } catch {
    return DEFAULT_PAYMENT_PROFILE;
  }
}

export function savePaymentProfile(profile: SelfSalePaymentProfile): void {
  try {
    localStorage.setItem(PAYMENT_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export function loadPendingPaymentSync(): boolean {
  try {
    return localStorage.getItem(PENDING_PAYMENT_SYNC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function savePendingPaymentSync(pending: boolean): void {
  try {
    localStorage.setItem(PENDING_PAYMENT_SYNC_KEY, pending ? 'true' : 'false');
  } catch {
    // ignore storage quota errors
  }
}



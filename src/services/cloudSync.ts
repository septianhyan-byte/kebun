import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, formatFirestoreError, handleFirestoreError, OperationType } from '../firebase';
import { normalizeGreenhouse } from '../utils/storage';
import type {
  ActivityCategory,
  ExpenseCategory,
  GreenhouseData,
  PlantCondition,
  ProductionExpenseEntry,
  SaleGrade,
  SaleRecord,
  SeasonDocument,
  SelfSalePaymentProfile,
  SupervisionActivity,
  TreatmentRecord,
  WaterLogEntry,
  WaterTargets,
} from '../types';

const DEVICE_LABEL_KEY = 'melonflow_device_label_v1';
const BLOCK_SIZE = 100;

export function getSavedDeviceLabel(): string {
  try {
    const saved = localStorage.getItem(DEVICE_LABEL_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 120);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (/android/.test(ua)) return 'HP Android Kebun';
    if (/iphone|ipad/.test(ua)) return 'Perangkat iOS Kebun';
    return 'Perangkat Monitoring';
  } catch {
    return 'Perangkat Monitoring';
  }
}

export function saveDeviceLabel(label: string): string {
  const clean = (label.trim() || 'Perangkat Monitoring').slice(0, 120);
  try {
    localStorage.setItem(DEVICE_LABEL_KEY, clean);
  } catch {
    // ignore storage quota errors
  }
  return clean;
}

export function sanitizeId(raw: string, fallback = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || fallback;
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string' && val) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function cleanWaterLogForCloud(ownerUid: string, log: WaterLogEntry) {
  const logId = sanitizeId(log.id, `wlog-${Date.now()}`);
  const payload: Record<string, unknown> = {
    id: logId,
    ownerUid,
    timestamp: String(log.timestamp || new Date().toISOString()).slice(0, 64),
    ppm: Number(log.ppm) || 0,
    ec: Number(log.ec) || 0,
    ph: Number(log.ph) || 0,
    tempC: Number(log.tempC) || 0,
    flowLpm: Number(log.flowLpm) || 0,
    reservoirPct: Number(log.reservoirPct) || 0,
    abMixAddedMl: Number(log.abMixAddedMl) || 0,
    phAdjMl: Number(log.phAdjMl) || 0,
    phAdjType: log.phAdjType === 'up' || log.phAdjType === 'down' ? log.phAdjType : 'none',
    source: log.source === 'dosing' ? 'dosing' : 'manual',
    operator: String(log.operator || 'Petugas').slice(0, 120),
    note: String(log.note || '').slice(0, 500),
  };
  if (typeof log.plantAgeHst === 'number' && !Number.isNaN(log.plantAgeHst)) {
    const hst = Math.round(log.plantAgeHst);
    if (hst >= 1 && hst <= 75) {
      payload.plantAgeHst = hst;
    }
  }
  if (typeof log.ppmBefore === 'number' && !Number.isNaN(log.ppmBefore)) {
    payload.ppmBefore = log.ppmBefore;
  }
  if (typeof log.phBefore === 'number' && !Number.isNaN(log.phBefore)) {
    payload.phBefore = log.phBefore;
  }
  if (typeof log.waterAddedLiters === 'number' && !Number.isNaN(log.waterAddedLiters)) {
    payload.waterAddedLiters = log.waterAddedLiters;
  }
  if (typeof log.nutrientAddedLiters === 'number' && !Number.isNaN(log.nutrientAddedLiters)) {
    payload.nutrientAddedLiters = log.nutrientAddedLiters;
  }
  if (log.phChemical === 'KOH' || log.phChemical === 'Phosphoric' || log.phChemical === 'none') {
    payload.phChemical = log.phChemical;
  }
  return { logId, payload };
}

function cleanTreatmentForCloud(ownerUid: string, t: TreatmentRecord) {
  const treatmentId = sanitizeId(t.id, `tr-${Date.now()}`);
  const payload: Record<string, unknown> = {
    id: treatmentId,
    ownerUid,
    type:
      t.type === 'pengolesan' || t.type === 'pengocoran' ? t.type : 'penyemprotan',
    medicineName: String(t.medicineName || '').trim().slice(0, 300) || 'Perawatan',
    activeIngredient: String(t.activeIngredient || '').slice(0, 500),
    dosage: String(t.dosage || '').slice(0, 240),
    targetPlants: String(t.targetPlants || '').slice(0, 160),
    scheduledAt: String(t.scheduledAt || new Date().toISOString()).slice(0, 64),
    status: t.status === 'selesai' ? 'selesai' : 'terjadwal',
    operator: String(t.operator || 'Petugas').slice(0, 120),
    notes: String(t.notes || '').slice(0, 500),
  };
  if (
    t.sprayCategory === 'pupuk' ||
    t.sprayCategory === 'insektisida' ||
    t.sprayCategory === 'fungisida' ||
    t.sprayCategory === ''
  ) {
    payload.sprayCategory = t.sprayCategory;
  }
  if (t.completedAt) {
    payload.completedAt = String(t.completedAt).slice(0, 64);
  }
  return { treatmentId, payload };
}

const VALID_EXPENSE_CATS: ExpenseCategory[] = [
  'pupuk',
  'fungisida',
  'insektisida',
  'tenaga_kerja',
  'lainnya',
];

function cleanExpenseForCloud(ownerUid: string, exp: ProductionExpenseEntry) {
  const expenseId = sanitizeId(exp.id, `exp-${Date.now()}`);
  const category: ExpenseCategory = VALID_EXPENSE_CATS.includes(exp.category)
    ? exp.category
    : 'lainnya';
  const payload: Record<string, unknown> = {
    id: expenseId,
    ownerUid,
    date: String(exp.date || new Date().toISOString().slice(0, 10)).slice(0, 32),
    category,
    itemName: String(exp.itemName || '').trim().slice(0, 160) || 'Biaya Produksi',
    quantity: Math.max(0, Number(exp.quantity) || 0),
    unit: String(exp.unit || 'Unit').slice(0, 40),
    unitPrice: Math.max(0, Number(exp.unitPrice) || 0),
    totalCost: Math.max(0, Number(exp.totalCost) || 0),
    notes: String(exp.notes || '').slice(0, 500),
  };
  if (typeof exp.workHours === 'number' && !Number.isNaN(exp.workHours) && exp.workHours >= 0) {
    payload.workHours = Math.min(10000, Number(exp.workHours.toFixed(2)));
  }
  return { expenseId, payload };
}

const VALID_SALE_GRADES: SaleGrade[] = [
  'Grade A',
  'Grade B',
  'Grade C',
  'Grade D',
  'Plonco',
  'Jual sendiri',
];

function cleanSaleForCloud(ownerUid: string, sale: SaleRecord) {
  const saleId = sanitizeId(sale.id, `sale-${Date.now()}`);
  const grade: SaleGrade = VALID_SALE_GRADES.includes(sale.grade) ? sale.grade : 'Grade A';
  const payload: Record<string, unknown> = {
    id: saleId,
    ownerUid,
    date: String(sale.date || new Date().toISOString().slice(0, 10)).slice(0, 32),
    grade,
    weightKg: Math.max(0, Number(sale.weightKg) || 0),
    pricePerKg: Math.max(0, Number(sale.pricePerKg) || 0),
    totalAmount: Math.max(0, Number(sale.totalAmount) || 0),
    buyer: String(sale.buyer || '').slice(0, 160),
    notes: String(sale.notes || '').slice(0, 500),
  };
  if (sale.receiptNo && String(sale.receiptNo).trim()) {
    payload.receiptNo = String(sale.receiptNo).trim().slice(0, 64);
  }
  if (sale.paymentStatus === 'belum_dibayar' || sale.paymentStatus === 'sudah_dibayar') {
    payload.paymentStatus = sale.paymentStatus;
  } else if (grade === 'Jual sendiri') {
    payload.paymentStatus = 'belum_dibayar';
  }
  return { saleId, payload };
}

function cleanPlantForCloud(p: PlantCondition): PlantCondition {
  const cleaned: PlantCondition = {
    id: Number(p.id),
    status: p.status,
    fruitingStatus: p.fruitingStatus || (p.fruitCount > 0 ? 'berbuah' : 'tidak_berbuah'),
    fruitQuality: p.fruitQuality === 'jelek' ? 'jelek' : 'bagus',
    symptom: String(p.symptom || '').slice(0, 160),
    heightCm: Number(p.heightCm) || 0,
    fruitCount: Number(p.fruitCount) || 0,
    estWeightKg: Number(p.estWeightKg) || 0,
    brix: Number(p.brix) || 0,
    lastAction: String(p.lastAction || '').slice(0, 160),
    notes: String(p.notes || '').slice(0, 300),
    harvestDate: p.harvestDate ? String(p.harvestDate).slice(0, 32) : '',
    inspectionDate: p.inspectionDate ? String(p.inspectionDate).slice(0, 32) : '',
    updatedAt: String(p.updatedAt || new Date().toISOString()).slice(0, 64),
  };
  if (Array.isArray(p.fruitWeights) && p.fruitWeights.length > 0) {
    cleaned.fruitWeights = p.fruitWeights
      .slice(0, 20)
      .map((w) => Math.max(0, Number(w) || 0));
  }
  return cleaned;
}

function buildPlantBlocks(plants: PlantCondition[]): Array<{
  blockId: string;
  blockIndex: number;
  startId: number;
  endId: number;
  plants: PlantCondition[];
}> {
  const sorted = [...plants].sort((a, b) => a.id - b.id);
  const blocks: Array<{
    blockId: string;
    blockIndex: number;
    startId: number;
    endId: number;
    plants: PlantCondition[];
  }> = [];
  for (let i = 0; i < sorted.length; i += BLOCK_SIZE) {
    const slice = sorted.slice(i, i + BLOCK_SIZE).map(cleanPlantForCloud);
    if (slice.length === 0) continue;
    const blockIndex = Math.floor(i / BLOCK_SIZE);
    blocks.push({
      blockId: `block-${blockIndex}`,
      blockIndex,
      startId: slice[0].id,
      endId: slice[slice.length - 1].id,
      plants: slice,
    });
  }
  return blocks;
}

function cleanWaterTargets(wt?: WaterTargets): WaterTargets | undefined {
  if (!wt) return undefined;
  const rawPpmMin = Math.min(5000, Math.max(0, Math.round(Number(wt.ppmMin) || 0)));
  const rawPpmMax = Math.min(5000, Math.max(0, Math.round(Number(wt.ppmMax) || 0)));
  const rawPhMin = Number(Math.min(14, Math.max(0, Number(wt.phMin) || 0)).toFixed(2));
  const rawPhMax = Number(Math.min(14, Math.max(0, Number(wt.phMax) || 0)).toFixed(2));
  return {
    useCustom: Boolean(wt.useCustom),
    ppmMin: Math.min(rawPpmMin, rawPpmMax),
    ppmMax: Math.max(rawPpmMin, rawPpmMax),
    phMin: Math.min(rawPhMin, rawPhMax),
    phMax: Math.max(rawPhMin, rawPhMax),
  };
}

const VALID_PHASES = ['semai', 'vegetatif', 'generatif', 'pembesaran'] as const;

function buildGreenhouseMetaPayload(
  ownerUid: string,
  seasonId: string,
  gh: GreenhouseData,
  deviceLabel: string
) {
  const ghId = sanitizeId(gh.id, `gh-${Date.now()}`);
  const waterTargets = cleanWaterTargets(gh.waterTargets);
  const safePhase = VALID_PHASES.includes(gh.phase as (typeof VALID_PHASES)[number])
    ? gh.phase
    : 'semai';
  const safeLabel = (deviceLabel || '').trim().slice(0, 120) || 'Perangkat';
  const payload: Record<string, unknown> = {
    id: ghId,
    ownerUid,
    seasonId,
    name: String(gh.name || 'GH').trim().slice(0, 80) || 'GH',
    variety: String(gh.variety || '').slice(0, 100),
    capacity: Math.min(5000, Math.max(1, Number(gh.capacity) || 1000)),
    gulliesCount: Number(gh.gulliesCount) || 1,
    reservoirLiters: Number(gh.reservoirLiters) || 1000,
    plantingDate: String(gh.plantingDate || '').slice(0, 32),
    harvestDate: String(gh.harvestDate || '').slice(0, 32),
    phase: safePhase,
    ecFactor: gh.ecFactor === 700 ? 700 : 500,
    avgMelonWeightKg: Math.min(50, Math.max(0, Number(gh.avgMelonWeightKg ?? 1.5) || 0)),
    currentWater: {
      ppm: Number(gh.currentWater.ppm) || 0,
      ec: Number(gh.currentWater.ec) || 0,
      ph: Number(gh.currentWater.ph) || 0,
      tempC: Number(gh.currentWater.tempC) || 0,
      flowLpm: Number(gh.currentWater.flowLpm) || 0,
      reservoirPct: Number(gh.currentWater.reservoirPct) || 0,
      pumpCirculation: Boolean(gh.currentWater.pumpCirculation),
      pumpNutrientA: Boolean(gh.currentWater.pumpNutrientA),
      pumpNutrientB: Boolean(gh.currentWater.pumpNutrientB),
      pumpPhDown: Boolean(gh.currentWater.pumpPhDown),
      pumpPhUp: Boolean(gh.currentWater.pumpPhUp),
    },
    lastModifiedBy: safeLabel,
  };
  if (waterTargets) {
    payload.waterTargets = waterTargets;
  }
  return { ghId, payload };
}

export async function upsertUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}/profile/info`;
  const ref = doc(db, 'users', user.uid, 'profile', 'info');
  try {
    const snap = await getDoc(ref);
    const data = {
      ownerUid: user.uid,
      email: String(user.email || '').slice(0, 200),
      displayName: String(user.displayName || user.email || 'Pengguna Google').slice(0, 120),
      photoURL: String(user.photoURL || '').slice(0, 500),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function logSupervisionActivity(params: {
  user: User;
  seasonId: string;
  ghId: string;
  ghName: string;
  category: ActivityCategory;
  summary: string;
  deviceLabel: string;
}): Promise<void> {
  const seasonId = sanitizeId(params.seasonId, 'season');
  const ghId = sanitizeId(params.ghId, 'none');
  const actId = sanitizeId(`act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const path = `users/${params.user.uid}/seasons/${seasonId}/activities/${actId}`;
  try {
    await setDoc(doc(db, 'users', params.user.uid, 'seasons', seasonId, 'activities', actId), {
      id: actId,
      ownerUid: params.user.uid,
      seasonId,
      ghId,
      ghName: String(params.ghName || '-').slice(0, 80),
      category: params.category,
      summary: String(params.summary || 'Pembaruan data').trim().slice(0, 300) || 'Pembaruan data',
      deviceLabel: String(params.deviceLabel || 'Perangkat').trim().slice(0, 120) || 'Perangkat',
      actorEmail: String(params.user.email || '').slice(0, 200),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function uploadSeasonToCloud(
  user: User,
  season: SeasonDocument,
  deviceLabel: string
): Promise<string> {
  const seasonId = sanitizeId(season.id, `season-${Date.now()}`);
  const seasonRef = doc(db, 'users', user.uid, 'seasons', seasonId);
  const seasonPath = `users/${user.uid}/seasons/${seasonId}`;

  try {
    const existingSnap = await getDoc(seasonRef);
    const ghOrder = season.greenhouses.slice(0, 50).map((g) => sanitizeId(g.id));
    const activeGhId = ghOrder.includes(sanitizeId(season.activeGhId))
      ? sanitizeId(season.activeGhId)
      : ghOrder[0] || 'gh-1';

    // Batch 1: SeasonMeta + all GreenhouseMeta documents
    const existingGhIds = new Set<string>();
    const metaBatch = writeBatch(db);
    if (!existingSnap.exists()) {
      metaBatch.set(seasonRef, {
        id: seasonId,
        ownerUid: user.uid,
        title: String(season.title || 'Musim Tanam').trim().slice(0, 160) || 'Musim Tanam',
        notes: String(season.notes || '').slice(0, 1000),
        activeGhId,
        greenhouseOrder: ghOrder.length > 0 ? ghOrder : ['gh-1'],
        lastModifiedBy: deviceLabel.trim().slice(0, 120) || 'Perangkat',
        clientUpdatedAt: new Date().toISOString().slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      metaBatch.update(seasonRef, {
        title: String(season.title || 'Musim Tanam').trim().slice(0, 160) || 'Musim Tanam',
        notes: String(season.notes || '').slice(0, 1000),
        activeGhId,
        greenhouseOrder: ghOrder.length > 0 ? ghOrder : ['gh-1'],
        lastModifiedBy: deviceLabel.trim().slice(0, 120) || 'Perangkat',
        clientUpdatedAt: new Date().toISOString().slice(0, 64),
        updatedAt: serverTimestamp(),
      });
    }

    for (const gh of season.greenhouses.slice(0, 50)) {
      const { ghId, payload } = buildGreenhouseMetaPayload(user.uid, seasonId, gh, deviceLabel);
      const ghRef = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId);
      const ghSnap = await getDoc(ghRef);
      if (!ghSnap.exists()) {
        metaBatch.set(ghRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        existingGhIds.add(ghId);
        const updateFields: Record<string, unknown> = {
          name: payload.name,
          variety: payload.variety,
          capacity: payload.capacity,
          gulliesCount: payload.gulliesCount,
          reservoirLiters: payload.reservoirLiters,
          plantingDate: payload.plantingDate,
          harvestDate: payload.harvestDate,
          phase: payload.phase,
          ecFactor: payload.ecFactor,
          avgMelonWeightKg: payload.avgMelonWeightKg,
          currentWater: payload.currentWater,
          lastModifiedBy: payload.lastModifiedBy,
          updatedAt: serverTimestamp(),
        };
        if (payload.waterTargets) {
          updateFields.waterTargets = payload.waterTargets;
        }
        metaBatch.update(ghRef, updateFields);
      }
    }
    await metaBatch.commit();

    // Batch subsequent writes (max 350 ops per batch) for waterLogs, treatments, plantBlocks, expenses, sales
    const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];

    for (const gh of season.greenhouses.slice(0, 50)) {
      const ghId = sanitizeId(gh.id);
      const ghAlreadyExisted = existingGhIds.has(ghId);

      // For already-existing GHs, fetch existing subcollection doc IDs so updates respect immutable createdAt rules
      let existingWaterIds = new Set<string>();
      let existingTreatmentIds = new Set<string>();
      let existingExpenseIds = new Set<string>();
      let existingSaleIds = new Set<string>();
      let existingBlockIds = new Set<string>();

      if (ghAlreadyExisted) {
        const [wSnap, tSnap, eSnap, sSnap, pSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks'), where('ownerUid', '==', user.uid))),
        ]);
        existingWaterIds = new Set(wSnap.docs.map((d) => d.id));
        existingTreatmentIds = new Set(tSnap.docs.map((d) => d.id));
        existingExpenseIds = new Set(eSnap.docs.map((d) => d.id));
        existingSaleIds = new Set(sSnap.docs.map((d) => d.id));
        existingBlockIds = new Set(pSnap.docs.map((d) => d.id));
      }

      const nextWaterIds = new Set<string>();
      for (const log of gh.waterLogs) {
        const { logId, payload } = cleanWaterLogForCloud(user.uid, log);
        nextWaterIds.add(logId);
        const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs', logId);
        if (existingWaterIds.has(logId)) {
          const waterUpdateFields: Record<string, unknown> = {
            timestamp: payload.timestamp,
            ppm: payload.ppm,
            ec: payload.ec,
            ph: payload.ph,
            tempC: payload.tempC,
            flowLpm: payload.flowLpm,
            reservoirPct: payload.reservoirPct,
            abMixAddedMl: payload.abMixAddedMl,
            phAdjMl: payload.phAdjMl,
            phAdjType: payload.phAdjType,
            source: payload.source,
            operator: payload.operator,
            note: payload.note,
            plantAgeHst: 'plantAgeHst' in payload ? payload.plantAgeHst : deleteField(),
            ppmBefore: 'ppmBefore' in payload ? payload.ppmBefore : deleteField(),
            phBefore: 'phBefore' in payload ? payload.phBefore : deleteField(),
            waterAddedLiters: 'waterAddedLiters' in payload ? payload.waterAddedLiters : deleteField(),
            nutrientAddedLiters: 'nutrientAddedLiters' in payload ? payload.nutrientAddedLiters : deleteField(),
            phChemical: 'phChemical' in payload ? payload.phChemical : deleteField(),
            updatedAt: serverTimestamp(),
          };
          ops.push((b) => b.update(ref, waterUpdateFields));
        } else {
          ops.push((b) =>
            b.set(ref, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      for (const oldId of existingWaterIds) {
        if (!nextWaterIds.has(oldId)) {
          const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs', oldId);
          ops.push((b) => b.delete(ref));
        }
      }

      const nextTreatmentIds = new Set<string>();
      for (const tr of gh.treatments) {
        const { treatmentId, payload } = cleanTreatmentForCloud(user.uid, tr);
        nextTreatmentIds.add(treatmentId);
        const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments', treatmentId);
        if (existingTreatmentIds.has(treatmentId)) {
          const updateFields: Record<string, unknown> = {
            type: payload.type,
            medicineName: payload.medicineName,
            activeIngredient: payload.activeIngredient,
            dosage: payload.dosage,
            targetPlants: payload.targetPlants,
            scheduledAt: payload.scheduledAt,
            status: payload.status,
            operator: payload.operator,
            notes: payload.notes,
            sprayCategory: 'sprayCategory' in payload ? payload.sprayCategory : deleteField(),
            completedAt: 'completedAt' in payload ? payload.completedAt : deleteField(),
            updatedAt: serverTimestamp(),
          };
          ops.push((b) => b.update(ref, updateFields));
        } else {
          ops.push((b) =>
            b.set(ref, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      for (const oldId of existingTreatmentIds) {
        if (!nextTreatmentIds.has(oldId)) {
          const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments', oldId);
          ops.push((b) => b.delete(ref));
        }
      }

      const nextExpenseIds = new Set<string>();
      for (const exp of gh.expenses || []) {
        const { expenseId, payload } = cleanExpenseForCloud(user.uid, exp);
        nextExpenseIds.add(expenseId);
        const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses', expenseId);
        if (existingExpenseIds.has(expenseId)) {
          ops.push((b) =>
            b.update(ref, {
              date: payload.date,
              category: payload.category,
              itemName: payload.itemName,
              quantity: payload.quantity,
              unit: payload.unit,
              workHours: 'workHours' in payload ? payload.workHours : deleteField(),
              unitPrice: payload.unitPrice,
              totalCost: payload.totalCost,
              notes: payload.notes,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          ops.push((b) =>
            b.set(ref, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      for (const oldId of existingExpenseIds) {
        if (!nextExpenseIds.has(oldId)) {
          const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses', oldId);
          ops.push((b) => b.delete(ref));
        }
      }

      const nextSaleIds = new Set<string>();
      for (const sale of gh.sales || []) {
        const { saleId, payload } = cleanSaleForCloud(user.uid, sale);
        nextSaleIds.add(saleId);
        const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales', saleId);
        if (existingSaleIds.has(saleId)) {
          const updateFields: Record<string, unknown> = {
            date: payload.date,
            grade: payload.grade,
            weightKg: payload.weightKg,
            pricePerKg: payload.pricePerKg,
            totalAmount: payload.totalAmount,
            buyer: payload.buyer,
            notes: payload.notes,
            updatedAt: serverTimestamp(),
          };
          if ('receiptNo' in payload) updateFields.receiptNo = payload.receiptNo;
          if ('paymentStatus' in payload) updateFields.paymentStatus = payload.paymentStatus;
          ops.push((b) => b.update(ref, updateFields));
        } else {
          ops.push((b) =>
            b.set(ref, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      for (const oldId of existingSaleIds) {
        if (!nextSaleIds.has(oldId)) {
          const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales', oldId);
          ops.push((b) => b.delete(ref));
        }
      }

      const nextBlockIds = new Set<string>();
      for (const block of buildPlantBlocks(gh.plants)) {
        nextBlockIds.add(block.blockId);
        const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks', block.blockId);
        if (existingBlockIds.has(block.blockId)) {
          ops.push((b) =>
            b.update(ref, {
              startId: block.startId,
              endId: block.endId,
              plants: block.plants,
              lastModifiedBy: deviceLabel.trim().slice(0, 120) || 'Perangkat',
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          ops.push((b) =>
            b.set(ref, {
              id: block.blockId,
              ownerUid: user.uid,
              blockIndex: block.blockIndex,
              startId: block.startId,
              endId: block.endId,
              plants: block.plants,
              lastModifiedBy: deviceLabel.trim().slice(0, 120) || 'Perangkat',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      for (const oldId of existingBlockIds) {
        if (!nextBlockIds.has(oldId)) {
          const ref = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks', oldId);
          ops.push((b) => b.delete(ref));
        }
      }
    }

    for (let i = 0; i < ops.length; i += 350) {
      const batch = writeBatch(db);
      ops.slice(i, i + 350).forEach((apply) => apply(batch));
      await batch.commit();
    }

    await logSupervisionActivity({
      user,
      seasonId,
      ghId: activeGhId,
      ghName: season.greenhouses[0]?.name || 'GH 1',
      category: 'document',
      summary: `Menyinkronkan dokumen "${season.title.slice(0, 80)}" ke Cloud`,
      deviceLabel,
    });

    return seasonId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, seasonPath);
  }
}

export async function deleteSeasonFromCloud(user: User, seasonIdRaw: string): Promise<void> {
  const seasonId = sanitizeId(seasonIdRaw);
  const seasonPath = `users/${user.uid}/seasons/${seasonId}`;
  try {
    const ghCol = collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses');
    const ghSnap = await getDocs(query(ghCol, where('ownerUid', '==', user.uid)));

    const deletes: Array<ReturnType<typeof doc>> = [];
    for (const ghDoc of ghSnap.docs) {
      const ghId = ghDoc.id;
      for (const sub of ['waterLogs', 'treatments', 'plantBlocks', 'expenses', 'sales'] as const) {
        const subSnap = await getDocs(
          query(
            collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, sub),
            where('ownerUid', '==', user.uid)
          )
        );
        subSnap.docs.forEach((d) => deletes.push(d.ref));
      }
      deletes.push(ghDoc.ref);
    }

    const actSnap = await getDocs(
      query(
        collection(db, 'users', user.uid, 'seasons', seasonId, 'activities'),
        where('ownerUid', '==', user.uid)
      )
    );
    actSnap.docs.forEach((d) => deletes.push(d.ref));
    deletes.push(doc(db, 'users', user.uid, 'seasons', seasonId));

    for (let i = 0; i < deletes.length; i += 350) {
      const batch = writeBatch(db);
      deletes.slice(i, i + 350).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, seasonPath);
  }
}

export async function addGreenhouseToCloud(
  user: User,
  seasonIdRaw: string,
  gh: GreenhouseData,
  nextOrder: string[],
  deviceLabel: string
): Promise<void> {
  const seasonId = sanitizeId(seasonIdRaw);
  const { ghId, payload } = buildGreenhouseMetaPayload(user.uid, seasonId, gh, deviceLabel);
  const path = `users/${user.uid}/seasons/${seasonId}/greenhouses/${ghId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.uid, 'seasons', seasonId), {
      activeGhId: ghId,
      greenhouseOrder: nextOrder.slice(0, 50).map((id) => sanitizeId(id)),
      lastModifiedBy: deviceLabel.slice(0, 120),
      clientUpdatedAt: new Date().toISOString().slice(0, 64),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const block of buildPlantBlocks(gh.plants)) {
      batch.set(
        doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks', block.blockId),
        {
          id: block.blockId,
          ownerUid: user.uid,
          blockIndex: block.blockIndex,
          startId: block.startId,
          endId: block.endId,
          plants: block.plants,
          lastModifiedBy: deviceLabel.slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    }
    await batch.commit();

    await logSupervisionActivity({
      user,
      seasonId,
      ghId,
      ghName: gh.name,
      category: 'greenhouse',
      summary: `Menambahkan ${gh.name} (${gh.variety}, ${gh.capacity} tanaman)`,
      deviceLabel,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGreenhouseFromCloud(
  user: User,
  seasonIdRaw: string,
  ghIdRaw: string,
  ghName: string,
  nextActiveGhId: string,
  nextOrder: string[],
  deviceLabel: string
): Promise<void> {
  const seasonId = sanitizeId(seasonIdRaw);
  const ghId = sanitizeId(ghIdRaw);
  const path = `users/${user.uid}/seasons/${seasonId}/greenhouses/${ghId}`;
  try {
    const deletes: Array<ReturnType<typeof doc>> = [];
    for (const sub of ['waterLogs', 'treatments', 'plantBlocks', 'expenses', 'sales'] as const) {
      const subSnap = await getDocs(
        query(
          collection(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, sub),
          where('ownerUid', '==', user.uid)
        )
      );
      subSnap.docs.forEach((d) => deletes.push(d.ref));
    }
    deletes.push(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId));

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.uid, 'seasons', seasonId), {
      activeGhId: sanitizeId(nextActiveGhId),
      greenhouseOrder: nextOrder.slice(0, 50).map((id) => sanitizeId(id)),
      lastModifiedBy: deviceLabel.slice(0, 120),
      clientUpdatedAt: new Date().toISOString().slice(0, 64),
      updatedAt: serverTimestamp(),
    });
    deletes.slice(0, 350).forEach((ref) => batch.delete(ref));
    await batch.commit();

    if (deletes.length > 350) {
      for (let i = 350; i < deletes.length; i += 350) {
        const b = writeBatch(db);
        deletes.slice(i, i + 350).forEach((ref) => b.delete(ref));
        await b.commit();
      }
    }

    await logSupervisionActivity({
      user,
      seasonId,
      ghId,
      ghName,
      category: 'greenhouse',
      summary: `Menghapus ${ghName}`,
      deviceLabel,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateActiveGhInCloud(
  user: User,
  seasonIdRaw: string,
  activeGhIdRaw: string,
  deviceLabel: string
): Promise<void> {
  const seasonId = sanitizeId(seasonIdRaw);
  const activeGhId = sanitizeId(activeGhIdRaw);
  const path = `users/${user.uid}/seasons/${seasonId}`;
  try {
    await updateDoc(doc(db, 'users', user.uid, 'seasons', seasonId), {
      activeGhId,
      lastModifiedBy: deviceLabel.slice(0, 120),
      clientUpdatedAt: new Date().toISOString().slice(0, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncGreenhouseDeltaToCloud(params: {
  user: User;
  seasonId: string;
  prevGh: GreenhouseData;
  nextGh: GreenhouseData;
  deviceLabel: string;
}): Promise<void> {
  const { user, prevGh, nextGh, deviceLabel } = params;
  const seasonId = sanitizeId(params.seasonId);
  const ghId = sanitizeId(nextGh.id);
  const ghPath = `users/${user.uid}/seasons/${seasonId}/greenhouses/${ghId}`;
  const activitySummaries: Array<{ cat: ActivityCategory; text: string }> = [];

  try {
    const ghRef = doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId);
    const { payload } = buildGreenhouseMetaPayload(user.uid, seasonId, nextGh, deviceLabel);

    const waterChanged = JSON.stringify(prevGh.currentWater) !== JSON.stringify(nextGh.currentWater);
    const harvestChanged = (prevGh.harvestDate || '') !== (nextGh.harvestDate || '');
    const avgWeightChanged =
      (prevGh.avgMelonWeightKg ?? 1.5) !== (nextGh.avgMelonWeightKg ?? 1.5);
    const targetsChanged =
      JSON.stringify(prevGh.waterTargets || null) !== JSON.stringify(nextGh.waterTargets || null);
    const metaChanged =
      prevGh.name !== nextGh.name ||
      prevGh.variety !== nextGh.variety ||
      prevGh.capacity !== nextGh.capacity ||
      prevGh.gulliesCount !== nextGh.gulliesCount ||
      prevGh.reservoirLiters !== nextGh.reservoirLiters ||
      prevGh.plantingDate !== nextGh.plantingDate ||
      prevGh.phase !== nextGh.phase ||
      prevGh.ecFactor !== nextGh.ecFactor;

    if (metaChanged || avgWeightChanged || targetsChanged || harvestChanged || waterChanged) {
      const updateFields: Record<string, unknown> = {
        lastModifiedBy: payload.lastModifiedBy,
        updatedAt: serverTimestamp(),
      };
      if (metaChanged) {
        updateFields.name = payload.name;
        updateFields.variety = payload.variety;
        updateFields.capacity = payload.capacity;
        updateFields.gulliesCount = payload.gulliesCount;
        updateFields.reservoirLiters = payload.reservoirLiters;
        updateFields.plantingDate = payload.plantingDate;
        updateFields.harvestDate = payload.harvestDate;
        updateFields.phase = payload.phase;
        updateFields.ecFactor = payload.ecFactor;
        updateFields.avgMelonWeightKg = payload.avgMelonWeightKg;
        updateFields.currentWater = payload.currentWater;
        if (payload.waterTargets) {
          updateFields.waterTargets = payload.waterTargets;
        }
        activitySummaries.push({
          cat: 'greenhouse',
          text: `Memperbarui profil ${nextGh.name} (${nextGh.phase}, ${nextGh.capacity} pohon)`,
        });
      } else {
        if (avgWeightChanged) {
          updateFields.avgMelonWeightKg = payload.avgMelonWeightKg;
          activitySummaries.push({
            cat: 'plants',
            text: `Mengatur rata-rata berat melon ${nextGh.name}: ${Number(payload.avgMelonWeightKg).toFixed(2)} kg/buah`,
          });
        }
        if (targetsChanged && payload.waterTargets) {
          updateFields.waterTargets = payload.waterTargets;
          const wt = nextGh.waterTargets!;
          activitySummaries.push({
            cat: 'water',
            text: wt.useCustom
              ? `Mengatur batas kustom ${nextGh.name}: ${wt.ppmMin}–${wt.ppmMax} ppm, pH ${wt.phMin.toFixed(1)}–${wt.phMax.toFixed(1)}`
              : `Mengembalikan batas PPM & pH ${nextGh.name} ke standar fase`,
          });
        }
        if (harvestChanged) {
          updateFields.harvestDate = payload.harvestDate;
          activitySummaries.push({
            cat: 'greenhouse',
            text: nextGh.harvestDate
              ? `Menetapkan tanggal panen ${nextGh.name}: ${nextGh.harvestDate}`
              : `Menghapus tanggal panen ${nextGh.name}`,
          });
        }
        if (waterChanged) {
          updateFields.currentWater = payload.currentWater;
          if (
            prevGh.currentWater.ppm !== nextGh.currentWater.ppm ||
            prevGh.currentWater.ph !== nextGh.currentWater.ph
          ) {
            activitySummaries.push({
              cat: 'water',
              text: `Update tandon ${nextGh.name}: ${nextGh.currentWater.ppm} ppm · pH ${nextGh.currentWater.ph}`,
            });
          }
        }
      }
      await updateDoc(ghRef, updateFields);
    }

    // Diff waterLogs
    const prevLogMap = new Map(prevGh.waterLogs.map((l) => [sanitizeId(l.id), l]));
    const nextLogMap = new Map(nextGh.waterLogs.map((l) => [sanitizeId(l.id), l]));

    const deletedLogs = [...prevLogMap.keys()].filter((id) => !nextLogMap.has(id));
    const addedLogs = [...nextLogMap.entries()].filter(([id]) => !prevLogMap.has(id));
    const updatedLogs = [...nextLogMap.entries()].filter(([id, l]) => {
      const prev = prevLogMap.get(id);
      return prev && JSON.stringify(prev) !== JSON.stringify(l);
    });

    for (const logId of deletedLogs) {
      await deleteDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs', logId));
    }
    for (const [logId, log] of addedLogs) {
      const { payload: logPayload } = cleanWaterLogForCloud(user.uid, log);
      await setDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs', logId), {
        ...logPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const [logId, log] of updatedLogs) {
      const { payload: logPayload } = cleanWaterLogForCloud(user.uid, log);
      await updateDoc(
        doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs', logId),
        {
          timestamp: logPayload.timestamp,
          ppm: logPayload.ppm,
          ec: logPayload.ec,
          ph: logPayload.ph,
          tempC: logPayload.tempC,
          flowLpm: logPayload.flowLpm,
          reservoirPct: logPayload.reservoirPct,
          abMixAddedMl: logPayload.abMixAddedMl,
          phAdjMl: logPayload.phAdjMl,
          phAdjType: logPayload.phAdjType,
          source: logPayload.source,
          operator: logPayload.operator,
          note: logPayload.note,
          plantAgeHst: 'plantAgeHst' in logPayload ? logPayload.plantAgeHst : deleteField(),
          ppmBefore: 'ppmBefore' in logPayload ? logPayload.ppmBefore : deleteField(),
          phBefore: 'phBefore' in logPayload ? logPayload.phBefore : deleteField(),
          waterAddedLiters: 'waterAddedLiters' in logPayload ? logPayload.waterAddedLiters : deleteField(),
          nutrientAddedLiters: 'nutrientAddedLiters' in logPayload ? logPayload.nutrientAddedLiters : deleteField(),
          phChemical: 'phChemical' in logPayload ? logPayload.phChemical : deleteField(),
          updatedAt: serverTimestamp(),
        }
      );
    }
    if (addedLogs.length > 0) {
      const latest = addedLogs[0][1];
      const hstPart = latest.plantAgeHst ? `${latest.plantAgeHst} HST · ` : '';
      activitySummaries.push({
        cat: 'water',
        text: `Log air ${nextGh.name}: ${hstPart}PPM ${latest.ppm}, pH ${latest.ph}${latest.note ? ` (${latest.note.slice(0, 60)})` : ''}`,
      });
    } else if (updatedLogs.length > 0) {
      const edited = updatedLogs[0][1];
      const hstPart = edited.plantAgeHst ? `${edited.plantAgeHst} HST · ` : '';
      activitySummaries.push({
        cat: 'water',
        text: `Edit log air ${nextGh.name}: ${hstPart}PPM ${edited.ppm}, pH ${edited.ph}`,
      });
    } else if (deletedLogs.length > 0) {
      activitySummaries.push({
        cat: 'water',
        text: `Menghapus ${deletedLogs.length} log air di ${nextGh.name}`,
      });
    }

    // Diff treatments
    const prevTrMap = new Map(prevGh.treatments.map((t) => [sanitizeId(t.id), t]));
    const nextTrMap = new Map(nextGh.treatments.map((t) => [sanitizeId(t.id), t]));

    const deletedTrs = [...prevTrMap.keys()].filter((id) => !nextTrMap.has(id));
    const addedTrs = [...nextTrMap.entries()].filter(([id]) => !prevTrMap.has(id));
    const updatedTrs = [...nextTrMap.entries()].filter(([id, t]) => {
      const prev = prevTrMap.get(id);
      return prev && JSON.stringify(prev) !== JSON.stringify(t);
    });

    for (const trId of deletedTrs) {
      await deleteDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments', trId));
    }
    for (const [trId, tr] of addedTrs) {
      const { payload: trPayload } = cleanTreatmentForCloud(user.uid, tr);
      await setDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments', trId), {
        ...trPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const [trId, tr] of updatedTrs) {
      const { payload: trPayload } = cleanTreatmentForCloud(user.uid, tr);
      const updateFields: Record<string, unknown> = {
        type: trPayload.type,
        medicineName: trPayload.medicineName,
        activeIngredient: trPayload.activeIngredient,
        dosage: trPayload.dosage,
        targetPlants: trPayload.targetPlants,
        scheduledAt: trPayload.scheduledAt,
        status: trPayload.status,
        operator: trPayload.operator,
        notes: trPayload.notes,
        sprayCategory: 'sprayCategory' in trPayload ? trPayload.sprayCategory : deleteField(),
        completedAt: 'completedAt' in trPayload ? trPayload.completedAt : deleteField(),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(
        doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments', trId),
        updateFields
      );
    }

    if (addedTrs.length > 0) {
      const t = addedTrs[0][1];
      activitySummaries.push({
        cat: 'treatment',
        text: `Jadwal ${t.type} ${t.medicineName} (${nextGh.name})`,
      });
    } else if (updatedTrs.length > 0) {
      const t = updatedTrs[0][1];
      activitySummaries.push({
        cat: 'treatment',
        text: `Perawatan ${t.medicineName} di ${nextGh.name} → ${t.status}`,
      });
    } else if (deletedTrs.length > 0) {
      activitySummaries.push({
        cat: 'treatment',
        text: `Menghapus ${deletedTrs.length} catatan perawatan di ${nextGh.name}`,
      });
    }

    // Diff plantBlocks (100 plants per block)
    const prevBlocks = buildPlantBlocks(prevGh.plants);
    const nextBlocks = buildPlantBlocks(nextGh.plants);
    const prevBlockMap = new Map(prevBlocks.map((b) => [b.blockId, b]));
    const nextBlockMap = new Map(nextBlocks.map((b) => [b.blockId, b]));

    const deletedBlocks = [...prevBlockMap.keys()].filter((id) => !nextBlockMap.has(id));
    const changedBlocks = nextBlocks.filter((b) => {
      const old = prevBlockMap.get(b.blockId);
      return !old || JSON.stringify(old.plants) !== JSON.stringify(b.plants);
    });

    if (deletedBlocks.length > 0 || changedBlocks.length > 0) {
      const batch = writeBatch(db);
      for (const blockId of deletedBlocks) {
        batch.delete(
          doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks', blockId)
        );
      }
      for (const block of changedBlocks) {
        const ref = doc(
          db,
          'users',
          user.uid,
          'seasons',
          seasonId,
          'greenhouses',
          ghId,
          'plantBlocks',
          block.blockId
        );
        const existed = prevBlockMap.has(block.blockId);
        if (existed) {
          batch.update(ref, {
            startId: block.startId,
            endId: block.endId,
            plants: block.plants,
            lastModifiedBy: deviceLabel.slice(0, 120),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            id: block.blockId,
            ownerUid: user.uid,
            blockIndex: block.blockIndex,
            startId: block.startId,
            endId: block.endId,
            plants: block.plants,
            lastModifiedBy: deviceLabel.slice(0, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();

      // Count how many plants changed
      const prevPlantById = new Map(prevGh.plants.map((p) => [p.id, p]));
      let changedCount = 0;
      let sampleId = 0;
      for (const p of nextGh.plants) {
        const oldP = prevPlantById.get(p.id);
        if (!oldP || JSON.stringify(oldP) !== JSON.stringify(p)) {
          changedCount++;
          if (sampleId === 0) sampleId = p.id;
        }
      }
      if (changedCount > 0) {
        activitySummaries.push({
          cat: 'plants',
          text:
            changedCount === 1
              ? `Memperbarui kondisi Tanaman #${sampleId} di ${nextGh.name}`
              : `Memperbarui kondisi ${changedCount} tanaman di ${nextGh.name}`,
        });
      }
    }

    // Diff expenses
    const prevExpMap = new Map((prevGh.expenses || []).map((e) => [sanitizeId(e.id), e]));
    const nextExpMap = new Map((nextGh.expenses || []).map((e) => [sanitizeId(e.id), e]));
    const deletedExps = [...prevExpMap.keys()].filter((id) => !nextExpMap.has(id));
    const addedExps = [...nextExpMap.entries()].filter(([id]) => !prevExpMap.has(id));
    const updatedExps = [...nextExpMap.entries()].filter(([id, e]) => {
      const prev = prevExpMap.get(id);
      return prev && JSON.stringify(prev) !== JSON.stringify(e);
    });

    for (const expId of deletedExps) {
      await deleteDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses', expId));
    }
    for (const [expId, exp] of addedExps) {
      const { payload: expPayload } = cleanExpenseForCloud(user.uid, exp);
      await setDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses', expId), {
        ...expPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const [expId, exp] of updatedExps) {
      const { payload: expPayload } = cleanExpenseForCloud(user.uid, exp);
      await updateDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses', expId), {
        date: expPayload.date,
        category: expPayload.category,
        itemName: expPayload.itemName,
        quantity: expPayload.quantity,
        unit: expPayload.unit,
        workHours: 'workHours' in expPayload ? expPayload.workHours : deleteField(),
        unitPrice: expPayload.unitPrice,
        totalCost: expPayload.totalCost,
        notes: expPayload.notes,
        updatedAt: serverTimestamp(),
      });
    }
    if (addedExps.length > 0) {
      const e = addedExps[0][1];
      activitySummaries.push({
        cat: 'accounting',
        text: `Biaya produksi ${nextGh.name}: ${e.itemName} (Rp ${e.totalCost.toLocaleString('id-ID')})`,
      });
    } else if (deletedExps.length > 0) {
      activitySummaries.push({
        cat: 'accounting',
        text: `Menghapus ${deletedExps.length} catatan biaya di ${nextGh.name}`,
      });
    }

    // Diff sales
    const prevSaleMap = new Map((prevGh.sales || []).map((s) => [sanitizeId(s.id), s]));
    const nextSaleMap = new Map((nextGh.sales || []).map((s) => [sanitizeId(s.id), s]));
    const deletedSales = [...prevSaleMap.keys()].filter((id) => !nextSaleMap.has(id));
    const addedSales = [...nextSaleMap.entries()].filter(([id]) => !prevSaleMap.has(id));
    const updatedSales = [...nextSaleMap.entries()].filter(([id, s]) => {
      const prev = prevSaleMap.get(id);
      return prev && JSON.stringify(prev) !== JSON.stringify(s);
    });

    for (const saleId of deletedSales) {
      await deleteDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales', saleId));
    }
    for (const [saleId, sale] of addedSales) {
      const { payload: salePayload } = cleanSaleForCloud(user.uid, sale);
      await setDoc(doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales', saleId), {
        ...salePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const [saleId, sale] of updatedSales) {
      const { payload: salePayload } = cleanSaleForCloud(user.uid, sale);
      const saleUpdateFields: Record<string, unknown> = {
        date: salePayload.date,
        grade: salePayload.grade,
        weightKg: salePayload.weightKg,
        pricePerKg: salePayload.pricePerKg,
        totalAmount: salePayload.totalAmount,
        buyer: salePayload.buyer,
        notes: salePayload.notes,
        updatedAt: serverTimestamp(),
      };
      if ('receiptNo' in salePayload) {
        saleUpdateFields.receiptNo = salePayload.receiptNo;
      }
      if ('paymentStatus' in salePayload) {
        saleUpdateFields.paymentStatus = salePayload.paymentStatus;
      }
      await updateDoc(
        doc(db, 'users', user.uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales', saleId),
        saleUpdateFields
      );
    }
    if (addedSales.length > 0) {
      const s = addedSales[0][1];
      activitySummaries.push({
        cat: 'accounting',
        text: `Penjualan ${nextGh.name}: ${s.grade} ${s.weightKg} kg (Rp ${s.totalAmount.toLocaleString('id-ID')})`,
      });
    } else if (updatedSales.length > 0) {
      const s = updatedSales[0][1];
      const statusTxt =
        s.paymentStatus === 'sudah_dibayar'
          ? 'Sudah Dibayar'
          : s.paymentStatus === 'belum_dibayar'
          ? 'Belum Dibayar'
          : 'diperbarui';
      activitySummaries.push({
        cat: 'accounting',
        text: `Penjualan ${s.buyer || s.grade} (${nextGh.name}) → ${statusTxt}`,
      });
    } else if (deletedSales.length > 0) {
      activitySummaries.push({
        cat: 'accounting',
        text: `Menghapus ${deletedSales.length} catatan penjualan di ${nextGh.name}`,
      });
    }

    for (const item of activitySummaries) {
      await logSupervisionActivity({
        user,
        seasonId,
        ghId,
        ghName: nextGh.name,
        category: item.cat,
        summary: item.text,
        deviceLabel,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ghPath);
  }
}

export interface CloudSeasonMeta {
  id: string;
  title: string;
  notes: string;
  activeGhId: string;
  greenhouseOrder: string[];
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
}

export function subscribeUserSeasons(
  uid: string,
  onSeasons: (metas: CloudSeasonMeta[]) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  const path = `users/${uid}/seasons`;
  const q = query(collection(db, 'users', uid, 'seasons'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: CloudSeasonMeta[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          title: String(data.title || 'Musim Tanam'),
          notes: String(data.notes || ''),
          activeGhId: String(data.activeGhId || 'gh-1'),
          greenhouseOrder: Array.isArray(data.greenhouseOrder)
            ? (data.greenhouseOrder as string[])
            : [],
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
          lastModifiedBy: String(data.lastModifiedBy || ''),
        };
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onSeasons(list);
    },
    (error) => {
      const msg = formatFirestoreError(error, OperationType.LIST, path);
      onError?.(msg);
    }
  );
}

type ChildSubKey = 'w' | 't' | 'p' | 'e' | 's';

export function subscribeSeasonRealtime(
  uid: string,
  seasonMeta: CloudSeasonMeta,
  onHydratedSeason: (season: SeasonDocument) => void,
  onActivities: (activities: SupervisionActivity[]) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  const seasonId = seasonMeta.id;
  const ghColPath = `users/${uid}/seasons/${seasonId}/greenhouses`;

  const ghBaseMap = new Map<
    string,
    Omit<GreenhouseData, 'waterLogs' | 'treatments' | 'plants' | 'expenses' | 'sales'>
  >();
  const waterLogsByGh = new Map<string, WaterLogEntry[]>();
  const treatmentsByGh = new Map<string, TreatmentRecord[]>();
  const plantsByGh = new Map<string, PlantCondition[]>();
  const expensesByGh = new Map<string, ProductionExpenseEntry[]>();
  const salesByGh = new Map<string, SaleRecord[]>();
  const subUnsubs = new Map<string, Unsubscribe[]>();
  const loadedChildrenByGh = new Map<string, Set<ChildSubKey>>();
  let ghListReady = false;

  const markChildReady = (ghId: string, key: ChildSubKey) => {
    let set = loadedChildrenByGh.get(ghId);
    if (!set) {
      set = new Set<ChildSubKey>();
      loadedChildrenByGh.set(ghId, set);
    }
    set.add(key);
  };

  const emit = () => {
    if (!ghListReady || ghBaseMap.size === 0) return;
    for (const ghId of ghBaseMap.keys()) {
      const done = loadedChildrenByGh.get(ghId);
      if (!done || done.size < 5) {
        return;
      }
    }

    const orderedIds = [
      ...seasonMeta.greenhouseOrder.filter((id) => ghBaseMap.has(id)),
      ...[...ghBaseMap.keys()].filter((id) => !seasonMeta.greenhouseOrder.includes(id)),
    ];
    const greenhouses: GreenhouseData[] = orderedIds.map((id, idx) => {
      const base = ghBaseMap.get(id)!;
      return normalizeGreenhouse(
        {
          ...base,
          waterLogs: waterLogsByGh.get(id) || [],
          treatments: treatmentsByGh.get(id) || [],
          plants: plantsByGh.get(id) || [],
          expenses: expensesByGh.get(id) || [],
          sales: salesByGh.get(id) || [],
        },
        idx
      );
    });

    const activeGhId = greenhouses.some((g) => g.id === seasonMeta.activeGhId)
      ? seasonMeta.activeGhId
      : greenhouses[0]?.id || 'gh-1';

    onHydratedSeason({
      id: seasonMeta.id,
      title: seasonMeta.title,
      notes: seasonMeta.notes,
      createdAt: seasonMeta.createdAt,
      updatedAt: seasonMeta.updatedAt,
      activeGhId,
      greenhouses,
    });
  };

  const attachGhChildren = (ghId: string) => {
    if (subUnsubs.has(ghId)) return;

    const wPath = `users/${uid}/seasons/${seasonId}/greenhouses/${ghId}/waterLogs`;
    const u1 = onSnapshot(
      query(
        collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        const logs = snap.docs
          .map((d) => d.data() as WaterLogEntry)
          .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        waterLogsByGh.set(ghId, logs);
        markChildReady(ghId, 'w');
        emit();
      },
      (err) => {
        const msg = formatFirestoreError(err, OperationType.LIST, wPath);
        onError?.(msg);
      }
    );

    const tPath = `users/${uid}/seasons/${seasonId}/greenhouses/${ghId}/treatments`;
    const u2 = onSnapshot(
      query(
        collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as TreatmentRecord)
          .sort((a, b) => String(b.scheduledAt || '').localeCompare(String(a.scheduledAt || '')));
        treatmentsByGh.set(ghId, items);
        markChildReady(ghId, 't');
        emit();
      },
      (err) => {
        const msg = formatFirestoreError(err, OperationType.LIST, tPath);
        onError?.(msg);
      }
    );

    const pPath = `users/${uid}/seasons/${seasonId}/greenhouses/${ghId}/plantBlocks`;
    const u3 = onSnapshot(
      query(
        collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        const allPlants: PlantCondition[] = [];
        const sortedDocs = [...snap.docs].sort(
          (a, b) => Number(a.data().blockIndex || 0) - Number(b.data().blockIndex || 0)
        );
        for (const blockDoc of sortedDocs) {
          const arr = blockDoc.data().plants;
          if (Array.isArray(arr)) {
            allPlants.push(...(arr as PlantCondition[]));
          }
        }
        allPlants.sort((a, b) => a.id - b.id);
        plantsByGh.set(ghId, allPlants);
        markChildReady(ghId, 'p');
        emit();
      },
      (err) => {
        const msg = formatFirestoreError(err, OperationType.LIST, pPath);
        onError?.(msg);
      }
    );

    const ePath = `users/${uid}/seasons/${seasonId}/greenhouses/${ghId}/expenses`;
    const u4 = onSnapshot(
      query(
        collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as ProductionExpenseEntry)
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        expensesByGh.set(ghId, items);
        markChildReady(ghId, 'e');
        emit();
      },
      (err) => {
        const msg = formatFirestoreError(err, OperationType.LIST, ePath);
        onError?.(msg);
      }
    );

    const sPath = `users/${uid}/seasons/${seasonId}/greenhouses/${ghId}/sales`;
    const u5 = onSnapshot(
      query(
        collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as SaleRecord)
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        salesByGh.set(ghId, items);
        markChildReady(ghId, 's');
        emit();
      },
      (err) => {
        const msg = formatFirestoreError(err, OperationType.LIST, sPath);
        onError?.(msg);
      }
    );

    subUnsubs.set(ghId, [u1, u2, u3, u4, u5]);
  };

  const ghUnsub = onSnapshot(
    query(
      collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses'),
      where('ownerUid', '==', uid)
    ),
    (snap) => {
      const seen = new Set<string>();
      for (const ghDoc of snap.docs) {
        const d = ghDoc.data();
        const ghId = String(d.id || ghDoc.id);
        seen.add(ghId);
        ghBaseMap.set(ghId, {
          id: ghId,
          name: String(d.name || 'GH'),
          variety: String(d.variety || ''),
          capacity: Number(d.capacity) || 1000,
          gulliesCount: Number(d.gulliesCount) || 20,
          reservoirLiters: Number(d.reservoirLiters) || 2000,
          plantingDate: String(d.plantingDate || ''),
          harvestDate: String(d.harvestDate || ''),
          phase: d.phase,
          ecFactor: d.ecFactor === 700 ? 700 : 500,
          avgMelonWeightKg:
            typeof d.avgMelonWeightKg === 'number' && !Number.isNaN(d.avgMelonWeightKg)
              ? d.avgMelonWeightKg
              : undefined,
          waterTargets:
            d.waterTargets && typeof d.waterTargets === 'object'
              ? {
                  useCustom: Boolean(d.waterTargets.useCustom),
                  ppmMin: Number(d.waterTargets.ppmMin) || 500,
                  ppmMax: Number(d.waterTargets.ppmMax) || 1000,
                  phMin: Number(d.waterTargets.phMin) || 6.5,
                  phMax: Number(d.waterTargets.phMax) || 7.0,
                }
              : undefined,
          currentWater: d.currentWater,
        });
        attachGhChildren(ghId);
      }
      for (const oldId of [...ghBaseMap.keys()]) {
        if (!seen.has(oldId)) {
          ghBaseMap.delete(oldId);
          waterLogsByGh.delete(oldId);
          treatmentsByGh.delete(oldId);
          plantsByGh.delete(oldId);
          expensesByGh.delete(oldId);
          salesByGh.delete(oldId);
          loadedChildrenByGh.delete(oldId);
          const list = subUnsubs.get(oldId);
          list?.forEach((u) => u());
          subUnsubs.delete(oldId);
        }
      }
      ghListReady = true;
      emit();
    },
    (err) => {
      const msg = formatFirestoreError(err, OperationType.LIST, ghColPath);
      onError?.(msg);
    }
  );

  const actPath = `users/${uid}/seasons/${seasonId}/activities`;
  const actUnsub = onSnapshot(
    query(
      collection(db, 'users', uid, 'seasons', seasonId, 'activities'),
      where('ownerUid', '==', uid)
    ),
    (snap) => {
      const list: SupervisionActivity[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            seasonId: String(data.seasonId || seasonId),
            ghId: String(data.ghId || ''),
            ghName: String(data.ghName || '-'),
            category: (data.category as ActivityCategory) || 'document',
            summary: String(data.summary || ''),
            deviceLabel: String(data.deviceLabel || 'Perangkat'),
            actorEmail: String(data.actorEmail || ''),
            createdAt: toIsoString(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40);
      onActivities(list);
    },
    (err) => {
      formatFirestoreError(err, OperationType.LIST, actPath);
    }
  );

  return () => {
    ghUnsub();
    actUnsub();
    for (const unsubs of subUnsubs.values()) {
      unsubs.forEach((u) => u());
    }
    subUnsubs.clear();
    loadedChildrenByGh.clear();
  };
}

export async function fetchSeasonFromCloud(
  uid: string,
  seasonMeta: CloudSeasonMeta
): Promise<SeasonDocument | null> {
  const seasonId = sanitizeId(seasonMeta.id);
  const ghColPath = `users/${uid}/seasons/${seasonId}/greenhouses`;
  try {
    const ghSnap = await getDocs(
      query(collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses'), where('ownerUid', '==', uid))
    );
    if (ghSnap.empty) return null;

    const ghMap = new Map<string, GreenhouseData>();
    for (const ghDoc of ghSnap.docs) {
      const d = ghDoc.data();
      const ghId = String(d.id || ghDoc.id);
      const [wSnap, tSnap, pSnap, eSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'waterLogs'), where('ownerUid', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'treatments'), where('ownerUid', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'plantBlocks'), where('ownerUid', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'expenses'), where('ownerUid', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'seasons', seasonId, 'greenhouses', ghId, 'sales'), where('ownerUid', '==', uid))),
      ]);

      const waterLogs = wSnap.docs
        .map((x) => x.data() as WaterLogEntry)
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      const treatments = tSnap.docs
        .map((x) => x.data() as TreatmentRecord)
        .sort((a, b) => String(b.scheduledAt).localeCompare(String(a.scheduledAt)));
      const plants: PlantCondition[] = [];
      const sortedBlocks = [...pSnap.docs].sort(
        (a, b) => Number(a.data().blockIndex || 0) - Number(b.data().blockIndex || 0)
      );
      for (const blk of sortedBlocks) {
        const arr = blk.data().plants;
        if (Array.isArray(arr)) plants.push(...(arr as PlantCondition[]));
      }
      plants.sort((a, b) => a.id - b.id);
      const expenses = eSnap.docs
        .map((x) => x.data() as ProductionExpenseEntry)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const sales = sSnap.docs
        .map((x) => x.data() as SaleRecord)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

      ghMap.set(
        ghId,
        normalizeGreenhouse({
          id: ghId,
          name: String(d.name || 'GH'),
          variety: String(d.variety || ''),
          capacity: Number(d.capacity) || 1000,
          gulliesCount: Number(d.gulliesCount) || 20,
          reservoirLiters: Number(d.reservoirLiters) || 2000,
          plantingDate: String(d.plantingDate || ''),
          harvestDate: String(d.harvestDate || ''),
          phase: d.phase,
          ecFactor: d.ecFactor === 700 ? 700 : 500,
          avgMelonWeightKg:
            typeof d.avgMelonWeightKg === 'number' && !Number.isNaN(d.avgMelonWeightKg)
              ? d.avgMelonWeightKg
              : undefined,
          waterTargets:
            d.waterTargets && typeof d.waterTargets === 'object'
              ? {
                  useCustom: Boolean(d.waterTargets.useCustom),
                  ppmMin: Number(d.waterTargets.ppmMin) || 500,
                  ppmMax: Number(d.waterTargets.ppmMax) || 1000,
                  phMin: Number(d.waterTargets.phMin) || 6.5,
                  phMax: Number(d.waterTargets.phMax) || 7.0,
                }
              : undefined,
          currentWater: d.currentWater,
          waterLogs,
          treatments,
          plants,
          expenses,
          sales,
        })
      );
    }

    const orderedIds = [
      ...seasonMeta.greenhouseOrder.filter((id) => ghMap.has(id)),
      ...[...ghMap.keys()].filter((id) => !seasonMeta.greenhouseOrder.includes(id)),
    ];
    const greenhouses = orderedIds.map((id) => ghMap.get(id)!);
    const activeGhId = greenhouses.some((g) => g.id === seasonMeta.activeGhId)
      ? seasonMeta.activeGhId
      : greenhouses[0]?.id || 'gh-1';

    return {
      id: seasonMeta.id,
      title: seasonMeta.title,
      notes: seasonMeta.notes,
      createdAt: seasonMeta.createdAt,
      updatedAt: seasonMeta.updatedAt,
      activeGhId,
      greenhouses,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, ghColPath);
  }
}

export async function savePaymentProfileToCloud(
  user: User,
  profile: SelfSalePaymentProfile,
  deviceLabel: string
): Promise<void> {
  const path = `users/${user.uid}/paymentProfile/default`;
  const ref = doc(db, 'users', user.uid, 'paymentProfile', 'default');
  try {
    const snap = await getDoc(ref);
    const fields = {
      storeName: String(profile.storeName || 'Kebun MelonFlow NFT').slice(0, 120),
      storePhone: String(profile.storePhone || '').slice(0, 40),
      storeAddress: String(profile.storeAddress || '').slice(0, 250),
      bankName: String(profile.bankName || '').slice(0, 80),
      accountNumber: String(profile.accountNumber || '').slice(0, 64),
      accountHolderName: String(profile.accountHolderName || '').slice(0, 120),
      qrisImageDataUrl: String(profile.qrisImageDataUrl || '').slice(0, 300000),
      footerNote: String(profile.footerNote || '').slice(0, 250),
      lastModifiedBy: String(deviceLabel || 'Perangkat').slice(0, 120),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        id: 'default',
        ownerUid: user.uid,
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribePaymentProfileRealtime(
  uid: string,
  onProfile: (profile: SelfSalePaymentProfile | null) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  const path = `users/${uid}/paymentProfile`;
  const q = query(collection(db, 'users', uid, 'paymentProfile'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const target = snap.docs.find((d) => d.id === 'default') || snap.docs[0];
      if (!target) {
        onProfile(null);
        return;
      }
      const d = target.data();
      onProfile({
        storeName: String(d.storeName || 'Kebun MelonFlow NFT'),
        storePhone: String(d.storePhone || ''),
        storeAddress: String(d.storeAddress || ''),
        bankName: String(d.bankName || ''),
        accountNumber: String(d.accountNumber || ''),
        accountHolderName: String(d.accountHolderName || ''),
        qrisImageDataUrl: String(d.qrisImageDataUrl || ''),
        footerNote: String(d.footerNote || ''),
        updatedAt: toIsoString(d.updatedAt),
      });
    },
    (error) => {
      const msg = formatFirestoreError(error, OperationType.LIST, path);
      onError?.(msg);
    }
  );
}


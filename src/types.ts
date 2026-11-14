export type BotanicalThemeId =
  | 'daun-melon'
  | 'rumah-kaca'
  | 'hidroponik-malam'
  | 'embun-obsidian'
  | 'karbon-melon'
  | 'tanah-bambu'
  | 'kabut-pagi';

export type FontOptionId =
  | 'jakarta'
  | 'outfit'
  | 'bricolage'
  | 'manrope'
  | 'dmsans'
  | 'lora';

export type DashboardTab = 'water' | 'treatment' | 'plants' | 'accounting';

export type GrowthPhase = 'semai' | 'vegetatif' | 'generatif' | 'pembesaran';

export type SprayCategory = 'pupuk' | 'insektisida' | 'fungisida';
export type TreatmentType = 'penyemprotan' | 'pengolesan' | 'pengocoran';
export type TreatmentStatus = 'terjadwal' | 'selesai';

export type PlantHealthStatus = 'sehat' | 'perhatian' | 'sakit' | 'panen' | 'kosong';
export type FruitingStatus = 'berbuah' | 'tidak_berbuah';

export type ExpenseCategory =
  | 'pupuk'
  | 'fungisida'
  | 'insektisida'
  | 'tenaga_kerja'
  | 'lainnya';

export interface ProductionExpenseEntry {
  id: string;
  date: string;
  category: ExpenseCategory;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  notes: string;
  createdAt?: string;
}

export type SaleGrade =
  | 'Grade A'
  | 'Grade B'
  | 'Grade C'
  | 'Grade D'
  | 'Plonco'
  | 'Jual sendiri';

export interface SaleRecord {
  id: string;
  date: string;
  grade: SaleGrade;
  weightKg: number;
  pricePerKg: number;
  totalAmount: number;
  buyer: string;
  notes: string;
  receiptNo?: string;
  createdAt?: string;
}

export interface SelfSalePaymentProfile {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  qrisImageDataUrl: string;
  footerNote: string;
  updatedAt?: string;
}

export interface SelfSaleReceiptItem {
  id: string;
  name: string;
  weightKg: number;
  pricePerKg: number;
  subtotal: number;
}

export interface SelfSaleReceipt {
  id: string;
  receiptNumber: string;
  date: string;
  saleId?: string;
  ghName: string;
  buyerName: string;
  buyerPhone?: string;
  paymentMethod: 'QRIS / Transfer' | 'QRIS' | 'Transfer Rekening' | 'Tunai';
  items: SelfSaleReceiptItem[];
  totalWeightKg: number;
  totalAmount: number;
  notes: string;
  paperFormat: 'thermal80' | 'a4';
  createdAt?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  browserNotify: boolean;
  ppmMin: number;
  ppmMax: number;
  phMin: number;
  phMax: number;
  treatmentReminder: boolean;
  sickPlantThreshold: number;
}

export interface AppSettings {
  themeId: BotanicalThemeId;
  fontId: FontOptionId;
  accentColor: string;
  notifications: NotificationSettings;
}

export interface WaterLogEntry {
  id: string;
  timestamp: string;
  ppmBefore?: number;
  ppm: number;
  ec: number;
  phBefore?: number;
  ph: number;
  tempC: number;
  flowLpm: number;
  reservoirPct: number;
  waterAddedLiters?: number;
  nutrientAddedLiters?: number;
  abMixAddedMl: number;
  phAdjMl: number;
  phAdjType: 'none' | 'up' | 'down';
  phChemical?: 'none' | 'KOH' | 'Phosphoric';
  source: 'manual' | 'dosing';
  operator: string;
  note: string;
}

export interface WaterState {
  ppm: number;
  ec: number;
  ph: number;
  tempC: number;
  flowLpm: number;
  reservoirPct: number;
  pumpCirculation: boolean;
  pumpNutrientA: boolean;
  pumpNutrientB: boolean;
  pumpPhDown: boolean;
  pumpPhUp: boolean;
}

export interface TreatmentRecord {
  id: string;
  type: TreatmentType;
  sprayCategory?: SprayCategory;
  medicineName: string;
  activeIngredient: string;
  dosage: string;
  targetPlants: string;
  scheduledAt: string;
  completedAt?: string;
  status: TreatmentStatus;
  operator: string;
  notes: string;
}

export interface PlantCondition {
  id: number;
  status: PlantHealthStatus;
  fruitingStatus?: FruitingStatus;
  symptom: string;
  heightCm: number;
  fruitCount: number;
  estWeightKg: number;
  brix: number;
  lastAction: string;
  notes: string;
  harvestDate?: string;
  inspectionDate?: string;
  updatedAt: string;
}

export interface WaterTargets {
  useCustom: boolean;
  ppmMin: number;
  ppmMax: number;
  phMin: number;
  phMax: number;
}

export interface GreenhouseData {
  id: string;
  name: string;
  variety: string;
  capacity: number;
  gulliesCount: number;
  reservoirLiters: number;
  plantingDate: string;
  harvestDate?: string;
  phase: GrowthPhase;
  ecFactor: 500 | 700;
  avgMelonWeightKg?: number;
  waterTargets?: WaterTargets;
  currentWater: WaterState;
  waterLogs: WaterLogEntry[];
  treatments: TreatmentRecord[];
  plants: PlantCondition[];
  expenses?: ProductionExpenseEntry[];
  sales?: SaleRecord[];
}

export interface SeasonDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  activeGhId: string;
  greenhouses: GreenhouseData[];
}

export interface AppAlert {
  id: string;
  level: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

export type ActivityCategory =
  | 'water'
  | 'treatment'
  | 'plants'
  | 'accounting'
  | 'greenhouse'
  | 'document';

export interface SupervisionActivity {
  id: string;
  seasonId: string;
  ghId: string;
  ghName: string;
  category: ActivityCategory;
  summary: string;
  deviceLabel: string;
  actorEmail: string;
  createdAt: string;
}

export interface PrintSelection {
  water: boolean;
  treatment: boolean;
  plants: boolean;
  accountingExpenses: boolean;
  accountingSales: boolean;
  accountingProfit: boolean;
}

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

export type DashboardTab = 'water' | 'treatment' | 'plants';

export type GrowthPhase = 'semai' | 'vegetatif' | 'generatif' | 'pembesaran';

export type SprayCategory = 'pupuk' | 'insektisida' | 'fungisida';
export type TreatmentType = 'penyemprotan' | 'pengolesan' | 'pengocoran';
export type TreatmentStatus = 'terjadwal' | 'selesai';

export type PlantHealthStatus = 'sehat' | 'perhatian' | 'sakit' | 'panen' | 'kosong';
export type FruitingStatus = 'berbuah' | 'tidak_berbuah';

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
  waterTargets?: WaterTargets;
  currentWater: WaterState;
  waterLogs: WaterLogEntry[];
  treatments: TreatmentRecord[];
  plants: PlantCondition[];
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

export type ActivityCategory = 'water' | 'treatment' | 'plants' | 'greenhouse' | 'document';

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

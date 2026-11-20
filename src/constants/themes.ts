import {
  BotanicalThemeId,
  ExpenseCategory,
  FontOptionId,
  FruitQuality,
  FruitingStatus,
  GrowthPhase,
  PlantHealthStatus,
  SaleGrade,
  SprayCategory,
  TreatmentType,
} from '../types';

export interface BotanicalThemeDefinition {
  id: BotanicalThemeId;
  name: string;
  description: string;
  isDark: boolean;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  defaultAccent: string;
  swatches: [string, string, string];
}

export const BOTANICAL_THEMES: BotanicalThemeDefinition[] = [
  {
    id: 'daun-melon',
    name: 'Daun Melon Segar',
    description: 'Putih bersih dengan sentuhan hijau daun melon yang sejuk untuk pemantauan siang hari.',
    isDark: false,
    canvas: '#F6F9F6',
    surface: '#FFFFFF',
    surfaceMuted: '#EDF3ED',
    border: '#D7E2D8',
    text: '#112015',
    textMuted: '#4E6152',
    defaultAccent: '#15803D',
    swatches: ['#F6F9F6', '#FFFFFF', '#15803D'],
  },
  {
    id: 'rumah-kaca',
    name: 'Rumah Kaca Pagi',
    description: 'Kontras terang ala rumah kaca polikarbonat dengan nuansa lime & lumut segar.',
    isDark: false,
    canvas: '#F8FAF5',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF3E6',
    border: '#DCE4D0',
    text: '#192211',
    textMuted: '#58664B',
    defaultAccent: '#4D7C0F',
    swatches: ['#F8FAF5', '#FFFFFF', '#4D7C0F'],
  },
  {
    id: 'hidroponik-malam',
    name: 'Hidroponik Malam',
    description: 'Mode gelap intensitas rendah untuk inspeksi malam hari dengan aksen mint presisi.',
    isDark: true,
    canvas: '#0B120E',
    surface: '#121C16',
    surfaceMuted: '#1A271F',
    border: '#25382D',
    text: '#ECF4EE',
    textMuted: '#99B0A0',
    defaultAccent: '#10B981',
    swatches: ['#0B120E', '#121C16', '#10B981'],
  },
  {
    id: 'embun-obsidian',
    name: 'Embun Obsidian',
    description: 'Mode gelap biru-slate dalam untuk ketajaman angka nutrisi & pH di ruang kontrol.',
    isDark: true,
    canvas: '#090D12',
    surface: '#111821',
    surfaceMuted: '#192330',
    border: '#273547',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    defaultAccent: '#06B6D4',
    swatches: ['#090D12', '#111821', '#06B6D4'],
  },
  {
    id: 'karbon-melon',
    name: 'Karbon Emas Melon',
    description: 'Mode gelap hangat bernuansa karbon & emas panen melon yang lembut di mata.',
    isDark: true,
    canvas: '#12100C',
    surface: '#1C1913',
    surfaceMuted: '#26221A',
    border: '#383226',
    text: '#F7F3E8',
    textMuted: '#B3AA97',
    defaultAccent: '#F59E0B',
    swatches: ['#12100C', '#1C1913', '#F59E0B'],
  },
  {
    id: 'tanah-bambu',
    name: 'Bambu & Kebun',
    description: 'Permukaan natural lembut seperti serat bambu dan tanah subur yang nyaman di mata.',
    isDark: false,
    canvas: '#F8F7F2',
    surface: '#FFFFFF',
    surfaceMuted: '#F0EEE4',
    border: '#E1DDD0',
    text: '#1F1E18',
    textMuted: '#635F52',
    defaultAccent: '#0F766E',
    swatches: ['#F8F7F2', '#FFFFFF', '#0F766E'],
  },
  {
    id: 'kabut-pagi',
    name: 'Kabut Pagi NFT',
    description: 'Nuansa biru-hijau embun pagi yang tenang untuk fokus angka PPM dan pH larutan.',
    isDark: false,
    canvas: '#F4F8F9',
    surface: '#FFFFFF',
    surfaceMuted: '#E9F1F3',
    border: '#D3E1E5',
    text: '#0F1E24',
    textMuted: '#4C646D',
    defaultAccent: '#0E7490',
    swatches: ['#F4F8F9', '#FFFFFF', '#0E7490'],
  },
];

export interface FontOption {
  id: FontOptionId;
  name: string;
  category: string;
  sample: string;
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    category: 'Sans Geometris Modern',
    sample: '1.250 PPM · pH 6,0 · GH 1',
    family: '"Plus Jakarta Sans", system-ui, sans-serif',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    category: 'Sans Bersih Kontemporer',
    sample: '1.250 PPM · pH 6,0 · GH 1',
    family: '"Outfit", system-ui, sans-serif',
  },
  {
    id: 'bricolage',
    name: 'Bricolage Grotesque',
    category: 'Sans Karakter Botani',
    sample: '1.250 PPM · pH 6,0 · GH 1',
    family: '"Bricolage Grotesque", system-ui, sans-serif',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    category: 'Sans Presisi Teknis',
    sample: '1.250 PPM · pH 6,0 · GH 1',
    family: '"Manrope", system-ui, sans-serif',
  },
  {
    id: 'dmsans',
    name: 'DM Sans',
    category: 'Sans Ringkas Minimalis',
    sample: '1.250 PPM · pH 6,0 · GH 1',
    family: '"DM Sans", system-ui, sans-serif',
  },
  {
    id: 'lora',
    name: 'Lora',
    category: 'Serif Editorial Kebun',
    sample: '1.250 PPM · pH 6,0 · GH 1',
    family: '"Lora", Georgia, serif',
  },
];

export const ACCENT_PRESETS = [
  { name: 'Hijau Melon', hex: '#15803D' },
  { name: 'Mint Hidroponik', hex: '#059669' },
  { name: 'Zaitun Kebun', hex: '#4D7C0F' },
  { name: 'Teal Larutan', hex: '#0E7490' },
  { name: 'Cyan Embun', hex: '#06B6D4' },
  { name: 'Biru Nutrisi', hex: '#1D4ED8' },
  { name: 'Emas Melon', hex: '#D97706' },
  { name: 'Kuning Kunyit', hex: '#B45309' },
  { name: 'Terakota Batang', hex: '#B91C1C' },
];

export const GROWTH_PHASE_SPECS: Record<
  GrowthPhase,
  { label: string; hstRange: string; ppmMin: number; ppmMax: number; phMin: number; phMax: number; note: string }
> = {
  semai: {
    label: 'Fase Semai',
    hstRange: '0–7 HSS',
    ppmMin: 500,
    ppmMax: 600,
    phMin: 6.5,
    phMax: 7.0,
    note: 'Fase semai 0–7 HSS: fokus perkecambahan dan adaptasi akar awal.',
  },
  vegetatif: {
    label: 'Fase Vegetatif',
    hstRange: '1–20 HST',
    ppmMin: 600,
    ppmMax: 700,
    phMin: 6.5,
    phMax: 7.0,
    note: 'Fase vegetatif 1–20 HST: pertumbuhan daun, akar, dan sulur utama (600–700 ppm).',
  },
  generatif: {
    label: 'Bunga & Pembesaran Buah',
    hstRange: '21–45 HST',
    ppmMin: 700,
    ppmMax: 1000,
    phMin: 6.5,
    phMax: 7.0,
    note: 'Fase pembungaan hingga pembesaran buah 21–45 HST (target 700–1000 ppm).',
  },
  pembesaran: {
    label: 'Fase Akhir',
    hstRange: '46–65 HST',
    ppmMin: 700,
    ppmMax: 800,
    phMin: 6.5,
    phMax: 7.0,
    note: 'Fase akhir 46–65 HST: target kepekatan diturunkan bertahap 800–700 ppm menjelang panen.',
  },
};

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, { label: string; short: string; desc: string }> = {
  penyemprotan: {
    label: 'Penyemprotan Daun',
    short: 'Penyemprotan',
    desc: 'Aplikasi foliar pestisida, fungisida, atau pupuk mikro via sprayer.',
  },
  pengolesan: {
    label: 'Pengolesan Obat Batang',
    short: 'Pengolesan',
    desc: 'Pengobatan lokal pada luka batang, gummy stem blight, atau pangkal buah.',
  },
  pengocoran: {
    label: 'Pengocoran Obat & Akar',
    short: 'Pengocoran',
    desc: 'Aplikasi hayati, fungisida sistemik, atau suplemen akar ke talang/tandon.',
  },
};

export const MEDICINE_SUGGESTIONS: Record<TreatmentType, Array<{ name: string; active: string; dosage: string }>> = {
  penyemprotan: [
    { name: 'Abamectin 18 EC', active: 'Abamektin (Kutu/Thrips)', dosage: '1 ml/L' },
    { name: 'Azoxistrobin + Difenokonazol', active: 'Fungisida Embun Tepung', dosage: '1,5 ml/L' },
    { name: 'Kalsium Boron Foliar', active: 'Ca + B Pupuk Daun', dosage: '2 gr/L' },
    { name: 'Imidakloprid 25 WP', active: 'Kutu Kebul / Bemisia', dosage: '1 gr/L' },
  ],
  pengolesan: [
    { name: 'Pasta Mankozeb + Tembaga', active: 'Mankozeb & Cu(OH)2 (Gummy Stem)', dosage: 'Oles pekat 1:2 air' },
    { name: 'Pasta Kalsium + Karbendazim', active: 'Luka Pemangkasan / Busuk Batang', dosage: 'Oles langsung luka' },
    { name: 'Bakterisida Streptomycin Pasta', active: 'Pencegahan Busuk Lunak', dosage: '2 gr / 10 ml air' },
  ],
  pengocoran: [
    { name: 'Trichoderma harzianum', active: 'Agen Hayati Akar / Fusarium', dosage: '5 gr/L (50 ml/tanaman)' },
    { name: 'Asam Humat + Fulvat', active: 'Pemacu Serapan Akar NFT', dosage: '2 gr/L ke tandon' },
    { name: 'Propamokarb Hidroklorida', active: 'Pencegahan Pythium Akar', dosage: '1,5 ml/L' },
    { name: 'MKP + Kalium Nitrat Kocor', active: 'Booster Pembesaran Buah', dosage: '3 gr/L' },
  ],
};

export const PLANT_STATUS_META: Record<
  PlantHealthStatus,
  { label: string; short: string; colorClass: string; cellBg: string; cellBorder: string; textBadge: string }
> = {
  sehat: {
    label: 'Sehat / Optimal',
    short: 'Sehat',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    cellBg: '#16A34A',
    cellBorder: '#15803D',
    textBadge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  perhatian: {
    label: 'Perlu Perhatian',
    short: 'Perhatian',
    colorClass: 'text-amber-700 dark:text-amber-400',
    cellBg: '#D97706',
    cellBorder: '#B45309',
    textBadge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  sakit: {
    label: 'Sakit / Terinfeksi',
    short: 'Sakit',
    colorClass: 'text-rose-700 dark:text-rose-400',
    cellBg: '#DC2626',
    cellBorder: '#B91C1C',
    textBadge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  panen: {
    label: 'Siap Panen',
    short: 'Panen',
    colorClass: 'text-sky-700 dark:text-sky-400',
    cellBg: '#0284C7',
    cellBorder: '#0369A1',
    textBadge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  kosong: {
    label: 'Kosong / Sulam',
    short: 'Kosong',
    colorClass: 'text-slate-500 dark:text-slate-400',
    cellBg: '#94A3B8',
    cellBorder: '#64748B',
    textBadge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  },
};

export const SPRAY_CATEGORY_LABELS: Record<
  SprayCategory,
  { label: string; desc: string }
> = {
  pupuk: {
    label: 'Pupuk (Foliar / Daun)',
    desc: 'Nutrisi daun seperti Kalsium Boron, MKP, atau unsur mikro.',
  },
  insektisida: {
    label: 'Insektisida (Hama)',
    desc: 'Pengendalian kutu kebul, thrips, tungau, dan ulat daun.',
  },
  fungisida: {
    label: 'Fungisida (Jamur)',
    desc: 'Pencegahan & pengobatan embun tepung, embun bulu, dan bercak daun.',
  },
};

export const SPRAY_SUGGESTIONS: Record<
  SprayCategory,
  Array<{ name: string; active: string; dosage: string }>
> = {
  pupuk: [
    { name: 'Ambition', active: 'Asam Amino + Asam Fulvat + Unsur Mikro', dosage: '2 ml/L' },
    { name: 'Ultradap', active: 'Mono Ammonium Phosphate (N 12% + P2O5 60%)', dosage: '2 gr/L' },
    { name: 'MKP', active: 'Mono Kalium Phosphate (P2O5 52% + K2O 34%)', dosage: '2,5 gr/L' },
    { name: 'CNG', active: 'Calcium Nitrate Grade (N 15,5% + CaO 26%)', dosage: '2 gr/L' },
    { name: 'MAGs', active: 'Magnesium Sulfat (MgO 16% + Sulfur 13%)', dosage: '2 gr/L' },
    { name: 'MAP', active: 'Mono Ammonium Phosphate 12-61-0', dosage: '2 gr/L' },
    { name: 'KNO3 / Javabloom', active: 'Kalium Nitrat (N 13% + K2O 45%)', dosage: '2,5 gr/L' },
    { name: 'Java Higros', active: 'Pupuk Pertumbuhan Daun & Tunas + TE', dosage: '2 gr/L' },
    { name: 'Java Green', active: 'Pupuk NPK Vegetatif Tinggi Nitrogen', dosage: '2 gr/L' },
    { name: 'SOP', active: 'Kalium Sulfat (K2O 50% + Sulfur 18%)', dosage: '2 gr/L' },
    { name: 'Calcium Active', active: 'Kalsium Aktif + Boron Pencegah Pecah Buah', dosage: '2 ml/L' },
  ],
  insektisida: [
    { name: 'Winder', active: 'Imidakloprid (Kutu Kebul & Aphids)', dosage: '1 gr/L' },
    { name: 'Torso', active: 'Insektisida Pengendali Thrips & Ulat', dosage: '1,5 ml/L' },
    { name: 'Abacel', active: 'Abamektin 18 EC (Thrips, Tungau & Pengorok Daun)', dosage: '1 ml/L' },
    { name: 'Avidor', active: 'Imidakloprid 25 WP (Kutu Kebul / Bemisia)', dosage: '1 gr/L' },
  ],
  fungisida: [
    { name: 'Antracol', active: 'Propineb 70 WP (Bercak Daun & Busuk Batang)', dosage: '2 gr/L' },
    { name: 'Pemulus', active: 'Sulfur 80 WG (Embun Tepung & Tungau)', dosage: '2 gr/L' },
    { name: 'Antila', active: 'Fungisida Protektif & Kuratif Daun', dosage: '1,5 ml/L' },
    { name: 'Dithane', active: 'Mankozeb 80 WP (Antraknosa & Embun Bulu)', dosage: '2 gr/L' },
    { name: 'Heksa', active: 'Heksakonazol (Fungisida Sistemik Embun Tepung)', dosage: '1 ml/L' },
  ],
};

export const FRUITING_STATUS_META: Record<
  FruitingStatus,
  { label: string; short: string; cellBg: string; colorClass: string }
> = {
  berbuah: {
    label: 'Sudah Berbuah',
    short: 'Berbuah',
    cellBg: '#0D9488',
    colorClass: 'text-teal-700 dark:text-teal-400',
  },
  tidak_berbuah: {
    label: 'Tidak Berbuah',
    short: 'Tidak Berbuah',
    cellBg: '#D97706',
    colorClass: 'text-amber-700 dark:text-amber-400',
  },
};

export const FRUIT_QUALITY_META: Record<
  FruitQuality,
  { label: string; short: string; cellBg: string; colorClass: string }
> = {
  bagus: {
    label: 'Buah Bagus',
    short: 'Bagus',
    cellBg: '#16A34A',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
  },
  jelek: {
    label: 'Buah Jelek',
    short: 'Jelek',
    cellBg: '#E11D48',
    colorClass: 'text-rose-700 dark:text-rose-400',
  },
};

export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; short: string; defaultUnit: string; desc: string }
> = {
  pupuk: {
    label: '1. Pupuk',
    short: 'Pupuk',
    defaultUnit: 'kg',
    desc: 'MKP, Java Green, KNO3, Calcium Active, Calnit, SOP, dll.',
  },
  fungisida: {
    label: '2. Fungisida',
    short: 'Fungisida',
    defaultUnit: 'Bungkus',
    desc: 'Antracol, Antila, Agrept, Besromil, Dithane, Heksa, Pemulus.',
  },
  insektisida: {
    label: '3. Insektisida',
    short: 'Insektisida',
    defaultUnit: 'Botol',
    desc: 'Abacel, Avidor, Demolish, Torso, Winder.',
  },
  tenaga_kerja: {
    label: '4. Tenaga Kerja',
    short: 'Tenaga Kerja',
    defaultUnit: 'HOK',
    desc: 'Upah tanam, perawatan, polinasi, panen, dan operator.',
  },
  lainnya: {
    label: '5. Lainnya (Benih & AB MIX)',
    short: 'Lainnya',
    defaultUnit: 'SET',
    desc: 'Benih (Inthanon, The Blues, Kirin, Petravany, Honey Globe), AB MIX (SET).',
  },
};

export interface ExpensePresetOption {
  name: string;
  defaultUnit: string;
}

export const EXPENSE_PRESET_OPTIONS: Record<ExpenseCategory, ExpensePresetOption[]> = {
  pupuk: [
    { name: 'MKP', defaultUnit: 'kg' },
    { name: 'Java Green', defaultUnit: 'kg' },
    { name: 'Java Higros', defaultUnit: 'kg' },
    { name: 'Java bloom', defaultUnit: 'kg' },
    { name: 'KNO3', defaultUnit: 'kg' },
    { name: 'Calcium Active', defaultUnit: 'Liter' },
    { name: 'Magnesium Sulfat', defaultUnit: 'kg' },
    { name: 'Calnit', defaultUnit: 'kg' },
    { name: 'Vitamin B1', defaultUnit: 'Botol' },
    { name: 'Ambition', defaultUnit: 'Liter' },
    { name: 'MAP', defaultUnit: 'kg' },
    { name: 'SOP', defaultUnit: 'kg' },
    { name: 'CNG', defaultUnit: 'kg' },
  ],
  fungisida: [
    { name: 'Antracol', defaultUnit: 'Bungkus' },
    { name: 'Antila', defaultUnit: 'Botol' },
    { name: 'Agrept', defaultUnit: 'Bungkus' },
    { name: 'Besromil', defaultUnit: 'Bungkus' },
    { name: 'Dithane', defaultUnit: 'kg' },
    { name: 'Heksa', defaultUnit: 'Botol' },
    { name: 'Pemulus', defaultUnit: 'Bungkus' },
  ],
  insektisida: [
    { name: 'Abacel', defaultUnit: 'Botol' },
    { name: 'Avidor', defaultUnit: 'Bungkus' },
    { name: 'Demolish', defaultUnit: 'Botol' },
    { name: 'Torso', defaultUnit: 'Botol' },
    { name: 'Winder', defaultUnit: 'Bungkus' },
  ],
  tenaga_kerja: [
    { name: 'Tenaga Tanam & Pindah Bibit', defaultUnit: 'HOK' },
    { name: 'Tenaga Perawatan & Pruning', defaultUnit: 'HOK' },
    { name: 'Tenaga Polinasi & Seleksi Buah', defaultUnit: 'HOK' },
    { name: 'Tenaga Penyemprotan & Kocor', defaultUnit: 'HOK' },
    { name: 'Tenaga Panen & Sortir', defaultUnit: 'HOK' },
    { name: 'Gaji Penjaga / Operator GH', defaultUnit: 'Bulan' },
  ],
  lainnya: [
    { name: 'AB MIX', defaultUnit: 'SET' },
    { name: 'Benih: Inthanon', defaultUnit: 'Pack' },
    { name: 'Benih: The Blues', defaultUnit: 'Pack' },
    { name: 'Benih: Kirin', defaultUnit: 'Pack' },
    { name: 'Benih: Petravany', defaultUnit: 'Pack' },
    { name: 'Benih: Honey Globe', defaultUnit: 'Pack' },
  ],
};

export const SALE_GRADE_OPTIONS: Array<{
  grade: SaleGrade;
  desc: string;
  badgeColor: string;
}> = [
  { grade: 'Grade A', desc: 'Kualitas super, net rata & bobot optimal', badgeColor: '#16A34A' },
  { grade: 'Grade B', desc: 'Kualitas standar baik pasar ritel/modern', badgeColor: '#0D9488' },
  { grade: 'Grade C', desc: 'Ukuran sedang / minor netting', badgeColor: '#0284C7' },
  { grade: 'Grade D', desc: 'Ukuran kecil / buah sortiran bawah', badgeColor: '#D97706' },
  { grade: 'Plonco', desc: 'Buah muda / reject teknis / pecah awal', badgeColor: '#DC2626' },
  { grade: 'Jual sendiri', desc: 'Penjualan langsung eceran / ke konsumen kebun', badgeColor: '#7C3AED' },
];



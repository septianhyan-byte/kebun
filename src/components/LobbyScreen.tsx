import { useState } from 'react';
import {
  Crosshair,
  Gamepad2,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import {
  BATTLE_SPELLS,
  HERO_CATALOG,
  HERO_LIST,
  ITEM_CATALOG,
} from '../game/constants';
import {
  BattleSpellId,
  Difficulty,
  HeroId,
  HeroRole,
  ItemCategory,
  MatchMode,
} from '../game/types';
import { HeroAvatar } from './HeroAvatar';

interface LobbyScreenProps {
  selectedHeroId: HeroId;
  onSelectHero: (id: HeroId) => void;
  selectedSpell: BattleSpellId;
  onSelectSpell: (spell: BattleSpellId) => void;
  mode: MatchMode;
  onSelectMode: (mode: MatchMode) => void;
  difficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStartMatch: () => void;
}

type LobbyTab = 'heroes' | 'guide' | 'items';

const ROLE_FILTERS: Array<'Semua' | HeroRole> = [
  'Semua',
  'Fighter',
  'Marksman',
  'Mage',
  'Assassin',
  'Tank',
];

const ITEM_FILTERS: Array<'Semua' | ItemCategory> = [
  'Semua',
  'Sepatu',
  'Fisik',
  'Sihir',
  'Pertahanan',
];

export function LobbyScreen({
  selectedHeroId,
  onSelectHero,
  selectedSpell,
  onSelectSpell,
  mode,
  onSelectMode,
  difficulty,
  onSelectDifficulty,
  onStartMatch,
}: LobbyScreenProps) {
  const [activeTab, setActiveTab] = useState<LobbyTab>('heroes');
  const [roleFilter, setRoleFilter] = useState<'Semua' | HeroRole>('Semua');
  const [itemFilter, setItemFilter] = useState<'Semua' | ItemCategory>('Semua');

  const selectedHero = HERO_CATALOG[selectedHeroId];
  const filteredHeroes =
    roleFilter === 'Semua'
      ? HERO_LIST
      : HERO_LIST.filter((h) => h.role === roleFilter);

  const filteredItems =
    itemFilter === 'Semua'
      ? ITEM_CATALOG
      : ITEM_CATALOG.filter((i) => i.category === itemFilter);

  const spellList = Object.values(BATTLE_SPELLS);

  return (
    <div className="min-h-screen bg-[#0b111e] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-slate-800/80 bg-[#0d1526]/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1320px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('heroes')}
            className="font-display text-xl font-bold tracking-wide text-amber-400 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
          >
            Aether Legends
          </button>

          <nav className="flex items-center gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('heroes')}
              className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'heroes'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Pilih Hero
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'guide'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Panduan Arena
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'items'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Katalog Item
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onStartMatch}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Mulai Pertarungan
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-6 py-8">
        {activeTab === 'heroes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Roster & Role Filter */}
            <section className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <h1
                  className="font-display text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Arena Pertarungan MOBA 3v3 & 5v5
                </h1>
                <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
                  Pilih hero andalanmu, atur Battle Spell, hancurkan turret lawan, taklukkan Dewata Lord, dan runtuhkan Kristal Utama musuh di Land of Aether.
                </p>
              </div>

              {/* Interactive Role Filter Tabs */}
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#131c2e] border border-slate-800 rounded-lg">
                {ROLE_FILTERS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleFilter(role)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      roleFilter === role
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* Hero Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {filteredHeroes.map((hero) => {
                  const isSelected = hero.id === selectedHeroId;
                  return (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => onSelectHero(hero.id)}
                      className={`group text-left rounded-xl overflow-hidden border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isSelected
                          ? 'bg-[#172338] border-amber-400 shadow-lg shadow-amber-500/10'
                          : 'bg-[#131c2e] border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="aspect-square w-full overflow-hidden bg-[#0e1624] relative">
                        <HeroAvatar
                          hero={hero}
                          className="w-full h-full transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0b111e] via-[#0b111e]/55 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="font-display text-base font-bold text-slate-50 leading-tight">
                            {hero.name}
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5 truncate">
                            {hero.role} · Kesulitan {hero.difficultyRating}/3
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Match Setup Bar */}
              <div className="bg-[#131c2e] border border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-300">
                    Mode Pertandingan
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b111e] rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => onSelectMode('3v3')}
                      className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        mode === '3v3'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3v3 Arena Cepat
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectMode('5v5')}
                      className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        mode === '5v5'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      5v5 Klasik
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-300">
                    Tingkat Kecerdasan Bot
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0b111e] rounded-lg border border-slate-800">
                    {(['mudah', 'normal', 'legenda'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onSelectDifficulty(d)}
                        className={`py-2 px-2 rounded-md text-xs font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                          difficulty === d
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Right 5 Columns: Selected Hero Inspector & Launch CTA */}
            <aside className="lg:col-span-5 bg-[#131c2e] border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                  <HeroAvatar hero={selectedHero} className="w-full h-full" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h2 className="font-display text-2xl font-bold text-slate-50 leading-tight">
                    {selectedHero.name}
                  </h2>
                  <p className="text-xs font-medium text-amber-400">
                    {selectedHero.title} · {selectedHero.role}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    {selectedHero.passiveName}: {selectedHero.passiveDesc}
                  </p>
                </div>
              </div>

              {/* Hero Ratings */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-slate-800/80">
                {[
                  { label: 'Ketahanan', value: selectedHero.ratings.durability, color: 'bg-emerald-500' },
                  { label: 'Serangan', value: selectedHero.ratings.offense, color: 'bg-rose-500' },
                  { label: 'Efek Skill', value: selectedHero.ratings.ability, color: 'bg-sky-500' },
                  { label: 'Mobilitas', value: selectedHero.ratings.mobility, color: 'bg-amber-400' },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="font-mono-tabular font-semibold text-slate-200">
                        {stat.value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#0b111e] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stat.color} rounded-full`}
                        style={{ width: `${stat.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Skills List */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-slate-300">
                  Kemampuan Aktif
                </div>
                <div className="space-y-3">
                  {selectedHero.skills.map((sk) => (
                    <div key={sk.id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-100">
                          {sk.slot === 3 ? 'Ultimate' : `Skill ${sk.slot}`} · {sk.name}
                        </span>
                        <span className="font-mono-tabular text-slate-400">
                          {sk.keyHint} · CD {sk.cooldown}d
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {sk.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Battle Spell Selector */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Battle Spell</span>
                  <span className="text-slate-400">Tombol F</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {spellList.map((sp) => {
                    const active = sp.id === selectedSpell;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => onSelectSpell(sp.id)}
                        className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-[#0b111e] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sp.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {BATTLE_SPELLS[selectedSpell].description}
                </p>
              </div>

              <button
                type="button"
                onClick={onStartMatch}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Swords className="w-4 h-4" />
                Masuk ke Arena ({mode.toUpperCase()})
              </button>
            </aside>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-bold text-slate-50">
                Panduan Bermain & Kontrol Arena
              </h1>
              <p className="text-sm text-slate-400">
                Dirancang agar responsif baik menggunakan Keyboard Desktop maupun sentuhan layar / mouse seperti Mobile Legends.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#131c2e] border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm">
                  <Gamepad2 className="w-4 h-4" />
                  Kontrol Pergerakan & Tempur
                </div>
                <div className="space-y-2.5 text-sm text-slate-300">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Bergerak</span>
                    <span className="font-mono-tabular text-slate-100">WASD / Panah / Analog Kiri</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Serangan Dasar</span>
                    <span className="font-mono-tabular text-slate-100">Spasi / J / Tombol Pedang</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Skill 1, 2 & Ultimate</span>
                    <span className="font-mono-tabular text-slate-100">Q · E · R (atau 1 · 2 · 3)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Battle Spell</span>
                    <span className="font-mono-tabular text-slate-100">Tombol F</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Recall ke Base</span>
                    <span className="font-mono-tabular text-slate-100">Tombol B</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Toko Item & Papan Skor</span>
                    <span className="font-mono-tabular text-slate-100">P · Tab</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#131c2e] border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-sky-400 font-semibold text-sm">
                  <Crosshair className="w-4 h-4" />
                  Mekanik Penting Land of Aether
                </div>
                <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
                  <li>
                    <span className="font-semibold text-slate-100">Prioritas Turret:</span> Masuklah ke jarak serang turret bersama pasukan Minion. Jika kamu menyerang hero musuh di bawah turret lawan, turret langsung menguncimu!
                  </li>
                  <li>
                    <span className="font-semibold text-slate-100">Semak Penyergapan:</span> Bersembunyi di dalam semak hijau membuatmu tak terlihat musuh dari luar untuk melakukan penyergapan mendadak.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-100">Dewata Lord:</span> Kalahkan penjaga raksasa di sungai kiri-atas untuk memperoleh +20% Serangan tim dan memanggil Lord Pengepung di Mid Lane.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-display text-3xl font-bold text-slate-50">
                  Ensiklopedia Item Pertempuran
                </h1>
                <p className="text-sm text-slate-400">
                  Kumpulkan Gold dari Minion, monster hutan, dan eliminasi lawan untuk merakit hingga 6 item.
                </p>
              </div>

              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#131c2e] border border-slate-800 rounded-lg">
                {ITEM_FILTERS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setItemFilter(cat)}
                    className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      itemFilter === cat
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#131c2e] border border-slate-800 rounded-xl p-5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-slate-700"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        {item.category === 'Fisik' && <Swords className="w-5 h-5" />}
                        {item.category === 'Sihir' && <Sparkles className="w-5 h-5" />}
                        {item.category === 'Pertahanan' && <Shield className="w-5 h-5" />}
                        {item.category === 'Sepatu' && <Zap className="w-5 h-5" />}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{item.name}</h3>
                        <div className="text-xs text-slate-400">
                          {item.category} · <span className="font-mono-tabular text-amber-400">{item.cost} Gold</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono-tabular font-semibold text-emerald-400">
                    {item.shortStat}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

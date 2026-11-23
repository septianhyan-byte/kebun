import { useState } from 'react';
import { Shield, Sparkles, Swords, X, Zap } from 'lucide-react';
import { ITEM_CATALOG, ITEM_MAP, RECOMMENDED_BUILDS } from '../game/constants';
import { HeroEntity, ItemCategory } from '../game/types';

interface ShopModalProps {
  player: HeroEntity;
  onBuy: (itemId: string) => void;
  onSell: (slotIdx: number) => void;
  onClose: () => void;
}

const CATEGORIES: Array<'Rekomendasi' | 'Semua' | ItemCategory> = [
  'Rekomendasi',
  'Semua',
  'Sepatu',
  'Fisik',
  'Sihir',
  'Pertahanan',
];

export function ShopModal({ player, onBuy, onSell, onClose }: ShopModalProps) {
  const [cat, setCat] = useState<'Rekomendasi' | 'Semua' | ItemCategory>('Rekomendasi');

  const recIds = RECOMMENDED_BUILDS[player.heroId] || [];
  const items =
    cat === 'Rekomendasi'
      ? recIds.map((id) => ITEM_MAP[id]).filter(Boolean)
      : cat === 'Semua'
      ? ITEM_CATALOG
      : ITEM_CATALOG.filter((i) => i.category === cat);

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#11192b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-50">
              Toko Perlengkapan
            </h2>
            <p className="text-xs text-slate-400">
              Gold Tersedia:{' '}
              <span className="font-mono-tabular font-bold text-amber-400">
                {Math.floor(player.gold)} Gold
              </span>{' '}
              · Slot Terpakai: <span className="font-mono-tabular">{player.items.length}/6</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Toko"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-3 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                cat === c
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#0b111e] text-slate-300 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
          {items.map((item) => {
            const canAfford = player.gold >= item.cost && player.items.length < 6;
            const ownedCount = player.items.filter((id) => id === item.id).length;

            return (
              <div
                key={item.id}
                className="bg-[#0b111e] border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-slate-700"
                    style={{ backgroundColor: `${item.color}20`, color: item.color }}
                  >
                    {item.category === 'Fisik' && <Swords className="w-5 h-5" />}
                    {item.category === 'Sihir' && <Sparkles className="w-5 h-5" />}
                    {item.category === 'Pertahanan' && <Shield className="w-5 h-5" />}
                    {item.category === 'Sepatu' && <Zap className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-bold text-slate-100 truncate">
                      {item.name}
                      {ownedCount > 0 && (
                        <span className="ml-2 text-xs font-normal text-emerald-400">
                          (Dimiliki x{ownedCount})
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono-tabular text-sky-400">
                      {item.shortStat}
                    </div>
                    <div className="text-xs text-slate-400 line-clamp-2">
                      {item.description}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onBuy(item.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold font-mono-tabular whitespace-nowrap shrink-0 transition-colors ${
                    canAfford
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {item.cost}g
                </button>
              </div>
            );
          })}
        </div>

        {/* Owned Slots Footer */}
        <div className="px-6 py-4 bg-[#0b111e] border-t border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-400">
            Slot Item Aktif (Klik item untuk jual 65% harga)
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => {
              const itemId = player.items[idx];
              const item = itemId ? ITEM_MAP[itemId] : null;
              if (!item) {
                return (
                  <div
                    key={idx}
                    className="h-11 rounded-lg border border-dashed border-slate-800 bg-[#11192b]/60 flex items-center justify-center text-xs text-slate-600"
                  >
                    Kosong
                  </div>
                );
              }
              return (
                <button
                  key={`${itemId}_${idx}`}
                  type="button"
                  onClick={() => onSell(idx)}
                  title={`Jual ${item.name} (+${Math.round(item.cost * 0.65)}g)`}
                  className="h-11 px-2 rounded-lg border border-slate-700 bg-[#152036] hover:border-rose-400 text-left flex flex-col justify-center cursor-pointer transition-colors"
                >
                  <span className="text-[11px] font-semibold text-slate-100 truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono-tabular text-amber-400">
                    Jual +{Math.round(item.cost * 0.65)}g
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

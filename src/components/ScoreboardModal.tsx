import { X } from 'lucide-react';
import { HERO_CATALOG, ITEM_MAP } from '../game/constants';
import { formatMatchTime } from '../game/engine';
import { HeroEntity, MatchState } from '../game/types';
import { HeroAvatar } from './HeroAvatar';

interface ScoreboardModalProps {
  state: MatchState;
  onClose: () => void;
}

export function ScoreboardModal({ state, onClose }: ScoreboardModalProps) {
  const blueTeam = state.heroes.filter((h) => h.team === 'blue');
  const redTeam = state.heroes.filter((h) => h.team === 'red');

  const renderTeamTable = (title: string, colorClass: string, list: HeroEntity[]) => (
    <div className="space-y-2.5">
      <div className={`text-sm font-bold ${colorClass}`}>{title}</div>
      <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-[#0b111e] overflow-hidden">
        {list.map((h) => {
          const def = HERO_CATALOG[h.heroId];
          return (
            <div
              key={h.uid}
              className={`px-4 py-3 flex items-center justify-between gap-4 ${
                h.isPlayer ? 'bg-amber-500/10' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                  <HeroAvatar hero={def} className="w-full h-full" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-100 truncate">
                    {h.name} {h.isPlayer ? '(Kamu)' : ''}
                  </div>
                  <div className="text-xs text-slate-400">
                    Lv.{h.level} · {h.role}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                {Array.from({ length: 6 }).map((_, idx) => {
                  const item = h.items[idx] ? ITEM_MAP[h.items[idx]] : null;
                  return (
                    <span
                      key={idx}
                      title={item?.name || 'Slot Kosong'}
                      className="w-6 h-6 rounded border border-slate-800 bg-[#131c2e] flex items-center justify-center text-[10px] font-bold"
                      style={{ color: item?.color || '#475569' }}
                    >
                      {item ? item.name.slice(0, 2).toUpperCase() : '·'}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center gap-5 shrink-0 text-right">
                <div>
                  <div className="font-mono-tabular text-sm font-bold text-slate-100">
                    {h.kills}/{h.deaths}/{h.assists}
                  </div>
                  <div className="text-[11px] text-slate-400">K/D/A</div>
                </div>
                <div className="w-16">
                  <div className="font-mono-tabular text-sm font-semibold text-amber-400">
                    {Math.floor(h.goldEarned)}
                  </div>
                  <div className="text-[11px] text-slate-400">Gold</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#11192b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Papan Skor Pertempuran
            </h2>
            <span className="font-mono-tabular text-xs text-slate-400">
              Waktu {formatMatchTime(state.elapsedTime)} ·{' '}
              <span className="text-blue-400 font-bold">{state.blueKills}</span> vs{' '}
              <span className="text-rose-400 font-bold">{state.redKills}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Papan Skor"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {renderTeamTable('Tim Biru (Sekutu)', 'text-blue-400', blueTeam)}
          {renderTeamTable('Tim Merah (Lawan)', 'text-rose-400', redTeam)}
        </div>
      </div>
    </div>
  );
}

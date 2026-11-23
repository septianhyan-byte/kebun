import { RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import { HERO_CATALOG } from '../game/constants';
import { formatMatchTime } from '../game/engine';
import { MatchState } from '../game/types';
import { HeroAvatar } from './HeroAvatar';

interface GameOverModalProps {
  state: MatchState;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export function GameOverModal({
  state,
  onPlayAgain,
  onBackToLobby,
}: GameOverModalProps) {
  const isVictory = state.winner === 'blue';

  // Compute MVP score per hero
  const sortedHeroes = [...state.heroes].sort((a, b) => {
    const scoreA = a.kills * 3 + a.assists * 1.5 - a.deaths * 1.2 + a.damageDealt / 1200;
    const scoreB = b.kills * 3 + b.assists * 1.5 - b.deaths * 1.2 + b.damageDealt / 1200;
    return scoreB - scoreA;
  });
  const mvpUid = sortedHeroes[0]?.uid;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#11192b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Banner Header */}
        <div
          className={`px-8 py-7 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isVictory
              ? 'bg-gradient-to-r from-amber-500/20 via-blue-600/15 to-transparent'
              : 'bg-gradient-to-r from-rose-600/20 via-slate-900 to-transparent'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-300">
              Pertandingan {state.mode.toUpperCase()} Selesai · Durasi {formatMatchTime(state.elapsedTime)}
            </div>
            <h1
              className={`font-display text-3xl sm:text-4xl font-extrabold tracking-wide ${
                isVictory ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {isVictory ? 'KEMENANGAN!' : 'KEKALAHAN'}
            </h1>
            <p className="text-sm text-slate-300">
              {isVictory
                ? 'Kristal Utama lawan telah dihancurkan. Tim Biru menguasai Land of Aether!'
                : 'Kristal Utama sekutu runtuh. Evaluasi build item dan coba strategi baru!'}
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0 bg-[#0b111e] border border-slate-800 rounded-xl px-5 py-3">
            <div className="text-center">
              <div className="font-mono-tabular text-2xl font-bold text-blue-400">
                {state.blueKills}
              </div>
              <div className="text-[11px] text-slate-400">Tim Biru</div>
            </div>
            <div className="text-slate-600 font-bold">:</div>
            <div className="text-center">
              <div className="font-mono-tabular text-2xl font-bold text-rose-400">
                {state.redKills}
              </div>
              <div className="text-[11px] text-slate-400">Tim Merah</div>
            </div>
          </div>
        </div>

        {/* Full Scoreboard */}
        <div className="p-6 space-y-4 max-h-[52vh] overflow-y-auto">
          <div className="grid grid-cols-1 divide-y divide-slate-800 border border-slate-800 rounded-xl bg-[#0b111e]">
            {sortedHeroes.map((h) => {
              const def = HERO_CATALOG[h.heroId];
              const isMvp = h.uid === mvpUid;
              return (
                <div
                  key={h.uid}
                  className={`px-4 py-3 flex items-center justify-between gap-4 ${
                    h.isPlayer ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                      <HeroAvatar hero={def} className="w-full h-full" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100 truncate">
                          {h.name} {h.isPlayer ? '(Kamu)' : ''}
                        </span>
                        {isMvp && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                            <Trophy className="w-3.5 h-3.5" /> MVP
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className={h.team === 'blue' ? 'text-blue-400' : 'text-rose-400'}>
                          {h.team === 'blue' ? 'Tim Biru' : 'Tim Merah'}
                        </span>{' '}
                        · Lv.{h.level} · {h.role}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <div className="font-mono-tabular text-sm font-bold text-slate-100">
                        {h.kills}/{h.deaths}/{h.assists}
                      </div>
                      <div className="text-[11px] text-slate-400">K/D/A</div>
                    </div>
                    <div className="hidden sm:block w-20">
                      <div className="font-mono-tabular text-sm font-semibold text-slate-200">
                        {Math.round(h.damageDealt).toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] text-slate-400">Damage</div>
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

        {/* Actions */}
        <div className="px-6 py-5 bg-[#0b111e] border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBackToLobby}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Pilih Hero Lain
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Main Lagi
          </button>
        </div>
      </div>
    </div>
  );
}

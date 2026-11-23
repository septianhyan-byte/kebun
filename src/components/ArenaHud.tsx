import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BarChart3,
  Crown,
  Pause,
  Plus,
  RotateCcw,
  ShoppingBag,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BATTLE_SPELLS,
  HERO_CATALOG,
  ITEM_MAP,
  MAP_SIZE,
  RECOMMENDED_BUILDS,
} from '../game/constants';
import { ComputedHeroStats, formatMatchTime } from '../game/engine';
import { renderMinimap } from '../game/renderer';
import { HeroEntity, MatchState, TargetPriority, Vec2 } from '../game/types';
import { HeroAvatar } from './HeroAvatar';

interface ArenaHudProps {
  state: MatchState;
  player: HeroEntity;
  playerStats: ComputedHeroStats;
  muted: boolean;
  viewportSize: { width: number; height: number };
  onToggleMute: () => void;
  onPause: () => void;
  onOpenShop: () => void;
  onOpenScoreboard: () => void;
  onJoystickMove: (vec: Vec2) => void;
  onBasicAttack: (priority?: TargetPriority) => void;
  onCastSkill: (slot: 0 | 1 | 2) => void;
  onUpgradeSkill: (slot: 0 | 1 | 2) => void;
  onCastSpell: () => void;
  onRecall: () => void;
  onQuickBuy: (itemId: string) => void;
  onPeekCamera: (pos: Vec2 | null) => void;
}

export function ArenaHud({
  state,
  player,
  playerStats,
  muted,
  viewportSize,
  onToggleMute,
  onPause,
  onOpenShop,
  onOpenScoreboard,
  onJoystickMove,
  onBasicAttack,
  onCastSkill,
  onUpgradeSkill,
  onCastSpell,
  onRecall,
  onQuickBuy,
  onPeekCamera,
}: ArenaHudProps) {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [joyOffset, setJoyOffset] = useState<Vec2>({ x: 0, y: 0 });
  const joyActiveRef = useRef(false);
  const minimapDraggingRef = useRef(false);

  const heroDef = HERO_CATALOG[player.heroId];
  const spellDef = BATTLE_SPELLS[player.battleSpell];

  // Next recommended item
  const recBuild = RECOMMENDED_BUILDS[player.heroId] || [];
  const nextRecId = recBuild.find((_, idx) => idx >= player.items.length);
  const nextRecItem = nextRecId ? ITEM_MAP[nextRecId] : null;
  const canQuickBuy = Boolean(nextRecItem && player.gold >= nextRecItem.cost && player.items.length < 6);

  const blueTurretsAlive = state.turrets.filter((t) => t.team === 'blue' && t.alive && !t.isNexus).length;
  const redTurretsAlive = state.turrets.filter((t) => t.team === 'red' && t.alive && !t.isNexus).length;

  const minimapSize = viewportSize.width < 640 ? 112 : 148;

  // Render live minimap every HUD update
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderMinimap(ctx, state, minimapSize, viewportSize.width, viewportSize.height);
  });

  // Virtual Joystick Pointer Handlers
  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const el = joystickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const d = Math.hypot(dx, dy);
    const clampedD = Math.min(d, maxR);
    const angle = Math.atan2(dy, dx);
    const ox = d > 1 ? Math.cos(angle) * clampedD : 0;
    const oy = d > 1 ? Math.sin(angle) * clampedD : 0;
    setJoyOffset({ x: ox, y: oy });
    onJoystickMove({ x: ox / maxR, y: oy / maxR });
  };

  const handleJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyActiveRef.current = true;
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!joyActiveRef.current) return;
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoyUp = () => {
    joyActiveRef.current = false;
    setJoyOffset({ x: 0, y: 0 });
    onJoystickMove({ x: 0, y: 0 });
  };

  // Minimap Camera Peek
  const updatePeek = (clientX: number, clientY: number) => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onPeekCamera({ x: rx * MAP_SIZE, y: ry * MAP_SIZE });
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* TOP BAR ROW */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Live Minimap + Quick Shop */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="rounded-xl overflow-hidden border-2 border-slate-700/90 bg-[#0b111e] shadow-xl">
            <canvas
              ref={minimapRef}
              width={minimapSize}
              height={minimapSize}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                minimapDraggingRef.current = true;
                updatePeek(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (minimapDraggingRef.current) updatePeek(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                minimapDraggingRef.current = false;
                onPeekCamera(null);
              }}
              onPointerCancel={() => {
                minimapDraggingRef.current = false;
                onPeekCamera(null);
              }}
              className="block cursor-crosshair touch-none-canvas"
              title="Tahan & geser untuk mengintip peta"
            />
          </div>

          {/* Gold + Quick Buy + Shop Button */}
          <div className="flex flex-col gap-1.5 w-[148px]">
            <button
              type="button"
              onClick={onOpenShop}
              className="w-full px-3 py-2 rounded-lg bg-[#11192b]/95 hover:bg-[#19243d] border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-100 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                Toko (P)
              </span>
              <span className="font-mono-tabular text-amber-400 font-bold">
                {Math.floor(player.gold)}g
              </span>
            </button>

            {nextRecItem && (
              <button
                type="button"
                disabled={!canQuickBuy}
                onClick={() => canQuickBuy && onQuickBuy(nextRecItem.id)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                  canQuickBuy
                    ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 cursor-pointer'
                    : 'bg-[#11192b]/85 border-slate-800 text-slate-400 cursor-default'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold truncate">
                  <span className="truncate">{nextRecItem.name}</span>
                  <span className="font-mono-tabular shrink-0">{nextRecItem.cost}g</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Top-Center: Scoreboard Strip & Kill Banner */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenScoreboard}
            className="px-4 py-2 rounded-xl bg-[#11192b]/95 hover:bg-[#18233a] border border-slate-700/90 shadow-lg flex items-center gap-4 text-xs cursor-pointer transition-colors"
            title="Buka Papan Skor (Tab)"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-xs text-slate-400">T:{blueTurretsAlive}</span>
              <span className="font-mono-tabular text-lg font-extrabold text-blue-400">
                {state.blueKills}
              </span>
            </div>

            <div className="px-2.5 py-0.5 border-x border-slate-800 text-center">
              <div className="font-mono-tabular text-sm font-bold text-slate-100">
                {formatMatchTime(state.elapsedTime)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono-tabular">
                KDA {player.kills}/{player.deaths}/{player.assists}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-lg font-extrabold text-rose-400">
                {state.redKills}
              </span>
              <span className="font-mono-tabular text-xs text-slate-400">T:{redTurretsAlive}</span>
            </div>
          </button>

          {(state.blueLordBuffTimer > 0 || state.redLordBuffTimer > 0) && (
            <div className="px-3 py-1 rounded-lg bg-[#11192b]/95 border border-amber-500/60 text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              Berkah Dewata Lord aktif ({Math.ceil(Math.max(state.blueLordBuffTimer, state.redLordBuffTimer))}d)
            </div>
          )}

          {state.killBanner && (
            <div
              className={`mt-1 px-6 py-2.5 rounded-xl border shadow-2xl text-center pointer-events-none ${
                state.killBanner.team === 'blue'
                  ? 'bg-[#0f1d36]/95 border-amber-400/70 text-amber-300'
                  : 'bg-[#2a1218]/95 border-rose-500/70 text-rose-300'
              }`}
            >
              <div className="font-display text-base sm:text-lg font-extrabold tracking-wide">
                {state.killBanner.title}
              </div>
              <div className="text-xs text-slate-200">{state.killBanner.subtitle}</div>
            </div>
          )}
        </div>

        {/* Top-Right: Controls & Kill Feed */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenScoreboard}
              aria-label="Papan Skor"
              className="w-10 h-10 rounded-lg bg-[#11192b]/95 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
              className="w-10 h-10 rounded-lg bg-[#11192b]/95 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Jeda Permainan"
              className="w-10 h-10 rounded-lg bg-[#11192b]/95 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Kill Feed */}
          <div className="hidden sm:flex flex-col items-end gap-1 pointer-events-none">
            {state.killFeed.slice(0, 3).map((kf) => (
              <div
                key={kf.id}
                className="px-2.5 py-1 rounded bg-[#0b111e]/85 border border-slate-800/80 text-[11px] text-slate-200 flex items-center gap-1.5"
              >
                <span className={kf.killerTeam === 'blue' ? 'text-blue-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {kf.killerName}
                </span>
                <span className="text-slate-500">→</span>
                <span className={kf.victimTeam === 'blue' ? 'text-blue-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {kf.victimName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Respawn Overlay Notice */}
      {!player.alive && (
        <div className="self-center px-6 py-3 rounded-xl bg-[#0b111e]/90 border border-rose-500/60 text-center">
          <div className="text-xs text-slate-300">Hero Gugur · Hidup kembali dalam</div>
          <div className="font-mono-tabular text-2xl font-bold text-rose-400">
            {Math.ceil(player.respawnTimer)} detik
          </div>
        </div>
      )}

      {/* BOTTOM HUD ROW */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Virtual Analog Joystick */}
        <div className="flex items-end gap-4 pointer-events-auto">
          <div
            ref={joystickRef}
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyUp}
            onPointerCancel={handleJoyUp}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#11192b]/75 border-2 border-slate-600/70 backdrop-blur-sm relative flex items-center justify-center touch-none-canvas cursor-grab active:cursor-grabbing"
          >
            <div className="w-12 h-12 rounded-full border border-slate-700/60 pointer-events-none" />
            <div
              className="w-11 h-11 rounded-full bg-amber-500/90 border-2 border-amber-200 shadow-lg absolute pointer-events-none"
              style={{
                transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`,
              }}
            />
          </div>
        </div>

        {/* Bottom-Center: Player Status & Recall */}
        <div className="hidden md:flex items-center gap-3 bg-[#11192b]/92 border border-slate-700/80 rounded-xl px-4 py-2.5 pointer-events-auto shadow-xl">
          <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-amber-400 shrink-0">
            <HeroAvatar hero={heroDef} className="w-full h-full" />
            <span className="absolute bottom-0 right-0 bg-[#0b111e] text-[10px] font-mono-tabular font-bold text-amber-300 px-1 rounded-tl">
              {player.level}
            </span>
          </div>

          <div className="w-48 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-100">{player.name}</span>
              <span className="font-mono-tabular text-emerald-400">
                {Math.round(player.hp)} / {player.maxHp}
              </span>
            </div>
            <div className="h-2 w-full bg-[#090d16] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-100"
                style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }}
              />
            </div>
            <div className="h-1.5 w-full bg-[#090d16] rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-100"
                style={{ width: `${Math.max(0, (player.mana / player.maxMana) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
              <span>ATK {playerStats.atk}</span>
              <span>MAG {playerStats.mag}</span>
              <span>ARM {playerStats.armor}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onRecall}
            title="Recall ke Base (B)"
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              player.recallChannel > 0
                ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                : 'bg-[#0b111e] hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-sky-400" />
            <span className="text-[10px] font-mono-tabular">
              {player.recallChannel > 0 ? `${player.recallChannel.toFixed(1)}d` : 'Recall (B)'}
            </span>
          </button>
        </div>

        {/* Bottom-Right: Mobile Legends Skill & Attack Cluster */}
        <div className="flex items-end gap-2.5 sm:gap-3 pointer-events-auto">
          {/* Recall compact for mobile */}
          <button
            type="button"
            onClick={onRecall}
            className="md:hidden w-11 h-11 rounded-full bg-[#11192b]/95 border border-sky-500/70 text-sky-300 flex items-center justify-center cursor-pointer"
            title="Recall"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Battle Spell Button */}
          <button
            type="button"
            onClick={onCastSpell}
            disabled={player.spellCooldown > 0 || !player.alive}
            title={`${spellDef.name} (F): ${spellDef.description}`}
            className="relative w-12 h-12 rounded-full bg-[#11192b]/95 border-2 flex flex-col items-center justify-center cursor-pointer disabled:opacity-60"
            style={{ borderColor: spellDef.color }}
          >
            <span className="text-[10px] font-bold text-slate-100 leading-none">
              {spellDef.name.slice(0, 4)}
            </span>
            <span className="text-[9px] font-mono-tabular text-slate-400 mt-0.5">F</span>
            {player.spellCooldown > 0 && (
              <span className="absolute inset-0 rounded-full bg-black/75 flex items-center justify-center font-mono-tabular text-xs font-bold text-white">
                {Math.ceil(player.spellCooldown)}
              </span>
            )}
          </button>

          {/* 3 Skills */}
          <div className="flex items-end gap-2">
            {heroDef.skills.map((skill, idx) => {
              const slot = idx as 0 | 1 | 2;
              const cd = player.skillCooldowns[slot];
              const lvl = player.skillLevels[slot];
              const canUpgrade =
                player.skillPoints > 0 &&
                (slot < 2 ? lvl < 5 : lvl < 3 && player.level >= 4);
              const noMana = player.mana < skill.manaCost;
              const locked = lvl <= 0;

              return (
                <div key={skill.id} className="relative flex flex-col items-center">
                  {canUpgrade && (
                    <button
                      type="button"
                      onClick={() => onUpgradeSkill(slot)}
                      aria-label={`Tingkatkan ${skill.name}`}
                      className="mb-1.5 w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onCastSkill(slot)}
                    disabled={locked || cd > 0 || !player.alive}
                    title={`${skill.name} (${skill.keyHint}) — Mana ${skill.manaCost}`}
                    className={`relative rounded-full border-2 bg-[#11192b]/95 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                      slot === 2 ? 'w-16 h-16' : 'w-14 h-14'
                    } ${locked ? 'opacity-45 border-slate-700' : noMana ? 'opacity-65' : ''}`}
                    style={{ borderColor: locked ? '#334155' : skill.color }}
                  >
                    <span className="text-[11px] font-bold text-slate-100 leading-tight px-1 truncate max-w-full">
                      {slot === 2 ? 'ULT' : `S${slot + 1}`}
                    </span>
                    <span className="text-[10px] font-mono-tabular text-slate-400">
                      {skill.keyHint}
                    </span>

                    {cd > 0 && (
                      <span className="absolute inset-0 rounded-full bg-black/75 flex items-center justify-center font-mono-tabular text-sm font-bold text-white">
                        {cd < 1 ? cd.toFixed(1) : Math.ceil(cd)}
                      </span>
                    )}
                  </button>

                  {/* Skill level pips */}
                  <div className="flex items-center gap-0.5 mt-1">
                    {Array.from({ length: slot === 2 ? 3 : 5 }).map((_, pIdx) => (
                      <span
                        key={pIdx}
                        className={`w-1.5 h-1.5 rounded-full ${
                          pIdx < lvl ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Target Priority + Main Basic Attack Button */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onBasicAttack('minion')}
                className="px-2 py-1 rounded-md bg-[#11192b]/95 hover:bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-200 cursor-pointer"
                title="Serang Minion terdekat"
              >
                Minion
              </button>
              <button
                type="button"
                onClick={() => onBasicAttack('turret')}
                className="px-2 py-1 rounded-md bg-[#11192b]/95 hover:bg-slate-800 border border-slate-700 text-[10px] font-semibold text-amber-300 cursor-pointer"
                title="Serang Turret terdekat"
              >
                Turret
              </button>
            </div>

            <button
              type="button"
              onClick={() => onBasicAttack('auto')}
              disabled={!player.alive}
              title="Serangan Dasar (Spasi)"
              className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 border-4 border-amber-200/80 text-slate-950 shadow-xl flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
            >
              <Swords className="w-7 h-7 stroke-[2.2]" />
              <span className="text-[10px] font-extrabold font-mono-tabular mt-0.5">SPASI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

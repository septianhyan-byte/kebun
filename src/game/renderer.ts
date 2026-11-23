import {
  BLUE_SPAWN,
  HERO_CATALOG,
  MAP_SIZE,
  RED_SPAWN,
} from './constants';
import { dist } from './engine';
import { HeroEntity, HeroId, MatchState, TurretEntity } from './types';

// Preload hero portraits for canvas medallion rendering
const portraitCache: Partial<Record<HeroId, HTMLImageElement>> = {};
let portraitsInitialized = false;

export function ensurePortraitsLoaded() {
  if (portraitsInitialized || typeof Image === 'undefined') return;
  portraitsInitialized = true;
  (Object.keys(HERO_CATALOG) as HeroId[]).forEach((id) => {
    const img = new Image();
    img.src = HERO_CATALOG[id].portraitUrl;
    portraitCache[id] = img;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawMapTerrain(ctx: CanvasRenderingContext2D, time: number) {
  // Deep forest moss canvas
  ctx.fillStyle = '#0f1c1a';
  ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Subtle organic grid texture across jungle quadrants
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 2;
  for (let i = 200; i < MAP_SIZE; i += 200) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, MAP_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(MAP_SIZE, i);
    ctx.stroke();
  }

  // Jungle biome patches
  const patches = [
    { x: 640, y: 1200, r: 340, color: '#132620' },
    { x: 1220, y: 2050, r: 360, color: '#132620' },
    { x: 2150, y: 1550, r: 340, color: '#1b1d2b' },
    { x: 1580, y: 740, r: 360, color: '#1b1d2b' },
  ];
  for (const p of patches) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diagonal River (Top-Left to Bottom-Right)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#122f46';
  ctx.lineWidth = 230;
  ctx.beginPath();
  ctx.moveTo(140, 140);
  ctx.lineTo(MAP_SIZE - 140, MAP_SIZE - 140);
  ctx.stroke();

  ctx.strokeStyle = '#194364';
  ctx.lineWidth = 175;
  ctx.beginPath();
  ctx.moveTo(140, 140);
  ctx.lineTo(MAP_SIZE - 140, MAP_SIZE - 140);
  ctx.stroke();

  // Animated water shimmer lines
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.14)';
  ctx.lineWidth = 4;
  ctx.setLineDash([40, 55]);
  ctx.lineDashOffset = -time * 36;
  ctx.beginPath();
  ctx.moveTo(220, 220);
  ctx.lineTo(MAP_SIZE - 220, MAP_SIZE - 220);
  ctx.stroke();
  ctx.restore();

  // Cobblestone Lanes (Top, Bot, Mid)
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const drawLanePath = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    // Top + Bot outer perimeter
    ctx.beginPath();
    ctx.moveTo(260, MAP_SIZE - 260);
    ctx.lineTo(260, 260);
    ctx.lineTo(MAP_SIZE - 260, 260);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(260, MAP_SIZE - 260);
    ctx.lineTo(MAP_SIZE - 260, MAP_SIZE - 260);
    ctx.lineTo(MAP_SIZE - 260, 260);
    ctx.stroke();

    // Mid diagonal lane
    ctx.beginPath();
    ctx.moveTo(260, MAP_SIZE - 260);
    ctx.lineTo(MAP_SIZE - 260, 260);
    ctx.stroke();
  };

  drawLanePath(190, '#1c2432');
  drawLanePath(158, '#263042');
  drawLanePath(112, '#2d394e');
  ctx.restore();

  // Mid River Stone Bridge highlight
  ctx.save();
  ctx.translate(MAP_SIZE / 2, MAP_SIZE / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#334155';
  drawRoundedRect(ctx, -150, -74, 300, 148, 18);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Dewata Lord Pit Marker
  ctx.save();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.32)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(940, 940, 155, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Blue & Red Base Platforms + Fountains
  const drawBase = (center: { x: number; y: number }, isBlue: boolean) => {
    const primary = isBlue ? '#1d4ed8' : '#b91c1c';
    const glow = isBlue ? 'rgba(59, 130, 246, 0.22)' : 'rgba(239, 68, 68, 0.22)';
    const border = isBlue ? '#60a5fa' : '#f87171';

    ctx.save();
    ctx.fillStyle = '#192234';
    ctx.strokeStyle = border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 355, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fountain healing circle
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 175, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = primary;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, 175, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  drawBase(BLUE_SPAWN, true);
  drawBase(RED_SPAWN, false);

  // Outer Wall Border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 18;
  ctx.strokeRect(18, 18, MAP_SIZE - 36, MAP_SIZE - 36);
}

function drawBushes(ctx: CanvasRenderingContext2D, state: MatchState, player: HeroEntity | undefined) {
  for (const b of state.bushes) {
    const playerInside = player && player.alive && dist(player, b) < Math.max(b.rx, b.ry);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);
    ctx.fillStyle = playerInside ? 'rgba(34, 197, 94, 0.28)' : 'rgba(22, 101, 52, 0.65)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.rx, b.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Leaf clusters
    ctx.fillStyle = playerInside ? 'rgba(74, 222, 128, 0.28)' : 'rgba(34, 197, 94, 0.25)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * (b.rx * 0.34), (i % 2) * 10, b.ry * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTurret(ctx: CanvasRenderingContext2D, t: TurretEntity, state: MatchState, player: HeroEntity | undefined) {
  if (!t.alive) {
    // Rubble
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const isBlue = t.team === 'blue';
  const mainColor = isBlue ? '#3b82f6' : '#ef4444';
  const glowColor = isBlue ? 'rgba(59, 130, 246, 0.14)' : 'rgba(239, 68, 68, 0.14)';

  // Show range ring if player is near enemy turret or turret targets player
  const playerNear = player && player.alive && dist(player, t) < t.range + 180;
  if (playerNear && !isBlue) {
    const targetingPlayer = t.targetUid === player.uid;
    ctx.save();
    ctx.strokeStyle = targetingPlayer ? 'rgba(239, 68, 68, 0.85)' : 'rgba(248, 113, 113, 0.3)';
    ctx.fillStyle = targetingPlayer ? 'rgba(239, 68, 68, 0.08)' : 'transparent';
    ctx.lineWidth = targetingPlayer ? 3 : 1.5;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Active target laser
  if (t.targetUid) {
    const targetHero = state.heroes.find((h) => h.uid === t.targetUid && h.alive);
    const targetMinion = !targetHero ? state.minions.find((m) => m.uid === t.targetUid && m.hp > 0) : undefined;
    const tgt = targetHero || targetMinion;
    if (tgt) {
      ctx.save();
      ctx.strokeStyle = targetHero?.isPlayer ? 'rgba(239, 68, 68, 0.75)' : 'rgba(251, 146, 60, 0.35)';
      ctx.lineWidth = targetHero?.isPlayer ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Stone base & crystal spire
  ctx.save();
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius + 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner crystal diamond
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  const s = t.isNexus ? 26 : 16;
  ctx.moveTo(t.x, t.y - s);
  ctx.lineTo(t.x + s * 0.8, t.y);
  ctx.lineTo(t.x, t.y + s);
  ctx.lineTo(t.x - s * 0.8, t.y);
  ctx.closePath();
  ctx.fill();

  // HP Bar above turret
  const bw = t.isNexus ? 96 : 68;
  const bh = 8;
  const bx = t.x - bw / 2;
  const by = t.y - t.radius - 20;
  ctx.fillStyle = '#090d16';
  drawRoundedRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, 3);
  ctx.fill();
  ctx.fillStyle = mainColor;
  drawRoundedRect(ctx, bx, by, bw * Math.max(0, t.hp / t.maxHp), bh, 2);
  ctx.fill();
  ctx.restore();
}

function drawHero(ctx: CanvasRenderingContext2D, h: HeroEntity, state: MatchState) {
  if (!h.alive) return;

  // Check bush stealth visibility against player's team (Blue)
  if (h.team === 'red' && h.inBush && h.revealedTimer <= 0) {
    const spotted =
      state.heroes.some((bh) => bh.team === 'blue' && bh.alive && dist(bh, h) < 165) ||
      state.minions.some((bm) => bm.team === 'blue' && bm.hp > 0 && dist(bm, h) < 150) ||
      state.turrets.some((bt) => bt.team === 'blue' && bt.alive && dist(bt, h) < bt.range);
    if (!spotted) return;
  }

  const isBlue = h.team === 'blue';
  const ringColor = h.isPlayer ? '#fbbf24' : isBlue ? '#3b82f6' : '#ef4444';
  const def = HERO_CATALOG[h.heroId];

  ctx.save();
  if (h.inBush) ctx.globalAlpha = 0.72;

  // Player selection ground indicator + attack range subtle circle
  if (h.isPlayer) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, def.baseStats.attackRange, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Facing direction chevron
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.facing);
  ctx.fillStyle = ringColor;
  ctx.beginPath();
  ctx.moveTo(h.radius + 11, 0);
  ctx.lineTo(h.radius + 2, -6);
  ctx.lineTo(h.radius + 2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Recall channel ring
  if (h.recallChannel > 0) {
    const progress = 1 - h.recallChannel / 3.2;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }

  // Hero Portrait Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
  ctx.clip();

  const img = portraitCache[h.heroId];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, h.x - h.radius, h.y - h.radius, h.radius * 2, h.radius * 2);
  } else {
    ctx.fillStyle = def.accentColor;
    ctx.fillRect(h.x - h.radius, h.y - h.radius, h.radius * 2, h.radius * 2);
  }
  ctx.restore();

  // Crisp team border
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = h.isPlayer ? 3.5 : 3;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Stun / Invulnerable indicator
  if (h.stunTimer > 0) {
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (h.invulnerableTimer > 0) {
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HP + Mana + Level Plate above hero
  const bw = 66;
  const bx = h.x - bw / 2;
  const by = h.y - h.radius - 23;

  // Name
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = h.isPlayer ? '#fde68a' : '#f1f5f9';
  ctx.fillText(h.name, h.x, by - 5);

  // Level badge square
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, bx - 17, by - 2, 15, 15, 3);
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(String(h.level), bx - 9.5, by + 9);

  // HP Bar background
  ctx.fillStyle = '#090d16';
  drawRoundedRect(ctx, bx, by, bw, 7, 2);
  ctx.fill();

  const hpPct = Math.max(0, h.hp / h.maxHp);
  ctx.fillStyle = h.isPlayer ? '#10b981' : isBlue ? '#3b82f6' : '#ef4444';
  drawRoundedRect(ctx, bx, by, bw * hpPct, 7, 2);
  ctx.fill();

  // Shield overlay on HP bar
  if (h.shield > 0) {
    const shPct = Math.min(1, h.shield / h.maxHp);
    ctx.fillStyle = '#e2e8f0';
    drawRoundedRect(ctx, bx, by, bw * shPct, 3, 1);
    ctx.fill();
  }

  // Mana Bar
  ctx.fillStyle = '#090d16';
  drawRoundedRect(ctx, bx, by + 8, bw, 3.5, 1);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  drawRoundedRect(ctx, bx, by + 8, bw * Math.max(0, h.mana / h.maxMana), 3.5, 1);
  ctx.fill();

  ctx.restore();
}

export function renderArena(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  viewportWidth: number,
  viewportHeight: number
) {
  ensurePortraitsLoaded();

  ctx.save();
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Center camera
  const offsetX = viewportWidth / 2 - state.camera.x;
  const offsetY = viewportHeight / 2 - state.camera.y;
  ctx.translate(offsetX, offsetY);

  drawMapTerrain(ctx, state.elapsedTime);

  const player = state.heroes.find((h) => h.isPlayer);

  // Jungle Creeps
  for (const c of state.jungleCreeps) {
    if (!c.alive) continue;
    ctx.save();
    const isLord = c.kind === 'lord';
    ctx.fillStyle = isLord ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.14)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius + 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isLord ? '#92400e' : '#1e293b';
    ctx.strokeStyle = isLord ? '#fbbf24' : '#34d399';
    ctx.lineWidth = isLord ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner rune
    ctx.fillStyle = isLord ? '#fbbf24' : '#34d399';
    ctx.font = `700 ${isLord ? 14 : 11}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isLord ? 'LORD' : 'BUFF', c.x, c.y + 4);

    // HP Bar
    const bw = isLord ? 84 : 48;
    const bx = c.x - bw / 2;
    const by = c.y - c.radius - 14;
    ctx.fillStyle = '#090d16';
    drawRoundedRect(ctx, bx, by, bw, 6, 2);
    ctx.fill();
    ctx.fillStyle = isLord ? '#f59e0b' : '#10b981';
    drawRoundedRect(ctx, bx, by, bw * Math.max(0, c.hp / c.maxHp), 6, 2);
    ctx.fill();
    ctx.restore();
  }

  // Turrets
  for (const t of state.turrets) {
    drawTurret(ctx, t, state, player);
  }

  // Minions
  for (const m of state.minions) {
    if (m.hp <= 0) continue;
    const isBlue = m.team === 'blue';
    ctx.save();
    ctx.fillStyle = isBlue ? '#2563eb' : '#dc2626';
    ctx.strokeStyle = isBlue ? '#93c5fd' : '#fca5a5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (m.kind === 'ranged') {
      ctx.moveTo(m.x, m.y - m.radius);
      ctx.lineTo(m.x + m.radius, m.y + m.radius);
      ctx.lineTo(m.x - m.radius, m.y + m.radius);
      ctx.closePath();
    } else {
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Minion HP bar
    const bw = m.kind === 'siege' ? 40 : 26;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(m.x - bw / 2, m.y - m.radius - 9, bw, 4);
    ctx.fillStyle = isBlue ? '#60a5fa' : '#f87171';
    ctx.fillRect(m.x - bw / 2, m.y - m.radius - 9, bw * Math.max(0, m.hp / m.maxHp), 4);
    ctx.restore();
  }

  // Bushes (drawn subtly translucent over ground)
  drawBushes(ctx, state, player);

  // Heroes
  for (const h of state.heroes) {
    drawHero(ctx, h, state);
  }

  // Projectiles
  for (const p of state.projectiles) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Visual Skill Effects
  for (const fx of state.effects) {
    const t = 1 - fx.timer / fx.duration;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = fx.color;
    ctx.fillStyle = fx.color;

    if (fx.kind === 'ring' || fx.kind === 'shield' || fx.kind === 'heal') {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.kind === 'meteor' || fx.kind === 'freeze') {
      ctx.globalAlpha = (1 - t) * 0.28;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (fx.kind === 'slash') {
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.angle || 0);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, fx.radius * 0.75, -0.85, 0.85);
      ctx.stroke();
    } else {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Floating Damage / Gold / Level Texts
  for (const ft of state.floatingTexts) {
    const alpha = Math.min(1, ft.timer / (ft.duration * 0.6));
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = ft.big
      ? '700 15px "JetBrains Mono", monospace'
      : '600 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#090d16';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  size: number,
  viewportWidth: number,
  viewportHeight: number
) {
  const scale = size / MAP_SIZE;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0b141a';
  ctx.fillRect(0, 0, size, size);

  // River
  ctx.strokeStyle = '#194364';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.stroke();

  // Lanes
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(size * 0.1, size * 0.9);
  ctx.lineTo(size * 0.1, size * 0.1);
  ctx.lineTo(size * 0.9, size * 0.1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.1, size * 0.9);
  ctx.lineTo(size * 0.9, size * 0.9);
  ctx.lineTo(size * 0.9, size * 0.1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.1, size * 0.9);
  ctx.lineTo(size * 0.9, size * 0.1);
  ctx.stroke();

  // Jungle Creeps & Lord
  for (const c of state.jungleCreeps) {
    if (!c.alive) continue;
    ctx.fillStyle = c.kind === 'lord' ? '#f59e0b' : '#10b981';
    ctx.beginPath();
    ctx.arc(c.x * scale, c.y * scale, c.kind === 'lord' ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Minions
  for (const m of state.minions) {
    if (m.hp <= 0) continue;
    ctx.fillStyle = m.team === 'blue' ? '#60a5fa' : '#f87171';
    ctx.fillRect(m.x * scale - 1, m.y * scale - 1, 2, 2);
  }

  // Turrets
  for (const t of state.turrets) {
    if (!t.alive) continue;
    ctx.fillStyle = t.team === 'blue' ? '#3b82f6' : '#ef4444';
    const r = t.isNexus ? 4.5 : 3;
    ctx.fillRect(t.x * scale - r, t.y * scale - r, r * 2, r * 2);
  }

  // Heroes (visible to Blue team)
  for (const h of state.heroes) {
    if (!h.alive) continue;
    if (h.team === 'red' && h.inBush && h.revealedTimer <= 0) {
      const spotted =
        state.heroes.some((bh) => bh.team === 'blue' && bh.alive && dist(bh, h) < 165) ||
        state.minions.some((bm) => bm.team === 'blue' && bm.hp > 0 && dist(bm, h) < 150) ||
        state.turrets.some((bt) => bt.team === 'blue' && bt.alive && dist(bt, h) < bt.range);
      if (!spotted) continue;
    }

    ctx.fillStyle = h.isPlayer ? '#fbbf24' : h.team === 'blue' ? '#3b82f6' : '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(h.x * scale, h.y * scale, h.isPlayer ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Camera Viewport Box
  const vw = viewportWidth * scale;
  const vh = viewportHeight * scale;
  const vx = state.camera.x * scale - vw / 2;
  const vy = state.camera.y * scale - vh / 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1;
  ctx.strokeRect(vx, vy, vw, vh);
}

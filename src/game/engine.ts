import {
  BATTLE_SPELLS,
  BLUE_SPAWN,
  HERO_CATALOG,
  HERO_LIST,
  ITEM_MAP,
  LANE_WAYPOINTS_BLUE,
  MAP_BUSHES,
  MAP_SIZE,
  RECOMMENDED_BUILDS,
  RED_SPAWN,
} from './constants';
import { soundFX } from './sound';
import {
  BattleSpellId,
  Difficulty,
  HeroEntity,
  HeroId,
  JungleCreepEntity,
  LaneId,
  MatchMode,
  MatchState,
  MinionEntity,
  TargetPriority,
  Team,
  TurretEntity,
  Vec2,
} from './types';

let uidSeq = 1;
const nextUid = (prefix: string) => `${prefix}_${uidSeq++}`;

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function formatMatchTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export interface ComputedHeroStats {
  maxHp: number;
  maxMana: number;
  atk: number;
  mag: number;
  armor: number;
  moveSpeed: number;
  attackInterval: number;
  attackRange: number;
  cdr: number;
  lifesteal: number;
  critChance: number;
}

export function getHeroComputedStats(hero: HeroEntity, state: MatchState): ComputedHeroStats {
  const def = HERO_CATALOG[hero.heroId];
  const lvl = hero.level - 1;

  let maxHp = def.baseStats.maxHp + def.baseStats.hpPerLevel * lvl;
  let maxMana = def.baseStats.maxMana + def.baseStats.manaPerLevel * lvl;
  let atk = def.baseStats.atk + def.baseStats.atkPerLevel * lvl;
  let mag = def.baseStats.mag + lvl * 12;
  let armor = def.baseStats.armor + def.baseStats.armorPerLevel * lvl;
  let moveSpeed = def.baseStats.moveSpeed;
  let atkSpeedBonus = 0;
  let cdr = 0;
  let lifesteal = 0;
  let critChance = 0.05;

  for (const itemId of hero.items) {
    const item = ITEM_MAP[itemId];
    if (!item) continue;
    if (item.stats.hp) maxHp += item.stats.hp;
    if (item.stats.atk) atk += item.stats.atk;
    if (item.stats.mag) mag += item.stats.mag;
    if (item.stats.armor) armor += item.stats.armor;
    if (item.stats.moveSpeed) moveSpeed += item.stats.moveSpeed;
    if (item.stats.atkSpeed) atkSpeedBonus += item.stats.atkSpeed;
    if (item.stats.cdr) cdr += item.stats.cdr;
    if (item.stats.lifesteal) lifesteal += item.stats.lifesteal;
    if (item.stats.critChance) critChance += item.stats.critChance;
  }

  // Hero Passives
  if (hero.heroId === 'larasati' && hero.passiveStacks > 0) {
    atkSpeedBonus += hero.passiveStacks * 0.08;
  }
  if (hero.heroId === 'bima') {
    const nearAllyOrTurret =
      state.heroes.some((h) => h.uid !== hero.uid && h.team === hero.team && h.alive && dist(h, hero) < 340) ||
      state.turrets.some((t) => t.team === hero.team && t.alive && dist(t, hero) < 340);
    if (nearAllyOrTurret) {
      armor *= 1.18;
    }
  }

  // Buffs & Debuffs
  if (hero.inspireTimer > 0) {
    atkSpeedBonus += 0.65;
    lifesteal += 0.18;
  }

  const lordActive = hero.team === 'blue' ? state.blueLordBuffTimer > 0 : state.redLordBuffTimer > 0;
  if (lordActive) {
    atk *= 1.2;
    mag *= 1.2;
  }

  if (hero.speedBuffTimer > 0) {
    moveSpeed *= 1 + hero.speedBuffFactor;
  }
  if (hero.slowTimer > 0) {
    moveSpeed *= Math.max(0.4, 1 - hero.slowFactor);
  }

  const attackInterval = Math.max(0.24, def.baseStats.attackInterval / (1 + atkSpeedBonus));
  cdr = clamp(cdr, 0, 0.4);

  return {
    maxHp: Math.round(maxHp),
    maxMana: Math.round(maxMana),
    atk: Math.round(atk),
    mag: Math.round(mag),
    armor: Math.round(armor),
    moveSpeed: Math.round(moveSpeed),
    attackInterval,
    attackRange: def.baseStats.attackRange,
    cdr,
    lifesteal,
    critChance: clamp(critChance, 0, 0.85),
  };
}

function createHeroEntity(
  heroId: HeroId,
  team: Team,
  lane: LaneId,
  isPlayer: boolean,
  battleSpell: BattleSpellId,
  slotOffset: number
): HeroEntity {
  const def = HERO_CATALOG[heroId];
  const base = team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
  const angle = (slotOffset / 5) * Math.PI * 2;
  const x = base.x + Math.cos(angle) * 55;
  const y = base.y + Math.sin(angle) * 55;

  return {
    uid: nextUid(team === 'blue' ? 'bhero' : 'rhero'),
    heroId,
    name: def.name,
    role: def.role,
    team,
    isPlayer,
    lane,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: team === 'blue' ? -Math.PI / 4 : (3 * Math.PI) / 4,
    radius: 26,
    level: 1,
    xp: 0,
    xpToNext: 120,
    skillPoints: 1,
    skillLevels: [1, 0, 0],
    hp: def.baseStats.maxHp,
    maxHp: def.baseStats.maxHp,
    mana: def.baseStats.maxMana,
    maxMana: def.baseStats.maxMana,
    shield: 0,
    shieldTimer: 0,
    gold: 450,
    items: [],
    battleSpell,
    spellCooldown: 0,
    skillCooldowns: [0, 0, 0],
    attackCooldown: 0,
    basicAttackCount: 0,
    passiveBuffTimer: 0,
    passiveStacks: 0,
    frostMarks: 0,
    stunTimer: 0,
    slowTimer: 0,
    slowFactor: 0,
    speedBuffTimer: 0,
    speedBuffFactor: 0,
    inspireTimer: 0,
    invulnerableTimer: 0,
    recallChannel: 0,
    inBush: false,
    revealedTimer: 0,
    alive: true,
    respawnTimer: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    damageDealt: 0,
    turretDamage: 0,
    goldEarned: 450,
    killStreak: 0,
    multiKillCount: 0,
    multiKillWindow: 0,
    assisters: {},
    aiState: 'advance',
    aiWaypointIdx: team === 'blue' ? 1 : LANE_WAYPOINTS_BLUE[lane].length - 2,
    aiDecisionTimer: 0,
  };
}

function createTurrets(): TurretEntity[] {
  const list: TurretEntity[] = [];
  const addTurret = (team: Team, lane: LaneId | 'base', tier: 1 | 2 | 3, x: number, y: number) => {
    const isNexus = tier === 3;
    const maxHp = isNexus ? 5200 : tier === 2 ? 3200 : 2400;
    list.push({
      uid: nextUid('turret'),
      team,
      lane,
      tier,
      x,
      y,
      radius: isNexus ? 54 : 36,
      range: isNexus ? 340 : 300,
      hp: maxHp,
      maxHp,
      atk: isNexus ? 260 : tier === 2 ? 215 : 185,
      attackCooldown: 0,
      targetUid: null,
      alive: true,
      isNexus,
    });
  };

  // Blue Team Structures (bottom-left)
  addTurret('blue', 'base', 3, BLUE_SPAWN.x + 115, BLUE_SPAWN.y - 115);
  addTurret('blue', 'top', 1, 265, 1120);
  addTurret('blue', 'top', 2, 265, 1920);
  addTurret('blue', 'mid', 1, 1020, MAP_SIZE - 1020);
  addTurret('blue', 'mid', 2, 650, MAP_SIZE - 650);
  addTurret('blue', 'bot', 1, 1680, MAP_SIZE - 265);
  addTurret('blue', 'bot', 2, 880, MAP_SIZE - 265);

  // Red Team Structures (top-right)
  addTurret('red', 'base', 3, RED_SPAWN.x - 115, RED_SPAWN.y + 115);
  addTurret('red', 'top', 1, 1120, 265);
  addTurret('red', 'top', 2, 1920, 265);
  addTurret('red', 'mid', 1, MAP_SIZE - 1020, 1020);
  addTurret('red', 'mid', 2, MAP_SIZE - 650, 650);
  addTurret('red', 'bot', 1, MAP_SIZE - 265, 1680);
  addTurret('red', 'bot', 2, MAP_SIZE - 265, 880);

  return list;
}

function createJungleCreeps(): JungleCreepEntity[] {
  return [
    {
      uid: nextUid('creep'),
      kind: 'forest',
      name: 'Penjaga Hutan Biru',
      x: 760,
      y: 1620,
      homeX: 760,
      homeY: 1620,
      radius: 28,
      hp: 1350,
      maxHp: 1350,
      atk: 62,
      range: 105,
      attackCooldown: 0,
      alive: true,
      respawnTimer: 0,
      goldReward: 130,
      xpReward: 110,
      aggroTargetUid: null,
    },
    {
      uid: nextUid('creep'),
      kind: 'forest',
      name: 'Roh Rimba Selatan',
      x: 1220,
      y: 2120,
      homeX: 1220,
      homeY: 2120,
      radius: 28,
      hp: 1350,
      maxHp: 1350,
      atk: 62,
      range: 105,
      attackCooldown: 0,
      alive: true,
      respawnTimer: 0,
      goldReward: 130,
      xpReward: 110,
      aggroTargetUid: null,
    },
    {
      uid: nextUid('creep'),
      kind: 'forest',
      name: 'Penjaga Hutan Merah',
      x: 2040,
      y: 1180,
      homeX: 2040,
      homeY: 1180,
      radius: 28,
      hp: 1350,
      maxHp: 1350,
      atk: 62,
      range: 105,
      attackCooldown: 0,
      alive: true,
      respawnTimer: 0,
      goldReward: 130,
      xpReward: 110,
      aggroTargetUid: null,
    },
    {
      uid: nextUid('creep'),
      kind: 'forest',
      name: 'Roh Rimba Utara',
      x: 1580,
      y: 680,
      homeX: 1580,
      homeY: 680,
      radius: 28,
      hp: 1350,
      maxHp: 1350,
      atk: 62,
      range: 105,
      attackCooldown: 0,
      alive: true,
      respawnTimer: 0,
      goldReward: 130,
      xpReward: 110,
      aggroTargetUid: null,
    },
    {
      uid: nextUid('lord'),
      kind: 'lord',
      name: 'Dewata Lord',
      x: 940,
      y: 940,
      homeX: 940,
      homeY: 940,
      radius: 44,
      hp: 4200,
      maxHp: 4200,
      atk: 125,
      range: 130,
      attackCooldown: 0,
      alive: true,
      respawnTimer: 0,
      goldReward: 260,
      xpReward: 240,
      aggroTargetUid: null,
    },
  ];
}

export function createInitialMatchState(
  playerHeroId: HeroId,
  playerSpell: BattleSpellId,
  mode: MatchMode,
  difficulty: Difficulty
): MatchState {
  uidSeq = 1;
  const allHeroIds: HeroId[] = HERO_LIST.map((h) => h.id);
  const otherHeroes = allHeroIds.filter((id) => id !== playerHeroId);
  const spells: BattleSpellId[] = ['flicker', 'execute', 'heal', 'inspire'];

  const playerRole = HERO_CATALOG[playerHeroId].role;
  const playerLane: LaneId =
    playerRole === 'Mage' ? 'mid' : playerRole === 'Marksman' || playerRole === 'Tank' ? 'bot' : 'mid';

  const heroes: HeroEntity[] = [];
  // Player
  const playerHero = createHeroEntity(playerHeroId, 'blue', playerLane, true, playerSpell, 0);
  playerHero.skillPoints = 0; // S1 already unlocked at lv1
  heroes.push(playerHero);

  if (mode === '3v3') {
    const lanes: LaneId[] = ['top', 'mid', 'bot'].filter((l) => l !== playerLane) as LaneId[];
    heroes.push(createHeroEntity(otherHeroes[0], 'blue', lanes[0], false, spells[1], 1));
    heroes.push(createHeroEntity(otherHeroes[1], 'blue', lanes[1], false, spells[2], 2));

    const redPool: HeroId[] = [otherHeroes[2], otherHeroes[3], playerHeroId === 'raka' ? 'larasati' : 'raka'];
    const allLanes: LaneId[] = ['top', 'mid', 'bot'];
    redPool.forEach((hId, i) => {
      heroes.push(createHeroEntity(hId, 'red', allLanes[i], false, spells[i % spells.length], i));
    });
  } else {
    // 5v5: All 5 unique heroes on Blue vs 5 heroes on Red
    const lanesPool: LaneId[] = ['top', 'mid', 'bot', 'bot', 'top'];
    const remainingLanes = lanesPool.filter((_, idx) => idx !== 0);
    otherHeroes.forEach((hId, idx) => {
      heroes.push(createHeroEntity(hId, 'blue', remainingLanes[idx] || 'mid', false, spells[(idx + 1) % 4], idx + 1));
    });

    const redOrder = [...allHeroIds].sort(() => 0.5 - Math.random());
    redOrder.forEach((hId, idx) => {
      heroes.push(createHeroEntity(hId, 'red', lanesPool[idx], false, spells[idx % 4], idx));
    });
  }

  const state: MatchState = {
    mode,
    difficulty,
    mapWidth: MAP_SIZE,
    mapHeight: MAP_SIZE,
    elapsedTime: 0,
    waveTimer: 1.5, // first minion wave spawns quickly
    waveNumber: 0,
    passiveGoldTimer: 1,
    heroes,
    minions: [],
    turrets: createTurrets(),
    jungleCreeps: createJungleCreeps(),
    projectiles: [],
    effects: [],
    floatingTexts: [],
    bushes: MAP_BUSHES,
    blueKills: 0,
    redKills: 0,
    blueLordBuffTimer: 0,
    redLordBuffTimer: 0,
    killBanner: null,
    killFeed: [],
    firstBloodTaken: false,
    winner: null,
    targetPriority: 'auto',
    camera: {
      x: playerHero.x,
      y: playerHero.y,
      peekX: null,
      peekY: null,
    },
  };

  return state;
}

function addFloatingText(
  state: MatchState,
  x: number,
  y: number,
  text: string,
  color: string,
  big = false
) {
  if (state.floatingTexts.length > 55) {
    state.floatingTexts.shift();
  }
  state.floatingTexts.push({
    uid: nextUid('ft'),
    x: x + (Math.random() - 0.5) * 18,
    y: y - 22,
    text,
    color,
    timer: big ? 1.15 : 0.78,
    duration: big ? 1.15 : 0.78,
    big,
  });
}

function addEffect(
  state: MatchState,
  kind: MatchState['effects'][number]['kind'],
  x: number,
  y: number,
  radius: number,
  color: string,
  duration = 0.35,
  angle?: number
) {
  if (state.effects.length > 50) {
    state.effects.shift();
  }
  state.effects.push({
    uid: nextUid('fx'),
    kind,
    x,
    y,
    radius,
    color,
    timer: duration,
    duration,
    angle,
  });
}

function grantXpAndGold(state: MatchState, hero: HeroEntity, gold: number, xp: number) {
  if (!hero.alive && gold === 0) return;
  hero.gold += gold;
  hero.goldEarned += gold;
  hero.xp += xp;

  while (hero.xp >= hero.xpToNext && hero.level < 15) {
    hero.xp -= hero.xpToNext;
    hero.level += 1;
    hero.xpToNext = Math.round(hero.xpToNext * 1.24 + 40);
    hero.skillPoints += 1;

    const stats = getHeroComputedStats(hero, state);
    const hpDiff = stats.maxHp - hero.maxHp;
    hero.maxHp = stats.maxHp;
    hero.maxMana = stats.maxMana;
    hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(120, hpDiff));
    hero.mana = Math.min(hero.maxMana, hero.mana + 110);

    addEffect(state, 'ring', hero.x, hero.y, 68, '#fbbf24', 0.55);
    addFloatingText(state, hero.x, hero.y - 18, `Level ${hero.level}!`, '#fbbf24', true);
    if (hero.isPlayer) {
      soundFX.playLevelUp();
    }
  }
}

function getHeroByUid(state: MatchState, uid?: string | null): HeroEntity | undefined {
  if (!uid) return undefined;
  return state.heroes.find((h) => h.uid === uid);
}

function isHeroVisibleToTeam(hero: HeroEntity, viewerTeam: Team, state: MatchState): boolean {
  if (hero.team === viewerTeam) return true;
  if (!hero.alive) return false;
  if (!hero.inBush || hero.revealedTimer > 0) return true;

  // Revealed if an enemy hero/minion/turret is close
  for (const h of state.heroes) {
    if (h.team === viewerTeam && h.alive && dist(h, hero) < 165) return true;
  }
  for (const m of state.minions) {
    if (m.team === viewerTeam && m.hp > 0 && dist(m, hero) < 150) return true;
  }
  for (const t of state.turrets) {
    if (t.team === viewerTeam && t.alive && dist(t, hero) < t.range) return true;
  }
  return false;
}

function handleHeroDeath(state: MatchState, victim: HeroEntity, attackerHero?: HeroEntity) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.deaths += 1;
  victim.killStreak = 0;
  victim.respawnTimer = 6 + victim.level * 1.1;
  victim.recallChannel = 0;
  victim.stunTimer = 0;

  if (victim.team === 'blue') state.redKills += 1;
  else state.blueKills += 1;

  if (attackerHero && attackerHero.team !== victim.team) {
    attackerHero.kills += 1;
    attackerHero.killStreak += 1;
    attackerHero.multiKillCount = attackerHero.multiKillWindow > 0 ? attackerHero.multiKillCount + 1 : 1;
    attackerHero.multiKillWindow = 8.5;

    const bounty = 220 + victim.level * 18;
    grantXpAndGold(state, attackerHero, bounty, 180 + victim.level * 22);
    addFloatingText(state, victim.x, victim.y - 30, `+${bounty}g`, '#fbbf24', true);

    // Assists
    for (const [assisterUid, dmgTime] of Object.entries(victim.assisters)) {
      if (assisterUid !== attackerHero.uid && state.elapsedTime - dmgTime <= 8) {
        const ally = getHeroByUid(state, assisterUid);
        if (ally && ally.team === attackerHero.team) {
          ally.assists += 1;
          grantXpAndGold(state, ally, 90, 95);
        }
      }
    }

    // Banner announcements
    let bannerTitle = `${attackerHero.name} mengeliminasi ${victim.name}`;
    let bannerSub = attackerHero.team === 'blue' ? 'Tim Biru Unggul' : 'Tim Merah Menyerang';

    if (!state.firstBloodTaken) {
      state.firstBloodTaken = true;
      bannerTitle = 'DARAH PERTAMA!';
      bannerSub = `${attackerHero.name} menjatuhkan ${victim.name}`;
    } else if (attackerHero.multiKillCount === 2) {
      bannerTitle = 'PEMBUNUHAN GANDA!';
      bannerSub = `${attackerHero.name} · Double Kill`;
    } else if (attackerHero.multiKillCount === 3) {
      bannerTitle = 'TIGA KALI BERUNTUN!';
      bannerSub = `${attackerHero.name} · Triple Kill`;
    } else if (attackerHero.multiKillCount >= 4) {
      bannerTitle = 'TAK TERHENTIKAN!';
      bannerSub = `${attackerHero.name} · Maniac`;
    } else if (attackerHero.killStreak >= 5) {
      bannerTitle = 'LEGENDA ARENA!';
      bannerSub = `${attackerHero.name} (${attackerHero.killStreak} Kill Beruntun)`;
    }

    state.killBanner = {
      id: nextUid('kb'),
      title: bannerTitle,
      subtitle: bannerSub,
      team: attackerHero.team,
      timer: 3.2,
    };

    state.killFeed.unshift({
      id: nextUid('kf'),
      killerName: attackerHero.name,
      killerTeam: attackerHero.team,
      victimName: victim.name,
      victimTeam: victim.team,
      timeStr: formatMatchTime(state.elapsedTime),
    });
    if (state.killFeed.length > 5) state.killFeed.pop();

    if (attackerHero.isPlayer || victim.isPlayer) {
      soundFX.playKill(false);
    }
  } else {
    state.killFeed.unshift({
      id: nextUid('kf'),
      killerName: 'Turret',
      killerTeam: victim.team === 'blue' ? 'red' : 'blue',
      victimName: victim.name,
      victimTeam: victim.team,
      timeStr: formatMatchTime(state.elapsedTime),
    });
    if (state.killFeed.length > 5) state.killFeed.pop();
  }

  addEffect(state, 'ring', victim.x, victim.y, 75, '#ef4444', 0.5);
}

function applyDamageToHero(
  state: MatchState,
  target: HeroEntity,
  rawDamage: number,
  damageType: 'physical' | 'magic' | 'true',
  attackerUid?: string
) {
  if (!target.alive || target.invulnerableTimer > 0) return;
  const targetStats = getHeroComputedStats(target, state);

  let finalDmg = rawDamage;
  if (damageType === 'physical') {
    finalDmg = rawDamage * (100 / (100 + targetStats.armor));
  } else if (damageType === 'magic') {
    finalDmg = rawDamage * (100 / (100 + targetStats.armor * 0.6));
  }
  finalDmg = Math.max(10, Math.round(finalDmg));

  const attackerHero = getHeroByUid(state, attackerUid);
  if (attackerHero) {
    attackerHero.damageDealt += finalDmg;
    attackerHero.revealedTimer = Math.max(attackerHero.revealedTimer, 1.5);
    target.lastDamagedBy = { uid: attackerHero.uid, time: state.elapsedTime };
    target.assisters[attackerHero.uid] = state.elapsedTime;

    // Lifesteal
    const attStats = getHeroComputedStats(attackerHero, state);
    if (attStats.lifesteal > 0) {
      const healAmt = Math.round(finalDmg * attStats.lifesteal);
      attackerHero.hp = Math.min(attackerHero.maxHp, attackerHero.hp + healAmt);
    }

    // Turret Aggro Rule: if enemy hero damages allied hero inside allied turret range
    for (const turret of state.turrets) {
      if (turret.alive && turret.team === target.team && dist(turret, attackerHero) <= turret.range) {
        turret.targetUid = attackerHero.uid;
      }
    }
  }

  // Cancel recall on hero damage
  if (target.recallChannel > 0) {
    target.recallChannel = 0;
  }

  // Absorb via shield first
  let remaining = finalDmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp -= remaining;

  const color = damageType === 'true' ? '#f8fafc' : damageType === 'magic' ? '#38bdf8' : '#fb923c';
  addFloatingText(state, target.x, target.y, `-${finalDmg}`, color);

  // Bima passive emergency shield
  if (target.heroId === 'bima' && target.alive && target.hp > 0 && target.hp < target.maxHp * 0.38 && target.passiveBuffTimer <= 0) {
    target.shield += Math.round(target.maxHp * 0.16);
    target.shieldTimer = 4;
    target.passiveBuffTimer = 25;
    addEffect(state, 'shield', target.x, target.y, 44, '#f97316', 0.45);
  }

  if (target.hp <= 0) {
    target.hp = 0;
    handleHeroDeath(state, target, attackerHero);
  }
}

function applyDamageToMinion(
  state: MatchState,
  minion: MinionEntity,
  rawDamage: number,
  attackerUid?: string
) {
  if (minion.hp <= 0) return;
  const dmg = Math.max(8, Math.round(rawDamage));
  minion.hp -= dmg;

  const attackerHero = getHeroByUid(state, attackerUid);
  if (attackerHero) {
    attackerHero.damageDealt += dmg;
    attackerHero.revealedTimer = Math.max(attackerHero.revealedTimer, 1.2);
    addFloatingText(state, minion.x, minion.y, `-${dmg}`, '#e2e8f0');
  }

  if (minion.hp <= 0) {
    minion.hp = 0;
    if (attackerHero) {
      grantXpAndGold(state, attackerHero, minion.goldReward, minion.xpReward);
      addFloatingText(state, minion.x, minion.y - 16, `+${minion.goldReward}g`, '#fbbf24');
    } else {
      // Nearby allied heroes share proximity XP
      for (const h of state.heroes) {
        if (h.alive && h.team !== minion.team && dist(h, minion) < 360) {
          grantXpAndGold(state, h, Math.round(minion.goldReward * 0.35), Math.round(minion.xpReward * 0.75));
        }
      }
    }
  }
}

function applyDamageToTurret(
  state: MatchState,
  turret: TurretEntity,
  rawDamage: number,
  attackerUid?: string
) {
  if (!turret.alive) return;

  // Base Nexus protection: 65% reduction if all Tier 2 turrets are still up
  let multiplier = 1;
  if (turret.isNexus) {
    const tier2Alive = state.turrets.filter((t) => t.team === turret.team && t.tier === 2 && t.alive).length;
    if (tier2Alive >= 3) multiplier = 0.35;
  }

  // Backdoor protection if no enemy minions near turret
  const hasEnemyMinionNear = state.minions.some(
    (m) => m.team !== turret.team && m.hp > 0 && dist(m, turret) < turret.range + 40
  );
  if (!hasEnemyMinionNear) {
    multiplier *= 0.45;
  }

  const dmg = Math.max(8, Math.round(rawDamage * multiplier));
  turret.hp -= dmg;

  const attackerHero = getHeroByUid(state, attackerUid);
  if (attackerHero) {
    attackerHero.turretDamage += dmg;
    attackerHero.damageDealt += dmg;
    addFloatingText(state, turret.x, turret.y - 16, `-${dmg}`, '#fb923c');
  }

  if (turret.hp <= 0) {
    turret.hp = 0;
    turret.alive = false;
    addEffect(state, 'ring', turret.x, turret.y, 120, '#f59e0b', 0.65);

    const enemyTeam: Team = turret.team === 'blue' ? 'red' : 'blue';
    for (const h of state.heroes) {
      if (h.team === enemyTeam) {
        grantXpAndGold(state, h, turret.isNexus ? 400 : 180, 120);
      }
    }

    if (turret.isNexus) {
      state.winner = enemyTeam;
      soundFX.playKill(true);
    } else {
      state.killBanner = {
        id: nextUid('kb'),
        title: turret.team === 'red' ? 'TURRET MUSUH HANCUR!' : 'TURRET SEKUTU HANCUR!',
        subtitle: `Tim ${enemyTeam === 'blue' ? 'Biru' : 'Merah'} mendapatkan +180 Gold`,
        team: enemyTeam,
        timer: 2.8,
      };
    }
  }
}

function applyDamageToCreep(
  state: MatchState,
  creep: JungleCreepEntity,
  rawDamage: number,
  attackerUid?: string
) {
  if (!creep.alive) return;
  const dmg = Math.max(10, Math.round(rawDamage));
  creep.hp -= dmg;
  if (attackerUid) {
    creep.aggroTargetUid = attackerUid;
  }

  const attackerHero = getHeroByUid(state, attackerUid);
  if (attackerHero) {
    attackerHero.damageDealt += dmg;
    addFloatingText(state, creep.x, creep.y, `-${dmg}`, '#e2e8f0');
  }

  if (creep.hp <= 0) {
    creep.hp = 0;
    creep.alive = false;
    creep.respawnTimer = creep.kind === 'lord' ? 75 : 38;
    creep.aggroTargetUid = null;

    if (attackerHero) {
      if (creep.kind === 'lord') {
        if (attackerHero.team === 'blue') state.blueLordBuffTimer = 45;
        else state.redLordBuffTimer = 45;

        for (const h of state.heroes) {
          if (h.team === attackerHero.team) {
            grantXpAndGold(state, h, creep.goldReward, creep.xpReward);
          }
        }

        // Spawn Siege Lord minion in Mid lane
        const spawn = attackerHero.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
        state.minions.push({
          uid: nextUid('lordminion'),
          team: attackerHero.team,
          lane: 'mid',
          kind: 'siege',
          x: spawn.x + (attackerHero.team === 'blue' ? 140 : -140),
          y: spawn.y + (attackerHero.team === 'blue' ? -140 : 140),
          radius: 26,
          hp: 2600,
          maxHp: 2600,
          atk: 115,
          range: 120,
          speed: 125,
          attackCooldown: 0,
          waypointIdx: attackerHero.team === 'blue' ? 1 : LANE_WAYPOINTS_BLUE.mid.length - 2,
          goldReward: 120,
          xpReward: 120,
        });

        state.killBanner = {
          id: nextUid('kb'),
          title: 'DEWATA LORD DITAKLUKKAN!',
          subtitle: `${attackerHero.name} membawa berkah Serangan +20% & Lord Pengepung`,
          team: attackerHero.team,
          timer: 3.4,
        };
        soundFX.playKill(true);
      } else {
        grantXpAndGold(state, attackerHero, creep.goldReward, creep.xpReward);
        attackerHero.hp = Math.min(attackerHero.maxHp, attackerHero.hp + 180);
        addFloatingText(state, creep.x, creep.y - 16, `+${creep.goldReward}g`, '#fbbf24', true);
      }
    }
  }
}

export function performBasicAttack(
  state: MatchState,
  hero: HeroEntity,
  priority: TargetPriority = 'auto'
): boolean {
  if (!hero.alive || hero.stunTimer > 0 || hero.attackCooldown > 0) return false;

  const def = HERO_CATALOG[hero.heroId];
  const stats = getHeroComputedStats(hero, state);
  const searchRange = stats.attackRange + 55;
  const enemyTeam: Team = hero.team === 'blue' ? 'red' : 'blue';

  // Find target based on priority
  const enemyHeroes = state.heroes.filter(
    (h) => h.team === enemyTeam && h.alive && dist(h, hero) <= searchRange && isHeroVisibleToTeam(h, hero.team, state)
  );
  const enemyMinions = state.minions.filter(
    (m) => m.team === enemyTeam && m.hp > 0 && dist(m, hero) <= searchRange
  );
  const enemyCreeps = state.jungleCreeps.filter(
    (c) => c.alive && dist(c, hero) <= searchRange
  );
  const enemyTurrets = state.turrets.filter(
    (t) => t.team === enemyTeam && t.alive && dist(t, hero) <= searchRange + t.radius
  );

  let targetType: 'hero' | 'minion' | 'creep' | 'turret' | null = null;
  let targetHero: HeroEntity | undefined;
  let targetMinion: MinionEntity | undefined;
  let targetCreep: JungleCreepEntity | undefined;
  let targetTurret: TurretEntity | undefined;

  const pickLowestHero = () => [...enemyHeroes].sort((a, b) => a.hp - b.hp)[0];
  const pickLowestMinion = () => [...enemyMinions].sort((a, b) => a.hp - b.hp)[0];
  const pickNearestTurret = () => [...enemyTurrets].sort((a, b) => dist(a, hero) - dist(b, hero))[0];
  const pickNearestCreep = () => [...enemyCreeps].sort((a, b) => dist(a, hero) - dist(b, hero))[0];

  if (priority === 'turret' && enemyTurrets.length > 0) {
    targetType = 'turret';
    targetTurret = pickNearestTurret();
  } else if (priority === 'minion' && (enemyMinions.length > 0 || enemyCreeps.length > 0)) {
    if (enemyMinions.length > 0) {
      targetType = 'minion';
      targetMinion = pickLowestMinion();
    } else {
      targetType = 'creep';
      targetCreep = pickNearestCreep();
    }
  } else {
    // Auto priority: Enemy Hero > Minion > Creep > Turret
    if (enemyHeroes.length > 0) {
      targetType = 'hero';
      targetHero = pickLowestHero();
    } else if (enemyMinions.length > 0) {
      targetType = 'minion';
      targetMinion = pickLowestMinion();
    } else if (enemyCreeps.length > 0) {
      targetType = 'creep';
      targetCreep = pickNearestCreep();
    } else if (enemyTurrets.length > 0) {
      targetType = 'turret';
      targetTurret = pickNearestTurret();
    }
  }

  if (!targetType) {
    // Swing in place if player pressed attack manually
    if (hero.isPlayer) {
      hero.attackCooldown = stats.attackInterval * 0.7;
      addEffect(state, 'slash', hero.x + Math.cos(hero.facing) * 44, hero.y + Math.sin(hero.facing) * 44, 48, def.baseStats.projectileColor, 0.18, hero.facing);
      soundFX.playHit(def.baseStats.isRanged ? 'magic' : 'physical');
    }
    return false;
  }

  hero.attackCooldown = stats.attackInterval;
  hero.recallChannel = 0;
  hero.basicAttackCount += 1;
  hero.revealedTimer = Math.max(hero.revealedTimer, 1.5);

  // Determine crit & passive bonus
  let dmg = stats.atk;
  let isCrit = Math.random() < stats.critChance;
  let isTrueBonus = false;

  if (hero.heroId === 'bayu' && hero.passiveBuffTimer > 0) {
    hero.passiveBuffTimer = 0;
    isCrit = true;
    isTrueBonus = true;
  }
  if (isCrit) {
    dmg *= 1.65;
  }

  // Larasati passive stacks
  if (hero.heroId === 'larasati') {
    hero.passiveStacks = Math.min(5, hero.passiveStacks + 1);
    hero.passiveBuffTimer = 3.5;
  }

  // Raka 3rd strike passive
  let rakaCleaved = false;
  if (hero.heroId === 'raka' && hero.basicAttackCount % 3 === 0) {
    rakaCleaved = true;
    dmg *= 1.35;
    hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(dmg * 0.12));
    addEffect(state, 'ring', hero.x, hero.y, 125, '#fbbf24', 0.28);
  }

  const targetPos: Vec2 =
    targetHero || targetMinion || targetCreep || targetTurret || { x: hero.x, y: hero.y };
  hero.facing = Math.atan2(targetPos.y - hero.y, targetPos.x - hero.x);

  if (def.baseStats.isRanged) {
    const angle = hero.facing;
    const speed = 760;
    state.projectiles.push({
      uid: nextUid('proj'),
      team: hero.team,
      ownerUid: hero.uid,
      x: hero.x + Math.cos(angle) * 20,
      y: hero.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      targetUid: targetHero?.uid || targetMinion?.uid || targetCreep?.uid || targetTurret?.uid,
      maxDistance: stats.attackRange + 160,
      traveled: 0,
      radius: 8,
      damage: dmg,
      damageType: isTrueBonus ? 'true' : hero.heroId === 'nirmala' ? 'magic' : 'physical',
      color: def.baseStats.projectileColor,
    });
  } else {
    addEffect(state, 'slash', targetPos.x, targetPos.y, 52, def.baseStats.projectileColor, 0.2, hero.facing);
    if (targetHero) {
      applyDamageToHero(state, targetHero, dmg, isTrueBonus ? 'true' : 'physical', hero.uid);
    } else if (targetMinion) {
      applyDamageToMinion(state, targetMinion, dmg, hero.uid);
    } else if (targetCreep) {
      applyDamageToCreep(state, targetCreep, dmg, hero.uid);
    } else if (targetTurret) {
      applyDamageToTurret(state, targetTurret, dmg, hero.uid);
    }

    if (rakaCleaved) {
      for (const eh of state.heroes) {
        if (eh.team === enemyTeam && eh.alive && eh.uid !== targetHero?.uid && dist(eh, hero) <= 135) {
          applyDamageToHero(state, eh, dmg * 0.65, 'physical', hero.uid);
        }
      }
      for (const em of state.minions) {
        if (em.team === enemyTeam && em.hp > 0 && em.uid !== targetMinion?.uid && dist(em, hero) <= 135) {
          applyDamageToMinion(state, em, dmg * 0.65, hero.uid);
        }
      }
    }
  }

  if (hero.isPlayer) {
    soundFX.playHit(def.baseStats.isRanged ? 'magic' : 'physical');
  }
  return true;
}

export function castHeroSkill(
  state: MatchState,
  hero: HeroEntity,
  slotIndex: 0 | 1 | 2,
  explicitAngle?: number
): boolean {
  if (!hero.alive || hero.stunTimer > 0) return false;
  if (hero.skillLevels[slotIndex] <= 0) return false;
  if (hero.skillCooldowns[slotIndex] > 0) return false;

  const def = HERO_CATALOG[hero.heroId];
  const skill = def.skills[slotIndex];
  const skillLevel = hero.skillLevels[slotIndex];

  if (hero.mana < skill.manaCost) {
    if (hero.isPlayer) {
      addFloatingText(state, hero.x, hero.y - 24, 'Mana Habis!', '#38bdf8');
    }
    return false;
  }

  const stats = getHeroComputedStats(hero, state);
  hero.mana -= skill.manaCost;
  hero.skillCooldowns[slotIndex] = skill.cooldown * (1 - stats.cdr);
  hero.recallChannel = 0;
  hero.revealedTimer = Math.max(hero.revealedTimer, 1.8);

  if (hero.heroId === 'bayu') {
    hero.passiveBuffTimer = 4.0;
  }

  // Smart auto-aim towards nearest visible enemy hero if no explicitAngle
  const enemyTeam: Team = hero.team === 'blue' ? 'red' : 'blue';
  let aimAngle = explicitAngle ?? hero.facing;
  if (explicitAngle === undefined) {
    const aimSearch = Math.max(320, skill.range + 110);
    const nearestEnemyHero = state.heroes
      .filter((h) => h.team === enemyTeam && h.alive && dist(h, hero) <= aimSearch && isHeroVisibleToTeam(h, hero.team, state))
      .sort((a, b) => dist(a, hero) - dist(b, hero))[0];
    if (nearestEnemyHero) {
      aimAngle = Math.atan2(nearestEnemyHero.y - hero.y, nearestEnemyHero.x - hero.x);
    } else {
      const nearestMinion = state.minions
        .filter((m) => m.team === enemyTeam && m.hp > 0 && dist(m, hero) <= aimSearch)
        .sort((a, b) => dist(a, hero) - dist(b, hero))[0];
      if (nearestMinion) {
        aimAngle = Math.atan2(nearestMinion.y - hero.y, nearestMinion.x - hero.x);
      }
    }
  }
  hero.facing = aimAngle;

  const levelBonus = 1 + (skillLevel - 1) * 0.22;
  const skillDmg =
    (skill.damageBase * levelBonus) +
    stats.atk * skill.damageScaleAtk +
    stats.mag * skill.damageScaleMag;

  const hitArea = (
    cx: number,
    cy: number,
    rad: number,
    dmg: number,
    stunSec = 0,
    slowSec = 0,
    slowAmt = 0
  ) => {
    for (const eh of state.heroes) {
      if (eh.team === enemyTeam && eh.alive && dist(eh, { x: cx, y: cy }) <= rad + eh.radius) {
        applyDamageToHero(state, eh, dmg, skill.damageType, hero.uid);
        if (stunSec > 0) eh.stunTimer = Math.max(eh.stunTimer, stunSec);
        if (slowSec > 0) {
          eh.slowTimer = Math.max(eh.slowTimer, slowSec);
          eh.slowFactor = Math.max(eh.slowFactor, slowAmt);
        }
        // Nirmala 3-mark frost burst
        if (hero.heroId === 'nirmala') {
          eh.frostMarks += 1;
          if (eh.frostMarks >= 3) {
            eh.frostMarks = 0;
            eh.stunTimer = Math.max(eh.stunTimer, 0.85);
            applyDamageToHero(state, eh, 160 + stats.mag * 0.7, 'magic', hero.uid);
            addEffect(state, 'freeze', eh.x, eh.y, 75, '#60a5fa', 0.45);
          }
        }
      }
    }
    for (const em of state.minions) {
      if (em.team === enemyTeam && em.hp > 0 && dist(em, { x: cx, y: cy }) <= rad + em.radius) {
        applyDamageToMinion(state, em, dmg, hero.uid);
      }
    }
    for (const ec of state.jungleCreeps) {
      if (ec.alive && dist(ec, { x: cx, y: cy }) <= rad + ec.radius) {
        applyDamageToCreep(state, ec, dmg, hero.uid);
      }
    }
  };

  switch (skill.kind) {
    case 'dash_slash':
    case 'blink_strike':
    case 'shield_charge': {
      const dashDist = skill.range;
      const nx = clamp(hero.x + Math.cos(aimAngle) * dashDist, 65, MAP_SIZE - 65);
      const ny = clamp(hero.y + Math.sin(aimAngle) * dashDist, 65, MAP_SIZE - 65);
      addEffect(state, 'blink', hero.x, hero.y, 44, skill.color, 0.25);
      // Hit midpoint and destination
      const mx = (hero.x + nx) / 2;
      const my = (hero.y + ny) / 2;
      hero.x = nx;
      hero.y = ny;
      addEffect(state, 'slash', nx, ny, skill.radius, skill.color, 0.3, aimAngle);
      hitArea(mx, my, skill.radius * 0.85, skillDmg * 0.4, 0, 1.5, 0.3);
      hitArea(nx, ny, skill.radius, skillDmg, skill.kind === 'shield_charge' ? 1.1 : 0, 1.6, 0.3);
      break;
    }

    case 'slam_stun':
    case 'quake_ult': {
      addEffect(state, 'ring', hero.x, hero.y, skill.radius, skill.color, 0.45);
      hitArea(hero.x, hero.y, skill.radius, skillDmg, skill.kind === 'quake_ult' ? 1.5 : 0.9);
      break;
    }

    case 'leap_ult': {
      const tx = clamp(hero.x + Math.cos(aimAngle) * Math.min(skill.range, 230), 65, MAP_SIZE - 65);
      const ty = clamp(hero.y + Math.sin(aimAngle) * Math.min(skill.range, 230), 65, MAP_SIZE - 65);
      hero.x = tx;
      hero.y = ty;
      hero.shield += Math.round(280 + stats.maxHp * 0.14);
      hero.shieldTimer = 4;
      addEffect(state, 'meteor', tx, ty, skill.radius, skill.color, 0.55);
      hitArea(tx, ty, skill.radius, skillDmg, 1.1);
      break;
    }

    case 'cone_arrows':
    case 'kunai_fan': {
      const count = skill.kind === 'cone_arrows' ? 3 : 4;
      const spread = 0.26;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spread;
        const a = aimAngle + offset;
        state.projectiles.push({
          uid: nextUid('sproj'),
          team: hero.team,
          ownerUid: hero.uid,
          x: hero.x + Math.cos(a) * 20,
          y: hero.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 720,
          vy: Math.sin(a) * 720,
          speed: 720,
          maxDistance: skill.range,
          traveled: 0,
          radius: 14,
          damage: skillDmg * (count === 3 ? 0.65 : 0.52),
          damageType: skill.damageType,
          color: skill.color,
          pierce: true,
          hitUids: [],
          slowAmount: 0.28,
          slowDuration: 1.5,
          isSkill: true,
        });
      }
      break;
    }

    case 'dash_buff': {
      const backAngle = hero.isPlayer ? aimAngle : aimAngle + Math.PI;
      hero.x = clamp(hero.x + Math.cos(backAngle) * skill.range, 65, MAP_SIZE - 65);
      hero.y = clamp(hero.y + Math.sin(backAngle) * skill.range, 65, MAP_SIZE - 65);
      hero.speedBuffTimer = 2.4;
      hero.speedBuffFactor = 0.38;
      addEffect(state, 'blink', hero.x, hero.y, 46, skill.color, 0.3);
      hitArea(hero.x, hero.y, skill.radius, skillDmg, 0, 1.2, 0.25);
      break;
    }

    case 'snipe_ult':
    case 'ice_lance': {
      const speed = skill.kind === 'snipe_ult' ? 860 : 720;
      state.projectiles.push({
        uid: nextUid('sproj'),
        team: hero.team,
        ownerUid: hero.uid,
        x: hero.x + Math.cos(aimAngle) * 24,
        y: hero.y + Math.sin(aimAngle) * 24,
        vx: Math.cos(aimAngle) * speed,
        vy: Math.sin(aimAngle) * speed,
        speed,
        maxDistance: skill.range,
        traveled: 0,
        radius: 18,
        damage: skillDmg,
        damageType: skill.damageType,
        color: skill.color,
        explodeRadius: skill.radius,
        slowAmount: skill.kind === 'ice_lance' ? 0.4 : 0.3,
        slowDuration: 1.8,
        isSkill: true,
      });
      break;
    }

    case 'frost_nova':
    case 'meteor_ult': {
      const distOut = Math.min(skill.range, 230);
      const tx = clamp(hero.x + Math.cos(aimAngle) * distOut, 70, MAP_SIZE - 70);
      const ty = clamp(hero.y + Math.sin(aimAngle) * distOut, 70, MAP_SIZE - 70);
      addEffect(state, skill.kind === 'frost_nova' ? 'freeze' : 'meteor', tx, ty, skill.radius, skill.color, 0.55);
      hitArea(tx, ty, skill.radius, skillDmg, skill.kind === 'frost_nova' ? 1.2 : 0.4, 2.0, 0.35);
      break;
    }

    case 'shadow_dance': {
      hero.invulnerableTimer = 0.85;
      addEffect(state, 'ring', hero.x, hero.y, skill.radius, skill.color, 0.55);
      addEffect(state, 'slash', hero.x, hero.y, skill.radius * 0.9, '#f0abfc', 0.4, aimAngle);
      hitArea(hero.x, hero.y, skill.radius, skillDmg, 0, 1.5, 0.35);
      break;
    }

    case 'taunt_shield': {
      hero.shield += Math.round(320 + stats.maxHp * 0.16);
      hero.shieldTimer = 4.5;
      addEffect(state, 'shield', hero.x, hero.y, skill.radius, skill.color, 0.45);
      hitArea(hero.x, hero.y, skill.radius, skillDmg, 0, 2.2, 0.45);
      break;
    }
  }

  if (hero.isPlayer) {
    soundFX.playSkill(slotIndex === 2);
  }
  return true;
}

export function triggerBattleSpell(state: MatchState, hero: HeroEntity): boolean {
  if (!hero.alive || hero.spellCooldown > 0) return false;
  const spell = BATTLE_SPELLS[hero.battleSpell];
  if (!spell) return false;

  const enemyTeam: Team = hero.team === 'blue' ? 'red' : 'blue';

  if (hero.battleSpell === 'flicker') {
    addEffect(state, 'blink', hero.x, hero.y, 44, spell.color, 0.25);
    hero.x = clamp(hero.x + Math.cos(hero.facing) * 240, 65, MAP_SIZE - 65);
    hero.y = clamp(hero.y + Math.sin(hero.facing) * 240, 65, MAP_SIZE - 65);
    addEffect(state, 'blink', hero.x, hero.y, 50, spell.color, 0.3);
  } else if (hero.battleSpell === 'execute') {
    const target = state.heroes
      .filter((h) => h.team === enemyTeam && h.alive && dist(h, hero) <= 270 && isHeroVisibleToTeam(h, hero.team, state))
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) {
      if (hero.isPlayer) addFloatingText(state, hero.x, hero.y - 24, 'Tidak ada target dekat', '#ef4444');
      return false;
    }
    const missingHp = Math.max(0, target.maxHp - target.hp);
    const dmg = 240 + hero.level * 22 + missingHp * 0.24;
    addEffect(state, 'slash', target.x, target.y, 70, '#ef4444', 0.3, 0.7);
    applyDamageToHero(state, target, dmg, 'true', hero.uid);
  } else if (hero.battleSpell === 'heal') {
    for (const h of state.heroes) {
      if (h.team === hero.team && h.alive && dist(h, hero) <= 280) {
        const healAmt = Math.round(h.maxHp * 0.28);
        h.hp = Math.min(h.maxHp, h.hp + healAmt);
        h.speedBuffTimer = 2.0;
        h.speedBuffFactor = 0.25;
        addFloatingText(state, h.x, h.y - 16, `+${healAmt} HP`, '#10b981', true);
        addEffect(state, 'heal', h.x, h.y, 60, '#10b981', 0.45);
      }
    }
  } else if (hero.battleSpell === 'inspire') {
    hero.inspireTimer = 4.5;
    addEffect(state, 'ring', hero.x, hero.y, 56, '#f59e0b', 0.4);
  }

  hero.spellCooldown = spell.cooldown;
  hero.recallChannel = 0;
  if (hero.isPlayer) soundFX.playSkill(false);
  return true;
}

export function triggerRecall(state: MatchState, hero: HeroEntity) {
  if (!hero.alive || hero.stunTimer > 0) return;
  if (hero.recallChannel > 0) {
    hero.recallChannel = 0;
    return;
  }
  hero.recallChannel = 3.2;
  addEffect(state, 'ring', hero.x, hero.y, 44, '#38bdf8', 0.45);
}

export function upgradeHeroSkill(hero: HeroEntity, slotIndex: 0 | 1 | 2): boolean {
  if (hero.skillPoints <= 0) return false;
  const maxLvl = slotIndex === 2 ? 3 : 5;
  if (hero.skillLevels[slotIndex] >= maxLvl) return false;
  if (slotIndex === 2 && hero.level < 4) return false;

  hero.skillLevels[slotIndex] += 1;
  hero.skillPoints -= 1;
  if (hero.isPlayer) soundFX.playBuy();
  return true;
}

export function buyItemForHero(state: MatchState, hero: HeroEntity, itemId: string): boolean {
  const item = ITEM_MAP[itemId];
  if (!item) return false;
  if (hero.items.length >= 6) return false;
  if (hero.gold < item.cost) return false;

  hero.gold -= item.cost;
  hero.items.push(itemId);

  const stats = getHeroComputedStats(hero, state);
  const hpGain = Math.max(0, stats.maxHp - hero.maxHp);
  hero.maxHp = stats.maxHp;
  hero.hp = Math.min(hero.maxHp, hero.hp + hpGain);

  if (hero.isPlayer) {
    soundFX.playBuy();
    addFloatingText(state, hero.x, hero.y - 24, `Beli ${item.name}`, '#fbbf24', true);
  }
  return true;
}

export function sellItemForHero(state: MatchState, hero: HeroEntity, slotIdx: number): boolean {
  if (slotIdx < 0 || slotIdx >= hero.items.length) return false;
  const itemId = hero.items[slotIdx];
  const item = ITEM_MAP[itemId];
  hero.items.splice(slotIdx, 1);
  if (item) {
    hero.gold += Math.round(item.cost * 0.65);
  }
  const stats = getHeroComputedStats(hero, state);
  hero.maxHp = stats.maxHp;
  hero.hp = Math.min(hero.maxHp, hero.hp);
  return true;
}

function spawnMinionWave(state: MatchState) {
  state.waveNumber += 1;
  const lanes: LaneId[] = ['top', 'mid', 'bot'];
  const hpScale = 1 + (state.waveNumber - 1) * 0.08;
  const atkScale = 1 + (state.waveNumber - 1) * 0.06;

  for (const lane of lanes) {
    for (const team of ['blue', 'red'] as Team[]) {
      const wps = LANE_WAYPOINTS_BLUE[lane];
      const spawnPt = team === 'blue' ? wps[0] : wps[wps.length - 1];
      const startIdx = team === 'blue' ? 1 : wps.length - 2;

      // 2 melee + 1 ranged (+ 1 siege every 3rd wave)
      const kinds: Array<'melee' | 'ranged' | 'siege'> =
        state.waveNumber % 3 === 0 ? ['melee', 'melee', 'ranged', 'siege'] : ['melee', 'melee', 'ranged'];

      kinds.forEach((kind, idx) => {
        const offsetAngle = (idx - 1) * 0.35;
        const offsetDist = 28 + idx * 14;
        const baseHp = kind === 'siege' ? 760 : kind === 'melee' ? 420 : 280;
        const baseAtk = kind === 'siege' ? 46 : kind === 'melee' ? 26 : 34;

        state.minions.push({
          uid: nextUid('min'),
          team,
          lane,
          kind,
          x: clamp(spawnPt.x + Math.cos(offsetAngle) * offsetDist, 60, MAP_SIZE - 60),
          y: clamp(spawnPt.y + Math.sin(offsetAngle) * offsetDist, 60, MAP_SIZE - 60),
          radius: kind === 'siege' ? 18 : 13,
          hp: Math.round(baseHp * hpScale),
          maxHp: Math.round(baseHp * hpScale),
          atk: Math.round(baseAtk * atkScale),
          range: kind === 'ranged' ? 190 : 62,
          speed: 118,
          attackCooldown: 0,
          waypointIdx: startIdx,
          goldReward: kind === 'siege' ? 58 : kind === 'melee' ? 32 : 28,
          xpReward: kind === 'siege' ? 62 : 38,
        });
      });
    }
  }
}

function updateHeroAI(state: MatchState, hero: HeroEntity, dt: number) {
  if (!hero.alive || hero.stunTimer > 0 || hero.recallChannel > 0) return;

  const stats = getHeroComputedStats(hero, state);
  const enemyTeam: Team = hero.team === 'blue' ? 'red' : 'blue';
  const ownSpawn = hero.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;

  // Auto-upgrade skills
  if (hero.skillPoints > 0) {
    if (hero.level >= 4 && hero.skillLevels[2] < 3) upgradeHeroSkill(hero, 2);
    else if (hero.skillLevels[0] <= hero.skillLevels[1]) upgradeHeroSkill(hero, 0);
    else upgradeHeroSkill(hero, 1);
  }

  // Auto-buy recommended items
  const build = RECOMMENDED_BUILDS[hero.heroId];
  if (hero.items.length < build.length) {
    const nextItemId = build[hero.items.length];
    const nextItem = ITEM_MAP[nextItemId];
    if (nextItem && hero.gold >= nextItem.cost) {
      buyItemForHero(state, hero, nextItemId);
    }
  }

  // Check turret danger: are we inside enemy turret range without allied minions?
  const dangerousTurret = state.turrets.find(
    (t) =>
      t.team === enemyTeam &&
      t.alive &&
      dist(t, hero) <= t.range + 25 &&
      !state.minions.some((m) => m.team === hero.team && m.hp > 0 && dist(m, t) <= t.range)
  );

  // Heal in fountain if low
  const distSpawn = dist(hero, ownSpawn);
  if (distSpawn < 240 && hero.hp < hero.maxHp * 0.85) {
    return; // wait to heal
  }

  // Retreat if HP low or under dangerous turret
  const retreatThreshold = state.difficulty === 'legenda' ? 0.28 : 0.22;
  if (hero.hp < hero.maxHp * retreatThreshold || dangerousTurret) {
    if (hero.hp < hero.maxHp * 0.3 && hero.battleSpell === 'heal' && hero.spellCooldown <= 0) {
      triggerBattleSpell(state, hero);
    }
    const angle = Math.atan2(ownSpawn.y - hero.y, ownSpawn.x - hero.x);
    hero.facing = angle;
    hero.x = clamp(hero.x + Math.cos(angle) * stats.moveSpeed * dt, 60, MAP_SIZE - 60);
    hero.y = clamp(hero.y + Math.sin(angle) * stats.moveSpeed * dt, 60, MAP_SIZE - 60);

    // Recall if safe distance from enemies
    const nearbyEnemy = state.heroes.some(
      (eh) => eh.team === enemyTeam && eh.alive && dist(eh, hero) < 420
    );
    if (!nearbyEnemy && hero.hp < hero.maxHp * 0.28 && distSpawn > 750) {
      triggerRecall(state, hero);
    }
    return;
  }

  // Look for nearby visible enemy hero
  const aggroRange = state.difficulty === 'mudah' ? 340 : state.difficulty === 'normal' ? 420 : 480;
  const targetEnemy = state.heroes
    .filter((eh) => eh.team === enemyTeam && eh.alive && dist(eh, hero) <= aggroRange && isHeroVisibleToTeam(eh, hero.team, state))
    .sort((a, b) => a.hp - b.hp)[0];

  const nearbyMinion = state.minions
    .filter((m) => m.team === enemyTeam && m.hp > 0 && dist(m, hero) <= 360)
    .sort((a, b) => a.hp - b.hp)[0];

  const nearbyTurret = state.turrets
    .filter(
      (t) =>
        t.team === enemyTeam &&
        t.alive &&
        dist(t, hero) <= 380 &&
        state.minions.some((m) => m.team === hero.team && m.hp > 0 && dist(m, t) <= t.range)
    )
    .sort((a, b) => dist(a, hero) - dist(b, hero))[0];

  const combatTarget = targetEnemy || nearbyTurret || nearbyMinion;

  if (combatTarget) {
    const d = dist(hero, combatTarget);
    const desiredRange = stats.attackRange * 0.92;
    const angle = Math.atan2(combatTarget.y - hero.y, combatTarget.x - hero.x);
    hero.facing = angle;

    // Cast skills against enemy heroes
    if (targetEnemy) {
      if (hero.skillLevels[2] > 0 && hero.skillCooldowns[2] <= 0 && d <= 260 && (targetEnemy.hp < targetEnemy.maxHp * 0.75 || state.difficulty !== 'mudah')) {
        castHeroSkill(state, hero, 2, angle);
      } else if (hero.skillLevels[0] > 0 && hero.skillCooldowns[0] <= 0 && d <= 280) {
        castHeroSkill(state, hero, 0, angle);
      } else if (hero.skillLevels[1] > 0 && hero.skillCooldowns[1] <= 0 && d <= 240) {
        castHeroSkill(state, hero, 1, angle);
      }

      if (hero.battleSpell === 'execute' && hero.spellCooldown <= 0 && targetEnemy.hp < targetEnemy.maxHp * 0.3 && d < 250) {
        triggerBattleSpell(state, hero);
      }
      if (hero.battleSpell === 'inspire' && hero.spellCooldown <= 0 && d <= stats.attackRange + 20) {
        triggerBattleSpell(state, hero);
      }
    } else if (nearbyMinion && hero.skillCooldowns[0] <= 0 && hero.mana > hero.maxMana * 0.65) {
      castHeroSkill(state, hero, 0, angle);
    }

    if (d > desiredRange) {
      hero.x = clamp(hero.x + Math.cos(angle) * stats.moveSpeed * dt, 60, MAP_SIZE - 60);
      hero.y = clamp(hero.y + Math.sin(angle) * stats.moveSpeed * dt, 60, MAP_SIZE - 60);
    } else if (HERO_CATALOG[hero.heroId].baseStats.isRanged && d < desiredRange * 0.58 && targetEnemy) {
      // Kiting back slightly for Marksman / Mage
      hero.x = clamp(hero.x - Math.cos(angle) * stats.moveSpeed * 0.65 * dt, 60, MAP_SIZE - 60);
      hero.y = clamp(hero.y - Math.sin(angle) * stats.moveSpeed * 0.65 * dt, 60, MAP_SIZE - 60);
    }

    performBasicAttack(state, hero, nearbyTurret ? 'turret' : 'auto');
    return;
  }

  // Advance along assigned lane waypoints
  const wps = LANE_WAYPOINTS_BLUE[hero.lane];
  const wp = wps[clamp(hero.aiWaypointIdx, 0, wps.length - 1)];
  const dWp = dist(hero, wp);
  if (dWp < 95) {
    if (hero.team === 'blue' && hero.aiWaypointIdx < wps.length - 1) {
      hero.aiWaypointIdx += 1;
    } else if (hero.team === 'red' && hero.aiWaypointIdx > 0) {
      hero.aiWaypointIdx -= 1;
    }
  } else {
    const angle = Math.atan2(wp.y - hero.y, wp.x - hero.x);
    hero.facing = angle;
    hero.x = clamp(hero.x + Math.cos(angle) * stats.moveSpeed * dt, 60, MAP_SIZE - 60);
    hero.y = clamp(hero.y + Math.sin(angle) * stats.moveSpeed * dt, 60, MAP_SIZE - 60);
  }
}

export function stepMatch(
  state: MatchState,
  dt: number,
  playerMoveInput: Vec2
): void {
  if (state.winner) return;

  const clampedDt = Math.min(dt, 0.05);
  state.elapsedTime += clampedDt;

  // Passive gold income
  state.passiveGoldTimer -= clampedDt;
  if (state.passiveGoldTimer <= 0) {
    state.passiveGoldTimer = 1.0;
    for (const h of state.heroes) {
      h.gold += 6;
      h.goldEarned += 6;
    }
  }

  // Minion wave timer
  state.waveTimer -= clampedDt;
  if (state.waveTimer <= 0) {
    state.waveTimer = 17.0;
    spawnMinionWave(state);
  }

  if (state.blueLordBuffTimer > 0) state.blueLordBuffTimer = Math.max(0, state.blueLordBuffTimer - clampedDt);
  if (state.redLordBuffTimer > 0) state.redLordBuffTimer = Math.max(0, state.redLordBuffTimer - clampedDt);
  if (state.killBanner) {
    state.killBanner.timer -= clampedDt;
    if (state.killBanner.timer <= 0) state.killBanner = null;
  }

  // Update Heroes
  for (const hero of state.heroes) {
    if (!hero.alive) {
      hero.respawnTimer -= clampedDt;
      if (hero.respawnTimer <= 0) {
        const spawn = hero.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
        hero.alive = true;
        hero.x = spawn.x + (Math.random() - 0.5) * 60;
        hero.y = spawn.y + (Math.random() - 0.5) * 60;
        const stats = getHeroComputedStats(hero, state);
        hero.maxHp = stats.maxHp;
        hero.maxMana = stats.maxMana;
        hero.hp = stats.maxHp;
        hero.mana = stats.maxMana;
        hero.aiWaypointIdx = hero.team === 'blue' ? 1 : LANE_WAYPOINTS_BLUE[hero.lane].length - 2;
      }
      continue;
    }

    // Timers
    for (let i = 0; i < 3; i++) {
      if (hero.skillCooldowns[i] > 0) hero.skillCooldowns[i] = Math.max(0, hero.skillCooldowns[i] - clampedDt);
    }
    if (hero.spellCooldown > 0) hero.spellCooldown = Math.max(0, hero.spellCooldown - clampedDt);
    if (hero.attackCooldown > 0) hero.attackCooldown = Math.max(0, hero.attackCooldown - clampedDt);
    if (hero.stunTimer > 0) hero.stunTimer = Math.max(0, hero.stunTimer - clampedDt);
    if (hero.slowTimer > 0) hero.slowTimer = Math.max(0, hero.slowTimer - clampedDt);
    if (hero.speedBuffTimer > 0) hero.speedBuffTimer = Math.max(0, hero.speedBuffTimer - clampedDt);
    if (hero.inspireTimer > 0) hero.inspireTimer = Math.max(0, hero.inspireTimer - clampedDt);
    if (hero.invulnerableTimer > 0) hero.invulnerableTimer = Math.max(0, hero.invulnerableTimer - clampedDt);
    if (hero.revealedTimer > 0) hero.revealedTimer = Math.max(0, hero.revealedTimer - clampedDt);
    if (hero.multiKillWindow > 0) {
      hero.multiKillWindow -= clampedDt;
      if (hero.multiKillWindow <= 0) hero.multiKillCount = 0;
    }
    if (hero.passiveBuffTimer > 0) {
      hero.passiveBuffTimer -= clampedDt;
      if (hero.passiveBuffTimer <= 0 && hero.heroId === 'larasati') {
        hero.passiveStacks = 0;
      }
    }
    if (hero.shieldTimer > 0) {
      hero.shieldTimer -= clampedDt;
      if (hero.shieldTimer <= 0) hero.shield = 0;
    }

    // Natural regen + Bima passive regen
    const stats = getHeroComputedStats(hero, state);
    hero.maxHp = stats.maxHp;
    hero.maxMana = stats.maxMana;
    const baseHpRegen = hero.heroId === 'bima' ? 18 : 7;
    hero.hp = Math.min(hero.maxHp, hero.hp + baseHpRegen * clampedDt);
    hero.mana = Math.min(hero.maxMana, hero.mana + 11 * clampedDt);

    // Fountain fast heal
    const ownSpawn = hero.team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
    if (dist(hero, ownSpawn) < 250) {
      hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.16 * clampedDt);
      hero.mana = Math.min(hero.maxMana, hero.mana + hero.maxMana * 0.2 * clampedDt);
    }

    // Recall channel
    if (hero.recallChannel > 0) {
      hero.recallChannel -= clampedDt;
      if (hero.recallChannel <= 0) {
        hero.recallChannel = 0;
        addEffect(state, 'blink', hero.x, hero.y, 48, '#38bdf8', 0.3);
        hero.x = ownSpawn.x;
        hero.y = ownSpawn.y;
        addEffect(state, 'ring', hero.x, hero.y, 60, '#38bdf8', 0.4);
      }
    }

    // Bush check
    hero.inBush = state.bushes.some((b) => {
      const dx = hero.x - b.x;
      const dy = hero.y - b.y;
      const cos = Math.cos(-b.rotation);
      const sin = Math.sin(-b.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      return (lx * lx) / (b.rx * b.rx) + (ly * ly) / (b.ry * b.ry) <= 1;
    });

    // Movement
    if (hero.isPlayer) {
      const mag = Math.hypot(playerMoveInput.x, playerMoveInput.y);
      if (mag > 0.08 && hero.stunTimer <= 0) {
        hero.recallChannel = 0;
        const nx = playerMoveInput.x / mag;
        const ny = playerMoveInput.y / mag;
        const speedMult = Math.min(1, mag);
        hero.facing = Math.atan2(ny, nx);
        hero.x = clamp(hero.x + nx * stats.moveSpeed * speedMult * clampedDt, 60, MAP_SIZE - 60);
        hero.y = clamp(hero.y + ny * stats.moveSpeed * speedMult * clampedDt, 60, MAP_SIZE - 60);
      }
    } else {
      updateHeroAI(state, hero, clampedDt);
    }
  }

  // Update Minions
  for (const m of state.minions) {
    if (m.hp <= 0) continue;
    if (m.attackCooldown > 0) m.attackCooldown = Math.max(0, m.attackCooldown - clampedDt);

    const enemyTeam: Team = m.team === 'blue' ? 'red' : 'blue';
    const targetMinion = state.minions
      .filter((em) => em.team === enemyTeam && em.hp > 0 && dist(em, m) <= 230)
      .sort((a, b) => dist(a, m) - dist(b, m))[0];

    const targetTurret = !targetMinion
      ? state.turrets
          .filter((t) => t.team === enemyTeam && t.alive && dist(t, m) <= 250)
          .sort((a, b) => dist(a, m) - dist(b, m))[0]
      : undefined;

    const targetHero = !targetMinion && !targetTurret
      ? state.heroes
          .filter((eh) => eh.team === enemyTeam && eh.alive && dist(eh, m) <= 200 && isHeroVisibleToTeam(eh, m.team, state))
          .sort((a, b) => dist(a, m) - dist(b, m))[0]
      : undefined;

    const target = targetMinion || targetTurret || targetHero;
    if (target) {
      const d = dist(m, target);
      const effectiveRange = m.range + (targetTurret ? targetTurret.radius : 12);
      if (d > effectiveRange) {
        const a = Math.atan2(target.y - m.y, target.x - m.x);
        m.x += Math.cos(a) * m.speed * clampedDt;
        m.y += Math.sin(a) * m.speed * clampedDt;
      } else if (m.attackCooldown <= 0) {
        m.attackCooldown = 1.05;
        if (m.kind === 'ranged') {
          const a = Math.atan2(target.y - m.y, target.x - m.x);
          state.projectiles.push({
            uid: nextUid('mproj'),
            team: m.team,
            ownerUid: m.uid,
            x: m.x,
            y: m.y,
            vx: Math.cos(a) * 460,
            vy: Math.sin(a) * 460,
            speed: 460,
            targetUid: target.uid,
            maxDistance: 320,
            traveled: 0,
            radius: 5,
            damage: m.atk,
            damageType: 'physical',
            color: m.team === 'blue' ? '#60a5fa' : '#f87171',
          });
        } else if (targetMinion) {
          applyDamageToMinion(state, targetMinion, m.atk);
        } else if (targetTurret) {
          applyDamageToTurret(state, targetTurret, m.atk);
        } else if (targetHero) {
          applyDamageToHero(state, targetHero, m.atk, 'physical');
        }
      }
    } else {
      const wps = LANE_WAYPOINTS_BLUE[m.lane];
      const wp = wps[clamp(m.waypointIdx, 0, wps.length - 1)];
      if (dist(m, wp) < 42) {
        if (m.team === 'blue' && m.waypointIdx < wps.length - 1) m.waypointIdx += 1;
        else if (m.team === 'red' && m.waypointIdx > 0) m.waypointIdx -= 1;
      } else {
        const a = Math.atan2(wp.y - m.y, wp.x - m.x);
        m.x += Math.cos(a) * m.speed * clampedDt;
        m.y += Math.sin(a) * m.speed * clampedDt;
      }
    }
  }
  state.minions = state.minions.filter((m) => m.hp > 0);

  // Update Turrets
  for (const t of state.turrets) {
    if (!t.alive) continue;
    if (t.attackCooldown > 0) t.attackCooldown = Math.max(0, t.attackCooldown - clampedDt);

    const enemyTeam: Team = t.team === 'blue' ? 'red' : 'blue';
    // Verify current target still valid
    let currentHeroTarget = state.heroes.find(
      (h) => h.uid === t.targetUid && h.alive && h.team === enemyTeam && dist(h, t) <= t.range
    );
    let currentMinionTarget = !currentHeroTarget
      ? state.minions.find((m) => m.uid === t.targetUid && m.hp > 0 && m.team === enemyTeam && dist(m, t) <= t.range)
      : undefined;

    if (!currentHeroTarget && !currentMinionTarget) {
      t.targetUid = null;
      // Pick closest enemy minion first, then enemy hero
      const nearMinion = state.minions
        .filter((m) => m.team === enemyTeam && m.hp > 0 && dist(m, t) <= t.range)
        .sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (nearMinion) {
        t.targetUid = nearMinion.uid;
        currentMinionTarget = nearMinion;
      } else {
        const nearHero = state.heroes
          .filter((h) => h.team === enemyTeam && h.alive && dist(h, t) <= t.range && isHeroVisibleToTeam(h, t.team, state))
          .sort((a, b) => dist(a, t) - dist(b, t))[0];
        if (nearHero) {
          t.targetUid = nearHero.uid;
          currentHeroTarget = nearHero;
        }
      }
    }

    const activeTarget = currentHeroTarget || currentMinionTarget;
    if (activeTarget && t.attackCooldown <= 0) {
      t.attackCooldown = 1.15;
      const a = Math.atan2(activeTarget.y - t.y, activeTarget.x - t.x);
      state.projectiles.push({
        uid: nextUid('tproj'),
        team: t.team,
        ownerUid: t.uid,
        x: t.x,
        y: t.y,
        vx: Math.cos(a) * 620,
        vy: Math.sin(a) * 620,
        speed: 620,
        targetUid: activeTarget.uid,
        maxDistance: t.range + 90,
        traveled: 0,
        radius: 10,
        damage: t.atk,
        damageType: 'physical',
        color: t.team === 'blue' ? '#38bdf8' : '#ef4444',
        fromTurret: true,
      });
    }
  }

  // Update Jungle Creeps
  for (const c of state.jungleCreeps) {
    if (!c.alive) {
      c.respawnTimer -= clampedDt;
      if (c.respawnTimer <= 0) {
        c.alive = true;
        c.hp = c.maxHp;
        c.x = c.homeX;
        c.y = c.homeY;
        c.aggroTargetUid = null;
      }
      continue;
    }

    if (c.attackCooldown > 0) c.attackCooldown = Math.max(0, c.attackCooldown - clampedDt);
    const aggroHero = getHeroByUid(state, c.aggroTargetUid);
    if (!aggroHero || !aggroHero.alive || dist(aggroHero, { x: c.homeX, y: c.homeY }) > 360) {
      c.aggroTargetUid = null;
      // Return home & regen
      const dHome = dist(c, { x: c.homeX, y: c.homeY });
      if (dHome > 12) {
        const a = Math.atan2(c.homeY - c.y, c.homeX - c.x);
        c.x += Math.cos(a) * 140 * clampedDt;
        c.y += Math.sin(a) * 140 * clampedDt;
      } else {
        c.hp = Math.min(c.maxHp, c.hp + 95 * clampedDt);
      }
    } else {
      const d = dist(c, aggroHero);
      if (d > c.range) {
        const a = Math.atan2(aggroHero.y - c.y, aggroHero.x - c.x);
        c.x += Math.cos(a) * 135 * clampedDt;
        c.y += Math.sin(a) * 135 * clampedDt;
      } else if (c.attackCooldown <= 0) {
        c.attackCooldown = 1.25;
        applyDamageToHero(state, aggroHero, c.atk, 'physical');
        addEffect(state, 'hit', aggroHero.x, aggroHero.y, 28, '#f59e0b', 0.18);
      }
    }
  }

  // Update Projectiles
  const survivingProj = [];
  for (const p of state.projectiles) {
    let hitDone = false;

    // Homing projectile tracking
    if (p.targetUid) {
      const tHero = state.heroes.find((h) => h.uid === p.targetUid && h.alive);
      const tMin = !tHero ? state.minions.find((m) => m.uid === p.targetUid && m.hp > 0) : undefined;
      const tTurret = !tHero && !tMin ? state.turrets.find((t) => t.uid === p.targetUid && t.alive) : undefined;
      const tCreep = !tHero && !tMin && !tTurret ? state.jungleCreeps.find((c) => c.uid === p.targetUid && c.alive) : undefined;
      const targetObj = tHero || tMin || tTurret || tCreep;

      if (targetObj) {
        const a = Math.atan2(targetObj.y - p.y, targetObj.x - p.x);
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
      }
    }

    const stepX = p.vx * clampedDt;
    const stepY = p.vy * clampedDt;
    p.x += stepX;
    p.y += stepY;
    p.traveled += Math.hypot(stepX, stepY);

    const enemyTeam: Team = p.team === 'blue' ? 'red' : 'blue';

    // Check collisions
    for (const h of state.heroes) {
      if (h.team === enemyTeam && h.alive && dist(h, p) <= h.radius + p.radius) {
        if (p.targetUid && p.targetUid !== h.uid) continue;
        if (p.hitUids?.includes(h.uid)) continue;
        if (p.pierce) {
          p.hitUids?.push(h.uid);
          applyDamageToHero(state, h, p.damage, p.damageType, p.ownerUid);
          if (p.slowDuration && p.slowAmount) {
            h.slowTimer = Math.max(h.slowTimer, p.slowDuration);
            h.slowFactor = Math.max(h.slowFactor, p.slowAmount);
          }
        } else {
          if (p.explodeRadius) {
            addEffect(state, 'ring', p.x, p.y, p.explodeRadius, p.color, 0.35);
            for (const eh of state.heroes) {
              if (eh.team === enemyTeam && eh.alive && dist(eh, p) <= p.explodeRadius) {
                applyDamageToHero(state, eh, p.damage, p.damageType, p.ownerUid);
                if (p.slowDuration && p.slowAmount) {
                  eh.slowTimer = Math.max(eh.slowTimer, p.slowDuration);
                  eh.slowFactor = Math.max(eh.slowFactor, p.slowAmount);
                }
              }
            }
          } else {
            applyDamageToHero(state, h, p.damage, p.damageType, p.ownerUid);
            addEffect(state, 'hit', p.x, p.y, 24, p.color, 0.16);
          }
          hitDone = true;
          break;
        }
      }
    }

    if (!hitDone && (!p.targetUid || p.targetUid.startsWith('min'))) {
      for (const m of state.minions) {
        if (m.team === enemyTeam && m.hp > 0 && dist(m, p) <= m.radius + p.radius) {
          if (p.targetUid && p.targetUid !== m.uid) continue;
          if (p.hitUids?.includes(m.uid)) continue;
          if (p.pierce) {
            p.hitUids?.push(m.uid);
            applyDamageToMinion(state, m, p.damage, p.ownerUid);
          } else {
            applyDamageToMinion(state, m, p.damage, p.ownerUid);
            hitDone = true;
            break;
          }
        }
      }
    }

    if (!hitDone && !p.fromTurret) {
      for (const c of state.jungleCreeps) {
        if (c.alive && dist(c, p) <= c.radius + p.radius) {
          if (p.targetUid && p.targetUid !== c.uid) continue;
          if (p.hitUids?.includes(c.uid)) continue;
          if (p.pierce) {
            p.hitUids?.push(c.uid);
            applyDamageToCreep(state, c, p.damage, p.ownerUid);
          } else {
            applyDamageToCreep(state, c, p.damage, p.ownerUid);
            hitDone = true;
            break;
          }
        }
      }
    }

    if (!hitDone && !p.isSkill && !p.fromTurret) {
      for (const t of state.turrets) {
        if (t.team === enemyTeam && t.alive && dist(t, p) <= t.radius + p.radius) {
          if (p.targetUid && p.targetUid !== t.uid) continue;
          applyDamageToTurret(state, t, p.damage, p.ownerUid);
          addEffect(state, 'hit', p.x, p.y, 26, p.color, 0.18);
          hitDone = true;
          break;
        }
      }
    }

    if (!hitDone && p.traveled < p.maxDistance) {
      survivingProj.push(p);
    }
  }
  state.projectiles = survivingProj;

  // Update Effects & Floating Text
  for (const fx of state.effects) fx.timer -= clampedDt;
  state.effects = state.effects.filter((fx) => fx.timer > 0);

  for (const ft of state.floatingTexts) {
    ft.timer -= clampedDt;
    ft.y -= 28 * clampedDt;
  }
  state.floatingTexts = state.floatingTexts.filter((ft) => ft.timer > 0);

  // Smooth Camera follow player (or peek position)
  const player = state.heroes.find((h) => h.isPlayer);
  if (player) {
    const targetCamX = state.camera.peekX ?? player.x;
    const targetCamY = state.camera.peekY ?? player.y;
    const lerp = Math.min(1, clampedDt * 9);
    state.camera.x += (targetCamX - state.camera.x) * lerp;
    state.camera.y += (targetCamY - state.camera.y) * lerp;
  }
}

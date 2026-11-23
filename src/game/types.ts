export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Team = 'blue' | 'red';

export type HeroRole = 'Fighter' | 'Marksman' | 'Mage' | 'Assassin' | 'Tank';

export type HeroId = 'raka' | 'larasati' | 'nirmala' | 'bayu' | 'bima';

export type BattleSpellId = 'flicker' | 'execute' | 'heal' | 'inspire';

export type MatchMode = '3v3' | '5v5';

export type Difficulty = 'mudah' | 'normal' | 'legenda';

export type LaneId = 'top' | 'mid' | 'bot';

export type TargetPriority = 'auto' | 'minion' | 'turret';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SkillDefinition {
  id: string;
  slot: 1 | 2 | 3;
  name: string;
  keyHint: string;
  cooldown: number;
  manaCost: number;
  range: number;
  radius: number;
  damageBase: number;
  damageScaleAtk: number;
  damageScaleMag: number;
  damageType: 'physical' | 'magic' | 'true';
  kind: 'dash_slash' | 'slam_stun' | 'leap_ult' | 'cone_arrows' | 'dash_buff' | 'snipe_ult' | 'ice_lance' | 'frost_nova' | 'meteor_ult' | 'blink_strike' | 'kunai_fan' | 'shadow_dance' | 'shield_charge' | 'taunt_shield' | 'quake_ult';
  description: string;
  color: string;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  title: string;
  role: HeroRole;
  portraitUrl: string;
  accentColor: string;
  difficultyRating: 1 | 2 | 3;
  ratings: {
    durability: number;
    offense: number;
    ability: number;
    mobility: number;
  };
  baseStats: {
    maxHp: number;
    hpPerLevel: number;
    maxMana: number;
    manaPerLevel: number;
    atk: number;
    atkPerLevel: number;
    mag: number;
    armor: number;
    armorPerLevel: number;
    moveSpeed: number;
    attackRange: number;
    attackInterval: number;
    isRanged: boolean;
    projectileColor: string;
  };
  passiveName: string;
  passiveDesc: string;
  skills: [SkillDefinition, SkillDefinition, SkillDefinition];
}

export interface BattleSpellDefinition {
  id: BattleSpellId;
  name: string;
  cooldown: number;
  description: string;
  color: string;
}

export type ItemCategory = 'Fisik' | 'Sihir' | 'Pertahanan' | 'Sepatu';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  cost: number;
  color: string;
  shortStat: string;
  description: string;
  stats: {
    atk?: number;
    mag?: number;
    hp?: number;
    armor?: number;
    atkSpeed?: number; // percentage e.g. 0.25 = +25%
    moveSpeed?: number;
    cdr?: number; // e.g. 0.1 = 10%
    lifesteal?: number; // e.g. 0.12 = 12%
    critChance?: number; // e.g. 0.2 = 20%
  };
}

export interface HeroEntity {
  uid: string;
  heroId: HeroId;
  name: string;
  role: HeroRole;
  team: Team;
  isPlayer: boolean;
  lane: LaneId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // radians
  radius: number;

  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  skillLevels: [number, number, number]; // [s1, s2, ult]

  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  shield: number;
  shieldTimer: number;

  gold: number;
  items: string[];
  battleSpell: BattleSpellId;
  spellCooldown: number;

  skillCooldowns: [number, number, number];
  attackCooldown: number;
  basicAttackCount: number; // for passives
  passiveBuffTimer: number;
  passiveStacks: number;
  frostMarks: number;

  stunTimer: number;
  slowTimer: number;
  slowFactor: number;
  speedBuffTimer: number;
  speedBuffFactor: number;
  inspireTimer: number;
  invulnerableTimer: number;

  recallChannel: number; // > 0 when recalling (counts down from 3.5)
  inBush: boolean;
  revealedTimer: number; // visible to enemy even in bush when attacking

  alive: boolean;
  respawnTimer: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  turretDamage: number;
  goldEarned: number;
  killStreak: number;
  multiKillCount: number;
  multiKillWindow: number;
  lastDamagedBy?: { uid: string; time: number };
  assisters: Record<string, number>;

  // AI state
  aiState: 'advance' | 'retreat' | 'engage' | 'jungle' | 'recall';
  aiWaypointIdx: number;
  aiDecisionTimer: number;
}

export interface MinionEntity {
  uid: string;
  team: Team;
  lane: LaneId;
  kind: 'melee' | 'ranged' | 'siege';
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  speed: number;
  attackCooldown: number;
  waypointIdx: number;
  goldReward: number;
  xpReward: number;
}

export interface TurretEntity {
  uid: string;
  team: Team;
  lane: LaneId | 'base';
  tier: 1 | 2 | 3; // 3 = Base Crystal Nexus
  x: number;
  y: number;
  radius: number;
  range: number;
  hp: number;
  maxHp: number;
  atk: number;
  attackCooldown: number;
  targetUid: string | null;
  alive: boolean;
  isNexus: boolean;
}

export interface JungleCreepEntity {
  uid: string;
  kind: 'forest' | 'lord';
  name: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  radius: number;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
  attackCooldown: number;
  alive: boolean;
  respawnTimer: number;
  goldReward: number;
  xpReward: number;
  aggroTargetUid: string | null;
}

export interface ProjectileEntity {
  uid: string;
  team: Team;
  ownerUid: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  targetUid?: string; // homing if set
  maxDistance: number;
  traveled: number;
  radius: number;
  damage: number;
  damageType: 'physical' | 'magic' | 'true';
  color: string;
  fromTurret?: boolean;
  pierce?: boolean;
  hitUids?: string[];
  explodeRadius?: number;
  slowAmount?: number;
  slowDuration?: number;
  isSkill?: boolean;
}

export interface VisualEffectEntity {
  uid: string;
  kind: 'ring' | 'slash' | 'meteor' | 'freeze' | 'heal' | 'blink' | 'shield' | 'hit';
  x: number;
  y: number;
  radius: number;
  angle?: number;
  color: string;
  timer: number;
  duration: number;
}

export interface FloatingText {
  uid: string;
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  duration: number;
  big?: boolean;
}

export interface KillBanner {
  id: string;
  title: string;
  subtitle: string;
  team: Team;
  timer: number;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  killerTeam: Team;
  victimName: string;
  victimTeam: Team;
  timeStr: string;
}

export interface BushZone {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
}

export interface MatchState {
  mode: MatchMode;
  difficulty: Difficulty;
  mapWidth: number;
  mapHeight: number;
  elapsedTime: number;
  waveTimer: number;
  waveNumber: number;
  passiveGoldTimer: number;

  heroes: HeroEntity[];
  minions: MinionEntity[];
  turrets: TurretEntity[];
  jungleCreeps: JungleCreepEntity[];
  projectiles: ProjectileEntity[];
  effects: VisualEffectEntity[];
  floatingTexts: FloatingText[];
  bushes: BushZone[];

  blueKills: number;
  redKills: number;
  blueLordBuffTimer: number;
  redLordBuffTimer: number;

  killBanner: KillBanner | null;
  killFeed: KillFeedItem[];
  firstBloodTaken: boolean;

  winner: Team | null;
  targetPriority: TargetPriority;
  camera: {
    x: number;
    y: number;
    peekX: number | null;
    peekY: number | null;
  };
}

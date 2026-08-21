/* Shared types, tuning constants and the weapon table — no logic, no three.js runtime. */
import * as THREE from "three";
import type { ShotKind } from "./audio";

/* ================= UI / lifecycle types ================= */
export type Screen = "menu" | "playing" | "paused" | "over";

export interface GameStats {
  score: number;
  best: number;
  wave: number;
  kills: number;
  headshots: number;
  accuracy: number;
  newBest: boolean;
}

export interface UiState {
  screen: Screen;
  stats: GameStats | null;
}

export interface HudData {
  hp: number;
  focus: number;
  focusActive: boolean;
  weaponName: string;
  slot: number;
  mag: number;
  magSize: number;
  reserve: number;
  reloading: boolean;
  lowAmmo: boolean;
  score: number;
  best: number;
  combo: number;
  comboFrac: number;
  wave: number;
  enemiesLeft: number;
  waveState: "combat" | "interm";
  kills: number;
}

export interface GameOptions {
  mount: HTMLDivElement;
  wrap: HTMLDivElement;
  overlay: HTMLCanvasElement;
  fx: HTMLDivElement;
  vignette: HTMLDivElement;
  onUi: (ui: UiState) => void;
  onHud: (hud: HudData) => void;
}

/* ================= weapons ================= */
export interface WeaponDef {
  name: string;
  kind: ShotKind;
  dmg: number;
  pellets: number;
  magSize: number;
  reserveMax: number;
  rpm: number;
  spread: number;
  kick: number;
  reloadTime: number;
}

export const WEAPONS: WeaponDef[] = [
  { name: "WIDOW-9", kind: "pistol", dmg: 34, pellets: 1, magSize: 12, reserveMax: 84, rpm: 340, spread: 0.006, kick: 1.0, reloadTime: 1.05 },
  { name: "HORNET SMG", kind: "smg", dmg: 15, pellets: 1, magSize: 30, reserveMax: 180, rpm: 760, spread: 0.011, kick: 0.5, reloadTime: 1.5 },
  { name: "MAUL-12", kind: "shotgun", dmg: 16, pellets: 7, magSize: 6, reserveMax: 42, rpm: 88, spread: 0.028, kick: 2.4, reloadTime: 2.0 },
];

/* ================= enemies ================= */
export type EnemyType = "thug" | "rusher" | "heavy";

export interface Enemy {
  id: number;
  type: EnemyType;
  group: THREE.Group;
  head: THREE.Mesh;
  legL: THREE.Group;
  legR: THREE.Group;
  armR: THREE.Group;
  visorMat: THREE.MeshToonMaterial;
  mats: THREE.MeshToonMaterial[];
  muzzle: THREE.Object3D;
  blob: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  desired: number;
  dmg: number;
  state: "spawn" | "chase" | "windup" | "lunge" | "dying";
  stateT: number;
  fireCd: number;
  strafePhase: number;
  flashT: number;
  fallDir: number;
  windPhase: number;
  burstLeft: number;
  slide?: THREE.Vector3;
  lungeDir?: THREE.Vector3;
  lungeHit?: boolean;
}

export const ENEMY = {
  RADIUS: 0.5,
  HP: { heavy: 200, rusher: 60, thug: 68 },
  SPEED: { heavy: 2.5, rusher: 6.2, thug: 3.6 },
  THUG_SPEED_VAR: 1.2,
  WAVE_SPEED_SCALE: 0.015,
  WAVE_HP_SCALE: 0.07,
  RANGE: { heavy: 26, other: 20 },
  DMG: { heavy: 15, rusher: 20, thug: 9 },
  FIRE_SPREAD: { heavy: 0.05, other: 0.035 },
  HITBOX: { heavyR: 0.85, heavyH: 2.05, otherR: 0.62, otherH: 1.9 },
  FIRE_CD_MIN: 1,
  FIRE_CD_VAR: 1.2,
  DESIRED: { rusher: 1.25, heavyBase: 8, heavyVar: 4, thugBase: 9, thugVar: 7 },
  LUNGE_RANGE: 2.1,
  LUNGE_SPEED: 13,
  LUNGE_DUR: 0.24,
  LUNGE_HIT_R: 1.25,
  LUNGE_RECOVER: 1.15,
  PUSH_MIN_GAP: 0.12,
} as const;

/* ================= player ================= */
export const PLAYER = {
  HP_MAX: 100,
  RADIUS: 0.55,
  EYE_STAND: 1.62,
  EYE_SLIDE: 1.02,
  WALK: 5.1,
  SPRINT: 7.6,
  FOCUS_SPEED_MULT: 0.85,
  SLIDE_TIME: 0.75,
  SLIDE_CD: 1.1,
  SLIDE_BOOST: 11.5,
  SLIDE_DRAG: 1.6,
  GROUND_ACCEL: 12,
  AIR_ACCEL: 4,
  JUMP_V: 6.6,
  GRAVITY: 19,
  PITCH_MAX: 1.45,
  MOUSE_SENS: 0.00225,
  STEP_DIST: 2.6,
  LAND_SFX_FALL: -3,
  WAVE_HEAL: 22,
  REGEN_RATE: 7.5,
  REGEN_DELAY: 5,
  SPRINT_FOV: 3.2,
  LAND_DIP: 0.014,
} as const;

export const BARREL = {
  HP: 45,
  RADIUS: 6.5,
  DMG: 170,
  PLAYER_DMG: 45,
  PLAYER_RADIUS: 4.5,
  CHAIN_RADIUS: 5.5,
  CHAIN_DELAY: 0.18,
} as const;

export const HELI = {
  FIRST: 24,
  EVERY: 34,
  DUR: 16,
  ORBIT_R: 58,
  HEIGHT: 30,
  DROPS: [0.42, 0.62],
} as const;

export const ILLUM = {
  MIN: 16,
  MAX: 28,
  DUR: 6,
  HEIGHT: 72,
} as const;

/* ================= focus (bullet time) ================= */
export const FOCUS = {
  START: 60,
  MAX: 100,
  DRAIN: 24,
  REGEN: 4.5,
  KILL_GAIN: 14,
  PICKUP_GAIN: 40,
  TIME_SCALE: 0.34,
  FOV: 57,
  FOV_NORMAL: 74,
} as const;

/* ================= hip-fire bloom ================= */
export const BLOOM = {
  CAP: 0.05,
  SPREAD_MULT: 0.8,
  KICK_MULT: 0.0025,
  RECOVERY: 9,
  CROSSHAIR_GAP: 8,
  CROSSHAIR_SCALE: 1200,
} as const;

/* ================= recoil / viewmodel kick ================= */
export const RECOIL = {
  VM_ADD: 0.09,
  VM_PER_KICK: 0.03,
  VM_CAP: 0.16,
  PITCH_ADD: 0.008,
  PITCH_PER_KICK: 0.006,
  ROLL_PER_KICK: 0.02,
  FOV_PUNCH_DEG: 4.2,
} as const;

/* ================= kills / scoring ================= */
export const KILL = {
  HITSTOP: 0.05,
  HITSTOP_HEAD: 0.075,
  HEAD_MULT: 1.8,
  SLIDE_KICK: 2.6,
  SLIDE_KICK_HEAD: 3.6,
  SCORE: { heavy: 300, rusher: 150, thug: 100 },
  HEAD_SCORE_MULT: 1.5,
  COMBO_WINDOW: 2.6,
  COMBO_MULT: 0.15,
  COMBO_CAP: 3,
  DECAL_LIFE: 14,
  DROP: { ammo: 0.16, focus: 0.24, med: 0.32 },
  PICKUP_HP: 28,
  PICKUP_FOCUS: 40,
  AMMO_REFILL: 0.3,
} as const;

/* ================= waves ================= */
export const WAVES = {
  INTERMISSION: 6,
  FIRST_DELAY: 3.4,
  BONUS_BASE: 200,
  BONUS_PER_WAVE: 60,
  THUG_BASE: 4,
  THUG_PER_WAVE: 2,
  THUG_CAP: 22,
  RUSHER_MIN_WAVE: 2,
  RUSHER_BASE: 1,
  RUSHER_PER_WAVE: 0.7,
  RUSHER_CAP: 8,
  HEAVY_MIN_WAVE: 4,
  HEAVY_EVERY: 3,
  HEAVY_CAP: 4,
  SPAWN_DELAY: 0.5,
  SPAWN_T_BASE: 1.5,
  SPAWN_T_DECAY: 0.07,
  SPAWN_T_MIN: 0.5,
} as const;

/* ================= shared FX palette ================= */
export const PAL = {
  BLOOD: 0xd1202f,
  BLOOD_DARK: 0x6b1218,
  EMBER: 0xff6a2a,
  AMBER: 0xffb03a,
  HAZARD: 0xffd23f,
  TIDE: 0x2fe6b0,
  SPARK: 0xffc46a,
  BONE_FLASH: 0xffe0c0,
  SMOKE: 0x23282b,
  TRACER: 0xffc46a,
  SHELL: 0xd8a24a,
  BULLET: 0xff5a3a,
  MUZZLE_FLASH: 0xffd98a,
  MUZZLE_LIGHT: 0xffb066,
  MED: 0xff5a6a,
  SMOKE_DARK: 0x2a2e33,
  SCORCH: 0x14161a,
  ALARM: 0xff2a2a,
  ILLUM: 0xfff0d0,
} as const;

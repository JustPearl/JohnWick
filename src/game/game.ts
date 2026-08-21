import * as THREE from "three";
import { buildWorld, DECK_Y, type WorldRefs, type BlendedWeather } from "./world";
import { SFX } from "./audio";
import { resolveColliders, clampToBounds } from "./physics";
import { buildViewModels } from "./viewmodels";
import {
  WEAPONS,
  PAL,
  RELOAD,
  PLAYER,
  FOCUS,
  BLOOM,
  RECOIL,
  KILL,
  WAVES,
  ENEMY,
  BARREL,
  HELI,
  ILLUM,
  WEATHER,
  WEATHER_CYCLE,
  type WeaponDef,
  type EnemyType,
  type Enemy,
  type Screen,
  type UiState,
  type HudData,
  type GameOptions,
} from "./config";

export type { Screen, GameStats, UiState, HudData, GameOptions } from "./config";

/* ---------------- weather blending ---------------- */
const WX_COL_KEYS = [
  "skyTop", "skyMid", "skyHor", "sunColor", "hemiSky", "hemiGround",
  "keyColor", "rimColor", "fogColor", "seaDeep", "seaCrest", "cloudTint",
] as const;
const WX_NUM_KEYS = [
  "sunIntensity", "hemiIntensity", "keyIntensity", "rimIntensity",
  "fogNear", "fogFar", "seaAmp", "clouds", "rain", "wind", "lightning",
] as const;

function makeWxState(p: (typeof WEATHER)[number]): BlendedWeather {
  const s = {
    name: p.name,
    sunDir: new THREE.Vector3(...p.sunDir).normalize(),
    flash: 0,
  } as BlendedWeather;
  for (const k of WX_COL_KEYS) (s as any)[k] = new THREE.Color((p as any)[k]);
  for (const k of WX_NUM_KEYS) (s as any)[k] = (p as any)[k];
  return s;
}

function copyWxState(dst: BlendedWeather, src: BlendedWeather) {
  dst.name = src.name;
  for (const k of WX_COL_KEYS) (dst as any)[k].copy((src as any)[k]);
  for (const k of WX_NUM_KEYS) (dst as any)[k] = (src as any)[k];
  dst.sunDir.copy(src.sunDir);
}

function blendWxState(a: BlendedWeather, b: BlendedWeather, out: BlendedWeather, t: number) {
  const e = t * t * (3 - 2 * t);
  out.name = b.name;
  for (const k of WX_COL_KEYS) (out as any)[k].copy((a as any)[k]).lerp((b as any)[k], e);
  for (const k of WX_NUM_KEYS) (out as any)[k] = (a as any)[k] + ((b as any)[k] - (a as any)[k]) * e;
  out.sunDir.copy(a.sunDir).lerp(b.sunDir, e).normalize();
}



interface Particle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  grav: number;
  spin: THREE.Vector3;
  active: boolean;
}
interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  active: boolean;
}
interface Shell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  life: number;
  active: boolean;
}
interface Bullet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  active: boolean;
}
interface Pickup {
  mesh: THREE.Mesh;
  kind: "ammo" | "med" | "focus";
  life: number;
  active: boolean;
}
interface Popup {
  el: HTMLSpanElement;
  pos: THREE.Vector3;
  t: number;
}

export class Game {
  private o: GameOptions;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: WorldRefs;
  private sfx = new SFX();
  private raf = 0;
  private lastT = 0;
  private time = 0;

  screen: Screen = "menu";

  /* player */
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = Math.PI;
  private pitch = 0;
  private onGround = true;
  private eye: number = PLAYER.EYE_STAND;
  private eyeTarget: number = PLAYER.EYE_STAND;
  private sliding = 0;
  private slideCd = 0;
  private bobPhase = 0;
  private stepDist = 0;
  private hp: number = PLAYER.HP_MAX;
  private focus: number = FOCUS.START;
  private focusActive = false;
  private wantFocus = false;
  private timescale = 1;
  private lastDamageT = -99;
  private damageFlash = 0;
  private shake = 0;
  private pitchKick = 0;
  private rollKick = 0;

  /* weapons */
  private weapons = WEAPONS.map((w) => ({ def: w, mag: w.magSize, reserve: w.reserveMax }));
  private slot = 0;
  private firing = false;
  private fireCd = 0;
  private reloading = 0;
  private reloadTotal = 1;
  private staged = false;
  private stagedLoaded = 0;
  private stagedTotal = 0;
  private bloom = 0;
  private hitstop = 0;
  private fovPunch = 0;
  private decals: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; active: boolean }[] = [];
  private booms: { pos: THREE.Vector3; t: number }[] = [];
  private heli!: THREE.Group;
  private heliRotor!: THREE.Object3D;
  private heliTailRotor!: THREE.Object3D;
  private heliSpot!: THREE.SpotLight;
  private heliSpotTarget = new THREE.Object3D();
  private heliCone!: THREE.Mesh;
  private heliActive = false;
  private heliT = 0;
  private heliA0 = 0;
  private heliCool: number = HELI.FIRST;
  private heliDrops: number[] = [];
  private illums: { mesh: THREE.Mesh; light: THREE.PointLight; t: number; active: boolean; a: THREE.Vector3; b: THREE.Vector3 }[] = [];
  private illumT = 9;
  private wxA = makeWxState(WEATHER[1]);
  private wxB = makeWxState(WEATHER[1]);
  private wxS = makeWxState(WEATHER[1]);
  private wxIndex = 1;
  private wxT = 1;
  private wxHold: number = 14;
  private lightningT = 0;
  private lightningTimer: number = 6;
  private rain: { mesh: THREE.Mesh }[] = [];
  private rainMat!: THREE.MeshBasicMaterial;
  private sprinting = false;
  private vmLift = 0;
  private vmRecoil = 0;
  private muzzleT = 0;
  private hitT = 0;
  private killT = 0;
  private vmGroups: THREE.Group[] = [];
  private muzzleObj: THREE.Object3D[] = [];
  private muzzleFlashes: THREE.Mesh[] = [];
  private muzzleLight!: THREE.PointLight;
  private vmBase: THREE.Vector3[] = [];
  private flashBase: number[] = [];

  /* entities */
  private enemyRoot = new THREE.Group();
  private corpseRoot = new THREE.Group();
  private enemies: Enemy[] = [];
  private nextEnemyId = 1;
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private shells: Shell[] = [];
  private popups: Popup[] = [];
  private emberT = 0;

  /* waves + score */
  private wave = 0;
  private waveState: "combat" | "interm" = "interm";
  private intermT = 0;
  private spawnQueue: EnemyType[] = [];
  private spawnT = 0;
  private score = 0;
  private best = 0;
  private combo = 0;
  private comboT = 0;
  private kills = 0;
  private headshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;

  /* input */
  private keys = new Set<string>();
  private mouseSens: number = PLAYER.MOUSE_SENS;
  private lastLockRequest = -99;
  private menuIn = 0;

  private ray = new THREE.Raycaster();
  private hudT = 0;
  private ctx2d: CanvasRenderingContext2D;
  private disposed = false;

  /* bound handlers */
  private hKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private hKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private hMouseMove = (e: MouseEvent) => this.onMouseMove(e);
  private hMouseDown = (e: MouseEvent) => this.onMouseDown(e);
  private hMouseUp = (e: MouseEvent) => this.onMouseUp(e);
  private hWheel = (e: WheelEvent) => this.onWheel(e);
  private hCtx = (e: Event) => e.preventDefault();
  private hLock = () => this.onLockChange();
  private hResize = () => this.onResize();
  private hVis = () => {
    if (document.hidden && this.screen === "playing") this.pause();
  };

  constructor(o: GameOptions) {
    this.o = o;
    this.best = Number(localStorage.getItem("bgv-best") || 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    o.mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.08, 600);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.world = buildWorld(this.scene);
    this.scene.add(this.enemyRoot, this.corpseRoot);

    this.buildViewModels();
    this.buildPools();

    this.ctx2d = o.overlay.getContext("2d")!;

    window.addEventListener("keydown", this.hKeyDown);
    window.addEventListener("keyup", this.hKeyUp);
    window.addEventListener("mousemove", this.hMouseMove);
    window.addEventListener("mousedown", this.hMouseDown);
    window.addEventListener("mouseup", this.hMouseUp);
    window.addEventListener("wheel", this.hWheel, { passive: false });
    window.addEventListener("resize", this.hResize);
    window.addEventListener("blur", this.hVis);
    document.addEventListener("visibilitychange", this.hVis);
    document.addEventListener("pointerlockchange", this.hLock);
    this.renderer.domElement.addEventListener("contextmenu", this.hCtx);

    this.onResize();
    this.pos.copy(this.world.playerStart);
    this.lastT = performance.now();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
    this.pushHud();
  }

  /* ================= view models ================= */
  private buildViewModels() {
    const vm = buildViewModels(this.camera);
    this.vmGroups = vm.groups;
    this.muzzleObj = vm.muzzle;
    this.muzzleFlashes = vm.flashes;
    this.vmBase = vm.base;
    this.flashBase = vm.flashBase;
    this.muzzleLight = vm.light;
  }



  /* ================= pools ================= */
  private buildPools() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 200; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(box, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        grav: 0,
        spin: new THREE.Vector3(),
        active: false,
      });
    }
    const tGeo = new THREE.BoxGeometry(0.028, 0.028, 1);
    const tMat = new THREE.MeshBasicMaterial({
      color: PAL.TRACER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(tGeo, tMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0, active: false });
    }
    const sGeo = new THREE.BoxGeometry(0.045, 0.11, 0.045);
    const sMat = new THREE.MeshToonMaterial({ color: PAL.SHELL });
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(sGeo, sMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shells.push({ mesh, vel: new THREE.Vector3(), rot: new THREE.Vector3(), life: 0, active: false });
    }
    const bGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: PAL.BULLET,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(bGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.bullets.push({ mesh, vel: new THREE.Vector3(), life: 0, dmg: 0, active: false });
    }
    const blobGeo = new THREE.CircleGeometry(0.62, 14);
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(blobGeo, blobMat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      this.pickups.push({ mesh: m, kind: "ammo", life: 0, active: false });
    }
    const decalGeo = new THREE.CircleGeometry(1, 18);
    for (let i = 0; i < 30; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: PAL.BLOOD_DARK, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(decalGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.scene.add(mesh);
      this.decals.push({ mesh, mat, life: 0, active: false });
    }

    /* ---- gunship ---- */
    const hull = new THREE.MeshToonMaterial({ color: 0x2e3430 });
    const hullDark = new THREE.MeshToonMaterial({ color: 0x1c211e });
    const glass = new THREE.MeshToonMaterial({ color: 0x9fd8d0, emissive: 0x2a4a48, emissiveIntensity: 0.4 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 3.6), hull);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), glass);
    nose.position.set(0, -0.15, 2.2);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.4), glass);
    canopy.position.set(0, 0.55, 1.1);
    const boomT = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 3.4), hullDark);
    boomT.position.set(0, 0.2, -3.2);
    const finV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.9), hull);
    finV.position.set(0, 1, -4.7);
    const finH = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.7), hull);
    finH.position.set(0, 0.45, -4.7);
    const rotor = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.6, 0.05, 20),
      new THREE.MeshBasicMaterial({ color: 0x88929a, transparent: true, opacity: 0.28, depthWrite: false })
    );
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.04, 0.22), hullDark);
    const blade2 = blade.clone();
    blade2.rotation.y = Math.PI / 2;
    rotor.add(disc, blade, blade2);
    rotor.position.y = 1.05;
    const tailRotor = new THREE.Group();
    const tDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.04, 12),
      new THREE.MeshBasicMaterial({ color: 0x88929a, transparent: true, opacity: 0.3, depthWrite: false })
    );
    tDisc.rotation.z = Math.PI / 2;
    tailRotor.add(tDisc);
    tailRotor.position.set(0.2, 1, -4.7);
    for (const sx of [-0.65, 0.65]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 3.4), hullDark);
      skid.position.set(sx, -1.05, 0.2);
      g.add(skid);
      for (const sz of [-0.7, 0.9]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), hullDark);
        strut.position.set(sx, -0.8, sz);
        g.add(strut);
      }
    }
    const spot = new THREE.SpotLight(0xfff0d0, 0, 120, 0.4, 0.55, 1.2);
    spot.position.set(0, -0.5, 1.6);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 5.5, 26, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.position.set(0, -14, 1.6);
    this.scene.add(this.heliSpotTarget);
    spot.target = this.heliSpotTarget;
    g.add(body, nose, canopy, boomT, finV, finH, rotor, tailRotor, spot, cone);
    g.visible = false;
    this.scene.add(g);
    this.heli = g;
    this.heliRotor = rotor;
    this.heliTailRotor = tailRotor;
    this.heliSpot = spot;
    this.heliCone = cone;

    /* ---- illumination flares ---- */
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 10, 10),
        new THREE.MeshBasicMaterial({ color: PAL.ILLUM, transparent: true, opacity: 0 })
      );
      const l = new THREE.PointLight(PAL.ILLUM, 0, 320, 1);
      m.add(l);
      m.visible = false;
      this.scene.add(m);
      this.illums.push({ mesh: m, light: l, t: 0, active: false, a: new THREE.Vector3(), b: new THREE.Vector3() });
    }

    /* ---- rain ---- */
    const rGeo = new THREE.BoxGeometry(0.014, 1.5, 0.014);
    this.rainMat = new THREE.MeshBasicMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0 });
    for (let i = 0; i < 280; i++) {
      const m = new THREE.Mesh(rGeo, this.rainMat);
      m.visible = false;
      this.scene.add(m);
      this.rain.push({ mesh: m });
    }
  }

  /* ================= enemies ================= */
  private makeEnemy(type: EnemyType, at: THREE.Vector3): Enemy {
    const g = new THREE.Group();
    const heavy = type === "heavy";
    const rusher = type === "rusher";
    const scale = heavy ? 1.28 : 1;

    const coat = new THREE.MeshToonMaterial({ color: heavy ? 0x3a4148 : 0x23282b });
    const vest = new THREE.MeshToonMaterial({ color: heavy ? 0x57666b : 0x39424a });
    const skin = new THREE.MeshToonMaterial({ color: 0xc9a184 });
    const pants = new THREE.MeshToonMaterial({ color: 0x1a1f22 });
    const helmetCol = heavy ? 0xffd23f : rusher ? 0xc22838 : 0x4a5157;
    const helmet = new THREE.MeshToonMaterial({ color: helmetCol });
    const visorMat = new THREE.MeshToonMaterial({ color: 0xff2438, emissive: 0xff2438, emissiveIntensity: 1.4 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.34), coat);
    torso.position.y = 1.18;
    torso.name = "body";
    const vestM = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.4), vest);
    vestM.position.y = 1.24;
    vestM.name = "body";
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
    head.position.y = 1.72;
    head.name = "head";
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.36), helmet);
    helm.position.y = 1.84;
    helm.name = "head";
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), visorMat);
    visor.position.set(0, 1.74, -0.16);
    visor.name = "head";

    const legL = new THREE.Group();
    legL.position.set(0.16, 0.86, 0);
    const legR = new THREE.Group();
    legR.position.set(-0.16, 0.86, 0);
    const mkLeg = () => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.86, 0.24), pants);
      l.position.y = -0.43;
      return l;
    };
    legL.add(mkLeg());
    legR.add(mkLeg());

    const armR = new THREE.Group();
    armR.position.set(-0.42, 1.42, 0);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), coat);
    armMesh.position.y = -0.28;
    armR.add(armMesh);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, rusher ? 0.3 : 0.55), new THREE.MeshToonMaterial({ color: 0x14181b }));
    gun.position.set(0, -0.5, rusher ? -0.12 : -0.34);
    armR.add(gun);
    const armL = new THREE.Group();
    armL.position.set(0.42, 1.42, 0);
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), coat);
    armLMesh.position.y = -0.28;
    armL.add(armLMesh);

    if (rusher) {
      armR.rotation.x = -1.35;
      armL.rotation.x = -1.35;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.09), new THREE.MeshToonMaterial({ color: 0xb9c4c9 }));
      blade.position.set(0, -0.72, -0.1);
      armR.add(blade);
    } else {
      armR.rotation.x = -1.25;
      armL.rotation.x = -1.0;
    }

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, -0.5, rusher ? -0.3 : -0.66);
    armR.add(muzzle);

    g.add(torso, vestM, head, helm, visor, legL, legR, armR, armL);
    g.scale.setScalar(scale);
    g.position.copy(at);
    g.position.y = DECK_Y - 2.4;

    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(heavy ? 0.8 : 0.6, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(at.x, DECK_Y + 0.045, at.z);
    this.scene.add(blob);

    const mats = [coat, vest, skin, helmet, pants];
    const e: Enemy = {
      id: this.nextEnemyId++,
      type,
      group: g,
      head,
      legL,
      legR,
      armR,
      visorMat,
      mats,
      muzzle,
      blob,
      hp: heavy ? ENEMY.HP.heavy : rusher ? ENEMY.HP.rusher : ENEMY.HP.thug,
      maxHp: heavy ? ENEMY.HP.heavy : rusher ? ENEMY.HP.rusher : ENEMY.HP.thug,
      speed: (heavy ? ENEMY.SPEED.heavy : rusher ? ENEMY.SPEED.rusher : ENEMY.SPEED.thug + Math.random() * ENEMY.THUG_SPEED_VAR) * (1 + this.wave * ENEMY.WAVE_SPEED_SCALE),
      range: heavy ? ENEMY.RANGE.heavy : ENEMY.RANGE.other,
      desired: rusher ? ENEMY.DESIRED.rusher : heavy ? ENEMY.DESIRED.heavyBase + Math.random() * ENEMY.DESIRED.heavyVar : ENEMY.DESIRED.thugBase + Math.random() * ENEMY.DESIRED.thugVar,
      dmg: heavy ? ENEMY.DMG.heavy : rusher ? ENEMY.DMG.rusher : ENEMY.DMG.thug,
      state: "spawn",
      stateT: 0,
      fireCd: ENEMY.FIRE_CD_MIN + Math.random() * ENEMY.FIRE_CD_VAR,
      strafePhase: Math.random() * Math.PI * 2,
      flashT: 0,
      fallDir: Math.random() * Math.PI * 2,
      windPhase: 0,
      burstLeft: 0,
    };
    e.hp *= 1 + this.wave * ENEMY.WAVE_HP_SCALE;
    e.maxHp = e.hp;
    // generous invisible body hitbox (raycaster tests invisible meshes)
    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(heavy ? ENEMY.HITBOX.heavyR : ENEMY.HITBOX.otherR, heavy ? ENEMY.HITBOX.heavyR : ENEMY.HITBOX.otherR, heavy ? ENEMY.HITBOX.heavyH : ENEMY.HITBOX.otherH, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = heavy ? 1.02 : 0.95;
    hitbox.name = "body";
    g.add(hitbox);
    g.traverse((c) => {
      c.userData.eid = e.id;
    });
    this.enemyRoot.add(g);
    this.enemies.push(e);
    this.burst(at.clone().setY(DECK_Y + 1), 0x8fd8cf, 10, 3.2, 0.5, 6, 0.09);
    return e;
  }

  private updateEnemy(e: Enemy, dt: number) {
    if (e.state === "dying") {
      e.stateT += dt;
      const k = Math.min(1, e.stateT / 0.45);
      e.group.rotation.x = -k * Math.PI * 0.5 * Math.cos(e.fallDir);
      e.group.rotation.z = k * Math.PI * 0.5 * Math.sin(e.fallDir);
      if (e.slide) {
        e.group.position.addScaledVector(e.slide, dt);
        e.slide.multiplyScalar(1 - Math.min(1, dt * 5));
      }
      if (e.stateT > 0.5) {
        e.group.position.y -= dt * 1.6;
        e.blob.scale.multiplyScalar(1 - dt * 2);
      }
      if (e.stateT > 1.5) this.removeEnemy(e);
      return;
    }

    if (e.state === "spawn") {
      e.stateT += dt;
      e.group.position.y = DECK_Y - 2.4 + Math.min(1, e.stateT / 0.55) * 2.4;
      e.blob.position.set(e.group.position.x, DECK_Y + 0.045, e.group.position.z);
      if (e.stateT >= 0.55) {
        e.group.position.y = DECK_Y;
        e.state = "chase";
      }
      return;
    }

    const toPlayer = new THREE.Vector3().subVectors(this.pos, e.group.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = toPlayer.clone().normalize();

    if (e.state === "lunge") {
      e.stateT += dt;
      e.group.position.addScaledVector(e.lungeDir!, ENEMY.LUNGE_SPEED * dt);
      e.visorMat.emissiveIntensity = 2.4;
      const sw = Math.sin(this.time * 26 + e.strafePhase) * 0.95;
      e.legL.rotation.x = sw;
      e.legR.rotation.x = -sw;
      e.armR.rotation.x = -1.9; // blade thrust
      const dxp = this.pos.x - e.group.position.x;
      const dzp = this.pos.z - e.group.position.z;
      if (!e.lungeHit && dxp * dxp + dzp * dzp < ENEMY.LUNGE_HIT_R * ENEMY.LUNGE_HIT_R) {
        e.lungeHit = true;
        this.damagePlayer(e.dmg);
        // shove the player back along the blade's path
        const dl = Math.sqrt(Math.max(dxp * dxp + dzp * dzp, 1e-4));
        this.vel.x += (dxp / dl) * 4.5;
        this.vel.z += (dzp / dl) * 4.5;
      }
      resolveColliders(e.group.position, ENEMY.RADIUS, this.world.colliders);
      clampToBounds(e.group.position, ENEMY.RADIUS, this.world.boundaryRects);
      this.pushOutFromPlayer(e);
      e.blob.position.set(e.group.position.x, DECK_Y + 0.045, e.group.position.z);
      if (e.stateT >= ENEMY.LUNGE_DUR || e.lungeHit) {
        e.state = "chase";
        e.fireCd = ENEMY.LUNGE_RECOVER;
        e.visorMat.emissiveIntensity = 1.4;
        e.armR.rotation.x = -1.35;
      }
      return;
    }

    if (e.state === "windup") {
      e.stateT += dt;
      e.windPhase += dt * 26;
      e.visorMat.emissiveIntensity = 1.6 + Math.sin(e.windPhase) * 1.2;
      e.armR.rotation.x = -1.25 - Math.min(1, e.stateT * 3) * 0.3;
      const dur = e.type === "rusher" ? 0.34 : 0.5;
      if (e.stateT >= dur) {
        if (e.type === "rusher") {
          // snapshot a lunge direction — it becomes a dodgeable dash
          const dp = this.pos.clone().sub(e.group.position).setY(0);
          e.lungeDir = dp.lengthSq() > 1e-4 ? dp.normalize() : new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.group.rotation.y);
          e.lungeHit = false;
          e.state = "lunge";
          e.stateT = 0;
          this.sfx.slide();
        } else {
          this.enemyShoot(e);
          if (e.type === "heavy") {
            e.burstLeft--;
            if (e.burstLeft > 0) {
              e.stateT = dur - 0.16;
              return;
            }
          }
          e.state = "chase";
          e.fireCd = (e.type === "heavy" ? 2.6 : 1.7) * (0.75 + Math.random() * 0.5);
        }
        e.visorMat.emissiveIntensity = 1.4;
        e.armR.rotation.x = -1.25;
      }
      this.pushOutFromPlayer(e);
      return;
    }

    // chase movement
    e.fireCd -= dt;
    const strafeAmp = e.type === "rusher" ? 0.25 : 1.1;
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(this.time * 1.7 + e.strafePhase) * strafeAmp);
    let move = new THREE.Vector3();
    const contact = ENEMY.RADIUS + PLAYER.RADIUS + ENEMY.PUSH_MIN_GAP;
    if (e.type === "rusher") {
      // close to blade range, then circle at the edge — never walk inside the player
      if (dist > contact + 0.35) move.copy(dir).multiplyScalar(e.speed).add(perp);
      else move.copy(perp).multiplyScalar(e.speed * 0.85);
    } else if (dist > e.desired + 1.2) {
      move.copy(dir).multiplyScalar(e.speed).add(perp);
    } else if (dist < e.desired - 1.5) {
      move.copy(dir).multiplyScalar(-e.speed * 0.6);
    } else {
      move.copy(perp).multiplyScalar(e.speed * 0.55);
    }
    e.group.position.addScaledVector(move, dt);
    resolveColliders(e.group.position, ENEMY.RADIUS, this.world.colliders);
    clampToBounds(e.group.position, ENEMY.RADIUS, this.world.boundaryRects);
    this.pushOutFromPlayer(e);

    // face player
    const targetYaw = Math.atan2(dir.x, dir.z) + Math.PI;
    let dy = targetYaw - e.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    e.group.rotation.y += dy * Math.min(1, dt * 9);

    // legs swing
    const moving = move.lengthSq() > 0.05;
    const swing = moving ? Math.sin(this.time * (e.type === "rusher" ? 16 : 9) + e.strafePhase) * 0.7 : 0;
    e.legL.rotation.x = swing;
    e.legR.rotation.x = -swing;
    e.blob.position.set(e.group.position.x, DECK_Y + 0.045, e.group.position.z);

    // flash decay
    if (e.flashT > 0) {
      e.flashT -= dt;
      const f = Math.max(0, e.flashT / 0.09);
      for (const m of e.mats) m.emissiveIntensity = f * 0.9;
      if (e.flashT <= 0) for (const m of e.mats) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 1;
      }
    }

    // engage
    if (e.type === "rusher") {
      if (dist < 2.1 && e.fireCd <= 0) {
        e.state = "windup";
        e.stateT = 0;
      }
    } else if (dist < e.range && e.fireCd <= 0) {
      if (this.hasLOS(e)) {
        e.state = "windup";
        e.stateT = 0;
        e.burstLeft = e.type === "heavy" ? 3 : 1;
      } else {
        e.fireCd = 0.5;
      }
    }
  }

  /** Hard body collision: no enemy may occupy the player's circle. */
  private pushOutFromPlayer(e: Enemy) {
    const dx = e.group.position.x - this.pos.x;
    const dz = e.group.position.z - this.pos.z;
    const minD = ENEMY.RADIUS + PLAYER.RADIUS + ENEMY.PUSH_MIN_GAP;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD) return;
    const d = Math.sqrt(Math.max(d2, 1e-6));
    const nx = dx / d;
    const nz = dz / d;
    const push = minD - d;
    e.group.position.x += nx * push * 0.82;
    e.group.position.z += nz * push * 0.82;
    // the player feels the shoulder-check
    this.vel.x -= nx * push * 2.4;
    this.vel.z -= nz * push * 2.4;
  }

  private hasLOS(e: Enemy): boolean {
    const from = e.group.position.clone().setY(DECK_Y + 1.5);
    const to = this.pos.clone().setY(DECK_Y + 1.5);
    const dirV = to.clone().sub(from);
    const d = dirV.length();
    this.ray.set(from, dirV.normalize());
    this.ray.far = d;
    const hits = this.ray.intersectObjects(this.world.solids, true);
    this.ray.far = Infinity;
    return hits.length === 0;
  }

  private enemyShoot(e: Enemy) {
    const b = this.bullets.find((x) => !x.active);
    if (!b) return;
    const from = new THREE.Vector3();
    e.muzzle.getWorldPosition(from);
    const aim = this.pos.clone();
    aim.y = DECK_Y + 1.35;
    const spread = e.type === "heavy" ? ENEMY.FIRE_SPREAD.heavy : ENEMY.FIRE_SPREAD.other;
    const dir = aim.sub(from).normalize();
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    b.mesh.position.copy(from);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    b.vel.copy(dir).multiplyScalar(30);
    b.life = 2.2;
    b.dmg = e.dmg;
    b.active = true;
    b.mesh.visible = true;
    this.sfx.shot(e.type === "heavy" ? "smg" : "pistol");
  }

  private removeEnemy(e: Enemy) {
    this.enemyRoot.remove(e.group);
    this.corpseRoot.remove(e.group);
    this.scene.remove(e.blob);
    e.group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        (c as THREE.Mesh).geometry.dispose();
      }
    });
    e.blob.geometry.dispose();
    (e.blob.material as THREE.Material).dispose();
    this.enemies = this.enemies.filter((x) => x.id !== e.id);
  }

  /* ================= combat ================= */
  private tryFire() {
    const w = this.weapons[this.slot];
    if (this.screen !== "playing") return;
    if (this.reloading > 0) {
      // interrupt: fire what's already loaded (staged shells are kept)
      if (w.mag <= 0) return; // nothing to fire — keep reloading
      this.cancelReload();
    }
    if (this.fireCd > 0) return;
    if (w.mag <= 0) {
      this.sfx.dry();
      this.fireCd = 0.28;
      if (w.reserve > 0) this.startReload();
      return;
    }
    this.fireCd = 60 / w.def.rpm;
    w.mag--;
    this.shotsFired++;
    this.sfx.shot(w.def.kind);
    this.vmRecoil = Math.min(RECOIL.VM_CAP, this.vmRecoil + RECOIL.VM_ADD + w.def.kick * RECOIL.VM_PER_KICK);
    this.pitchKick += RECOIL.PITCH_ADD + w.def.kick * RECOIL.PITCH_PER_KICK;
    this.rollKick = (Math.random() - 0.5) * RECOIL.ROLL_PER_KICK * w.def.kick;
    this.bloom = Math.min(BLOOM.CAP, this.bloom + w.def.spread * BLOOM.SPREAD_MULT + w.def.kick * BLOOM.KICK_MULT);
    this.shake = Math.min(1, this.shake + 0.1 + w.def.kick * 0.08);
    this.muzzleT = 0.05;
    this.muzzleLight.intensity = 26;

    const muzzleW = new THREE.Vector3();
    this.muzzleObj[this.slot].getWorldPosition(muzzleW);
    const flash = this.muzzleFlashes[this.slot];
    flash.rotation.z = Math.random() * Math.PI;
    flash.scale.setScalar((0.8 + w.def.kick * 0.5) * this.flashBase[this.slot]);

    let anyHit = false;
    const spread = w.def.spread + this.bloom;
    for (let p = 0; p < w.def.pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread * 2;
      dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();
      this.ray.set(this.camera.position, dir);
      this.ray.far = 220;
      const eHits = this.ray.intersectObjects(this.enemyRoot.children, true);
      const sHits = this.ray.intersectObjects(this.world.solids, true);
      const sD = sHits.length ? sHits[0].distance : Infinity;
      const eH = eHits.find((h) => h.distance < sD);
      let end: THREE.Vector3;
      if (eH) {
        anyHit = true;
        const eid = eH.object.userData.eid as number;
        const en = this.enemies.find((x) => x.id === eid);
        const isHead = eH.object.name === "head";
        if (en && en.state !== "dying") {
          const dmg = w.def.dmg * (isHead ? KILL.HEAD_MULT : 1);
          this.hitEnemy(en, dmg, isHead, eH.point);
        }
        end = eH.point;
      } else if (sHits.length) {
        end = sHits[0].point;
        const bid = sHits[0].object.userData.bid as number | undefined;
        if (bid !== undefined) this.damageBarrel(bid, w.def.dmg);
        this.burst(sHits[0].point, PAL.SPARK, 7, 3.4, 0.34, 9, 0.045);
        this.burst(sHits[0].point, PAL.SMOKE, 2, 0.8, 0.5, -1.5, 0.07);
      } else {
        end = this.camera.position.clone().addScaledVector(dir, 160);
      }
      this.spawnTracer(muzzleW, end);
    }
    if (anyHit) this.shotsHit++;

    // muzzle smoke
    this.burst(muzzleW.clone(), PAL.SMOKE, 2, 0.45, 0.7, -1.1, 0.085);

    // shell
    const sh = this.shells.find((x) => !x.active);
    if (sh) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      sh.mesh.position.copy(muzzleW);
      sh.vel.copy(right).multiplyScalar(2.2 + Math.random()).addScaledVector(up, 1.6 + Math.random());
      sh.rot.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      sh.life = 3.5;
      sh.active = true;
      sh.mesh.visible = true;
    }
  }

  private hitEnemy(e: Enemy, dmg: number, head: boolean, point: THREE.Vector3) {
    e.hp -= dmg;
    e.flashT = 0.09;
    for (const m of e.mats) {
      m.emissive.setHex(PAL.BONE_FLASH);
      m.emissiveIntensity = 0.9;
    }
    this.hitT = 0.13;
    this.sfx.hit(head);
    this.burst(point, head ? PAL.HAZARD : PAL.BLOOD, head ? 12 : 7, 3.4, 0.4, 9, 0.06);
    if (e.hp <= 0) this.killEnemy(e, head);
  }

  private killEnemy(e: Enemy, head: boolean) {
    e.state = "dying";
    e.stateT = 0;
    this.enemyRoot.remove(e.group);
    this.corpseRoot.add(e.group);
    this.killT = 0.2;
    this.sfx.die();
    this.burst(e.group.position.clone().setY(DECK_Y + 1.2), PAL.BLOOD, 16, 4.4, 0.55, 10, 0.07);
    this.burst(e.group.position.clone().setY(DECK_Y + 1.2), PAL.SMOKE, 8, 3, 0.5, 10, 0.09);

    // kill impact: hitstop, fov punch, shockwave ring, blood decal, screen flash
    this.hitstop = Math.max(this.hitstop, head ? KILL.HITSTOP_HEAD : KILL.HITSTOP);
    this.fovPunch = 1;
    this.sfx.thump();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    fwd.y = 0;
    fwd.normalize().multiplyScalar(head ? KILL.SLIDE_KICK_HEAD : KILL.SLIDE_KICK);
    e.slide = fwd;
    this.spawnDecal(e.group.position);
    const flash = document.createElement("div");
    flash.className = "fx-killflash" + (head ? " head" : "");
    this.o.fx.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());

    this.kills++;
    if (head) this.headshots++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = KILL.COMBO_WINDOW;
    const mult = Math.min(KILL.COMBO_CAP, 1 + (this.combo - 1) * KILL.COMBO_MULT);
    const base = e.type === "heavy" ? KILL.SCORE.heavy : e.type === "rusher" ? KILL.SCORE.rusher : KILL.SCORE.thug;
    const gained = Math.round(base * (head ? KILL.HEAD_SCORE_MULT : 1) * mult);
    this.score += gained;
    this.focus = Math.min(FOCUS.MAX, this.focus + FOCUS.KILL_GAIN);

    const p = e.group.position.clone().setY(DECK_Y + 1.9);
    this.popup(p, `+${gained}`, head ? "text-hazard" : "text-amber");
    if (head) this.popup(p.clone().add(new THREE.Vector3(0, 0.5, 0)), "HEADSHOT", "text-hazard");
    const label = e.type === "heavy" ? "JUGGERNAUT" : e.type === "rusher" ? "BLADER" : "MERCENARY";
    this.feed(`YOU ▸ ${label} · +${gained}`);

    // drops
    const roll = Math.random();
    const kind: Pickup["kind"] | null = roll < KILL.DROP.ammo ? "ammo" : roll < KILL.DROP.focus ? "focus" : roll < KILL.DROP.med ? "med" : null;
    if (kind) this.spawnPickup(kind, e.group.position.clone());
  }

  private damagePlayer(amount: number) {
    if (this.screen !== "playing") return;
    this.hp -= amount;
    this.lastDamageT = this.time;
    this.damageFlash = 1;
    this.shake = Math.min(1.4, this.shake + 0.7);
    this.pitchKick += 0.012;
    this.sfx.hurt();
    this.burst(this.pos.clone().setY(DECK_Y + 1.5), 0xd1202f, 8, 2.6, 0.4, 6, 0.06);
    if (this.hp <= 0) {
      this.hp = 0;
      this.gameOver();
    }
  }

  /* ================= fx primitives ================= */
  private burst(at: THREE.Vector3, color: number, count: number, speed: number, life: number, grav: number, size: number) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.copy(at);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.7, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      p.life = life * (0.6 + Math.random() * 0.7);
      p.maxLife = p.life;
      p.grav = grav;
      p.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      const s = size * (0.6 + Math.random() * 0.9);
      p.mesh.scale.set(s, s, s);
      p.mat.color.setHex(color);
      p.mat.opacity = 1;
      if (++spawned >= count) break;
    }
  }

  private spawnTracer(a: THREE.Vector3, b: THREE.Vector3) {
    const t = this.tracers.find((x) => !x.active);
    if (!t) return;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    t.mesh.position.copy(mid);
    t.mesh.scale.set(1, 1, Math.max(0.1, len));
    t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
    t.life = 0.07;
    t.active = true;
    t.mesh.visible = true;
    (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
  }

  private spawnPickup(kind: Pickup["kind"], at: THREE.Vector3) {
    const pk = this.pickups.find((x) => !x.active);
    if (!pk) return;
    const color = kind === "ammo" ? PAL.AMBER : kind === "med" ? PAL.MED : PAL.TIDE;
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4),
      new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.9 })
    );
    body.position.set(at.x, DECK_Y + 0.75, at.z);
    body.userData.pickupKind = kind;
    this.scene.add(body);
    pk.mesh.visible = false;
    pk.kind = kind;
    pk.life = 16;
    pk.active = true;
    (pk as any).body = body;
  }

  /* ================= DOM fx ================= */
  private popup(at: THREE.Vector3, text: string, cls: string) {
    if (this.popups.length > 9) return;
    const el = document.createElement("span");
    el.className = `fx-pop absolute font-hud font-bold text-xl tracking-widest pointer-events-none ${cls}`;
    el.style.textShadow = "0 2px 8px rgba(0,0,0,0.8)";
    el.textContent = text;
    this.o.fx.appendChild(el);
    this.popups.push({ el, pos: at, t: 0 });
    setTimeout(() => {
      el.remove();
      this.popups = this.popups.filter((p) => p.el !== el);
    }, 900);
  }

  private feed(text: string) {
    const el = document.createElement("div");
    el.className =
      "fx-feed font-hud text-[13px] font-semibold tracking-wider text-bone/90 bg-ink/70 border-l-2 border-amber px-2 py-0.5 mb-1";
    el.textContent = text;
    const holder = this.o.fx.querySelector("#feed");
    if (holder) {
      holder.prepend(el);
      while (holder.children.length > 4) holder.lastChild?.remove();
    }
    setTimeout(() => el.remove(), 3200);
  }

  private banner(main: string, sub: string) {
    const el = document.createElement("div");
    el.className = "fx-banner absolute left-0 right-0 top-[30%] text-center pointer-events-none";
    el.innerHTML = `<div class="font-display text-5xl md:text-7xl text-bone" style="text-shadow:0 0 30px rgba(255,106,42,0.55), 0 4px 0 rgba(0,0,0,0.6)">${main}</div><div class="font-hud font-semibold tracking-[0.5em] text-amber text-lg mt-2 uppercase">${sub}</div>`;
    this.o.fx.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  /* ================= waves ================= */
  private startIntermission(dur: number, first = false) {
    this.waveState = "interm";
    this.intermT = dur;
    if (!first) {
      const bonus = WAVES.BONUS_BASE + this.wave * WAVES.BONUS_PER_WAVE;
      this.score += bonus;
      for (const w of this.weapons) w.reserve = w.def.reserveMax;
      this.hp = Math.min(PLAYER.HP_MAX, this.hp + PLAYER.WAVE_HEAL);
      this.banner("WAVE CLEARED", `SUPPLY DROP +${bonus} · AMMO RESTOCKED`);
      this.sfx.waveClear();
    } else {
      this.banner("RIG 09 BREACHED", "HOSTILES INBOUND — HOLD THE DECK");
      this.sfx.wave();
    }
  }

  private startWave() {
    this.wave++;
    this.waveState = "combat";
    const n = this.wave;
    const q: EnemyType[] = [];
    const thugs = Math.min(WAVES.THUG_CAP, WAVES.THUG_BASE + n * WAVES.THUG_PER_WAVE);
    const rushers = n >= WAVES.RUSHER_MIN_WAVE ? Math.min(WAVES.RUSHER_CAP, WAVES.RUSHER_BASE + Math.floor(n * WAVES.RUSHER_PER_WAVE)) : 0;
    const heavies = n >= WAVES.HEAVY_MIN_WAVE ? Math.min(WAVES.HEAVY_CAP, Math.floor(n / WAVES.HEAVY_EVERY)) : 0;
    for (let i = 0; i < thugs; i++) q.push("thug");
    for (let i = 0; i < rushers; i++) q.push("rusher");
    for (let i = 0; i < heavies; i++) q.push("heavy");
    // shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    this.spawnQueue = q;
    this.spawnT = WAVES.SPAWN_DELAY;
    this.banner(`WAVE ${String(n).padStart(2, "0")}`, `${q.length} HOSTILES · BOARDING NOW`);
    this.sfx.wave();
  }

  private waveTick(dt: number) {
    if (this.waveState === "interm") {
      this.intermT -= dt;
      if (this.intermT <= 0) this.startWave();
      return;
    }
    const alive = this.enemies.filter((e) => e.state !== "dying").length;
    if (this.spawnQueue.length > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive < 15) {
        const type = this.spawnQueue.shift()!;
        const pt = this.pickSpawn();
        this.makeEnemy(type, pt);
        this.spawnT = Math.max(WAVES.SPAWN_T_MIN, WAVES.SPAWN_T_BASE - this.wave * WAVES.SPAWN_T_DECAY);
      }
    } else if (alive === 0) {
      this.startIntermission(WAVES.INTERMISSION);
    }
  }

  private pickSpawn(): THREE.Vector3 {
    const pts = this.world.spawnPoints;
    for (let i = 0; i < 8; i++) {
      const p = pts[Math.floor(Math.random() * pts.length)];
      if (p.distanceTo(this.pos) > 13) return p.clone();
    }
    return pts[Math.floor(Math.random() * pts.length)].clone();
  }

  /* ================= input ================= */
  private onKeyDown(e: KeyboardEvent) {
    if (["Space", "KeyC", "ControlLeft", "ShiftLeft"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (this.screen === "playing") {
      if (e.code === "Digit1") this.switchTo(0);
      if (e.code === "Digit2") this.switchTo(1);
      if (e.code === "Digit3") this.switchTo(2);
      if (e.code === "KeyR") this.startReload();
      if (e.code === "KeyP") this.pause();
    } else if (this.screen === "paused" && e.code === "KeyP") {
      this.resume();
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.screen !== "playing" || document.pointerLockElement !== this.renderer.domElement) return;
    this.yaw -= e.movementX * this.mouseSens;
    this.pitch -= e.movementY * this.mouseSens;
    this.pitch = Math.max(-PLAYER.PITCH_MAX, Math.min(PLAYER.PITCH_MAX, this.pitch));
  }

  private onMouseDown(e: MouseEvent) {
    if (this.screen !== "playing") return;
    if (e.button === 0) this.firing = true;
    if (e.button === 2) this.wantFocus = true;
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) this.firing = false;
    if (e.button === 2) this.wantFocus = false;
  }

  private onWheel(e: WheelEvent) {
    if (this.screen !== "playing") return;
    e.preventDefault();
    const d = e.deltaY > 0 ? 1 : -1;
    this.switchTo((this.slot + d + 3) % 3);
  }

  private onLockChange() {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && this.screen === "playing") this.pause();
  }

  private onResize() {
    const w = this.o.mount.clientWidth || window.innerWidth;
    const h = this.o.mount.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio, 1.75);
    this.o.overlay.width = w * dpr;
    this.o.overlay.height = h * dpr;
    this.o.overlay.style.width = `${w}px`;
    this.o.overlay.style.height = `${h}px`;
  }

  private switchTo(i: number) {
    if (i === this.slot) return;
    // weapon switch interrupts any reload; staged shells already racked in stay loaded
    if (this.reloading > 0) this.cancelReload();
    this.slot = i;
    this.vmLift = -0.4;
    this.vmGroups.forEach((g, k) => (g.visible = k === i));
    this.sfx.reload(0);
  }

  private startReload() {
    const w = this.weapons[this.slot];
    if (this.reloading > 0 || w.mag >= w.def.magSize || w.reserve <= 0) return;
    this.staged = false;
    this.stagedLoaded = 0;
    if (w.def.kind === "shotgun") {
      // staged: open pump, one shell per cycle, final pump
      const n = Math.min(w.def.magSize - w.mag, w.reserve);
      this.staged = true;
      this.stagedTotal = n;
      this.reloading = RELOAD.OPEN_PUMP + n * RELOAD.SHELL_TIME + RELOAD.FINAL_PUMP;
    } else {
      this.reloading = w.def.reloadTime;
    }
    this.reloadTotal = this.reloading;
    this.sfx.reload(0);
  }

  /** Interrupt the in-progress reload. Ammo already loaded (staged shells) is kept. */
  private cancelReload() {
    this.reloading = 0;
    this.staged = false;
  }

  /* ================= flow ================= */
  start() {
    this.sfx.init();
    this.sfx.ambientStart();
    this.reset();
    this.screen = "playing";
    this.lastLockRequest = this.time;
    this.o.onUi({ screen: "playing", stats: null });
    this.requestLock();
  }

  private requestLock() {
    try {
      const p = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {}
  }

  relockIfPlaying() {
    if (this.screen === "playing" && document.pointerLockElement !== this.renderer.domElement) {
      this.lastLockRequest = this.time;
      this.requestLock();
    }
  }

  menuTick() {
    this.sfx.init();
    this.sfx.tick();
  }

  menuLineDone() {
    this.sfx.init();
    this.sfx.lineDone();
  }

  menuSlam() {
    this.sfx.init();
    this.sfx.slam();
  }

  private reset() {
    for (const e of [...this.enemies]) this.removeEnemy(e);
    this.enemies = [];
    for (const b of this.bullets) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const pk of this.pickups) {
      pk.active = false;
      const body = (pk as any).body as THREE.Mesh | undefined;
      if (body) {
        this.scene.remove(body);
        body.geometry.dispose();
        (body.material as THREE.Material).dispose();
        (pk as any).body = undefined;
      }
    }
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    this.popups.forEach((p) => p.el.remove());
    this.popups = [];
    this.o.fx.querySelectorAll(".fx-banner").forEach((n) => n.remove());
    const feed = this.o.fx.querySelector("#feed");
    if (feed) feed.innerHTML = "";

    this.pos.copy(this.world.playerStart);
    this.vel.set(0, 0, 0);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.hp = PLAYER.HP_MAX;
    this.focus = FOCUS.START;
    this.focusActive = false;
    this.timescale = 1;
    this.sliding = 0;
    this.weapons = WEAPONS.map((w) => ({ def: w, mag: w.magSize, reserve: w.reserveMax }));
    this.slot = 0;
    this.vmGroups.forEach((g, k) => (g.visible = k === 0));
    this.reloading = 0;
    this.staged = false;
    this.stagedLoaded = 0;
    this.stagedTotal = 0;
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.wave = 0;
    this.damageFlash = 0;
    this.shake = 0;
    this.startIntermission(WAVES.FIRST_DELAY, true);
  }

  pause() {
    if (this.screen !== "playing") return;
    this.screen = "paused";
    this.firing = false;
    this.wantFocus = false;
    this.extinguishFlash();
    document.exitPointerLock();
    this.o.onUi({ screen: "paused", stats: null });
  }

  private extinguishFlash() {
    this.muzzleT = 0;
    for (const f of this.muzzleFlashes) f.visible = false;
    this.muzzleLight.intensity = 0;
  }

  resume() {
    if (this.screen !== "paused") return;
    this.screen = "playing";
    this.lastLockRequest = this.time;
    this.o.onUi({ screen: "playing", stats: null });
    this.requestLock();
  }

  toMenu() {
    this.screen = "menu";
    this.menuIn = this.time;
    document.exitPointerLock();
    this.reset();
    const feed = this.o.fx.querySelector("#feed");
    if (feed) feed.innerHTML = "";
    this.ctx2d.clearRect(0, 0, this.o.overlay.width, this.o.overlay.height);
    this.o.onUi({ screen: "menu", stats: null });
  }

  private gameOver() {
    this.screen = "over";
    this.firing = false;
    this.wantFocus = false;
    this.focusActive = false;
    this.timescale = 1;
    this.o.wrap.classList.remove("focus-fx");
    this.o.wrap.classList.add("no-focus-fx");
    this.extinguishFlash();
    document.exitPointerLock();
    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      localStorage.setItem("bgv-best", String(this.best));
    }
    this.sfx.over();
    this.o.onUi({
      screen: "over",
      stats: {
        score: this.score,
        best: this.best,
        wave: this.wave,
        kills: this.kills,
        headshots: this.headshots,
        accuracy: this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0,
        newBest,
      },
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.hKeyDown);
    window.removeEventListener("keyup", this.hKeyUp);
    window.removeEventListener("mousemove", this.hMouseMove);
    window.removeEventListener("mousedown", this.hMouseDown);
    window.removeEventListener("mouseup", this.hMouseUp);
    window.removeEventListener("wheel", this.hWheel);
    window.removeEventListener("resize", this.hResize);
    window.removeEventListener("blur", this.hVis);
    document.removeEventListener("visibilitychange", this.hVis);
    document.removeEventListener("pointerlockchange", this.hLock);
    this.renderer.domElement.removeEventListener("contextmenu", this.hCtx);
    this.sfx.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ================= main tick ================= */
  private tick() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.time += dt;

    this.world.update(this.time, dt);
    this.weatherTick(dt);

    if (this.screen === "menu") {
      const t = this.time * 0.09;
      // cinematic dolly-in: crane up from deck level into the orbit
      const mt = Math.min(1, (this.time - this.menuIn) / 4.8);
      const ease = 1 - Math.pow(1 - mt, 3);
      const rad = 110 - 58 * ease;
      const h = 8.5 + 13.5 * ease + Math.sin(this.time * 0.13) * 3.5 * ease;
      this.camera.position.set(Math.cos(t) * rad - 4, h, Math.sin(t) * rad);
      this.camera.lookAt(-4, 11, 0);
      this.ambientFx(dt);
      this.stepFx(dt, dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.screen === "paused" || this.screen === "over") {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // pointer lock lost without pause (e.g. browser denied re-lock)
    if (document.pointerLockElement !== this.renderer.domElement && this.time - this.lastLockRequest > 1.2) {
      this.pause();
      return;
    }

    /* ---- focus / timescale ---- */
    const wantSlow = this.wantFocus && this.focus > 0;
    if (wantSlow && !this.focusActive) {
      this.focusActive = true;
      this.sfx.focus(true);
      this.o.wrap.classList.add("focus-fx");
      this.o.wrap.classList.remove("no-focus-fx");
    } else if (!wantSlow && this.focusActive) {
      this.focusActive = false;
      this.sfx.focus(false);
      this.o.wrap.classList.remove("focus-fx");
      this.o.wrap.classList.add("no-focus-fx");
    }
    if (this.focusActive) {
      this.focus = Math.max(0, this.focus - FOCUS.DRAIN * dt);
      if (this.focus <= 0) {
        this.focusActive = false;
        this.sfx.focus(false);
        this.o.wrap.classList.remove("focus-fx");
        this.o.wrap.classList.add("no-focus-fx");
      }
    } else {
      this.focus = Math.min(FOCUS.MAX, this.focus + FOCUS.REGEN * dt);
    }
    const tsTarget = this.focusActive ? FOCUS.TIME_SCALE : 1;
    this.timescale += (tsTarget - this.timescale) * Math.min(1, dt * 10);
    let sdt = dt * this.timescale;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      sdt = 0;
    }

    /* ---- player movement ---- */
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rightV = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let mx = 0;
    let mz = 0;
    if (this.keys.has("KeyW")) mz += 1;
    if (this.keys.has("KeyS")) mz -= 1;
    if (this.keys.has("KeyD")) mx += 1;
    if (this.keys.has("KeyA")) mx -= 1;
    const moveDir = fwd.clone().multiplyScalar(mz).addScaledVector(rightV, mx);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const sprinting = this.keys.has("ShiftLeft") && mz > 0 && this.sliding <= 0;
    this.sprinting = sprinting && moveDir.lengthSq() > 0;
    let speed = sprinting ? PLAYER.SPRINT : PLAYER.WALK;
    if (this.focusActive) speed *= PLAYER.FOCUS_SPEED_MULT;

    // slide
    this.slideCd -= dt;
    if ((this.keys.has("KeyC") || this.keys.has("ControlLeft")) && sprinting && this.sliding <= 0 && this.slideCd <= 0 && this.onGround) {
      this.sliding = PLAYER.SLIDE_TIME;
      this.slideCd = PLAYER.SLIDE_CD;
      this.vel.x = moveDir.x * PLAYER.SLIDE_BOOST;
      this.vel.z = moveDir.z * PLAYER.SLIDE_BOOST;
      this.sfx.slide();
      this.shake = Math.min(1, this.shake + 0.25);
    }
    if (this.sliding > 0) {
      this.sliding -= dt;
      this.vel.x *= 1 - dt * PLAYER.SLIDE_DRAG;
      this.vel.z *= 1 - dt * PLAYER.SLIDE_DRAG;
      this.eyeTarget = PLAYER.EYE_SLIDE;
    } else {
      const accel = this.onGround ? PLAYER.GROUND_ACCEL : PLAYER.AIR_ACCEL;
      this.vel.x += (moveDir.x * speed - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (moveDir.z * speed - this.vel.z) * Math.min(1, dt * accel);
      this.eyeTarget = PLAYER.EYE_STAND;
    }

    // jump + gravity
    if (this.keys.has("Space") && this.onGround) {
      this.vel.y = PLAYER.JUMP_V;
      this.onGround = false;
      this.sfx.jump();
    }
    if (!this.onGround) {
      this.vel.y -= PLAYER.GRAVITY * dt;
    }
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= DECK_Y) {
      if (!this.onGround && this.vel.y < PLAYER.LAND_SFX_FALL) {
        this.sfx.land();
        this.pitchKick -= PLAYER.LAND_DIP * Math.min(1.6, -this.vel.y / 8);
        this.shake = Math.min(1, this.shake + 0.08);
      }
      this.pos.y = DECK_Y;
      this.vel.y = 0;
      this.onGround = true;
    }

    resolveColliders(this.pos, PLAYER.RADIUS, this.world.colliders);
    clampToBounds(this.pos, PLAYER.RADIUS, this.world.boundaryRects);
    this.eye += (this.eyeTarget - this.eye) * Math.min(1, dt * 12);

    // footsteps + bob
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 1.5) {
      this.bobPhase += hSpeed * dt * 1.7;
      this.stepDist += hSpeed * dt;
      if (this.stepDist > 2.6) {
        this.stepDist = 0;
        this.sfx.step();
      }
    }

    // camera
    this.pitchKick *= 1 - Math.min(1, dt * 12);
    this.rollKick *= 1 - Math.min(1, dt * 10);
    const bobAmp = this.sliding > 0 ? 0.012 : Math.min(0.045, hSpeed * 0.006);
    this.camera.position.set(
      this.pos.x,
      this.pos.y + this.eye + Math.sin(this.bobPhase * 2) * bobAmp,
      this.pos.z
    );
    this.camera.rotation.set(this.pitch + this.pitchKick + Math.sin(this.bobPhase) * 0.006, this.yaw, this.rollKick);
    this.fovPunch *= 1 - Math.min(1, dt * 11);
    const fovT =
      (this.focusActive ? FOCUS.FOV : FOCUS.FOV_NORMAL) +
      (this.sprinting && !this.focusActive ? PLAYER.SPRINT_FOV : 0) -
      this.fovPunch * RECOIL.FOV_PUNCH_DEG;
    this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 14);
    this.camera.updateProjectionMatrix();

    /* ---- weapons ---- */
    this.fireCd -= dt;
    this.bloom *= 1 - Math.min(1, dt * BLOOM.RECOVERY);
    this.vmRecoil *= 1 - Math.min(1, dt * 11);
    this.vmLift += (0 - this.vmLift) * Math.min(1, dt * 10);
    this.muzzleT -= dt;
    for (const f of this.muzzleFlashes) f.visible = this.muzzleT > 0;
    this.muzzleLight.intensity *= 1 - Math.min(1, dt * 26);
    this.hitT -= dt;
    this.killT -= dt;
    if (this.reloading > 0) {
      const prev = this.reloading;
      this.reloading -= dt;
      const w = this.weapons[this.slot];
      if (this.staged) {
        // each shell racks in OPEN_PUMP + i * SHELL_TIME into the reload
        const elapsed = this.reloadTotal - this.reloading;
        const want = Math.min(
          this.stagedTotal,
          Math.max(0, Math.floor((elapsed - RELOAD.OPEN_PUMP) / RELOAD.SHELL_TIME) + 1)
        );
        while (this.stagedLoaded < want && w.reserve > 0) {
          this.stagedLoaded++;
          w.mag++;
          w.reserve--;
          this.sfx.slide();
        }
      } else if (prev > this.reloadTotal * 0.45 && this.reloading <= this.reloadTotal * 0.45) {
        this.sfx.reload(1);
      }
      if (this.reloading <= 0) {
        if (this.staged) this.sfx.slide(); // final pump
        else {
          const need = w.def.magSize - w.mag;
          const take = Math.min(need, w.reserve);
          w.mag += take;
          w.reserve -= take;
        }
        this.staged = false;
        this.reloading = 0;
      }
    }
    const vm = this.vmGroups[this.slot];
    if (vm) {
      const base = this.vmBase[this.slot];
      vm.position.set(
        base.x + Math.sin(this.bobPhase) * 0.008,
        base.y + Math.cos(this.bobPhase * 2) * 0.008 + this.vmLift - (this.reloading > 0 ? 0.12 * Math.sin((1 - this.reloading / this.reloadTotal) * Math.PI) : 0),
        base.z + this.vmRecoil
      );
      vm.rotation.x = (this.reloading > 0 ? 0.5 * Math.sin((1 - this.reloading / this.reloadTotal) * Math.PI) : 0) + this.vmRecoil * 1.4;
    }
    if (this.firing) this.tryFire();

    /* ---- enemies ---- */
    for (const e of [...this.enemies]) this.updateEnemy(e, sdt);
    // separation
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        if (a.state === "dying" || b.state === "dying") continue;
        const dx = b.group.position.x - a.group.position.x;
        const dz = b.group.position.z - a.group.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.4 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = ((1.18 - d) / d) * 0.5;
          a.group.position.x -= dx * push;
          a.group.position.z -= dz * push;
          b.group.position.x += dx * push;
          b.group.position.z += dz * push;
        }
      }
    }

    /* ---- bullets ---- */
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.life -= sdt;
      b.mesh.position.addScaledVector(b.vel, sdt);
      const playerC = new THREE.Vector3(this.pos.x, DECK_Y + 1.1, this.pos.z);
      if (b.mesh.position.distanceTo(playerC) < 0.62) {
        b.active = false;
        b.mesh.visible = false;
        this.damagePlayer(b.dmg);
        continue;
      }
      if (b.life <= 0 || b.mesh.position.y < 0.2) {
        b.active = false;
        b.mesh.visible = false;
      }
    }

    /* ---- pickups ---- */
    for (const pk of this.pickups) {
      if (!pk.active) continue;
      const body = (pk as any).body as THREE.Mesh;
      pk.life -= sdt;
      body.rotation.y += sdt * 2.4;
      body.position.y = DECK_Y + 0.75 + Math.sin(this.time * 3 + body.position.x) * 0.12;
      const fade = Math.min(1, pk.life / 2);
      (body.material as THREE.MeshToonMaterial).emissiveIntensity = 0.9 * fade + Math.sin(this.time * 6) * 0.2;
      body.scale.setScalar(Math.max(0.01, fade));
      if (pk.life <= 0) {
        this.scene.remove(body);
        body.geometry.dispose();
        (body.material as THREE.Material).dispose();
        (pk as any).body = undefined;
        pk.active = false;
        continue;
      }
      if (this.pos.distanceTo(body.position) < 1.6) {
        this.sfx.pickup();
        if (pk.kind === "ammo") {
          for (const w of this.weapons) w.reserve = Math.min(w.def.reserveMax, w.reserve + Math.round(w.def.reserveMax * KILL.AMMO_REFILL));
          this.popup(body.position.clone(), "AMMO CACHE", "text-amber");
        } else if (pk.kind === "med") {
          this.hp = Math.min(PLAYER.HP_MAX, this.hp + KILL.PICKUP_HP);
          this.popup(body.position.clone(), `+${KILL.PICKUP_HP} HP`, "text-blood");
        } else {
          this.focus = Math.min(FOCUS.MAX, this.focus + KILL.PICKUP_FOCUS);
          this.popup(body.position.clone(), `FOCUS +${KILL.PICKUP_FOCUS}`, "text-tide");
        }
        this.burst(body.position.clone(), 0xffd98a, 10, 2.4, 0.4, 4, 0.06);
        this.scene.remove(body);
        body.geometry.dispose();
        (body.material as THREE.Material).dispose();
        (pk as any).body = undefined;
        pk.active = false;
      }
    }

    this.stepFx(sdt, dt);
    this.boomTick(sdt);
    this.heliTick(sdt, dt);
    this.illumTick(dt);

    // alarm beacon pulses while hostiles are on the deck
    const beacon = this.world.beacon;
    const alarmed = this.waveState === "combat";
    beacon.light.intensity = alarmed ? 30 * (0.55 + 0.45 * Math.sin(this.time * 7)) : 0;
    beacon.mat.emissiveIntensity = alarmed ? 1.6 + Math.sin(this.time * 7) * 0.8 : 0.15;

    this.waveTick(sdt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;

    // hp regen
    if (this.time - this.lastDamageT > PLAYER.REGEN_DELAY && this.hp > 0) {
      this.hp = Math.min(PLAYER.HP_MAX, this.hp + PLAYER.REGEN_RATE * dt);
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    this.o.vignette.style.opacity = String(this.damageFlash * 0.85);
    this.ambientFx(sdt);

    /* ---- shake ---- */
    this.shake = Math.max(0, this.shake - dt * 3.2);
    const sAmp = this.shake * this.shake * 7;
    this.o.wrap.style.transform = `translate(${(Math.random() - 0.5) * sAmp}px, ${(Math.random() - 0.5) * sAmp}px)`;

    /* ---- popups project ---- */
    const w = this.o.mount.clientWidth;
    const h = this.o.mount.clientHeight;
    for (const p of this.popups) {
      const v = p.pos.clone().project(this.camera);
      if (v.z > 1) {
        p.el.style.display = "none";
        continue;
      }
      p.el.style.display = "";
      p.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      p.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    }

    this.drawOverlay();
    this.renderer.render(this.scene, this.camera);

    /* ---- hud ---- */
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.pushHud();
    }
  }

  private spawnDecal(at: THREE.Vector3) {
    let d = this.decals.find((x) => !x.active);
    if (!d) d = this.decals.reduce((a, b) => (a.life < b.life ? a : b));
    d.active = true;
    d.life = KILL.DECAL_LIFE;
    d.mesh.visible = true;
    d.mesh.position.set(at.x + (Math.random() - 0.5) * 0.6, DECK_Y + 0.035, at.z + (Math.random() - 0.5) * 0.6);
    d.mesh.rotation.z = Math.random() * Math.PI;
    const s = 0.55 + Math.random() * 0.75;
    d.mesh.scale.set(s * (0.8 + Math.random() * 0.5), s, 1);
    d.mat.opacity = 0.8;
  }

  /* ================= fuel drums ================= */
  private damageBarrel(bid: number, dmg: number) {
    const b = this.world.barrels[bid];
    if (!b || !b.alive) return;
    b.hp -= dmg;
    if (b.hp > 0) {
      this.burst(b.pos.clone().setY(DECK_Y + 1), PAL.SPARK, 4, 3, 0.3, 8, 0.05);
      return;
    }
    b.alive = false;
    b.group.visible = false;
    this.booms.push({ pos: b.pos.clone(), t: 0 });
  }

  private explodeBarrel(at: THREE.Vector3) {
    this.sfx.boom();
    this.shake = Math.min(1.6, this.shake + 1.15);
    this.fovPunch = 1;
    this.burst(at.clone().setY(DECK_Y + 0.8), PAL.EMBER, 26, 8, 0.7, 7, 0.11);
    this.burst(at.clone().setY(DECK_Y + 1), PAL.SPARK, 18, 10, 0.5, 9, 0.05);
    this.burst(at.clone().setY(DECK_Y + 1.4), PAL.SMOKE_DARK, 16, 3.4, 1.7, -2.4, 0.24);
    // scorch mark
    let d = this.decals.find((x) => !x.active);
    if (!d) d = this.decals.reduce((a, c) => (a.life < c.life ? a : c));
    d.active = true;
    d.life = 20;
    d.mesh.visible = true;
    d.mesh.position.set(at.x, DECK_Y + 0.04, at.z);
    d.mesh.rotation.z = Math.random() * Math.PI;
    const s = 1.6 + Math.random() * 0.8;
    d.mesh.scale.set(s, s, 1);
    d.mat.color.setHex(PAL.SCORCH);
    d.mat.opacity = 0.85;
    // radial damage
    for (const e of this.enemies) {
      if (e.state === "dying") continue;
      const dist = e.group.position.distanceTo(at);
      if (dist < BARREL.RADIUS) {
        const dmg = BARREL.DMG * (1 - dist / BARREL.RADIUS);
        this.hitEnemy(e, dmg, false, e.group.position.clone().setY(DECK_Y + 1.2));
      }
    }
    const pd = this.pos.distanceTo(at);
    if (pd < BARREL.PLAYER_RADIUS) this.damagePlayer(BARREL.PLAYER_DMG * (1 - pd / BARREL.PLAYER_RADIUS));
    else if (pd < BARREL.RADIUS) this.shake = Math.min(1.6, this.shake + 0.4);
    this.popup(at.clone().setY(DECK_Y + 2.6), "FUEL DRUM", "text-ember");
    // chain reaction
    for (const ob of this.world.barrels) {
      if (!ob.alive) continue;
      if (ob.pos.distanceTo(at) < BARREL.CHAIN_RADIUS) this.booms.push({ pos: ob.pos.clone(), t: BARREL.CHAIN_DELAY });
    }
  }

  private boomTick(sdt: number) {
    for (let i = this.booms.length - 1; i >= 0; i--) {
      this.booms[i].t -= sdt;
      if (this.booms[i].t <= 0) {
        const p = this.booms[i].pos;
        this.booms.splice(i, 1);
        this.explodeBarrel(p);
      }
    }
  }

  /* ================= gunship ================= */
  private startHeli() {
    this.heliActive = true;
    this.heliT = 0;
    this.heliA0 = Math.random() * Math.PI * 2;
    this.heliDrops = [...HELI.DROPS];
    this.heli.visible = true;
    this.sfx.heliStart();
    this.feed("SENSOR ▸ GUNSHIP INBOUND");
  }

  private heliPos(t: number, out: THREE.Vector3) {
    const R = HELI.ORBIT_R;
    const H = HELI.HEIGHT;
    if (t < 0.2) {
      const k = t / 0.2;
      const a = this.heliA0;
      out.set(Math.cos(a) * (150 - 92 * k), 46 - 16 * k, Math.sin(a) * (150 - 92 * k));
    } else if (t < 0.85) {
      const k = (t - 0.2) / 0.65;
      const a = this.heliA0 + k * Math.PI * 1.6;
      out.set(Math.cos(a) * R, H + Math.sin(k * Math.PI * 3) * 2.5, Math.sin(a) * R);
    } else {
      const k = (t - 0.85) / 0.15;
      const a = this.heliA0 + Math.PI * 1.6;
      out.set(Math.cos(a) * (R + 100 * k), H + 26 * k, Math.sin(a) * (R + 100 * k));
    }
    return out;
  }

  private heliTick(sdt: number, dt: number) {
    this.heliRotor.rotation.y += dt * 42;
    this.heliTailRotor.rotation.x += dt * 60;
    if (!this.heliActive) {
      if (this.waveState === "combat") {
        this.heliCool -= sdt;
        if (this.heliCool <= 0) this.startHeli();
      }
      return;
    }
    this.heliT += sdt / HELI.DUR;
    const t = this.heliT;
    const p = this.heliPos(Math.min(t, 1), new THREE.Vector3());
    const ahead = this.heliPos(Math.min(t + 0.012, 1), new THREE.Vector3());
    this.heli.position.copy(p);
    this.heli.lookAt(ahead);
    this.heli.rotation.z += Math.sin(this.time * 1.7) * 0.05;
    // searchlight sweeps the deck under the gunship
    this.heliSpotTarget.position.set(p.x * 0.35 + Math.sin(this.time * 0.9) * 12, DECK_Y, p.z * 0.35 + Math.cos(this.time * 0.7) * 12);
    const overRig = t > 0.2 && t < 0.85;
    this.heliSpot.intensity = overRig ? 260 : 0;
    (this.heliCone.material as THREE.MeshBasicMaterial).opacity = overRig ? 0.07 : 0;
    // fast-rope drops while orbiting
    if (overRig && this.heliDrops.length && t >= this.heliDrops[0]) {
      this.heliDrops.shift();
      const types: EnemyType[] = ["thug", "rusher"];
      const en = this.makeEnemy(types[Math.floor(Math.random() * types.length)], this.pickSpawn());
      if (en) {
        this.popup(en.group.position.clone().setY(DECK_Y + 2.4), "FAST-ROPE DROP", "text-tide");
        this.feed("GUNSHIP ▸ DROP TEAM ON DECK");
      }
    }
    if (t >= 1) {
      this.heliActive = false;
      this.heli.visible = false;
      this.heliSpot.intensity = 0;
      this.heliCool = HELI.EVERY * (0.8 + Math.random() * 0.4);
      this.sfx.heliStop();
    }
  }

  /* ================= illumination flares ================= */
  private launchIllum() {
    const il = this.illums.find((x) => !x.active);
    if (!il) return;
    const a = Math.random() * Math.PI * 2;
    il.a.set(Math.cos(a) * 130, 24, Math.sin(a) * 130);
    il.b.set(Math.cos(a + Math.PI) * 130, 20, Math.sin(a + Math.PI) * 130);
    il.t = 0;
    il.active = true;
    il.mesh.visible = true;
  }

  private illumTick(dt: number) {
    this.illumT -= dt;
    if (this.illumT <= 0) {
      this.illumT = ILLUM.MIN + Math.random() * (ILLUM.MAX - ILLUM.MIN);
      this.launchIllum();
    }
    let glow = 0;
    for (const il of this.illums) {
      if (!il.active) continue;
      il.t += dt / ILLUM.DUR;
      if (il.t >= 1) {
        il.active = false;
        il.mesh.visible = false;
        il.light.intensity = 0;
        continue;
      }
      const k = il.t;
      const arc = Math.sin(k * Math.PI);
      il.mesh.position.lerpVectors(il.a, il.b, k);
      il.mesh.position.y += arc * ILLUM.HEIGHT;
      (il.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + arc * 0.65;
      il.light.intensity = 900 * arc;
      glow = Math.max(glow, arc);
      if (Math.random() < dt * 26) {
        this.burst(il.mesh.position.clone(), 0xffe2b0, 1, 0.6, 0.9, 1.4, 0.12);
      }
    }
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) fog.color.lerp(new THREE.Color(0x6a4a38), glow * 0.35);
  }

  /* ================= weather ================= */
  private weatherTick(dt: number) {
    if (this.wxT < 1) {
      this.wxT = Math.min(1, this.wxT + dt / WEATHER_CYCLE.BLEND);
      blendWxState(this.wxA, this.wxB, this.wxS, this.wxT);
    } else {
      this.wxHold -= dt;
      if (this.wxHold <= 0) this.wxRetarget();
    }
    // lightning
    if (this.lightningT > 0) this.lightningT = Math.max(0, this.lightningT - dt * 2.6);
    if (this.wxS.lightning > 0.01) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = (60 / this.wxS.lightning) * (0.4 + Math.random() * 1.2);
        this.lightningT = 1;
        const far = Math.random();
        this.sfx.thunder(1 - far * 0.55, far * 1.6);
      }
    } else if (this.wxT >= 1) {
      this.lightningTimer = Math.max(this.lightningTimer, 4);
    }
    this.wxS.flash =
      this.lightningT > 0 ? this.lightningT * (0.5 + 0.5 * Math.abs(Math.sin(this.time * 43))) * 0.55 : 0;
    this.world.applyWeather(this.wxS);
    this.sfx.setRain(this.wxS.rain);
    this.sfx.setWind(this.wxS.wind);
    this.updateRain(dt);
  }

  private wxRetarget() {
    copyWxState(this.wxA, this.wxS);
    let idx = this.wxIndex;
    while (idx === this.wxIndex) idx = Math.floor(Math.random() * WEATHER.length);
    this.wxIndex = idx;
    this.wxB = makeWxState(WEATHER[idx]);
    this.wxT = 0;
    this.wxHold = WEATHER_CYCLE.HOLD_MIN + Math.random() * (WEATHER_CYCLE.HOLD_MAX - WEATHER_CYCLE.HOLD_MIN);
    if (this.screen === "playing") this.banner(`WEATHER ▸ ${WEATHER[idx].name}`, "text-tide");
  }

  private updateRain(dt: number) {
    const inten = this.wxS.rain;
    this.rainMat.opacity = inten * 0.3;
    if (inten < 0.03) {
      for (const r of this.rain) r.mesh.visible = false;
      return;
    }
    const fall = 36 + inten * 18;
    const windX = -(8 + this.wxS.wind * 18);
    const cam = this.camera.position;
    for (const r of this.rain) {
      if (!r.mesh.visible) {
        r.mesh.visible = true;
        r.mesh.position.set(
          cam.x + (Math.random() - 0.5) * 74,
          cam.y + 16 + Math.random() * 26,
          cam.z + (Math.random() - 0.5) * 74
        );
      }
      r.mesh.position.y -= fall * dt;
      r.mesh.position.x += windX * dt;
      if (r.mesh.position.y < DECK_Y - 3) {
        r.mesh.position.set(
          cam.x + (Math.random() - 0.5) * 74,
          cam.y + 20 + Math.random() * 22,
          cam.z + (Math.random() - 0.5) * 74
        );
      }
    }
  }

  private ambientFx(dt: number) {
    // flare embers
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = 0.12;
      const tip = this.world.flareTip;
      this.burst(tip.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1, (Math.random() - 0.5) * 0.4)), Math.random() > 0.5 ? 0xffb03a : 0xff6a2a, 1, 1.6, 0.9, -2.2, 0.07);
    }
  }

  private stepFx(sdt: number, dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= sdt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.grav * sdt;
      p.mesh.position.addScaledVector(p.vel, sdt);
      if (p.mesh.position.y < DECK_Y + 0.03 && p.vel.y < 0) {
        p.mesh.position.y = DECK_Y + 0.03;
        p.vel.y *= -0.4;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      p.mesh.rotation.x += p.spin.x * sdt;
      p.mesh.rotation.y += p.spin.y * sdt;
      p.mat.opacity = Math.min(1, (p.life / p.maxLife) * 1.6);
    }
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.life -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
      }
    }
    for (const sh of this.shells) {
      if (!sh.active) continue;
      sh.life -= sdt;
      sh.vel.y -= 14 * sdt;
      sh.mesh.position.addScaledVector(sh.vel, sdt);
      sh.mesh.rotation.x += sh.rot.x * sdt;
      sh.mesh.rotation.z += sh.rot.z * sdt;
      if (sh.mesh.position.y < DECK_Y + 0.05) {
        sh.mesh.position.y = DECK_Y + 0.05;
        sh.vel.set(0, 0, 0);
        sh.rot.multiplyScalar(0.9);
      }
      if (sh.life < 0.8) (sh.mesh.material as THREE.MeshToonMaterial).transparent = true;
      if (sh.life <= 0) {
        sh.active = false;
        sh.mesh.visible = false;
      }
    }
    for (const d of this.decals) {
      if (!d.active) continue;
      d.life -= sdt;
      if (d.life <= 0) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.mat.opacity = Math.min(0.8, d.life * 0.3);
    }
  }

  private drawOverlay() {
    const c = this.ctx2d;
    const W = this.o.overlay.width;
    const H = this.o.overlay.height;
    const dpr = W / (this.o.mount.clientWidth || 1);
    c.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    c.save();
    c.scale(1, 1);
    const gap = (BLOOM.CROSSHAIR_GAP + this.bloom * BLOOM.CROSSHAIR_SCALE) * dpr;
    const len = 11 * dpr;
    c.lineWidth = 2 * dpr;
    c.strokeStyle = this.focusActive ? "rgba(47,230,176,0.95)" : "rgba(239,230,212,0.92)";
    c.shadowColor = "rgba(0,0,0,0.8)";
    c.shadowBlur = 4 * dpr;
    c.beginPath();
    c.moveTo(cx - gap - len, cy);
    c.lineTo(cx - gap, cy);
    c.moveTo(cx + gap, cy);
    c.lineTo(cx + gap + len, cy);
    c.moveTo(cx, cy - gap - len);
    c.lineTo(cx, cy - gap);
    c.moveTo(cx, cy + gap);
    c.lineTo(cx, cy + gap + len);
    c.stroke();
    c.fillStyle = c.strokeStyle;
    c.fillRect(cx - dpr, cy - dpr, 2 * dpr, 2 * dpr);

    // hitmarker
    if (this.hitT > 0 || this.killT > 0) {
      const kill = this.killT > 0;
      const a = kill ? this.killT / 0.2 : this.hitT / 0.13;
      c.strokeStyle = kill ? `rgba(255,36,56,${a})` : `rgba(255,210,63,${a})`;
      c.lineWidth = (kill ? 3.4 : 2.4) * dpr;
      const r1 = 7 * dpr;
      const r2 = (kill ? 15 : 12) * dpr;
      c.beginPath();
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        c.moveTo(cx + sx * r1, cy + sy * r1);
        c.lineTo(cx + sx * r2, cy + sy * r2);
      }
      c.stroke();
    }

    // reload ring
    if (this.reloading > 0) {
      const frac = 1 - this.reloading / this.reloadTotal;
      c.strokeStyle = "rgba(255,176,58,0.9)";
      c.lineWidth = 3 * dpr;
      c.beginPath();
      c.arc(cx, cy, 26 * dpr, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      c.stroke();
    }
    // focus ring
    if (this.focusActive) {
      c.strokeStyle = "rgba(47,230,176,0.8)";
      c.lineWidth = 2.4 * dpr;
      c.beginPath();
      c.arc(cx, cy, 34 * dpr, -Math.PI / 2, -Math.PI / 2 + (this.focus / 100) * Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  private pushHud() {
    const w = this.weapons[this.slot];
    const enemiesLeft = this.enemies.filter((e) => e.state !== "dying").length + this.spawnQueue.length;
    this.o.onHud({
      hp: Math.ceil(this.hp),
      focus: Math.round(this.focus),
      focusActive: this.focusActive,
      weaponName: w.def.name,
      slot: this.slot,
      mag: w.mag,
      magSize: w.def.magSize,
      reserve: w.reserve,
      reloading: this.reloading > 0,
      lowAmmo: w.mag <= Math.ceil(w.def.magSize * 0.25),
      score: this.score,
      best: this.best,
      combo: this.combo,
      comboFrac: Math.max(0, this.comboT / KILL.COMBO_WINDOW),
      wave: this.wave,
      enemiesLeft,
      waveState: this.waveState,
      kills: this.kills,
      weather: this.wxS.name,
    });
  }
}



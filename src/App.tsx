import { useEffect, useRef, useState } from "react";
import { Game, type HudData, type UiState } from "./game/game";
import { PERKS, PERK_UI, type PerkDef } from "./game/config";

const DEFAULT_HUD: HudData = {
  hp: 100,
  focus: 60,
  focusActive: false,
  weaponName: "WIDOW-9",
  slot: 0,
  mag: 12,
  magSize: 12,
  reserve: 84,
  reloading: false,
  lowAmmo: false,
  score: 0,
  best: 0,
  combo: 0,
  comboFrac: 0,
  wave: 0,
  enemiesLeft: 0,
  waveState: "interm",
  kills: 0,
  weather: "LEADEN SKY",
  perkChoices: [],
  ownedPerks: {},
  unlocked: [true, false, false, false, false, false],
  perkLockT: 0,
};

const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

const PERK_TAG_CLS: Record<string, string> = {
  WEAPON: "border-amber/60 text-amber",
  OFFENSE: "border-blood/60 text-blood",
  DEFENSE: "border-tide/60 text-tide",
  MOBILITY: "border-hazard/60 text-hazard",
  FOCUS: "border-tide/60 text-tide",
  ABILITY: "border-ember/60 text-ember",
};

function PerkIcon({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      {icon === "smg" && (
        <>
          <path d="M3 9h15v4h-4l-1 3h-3l-1-3H3z" />
          <path d="M18 10h3v2h-3" />
          <path d="M9 16v3" />
        </>
      )}
      {icon === "shotgun" && (
        <>
          <path d="M2 10h20v3h-9l-2 3h-3l1-3H2z" />
          <path d="M10 7h8" />
        </>
      )}
      {icon === "lmg" && (
        <>
          <path d="M2 9h17v4h-5l-2 4h-3l1-4H2z" />
          <path d="M19 10h3v2h-3" />
          <path d="M8 13v4M12 13v3" />
          <path d="M6 6h9" />
        </>
      )}
      {icon === "sniper" && (
        <>
          <path d="M2 11h20v2.5h-8l-1.5 3.5h-3L11 13.5H2z" />
          <circle cx="16" cy="8" r="2.2" />
          <path d="M16 10.2V12M2 8h5" />
        </>
      )}
      {icon === "revolver" && (
        <>
          <circle cx="13" cy="10" r="3" />
          <circle cx="13" cy="10" r="0.8" fill="currentColor" stroke="none" />
          <path d="M13 7h8v3h-4l-1 2h-3z" />
          <path d="M9 11.5c-2 1-3 3.5-2.5 6.5 2.5.5 5-1 5.5-4" />
        </>
      )}
      {icon === "crosshair" && (
        <>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </>
      )}
      {icon === "skull" && (
        <>
          <path d="M12 3a7 7 0 0 0-7 7c0 3 2 4.5 2 6.5V19h10v-2.5c0-2 2-3.5 2-6.5a7 7 0 0 0-7-7z" />
          <circle cx="9.5" cy="11" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="11" r="1.4" fill="currentColor" stroke="none" />
          <path d="M10 19v2M14 19v2" />
        </>
      )}
      {icon === "reload" && (
        <>
          <path d="M20 12a8 8 0 1 1-2.3-5.6" />
          <path d="M18 2v4.5h-4.5" />
        </>
      )}
      {icon === "mag" && (
        <>
          <path d="M7 4h10v13l-3 3H7z" />
          <path d="M10 8h4M10 12h4" />
        </>
      )}
      {icon === "shield" && <path d="M12 3l7 3v6c0 5-3.5 7.8-7 9-3.5-1.2-7-4-7-9V6z" />}
      {icon === "armor" && (
        <>
          <path d="M12 3l7 3v6c0 5-3.5 7.8-7 9-3.5-1.2-7-4-7-9V6z" />
          <path d="M12 8v6M9 11h6" />
        </>
      )}
      {icon === "heart" && <path d="M12 20s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z" />}
      {icon === "boot" && (
        <>
          <path d="M6 4h5v8h5a4 4 0 0 1 4 4v2H6z" />
          <path d="M6 15h5" />
        </>
      )}
      {icon === "eye" && (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
      {icon === "clock" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3.5 2" />
        </>
      )}
      {icon === "bolt" && <path d="M13 2L5 13h5l-1 9 8-11h-5z" />}
      {icon === "fang" && (
        <>
          <path d="M7 5c0 8 2 13 3.5 15C12 18 13 14 13 10" />
          <path d="M13 10c0 4 1 8 2.5 10C17 18 18 13 18 5" />
          <path d="M7 5h11" />
        </>
      )}
      {icon === "target" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </>
      )}
      {icon === "crate" && (
        <>
          <rect x="4" y="6" width="16" height="13" />
          <path d="M4 6l16 13M20 6L4 19" />
        </>
      )}
      {icon === "lock" && (
        <>
          <rect x="6" y="11" width="12" height="9" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" />
        </>
      )}
    </svg>
  );
}

const WEAPON_LIST = [
  { slot: "1", name: "WIDOW-9", role: "SIDEARM", dmg: 82, rof: 42, ctl: 88, locked: false },
  { slot: "2", name: "HORNET", role: "SMG", dmg: 38, rof: 92, ctl: 56, locked: true },
  { slot: "3", name: "MAUL-12", role: "SHOTGUN", dmg: 96, rof: 18, ctl: 40, locked: true },
  { slot: "4", name: "BOAR-7", role: "LMG", dmg: 70, rof: 78, ctl: 30, locked: true },
  { slot: "5", name: "REAPER-7", role: "SNIPER", dmg: 100, rof: 8, ctl: 72, locked: true },
  { slot: "6", name: "MAMBA-6", role: "REVOLVER", dmg: 88, rof: 28, ctl: 60, locked: true },
];

const CONTROLS: [string, string][] = [
  ["W A S D", "MOVE"],
  ["MOUSE", "AIM / LOOK"],
  ["LMB", "FIRE"],
  ["RMB HOLD", "FOCUS — BULLET TIME"],
  ["SHIFT", "SPRINT"],
  ["C / CTRL", "SLIDE (while sprinting)"],
  ["SPACE", "JUMP"],
  ["R", "RELOAD"],
  ["1 2 3 / WHEEL", "SWAP WEAPON"],
  ["P / ESC", "PAUSE"],
];

function Bar({ v, max, cls, pulse }: { v: number; max: number; cls: string; pulse?: boolean }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="h-2.5 w-full bg-ink/90 border border-line/70 skew-x-[-12deg] overflow-hidden">
      <div
        className={`h-full ${cls} ${pulse ? "pulse-glow" : ""}`}
        style={{ width: `${pct}%`, transition: "width 0.15s linear" }}
      />
    </div>
  );
}

function StatBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-semibold tracking-widest text-dim">{label}</span>
      <div className="h-1.5 flex-1 bg-ink border border-line/50">
        <div className="h-full bg-amber/80" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SkullIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5.4 4 6.9V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.1c2.4-1.5 4-3.9 4-6.9a8 8 0 0 0-8-8Zm-3.5 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM12 14l1.2 2.5h-2.4L12 14Z" />
    </svg>
  );
}

const BOOT_LINES = [
  { pre: "UPLINK TO PLATFORM K-9", status: "ONLINE", cls: "text-tide" },
  { pre: "PERIMETER SENSOR GRID", status: "BREACHED", cls: "text-blood" },
  { pre: "CREW MANIFEST", status: "0 SURVIVORS", cls: "text-blood" },
  { pre: "WEAPON CACHE", status: "UNLOCKED", cls: "text-amber" },
  { pre: "CONTRACT VALUE", status: "$1,400,000", cls: "text-hazard" },
];
const BOOT_CUM = BOOT_LINES.map((_, i) => BOOT_LINES.slice(0, i).reduce((a, l) => a + l.pre.length, 0));
const BOOT_TOTAL = BOOT_LINES.reduce((a, l) => a + l.pre.length, 0);

function BootOverlay({
  onDone,
  onTick,
  onLine,
  onSlam,
}: {
  onDone: () => void;
  onTick: () => void;
  onLine: () => void;
  onSlam: () => void;
}) {
  const typedRef = useRef(0);
  const coolRef = useRef(12);
  const [, force] = useState(0);
  const [exiting, setExiting] = useState(false);
  const typed = typedRef.current;
  const isDone = typed >= BOOT_TOTAL;

  useEffect(() => {
    const iv = setInterval(() => {
      if (typedRef.current >= BOOT_TOTAL) return;
      if (coolRef.current > 0) {
        coolRef.current--;
        force((x) => x + 1);
        return;
      }
      const prev = typedRef.current;
      typedRef.current = Math.min(BOOT_TOTAL, prev + (Math.random() < 0.35 ? 2 : 1));
      let hitLine = false;
      for (let i = 0; i < BOOT_LINES.length; i++) {
        const end = BOOT_CUM[i] + BOOT_LINES[i].pre.length;
        if (prev < end && typedRef.current >= end) {
          coolRef.current = 9;
          hitLine = true;
          onLine();
          break;
        }
      }
      if (!hitLine && typedRef.current % 3 === 0) onTick();
      force((x) => x + 1);
    }, 24);
    return () => clearInterval(iv);
  }, [onLine, onTick]);

  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(() => {
      onSlam();
      setExiting(true);
    }, 720);
    return () => clearTimeout(t);
  }, [isDone, onSlam]);

  const skip = () => {
    if (typedRef.current < BOOT_TOTAL) {
      typedRef.current = BOOT_TOTAL;
      force((x) => x + 1);
    }
  };

  return (
    <div
      className={`absolute inset-0 z-[95] cursor-pointer select-none overflow-hidden bg-[rgba(2,8,11,0.8)] backdrop-blur-[2px] font-mono ${exiting ? "boot-exit" : ""}`}
      onClick={skip}
      onAnimationEnd={exiting ? onDone : undefined}
    >
      <div className="boot-scan" />
      <div className="scanlines absolute inset-0 opacity-70" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[640px] max-w-[92vw]">
          <div className="mb-6 flex items-center justify-between border-b border-line/40 pb-2.5">
            <span className="text-[11px] font-bold tracking-[0.3em] text-dim">K-9 PLATFORM OS · NIGHT BUILD 4.7.1</span>
            <span className="clip-tag border border-ember/50 bg-ink px-2 py-0.5 text-[10px] font-bold tracking-[0.25em] text-ember">
              SECURE CHANNEL
            </span>
          </div>
          <div className="space-y-3 text-sm md:text-base">
            {BOOT_LINES.map((l, i) => {
              const shown = Math.max(0, Math.min(l.pre.length, typed - BOOT_CUM[i]));
              const lineDone = typed >= BOOT_CUM[i] + l.pre.length;
              const active = !lineDone && typed >= BOOT_CUM[i];
              return (
                <div key={l.pre} className="flex items-baseline gap-2.5">
                  <span className="text-amber/70">▸</span>
                  <span className="whitespace-pre tracking-wider text-bone/85">
                    {l.pre.slice(0, shown)}
                    {active && <span className="boot-caret text-amber" />}
                  </span>
                  {lineDone && (
                    <span className="ml-auto flex items-baseline gap-2.5">
                      <span className="tracking-widest text-dim/50">·····</span>
                      <span className={`stat-pop font-bold tracking-[0.2em] ${l.cls}`}>{l.status}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {isDone && (
            <div className="stat-pop mt-8 flex items-center gap-3.5">
              <div className="h-[3px] w-12 bg-blood" />
              <span className="font-display text-2xl tracking-[0.18em] text-blood md:text-3xl">THREAT LEVEL · EXTREME</span>
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-5 left-6 text-[11px] font-bold tracking-[0.3em] text-dim/40">03:47 AM · NORTH SEA</div>
      <div className="absolute bottom-5 right-6 text-[11px] font-bold tracking-[0.3em] text-dim/60">CLICK TO SKIP ▸▸</div>
    </div>
  );
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<UiState>({ screen: "menu", stats: null });
  const [hud, setHud] = useState<HudData>(DEFAULT_HUD);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    if (!mountRef.current || !wrapRef.current || !overlayRef.current || !fxRef.current || !vigRef.current) return;
    const game = new Game({
      mount: mountRef.current,
      wrap: wrapRef.current,
      overlay: overlayRef.current,
      fx: fxRef.current,
      vignette: vigRef.current,
      onUi: (u) => setUi(u),
      onHud: (h) => setHud(h),
    });
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const inGame = ui.screen === "playing" || ui.screen === "paused";
  const hpLow = hud.hp <= 30;
  const ownedPerkList: PerkDef[] = PERKS.filter((p) => (hud.ownedPerks[p.id] || 0) > 0);
  const perkChoices: PerkDef[] = hud.perkChoices.map((id) => PERK_BY_ID[id]).filter(Boolean);
  const arming = hud.perkLockT > 0;
  const armFrac = Math.max(0, Math.min(1, 1 - hud.perkLockT / PERK_UI.LOCKOUT));

  return (
    <div className="fixed inset-0 bg-ink overflow-hidden font-hud text-bone" onClick={() => gameRef.current?.relockIfPlaying()}>
      {/* 3D + overlay, shaken together */}
      <div ref={wrapRef} className="absolute inset-0">
        <div ref={mountRef} className="absolute inset-0" />
        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
      </div>

      {/* cinematic static vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(2,10,13,0.55) 100%)" }}
      />
      {/* damage vignette (opacity driven by game) */}
      <div
        ref={vigRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0, background: "radial-gradient(ellipse at center, transparent 34%, rgba(255,36,56,0.55) 100%)" }}
      />

      {/* DOM fx layer: banners, popups, killfeed */}
      <div ref={fxRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        <div id="feed" className="absolute right-4 top-[104px] flex flex-col items-end" />
      </div>

      {/* ============ HUD ============ */}
      {inGame && (
        <div className="absolute inset-0 pointer-events-none scanlines">
          {/* top-left: wave */}
          <div className="absolute left-4 top-4 rise-in">
            <div className="hud-panel clip-panel px-4 py-2.5 min-w-[190px]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.35em] text-dim">WAVE</div>
                  <div className="font-display text-4xl leading-none text-amber">
                    {String(Math.max(1, hud.wave)).padStart(2, "0")}
                  </div>
                </div>
                <div className="text-right pb-0.5">
                  <div className="text-[10px] font-semibold tracking-[0.25em] text-dim">HOSTILES</div>
                  <div className={`font-display text-2xl leading-none ${hud.enemiesLeft > 0 ? "text-blood" : "text-tide"}`}>
                    {hud.enemiesLeft}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-[11px] font-semibold tracking-[0.3em] uppercase">
                {hud.waveState === "combat" ? (
                  <span className="text-ember">▸ ENGAGED</span>
                ) : (
                  <span className="text-tide">▸ REGROUP — SUPPLY INBOUND</span>
                )}
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 border border-line/50 bg-ink/60 px-2.5 py-1 font-hud text-[11px] font-bold tracking-[0.28em] text-tide/90">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.6A4 4 0 0 0 6 19h11.5z" />
                <path d="M12 12l-2 4h3l-2 4" />
              </svg>
              WX ▸ {hud.weather}
            </div>
          </div>

          {/* top-right: score */}
          <div className="absolute right-4 top-4 text-right rise-in rise-in-1">
            <div className="hud-panel clip-panel px-4 py-2.5 min-w-[210px]">
              <div className="text-[10px] font-semibold tracking-[0.35em] text-dim">CONTRACT PAY</div>
              <div className="font-display text-4xl leading-none text-bone tabular-nums">
                {hud.score.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-semibold tracking-widest">
                <span className="text-dim">BEST {hud.best.toLocaleString()}</span>
                {hud.combo > 1 ? (
                  <span className="text-hazard">CHAIN ×{(1 + (hud.combo - 1) * 0.15).toFixed(2)}</span>
                ) : (
                  <span className="text-dim/60">KILLS {hud.kills}</span>
                )}
              </div>
              {hud.combo > 1 && (
                <div className="mt-1 h-1 bg-ink">
                  <div className="h-full bg-hazard" style={{ width: `${hud.comboFrac * 100}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* bottom-left: vitals */}
          <div className="absolute left-4 bottom-4 w-[280px] rise-in rise-in-2">
            <div className="hud-panel clip-panel px-4 py-3">
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-semibold tracking-[0.35em] text-dim">VITALS</span>
                <span className={`font-display text-3xl leading-none tabular-nums ${hpLow ? "text-blood pulse-glow" : "text-bone"}`}>
                  {hud.hp}
                </span>
              </div>
              <div className="mt-1.5">
                <Bar v={hud.hp} max={Math.max(100, hud.hp)} cls={hpLow ? "bg-blood" : "bg-gradient-to-r from-ember to-amber"} pulse={hpLow} />
              </div>
              <div className="mt-2.5 flex items-end justify-between">
                <span className="text-[10px] font-semibold tracking-[0.35em] text-dim">FOCUS [RMB]</span>
                <span className={`font-display text-lg leading-none tabular-nums ${hud.focusActive ? "text-tide" : "text-dim"}`}>
                  {hud.focus}
                </span>
              </div>
              <div className="mt-1">
                <Bar v={hud.focus} max={Math.max(100, hud.focus)} cls="bg-tide" />
              </div>
            </div>
            {ownedPerkList.length > 0 && (
              <div className="hud-panel clip-panel mt-2 flex flex-wrap items-center gap-1.5 px-3 py-2">
                <span className="mr-1 text-[9px] font-bold tracking-[0.3em] text-dim">UPGRADES</span>
                {ownedPerkList.map((p) => (
                  <span
                    key={p.id}
                    title={`${p.name}${hud.ownedPerks[p.id] > 1 ? ` ×${hud.ownedPerks[p.id]}` : ""} — ${p.desc}`}
                    className={`flex items-center gap-1 border px-1.5 py-0.5 ${PERK_TAG_CLS[p.tag]}`}
                  >
                    <PerkIcon icon={p.icon} className="h-3.5 w-3.5" />
                    {hud.ownedPerks[p.id] > 1 && (
                      <span className="text-[10px] font-bold tabular-nums">×{hud.ownedPerks[p.id]}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* bottom-right: weapon */}
          <div className="absolute right-4 bottom-4 w-[300px] rise-in rise-in-3">
            <div className="hud-panel clip-panel px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl text-amber">{hud.weaponName}</span>
                <div className="flex flex-wrap gap-1">
                  {hud.unlocked.map((isUnlocked, i) =>
                    isUnlocked ? (
                      <span
                        key={i}
                        className={`clip-tag px-2 py-0.5 text-[11px] font-bold tracking-wider ${
                          i === hud.slot ? "bg-amber text-ink" : "bg-ink text-dim border border-line"
                        }`}
                      >
                        {i + 1}
                      </span>
                    ) : (
                      <span key={i} title="Locked — acquire via wave upgrade" className="clip-tag border border-line/50 bg-ink px-2 py-0.5 text-[11px] font-bold tracking-wider text-dim/50">
                        <svg viewBox="0 0 24 24" className="inline h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <rect x="5" y="11" width="14" height="9" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                        </svg>
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="mt-1 flex items-end justify-between">
                <div className="flex items-end gap-2">
                  <span
                    className={`font-display text-5xl leading-none tabular-nums ${
                      hud.reloading ? "text-amber" : hud.mag === 0 ? "text-blood" : hud.lowAmmo ? "text-hazard" : "text-bone"
                    }`}
                  >
                    {String(hud.mag).padStart(2, "0")}
                  </span>
                  <span className="pb-1 font-hud text-lg font-semibold text-dim">/ {hud.reserve}</span>
                </div>
                {hud.reloading ? (
                  <span className="blink-hard pb-1 text-sm font-bold tracking-[0.3em] text-amber">RELOADING</span>
                ) : hud.mag === 0 ? (
                  <span className="blink-hard pb-1 text-sm font-bold tracking-[0.3em] text-blood">PRESS R</span>
                ) : null}
              </div>
              <div className="mt-1.5">
                <Bar v={hud.mag} max={hud.magSize} cls={hud.lowAmmo ? "bg-blood" : "bg-amber"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ SUPPLY DROP / PERK SELECTION ============ */}
      {ui.screen === "perk" && (
        <div className="absolute inset-0 flex items-center justify-center scanlines" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,42,40,0.55), rgba(4,16,21,0.88) 78%)" }}>
          <div className="w-[880px] max-w-[95vw]">
            <div className="mb-4 flex items-end justify-between rise-in">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="hazard-stripes clip-tag px-3 py-1 text-[11px] font-bold tracking-[0.25em] text-ink">SUPPLY DROP</div>
                  <span className="font-hud text-xs font-bold tracking-[0.3em] text-tide">WAVE {hud.wave} CLEARED</span>
                </div>
                <div className="mt-1.5 font-display text-4xl md:text-5xl text-bone" style={{ textShadow: "0 0 30px rgba(255,176,58,0.25)" }}>
                  CHOOSE YOUR EDGE
                </div>
              </div>
              <div className="hidden md:block text-right font-hud text-[11px] font-semibold tracking-[0.25em] text-dim">
                AMMO RESTOCKED · WOUND PATCHED
                <br />
                {arming ? (
                  <span className="blink-hard text-amber">ARMING SUPPLY CACHE — STAND BY</span>
                ) : (
                  <span>NEXT WAVE ON SELECTION</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {perkChoices.map((p, i) => (
                <button
                  key={p.id}
                  disabled={arming}
                  onClick={() => gameRef.current?.choosePerk(i)}
                  onMouseEnter={() => gameRef.current?.menuTick()}
                  className={`hud-panel clip-panel group relative p-5 text-left transition-all duration-150 panel-in-r panel-d${i + 1} ${
                    arming ? "cursor-default opacity-60 saturate-[0.6]" : "hover:-translate-y-1.5"
                  }`}
                  style={{ borderColor: "rgba(255,176,58,0.28)" }}
                >
                  {/* arm sweep — fills while the picker is lock-armed */}
                  <span
                    className={`absolute left-0 top-0 h-[3px] bg-amber ${arming ? "" : "opacity-0"}`}
                    style={{ width: `${armFrac * 100}%`, boxShadow: arming ? "0 0 12px rgba(255,176,58,0.8)" : "none" }}
                  />
                  <div className="absolute right-3 top-3 clip-tag bg-ink px-2 py-0.5 font-display text-sm text-dim border border-line">
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center border ${PERK_TAG_CLS[p.tag]} bg-ink/70`}>
                      <PerkIcon icon={p.icon} className="h-7 w-7" />
                    </span>
                    <div>
                      <div className={`font-hud text-[10px] font-bold tracking-[0.3em] ${PERK_TAG_CLS[p.tag].split(" ")[1]}`}>{p.tag}</div>
                      <div className="font-display text-2xl leading-tight text-bone group-hover:text-amber transition-colors">{p.name}</div>
                    </div>
                  </div>
                  <p className="mt-3 font-hud text-[13px] font-semibold leading-relaxed text-dim">{p.desc}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-1">
                      {Array.from({ length: p.maxStacks }).map((_, s) => (
                        <span
                          key={s}
                          className={`h-1.5 w-4 ${s < (hud.ownedPerks[p.id] || 0) ? "bg-amber" : "bg-line/60"}`}
                        />
                      ))}
                    </div>
                    <span className="font-hud text-[10px] font-bold tracking-[0.25em] text-dim group-hover:text-amber transition-colors">
                      {(hud.ownedPerks[p.id] || 0) > 0 ? `OWNED ×${hud.ownedPerks[p.id]}` : "NEW"}
                    </span>
                  </div>
                  <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 ${PERK_TAG_CLS[p.tag].split(" ")[0].replace("border-", "bg-")} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </button>
              ))}
            </div>

            <div className="fade-late mt-4 text-center font-hud text-[11px] font-semibold tracking-[0.3em] text-dim/80">
              {arming ? (
                <span className="blink-hard text-amber/90">LOCKED — {hud.perkLockT.toFixed(1)}s</span>
              ) : (
                <>
                  PRESS <span className="text-amber">1 · 2 · 3</span> OR CLICK — THE SEA IS ALREADY SENDING MORE
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ BOOT SEQUENCE ============ */}
      {!bootDone && (
        <BootOverlay
          onDone={() => setBootDone(true)}
          onTick={() => gameRef.current?.menuTick()}
          onLine={() => gameRef.current?.menuLineDone()}
          onSlam={() => gameRef.current?.menuSlam()}
        />
      )}

      {/* ============ MENU ============ */}
      {ui.screen === "menu" && bootDone && (
        <div className="absolute inset-0 scanlines">
          <div className="absolute inset-0" style={{ background: "linear-gradient(20deg, rgba(4,16,21,0.92) 8%, rgba(4,16,21,0.45) 45%, rgba(4,16,21,0.75) 100%)" }} />
          {/* top strip */}
          <div className="strip-in-d absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="hazard-stripes clip-tag px-3 py-1 text-[11px] font-bold tracking-[0.25em] text-ink">RESTRICTED DECK</div>
              <span className="font-hud text-xs font-semibold tracking-[0.3em] text-dim">NORTH SEA · PLATFORM 09 · 03:47 AM</span>
            </div>
            <div className="font-hud text-xs font-semibold tracking-[0.3em] text-dim">UPLINK <span className="text-tide">●</span> LIVE</div>
          </div>

          {/* title block */}
          <div className="absolute left-6 md:left-12 bottom-[19%]">
            <div className="title-flicker relative">
              <div className="slam-flash" />
              <div className="chroma-flicker">
                <div className="overflow-hidden">
                  <div className="title-slam font-display text-[17vw] md:text-[9.5rem] leading-[0.82] text-bone" style={{ textShadow: "0 0 60px rgba(255,106,42,0.35), 0 6px 0 rgba(0,0,0,0.65)" }}>
                    BLACK<span className="text-ember">GOLD</span>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <div className="title-slam title-slam-2 font-display text-[9vw] md:text-[5rem] leading-[0.9] text-stroke-bone tracking-wide">
                    VENDETTA
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 rise-in rise-in-2">
              <div className="h-[3px] w-16 bg-amber" />
              <p className="max-w-md font-hud text-sm md:text-base font-medium tracking-wider text-dim">
                They took the rig. They took your crew. One deck, one man, infinite waves —
                <span className="text-bone"> hold the blackgold until the sea takes it back.</span>
              </p>
            </div>
            <div className="mt-6 flex items-center gap-4 rise-in rise-in-3">
              <button
                onClick={() => gameRef.current?.start()}
                className="group relative clip-btn bg-amber px-8 py-3.5 font-display text-xl md:text-2xl text-ink transition-all duration-150 hover:bg-hazard hover:px-10 active:translate-y-0.5 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <CrosshairIcon className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
                  CLICK TO DEPLOY
                </span>
              </button>
              <div className="font-hud text-xs font-semibold tracking-[0.25em] text-dim">
                CONTRACT RECORD
                <div className="font-display text-2xl text-amber tabular-nums leading-tight">
                  {Number(localStorage.getItem("bgv-best") || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* right column: dossier + controls */}
          <div className="absolute right-6 md:right-10 top-16 bottom-8 hidden lg:flex w-[340px] flex-col gap-3">
            <div className="hud-panel clip-panel p-4 panel-in-r panel-d1">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-lg text-amber">WEAPON DOSSIER</span>
                <span className="clip-tag bg-ink px-2 py-0.5 text-[10px] font-bold tracking-[0.25em] text-dim">KEYS 1-6</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {WEAPON_LIST.map((w) => (
                  <div key={w.slot} className={`relative border border-line/60 bg-ink/50 px-2.5 py-2 ${w.locked ? "opacity-55" : ""}`}>
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-display text-sm leading-tight text-bone">{w.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold tracking-[0.15em] text-dim">
                        {w.locked && <PerkIcon icon="lock" className="h-2.5 w-2.5" />}
                        {w.role}
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <StatBar label="DMG" v={w.dmg} />
                      <StatBar label="ROF" v={w.rof} />
                      <StatBar label="CTL" v={w.ctl} />
                    </div>
                    {w.locked && (
                      <div className="mt-1 text-[9px] font-semibold tracking-[0.15em] text-tide/80">VIA SUPPLY DROP</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="hud-panel clip-panel p-4 panel-in-r panel-d2">
              <div className="mb-2 font-display text-lg text-amber">FIELD MANUAL</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                {CONTROLS.map(([k, v]) => (
                  <div key={k} className="contents">
                    <span className="clip-tag bg-ink border border-line px-2 py-0.5 text-center text-[11px] font-bold tracking-wider text-amber whitespace-nowrap">
                      {k}
                    </span>
                    <span className="self-center text-[12px] font-semibold tracking-wider text-dim">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hud-panel clip-panel p-3 panel-in-r panel-d3 text-[12px] font-semibold tracking-wider text-dim">
              <span className="text-tide">TIP ▸</span> Hold <span className="text-bone">RMB</span> to enter FOCUS — the world slows, your trigger doesn't. Kills recharge it.
            </div>
          </div>

          {/* mobile controls note */}
          <div className="absolute right-6 bottom-8 lg:hidden hud-panel clip-panel p-4 max-w-[320px] rise-in rise-in-2">
            <div className="mb-1.5 font-display text-base text-amber">CONTROLS</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {CONTROLS.slice(0, 8).map(([k, v]) => (
                <div key={k} className="text-[11px] font-semibold tracking-wider text-dim">
                  <span className="text-amber">{k}</span> · {v}
                </div>
              ))}
            </div>
          </div>

          {/* rotated stamp — slams down like a rubber stamp */}
          <div className="stamp-in absolute left-[52%] top-[14%] hidden md:block">
            <div className="border-4 border-blood/70 px-4 py-1.5 font-display text-3xl text-blood/80 tracking-widest" style={{ maskImage: "linear-gradient(115deg, black 78%, transparent 92%)" }}>
              NO EXTRACTION
            </div>
          </div>

          <div className="fade-late absolute bottom-2 left-0 right-0 text-center">
            <span className="blink-hard text-[11px] font-semibold tracking-[0.3em] text-dim/70">
              MOUSE + KEYBOARD REQUIRED · HEADPHONES RECOMMENDED
            </span>
          </div>
        </div>
      )}

      {/* ============ PAUSE ============ */}
      {ui.screen === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/78 backdrop-blur-[2px] scanlines">
          <div className="w-[420px] max-w-[92vw]">
            <div className="hud-panel clip-panel p-6 rise-in">
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl text-amber">STANDBY</span>
                <span className="clip-tag bg-amber px-2 py-0.5 font-display text-xs text-ink">RIG 09</span>
              </div>
              <p className="mt-1 font-hud text-sm font-medium tracking-wider text-dim">
                Operation suspended. The mercenaries are waiting.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="border border-line/60 bg-ink/60 py-2">
                  <div className="font-display text-2xl text-bone tabular-nums">{hud.wave}</div>
                  <div className="text-[10px] font-bold tracking-[0.25em] text-dim">WAVE</div>
                </div>
                <div className="border border-line/60 bg-ink/60 py-2">
                  <div className="font-display text-2xl text-bone tabular-nums">{hud.kills}</div>
                  <div className="text-[10px] font-bold tracking-[0.25em] text-dim">KILLS</div>
                </div>
                <div className="border border-line/60 bg-ink/60 py-2">
                  <div className="font-display text-2xl text-bone tabular-nums">{hud.score.toLocaleString()}</div>
                  <div className="text-[10px] font-bold tracking-[0.25em] text-dim">PAY</div>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => gameRef.current?.resume()}
                  className="flex-1 clip-btn bg-amber px-4 py-3 font-display text-lg text-ink transition-colors hover:bg-hazard cursor-pointer"
                >
                  RESUME ▸ P
                </button>
                <button
                  onClick={() => gameRef.current?.toMenu()}
                  className="clip-btn border border-line bg-ink/60 px-4 py-3 font-display text-lg text-dim transition-colors hover:text-bone hover:border-amber cursor-pointer"
                >
                  ABANDON
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
                {CONTROLS.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="text-[11px] font-semibold tracking-wider text-dim">
                    <span className="text-amber">{k}</span> · {v}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ GAME OVER ============ */}
      {ui.screen === "over" && ui.stats && (
        <div className="absolute inset-0 flex items-center justify-center scanlines" style={{ background: "radial-gradient(ellipse at center, rgba(60,8,14,0.55), rgba(4,16,21,0.92) 75%)" }}>
          <div className="w-[480px] max-w-[94vw]">
            <div className="fx-stamp mx-auto mb-4 w-fit border-[5px] border-blood px-6 py-2 font-display text-6xl md:text-7xl text-blood" style={{ textShadow: "0 0 40px rgba(255,36,56,0.6)" }}>
              K.I.A.
            </div>
            <div className="hud-panel clip-panel p-6 rise-in rise-in-1" style={{ borderColor: "rgba(255,36,56,0.45)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.35em] text-dim">FINAL CONTRACT PAY</div>
                  <div className="font-display text-5xl text-bone tabular-nums">{ui.stats.score.toLocaleString()}</div>
                </div>
                {ui.stats.newBest ? (
                  <span className="clip-tag bg-hazard px-3 py-1 font-display text-sm text-ink">NEW RECORD</span>
                ) : (
                  <div className="text-right">
                    <div className="text-[10px] font-semibold tracking-[0.25em] text-dim">BEST</div>
                    <div className="font-display text-xl text-amber tabular-nums">{ui.stats.best.toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  ["WAVES", String(ui.stats.wave)],
                  ["KILLS", String(ui.stats.kills)],
                  ["HEADSHOTS", String(ui.stats.headshots)],
                  ["ACCURACY", `${ui.stats.accuracy}%`],
                ].map(([l, v]) => (
                  <div key={l} className="border border-line/60 bg-ink/60 py-2.5">
                    <div className="font-display text-2xl text-bone tabular-nums">{v}</div>
                    <div className="text-[10px] font-bold tracking-[0.2em] text-dim">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => gameRef.current?.start()}
                  className="flex-1 clip-btn bg-blood px-4 py-3 font-display text-lg text-bone transition-colors hover:bg-ember cursor-pointer"
                >
                  RE-DEPLOY
                </button>
                <button
                  onClick={() => gameRef.current?.toMenu()}
                  className="clip-btn border border-line bg-ink/60 px-4 py-3 font-display text-lg text-dim transition-colors hover:text-bone hover:border-amber cursor-pointer"
                >
                  EXTRACT TO MENU
                </button>
              </div>
              <p className="mt-3 text-center font-hud text-xs font-semibold tracking-[0.3em] text-dim">
                THE SEA NEVER FILLS · THE WAVES NEVER END
              </p>
            </div>
            <div className="mt-3 flex justify-center gap-2 text-dim">
              <SkullIcon className="h-5 w-5" />
              <span className="font-hud text-xs font-semibold tracking-[0.3em] self-center">RIG 09 REMAINS OCCUPIED</span>
              <SkullIcon className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

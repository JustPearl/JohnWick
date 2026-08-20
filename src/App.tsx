import { useEffect, useRef, useState } from "react";
import { Game, type HudData, type UiState } from "./game/game";

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
};

const WEAPON_LIST = [
  { slot: "1", name: "WIDOW-9", role: "SIDEARM", dmg: 82, rof: 42, ctl: 88 },
  { slot: "2", name: "HORNET", role: "SMG", dmg: 38, rof: 92, ctl: 56 },
  { slot: "3", name: "MAUL-12", role: "SHOTGUN", dmg: 96, rof: 18, ctl: 40 },
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

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<UiState>({ screen: "menu", stats: null });
  const [hud, setHud] = useState<HudData>(DEFAULT_HUD);

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
                <Bar v={hud.hp} max={100} cls={hpLow ? "bg-blood" : "bg-gradient-to-r from-ember to-amber"} pulse={hpLow} />
              </div>
              <div className="mt-2.5 flex items-end justify-between">
                <span className="text-[10px] font-semibold tracking-[0.35em] text-dim">FOCUS [RMB]</span>
                <span className={`font-display text-lg leading-none tabular-nums ${hud.focusActive ? "text-tide" : "text-dim"}`}>
                  {hud.focus}
                </span>
              </div>
              <div className="mt-1">
                <Bar v={hud.focus} max={100} cls="bg-tide" />
              </div>
            </div>
          </div>

          {/* bottom-right: weapon */}
          <div className="absolute right-4 bottom-4 w-[300px] rise-in rise-in-3">
            <div className="hud-panel clip-panel px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl text-amber">{hud.weaponName}</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`clip-tag px-2 py-0.5 text-[11px] font-bold tracking-wider ${
                        i === hud.slot ? "bg-amber text-ink" : "bg-ink text-dim border border-line"
                      }`}
                    >
                      {i + 1}
                    </span>
                  ))}
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

      {/* ============ MENU ============ */}
      {ui.screen === "menu" && (
        <div className="absolute inset-0 scanlines">
          <div className="absolute inset-0" style={{ background: "linear-gradient(20deg, rgba(4,16,21,0.92) 8%, rgba(4,16,21,0.45) 45%, rgba(4,16,21,0.75) 100%)" }} />
          {/* top strip */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="hazard-stripes clip-tag px-3 py-1 text-[11px] font-bold tracking-[0.25em] text-ink">RESTRICTED DECK</div>
              <span className="font-hud text-xs font-semibold tracking-[0.3em] text-dim">NORTH SEA · PLATFORM 09 · 03:47 AM</span>
            </div>
            <div className="font-hud text-xs font-semibold tracking-[0.3em] text-dim">UPLINK <span className="text-tide">●</span> LIVE</div>
          </div>

          {/* title block */}
          <div className="absolute left-6 md:left-12 bottom-[19%]">
            <div className="title-flicker">
              <div className="font-display text-[17vw] md:text-[9.5rem] leading-[0.82] text-bone" style={{ textShadow: "0 0 60px rgba(255,106,42,0.35), 0 6px 0 rgba(0,0,0,0.65)" }}>
                BLACK<span className="text-ember">GOLD</span>
              </div>
              <div className="font-display text-[9vw] md:text-[5rem] leading-[0.9] text-stroke-bone tracking-wide">VENDETTA</div>
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
          <div className="absolute right-6 md:right-10 top-16 bottom-8 hidden lg:flex w-[340px] flex-col gap-3 overflow-hidden">
            <div className="hud-panel clip-panel p-4 rise-in rise-in-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-lg text-amber">WEAPON DOSSIER</span>
                <span className="clip-tag bg-ink px-2 py-0.5 text-[10px] font-bold tracking-[0.25em] text-dim">KEYS 1-3</span>
              </div>
              <div className="space-y-3">
                {WEAPON_LIST.map((w) => (
                  <div key={w.slot} className="border border-line/60 bg-ink/50 px-3 py-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-base text-bone">{w.name}</span>
                      <span className="text-[10px] font-bold tracking-[0.3em] text-dim">{w.role}</span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <StatBar label="DMG" v={w.dmg} />
                      <StatBar label="ROF" v={w.rof} />
                      <StatBar label="CTL" v={w.ctl} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hud-panel clip-panel p-4 rise-in rise-in-2">
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
            <div className="hud-panel clip-panel p-3 rise-in rise-in-3 text-[12px] font-semibold tracking-wider text-dim">
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

          {/* rotated stamp */}
          <div className="absolute left-[52%] top-[14%] hidden md:block rotate-[-9deg] drift-slow">
            <div className="border-4 border-blood/70 px-4 py-1.5 font-display text-3xl text-blood/80 tracking-widest" style={{ maskImage: "linear-gradient(115deg, black 78%, transparent 92%)" }}>
              NO EXTRACTION
            </div>
          </div>

          <div className="absolute bottom-2 left-0 right-0 text-center text-[11px] font-semibold tracking-[0.3em] text-dim/70 blink-hard">
            MOUSE + KEYBOARD REQUIRED · HEADPHONES RECOMMENDED
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

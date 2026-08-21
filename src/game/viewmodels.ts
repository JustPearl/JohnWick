/* First-person weapon models — box-built, stylized, attached to the camera. */
import * as THREE from "three";
import { PAL } from "./config";

export interface ViewModelRefs {
  groups: THREE.Group[];
  muzzle: THREE.Object3D[];
  flashes: THREE.Group[];
  base: THREE.Vector3[];
  flashBase: number[];
  light: THREE.PointLight;
}

export function buildViewModels(camera: THREE.PerspectiveCamera): ViewModelRefs {
  const groups: THREE.Group[] = [];
  const muzzle: THREE.Object3D[] = [];
  const flashes: THREE.Group[] = [];
  const base: THREE.Vector3[] = [];
  const flashBase: number[] = [];

  /* ---- layered muzzle flash: starburst + hot core + anamorphic streak + volume cone ---- */
  const starShape = new THREE.Shape();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.24 : 0.085;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeo = new THREE.ShapeGeometry(starShape);
  const coreGeo = new THREE.CircleGeometry(0.09, 14);
  const streakGeo = new THREE.PlaneGeometry(0.62, 0.05);
  const coneGeo = new THREE.ConeGeometry(0.085, 0.42, 8, 1, true);
  const add = (op: number, c: number) =>
    new THREE.MeshBasicMaterial({
      color: c,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const makeFlash = () => {
    const fg = new THREE.Group();
    const star = new THREE.Mesh(starGeo, add(0.95, PAL.MUZZLE_FLASH));
    const core = new THREE.Mesh(coreGeo, add(1, 0xfff4da));
    core.position.z = 0.004;
    const streak = new THREE.Mesh(streakGeo, add(0.5, 0xffd9a0));
    streak.position.z = 0.002;
    const cone = new THREE.Mesh(coneGeo, add(0.32, 0xff9a4a));
    cone.rotation.x = -Math.PI / 2; // apex points downrange
    cone.position.z = -0.28;
    fg.add(star, core, streak, cone);
    fg.userData.streak = streak;
    return fg;
  };
  const build = (
    fn: (g: THREE.Group) => THREE.Vector3,
    px = 0.34,
    py = -0.3,
    pz = -0.62,
    flashScale = 1
  ) => {
    const g = new THREE.Group();
    const m = new THREE.Object3D();
    m.position.copy(fn(g));
    g.add(m);
    const flash = makeFlash();
    flash.position.copy(m.position);
    flash.position.z -= 0.1;
    flash.scale.setScalar(flashScale);
    flash.visible = false;
    flash.userData.z0 = flash.position.z;
    g.add(flash);
    g.position.set(px, py, pz);
    g.visible = false;
    camera.add(g);
    groups.push(g);
    muzzle.push(m);
    flashes.push(flash);
    base.push(new THREE.Vector3(px, py, pz));
    flashBase.push(flashScale);
    return g;
  };
  const B = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.rotation.y = ry;
    return mesh;
  };
  const C = (r: number, len: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    return mesh;
  };

  /* ---- WIDOW-9 · modern .45 polymer pistol ---- */
  build((g) => {
    const slideM = new THREE.MeshToonMaterial({ color: 0x33383f });
    const frameM = new THREE.MeshToonMaterial({ color: 0x1f2328 });
    const gripM = new THREE.MeshToonMaterial({ color: 0x26292f });
    const cutM = new THREE.MeshToonMaterial({ color: 0x121519 });
    g.add(
      B(0.085, 0.095, 0.34, slideM, 0, 0.05, -0.05), // slide
      B(0.093, 0.08, 0.07, cutM, 0, 0.05, 0.078), // rear serration block
      C(0.019, 0.06, cutM, 0, 0.052, -0.245), // barrel crown
      B(0.073, 0.055, 0.26, frameM, 0, -0.02, -0.06), // frame / dust cover
      B(0.012, 0.012, 0.11, cutM, 0.028, -0.053, -0.12), // accessory rail
      B(0.012, 0.012, 0.11, cutM, -0.028, -0.053, -0.12),
      B(0.05, 0.05, 0.016, frameM, 0, -0.075, -0.115), // trigger guard
      B(0.05, 0.016, 0.09, frameM, 0, -0.1, -0.065),
      B(0.012, 0.032, 0.01, cutM, 0, -0.062, -0.045, -0.35), // trigger
      B(0.07, 0.16, 0.09, gripM, 0, -0.125, 0.055, -0.3), // grip
      B(0.05, 0.12, 0.014, cutM, 0, -0.125, 0.105, -0.3), // backstrap
      B(0.062, 0.02, 0.082, cutM, 0, -0.2, 0.082, -0.3), // mag baseplate
      B(0.06, 0.025, 0.03, gripM, 0, -0.03, 0.115), // beavertail
      B(0.011, 0.022, 0.014, cutM, 0.016, 0.107, 0.085), // rear sights
      B(0.011, 0.022, 0.014, cutM, -0.016, 0.107, 0.085),
      B(0.013, 0.026, 0.014, cutM, 0, 0.107, -0.19), // front sight
      B(0.007, 0.007, 0.007, new THREE.MeshToonMaterial({ color: PAL.AMBER, emissive: PAL.EMBER, emissiveIntensity: 0.5 }), 0, 0.122, -0.19), // tritium dot
      B(0.006, 0.04, 0.09, cutM, 0.045, 0.055, -0.02) // ejection port
    );
    return new THREE.Vector3(0, 0.052, -0.3);
  }, 0.33, -0.3, -0.58, 1.0);

  /* ---- HORNET · UZI ---- */
  build((g) => {
    const recM = new THREE.MeshToonMaterial({ color: 0x32373e });
    const shroudM = new THREE.MeshToonMaterial({ color: 0x1e2126 });
    const steelM = new THREE.MeshToonMaterial({ color: 0x3d434b });
    const gripM = new THREE.MeshToonMaterial({ color: 0x1a1d21 });
    const cutM = new THREE.MeshToonMaterial({ color: 0x121418 });
    g.add(
      B(0.1, 0.11, 0.3, recM, 0, 0.03, -0.02), // receiver
      B(0.095, 0.1, 0.05, shroudM, 0, 0.03, -0.185), // front plate
      C(0.03, 0.18, shroudM, 0, 0.045, -0.31), // barrel shroud
      C(0.036, 0.03, cutM, 0, 0.045, -0.415), // muzzle ring
      C(0.015, 0.05, cutM, 0, 0.045, -0.45), // crown
      B(0.04, 0.02, 0.26, cutM, 0, 0.095, -0.02), // top channel
      B(0.02, 0.03, 0.03, cutM, 0, 0.117, 0.02), // charging handle
      B(0.045, 0.1, 0.05, shroudM, 0, -0.075, -0.155, 0.15), // folding foregrip
      B(0.03, 0.02, 0.03, cutM, 0, -0.018, -0.16),
      B(0.075, 0.13, 0.085, gripM, 0, -0.09, 0.045, -0.25), // pistol grip
      B(0.05, 0.17, 0.045, steelM, 0, -0.23, 0.088, -0.25), // magazine in grip
      B(0.056, 0.02, 0.051, cutM, 0, -0.315, 0.115, -0.25), // mag baseplate
      B(0.05, 0.016, 0.09, gripM, 0, -0.052, 0.02), // trigger guard
      B(0.05, 0.045, 0.014, gripM, 0, -0.032, 0.068),
      B(0.012, 0.03, 0.01, cutM, 0, -0.032, 0.02, -0.3), // trigger
      B(0.012, 0.012, 0.3, shroudM, 0.032, 0.1, 0.24, -0.24), // wire stock arms
      B(0.012, 0.012, 0.3, shroudM, -0.032, 0.1, 0.24, -0.24),
      B(0.075, 0.05, 0.035, shroudM, 0, 0.158, 0.385, -0.24), // shoulder piece
      B(0.012, 0.05, 0.012, cutM, 0, 0.105, -0.27), // front post
      B(0.006, 0.042, 0.012, cutM, 0.02, 0.1, -0.27), // post ears
      B(0.006, 0.042, 0.012, cutM, -0.02, 0.1, -0.27),
      B(0.03, 0.02, 0.012, cutM, 0, 0.105, 0.1) // rear aperture
    );
    return new THREE.Vector3(0, 0.045, -0.48);
  }, 0.33, -0.29, -0.56, 1.15);

  /* ---- MAUL-12 · tactical shotgun ---- */
  build((g) => {
    const recM = new THREE.MeshToonMaterial({ color: 0x292d33 });
    const barrelM = new THREE.MeshToonMaterial({ color: 0x1c1f24 });
    const shieldM = new THREE.MeshToonMaterial({ color: 0x343941 });
    const forendM = new THREE.MeshToonMaterial({ color: 0x40464e });
    const stockM = new THREE.MeshToonMaterial({ color: 0x1e2126 });
    const cutM = new THREE.MeshToonMaterial({ color: 0x101317 });
    const oliveM = new THREE.MeshToonMaterial({ color: 0x5c6142 });
    const redFiber = new THREE.MeshToonMaterial({ color: 0xff4a3a, emissive: 0xff2a1a, emissiveIntensity: 1.4 });
    g.add(
      B(0.095, 0.115, 0.3, recM, 0, 0.04, -0.02), // receiver
      B(0.006, 0.05, 0.11, cutM, 0.05, 0.05, -0.02), // ejection port
      C(0.03, 0.62, barrelM, 0, 0.055, -0.44), // barrel
      C(0.038, 0.07, cutM, 0, 0.055, -0.775), // muzzle brake
      C(0.04, 0.012, barrelM, 0, 0.055, -0.76),
      C(0.04, 0.012, barrelM, 0, 0.055, -0.79),
      B(0.04, 0.012, 0.4, shieldM, 0, 0.098, -0.42), // ventilated heat shield
      B(0.012, 0.008, 0.05, cutM, 0, 0.105, -0.28),
      B(0.012, 0.008, 0.05, cutM, 0, 0.105, -0.36),
      B(0.012, 0.008, 0.05, cutM, 0, 0.105, -0.44),
      B(0.012, 0.008, 0.05, cutM, 0, 0.105, -0.52),
      B(0.012, 0.008, 0.05, cutM, 0, 0.105, -0.58),
      B(0.012, 0.03, 0.012, cutM, 0, 0.08, -0.28), // shield posts
      B(0.012, 0.03, 0.012, cutM, 0, 0.08, -0.56),
      C(0.026, 0.5, barrelM, 0, -0.012, -0.36), // mag tube
      C(0.031, 0.03, cutM, 0, -0.012, -0.62), // tube cap
      B(0.09, 0.085, 0.17, forendM, 0, 0.02, -0.27), // ribbed pump forend
      B(0.094, 0.089, 0.014, cutM, 0, 0.02, -0.33),
      B(0.094, 0.089, 0.014, cutM, 0, 0.02, -0.27),
      B(0.094, 0.089, 0.014, cutM, 0, 0.02, -0.21),
      B(0.035, 0.014, 0.24, cutM, 0, 0.104, -0.03), // top picatinny rail
      B(0.03, 0.01, 0.014, shieldM, 0, 0.117, -0.11),
      B(0.03, 0.01, 0.014, shieldM, 0, 0.117, -0.06),
      B(0.03, 0.01, 0.014, shieldM, 0, 0.117, -0.01),
      B(0.03, 0.01, 0.014, shieldM, 0, 0.117, 0.04),
      B(0.06, 0.04, 0.11, oliveM, 0, -0.035, 0.05), // olive trigger housing
      B(0.05, 0.014, 0.09, oliveM, 0, -0.062, 0.04),
      B(0.05, 0.04, 0.014, oliveM, 0, -0.045, 0.09),
      B(0.012, 0.03, 0.01, cutM, 0, -0.035, 0.055, -0.3), // trigger
      B(0.065, 0.14, 0.08, stockM, 0, -0.09, 0.105, -0.32), // pistol-grip stock
      B(0.075, 0.09, 0.24, stockM, 0, 0.015, 0.235, -0.06), // stock body
      B(0.05, 0.02, 0.12, cutM, 0, 0.065, 0.22, -0.06), // cheek riser
      B(0.082, 0.1, 0.03, cutM, 0, 0.003, 0.36, -0.06) // rubber buttpad
    );
    const ghost = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 6, 12), cutM);
    ghost.position.set(0, 0.135, -0.12);
    g.add(ghost);
    const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.025, 6), redFiber);
    bead.position.set(0, 0.095, -0.7);
    g.add(bead);
    return new THREE.Vector3(0, 0.055, -0.84);
  }, 0.3, -0.34, -0.55, 1.8);

  /* ---- BOAR-7 · 7.62 LMG (RPK × MG42) ---- */
  build((g) => {
    const recM = new THREE.MeshToonMaterial({ color: 0x3a4047 });
    const shroudM = new THREE.MeshToonMaterial({ color: 0x23272d });
    const woodM = new THREE.MeshToonMaterial({ color: 0x5c4630 });
    const drumM = new THREE.MeshToonMaterial({ color: 0x2c3138 });
    const cutM = new THREE.MeshToonMaterial({ color: 0x14171b });
    g.add(
      B(0.11, 0.13, 0.45, recM, 0, 0.03, -0.02), // receiver
      B(0.09, 0.05, 0.22, recM, 0, 0.115, -0.06), // top feed cover
      B(0.02, 0.03, 0.1, cutM, 0, 0.145, 0.02), // carry handle
      C(0.034, 0.48, shroudM, 0, 0.05, -0.45), // perforated barrel shroud
      C(0.04, 0.028, cutM, 0, 0.05, -0.28), // shroud band
      C(0.04, 0.028, cutM, 0, 0.05, -0.42), // shroud band
      C(0.04, 0.028, cutM, 0, 0.05, -0.56), // shroud band
      C(0.042, 0.07, cutM, 0, 0.05, -0.72), // muzzle booster
      C(0.016, 0.05, cutM, 0, 0.05, -0.78), // crown
      B(0.012, 0.05, 0.012, cutM, 0, 0.1, -0.66), // front sight post
      B(0.006, 0.042, 0.012, cutM, 0.018, 0.1, -0.66),
      B(0.006, 0.042, 0.012, cutM, -0.018, 0.1, -0.66),
      B(0.03, 0.02, 0.012, cutM, 0, 0.15, 0.12), // rear aperture
      B(0.06, 0.05, 0.05, drumM, 0, -0.05, -0.1, 0.2), // pan drum housing
      B(0.075, 0.13, 0.09, woodM, 0, -0.1, 0.06, -0.28), // pistol grip (wood)
      B(0.07, 0.1, 0.26, woodM, 0, 0.005, 0.24, -0.06), // wooden stock
      B(0.078, 0.11, 0.03, cutM, 0, -0.005, 0.375, -0.06), // buttpad
      B(0.012, 0.03, 0.01, cutM, 0, -0.04, 0.04, -0.3), // trigger
      B(0.05, 0.016, 0.09, recM, 0, -0.055, 0.02) // trigger guard
    );
    // folding bipod
    for (const side of [-1, 1]) {
      const leg = B(0.012, 0.16, 0.012, cutM, side * 0.05, -0.045, -0.6, side * 0.28);
      g.add(leg);
    }
    // pan drum below receiver
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.055, 18), drumM);
    drum.position.set(0, -0.075, -0.16);
    drum.rotation.x = 0.12;
    g.add(drum);
    const drumCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 18), cutM);
    drumCap.position.set(0, -0.075, -0.16);
    drumCap.rotation.x = 0.12;
    g.add(drumCap);
    return new THREE.Vector3(0, 0.05, -0.82);
  }, 0.34, -0.3, -0.58, 1.5);

  /* ---- REAPER-7 · bolt-action sniper (iron sights) ---- */
  build((g) => {
    const recM = new THREE.MeshToonMaterial({ color: 0x33383f });
    const barrelM = new THREE.MeshToonMaterial({ color: 0x1e2126 });
    const stockM = new THREE.MeshToonMaterial({ color: 0x3d4a3a });
    const boltM = new THREE.MeshToonMaterial({ color: 0x4a5058 });
    const cutM = new THREE.MeshToonMaterial({ color: 0x12151a });
    const redFiber = new THREE.MeshToonMaterial({ color: 0xff4a3a, emissive: 0xff2a1a, emissiveIntensity: 1.2 });
    g.add(
      B(0.085, 0.1, 0.34, recM, 0, 0.04, -0.02), // receiver
      C(0.024, 0.66, barrelM, 0, 0.055, -0.5), // long barrel
      C(0.03, 0.08, cutM, 0, 0.055, -0.86), // muzzle brake
      C(0.034, 0.014, barrelM, 0, 0.055, -0.845),
      C(0.034, 0.014, barrelM, 0, 0.055, -0.875),
      B(0.05, 0.04, 0.1, stockM, 0, -0.02, -0.05), // magazine well
      B(0.014, 0.03, 0.014, boltM, 0.055, 0.05, 0.06, 0, 0), // bolt handle shaft
      B(0.02, 0.02, 0.045, boltM, 0.068, 0.05, 0.075), // bolt knob
      B(0.012, 0.06, 0.012, cutM, 0, 0.1, -0.72), // tall front sight post
      B(0.006, 0.05, 0.012, cutM, 0.016, 0.098, -0.72),
      B(0.006, 0.05, 0.012, cutM, -0.016, 0.098, -0.72),
      B(0.012, 0.05, 0.014, cutM, 0.02, 0.1, 0.14), // rear sight ears
      B(0.012, 0.05, 0.014, cutM, -0.02, 0.1, 0.14),
      B(0.052, 0.014, 0.014, cutM, 0, 0.122, 0.14), // rear sight bridge (notch)
      B(0.06, 0.05, 0.12, stockM, 0, -0.05, 0.05), // grip section
      B(0.012, 0.03, 0.01, cutM, 0, -0.035, 0.06, -0.3), // trigger
      B(0.05, 0.014, 0.09, cutM, 0, -0.058, 0.045), // trigger guard
      B(0.065, 0.12, 0.1, stockM, 0, -0.08, 0.12, -0.3), // pistol grip
      B(0.075, 0.1, 0.3, stockM, 0, 0.02, 0.26, -0.05), // stock body
      B(0.05, 0.025, 0.16, stockM, 0, 0.075, 0.24, -0.05), // cheek riser
      B(0.082, 0.11, 0.03, cutM, 0, 0.005, 0.42, -0.05) // recoil pad
    );
    const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), redFiber);
    bead.position.set(0, 0.135, -0.72);
    g.add(bead);
    return new THREE.Vector3(0, 0.055, -0.9);
  }, 0.32, -0.32, -0.5, 1.9);

  /* ---- MAMBA-6 · heavy revolver (Colt Python) ---- */
  build((g) => {
    const steelM = new THREE.MeshToonMaterial({ color: 0x41464e });
    const blueM = new THREE.MeshToonMaterial({ color: 0x2b3238 });
    const gripM = new THREE.MeshToonMaterial({ color: 0x3a2c22 });
    const cutM = new THREE.MeshToonMaterial({ color: 0x14171c });
    const redFiber = new THREE.MeshToonMaterial({ color: 0xff4a3a, emissive: 0xff2a1a, emissiveIntensity: 1.2 });
    g.add(
      C(0.05, 0.075, blueM, 0, 0.05, 0.02), // cylinder
      C(0.052, 0.012, cutM, 0, 0.05, -0.02), // cylinder face
      C(0.028, 0.24, steelM, 0, 0.05, -0.18), // barrel
      B(0.02, 0.014, 0.2, blueM, 0, 0.085, -0.16), // top rib
      B(0.012, 0.035, 0.012, cutM, 0, 0.1, -0.29), // front sight ramp
      B(0.05, 0.05, 0.09, steelM, 0, 0.01, 0.05), // frame / topstrap
      B(0.05, 0.04, 0.06, steelM, 0, -0.02, 0.06), // frame lower
      B(0.012, 0.05, 0.03, blueM, 0, 0.075, 0.1), // hammer
      B(0.02, 0.014, 0.02, cutM, 0, 0.1, 0.1), // hammer spur
      B(0.012, 0.028, 0.012, cutM, 0, 0.115, 0.14), // rear sight blade
      B(0.044, 0.016, 0.1, steelM, 0, -0.062, 0.045), // trigger guard
      B(0.012, 0.035, 0.01, cutM, 0, -0.04, 0.05, -0.3), // trigger
      B(0.065, 0.13, 0.09, gripM, 0, -0.115, 0.09, -0.28), // oversized grip
      B(0.05, 0.1, 0.014, cutM, 0, -0.12, 0.135, -0.28), // grip panel
      B(0.006, 0.006, 0.006, redFiber, 0, 0.112, -0.285) // front sight dot
    );
    // ejector rod under barrel
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.2, 8), cutM);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(0, 0.022, -0.14);
    g.add(rod);
    return new THREE.Vector3(0, 0.05, -0.32);
  }, 0.33, -0.3, -0.58, 1.3);

  const light = new THREE.PointLight(PAL.MUZZLE_LIGHT, 0, 14, 1.6);
  light.position.set(0.34, -0.24, -1.0);
  camera.add(light);

  return { groups, muzzle, flashes, base, flashBase, light };
}

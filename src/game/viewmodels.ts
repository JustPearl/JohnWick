/* First-person weapon models — box-built, stylized, attached to the camera. */
import * as THREE from "three";
import { PAL } from "./config";

export interface ViewModelRefs {
  groups: THREE.Group[];
  muzzle: THREE.Object3D[];
  flashes: THREE.Mesh[];
  base: THREE.Vector3[];
  flashBase: number[];
  light: THREE.PointLight;
}

export function buildViewModels(camera: THREE.PerspectiveCamera): ViewModelRefs {
  const groups: THREE.Group[] = [];
  const muzzle: THREE.Object3D[] = [];
  const flashes: THREE.Mesh[] = [];
  const base: THREE.Vector3[] = [];
  const flashBase: number[] = [];

  const flashMat = new THREE.MeshBasicMaterial({
    color: PAL.MUZZLE_FLASH,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
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
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flashMat);
    flash.position.copy(m.position);
    flash.position.z -= 0.1;
    flash.scale.setScalar(flashScale);
    flash.visible = false;
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

  const light = new THREE.PointLight(PAL.MUZZLE_LIGHT, 0, 14, 1.6);
  light.position.set(0.34, -0.24, -1.0);
  camera.add(light);

  return { groups, muzzle, flashes, base, flashBase, light };
}

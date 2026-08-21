import * as THREE from "three";

export const DECK_Y = 8;

/* structural layout — walls, bounds and the helipad derive from these */
export const LAYOUT = {
  DECK_W: 48, // main deck width  (x)
  DECK_D: 34, // main deck depth  (z)
  PAD_W: 20, // helipad side
  PAD_X: 34, // helipad center x
  WALL_T: 0.35, // kick-wall thickness
  WALL_IN: 0.15, // walls sit this far inside the deck edge
  DOOR_HALF: 9.2, // half width of the deck→pad doorway
  BOUND_INSET: 0.8, // movement bounds inset from walls
  /* crew quarters — west module */
  Q_W: 16, // x extent (−40..−24)
  Q_D: 18, // z extent (−9..9)
  Q_X: -32, // center x
  Q_DOOR_HALF: 5.5, // doorway in the west deck wall
  /* process yard — south module */
  P_W: 30, // x extent (−10..20)
  P_D: 13, // z extent (17..30)
  P_X: 5, // center x
  P_Z: 23.5, // center z
  P_DOOR_X1: -1, // doorway in the south deck wall
  P_DOOR_X2: 13,
  /* tank farm — north module */
  T_W: 32, // x extent (−16..16)
  T_D: 13, // z extent (−30..−17)
  T_X: 0, // center x
  T_Z: -23.5, // center z
  T_DOOR_HALF: 7, // doorway in the north deck wall
} as const;

export interface AABB {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface BarrelRef {
  group: THREE.Group;
  body: THREE.Mesh;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
}
export interface BeaconRef {
  pivot: THREE.Group;
  light: THREE.PointLight;
  mat: THREE.MeshToonMaterial;
}
export interface WorldRefs {
  group: THREE.Group;
  colliders: AABB[];
  solids: THREE.Object3D[];
  spawnPoints: THREE.Vector3[];
  playerStart: THREE.Vector3;
  flareTip: THREE.Vector3;
  boundaryRects: AABB[];
  barrels: BarrelRef[];
  beacon: BeaconRef;
  update: (t: number, dt: number) => void;
  applyWeather: (w: BlendedWeather) => void;
}

/** A fully interpolated weather state, computed by the game each frame. */
export interface BlendedWeather {
  name: string;
  skyTop: THREE.Color;
  skyMid: THREE.Color;
  skyHor: THREE.Color;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  keyColor: THREE.Color;
  keyIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  seaDeep: THREE.Color;
  seaCrest: THREE.Color;
  seaAmp: number;
  clouds: number;
  cloudTint: THREE.Color;
  rain: number;
  wind: number;
  lightning: number;
  flash: number;
}

const toon = (color: number, emissive = 0x000000, ei = 0) => {
  const m = new THREE.MeshToonMaterial({ color });
  if (ei > 0) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = ei;
  }
  return m;
};

export function buildWorld(scene: THREE.Scene): WorldRefs {
  const world = new THREE.Group();
  scene.add(world);

  const colliders: AABB[] = [];
  const solids: THREE.Object3D[] = [];

  scene.fog = new THREE.Fog(0x16333c, 70, 260);

  /* ---------------- sky dome ---------------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSun: { value: new THREE.Vector3(-0.62, 0.12, -0.78).normalize() },
      uTop: { value: new THREE.Color(0x06131b) },
      uMid: { value: new THREE.Color(0x0e2930) },
      uHor: { value: new THREE.Color(0x17333c) },
      uSunColor: { value: new THREE.Color(0xff6a2a) },
      uSunI: { value: 1 },
      uFlash: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSun;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHor;
      uniform vec3 uSunColor;
      uniform float uSunI;
      uniform float uFlash;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.25, h));
        col = mix(col, uTop, smoothstep(0.2, 0.85, h));
        float sun = pow(max(dot(vDir, uSun), 0.0), 6.0);
        float core = pow(max(dot(vDir, uSun), 0.0), 90.0);
        col += uSunColor * sun * 0.55 * uSunI;
        col += (uSunColor * 0.6 + vec3(0.4)) * core * 1.4 * uSunI;
        col += uSunColor * exp(-abs(vDir.y+0.02)*14.0) * 0.35 * uSunI;
        col += vec3(0.85, 0.92, 1.0) * uFlash;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), skyMat);
  world.add(sky);

  /* ---------------- ocean ---------------- */
  const seaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: new THREE.Color(0x16333c) },
      uSun: { value: new THREE.Vector3(-0.62, 0.12, -0.78).normalize() },
      uSunColor: { value: new THREE.Color(0xff8a48) },
      uDeep: { value: new THREE.Color(0x04171c) },
      uCrest: { value: new THREE.Color(0x0d424d) },
      uAmp: { value: 1.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uAmp;
      varying vec3 vWorld;
      varying float vH;
      void main(){
        vec3 p = position;
        float w = sin(p.x*0.14 + uTime*0.9)*0.55
                + sin(p.y*0.19 + uTime*1.35)*0.4
                + sin((p.x+p.y)*0.06 + uTime*0.55)*0.8;
        p.z += w * uAmp;
        vH = w * uAmp;
        vec4 wp = modelMatrix * vec4(p,1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      varying float vH;
      uniform vec3 uFog;
      uniform vec3 uSun;
      uniform vec3 uSunColor;
      uniform vec3 uDeep;
      uniform vec3 uCrest;
      void main(){
        vec3 col = mix(uDeep, uCrest, smoothstep(-1.2, 1.6, vH));
        vec3 toCam = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vec3(0.0,1.0,0.0));
        float spec = pow(max(dot(reflect(-uSun, n), toCam), 0.0), 24.0);
        col += uSunColor * spec * 0.5;
        float foam = smoothstep(1.15, 1.6, vH);
        col += vec3(0.55,0.62,0.6) * foam * 0.16;
        float d = distance(cameraPosition, vWorld);
        float f = smoothstep(70.0, 250.0, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const seaGeo = new THREE.PlaneGeometry(1100, 1100, 110, 110);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  world.add(sea);

  /* ---------------- procedural grime textures ---------------- */
  const canvasTex = (size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, rx = 1, ry = 1) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    draw(g, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const speckle = (g: CanvasRenderingContext2D, s: number, n: number, a: number, light: boolean) => {
    for (let i = 0; i < n; i++) {
      const v = light ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${(Math.random() * a).toFixed(3)})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
  };
  const rustBlobs = (g: CanvasRenderingContext2D, s: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 8 + Math.random() * 34;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(120,52,18,0.5)");
      rg.addColorStop(0.6, "rgba(156,74,28,0.22)");
      rg.addColorStop(1, "rgba(156,74,28,0)");
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };
  const deckTex = canvasTex(512, (g, s) => {
    g.fillStyle = "#232c31";
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const l = 32 + Math.random() * 9;
        g.fillStyle = `rgb(${l},${l + 6},${l + 9})`;
        g.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
        g.strokeStyle = "rgba(8,11,13,0.95)";
        g.lineWidth = 4;
        g.strokeRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
        for (const [rx2, ry2] of [[12, 12], [cell - 12, 12], [12, cell - 12], [cell - 12, cell - 12]] as const) {
          g.fillStyle = "#0c1013";
          g.beginPath();
          g.arc(i * cell + rx2, j * cell + ry2, 3.4, 0, 7);
          g.fill();
          g.fillStyle = "rgba(190,210,220,0.16)";
          g.beginPath();
          g.arc(i * cell + rx2 - 1, j * cell + ry2 - 1, 1.3, 0, 7);
          g.fill();
        }
      }
    speckle(g, s, 2400, 0.1, true);
    speckle(g, s, 3200, 0.16, false);
    rustBlobs(g, s, 12);
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 14 + Math.random() * 34;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(6,8,10,0.5)");
      rg.addColorStop(1, "rgba(6,8,10,0)");
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, 6, 4.2);
  const hazardTex = canvasTex(64, (g, s) => {
    g.fillStyle = "#141619";
    g.fillRect(0, 0, s, s);
    g.save();
    g.translate(s / 2, s / 2);
    g.rotate(Math.PI / 4);
    g.fillStyle = "#dfa62e";
    for (let i = -3; i <= 3; i++) g.fillRect(i * 32 - 8, -s, 16, s * 2);
    g.restore();
    speckle(g, s, 300, 0.25, false);
  }, 8, 1);
  const steelTex = canvasTex(256, (g, s) => {
    g.fillStyle = "#d5cebc";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * s, w = 4 + Math.random() * 14;
      const lg = g.createLinearGradient(0, 0, 0, s);
      lg.addColorStop(0, "rgba(58,48,38,0)");
      lg.addColorStop(1, `rgba(48,38,30,${(0.14 + Math.random() * 0.24).toFixed(2)})`);
      g.fillStyle = lg;
      g.fillRect(x, 0, w, s);
    }
    rustBlobs(g, s, 18);
    speckle(g, s, 1800, 0.12, false);
    speckle(g, s, 700, 0.08, true);
  });
  const rustTex = canvasTex(256, (g, s) => {
    g.fillStyle = "#9c4a1c";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * s, w = 5 + Math.random() * 18;
      const lg = g.createLinearGradient(0, 0, 0, s);
      lg.addColorStop(0, "rgba(40,16,6,0)");
      lg.addColorStop(1, `rgba(36,14,5,${(0.18 + Math.random() * 0.3).toFixed(2)})`);
      g.fillStyle = lg;
      g.fillRect(x, 0, w, s);
    }
    rustBlobs(g, s, 10);
    speckle(g, s, 2200, 0.16, false);
    speckle(g, s, 600, 0.1, true);
    g.fillStyle = "rgba(226,150,80,0.14)";
    for (let i = 0; i < 30; i++) g.fillRect(Math.random() * s, Math.random() * s, 3 + Math.random() * 8, 2 + Math.random() * 5);
  });
  const glowTex = canvasTex(128, (g, s) => {
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.3, "rgba(255,255,255,0.42)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
  });

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0xb06a3e, 0x0d1418, 0.95);
  world.add(hemi);
  const sun = new THREE.DirectionalLight(0xff8a48, 1.7);
  sun.position.set(-70, 26, -88);
  world.add(sun);
  const rim = new THREE.DirectionalLight(0x2fa08a, 0.4);
  rim.position.set(60, 40, 70);
  world.add(rim);
  const stormLight = new THREE.PointLight(0xcfe4ff, 0, 900, 0.6);
  stormLight.position.set(0, 180, 0);
  world.add(stormLight);

  /* ---------------- cloud deck ---------------- */
  const cloudTex = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * s, y = s * 0.3 + Math.random() * s * 0.4;
      const r = 26 + Math.random() * 60;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(255,255,255,0.5)");
      rg.addColorStop(0.6, "rgba(255,255,255,0.22)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const cloudPlanes: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: number; drift: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(420 + Math.random() * 220, 260 + Math.random() * 140), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI;
    mesh.position.set((Math.random() - 0.5) * 900, 120 + Math.random() * 70, (Math.random() - 0.5) * 900);
    world.add(mesh);
    cloudPlanes.push({ mesh, mat, base: 0.55 + Math.random() * 0.45, drift: 0.6 + Math.random() * 0.8 });
  }

  /* ---------------- main deck ---------------- */
  const deckTop = new THREE.MeshToonMaterial({ map: deckTex });
  const deckSide = toon(0x14262d);
  const mkBox = (
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    solid = false
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    world.add(m);
    if (solid) {
      solids.push(m);
      colliders.push({ x1: x - w / 2, z1: z - d / 2, x2: x + w / 2, z2: z + d / 2 });
    }
    return m;
  };

  const HW = LAYOUT.DECK_W / 2; // deck half width  (24)
  const HD = LAYOUT.DECK_D / 2; // deck half depth  (17)
  mkBox(LAYOUT.DECK_W, 1.4, LAYOUT.DECK_D, deckTop, 0, DECK_Y - 0.7, 0);
  // deck understructure
  mkBox(LAYOUT.DECK_W - 2, 1.6, LAYOUT.DECK_D - 2, deckSide, 0, DECK_Y - 2.1, 0);
  // hazard-striped edge trims
  const hazardMat = new THREE.MeshToonMaterial({ map: hazardTex.clone() });
  hazardMat.map!.repeat.set(14, 1);
  mkBox(LAYOUT.DECK_W + 0.3, 0.18, 0.55, hazardMat, 0, DECK_Y - 0.05, -(HD + 0.1));
  const hazardMat2 = new THREE.MeshToonMaterial({ map: hazardTex.clone() });
  hazardMat2.map!.repeat.set(14, 1);
  mkBox(LAYOUT.DECK_W + 0.3, 0.18, 0.55, hazardMat2, 0, DECK_Y - 0.05, HD + 0.1);
  const hazardMat3 = new THREE.MeshToonMaterial({ map: hazardTex.clone() });
  hazardMat3.map!.repeat.set(10, 1);
  mkBox(0.55, 0.18, LAYOUT.DECK_D + 0.3, hazardMat3, -(HW + 0.1), DECK_Y - 0.05, 0);

  // grating insets + faded lane paint
  const grate = toon(0x0f1e24);
  for (const [gx, gz, gw, gd] of [
    [-6, -2, 10, 6],
    [8, 4, 8, 8],
    [-14, 10, 7, 5],
    [16, -4, 6, 6],
  ] as const) {
    mkBox(gw, 0.06, gd, grate, gx, DECK_Y + 0.03, gz);
  }
  const paint = toon(0xd8b23c, 0xd8b23c, 0.1);
  mkBox(40, 0.05, 0.3, paint, 0, DECK_Y + 0.05, -4);
  mkBox(0.3, 0.05, 20, paint, 12, DECK_Y + 0.05, 2);
  mkBox(26, 0.05, 0.3, paint, -8, DECK_Y + 0.05, 13);

  /* ---------------- helipad ---------------- */
  const padTex = deckTex.clone();
  padTex.repeat.set(2.5, 2.5);
  const pad = new THREE.MeshToonMaterial({ map: padTex, color: 0x7e939c });
  mkBox(LAYOUT.PAD_W, 1.0, LAYOUT.PAD_W, pad, LAYOUT.PAD_X, DECK_Y - 0.5, 0);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.6, 6.4, 36),
    toon(0xffd23f, 0xffd23f, 0.55)
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(LAYOUT.PAD_X, DECK_Y + 0.06, 0);
  world.add(ring);
  const hMat = toon(0xffd23f, 0xffd23f, 0.55);
  mkBox(0.9, 0.08, 4.4, hMat, 32.6, DECK_Y + 0.07, 0);
  mkBox(0.9, 0.08, 4.4, hMat, 35.4, DECK_Y + 0.07, 0);
  mkBox(3.7, 0.08, 0.9, hMat, 34, DECK_Y + 0.07, 0);
  // pad edge lamps
  const lampBulb = toon(0xff5a2a, 0xff5a2a, 1.4);
  const padLamps: THREE.Mesh[] = [];
  for (const [lx, lz] of [
    [LAYOUT.PAD_X - LAYOUT.DOOR_HALF, -(LAYOUT.DOOR_HALF + 0.2)],
    [LAYOUT.PAD_X + LAYOUT.DOOR_HALF, -(LAYOUT.DOOR_HALF + 0.2)],
    [LAYOUT.PAD_X + LAYOUT.DOOR_HALF, LAYOUT.DOOR_HALF + 0.2],
    [LAYOUT.PAD_X - LAYOUT.DOOR_HALF, LAYOUT.DOOR_HALF + 0.2],
  ] as const) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), lampBulb.clone());
    b.position.set(lx, DECK_Y + 0.35, lz);
    world.add(b);
    padLamps.push(b);
  }

  /* ---------------- support legs + braces ---------------- */
  const legMat = toon(0x6e4a22);
  const legRust = toon(0x8f3d16);
  const legPos: [number, number][] = [
    [-18, -12],
    [18, -12],
    [-18, 12],
    [18, 12],
    [34, -8],
    [34, 8],
  ];
  for (const [lx, lz] of legPos) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 24, 10), lx > 25 ? legRust : legMat);
    leg.position.set(lx, -4, lz);
    world.add(leg);
  }
  const braceMat = toon(0x5d4a26);
  const addBrace = (a: THREE.Vector3, b: THREE.Vector3) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len, 6), braceMat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    world.add(m);
  };
  addBrace(new THREE.Vector3(-18, 2, -12), new THREE.Vector3(18, -6, -12));
  addBrace(new THREE.Vector3(18, 2, -12), new THREE.Vector3(-18, -6, -12));
  addBrace(new THREE.Vector3(-18, 2, 12), new THREE.Vector3(18, -6, 12));
  addBrace(new THREE.Vector3(18, 2, 12), new THREE.Vector3(-18, -6, 12));

  /* ---------------- derrick tower ---------------- */
  const derX = -15;
  const derZ = -7;
  const derH = 22;
  const boneSteel = new THREE.MeshToonMaterial({ map: steelTex });
  const rustPatch = new THREE.MeshToonMaterial({ map: rustTex });
  const derGroup = new THREE.Group();
  derGroup.position.set(derX, DECK_Y, derZ);
  world.add(derGroup);
  // rotating alarm beacon on the crown
  const beaconPivot = new THREE.Group();
  beaconPivot.position.set(derX, DECK_Y + derH + 0.9, derZ);
  const beaconMat = toon(0xff2a2a, 0xff2a2a, 0.15);
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.14), beaconMat);
    lamp.position.x = side * 0.24;
    lamp.rotation.y = side > 0 ? 0 : Math.PI;
    beaconPivot.add(lamp);
  }
  const beaconMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 6), toon(0x22262a));
  beaconMast.position.set(derX, DECK_Y + derH + 0.45, derZ);
  const beaconLight = new THREE.PointLight(0xff2a2a, 0, 60, 1.6);
  beaconLight.position.set(0, 0.1, 0.4);
  beaconPivot.add(beaconLight);
  world.add(beaconPivot, beaconMast);
  const corner = (cx: number, cz: number) => {
    // legs lean inward so the tower is wide-based and tapers to the crown
    const lean = 0.1;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, derH, 6), boneSteel);
    leg.position.set(cx * 2.4, derH / 2, cz * 2.4);
    leg.rotation.z = cx * lean;
    leg.rotation.x = cz * -lean;
    derGroup.add(leg);
  };
  corner(1, 1);
  corner(-1, 1);
  corner(1, -1);
  corner(-1, -1);
  // substructure box the derrick stands on
  const sub = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 7), rustPatch);
  sub.position.y = 0.6;
  derGroup.add(sub);
  // lattice: rings + diagonals follow the legs' true lean (halfW 3.5 at deck -> 1.3 at crown)
  const halfW = (y: number) => 3.5 - 0.1 * y;
  const panels = 5;
  const panelH = derH / panels;
  for (let i = 0; i <= panels; i++) {
    const y = i * panelH;
    const s = halfW(y);
    for (const axis of [0, 1]) {
      for (const side of [-1, 1]) {
        const len = s * 2;
        const brace = new THREE.Mesh(new THREE.BoxGeometry(axis ? 0.16 : len, 0.16, axis ? len : 0.16), i % 2 ? rustPatch : boneSteel);
        brace.position.set(axis ? side * s : 0, y, axis ? 0 : side * s);
        derGroup.add(brace);
      }
    }
  }
  const upV = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < panels; i++) {
    const y0 = i * panelH;
    const y1 = y0 + panelH;
    const s0 = halfW(y0);
    const dirSign = i % 2 === 0 ? 1 : -1;
    for (const axis of [0, 1]) {
      for (const side of [-1, 1]) {
        const a =
          axis === 0
            ? new THREE.Vector3(-dirSign * s0, y0, side * s0)
            : new THREE.Vector3(side * s0, y0, -dirSign * s0);
        const b =
          axis === 0
            ? new THREE.Vector3(dirSign * s0, y1, side * s0)
            : new THREE.Vector3(side * s0, y1, dirSign * s0);
        const dir = b.clone().sub(a);
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.12, dir.length(), 0.12), i % 2 ? boneSteel : rustPatch);
        diag.quaternion.setFromUnitVectors(upV, dir.clone().normalize());
        diag.position.copy(a).addScaledVector(dir, 0.5);
        derGroup.add(diag);
      }
    }
  }
  const crown = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), rustPatch);
  crown.position.y = derH + 0.6;
  derGroup.add(crown);
  const hookCable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 10, 4), toon(0x222a2e));
  hookCable.position.y = derH - 5;
  derGroup.add(hookCable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4), toon(0xffb03a));
  hook.position.y = derH - 10.4;
  derGroup.add(hook);
  colliders.push({ x1: derX - 3.6, z1: derZ - 3.6, x2: derX + 3.6, z2: derZ + 3.6 });
  solids.push(derGroup);

  // rotating radar on derrick crown
  const radar = new THREE.Group();
  radar.position.set(derX, DECK_Y + derH + 1.8, derZ);
  const dish = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.16), toon(0xefe6d4));
  radar.add(dish);
  world.add(radar);

  /* ---------------- flare stack ---------------- */
  const flareBase = new THREE.Vector3(-21, DECK_Y, 13);
  const flareTip = new THREE.Vector3(-27, DECK_Y + 12, 13);
  const stackDir = flareTip.clone().sub(flareBase);
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.42, stackDir.length(), 8),
    toon(0x7d8a8f)
  );
  stack.position.copy(flareBase).addScaledVector(stackDir, 0.5);
  stack.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stackDir.clone().normalize());
  world.add(stack);
  solids.push(stack);
  const flareLight = new THREE.PointLight(0xff6a2a, 60, 70, 1.8);
  flareLight.position.copy(flareTip).add(new THREE.Vector3(0, 1, 0));
  world.add(flareLight);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 7), toon(0xffb03a, 0xff8a2a, 2.2));
  flame.position.copy(flareTip).add(new THREE.Vector3(0, 1.1, 0));
  world.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.4, 6), toon(0xffe08a, 0xffe08a, 2.6));
  flame2.position.copy(flareTip).add(new THREE.Vector3(0, 0.9, 0));
  world.add(flame2);

  /* ---------------- crane ---------------- */
  const crane = new THREE.Group();
  crane.position.set(15, DECK_Y, -12);
  world.add(crane);
  const craneBase = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 3), toon(0x8f3d16));
  craneBase.position.y = 0.7;
  crane.add(craneBase);
  const craneTower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 12, 1.1), toon(0xc65a17));
  craneTower.position.y = 7.2;
  crane.add(craneTower);
  const craneArm = new THREE.Group();
  craneArm.position.y = 13.4;
  crane.add(craneArm);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.7), toon(0xffd23f));
  jib.position.x = 3.4;
  craneArm.add(jib);
  const cjib = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 0.8), toon(0xc65a17));
  cjib.position.x = -2.6;
  craneArm.add(cjib);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.2), toon(0x57666b));
  counter.position.set(-4, -0.6, 0);
  craneArm.add(counter);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 7, 4), toon(0x222a2e));
  cable.position.set(7.6, -3.6, 0);
  craneArm.add(cable);
  const crateHook = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), toon(0x3e6e68));
  crateHook.position.set(7.6, -7.4, 0);
  craneArm.add(crateHook);
  colliders.push({ x1: 13.4, z1: -13.6, x2: 16.6, z2: -10.4 });
  solids.push(craneBase, craneTower);

  /* ---------------- containers + cargo ---------------- */
  const containerDefs: [number, number, number, number, number][] = [
    // x, z, rotY, color, stack
    [4, 9, 0, 0xc65a17, 1],
    [4, 12.2, 0, 0x3e6e68, 1],
    [-3, 13, 0.1, 0xa33a2a, 1],
    [11, -6, Math.PI / 2, 0xc9a227, 1],
    [-2, -12.5, -0.06, 0x3e6e68, 1],
    [19, 8, Math.PI / 2, 0xc65a17, 1],
  ];
  for (const [cx, cz, cr, cc] of containerDefs) {
    const g = new THREE.Group();
    g.position.set(cx, DECK_Y + 1.3, cz);
    g.rotation.y = cr;
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), toon(cc));
    g.add(body);
    for (const rx of [-2.2, 0, 2.2]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.62, 2.66), toon(0x14262d));
      rib.position.x = rx;
      g.add(rib);
    }
    world.add(g);
    const half = 3.1;
    const s = Math.abs(Math.sin(cr));
    const c = Math.abs(Math.cos(cr));
    const hx = half * c + 1.35 * s;
    const hz = half * s + 1.35 * c;
    colliders.push({ x1: cx - hx, z1: cz - hz, x2: cx + hx, z2: cz + hz });
    solids.push(body);
  }

  // pipe stack
  const pipeGroup = new THREE.Group();
  pipeGroup.position.set(-8, DECK_Y, 8);
  world.add(pipeGroup);
  const pipeMat = toon(0x8b9aa0);
  const pipeRows: [number, number][] = [
    [-1.2, 0.55],
    [0, 0.55],
    [1.2, 0.55],
    [-0.6, 1.6],
    [0.6, 1.6],
  ];
  for (const [px, py] of pipeRows) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7, 8), pipeMat);
    p.rotation.z = Math.PI / 2;
    p.position.set(0, py, px);
    pipeGroup.add(p);
  }
  colliders.push({ x1: -11.7, z1: 6.1, x2: -4.3, z2: 9.9 });
  solids.push(pipeGroup);

  /* ---------------- module building ---------------- */
  const bldg = new THREE.Group();
  bldg.position.set(-19, DECK_Y, -13);
  world.add(bldg);
  const bBody = new THREE.Mesh(new THREE.BoxGeometry(8, 4.6, 5.4), toon(0x355861));
  bBody.position.y = 2.3;
  bldg.add(bBody);
  const bRoof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.4, 5.8), toon(0x9c4a1c));
  bRoof.position.y = 4.8;
  bldg.add(bRoof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.1), toon(0xffb03a, 0xffb03a, 0.9));
  door.position.set(2.4, 1.3, 2.72);
  bldg.add(door);
  for (const wx of [-2.6, -0.6]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.1), toon(0x9fd8cf, 0x9fd8cf, 0.5));
    win.position.set(wx, 2.8, 2.72);
    bldg.add(win);
  }
  colliders.push({ x1: -23.2, z1: -15.9, x2: -14.8, z2: -10.1 });
  solids.push(bBody);

  /* ---------------- lamp posts ---------------- */
  const lampPosts: [number, number, boolean][] = [
    [0, -15.5, true],
    [10, 14.8, true],
    [-6, 0.5, false],
    [30, -9.2, false],
  ];
  const postLights: THREE.PointLight[] = [];
  for (const [px, pz, lit] of lampPosts) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), toon(0x3c4c52));
    post.position.set(px, DECK_Y + 3, pz);
    world.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), toon(0xffc46a, 0xffc46a, lit ? 1.6 : 0.2));
    head.position.set(px, DECK_Y + 6.05, pz);
    world.add(head);
    if (lit) {
      const pl = new THREE.PointLight(0xffb066, 26, 26, 1.8);
      pl.position.set(px, DECK_Y + 5.6, pz);
      world.add(pl);
      postLights.push(pl);
    }
    colliders.push({ x1: px - 0.25, z1: pz - 0.25, x2: px + 0.25, z2: pz + 0.25 });
  }

  /* ---------------- perimeter kick-walls ---------------- */
  const wallMat = toon(0x1b333c);
  const wallTop = toon(0xffb03a, 0xffb03a, 0.18);
  const mkWall = (w: number, d: number, x: number, z: number) => {
    mkBox(w, 1.0, d, wallMat, x, DECK_Y + 0.5, z);
    mkBox(w, 0.12, d, wallTop, x, DECK_Y + 1.02, z);
  };
  const wx = HW - LAYOUT.WALL_IN; // wall centerline x
  const wz = HD - LAYOUT.WALL_IN; // wall centerline z
  // north wall split for the tank farm doorway (x −T_DOOR_HALF .. T_DOOR_HALF)
  const nSeg = HW - LAYOUT.T_DOOR_HALF;
  mkWall(nSeg, LAYOUT.WALL_T, -(LAYOUT.T_DOOR_HALF + nSeg / 2), -wz);
  mkWall(nSeg, LAYOUT.WALL_T, LAYOUT.T_DOOR_HALF + nSeg / 2, -wz);
  for (const gx of [-LAYOUT.T_DOOR_HALF, LAYOUT.T_DOOR_HALF]) {
    mkBox(0.36, 1.25, 0.36, wallTop, gx, DECK_Y + 0.62, -wz, true);
  }
  // south wall split for the process yard doorway (x P_DOOR_X1 .. P_DOOR_X2)
  const sL = LAYOUT.P_DOOR_X1 + HW;
  mkWall(sL, LAYOUT.WALL_T, -HW + sL / 2, wz);
  const sR = HW - LAYOUT.P_DOOR_X2;
  mkWall(sR, LAYOUT.WALL_T, HW - sR / 2, wz);
  for (const gx of [LAYOUT.P_DOOR_X1, LAYOUT.P_DOOR_X2]) {
    mkBox(0.36, 1.25, 0.36, wallTop, gx, DECK_Y + 0.62, wz, true);
  }
  // west wall split for the crew quarters doorway (z −Q_DOOR_HALF .. Q_DOOR_HALF)
  const wSeg = HD - LAYOUT.Q_DOOR_HALF;
  mkWall(LAYOUT.WALL_T, wSeg, -wx, -(LAYOUT.Q_DOOR_HALF + wSeg / 2));
  mkWall(LAYOUT.WALL_T, wSeg, -wx, LAYOUT.Q_DOOR_HALF + wSeg / 2);
  for (const gz of [-LAYOUT.Q_DOOR_HALF, LAYOUT.Q_DOOR_HALF]) {
    mkBox(0.36, 1.25, 0.36, wallTop, -wx, DECK_Y + 0.62, gz, true);
  }
  // east wall split to leave the helipad walkway open (z -DOOR_HALF .. DOOR_HALF)
  const segD = wz - LAYOUT.DOOR_HALF;
  mkWall(LAYOUT.WALL_T, segD, wx, -(LAYOUT.DOOR_HALF + segD / 2));
  mkWall(LAYOUT.WALL_T, segD, wx, LAYOUT.DOOR_HALF + segD / 2);
  // hazard posts marking the doorway
  for (const gz of [-LAYOUT.DOOR_HALF, LAYOUT.DOOR_HALF]) {
    mkBox(0.36, 1.25, 0.36, wallTop, wx, DECK_Y + 0.62, gz, true);
  }
  // helipad walls (outer edges only, leaving gap to deck)
  mkWall(LAYOUT.PAD_W, LAYOUT.WALL_T, LAYOUT.PAD_X, -(LAYOUT.DOOR_HALF + 0.65));
  mkWall(LAYOUT.PAD_W, LAYOUT.WALL_T, LAYOUT.PAD_X, LAYOUT.DOOR_HALF + 0.65);
  mkWall(LAYOUT.WALL_T, LAYOUT.PAD_W, LAYOUT.PAD_X + LAYOUT.PAD_W / 2 - LAYOUT.WALL_IN, 0);

  /* ---------------- tactical cover kit ---------------- */
  const concreteMat = toon(0x7d8388);
  const concreteDark = toon(0x5c6266);
  const bagMat = toon(0x6b6a4e);
  const qWood = toon(0x6d5836);
  const qCrate = toon(0x5f6b3a);
  const jersey = (x: number, z: number, alongX: boolean) => {
    const w = alongX ? 2.2 : 0.7;
    const d = alongX ? 0.7 : 2.2;
    mkBox(w, 1.0, d, concreteMat, x, DECK_Y + 0.5, z, true);
    mkBox(w * 0.92, 0.14, d * 0.92, concreteDark, x, DECK_Y + 0.55, z);
  };
  const sandbags = (x: number, z: number, alongX: boolean) => {
    const w = alongX ? 2.6 : 0.95;
    const d = alongX ? 0.95 : 2.6;
    mkBox(w, 0.95, d, bagMat, x, DECK_Y + 0.47, z, true);
    mkBox(w * 0.72, 0.42, d * 0.72, bagMat, x, DECK_Y + 1.08, z, true);
  };
  const crates = (x: number, z: number) => {
    mkBox(2.2, 0.16, 2.2, qWood, x, DECK_Y + 0.08, z);
    mkBox(1.7, 1.0, 1.7, qCrate, x, DECK_Y + 0.66, z, true);
    mkBox(1.1, 0.75, 1.1, qWood, x + 0.15, DECK_Y + 1.55, z - 0.1, true);
  };
  const moduleLamp = (x: number, z: number) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), toon(0x3c4c52));
    post.position.set(x, DECK_Y + 3, z);
    world.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), toon(0xffc46a, 0xffc46a, 1.4));
    head.position.set(x, DECK_Y + 6.05, z);
    world.add(head);
    const pl = new THREE.PointLight(0xffb066, 22, 24, 1.8);
    pl.position.set(x, DECK_Y + 5.6, z);
    world.add(pl);
    colliders.push({ x1: x - 0.25, z1: z - 0.25, x2: x + 0.25, z2: z + 0.25 });
  };
  const moduleLegs = (cx: number, cz: number, hw: number, hd: number) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, DECK_Y - 1, 8), toon(0x22343c));
        leg.position.set(cx + sx * (hw - 1.6), (DECK_Y - 1) / 2 - 0.5, cz + sz * (hd - 1.6));
        world.add(leg);
      }
    }
  };
  const gantry = (x: number, z: number, alongX: boolean, span: number) => {
    const w = alongX ? span : 0.7;
    const d = alongX ? 0.7 : span;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), toon(0x8f3d16));
    beam.position.set(x, DECK_Y + 4.35, z);
    world.add(beam);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.16, d * 1.01), toon(0xffd23f, 0xffd23f, 0.25));
    stripe.position.set(x, DECK_Y + 4.62, z);
    world.add(stripe);
  };

  /* ---------------- crew quarters (west module) ---------------- */
  mkBox(LAYOUT.Q_W, 1.4, LAYOUT.Q_D, deckTop, LAYOUT.Q_X, DECK_Y - 0.7, 0);
  mkBox(LAYOUT.Q_W - 2, 1.6, LAYOUT.Q_D - 2, deckSide, LAYOUT.Q_X, DECK_Y - 2.1, 0);
  const qIn = LAYOUT.WALL_IN;
  mkWall(LAYOUT.Q_W, LAYOUT.WALL_T, LAYOUT.Q_X, -(LAYOUT.Q_D / 2 - qIn));
  mkWall(LAYOUT.Q_W, LAYOUT.WALL_T, LAYOUT.Q_X, LAYOUT.Q_D / 2 - qIn);
  mkWall(LAYOUT.WALL_T, LAYOUT.Q_D, LAYOUT.Q_X - LAYOUT.Q_W / 2 + qIn, 0);
  mkBox(LAYOUT.Q_W + 0.3, 0.18, 0.55, hazardMat2, LAYOUT.Q_X, DECK_Y - 0.05, -(LAYOUT.Q_D / 2 + 0.1));
  mkBox(0.55, 0.18, LAYOUT.Q_D + 0.3, hazardMat3, LAYOUT.Q_X - LAYOUT.Q_W / 2 - 0.1, DECK_Y - 0.05, 0);
  moduleLegs(LAYOUT.Q_X, 0, LAYOUT.Q_W / 2, LAYOUT.Q_D / 2);
  gantry(-wx, 0, false, LAYOUT.Q_DOOR_HALF * 2 + 1.6);
  // LQ block
  const lq = new THREE.Group();
  lq.position.set(-35, DECK_Y, -4.5);
  world.add(lq);
  const lqBody = new THREE.Mesh(new THREE.BoxGeometry(8, 4.8, 6), toon(0x355861));
  lqBody.position.y = 2.4;
  lq.add(lqBody);
  const lqRoof = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.4, 6.5), toon(0x9c4a1c));
  lqRoof.position.y = 5;
  lq.add(lqRoof);
  for (const wz2 of [-1.8, 0.2, 2.2]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.1), toon(0xffd9a0, 0xffd9a0, 0.9));
    win.position.set(4.02, 3, wz2);
    lq.add(win);
  }
  const lqDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 1.5), toon(0xffb03a, 0xffb03a, 0.9));
  lqDoor.position.set(4.02, 1.3, -2.2);
  lq.add(lqDoor);
  colliders.push({ x1: -39.2, z1: -7.7, x2: -30.8, z2: -1.3 });
  solids.push(lqBody);
  // workshop shed
  mkBox(5, 3, 4, toon(0x4a5a50), -33, DECK_Y + 1.5, 6.2, true);
  mkBox(5.4, 0.3, 4.4, toon(0x2f3d36), -33, DECK_Y + 3.1, 6.2);
  // cover
  sandbags(-26.5, 2.5, false);
  crates(-28.5, -6.5);
  jersey(-25.5, -3.5, false);
  moduleLamp(-27, 0);

  /* ---------------- process yard (south module) ---------------- */
  mkBox(LAYOUT.P_W, 1.4, LAYOUT.P_D, deckTop, LAYOUT.P_X, DECK_Y - 0.7, LAYOUT.P_Z);
  mkBox(LAYOUT.P_W - 2, 1.6, LAYOUT.P_D - 2, deckSide, LAYOUT.P_X, DECK_Y - 2.1, LAYOUT.P_Z);
  mkWall(LAYOUT.WALL_T, LAYOUT.P_D, LAYOUT.P_X - LAYOUT.P_W / 2 + qIn, LAYOUT.P_Z);
  mkWall(LAYOUT.WALL_T, LAYOUT.P_D, LAYOUT.P_X + LAYOUT.P_W / 2 - qIn, LAYOUT.P_Z);
  mkWall(LAYOUT.P_W, LAYOUT.WALL_T, LAYOUT.P_X, LAYOUT.P_Z + LAYOUT.P_D / 2 - qIn);
  mkBox(LAYOUT.P_W + 0.3, 0.18, 0.55, hazardMat, LAYOUT.P_X, DECK_Y - 0.05, LAYOUT.P_Z + LAYOUT.P_D / 2 + 0.1);
  mkBox(0.55, 0.18, LAYOUT.P_D + 0.3, hazardMat3, LAYOUT.P_X + LAYOUT.P_W / 2 + 0.1, DECK_Y - 0.05, LAYOUT.P_Z);
  moduleLegs(LAYOUT.P_X, LAYOUT.P_Z, LAYOUT.P_W / 2, LAYOUT.P_D / 2);
  gantry((LAYOUT.P_DOOR_X1 + LAYOUT.P_DOOR_X2) / 2, wz, true, LAYOUT.P_DOOR_X2 - LAYOUT.P_DOOR_X1 + 1.6);
  // horizontal separator vessels
  const vesselMat = toon(0x48606a);
  const vessel = (vx: number, vz: number) => {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 8, 12), vesselMat);
    v.rotation.z = Math.PI / 2;
    v.position.set(vx, DECK_Y + 1.85, vz);
    world.add(v);
    for (const dx of [-3.2, 3.2]) {
      mkBox(0.7, 1.0, 2.9, concreteDark, vx + dx, DECK_Y + 0.5, vz);
    }
    const cap1 = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 8), vesselMat);
    cap1.scale.set(0.35, 1, 1);
    cap1.position.set(vx - 4, DECK_Y + 1.85, vz);
    world.add(cap1);
    const cap2 = cap1.clone();
    cap2.position.x = vx + 4;
    world.add(cap2);
    colliders.push({ x1: vx - 4.4, z1: vz - 1.55, x2: vx + 4.4, z2: vz + 1.55 });
    solids.push(v);
  };
  vessel(0, 21);
  vessel(8, 26.2);
  // tall column vessel
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 10, 12), toon(0x5a7078));
  column.position.set(16.5, DECK_Y + 5, 21);
  world.add(column);
  const colTop = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8), toon(0x5a7078));
  colTop.position.set(16.5, DECK_Y + 10, 21);
  world.add(colTop);
  colliders.push({ x1: 15.2, z1: 19.7, x2: 17.8, z2: 22.3 });
  solids.push(column);
  // manifold skids
  mkBox(3.2, 1.1, 1.3, toon(0x37474e), -6, DECK_Y + 0.55, 25, true);
  mkBox(3.2, 1.1, 1.3, toon(0x37474e), 3, DECK_Y + 0.55, 28.4, true);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 8), toon(0xc65a17));
  valve.position.set(-6, DECK_Y + 1.7, 25);
  world.add(valve);
  // cover
  jersey(-2, 18.9, true);
  jersey(11.5, 23.6, false);
  sandbags(-7.5, 28.2, true);
  moduleLamp(1, 24.5);

  /* ---------------- tank farm (north module) ---------------- */
  mkBox(LAYOUT.T_W, 1.4, LAYOUT.T_D, deckTop, LAYOUT.T_X, DECK_Y - 0.7, LAYOUT.T_Z);
  mkBox(LAYOUT.T_W - 2, 1.6, LAYOUT.T_D - 2, deckSide, LAYOUT.T_X, DECK_Y - 2.1, LAYOUT.T_Z);
  mkWall(LAYOUT.WALL_T, LAYOUT.T_D, LAYOUT.T_X - LAYOUT.T_W / 2 + qIn, LAYOUT.T_Z);
  mkWall(LAYOUT.WALL_T, LAYOUT.T_D, LAYOUT.T_X + LAYOUT.T_W / 2 - qIn, LAYOUT.T_Z);
  mkWall(LAYOUT.T_W, LAYOUT.WALL_T, LAYOUT.T_X, LAYOUT.T_Z - LAYOUT.T_D / 2 + qIn);
  mkBox(LAYOUT.T_W + 0.3, 0.18, 0.55, hazardMat, LAYOUT.T_X, DECK_Y - 0.05, LAYOUT.T_Z - LAYOUT.T_D / 2 - 0.1);
  mkBox(0.55, 0.18, LAYOUT.T_D + 0.3, hazardMat2, LAYOUT.T_X - LAYOUT.T_W / 2 - 0.1, DECK_Y - 0.05, LAYOUT.T_Z);
  mkBox(0.55, 0.18, LAYOUT.T_D + 0.3, hazardMat3, LAYOUT.T_X + LAYOUT.T_W / 2 + 0.1, DECK_Y - 0.05, LAYOUT.T_Z);
  moduleLegs(LAYOUT.T_X, LAYOUT.T_Z, LAYOUT.T_W / 2, LAYOUT.T_D / 2);
  gantry(0, -wz, true, LAYOUT.T_DOOR_HALF * 2 + 1.6);
  // storage tanks
  const tankMat = toon(0x54666e);
  const tank = (tx: number, tz: number) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 6, 14), tankMat);
    t.position.set(tx, DECK_Y + 3, tz);
    world.add(t);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.58, 0.3, 14), toon(0x2f3d44));
    rim.position.set(tx, DECK_Y + 6, tz);
    world.add(rim);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), toon(0x22343c));
    vent.position.set(tx + 0.6, DECK_Y + 6.4, tz);
    world.add(vent);
    colliders.push({ x1: tx - 1.65, z1: tz - 1.65, x2: tx + 1.65, z2: tz + 1.65 });
    solids.push(t);
  };
  tank(-9, -21.5);
  tank(-9, -26.3);
  tank(9, -21.5);
  tank(9, -26.3);
  // pipe spool stack
  const spoolMat = toon(0x8b9aa0);
  for (const [sx, sy, sz] of [[-0.7, 0.62, 0], [0.7, 0.62, 0], [0, 1.75, 0]] as const) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.4, 10), spoolMat);
    sp.rotation.z = Math.PI / 2;
    sp.position.set(sx, DECK_Y + sy, LAYOUT.T_Z + sz);
    world.add(sp);
  }
  colliders.push({ x1: -2.4, z1: LAYOUT.T_Z - 1.1, x2: 2.4, z2: LAYOUT.T_Z + 1.1 });
  // cover
  jersey(-3.5, -19.3, true);
  jersey(4.5, -28.1, true);
  sandbags(13.5, -24, false);
  moduleLamp(-13, -24);

  /* ---------------- main deck tactical cover ---------------- */
  jersey(1, -3.5, true);
  jersey(-4.5, -4.5, false);
  jersey(8.5, 1.8, false);
  sandbags(17.2, 0.5, false);
  sandbags(-1, 10.8, true);
  crates(-12.5, 3.5);

  /* ---------------- spawn points ---------------- */
  const spawnPoints: THREE.Vector3[] = [];
  for (let x = -20; x <= 20; x += 8) {
    spawnPoints.push(new THREE.Vector3(x, DECK_Y, -15.6));
    spawnPoints.push(new THREE.Vector3(x, DECK_Y, 15.6));
  }
  for (let z = -12; z <= 12; z += 8) {
    spawnPoints.push(new THREE.Vector3(-22.6, DECK_Y, z));
  }
  spawnPoints.push(new THREE.Vector3(42.6, DECK_Y, -6));
  spawnPoints.push(new THREE.Vector3(42.6, DECK_Y, 0));
  spawnPoints.push(new THREE.Vector3(42.6, DECK_Y, 6));
  spawnPoints.push(new THREE.Vector3(34, DECK_Y, -8.6));
  spawnPoints.push(new THREE.Vector3(34, DECK_Y, 8.6));
  // crew quarters
  for (const sx of [-37.5, -31, -26]) spawnPoints.push(new THREE.Vector3(sx, DECK_Y, -7.7));
  for (const sx of [-36, -28]) spawnPoints.push(new THREE.Vector3(sx, DECK_Y, 7.7));
  spawnPoints.push(new THREE.Vector3(-38.7, DECK_Y, 3));
  // process yard
  for (const sx of [-7, 2, 11]) spawnPoints.push(new THREE.Vector3(sx, DECK_Y, 28.7));
  spawnPoints.push(new THREE.Vector3(18.7, DECK_Y, 24));
  spawnPoints.push(new THREE.Vector3(-8.7, DECK_Y, 26));
  // tank farm
  for (const sx of [-12, 0, 12]) spawnPoints.push(new THREE.Vector3(sx, DECK_Y, -28.7));
  spawnPoints.push(new THREE.Vector3(-14.7, DECK_Y, -20.5));
  spawnPoints.push(new THREE.Vector3(14.7, DECK_Y, -27));

  const bi = LAYOUT.BOUND_INSET;
  const boundaryRects: AABB[] = [
    { x1: -(HW - bi), z1: -(HD - bi), x2: HW - bi, z2: HD - bi },
    { x1: HW - bi, z1: -LAYOUT.DOOR_HALF, x2: LAYOUT.PAD_X + LAYOUT.PAD_W / 2 - bi, z2: LAYOUT.DOOR_HALF },
    { x1: LAYOUT.Q_X - LAYOUT.Q_W / 2 + bi, z1: -(LAYOUT.Q_D / 2 - bi), x2: -(HW - bi), z2: LAYOUT.Q_D / 2 - bi },
    { x1: LAYOUT.P_X - LAYOUT.P_W / 2 + bi, z1: HD - bi, x2: LAYOUT.P_X + LAYOUT.P_W / 2 - bi, z2: LAYOUT.P_Z + LAYOUT.P_D / 2 - bi },
    { x1: LAYOUT.T_X - LAYOUT.T_W / 2 + bi, z1: LAYOUT.T_Z - LAYOUT.T_D / 2 + bi, x2: LAYOUT.T_X + LAYOUT.T_W / 2 - bi, z2: -(HD - bi) },
  ];

  /* ---------------- animated bits ---------------- */
  let flickerT = 0;
  const update = (t: number, dt: number) => {
    seaMat.uniforms.uTime.value = t;
    radar.rotation.y = t * 1.4;
    craneArm.rotation.y = Math.sin(t * 0.12) * 0.9 + 0.6;
    hook.position.y = derH - 10.4 + Math.sin(t * 0.4) * 0.5;
    flickerT += dt * (7 + Math.sin(t * 2.3) * 3);
    const fl = 0.75 + 0.25 * Math.sin(flickerT * 3.1) * Math.sin(flickerT * 1.7 + 1.3);
    flareLight.intensity = 60 * fl;
    flame.scale.set(0.85 + fl * 0.3, 0.8 + fl * 0.5, 0.85 + fl * 0.3);
    flame.rotation.y = t * 2.4;
    flame2.scale.setScalar(0.7 + fl * 0.5);
    const blink = Math.sin(t * 3.4) > 0 ? 1.6 : 0.15;
    padLamps.forEach((l, i) => {
      (l.material as THREE.MeshToonMaterial).emissiveIntensity = Math.sin(t * 3.4 + i * 1.2) > 0 ? 1.8 : 0.12;
    });
    void blink;
    postLights.forEach((pl, i) => {
      pl.intensity = 26 * (0.92 + 0.08 * Math.sin(t * 13 + i * 7) * Math.sin(t * 3.7 + i));
    });
  };

  /* ---------------- deck clutter ---------------- */
  const barrelCols = [0x8c3a24, 0x4f5a33, 0x2f4250, 0x77713f];
  const ribMat = toon(0x17181a);
  const boomMat = toon(0xb3261e);
  const bandMat = toon(0xd8d3c4);
  // [x, z, colorIndex, tipped, explosive]
  const barrelAt: [number, number, number, boolean, boolean][] = [
    [-21.5, -12.8, 0, false, true],
    [-20.4, -13.9, 1, false, true],
    [-21.9, -14.4, 2, true, false],
    [20.5, 13.4, 1, false, true],
    [21.7, 14.3, 3, false, true],
    [19.4, 14.7, 0, true, false],
    [22, -13, 2, false, false],
    [-6.5, 14.2, 3, false, false],
    [-26.5, -6, 0, false, true],
    [-29.5, 3.2, 2, false, true],
    [14.5, 27.6, 0, false, true],
    [-6.5, 21.5, 1, false, true],
    [3.5, -21, 0, false, true],
    [-13, -27.5, 2, false, true],
  ];
  const barrels: BarrelRef[] = [];
  for (const [bx, bz, ci, tipped, explosive] of barrelAt) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.15, 10), explosive ? boomMat : toon(barrelCols[ci]));
    grp.add(body);
    const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.585, 0.07, 10), ribMat);
    r1.position.y = 0.3;
    const r2 = r1.clone();
    r2.position.y = -0.3;
    grp.add(r1, r2);
    if (explosive) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.565, 0.565, 0.16, 10), bandMat);
      grp.add(band);
      body.userData.bid = barrels.length;
      barrels.push({ group: grp, body, pos: new THREE.Vector3(bx, DECK_Y + 0.6, bz), hp: 1, alive: true });
    }
    if (tipped) {
      grp.rotation.z = Math.PI / 2;
      grp.rotation.y = Math.random() * Math.PI;
      grp.position.set(bx, DECK_Y + 0.56, bz);
    } else {
      grp.position.set(bx, DECK_Y + 0.58, bz);
    }
    world.add(grp);
    colliders.push({ x1: bx - 0.62, z1: bz - 0.62, x2: bx + 0.62, z2: bz + 0.62 });
  }
  for (const b of barrels) solids.push(b.body);
  for (const [rx3, rz] of [[-20.8, 9.2], [8.5, -13]] as const) {
    const reel = new THREE.Group();
    const discGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.14, 14);
    const d1 = new THREE.Mesh(discGeo, toon(0x5a4630));
    const d2 = new THREE.Mesh(discGeo, toon(0x5a4630));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.72, 12), toon(0x23262a));
    d1.rotation.z = Math.PI / 2;
    d2.rotation.z = Math.PI / 2;
    drum.rotation.z = Math.PI / 2;
    d1.position.x = -0.44;
    d2.position.x = 0.44;
    reel.add(d1, d2, drum);
    reel.position.set(rx3, DECK_Y + 1.16, rz);
    reel.rotation.y = Math.random() * Math.PI;
    world.add(reel);
    colliders.push({ x1: rx3 - 1.25, z1: rz - 1.25, x2: rx3 + 1.25, z2: rz + 1.25 });
  }
  const woodA = toon(0x6d5836);
  const woodB = toon(0x4c4a30);
  const crateMat = toon(0x5f6b3a);
  const palletAt: [number, number][] = [[-2, -13.2], [16.5, 14], [-20.5, 3.5]];
  palletAt.forEach(([px, pz], i) => {
    mkBox(2.4, 0.16, 2.4, woodA, px, DECK_Y + 0.08, pz);
    mkBox(1.6, 1.0, 1.6, i % 2 ? crateMat : woodB, px, DECK_Y + 0.66, pz, true);
    if (i === 0) mkBox(1.0, 0.8, 1.0, crateMat, px + 0.2, DECK_Y + 1.56, pz - 0.15, true);
    if (i === 2) mkBox(1.1, 0.7, 1.1, woodB, px - 0.15, DECK_Y + 1.51, pz + 0.2, true);
  });
  // steam vent
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.5, 8), toon(0x4a555a));
  vent.position.set(22.5, DECK_Y + 0.75, -14.2);
  world.add(vent);
  colliders.push({ x1: 22, z1: -14.7, x2: 23, z2: -13.7 });
  const puffs: { sp: THREE.Sprite; t: number; v: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8d9aa0, transparent: true, opacity: 0, depthWrite: false }));
    world.add(sp);
    puffs.push({ sp, t: i / 8, v: 0.1 + Math.random() * 0.05 });
  }
  // stuttering tripod work light
  const tripod = new THREE.Group();
  for (const ang of [0, 2.1, 4.2]) {
    const legT = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), toon(0x22262a));
    legT.position.set(Math.cos(ang) * 0.5, 1.15, Math.sin(ang) * 0.5);
    legT.rotation.z = Math.cos(ang) * 0.22;
    legT.rotation.x = -Math.sin(ang) * 0.22;
    tripod.add(legT);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.3), toon(0x2c3238));
  head.position.y = 2.4;
  const bulbPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bulbPlane.position.set(0, 2.4, 0.17);
  tripod.add(head, bulbPlane);
  tripod.position.set(6, DECK_Y, -13);
  tripod.rotation.y = 2.6;
  world.add(tripod);
  colliders.push({ x1: 5.4, z1: -13.6, x2: 6.6, z2: -12.4 });
  const workLight = new THREE.PointLight(0xffc078, 22, 16, 1.8);
  workLight.position.set(6, DECK_Y + 2.4, -12.6);
  world.add(workLight);
  const workGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb877, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  workGlow.position.copy(workLight.position);
  workGlow.scale.setScalar(2.4);
  world.add(workGlow);
  // flare glow sprites
  const flareGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a3c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  flareGlow.position.copy(flareTip);
  flareGlow.scale.setScalar(16);
  world.add(flareGlow);
  const flareCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  flareCore.position.copy(flareTip).add(new THREE.Vector3(0, 0.9, 0));
  flareCore.scale.setScalar(6);
  world.add(flareCore);
  // oil slick on the water
  const slick = new THREE.Mesh(new THREE.CircleGeometry(8, 24), new THREE.MeshBasicMaterial({ color: 0x04070a, transparent: true, opacity: 0.35 }));
  slick.rotation.x = -Math.PI / 2;
  slick.position.set(30, 0.3, 18);
  world.add(slick);
  const sheen = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20), new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false }));
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.set(31.5, 0.35, 17);
  world.add(sheen);

  /* ---------------- weather ---------------- */
  let windFactor = 0.2;
  const applyWeather = (w: BlendedWeather) => {
    const su = skyMat.uniforms;
    (su.uTop.value as THREE.Color).copy(w.skyTop);
    (su.uMid.value as THREE.Color).copy(w.skyMid);
    (su.uHor.value as THREE.Color).copy(w.skyHor);
    (su.uSunColor.value as THREE.Color).copy(w.sunColor);
    (su.uSun.value as THREE.Vector3).copy(w.sunDir);
    su.uSunI.value = w.sunIntensity;
    su.uFlash.value = w.flash;
    const eu = seaMat.uniforms;
    (eu.uSun.value as THREE.Vector3).copy(w.sunDir);
    (eu.uSunColor.value as THREE.Color).copy(w.sunColor);
    (eu.uDeep.value as THREE.Color).copy(w.seaDeep);
    (eu.uCrest.value as THREE.Color).copy(w.seaCrest);
    eu.uAmp.value = w.seaAmp;
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(w.fogColor);
    fog.near = w.fogNear;
    fog.far = w.fogFar;
    (eu.uFog.value as THREE.Color).copy(w.fogColor);
    hemi.color.copy(w.hemiSky);
    hemi.groundColor.copy(w.hemiGround);
    hemi.intensity = w.hemiIntensity;
    sun.color.copy(w.keyColor);
    sun.intensity = w.keyIntensity;
    sun.position.copy(w.sunDir).multiplyScalar(120);
    rim.color.copy(w.rimColor);
    rim.intensity = w.rimIntensity;
    stormLight.intensity = w.flash * 520;
    for (const c of cloudPlanes) c.mat.opacity = w.clouds * c.base * 0.85;
    for (const c of cloudPlanes) c.mat.color.copy(w.cloudTint);
    windFactor = w.wind;
  };

  const baseUpdate = update;
  const fullUpdate = (t: number, dt: number) => {
    baseUpdate(t, dt);
    for (const c of cloudPlanes) {
      c.mesh.position.x += (4 + 26 * windFactor) * c.drift * dt;
      if (c.mesh.position.x > 750) c.mesh.position.x = -750;
    }
    for (const p of puffs) {
      p.t = (p.t + dt * p.v) % 1;
      p.sp.position.set(22.5 + p.t * 2.4, DECK_Y + 1.6 + p.t * 6.5, -14.2 + Math.sin(p.t * 5) * 0.5);
      p.sp.scale.setScalar(0.7 + p.t * 3.4);
      (p.sp.material as THREE.SpriteMaterial).opacity = Math.sin(p.t * Math.PI) * 0.15;
    }
    const fl2 = 0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 29.7) * 0.05;
    flareGlow.scale.setScalar(16 * fl2);
    (flareGlow.material as THREE.SpriteMaterial).opacity = 0.55 + fl2 * 0.3;
    const wk = Math.sin(t * 31) > -0.94 ? 1 : 0.2;
    workLight.intensity = 22 * (0.9 + Math.sin(t * 3.7) * 0.1) * wk;
    (workGlow.material as THREE.SpriteMaterial).opacity = 0.5 * wk;
    bulbPlane.visible = wk > 0.5;
    beaconPivot.rotation.y = t * 2.4;
  };

  return {
    group: world,
    colliders,
    solids,
    spawnPoints,
    playerStart: new THREE.Vector3(2, DECK_Y, 5),
    flareTip,
    boundaryRects,
    barrels,
    beacon: { pivot: beaconPivot, light: beaconLight, mat: beaconMat },
    update: fullUpdate,
    applyWeather,
  };
}

import * as THREE from "three";

export const DECK_Y = 8;

export interface AABB {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface WorldRefs {
  group: THREE.Group;
  colliders: AABB[];
  solids: THREE.Object3D[];
  spawnPoints: THREE.Vector3[];
  playerStart: THREE.Vector3;
  flareTip: THREE.Vector3;
  boundaryRects: AABB[];
  update: (t: number, dt: number) => void;
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
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 top = vec3(0.024,0.075,0.105);
        vec3 mid = vec3(0.055,0.16,0.19);
        vec3 hor = vec3(0.09,0.20,0.235);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.2, 0.85, h));
        float sun = pow(max(dot(vDir, uSun), 0.0), 6.0);
        float core = pow(max(dot(vDir, uSun), 0.0), 90.0);
        col += vec3(1.0,0.42,0.16) * sun * 0.55;
        col += vec3(1.0,0.72,0.38) * core * 1.4;
        col += vec3(0.9,0.32,0.14) * exp(-abs(vDir.y+0.02)*14.0) * 0.35;
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
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vH;
      void main(){
        vec3 p = position;
        float w = sin(p.x*0.14 + uTime*0.9)*0.55
                + sin(p.y*0.19 + uTime*1.35)*0.4
                + sin((p.x+p.y)*0.06 + uTime*0.55)*0.8;
        p.z += w;
        vH = w;
        vec4 wp = modelMatrix * vec4(p,1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      varying float vH;
      uniform vec3 uFog;
      uniform vec3 uSun;
      void main(){
        vec3 deep = vec3(0.016,0.09,0.11);
        vec3 crest = vec3(0.05,0.26,0.30);
        vec3 col = mix(deep, crest, smoothstep(-1.2, 1.6, vH));
        vec3 toCam = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vec3(0.0,1.0,0.0));
        float spec = pow(max(dot(reflect(-uSun, n), toCam), 0.0), 24.0);
        col += vec3(1.0,0.5,0.22) * spec * 0.5;
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

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0x35606a, 0x1a120c, 1.05);
  world.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9550, 1.35);
  sun.position.set(-70, 30, -88);
  world.add(sun);
  const rim = new THREE.DirectionalLight(0x2fe6b0, 0.22);
  rim.position.set(60, 40, 70);
  world.add(rim);

  /* ---------------- main deck ---------------- */
  const deckTop = toon(0x2b4c57);
  const deckSide = toon(0x1b333c);
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

  mkBox(48, 1.4, 34, deckTop, 0, DECK_Y - 0.7, 0);
  // deck understructure
  mkBox(46, 1.6, 32, deckSide, 0, DECK_Y - 2.1, 0);
  // amber edge trims
  const trim = toon(0xffb03a, 0xffb03a, 0.35);
  mkBox(48.3, 0.18, 0.5, trim, 0, DECK_Y - 0.05, -17.1);
  mkBox(48.3, 0.18, 0.5, trim, 0, DECK_Y - 0.05, 17.1);
  mkBox(0.5, 0.18, 34.3, trim, -24.1, DECK_Y - 0.05, 0);

  // grating insets + lane paint
  const grate = toon(0x14262d);
  for (const [gx, gz, gw, gd] of [
    [-6, -2, 10, 6],
    [8, 4, 8, 8],
    [-14, 10, 7, 5],
    [16, -4, 6, 6],
  ] as const) {
    mkBox(gw, 0.06, gd, grate, gx, DECK_Y + 0.03, gz);
  }
  const paint = toon(0xffd23f, 0xffd23f, 0.25);
  mkBox(40, 0.05, 0.3, paint, 0, DECK_Y + 0.05, -4);
  mkBox(0.3, 0.05, 20, paint, 12, DECK_Y + 0.05, 2);
  mkBox(26, 0.05, 0.3, paint, -8, DECK_Y + 0.05, 13);

  /* ---------------- helipad ---------------- */
  const pad = toon(0x1d3138);
  mkBox(20, 1.0, 20, pad, 34, DECK_Y - 0.5, 0);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.6, 6.4, 36),
    toon(0xffd23f, 0xffd23f, 0.55)
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(34, DECK_Y + 0.06, 0);
  world.add(ring);
  const hMat = toon(0xffd23f, 0xffd23f, 0.55);
  mkBox(0.9, 0.08, 4.4, hMat, 32.6, DECK_Y + 0.07, 0);
  mkBox(0.9, 0.08, 4.4, hMat, 35.4, DECK_Y + 0.07, 0);
  mkBox(3.7, 0.08, 0.9, hMat, 34, DECK_Y + 0.07, 0);
  // pad edge lamps
  const lampBulb = toon(0xff5a2a, 0xff5a2a, 1.4);
  const padLamps: THREE.Mesh[] = [];
  for (const [lx, lz] of [
    [24.8, -9.4],
    [43.2, -9.4],
    [43.2, 9.4],
    [24.8, 9.4],
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
  const boneSteel = toon(0xd9d2bf);
  const rustPatch = toon(0x9c4a1c);
  const derGroup = new THREE.Group();
  derGroup.position.set(derX, DECK_Y, derZ);
  world.add(derGroup);
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
  for (let i = 0; i < 5; i++) {
    const y = 1.5 + i * (derH / 5);
    const s = 2.4 * (1 - (y / derH) * 0.45);
    for (const axis of [0, 1]) {
      for (const side of [-1, 1]) {
        const len = s * 2.35;
        const brace = new THREE.Mesh(new THREE.BoxGeometry(axis ? 0.16 : len, 0.16, axis ? len : 0.16), i % 2 ? rustPatch : boneSteel);
        brace.position.set(axis ? side * s : 0, y, axis ? 0 : side * s);
        derGroup.add(brace);
        const diag = new THREE.Mesh(new THREE.BoxGeometry(axis ? 0.12 : len * 1.18, 0.12, axis ? len * 1.18 : 0.12), boneSteel);
        diag.position.set(axis ? side * s : 0, y + derH / 10, axis ? 0 : side * s);
        diag.rotation.y = axis ? 0 : Math.PI / 4 * side;
        if (axis) diag.rotation.x = Math.PI / 4 * side;
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
  colliders.push({ x1: derX - 3.3, z1: derZ - 3.3, x2: derX + 3.3, z2: derZ + 3.3 });
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
  mkWall(48, 0.35, 0, -16.85);
  mkWall(48, 0.35, 0, 16.85);
  mkWall(0.35, 34, -23.85, 0);
  mkWall(0.35, 34, 23.85, 0);
  // helipad walls (outer edges only, leaving gap to deck)
  mkWall(20, 0.35, 34, -9.85);
  mkWall(20, 0.35, 34, 9.85);
  mkWall(0.35, 20, 43.85, 0);

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

  const boundaryRects: AABB[] = [
    { x1: -23.2, z1: -16.2, x2: 23.2, z2: 16.2 },
    { x1: 23.2, z1: -9.2, x2: 43.2, z2: 9.2 },
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

  return {
    group: world,
    colliders,
    solids,
    spawnPoints,
    playerStart: new THREE.Vector3(2, DECK_Y, 5),
    flareTip,
    boundaryRects,
    update,
  };
}

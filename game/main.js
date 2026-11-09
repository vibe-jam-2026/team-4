// Wings of War Forever: an endless 3D space-lane flyer with a JAS 39 Gripen E.
// Plain ES module + Three.js (vendored). No build step.
import * as THREE from './vendor/three.module.min.js';

// ============================================================ helpers
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
function angleDiff(a, b) { return ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; }
function lerpAngle(a, b, t) { return a + angleDiff(a, b) * t; }
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ============================================================ constants
const TILE = 3;            // panel length along a straight
const HALF = 3;            // half width of the lane (6 wide, corners 6x6)
const LANE_W = 2;          // three lanes at x = -2, 0, 2
const PATH_W = HALF * 2;
const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W in (x, z); N = -z
const yawOf = (d) => -d * Math.PI / 2;
const CRUISE = 1.3;        // flying altitude above the lane
const DIVE_ALT = 0.45;
const GRAVITY = 30;
const CLIMB_V = 10.5;      // pull-up: ~0.7 s, ~1.8 m above cruise
const DIVE_TIME = 0.75;
const BASE_SPEED = 15;
const MAX_SPEED = 34;
const CHASE_FAR = 18;
const BOLT_SPEED = 95;
const POWER_TIME = { magnet: 10, shield: 8, double: 12 };
const POWER_INFO = {
  magnet: { label: 'Tractor Beam', color: '#4d9bff' },
  shield: { label: 'Deflector', color: '#3fe0c5' },
  double: { label: 'Double Rings', color: '#ff5fae' },
};

// ============================================================ renderer / scene
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const HORIZON = new THREE.Color(0x1a1446);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.Fog(HORIZON, 55, 180);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 700);

// Background: gradient dome, stars, a ringed planet. Follows the camera.
const SUN_DIR = new THREE.Vector3(0.45, 0.35, -1).normalize();
const skyGroup = new THREE.Group();
scene.add(skyGroup);
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(520, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x03040c) },
      mid: { value: HORIZON.clone() },
      bot: { value: new THREE.Color(0x020208) },
      neb: { value: new THREE.Color(0x6a1f6e) },
      sunDir: { value: SUN_DIR },
      sunCol: { value: new THREE.Color(0xbfe4ff) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 neb; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.6)) : mix(mid, bot, pow(clamp(-h * 2.2, 0.0, 1.0), 0.6));
        float n = sin(vP.x * 5.0 + vP.y * 3.0) * sin(vP.z * 4.0 - vP.y * 6.0) * 0.5 + 0.5;
        c += neb * pow(n, 3.0) * 0.35 * (1.0 - abs(h));
        float s = max(dot(normalize(vP), sunDir), 0.0);
        c += sunCol * (pow(s, 500.0) * 2.5 + pow(s, 30.0) * 0.3 + pow(s, 5.0) * 0.06);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -2;
skyGroup.add(sky);
{
  const n = 1800;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * 480;
    pos[i * 3] = Math.cos(t) * r; pos[i * 3 + 1] = u * 480; pos[i * 3 + 2] = Math.sin(t) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
  stars.renderOrder = -1;
  skyGroup.add(stars);
}
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(110, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x4a7fc8, emissive: 0x0b1a3a, roughness: 1, fog: false }),
);
planet.position.set(-230, -150, -300);
skyGroup.add(planet);
const pring = new THREE.Mesh(
  new THREE.RingGeometry(140, 210, 64),
  new THREE.MeshBasicMaterial({ color: 0xc9a5ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false, depthWrite: false }),
);
pring.position.copy(planet.position);
pring.rotation.set(1.25, 0.2, 0.3);
skyGroup.add(pring);

const hemi = new THREE.HemisphereLight(0xa8c4ff, 0x261040, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xe8f2ff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

// ============================================================ materials & geometry
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, flatShading: true, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const M = {
  panel: std(0xffffff, { roughness: 0.55, metalness: 0.4 }),
  corner: std(0x3a4560, { metalness: 0.5 }),
  frame: std(0x252c40, { metalness: 0.6 }),
  rail: basic(0x3ff2ff),
  railRed: basic(0xff3b6b),
  warn: basic(0xffb020),
  laser: basic(0xff2950),
  energy: basic(0xff3b6b, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  rock: std(0x6d6278, { roughness: 1, metalness: 0 }),
  rockDark: std(0x4a4256, { roughness: 1, metalness: 0 }),
  crystal: std(0xa35cff, { emissive: 0x5a1fb0, emissiveIntensity: 0.9 }),
  station: std(0x8792a8, { metalness: 0.6 }),
  window: basic(0xffd27a),
  ring: new THREE.MeshStandardMaterial({ color: 0x5ff9ff, emissive: 0x16b8d0, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.3 }),
  beacon: basic(0x6cff9e),
  // jet
  jet: std(0x8f989f, { roughness: 0.6, metalness: 0.35 }),
  jetDark: std(0x5f676e, { roughness: 0.6, metalness: 0.35 }),
  jetBlack: std(0x23272b, { roughness: 0.4, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, emissive: 0x153a5a, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.15 }),
  flameOuter: basic(0xff8a3d, { transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
  flameInner: basic(0x9fe8ff, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
  navRed: basic(0xff3030),
  navGreen: basic(0x30ff60),
  bolt: basic(0x7dff6a),
  // drone
  drone: std(0x2b3040, { metalness: 0.7, roughness: 0.4 }),
  droneEye: basic(0xff2a2a),
  droneRing: basic(0xff4a3a, { transparent: true, opacity: 0.8 }),
  // pickups
  magnet: new THREE.MeshStandardMaterial({ color: 0x4d9bff, emissive: 0x1a4cff, emissiveIntensity: 0.9, roughness: 0.4 }),
  shield: new THREE.MeshStandardMaterial({ color: 0x3fe0c5, emissive: 0x0f8a76, emissiveIntensity: 0.9, roughness: 0.3 }),
  double: new THREE.MeshStandardMaterial({ color: 0xff5fae, emissive: 0x991d5c, emissiveIntensity: 0.9, roughness: 0.3 }),
  halo: basic(0xffffff, { transparent: true, opacity: 0.5, depthWrite: false }),
  bubble: basic(0x3fe0c5, { transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }),
  spark: basic(0xffc060, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
};

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

const G = {
  tile: new THREE.BoxGeometry(PATH_W, 0.4, TILE),
  corner: new THREE.BoxGeometry(PATH_W, 0.4, PATH_W),
  rail: new THREE.BoxGeometry(0.16, 0.16, TILE - 0.25),
  seam: new THREE.BoxGeometry(PATH_W - 0.6, 0.03, 0.06),
  ring: new THREE.TorusGeometry(0.42, 0.08, 8, 20),
  rock: new THREE.DodecahedronGeometry(1, 0),
  rock2: new THREE.IcosahedronGeometry(1, 0),
  crystal: new THREE.OctahedronGeometry(1, 0),
  halo: new THREE.TorusGeometry(0.75, 0.05, 6, 24),
  magnet: new THREE.TorusGeometry(0.38, 0.13, 8, 16, Math.PI),
  gem: new THREE.OctahedronGeometry(0.5, 0),
  ico: new THREE.IcosahedronGeometry(0.45, 0),
  bubble: new THREE.SphereGeometry(1.9, 16, 12),
  bolt: new THREE.BoxGeometry(0.08, 0.08, 1.6),
  spark: new THREE.BoxGeometry(0.18, 0.18, 0.18),
  beacon: new THREE.SphereGeometry(0.16, 8, 6),
};

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _col = new THREE.Color();
const _euler = new THREE.Euler();

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, shadows = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (shadows) { m.castShadow = true; m.receiveShadow = true; }
  if (parent) parent.add(m);
  return m;
}

// flat extruded plate from 2D points
function plate(points, depth) {
  const sh = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
}

// ============================================================ the JAS 39 Gripen E (low-poly)
function makeGripen() {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const air = new THREE.Group(); // pitch / roll happen on this group
  air.rotation.order = 'YXZ';
  root.add(air);
  const body = new THREE.Group();
  body.scale.setScalar(0.85);
  air.add(body);

  // fuselage, nose, spine
  const fus = mesh(new THREE.CylinderGeometry(0.3, 0.34, 3.0, 10).rotateX(Math.PI / 2), M.jet, 0, 0, 0.1, body);
  fus.scale.y = 0.85;
  mesh(new THREE.ConeGeometry(0.3, 1.25, 10).rotateX(-Math.PI / 2), M.jet, 0, -0.02, -2.0, body).scale.y = 0.8;
  mesh(new THREE.ConeGeometry(0.06, 0.4, 6).rotateX(-Math.PI / 2), M.jetBlack, 0, -0.02, -2.75, body); // pitot
  mesh(boxGeo(0.3, 0.16, 1.9), M.jetDark, 0, 0.27, 0.45, body); // dorsal spine
  // canopy
  const can = mesh(new THREE.SphereGeometry(0.24, 12, 8), M.glass, 0, 0.24, -1.15, body);
  can.scale.set(0.85, 0.75, 2.4);
  // intakes
  for (const s of [-1, 1]) {
    mesh(boxGeo(0.26, 0.42, 1.2), M.jetDark, s * 0.36, -0.05, -0.35, body);
    mesh(boxGeo(0.2, 0.34, 0.05), M.jetBlack, s * 0.36, -0.05, -0.96, body, false);
  }
  // delta wings (shape x = span, y = world z)
  const wingR = plate([[0.25, -0.55], [1.75, 0.95], [1.75, 1.2], [0.25, 1.25]], 0.06).rotateX(Math.PI / 2);
  const wingL = plate([[-0.25, -0.55], [-0.25, 1.25], [-1.75, 1.2], [-1.75, 0.95]], 0.06).rotateX(Math.PI / 2);
  mesh(wingR, M.jet, 0, -0.04, 0, body);
  mesh(wingL, M.jet, 0, -0.04, 0, body);
  // wingtip missile rails
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6).rotateX(Math.PI / 2), M.jetDark, s * 1.78, -0.04, 0.6, body);
  // canards
  const canR = plate([[0.3, -1.05], [0.95, -0.55], [0.95, -0.42], [0.3, -0.45]], 0.04).rotateX(Math.PI / 2);
  const canL = plate([[-0.3, -1.05], [-0.3, -0.45], [-0.95, -0.42], [-0.95, -0.55]], 0.04).rotateX(Math.PI / 2);
  mesh(canR, M.jet, 0, 0.1, 0, body);
  mesh(canL, M.jet, 0, 0.1, 0, body);
  // single vertical tail (shape x = world z, y = height)
  const tail = plate([[0.35, 0.3], [1.2, 1.25], [1.5, 1.25], [1.55, 0.3]], 0.06).rotateY(-Math.PI / 2);
  mesh(tail, M.jet, 0.03, 0, 0, body);
  mesh(boxGeo(0.07, 0.12, 0.28), M.jetBlack, 0, 1.18, 1.35, body);
  // engine nozzle and afterburner
  mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.4, 10).rotateX(Math.PI / 2), M.jetBlack, 0, 0, 1.75, body);
  const flame = new THREE.Group();
  flame.position.set(0, 0, 1.95);
  body.add(flame);
  mesh(new THREE.ConeGeometry(0.22, 1.4, 10).rotateX(-Math.PI / 2), M.flameOuter, 0, 0, 0.7, flame, false);
  mesh(new THREE.ConeGeometry(0.12, 0.8, 8).rotateX(-Math.PI / 2), M.flameInner, 0, 0, 0.4, flame, false);
  // nav lights
  mesh(boxGeo(0.08, 0.08, 0.08), M.navRed, -1.78, 0, 0.05, body, false);
  mesh(boxGeo(0.08, 0.08, 0.08), M.navGreen, 1.78, 0, 0.05, body, false);
  // deflector bubble
  const bubble = mesh(G.bubble, M.bubble, 0, 0, 0, air, false);
  bubble.scale.set(1.1, 0.6, 1.6);
  bubble.visible = false;
  return { root, air, body, flame, bubble };
}

// ============================================================ the hunter drone (the chaser)
function makeDrone() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const core = mesh(G.crystal, M.drone, 0, 0, 0, body);
  core.scale.set(1.3, 0.6, 1.8);
  for (const s of [-1, 1]) {
    mesh(boxGeo(0.18, 0.18, 2.0), M.drone, s * 0.85, 0, -0.9, body);
    mesh(boxGeo(0.22, 0.22, 0.22), M.droneEye, s * 0.85, 0, -1.95, body, false);
    const fin = mesh(boxGeo(1.2, 0.08, 0.7), M.drone, s * 1.3, 0.1, 0.4, body);
    fin.rotation.z = s * 0.35;
  }
  const eye = mesh(new THREE.SphereGeometry(0.32, 12, 8), M.droneEye, 0, 0.1, -1.2, body, false);
  const ring = mesh(new THREE.TorusGeometry(1.6, 0.07, 6, 32).rotateX(Math.PI / 2), M.droneRing, 0, 0, 0.1, body, false);
  return { root, body, eye, ring };
}

const jet = makeGripen();
scene.add(jet.root);
const drone = makeDrone();
scene.add(drone.root);

// ============================================================ world generation
// The space lane is a chain of straights. Each starts at a corner centre P, runs in
// direction dir for L metres and ends at the next corner. Headings are only ever
// N, E or W, so the lane can never loop back over itself.
let straights = [];
let passed = [];
let removeQueue = [];

function endPoint(st) { return { x: st.P.x + st.fx * st.L, z: st.P.z + st.fz * st.L }; }
function worldOf(st, s, x, y, out) { return out.set(st.P.x + st.fx * s + st.rx * x, y, st.P.z + st.fz * s + st.rz * x); }

function createStraight(P, dir, opts = {}) {
  const first = !!opts.first;
  const L = first ? 111 : randInt(17, 38) * 3;
  let corner;
  if (dir === 0) corner = pick(['L', 'R', 'L', 'R', 'T']);
  else corner = dir === 1 ? 'L' : 'R';
  const f = DIRV[dir];
  const r = DIRV[(dir + 1) % 4];
  const st = {
    P: { x: P.x, z: P.z }, dir, L, corner, first,
    fx: f[0], fz: f[1], rx: r[0], rz: r[1],
    sStart: first ? -15 : HALF,
    obstacles: [], coins: [], powers: [], beacons: [], spinners: [],
    next: null, armL: null, armR: null, dead: false,
    group: new THREE.Group(), coinMesh: null,
  };
  st.group.position.set(P.x, 0, P.z);
  st.group.rotation.y = yawOf(dir);
  populate(st);
  build(st);
  scene.add(st.group);
  straights.push(st);
  return st;
}

function difficulty() { return clamp(game.dist / 4000, 0, 1); }

function populate(st) {
  const diff = difficulty();
  const end = st.L - 16;
  let s = st.first ? 38 : 4;
  for (;;) {
    s += rand(lerp(20, 10, diff), lerp(30, 17, diff));
    if (s > end) break;
    const r = Math.random();
    const type = r < 0.3 ? 'fence' : r < 0.6 ? 'gate' : 'rock';
    if (type === 'rock') {
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const n = Math.random() < 0.35 + 0.4 * diff ? 2 : 1;
      for (const l of lanes.slice(0, n)) st.obstacles.push({ type, s, half: 0.9, lane: l, meshes: [] });
    } else {
      st.obstacles.push({ type, s, half: 0.5, meshes: [] });
    }
  }

  // energy-ring rows (arching over fences, dipping under doors, avoiding asteroid lanes)
  let cs = st.first ? 16 : 8;
  while (cs < st.L - 14) {
    cs += rand(5, 15);
    const n = randInt(5, 10);
    const lane = randInt(-1, 1);
    for (let k = 0; k < n; k++) {
      const s2 = cs + k * 1.8;
      if (s2 > st.L - 12) break;
      let y = CRUISE;
      let blocked = false;
      for (const ob of st.obstacles) {
        const d = Math.abs(s2 - ob.s);
        if (ob.type === 'rock' && ob.lane === lane && d < 1.9) blocked = true;
        if (ob.type === 'fence' && d < 4.5) y = Math.max(y, CRUISE + 1.5 * (1 - (d / 4.5) ** 2));
        if (ob.type === 'gate' && d < 2.5) y = Math.min(y, 0.6);
      }
      if (!blocked) st.coins.push({ s: s2, x: lane * LANE_W, y, taken: false });
    }
    cs += n * 1.8;
  }

  // the odd power-up
  if (!st.first && Math.random() < 0.42) {
    const s2 = rand(18, st.L - 20);
    const near = st.obstacles.filter((ob) => Math.abs(ob.s - s2) < 4);
    const free = [-1, 0, 1].filter((l) => !near.some((ob) => ob.type !== 'rock' || ob.lane === l));
    if (free.length) st.powers.push({ s: s2, x: pick(free) * LANE_W, type: pick(['magnet', 'shield', 'double']), taken: false, mesh: null });
  }
}

function chevron(parent, x, y, z, side, mat) {
  // arrow ">" (side = 1) or "<" (side = -1) made of two bars
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const a = mesh(boxGeo(0.95, 0.22, 0.08), mat, 0, 0.28, 0, g, false);
  const b = mesh(boxGeo(0.95, 0.22, 0.08), mat, 0, -0.28, 0, g, false);
  a.rotation.z = -side * 0.6;
  b.rotation.z = side * 0.6;
  parent.add(g);
  return g;
}

function build(st) {
  const g = st.group;
  const L = st.L;

  // lane panels, neon side rails and seams as instanced meshes
  const tiles = [];
  for (let s = st.sStart; s < L - HALF - 0.01; s += TILE) tiles.push(s + TILE / 2);
  const tm = new THREE.InstancedMesh(G.tile, M.panel, tiles.length);
  const rm = new THREE.InstancedMesh(G.rail, M.rail, tiles.length * 2);
  const sm = new THREE.InstancedMesh(G.seam, M.rail, tiles.length);
  tm.receiveShadow = true;
  tiles.forEach((c, i) => {
    _m4.makeTranslation(0, -0.2, -c);
    tm.setMatrixAt(i, _m4);
    _col.setHSL(0.62 + rand(-0.02, 0.02), 0.22, i % 2 ? 0.3 : 0.26);
    tm.setColorAt(i, _col);
    _m4.makeTranslation(-2.9, 0.08, -c); rm.setMatrixAt(i * 2, _m4);
    _m4.makeTranslation(2.9, 0.08, -c); rm.setMatrixAt(i * 2 + 1, _m4);
    _m4.makeTranslation(0, 0.01, -c + TILE / 2); sm.setMatrixAt(i, _m4);
  });
  g.add(tm, rm, sm);
  // lane markers
  for (const x of [-1, 1]) mesh(boxGeo(0.05, 0.02, L - HALF - st.sStart), M.frame, x, 0.01, -(st.sStart + L - HALF) / 2, g, false);

  // corner pad, energy wall and turn arrows
  mesh(G.corner, M.corner, 0, -0.2, -L, g).castShadow = false;
  mesh(boxGeo(PATH_W + 1.2, 0.5, 0.6), M.frame, 0, 0.0, -L - 3.3, g);
  mesh(boxGeo(PATH_W + 1.2, 0.3, 0.6), M.frame, 0, 4.3, -L - 3.3, g);
  mesh(boxGeo(0.5, 4.6, 0.6), M.frame, -3.6, 2.1, -L - 3.3, g);
  mesh(boxGeo(0.5, 4.6, 0.6), M.frame, 3.6, 2.1, -L - 3.3, g);
  mesh(boxGeo(PATH_W + 1, 4.0, 0.05), M.energy, 0, 2.15, -L - 3.3, g, false);
  const turnSides = st.corner === 'T' ? [-1, 1] : [st.corner === 'L' ? -1 : 1];
  for (const sd of turnSides) {
    for (let k = 0; k < 2; k++) chevron(g, sd * (0.8 + k * 1.1), 2.2, -L - 3.0, sd, M.warn);
  }
  if (st.corner === 'L') mesh(boxGeo(0.16, 0.16, PATH_W), M.railRed, 2.9, 0.08, -L, g, false);
  if (st.corner === 'R') mesh(boxGeo(0.16, 0.16, PATH_W), M.railRed, -2.9, 0.08, -L, g, false);
  // underside glow strip
  mesh(boxGeo(1.0, 0.05, L - st.sStart), M.rail, 0, -0.42, -(st.sStart + L) / 2, g, false);

  // beacons along the edges
  let side = Math.random() < 0.5 ? -1 : 1;
  for (let s = st.sStart + 10; s < L - 8; s += 21) {
    const x = side * 3.2;
    mesh(boxGeo(0.18, 1.6, 0.18), M.frame, x, 0.6, -s, g);
    st.beacons.push(mesh(G.beacon, M.beacon, x, 1.5, -s, g, false));
    side = -side;
  }

  // obstacles
  for (const ob of st.obstacles) {
    if (ob.type === 'fence') {
      // low laser fence: pull up over it
      ob.meshes.push(mesh(boxGeo(0.35, 2.3, 0.35), M.frame, -3.0, 1.0, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(0.35, 2.3, 0.35), M.frame, 3.0, 1.0, -ob.s, g));
      for (const y of [0.35, 0.95, 1.55, 2.05]) ob.meshes.push(mesh(boxGeo(PATH_W, 0.07, 0.07), M.laser, 0, y, -ob.s, g, false));
      ob.meshes.push(mesh(boxGeo(PATH_W, 2.0, 0.03), M.energy, 0, 1.15, -ob.s, g, false));
    } else if (ob.type === 'gate') {
      // high blast door: dive under it
      ob.meshes.push(mesh(boxGeo(0.6, 4.5, 0.8), M.frame, -3.3, 1.9, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(0.6, 4.5, 0.8), M.frame, 3.3, 1.9, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(PATH_W + 0.6, 3.1, 0.6), M.station, 0, 2.55, -ob.s, g));
      for (let i = -2; i <= 2; i++) {
        const stripe = mesh(boxGeo(0.4, 0.25, 0.05), i % 2 ? M.warn : M.frame, i * 1.2, 1.15, -ob.s - 0.32, g, false);
        stripe.rotation.z = 0.5;
        ob.meshes.push(stripe);
      }
      ob.meshes.push(mesh(boxGeo(PATH_W, 0.06, 0.06), M.railRed, 0, 0.98, -ob.s - 0.32, g, false));
    } else if (ob.type === 'rock') {
      // asteroid in a lane: dodge it or shoot it
      const holder = new THREE.Group();
      holder.position.set(ob.lane * LANE_W, CRUISE, -ob.s);
      const r = mesh(Math.random() < 0.5 ? G.rock : G.rock2, Math.random() < 0.5 ? M.rock : M.rockDark, 0, 0, 0, holder);
      r.scale.set(rand(0.9, 1.05), rand(0.85, 1.1), rand(0.85, 1.0));
      r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(holder);
      ob.meshes.push(holder);
      st.spinners.push({ m: r, sx: rand(-1, 1), sy: rand(-1, 1) });
    }
  }

  // energy rings: one instanced mesh per straight
  if (st.coins.length) {
    st.coinMesh = new THREE.InstancedMesh(G.ring, M.ring, st.coins.length);
    st.coins.forEach((c, i) => {
      _m4.makeTranslation(c.x, c.y, -c.s);
      st.coinMesh.setMatrixAt(i, _m4);
    });
    g.add(st.coinMesh);
  }

  // power-ups
  for (const p of st.powers) {
    const holder = new THREE.Group();
    holder.position.set(p.x, CRUISE, -p.s);
    if (p.type === 'magnet') {
      mesh(G.magnet, M.magnet, 0, 0, 0, holder).rotation.z = Math.PI;
    } else if (p.type === 'shield') {
      mesh(G.gem, M.shield, 0, 0, 0, holder);
    } else {
      mesh(G.ico, M.double, 0, 0, 0, holder);
    }
    mesh(G.halo, M.halo, 0, 0, 0, holder, false);
    g.add(holder);
    p.mesh = holder;
  }

  // scenery: asteroids, crystal shards and station spires
  const n = Math.floor(st.L / 12);
  for (let i = 0; i < n; i++) {
    const s = rand(14, Math.max(16, L - 14));
    const sd = Math.random() < 0.5 ? -1 : 1;
    const x = sd * rand(11, 33);
    const kind = Math.random();
    if (kind < 0.5) {
      const r = mesh(Math.random() < 0.5 ? G.rock : G.rock2, Math.random() < 0.5 ? M.rock : M.rockDark, x, rand(-14, 16), -s, g, false);
      r.scale.set(rand(1.5, 5), rand(1.2, 4), rand(1.5, 5));
      r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      st.spinners.push({ m: r, sx: rand(-0.2, 0.2), sy: rand(-0.2, 0.2) });
    } else if (kind < 0.75) {
      const c = mesh(G.crystal, M.crystal, x, rand(-10, 10), -s, g, false);
      c.scale.set(rand(0.6, 1.4), rand(2.5, 5), rand(0.6, 1.4));
      c.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4));
    } else {
      const top = rand(-6, 14);
      const h = top + 70;
      const sp = mesh(cylGeo(0.9, 1.4, 1, 8), M.station, x, top - h / 2, -s, g, false);
      sp.scale.y = h;
      mesh(cylGeo(2.6, 2.6, 1.2, 12), M.frame, x, top + 0.6, -s, g, false);
      mesh(cylGeo(2.65, 2.65, 0.3, 12), M.window, x, top + 0.6, -s, g, false);
      mesh(cylGeo(0.08, 0.08, 4, 4), M.frame, x, top + 3.2, -s, g, false);
      st.beacons.push(mesh(G.beacon, M.railRed, x, top + 5.3, -s, g, false));
    }
  }

  // launch station behind the very first straight
  if (st.first) {
    mesh(boxGeo(20, 1.2, 14), M.frame, 0, -0.8, 21, g);
    mesh(boxGeo(1.4, 9, 1.4), M.station, -5, 4, 13, g);
    mesh(boxGeo(1.4, 9, 1.4), M.station, 5, 4, 13, g);
    mesh(boxGeo(11.4, 1.6, 1.6), M.station, 0, 8.5, 13, g);
    mesh(boxGeo(9, 0.2, 0.2), M.rail, 0, 7.6, 12.2, g, false);
    mesh(boxGeo(20, 14, 2), M.station, 0, 6, 27, g);
    for (let i = -3; i <= 3; i++) mesh(boxGeo(1.6, 0.6, 0.1), M.window, i * 2.6, 10, 25.9, g, false);
  }
}

function disposeStraight(st) {
  if (!st || st.dead) return;
  st.dead = true;
  scene.remove(st.group);
  st.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  straights = straights.filter((x) => x !== st);
}

function spawnNext(st) {
  const nd = st.corner === 'L' ? (st.dir + 3) % 4 : (st.dir + 1) % 4;
  st.next = createStraight(endPoint(st), nd);
  return st.next;
}

function spawnArms(st) {
  const E = endPoint(st);
  st.armL = createStraight(E, (st.dir + 3) % 4);
  st.armR = createStraight(E, (st.dir + 1) % 4);
}

function ensureAhead() {
  let n = player.st;
  let c = 0;
  for (;;) {
    if (n.next) { n = n.next; c++; continue; }
    if (n.corner === 'T') { if (!n.armL) spawnArms(n); return; }
    if (c >= 3) return;
    n = spawnNext(n);
    c++;
  }
}

function activeStraights() {
  const out = [];
  let n = player.st;
  for (let i = 0; n && i < 4; i++) {
    out.push(n);
    if (n.armL) { out.push(n.armL, n.armR); break; }
    n = n.next;
  }
  return out;
}

// ============================================================ game state
const player = {
  st: null, s: 0, x: 0, y: 0, vy: 0, lane: 0, alt: CRUISE,
  air: false, slideT: 0, pendingTurn: 0, fireCd: 0,
  magnet: 0, shield: 0, double: 0,
  yaw: 0, pos: new THREE.Vector3(),
};
const game = {
  state: 'loading', slow: 0, dist: 0, score: 0, coins: 0, speed: BASE_SPEED, mult: 1,
  chaseGap: 4, chaseHold: 1.5, stumbleT: 0, deathT: 0, deathKind: '', time: 0,
  trail: [], camYaw: 0, camY: 3.4, camPull: 0, nextMilestone: 500,
  best: store.get('starlane.best', 0), bank: store.get('starlane.bank', 0),
};
const flyingCoins = [];
const coinPool = [];
const bolts = [];
const boltPool = [];
const sparks = [];
const sparkPool = [];

function newGame() {
  for (const st of [...straights]) disposeStraight(st);
  straights = []; passed = []; removeQueue = [];
  for (const c of flyingCoins) c.mesh.visible = false;
  coinPool.push(...flyingCoins.splice(0));
  for (const b of bolts) b.mesh.visible = false;
  boltPool.push(...bolts.splice(0));
  for (const p of sparks) p.mesh.visible = false;
  sparkPool.push(...sparks.splice(0).map((p) => p.mesh));
  Object.assign(game, {
    dist: 0, slow: 0, score: 0, coins: 0, speed: BASE_SPEED, mult: 1,
    chaseGap: 12, chaseHold: 0, stumbleT: 0, deathT: 0, deathKind: '',
    trail: [], camYaw: 0, camY: 3.4, camPull: 0, nextMilestone: 500,
  });
  Object.assign(player, {
    s: 0, x: 0, y: 0, vy: 0, lane: 0, alt: CRUISE, air: false, slideT: 0, pendingTurn: 0, fireCd: 0,
    magnet: 0, shield: 0, double: 0, yaw: 0,
  });
  player.st = createStraight({ x: 0, z: 0 }, 0, { first: true });
  ensureAhead();
  for (let d = -30; d <= 0; d += 1) game.trail.push({ d, x: 0, y: CRUISE, z: -d });
  jet.root.visible = true;
  jet.air.rotation.set(0, 0, 0);
  jet.bubble.visible = false;
  drone.root.visible = true;
  updatePlayerWorld();
  hud.reset();
}

// ============================================================ controls / actions
function turnWindow() { return Math.max(8, game.speed * 0.62); }

function tryTurn(side) {
  const st = player.st;
  if (player.s < st.L - HALF - turnWindow() || player.s > st.L + HALF) return false;
  const ok = st.corner === 'T' || (st.corner === 'L' && side < 0) || (st.corner === 'R' && side > 0);
  if (!ok) return false;
  player.pendingTurn = side;
  return true;
}

function executeTurn() {
  const st = player.st;
  const side = player.pendingTurn;
  player.pendingTurn = 0;
  let nx;
  if (st.corner === 'T') {
    nx = side < 0 ? st.armL : st.armR;
    removeQueue.push({ st: side < 0 ? st.armR : st.armL, t: 1.5 });
    st.next = nx;
  } else {
    nx = st.next;
  }
  const ds = player.s - st.L;
  const relx = st.fx * ds + st.rx * player.x;
  const relz = st.fz * ds + st.rz * player.x;
  player.s = relx * nx.fx + relz * nx.fz;
  player.x = relx * nx.rx + relz * nx.rz;
  player.lane = clamp(Math.round(player.x / LANE_W), -1, 1);
  passed.push(st);
  while (passed.length > 2) disposeStraight(passed.shift());
  player.st = nx;
  ensureAhead();
  game.score += 25 * game.mult;
  sfx('turn');
}

function changeLane(side) {
  const target = player.lane + side;
  if (target < -1 || target > 1) return;
  for (const ob of player.st.obstacles) {
    if (ob.type === 'rock' && !ob.smashed && ob.lane === target && Math.abs(player.s - ob.s) < ob.half + 0.5) {
      if (player.shield > 0) break;
      stumble();
      return;
    }
  }
  player.lane = target;
  sfx('swish');
}

function actSide(side) {
  if (game.state !== 'playing') return;
  if (!tryTurn(side)) changeLane(side);
}
function actClimb() {
  if (game.state !== 'playing' || player.air) return;
  player.vy = CLIMB_V; player.air = true; player.slideT = 0;
  sfx('climb');
}
function actDive() {
  if (game.state !== 'playing') return;
  if (player.air) player.vy = Math.min(player.vy, -22);
  if (player.slideT <= 0) sfx('dive');
  player.slideT = DIVE_TIME;
}
function actFire() {
  if (game.state !== 'playing' || player.fireCd > 0) return;
  player.fireCd = 0.2;
  for (const off of [-0.75, 0.75]) {
    const m = boltPool.pop() || new THREE.Mesh(G.bolt, M.bolt);
    if (!m.parent) scene.add(m);
    m.visible = true;
    bolts.push({ mesh: m, st: player.st, s: player.s + 1.5, x: player.x + off, y: player.alt, life: 0.7 });
  }
  sfx('laser');
}

function stumble() {
  sfx('stumble');
  if (game.stumbleT > 0) { die('caught'); return; }
  game.stumbleT = 7;
  game.chaseGap = 3.4;
  game.chaseHold = 2.4;
  game.slow = 0.12;
  hud.toast('Hull scraped!');
  shake = 0.35;
}

function smash(ob, byLaser) {
  ob.smashed = true;
  for (const m of ob.meshes) m.visible = false;
  const st = player.st;
  worldOf(st, ob.s, ob.type === 'rock' ? ob.lane * LANE_W : 0, ob.type === 'rock' ? CRUISE : 1.5, _v);
  burst(_v, ob.type === 'rock' ? 0xffb060 : 0xff5070, 18);
  sfx('boom');
  if (byLaser) game.score += 50 * game.mult;
}

function hitObstacle(ob) {
  if (player.shield > 0) { smash(ob, false); shake = 0.25; return; }
  die(ob.type);
}

function die(kind) {
  if (game.state !== 'playing') return;
  game.state = 'dying';
  game.deathKind = kind;
  game.deathT = 0;
  player.slideT = 0;
  shake = 0.6;
  burst(player.pos, 0xff9040, 34);
  sfx('death');
  stopMusic();
}

// ============================================================ particles
function burst(pos, color, n) {
  for (let i = 0; i < n; i++) {
    let m = sparkPool.pop();
    if (!m) { m = new THREE.Mesh(G.spark, M.spark.clone()); scene.add(m); }
    m.material.color.setHex(i % 3 ? color : 0xffffff);
    m.material.opacity = 1;
    m.visible = true;
    m.position.copy(pos);
    m.scale.setScalar(rand(0.6, 1.6));
    sparks.push({ mesh: m, vx: rand(-9, 9), vy: rand(-5, 9), vz: rand(-9, 9), life: rand(0.4, 0.9), t: 0 });
  }
}
function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.t += dt;
    if (p.t >= p.life) { p.mesh.visible = false; sparkPool.push(p.mesh); sparks.splice(i, 1); continue; }
    p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += dt * 8;
    p.mesh.material.opacity = 1 - p.t / p.life;
  }
}

// space dust streaking past for a sense of speed
const DUST_N = 260;
const dustPos = new Float32Array(DUST_N * 3);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false }));
dust.frustumCulled = false;
scene.add(dust);
let dustReady = false;
function updateDust() {
  const fx = -Math.sin(game.camYaw);
  const fz = -Math.cos(game.camYaw);
  const c = camera.position;
  for (let i = 0; i < DUST_N; i++) {
    const o = i * 3;
    const dx = dustPos[o] - c.x;
    const dz = dustPos[o + 2] - c.z;
    const ahead = dx * fx + dz * fz;
    if (!dustReady || ahead < -2 || ahead > 80 || Math.abs(dx * fz - dz * fx) > 30) {
      const a = dustReady ? rand(55, 80) : rand(0, 80);
      const side = rand(-28, 28);
      dustPos[o] = c.x + fx * a - fz * side;
      dustPos[o + 1] = rand(-12, 14);
      dustPos[o + 2] = c.z + fz * a + fx * side;
    }
  }
  dustReady = true;
  dustGeo.attributes.position.needsUpdate = true;
}

// ============================================================ per-frame simulation
let shake = 0;

function updatePlayerWorld() {
  worldOf(player.st, player.s, player.x, player.alt, player.pos);
}

function updatePlaying(dt) {
  const st = player.st;
  game.slow = Math.max(0, game.slow - dt * 0.04);
  game.speed = Math.min(MAX_SPEED, BASE_SPEED + Math.sqrt(game.dist) * 0.34) * (1 - game.slow);
  const sp = game.speed;
  player.s += sp * dt;
  game.dist += sp * dt;
  game.mult = Math.min(10, 1 + Math.floor(game.dist / 500));
  game.score += sp * dt * 0.6 * game.mult;
  if (game.dist >= game.nextMilestone) {
    hud.toast(`${game.nextMilestone} m  ·  x${game.mult}`);
    sfx('power');
    game.nextMilestone += 500;
  }
  if (player.fireCd > 0) player.fireCd -= dt;

  // lateral and vertical motion
  player.x += (player.lane * LANE_W - player.x) * damp(13, dt);
  if (player.slideT > 0) player.slideT -= dt;
  if (player.air) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.air = false; }
  }
  const altTarget = player.slideT > 0 ? DIVE_ALT : CRUISE + player.y;
  player.alt = player.air ? altTarget : lerp(player.alt, altTarget, damp(16, dt));

  // corners
  if (player.pendingTurn && player.s >= st.L - 1.0) executeTurn();
  else if (player.s > st.L + HALF - 0.7) { die('wall'); return; }

  // obstacles
  const cur = player.st;
  for (const ob of cur.obstacles) {
    if (ob.smashed) continue;
    if (Math.abs(player.s - ob.s) > ob.half + 0.4) continue;
    if (ob.type === 'fence' && player.y < 0.9) hitObstacle(ob);
    else if (ob.type === 'gate' && player.alt > 0.8) hitObstacle(ob);
    else if (ob.type === 'rock' && Math.abs(player.x - ob.lane * LANE_W) < 1.35) hitObstacle(ob);
    if (game.state !== 'playing') return;
  }

  // energy rings
  const mag = player.magnet > 0;
  if (cur.coinMesh) {
    for (let i = 0; i < cur.coins.length; i++) {
      const c = cur.coins[i];
      if (c.taken) continue;
      const ds = c.s - player.s;
      if (mag && ds > -1 && ds < 11) {
        takeCoin(cur, i);
        launchFlyingCoin(cur, c);
      } else if (Math.abs(ds) < 1.0 && Math.abs(c.x - player.x) < 1.2 && Math.abs(c.y - player.alt) < 1.0) {
        takeCoin(cur, i);
        collectCoin();
      }
    }
  }

  // power-ups
  for (const p of cur.powers) {
    if (p.taken) continue;
    if (Math.abs(p.s - player.s) < 1.2 && Math.abs(p.x - player.x) < 1.3 && Math.abs(player.alt - CRUISE) < 1.3) {
      p.taken = true;
      p.mesh.visible = false;
      player[p.type] = POWER_TIME[p.type];
      sfx('power');
      hud.toast(POWER_INFO[p.type].label + '!');
    }
  }
  for (const k of ['magnet', 'shield', 'double']) if (player[k] > 0) player[k] = Math.max(0, player[k] - dt);
  jet.bubble.visible = player.shield > 0 && (player.shield > 1.5 || Math.floor(game.time * 8) % 2 === 0);

  // chaser
  if (game.stumbleT > 0) game.stumbleT -= dt;
  if (game.chaseHold > 0) game.chaseHold -= dt;
  else game.chaseGap = Math.min(CHASE_FAR, game.chaseGap + dt * 2.4);

  updatePlayerWorld();
  game.trail.push({ d: game.dist, x: player.pos.x, y: player.alt, z: player.pos.z });
  while (game.trail.length > 2 && game.trail[1].d < game.dist - 45) game.trail.shift();
}

function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.s += (BOLT_SPEED + game.speed) * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.s > b.st.L + HALF || b.st.dead;
    if (!dead) {
      for (const ob of b.st.obstacles) {
        if (ob.smashed || ob.type !== 'rock') continue;
        if (Math.abs(b.s - ob.s) < 1.3 && Math.abs(b.x - ob.lane * LANE_W) < 1.1) {
          smash(ob, true);
          dead = true;
          break;
        }
      }
    }
    if (dead) { b.mesh.visible = false; boltPool.push(b.mesh); bolts.splice(i, 1); continue; }
    worldOf(b.st, b.s, b.x, b.y, b.mesh.position);
    b.mesh.rotation.set(0, yawOf(b.st.dir), 0);
  }
}

function takeCoin(st, i) {
  st.coins[i].taken = true;
  _m4.compose(_zero, _q.identity(), _zero);
  st.coinMesh.setMatrixAt(i, _m4);
  st.coinMesh.instanceMatrix.needsUpdate = true;
}

function collectCoin() {
  const v = player.double > 0 ? 2 : 1;
  game.coins += v;
  game.score += 10 * v * game.mult;
  sfx('coin');
}

function launchFlyingCoin(st, c) {
  const m = coinPool.pop() || new THREE.Mesh(G.ring, M.ring);
  if (!m.parent) scene.add(m);
  m.visible = true;
  worldOf(st, c.s, c.x, c.y, m.position);
  flyingCoins.push({ mesh: m, t: 0 });
}

function updateFlyingCoins(dt) {
  for (let i = flyingCoins.length - 1; i >= 0; i--) {
    const f = flyingCoins[i];
    f.t += dt;
    _v.copy(player.pos);
    const d = _v.sub(f.mesh.position);
    const len = d.length();
    const step = (25 + game.speed) * dt * (1 + f.t * 3);
    if (len < 0.6 || step >= len) {
      f.mesh.visible = false;
      coinPool.push(f.mesh);
      flyingCoins.splice(i, 1);
      if (game.state === 'playing') collectCoin();
    } else {
      f.mesh.position.addScaledVector(d, step / len);
      f.mesh.rotation.y += dt * 12;
    }
  }
}

function updateDying(dt) {
  game.deathT += dt;
  const k = game.deathKind;
  // the jet tumbles and drops away, then explodes
  if (game.deathT < 1.2) {
    player.s += game.speed * dt * Math.max(0, 0.6 - game.deathT);
    player.alt -= dt * (2 + game.deathT * 6);
  }
  game.chaseGap = lerp(game.chaseGap, 2.6, damp(k === 'caught' ? 6 : 2.5, dt));
  updatePlayerWorld();
  if (game.deathT > 0.3 && jet.root.visible && Math.random() < dt * 8) burst(player.pos, 0xff7030, 4);
  if (game.deathT > 1.0 && jet.root.visible) { jet.root.visible = false; burst(player.pos, 0xffc060, 30); sfx('boom'); }
  if (game.deathT > 2.1 && game.state === 'dying') gameOver();
}

function chaserPosition(out) {
  const tr = game.trail;
  const d = game.dist - game.chaseGap;
  let i = tr.length - 1;
  while (i > 0 && tr[i - 1].d > d) i--;
  const a = tr[Math.max(0, i - 1)];
  const b = tr[i];
  const t = b.d === a.d ? 1 : clamp((d - a.d) / (b.d - a.d), 0, 1);
  // when close, the drone rises so it looms above the jet instead of blocking the view
  const rise = 2.6 * clamp((9 - game.chaseGap) / 5, 0, 1);
  out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t) + 0.5 + rise, lerp(a.z, b.z, t));
  let j = i;
  while (j < tr.length - 1 && tr[j].d < d + 2) j++;
  const hx = tr[j].x - out.x;
  const hz = tr[j].z - out.z;
  return Math.hypot(hx, hz) > 0.01 ? Math.atan2(-hx, -hz) : null;
}

// ============================================================ animation
function animateJet(dt) {
  const k = damp(10, dt);
  const targetYaw = yawOf(player.st.dir);
  const yawErr = angleDiff(player.yaw, targetYaw);
  player.yaw = lerpAngle(player.yaw, targetYaw, damp(9, dt));
  let pitch = 0;
  let roll = 0;
  if (game.state === 'dying' || game.state === 'over') {
    jet.air.rotation.z += dt * 9;
    jet.air.rotation.x = lerp(jet.air.rotation.x, -0.6, k);
    jet.root.position.copy(player.pos);
    return;
  }
  if (game.state === 'menu' || game.state === 'loading') {
    roll = Math.sin(game.time * 1.2) * 0.12;
    pitch = Math.sin(game.time * 0.9) * 0.05;
    jet.root.position.y = CRUISE + Math.sin(game.time * 1.7) * 0.12;
  } else {
    const dx = player.lane * LANE_W - player.x;
    roll = clamp(-dx * 0.45, -0.9, 0.9) - clamp(yawErr * 1.6, -1.1, 1.1);
    pitch = player.air ? clamp(player.vy * 0.045, -0.5, 0.45) : 0;
    if (player.slideT > 0 && player.alt > DIVE_ALT + 0.15) pitch = -0.3;
    jet.root.position.y = player.pos.y + Math.sin(game.time * 3.1) * 0.04;
  }
  jet.air.rotation.z = lerp(jet.air.rotation.z, roll, k);
  jet.air.rotation.x = lerp(jet.air.rotation.x, pitch, k);
  jet.root.position.x = player.pos.x;
  jet.root.position.z = player.pos.z;
  jet.root.rotation.y = player.yaw;
  const boost = game.state === 'playing' ? 0.9 + (game.speed - BASE_SPEED) / 40 : 0.6;
  jet.flame.scale.set(1, 1, boost * (0.85 + Math.random() * 0.3));
}

function animateDrone(dt) {
  const yaw = chaserPosition(drone.root.position);
  drone.root.position.y += Math.sin(game.time * 4) * 0.15;
  if (yaw !== null) drone.root.rotation.y = lerpAngle(drone.root.rotation.y, yaw, damp(8, dt));
  drone.ring.rotation.y += dt * 4;
  drone.body.rotation.z = Math.sin(game.time * 2.3) * 0.15;
  const pulse = 0.6 + 0.4 * Math.sin(game.time * 9);
  M.droneEye.color.setRGB(1, 0.15 + 0.2 * pulse, 0.1 + 0.1 * pulse);
  drone.eye.scale.setScalar(0.85 + 0.3 * pulse);
}

function animateWorld(dt) {
  const t = game.time;
  _q.setFromEuler(_euler.set(0, 0, t * 2));
  for (const st of activeStraights()) {
    if (st.coinMesh) {
      for (let i = 0; i < st.coins.length; i++) {
        const c = st.coins[i];
        if (c.taken) continue;
        const pulse = 1 + Math.sin(t * 6 + c.s) * 0.08;
        _v.set(c.x, c.y, -c.s);
        _v2.set(pulse, pulse, pulse);
        _m4.compose(_v, _q, _v2);
        st.coinMesh.setMatrixAt(i, _m4);
      }
      st.coinMesh.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < st.beacons.length; i++) {
      st.beacons[i].visible = Math.sin(t * 4 + i * 1.7) > -0.3;
    }
    for (const sp of st.spinners) {
      sp.m.rotation.x += sp.sx * dt;
      sp.m.rotation.y += sp.sy * dt;
    }
    for (const p of st.powers) {
      if (p.taken) continue;
      p.mesh.rotation.y = t * 2.2;
      p.mesh.position.y = CRUISE + Math.sin(t * 3 + p.s) * 0.15;
    }
  }
  for (let i = removeQueue.length - 1; i >= 0; i--) {
    removeQueue[i].t -= dt;
    if (removeQueue[i].t <= 0) { disposeStraight(removeQueue[i].st); removeQueue.splice(i, 1); }
  }
}

function updateCamera(dt) {
  const targetYaw = yawOf(player.st.dir);
  game.camYaw = lerpAngle(game.camYaw, targetYaw, damp(game.state === 'menu' ? 3 : 6, dt));
  const fx = -Math.sin(game.camYaw);
  const fz = -Math.cos(game.camYaw);
  const portrait = camera.aspect < 0.9;
  const ended = game.state === 'dying' || game.state === 'over';
  game.camPull = lerp(game.camPull, ended ? 1 : 0, damp(ended ? 2 : 20, dt));
  const back = (portrait ? 8.2 : 7.2) + game.camPull * 6;
  const up = (portrait ? 3.6 : 3.1) + game.camPull * 4;
  worldOf(player.st, player.s, player.x * 0.5, 0, _v);
  const altFollow = ended ? CRUISE : player.alt;
  game.camY = lerp(game.camY, up + (altFollow - CRUISE) * 0.55, damp(7, dt));
  let cx = _v.x - fx * back;
  let cz = _v.z - fz * back;
  let cy = game.camY;
  if (game.state === 'menu') {
    const a = game.time * 0.25;
    cx += Math.sin(a) * 1.0; cy += Math.sin(a * 1.3) * 0.25;
  }
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    cx += rand(-1, 1) * shake * 0.6; cy += rand(-1, 1) * shake * 0.6;
  }
  camera.position.set(cx, cy, cz);
  _v2.set(_v.x + fx * 7, CRUISE + 0.3 + (altFollow - CRUISE) * 0.4, _v.z + fz * 7);
  camera.lookAt(_v2);
  // bank the camera a touch with the jet
  if (game.state === 'playing') camera.rotateZ(jet.air.rotation.z * 0.12);
  const fovTarget = (portrait ? 78 : 64) + (game.state === 'playing' ? (game.speed - BASE_SPEED) * 0.4 : 0);
  camera.fov = lerp(camera.fov, fovTarget, damp(2, dt));
  camera.updateProjectionMatrix();

  skyGroup.position.copy(camera.position);
  sun.position.set(player.pos.x + 14, 32, player.pos.z + 10);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
}

// ============================================================ audio (WebAudio synth, no files)
let actx = null, master = null, musicBus = null, noiseBuf = null;
let muted = store.get('starlane.muted', false);
let musicTimer = null, musicNext = 0, musicStep = 0, musicBar = 0;

function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(actx.destination);
  musicBus = actx.createGain();
  musicBus.gain.value = 0.38;
  musicBus.connect(master);
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(t, freq, dur, type = 'sine', vol = 0.3, slideTo = 0, dest = master, cutoff = 0) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) {
    const f = actx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 6;
    o.connect(f).connect(g).connect(dest);
  } else {
    o.connect(g).connect(dest);
  }
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(t, dur, vol, freq, q = 1, type = 'bandpass', dest = master) {
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function sfx(name) {
  if (!actx || muted) return;
  const t = actx.currentTime;
  switch (name) {
    case 'coin': tone(t, 1046, 0.1, 'sine', 0.12); tone(t + 0.05, 1568, 0.16, 'sine', 0.1); break;
    case 'climb': tone(t, 220, 0.35, 'sawtooth', 0.08, 520, master, 1400); noise(t, 0.3, 0.12, 1200, 0.6); break;
    case 'dive': tone(t, 500, 0.3, 'sawtooth', 0.07, 180, master, 1200); noise(t, 0.3, 0.12, 900, 0.6); break;
    case 'swish': noise(t, 0.16, 0.13, 2200, 1.0); break;
    case 'turn': noise(t, 0.3, 0.18, 800, 0.7); tone(t, 330, 0.2, 'triangle', 0.08, 660); break;
    case 'laser': tone(t, 1500, 0.14, 'square', 0.06, 280); break;
    case 'stumble': tone(t, 160, 0.3, 'sawtooth', 0.15, 60, master, 900); noise(t, 0.25, 0.3, 500, 0.8); break;
    case 'boom': noise(t, 0.6, 0.55, 300, 0.5, 'lowpass'); tone(t, 120, 0.5, 'sine', 0.45, 35); break;
    case 'power': [523, 784, 1046, 1568].forEach((f, i) => tone(t + i * 0.06, f, 0.18, 'triangle', 0.14)); break;
    case 'death': noise(t, 1.2, 0.6, 400, 0.4, 'lowpass'); tone(t, 200, 1.0, 'sawtooth', 0.18, 40, master, 800); break;
    default: break;
  }
}

// synthwave loop: driving bass, four-on-the-floor, arpeggio
const CHORDS = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8], [82.4, 98, 123.5]];
function musicStepAt(step, t) {
  const ch = CHORDS[musicBar % 4];
  if (step % 4 === 0) tone(t, 140, 0.25, 'sine', 0.8, 45, musicBus);
  if (step === 4 || step === 12) noise(t, 0.18, 0.35, 1800, 0.7, 'bandpass', musicBus);
  if (step % 2 === 1) noise(t, 0.04, 0.08, 8000, 0.8, 'highpass', musicBus);
  tone(t, (ch[0] / 2) * (step % 2 ? 2 : 1), 0.12, 'sawtooth', 0.12, 0, musicBus, 600);
  tone(t, ch[step % 3] * (step % 8 < 4 ? 4 : 2), 0.1, 'square', 0.035, 0, musicBus, 3200);
}
function startMusic() {
  if (!actx || musicTimer) return;
  musicNext = actx.currentTime + 0.05;
  musicStep = 0;
  musicTimer = setInterval(() => {
    const bpm = 120 + (game.speed - BASE_SPEED) * 1.2;
    while (musicNext < actx.currentTime + 0.12) {
      musicStepAt(musicStep, musicNext);
      musicNext += 60 / bpm / 4;
      musicStep = (musicStep + 1) % 16;
      if (musicStep === 0) musicBar++;
    }
  }, 25);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
function setMuted(m) {
  muted = m;
  store.set('starlane.muted', m);
  if (master) master.gain.value = m ? 0 : 0.5;
  ui.muteBtn.textContent = m ? '🔇' : '🔊';
}

// ============================================================ UI
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), dist: $('dist'), mult: $('mult'), coins: $('coins'), powers: $('powers'), toast: $('toast'),
  menu: $('menu'), pause: $('pause'), over: $('over'), loading: $('loading'),
  muteBtn: $('muteBtn'), bestMenu: $('bestMenu'), bankMenu: $('bankMenu'),
  finalScore: $('finalScore'), finalDist: $('finalDist'), finalCoins: $('finalCoins'),
  newBest: $('newBest'), deathMsg: $('deathMsg'),
};
const show = (el, v) => el.classList.toggle('hidden', !v);

const hud = {
  last: {},
  toastTimer: 0,
  powerEls: {},
  reset() { this.last = {}; ui.powers.innerHTML = ''; this.powerEls = {}; },
  set(key, el, val) { if (this.last[key] !== val) { this.last[key] = val; el.textContent = val; } },
  update() {
    this.set('score', ui.score, Math.floor(game.score).toLocaleString('en-US'));
    this.set('dist', ui.dist, Math.floor(game.dist));
    this.set('mult', ui.mult, 'x' + game.mult);
    this.set('coins', ui.coins, game.coins);
    for (const k of ['magnet', 'shield', 'double']) {
      const v = player[k];
      let el = this.powerEls[k];
      if (v > 0 && !el) {
        el = document.createElement('div');
        el.className = 'power';
        el.innerHTML = `<div class="bar"><i style="background:${POWER_INFO[k].color}"></i></div><span>${POWER_INFO[k].label}</span>`;
        ui.powers.appendChild(el);
        this.powerEls[k] = el;
      }
      if (el) {
        if (v <= 0) { el.remove(); delete this.powerEls[k]; } else el.firstChild.firstChild.style.width = `${(v / POWER_TIME[k]) * 100}%`;
      }
    }
  },
  toast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1300);
  },
};

function refreshMenuStats() {
  ui.bestMenu.textContent = Math.floor(game.best).toLocaleString('en-US');
  ui.bankMenu.textContent = game.bank.toLocaleString('en-US');
}

function startRun() {
  initAudio();
  if (game.state !== 'menu') newGame();
  game.state = 'playing';
  show(ui.menu, false); show(ui.over, false); show(ui.pause, false); show(ui.hud, true);
  hud.toast('Launch!');
  sfx('power');
  startMusic();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  stopMusic();
  show(ui.pause, true);
}
function resumeGame() {
  if (game.state !== 'paused') return;
  initAudio();
  game.state = 'playing';
  show(ui.pause, false);
  startMusic();
}
function toMenu() {
  stopMusic();
  newGame();
  game.state = 'menu';
  refreshMenuStats();
  show(ui.pause, false); show(ui.over, false); show(ui.hud, false); show(ui.menu, true);
}

function gameOver() {
  game.state = 'over';
  const score = Math.floor(game.score);
  const record = score > game.best;
  if (record) { game.best = score; store.set('starlane.best', score); }
  game.bank += game.coins;
  store.set('starlane.bank', game.bank);
  const msgs = {
    wall: 'You missed the turn and hit the barrier',
    fence: 'You flew into a laser fence',
    gate: 'You hit a blast door',
    rock: 'You hit an asteroid',
    caught: 'The hunter drone shot you down',
  };
  ui.deathMsg.textContent = msgs[game.deathKind] || 'Mission over';
  ui.finalScore.textContent = score.toLocaleString('en-US');
  ui.finalDist.textContent = `${Math.floor(game.dist)} m`;
  ui.finalCoins.textContent = game.coins;
  ui.newBest.classList.toggle('record', record);
  ui.newBest.innerHTML = record ? 'New best score!' : `Best: <b>${Math.floor(game.best).toLocaleString('en-US')}</b>`;
  show(ui.hud, false);
  show(ui.over, true);
}

$('playBtn').addEventListener('click', startRun);
$('againBtn').addEventListener('click', startRun);
$('menuBtn').addEventListener('click', toMenu);
$('resumeBtn').addEventListener('click', resumeGame);
$('quitBtn').addEventListener('click', toMenu);
$('pauseBtn').addEventListener('click', pauseGame);
ui.muteBtn.addEventListener('click', () => { initAudio(); setMuted(!muted); });
setMuted(muted);

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (game.state === 'playing' && (k === ' ' || k === 'f' || k === 'F' || k === 'Enter')) { actFire(); return; }
  if (e.repeat) return;
  if (game.state === 'menu' || game.state === 'over') {
    if (k === 'Enter' || k === ' ') startRun();
    return;
  }
  if (game.state === 'paused') {
    if (k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter' || k === ' ') resumeGame();
    if (k === 'm' || k === 'M') setMuted(!muted);
    return;
  }
  switch (k) {
    case 'ArrowLeft': case 'a': case 'A': actSide(-1); break;
    case 'ArrowRight': case 'd': case 'D': actSide(1); break;
    case 'ArrowUp': case 'w': case 'W': actClimb(); break;
    case 'ArrowDown': case 's': case 'S': actDive(); break;
    case 'p': case 'P': case 'Escape': pauseGame(); break;
    case 'm': case 'M': setMuted(!muted); break;
    default: break;
  }
});

// swipe to steer, tap to fire
let touch = null;
canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touch = { x: t.clientX, y: t.clientY, used: false };
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (!touch || touch.used) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  touch.used = true;
  if (Math.abs(dx) > Math.abs(dy)) actSide(dx < 0 ? -1 : 1);
  else if (dy < 0) actClimb();
  else actDive();
}, { passive: true });
canvas.addEventListener('touchend', () => {
  if (touch && !touch.used) actFire();
  touch = null;
}, { passive: true });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) actFire(); });

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', pauseGame);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// ============================================================ main loop
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (game.state !== 'paused') game.time += dt;

  if (game.state === 'playing') updatePlaying(dt);
  else if (game.state === 'dying') updateDying(dt);

  if (game.state !== 'paused') {
    updateBolts(dt);
    updateSparks(dt);
    updateFlyingCoins(dt);
    animateJet(dt);
    animateDrone(dt);
    animateWorld(dt);
    updateCamera(dt);
    updateDust();
  }
  if (game.state === 'playing') hud.update();
  renderer.render(scene, camera);
}

newGame();
game.state = 'menu';
refreshMenuStats();
show(ui.loading, false);
requestAnimationFrame(frame);

// small hook for automated smoke tests
window.__game = { game, player };

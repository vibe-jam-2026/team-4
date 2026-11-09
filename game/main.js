// Sunstone Escape: an endless 3D temple runner.
// Plain ES module + Three.js (vendored). No build step.
import * as THREE from './vendor/three.module.min.js';

// ============================================================ helpers
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
function lerpAngle(a, b, t) {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * t;
}
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ============================================================ constants
const TILE = 3;            // length of a path tile along a straight
const HALF = 3;            // half width of the path (path is 6 wide, corners 6x6)
const LANE_W = 2;          // three lanes at x = -2, 0, 2
const PATH_W = HALF * 2;
const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W in (x, z); N = -z
const yawOf = (d) => -d * Math.PI / 2;
const GRAVITY = 30;
const JUMP_V = 10.5;       // ~0.7 s airtime, ~1.8 m apex
const SLIDE_TIME = 0.75;
const BASE_SPEED = 13;
const MAX_SPEED = 31;
const CHASE_FAR = 18;
const POWER_TIME = { magnet: 10, shield: 8, double: 12 };
const POWER_INFO = {
  magnet: { label: 'Magnet', color: '#4d9bff' },
  shield: { label: 'Sun Ward', color: '#3fe0c5' },
  double: { label: 'Double Coins', color: '#ff5fae' },
};

// ============================================================ renderer / scene
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const HORIZON = new THREE.Color(0xe8a96e);
const scene = new THREE.Scene();
scene.background = HORIZON.clone();
scene.fog = new THREE.Fog(HORIZON, 40, 165);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 600);

// Sky dome with a gradient and a sun glow
const SUN_DIR = new THREE.Vector3(-0.35, 0.28, -1).normalize();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6688) },
      mid: { value: HORIZON.clone() },
      bot: { value: new THREE.Color(0x6b3f27) },
      sunDir: { value: SUN_DIR },
      sunCol: { value: new THREE.Color(0xfff0c0) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.4, 0.0, 1.0), 0.7)) : mix(mid, bot, pow(clamp(-h * 2.0, 0.0, 1.0), 0.6));
        float s = max(dot(normalize(vP), sunDir), 0.0);
        c += sunCol * (pow(s, 400.0) * 2.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -1;
scene.add(sky);

// Mist floor far below the causeways
const mist = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xd9925c, transparent: true, opacity: 0.55, depthWrite: false }),
);
mist.position.y = -34;
scene.add(mist);

const hemi = new THREE.HemisphereLight(0xffe6c0, 0x4a3020, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd8a0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

// ============================================================ materials & geometry
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
const M = {
  stone: std(0xffffff, { roughness: 0.95 }),
  corner: std(0xb49d7f),
  trim: std(0x8a765e),
  dark: std(0x6c5e4f),
  wall: std(0x9a8670),
  moss: std(0x5f7d36),
  leaf: std(0x4b7a2c),
  leaf2: std(0x6e9c3a),
  bark: std(0x5a3d26),
  wood: std(0x7c4f2c),
  gold: new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xc07a00, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffa640 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xff8a1a }),
  shirt: std(0xd9bf86),
  pants: std(0x5e4a33),
  skin: std(0xe0a878),
  hat: std(0x7a5230),
  boot: std(0x3b2a1c),
  pack: std(0x8b5a2b),
  eye: new THREE.MeshBasicMaterial({ color: 0x1a120c }),
  golem: std(0x8a8072),
  golemDark: std(0x5e564c),
  golemEye: new THREE.MeshBasicMaterial({ color: 0xffb020 }),
  magnet: new THREE.MeshStandardMaterial({ color: 0x4d9bff, emissive: 0x1a4cff, emissiveIntensity: 0.8, roughness: 0.4 }),
  magnetTip: new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0x801010, roughness: 0.4 }),
  shield: new THREE.MeshStandardMaterial({ color: 0x3fe0c5, emissive: 0x0f8a76, emissiveIntensity: 0.9, roughness: 0.3 }),
  double: new THREE.MeshStandardMaterial({ color: 0xff5fae, emissive: 0x991d5c, emissiveIntensity: 0.8, roughness: 0.3 }),
  halo: new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.55, depthWrite: false }),
  bubble: new THREE.MeshBasicMaterial({ color: 0x3fe0c5, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
};

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

const G = {
  tile: new THREE.BoxGeometry(PATH_W, 1, TILE),
  corner: new THREE.BoxGeometry(PATH_W, 1, PATH_W),
  trim: new THREE.BoxGeometry(0.5, 0.5, TILE),
  support: new THREE.CylinderGeometry(1.2, 2.2, 70, 6),
  coin: new THREE.CylinderGeometry(0.38, 0.38, 0.1, 16).rotateX(Math.PI / 2),
  log: new THREE.CylinderGeometry(0.42, 0.5, PATH_W - 0.2, 9).rotateZ(Math.PI / 2),
  rock: new THREE.DodecahedronGeometry(1, 0),
  trunk: new THREE.CylinderGeometry(0.7, 1, 1, 7),
  canopy: new THREE.IcosahedronGeometry(1, 0),
  flame: new THREE.ConeGeometry(0.2, 0.55, 6),
  halo: new THREE.TorusGeometry(0.75, 0.05, 6, 24),
  magnet: new THREE.TorusGeometry(0.38, 0.13, 8, 16, Math.PI),
  gem: new THREE.OctahedronGeometry(0.5, 0),
  ico: new THREE.IcosahedronGeometry(0.45, 0),
  bubble: new THREE.SphereGeometry(1.3, 16, 12),
};

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
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

// ============================================================ characters
function makeExplorer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pivot = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const legL = pivot(-0.16, 0.92, 0, body);
  const legR = pivot(0.16, 0.92, 0, body);
  for (const leg of [legL, legR]) {
    mesh(boxGeo(0.24, 0.6, 0.26), M.pants, 0, -0.3, 0, leg);
    mesh(boxGeo(0.27, 0.3, 0.36), M.boot, 0, -0.77, -0.04, leg);
  }
  mesh(boxGeo(0.6, 0.62, 0.36), M.shirt, 0, 1.25, 0, body);
  mesh(boxGeo(0.63, 0.1, 0.38), M.boot, 0, 0.97, 0, body);
  mesh(boxGeo(0.46, 0.52, 0.24), M.pack, 0, 1.28, 0.3, body);
  mesh(boxGeo(0.5, 0.12, 0.26), M.boot, 0, 1.58, 0.3, body);
  const head = pivot(0, 1.56, 0, body);
  mesh(boxGeo(0.4, 0.4, 0.4), M.skin, 0, 0.22, 0, head);
  mesh(boxGeo(0.07, 0.07, 0.02), M.eye, -0.09, 0.25, -0.205, head, false);
  mesh(boxGeo(0.07, 0.07, 0.02), M.eye, 0.09, 0.25, -0.205, head, false);
  mesh(cylGeo(0.46, 0.46, 0.05, 12), M.hat, 0, 0.44, 0, head);
  mesh(cylGeo(0.25, 0.28, 0.26, 10), M.hat, 0, 0.58, 0, head);
  mesh(cylGeo(0.285, 0.285, 0.07, 10), M.boot, 0, 0.5, 0, head);
  const armL = pivot(-0.41, 1.5, 0, body);
  const armR = pivot(0.41, 1.5, 0, body);
  for (const arm of [armL, armR]) {
    mesh(boxGeo(0.18, 0.56, 0.2), M.shirt, 0, -0.26, 0, arm);
    mesh(boxGeo(0.16, 0.16, 0.18), M.skin, 0, -0.6, 0, arm);
  }
  // the stolen Sunstone idol, clutched in the right hand
  const idol = mesh(boxGeo(0.16, 0.24, 0.16), M.gold, 0, -0.72, -0.08, armR);
  mesh(boxGeo(0.2, 0.08, 0.2), M.gold, 0, 0.14, 0, idol);
  const bubble = mesh(G.bubble, M.bubble, 0, 1.0, 0, root, false);
  bubble.visible = false;
  return { root, body, legL, legR, armL, armR, head, bubble, phase: 0 };
}

function makeGolem() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pivot = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const legL = pivot(-0.5, 1.35, 0, body);
  const legR = pivot(0.5, 1.35, 0, body);
  for (const leg of [legL, legR]) {
    mesh(boxGeo(0.62, 1.0, 0.66), M.golem, 0, -0.5, 0, leg);
    mesh(boxGeo(0.75, 0.4, 0.85), M.golemDark, 0, -1.15, -0.08, leg);
  }
  mesh(boxGeo(1.7, 1.5, 1.1), M.golem, 0, 2.1, 0, body);
  mesh(boxGeo(1.75, 0.35, 1.15), M.golemDark, 0, 1.4, 0, body);
  mesh(boxGeo(1.0, 0.5, 0.2), M.moss, 0.2, 2.5, -0.56, body);
  mesh(G.rock, M.golemDark, 0.6, 2.95, 0.2, body).scale.setScalar(0.45);
  const head = pivot(0, 2.9, -0.15, body);
  mesh(boxGeo(0.9, 0.75, 0.8), M.golemDark, 0, 0.35, 0, head);
  mesh(boxGeo(0.22, 0.12, 0.05), M.golemEye, -0.22, 0.42, -0.42, head, false);
  mesh(boxGeo(0.22, 0.12, 0.05), M.golemEye, 0.22, 0.42, -0.42, head, false);
  mesh(boxGeo(0.6, 0.1, 0.05), M.golemEye, 0, 0.12, -0.42, head, false);
  const armL = pivot(-1.1, 2.6, 0, body);
  const armR = pivot(1.1, 2.6, 0, body);
  for (const arm of [armL, armR]) {
    mesh(boxGeo(0.55, 1.4, 0.6), M.golem, 0, -0.65, 0, arm);
    mesh(boxGeo(0.75, 0.6, 0.75), M.golemDark, 0, -1.55, 0, arm);
  }
  return { root, body, legL, legR, armL, armR, head, phase: 0 };
}

const explorer = makeExplorer();
scene.add(explorer.root);
const golem = makeGolem();
scene.add(golem.root);

// ============================================================ world generation
// The track is a chain of straights. Each straight starts at a corner centre P,
// runs in direction dir for L metres and ends at the next corner. Headings are
// only ever N, E or W, so the track can never loop back over itself.
let straights = [];
let passed = [];
let removeQueue = [];

function endPoint(st) { return { x: st.P.x + st.fx * st.L, z: st.P.z + st.fz * st.L }; }
function worldOf(st, s, x, y, out) { return out.set(st.P.x + st.fx * s + st.rx * x, y, st.P.z + st.fz * s + st.rz * x); }

function createStraight(P, dir, opts = {}) {
  const first = !!opts.first;
  const L = first ? 111 : randInt(16, 36) * 3;
  let corner;
  if (dir === 0) corner = pick(['L', 'R', 'L', 'R', 'T']);
  else corner = dir === 1 ? 'L' : 'R';
  const f = DIRV[dir];
  const r = DIRV[(dir + 1) % 4];
  const st = {
    P: { x: P.x, z: P.z }, dir, L, corner, first,
    fx: f[0], fz: f[1], rx: r[0], rz: r[1],
    sStart: first ? -15 : HALF,
    obstacles: [], gaps: [], coins: [], powers: [], flames: [],
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

function difficulty() { return clamp(game.dist / 3500, 0, 1); }

function populate(st) {
  const diff = difficulty();
  const end = st.L - 16;
  let s = st.first ? 38 : 4;
  for (;;) {
    s += rand(lerp(20, 10, diff), lerp(30, 17, diff));
    if (s > end) break;
    const r = Math.random();
    const type = r < 0.24 ? 'gap' : r < 0.46 ? 'log' : r < 0.68 ? 'arch' : 'block';
    if (type === 'gap') {
      const s0 = st.sStart + Math.round((s - st.sStart) / TILE) * TILE;
      const len = diff > 0.25 && Math.random() < 0.45 ? 6 : 3;
      if (s0 + len > end) break;
      st.gaps.push([s0, s0 + len]);
      st.obstacles.push({ type, s: s0 + len / 2, half: len / 2, meshes: [] });
      s = s0 + len;
    } else if (type === 'block') {
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const n = Math.random() < 0.3 + 0.4 * diff ? 2 : 1;
      st.obstacles.push({ type, s, half: 0.85, lanes: lanes.slice(0, n), meshes: [] });
    } else {
      st.obstacles.push({ type, s, half: 0.5, meshes: [] });
    }
  }

  // coin rows (arching over jump obstacles, avoiding blocked lanes)
  let cs = st.first ? 16 : 8;
  while (cs < st.L - 14) {
    cs += rand(5, 15);
    const n = randInt(5, 10);
    const lane = randInt(-1, 1);
    for (let k = 0; k < n; k++) {
      const s2 = cs + k * 1.7;
      if (s2 > st.L - 12) break;
      let y = 0.8;
      let blocked = false;
      for (const ob of st.obstacles) {
        const d = Math.abs(s2 - ob.s);
        if (ob.type === 'block' && ob.lanes.includes(lane) && d < 1.7) blocked = true;
        if (ob.type === 'log' || ob.type === 'gap') {
          const R = ob.type === 'gap' ? 3 + ob.half : 4;
          if (d < R) y = Math.max(y, 0.8 + 1.4 * (1 - (d / R) ** 2));
        }
      }
      if (!blocked) st.coins.push({ s: s2, x: lane * LANE_W, y, taken: false });
    }
    cs += n * 1.7;
  }

  // the odd power-up
  if (!st.first && Math.random() < 0.42) {
    const s2 = rand(18, st.L - 20);
    const free = [-1, 0, 1].filter((l) => !st.obstacles.some((ob) =>
      Math.abs(ob.s - s2) < 4 && (ob.type !== 'block' || ob.lanes.includes(l))));
    if (free.length && !st.obstacles.some((ob) => ob.type !== 'block' && Math.abs(ob.s - s2) < 4)) {
      st.powers.push({ s: s2, x: pick(free) * LANE_W, type: pick(['magnet', 'shield', 'double']), taken: false, mesh: null });
    }
  }
}

function inGapCentre(st, c) { return st.gaps.some(([a, b]) => c > a && c < b); }

function build(st) {
  const g = st.group;

  // tiles + edge trims as instanced meshes
  const tiles = [];
  for (let s = st.sStart; s < st.L - HALF - 0.01; s += TILE) {
    const c = s + TILE / 2;
    if (!inGapCentre(st, c)) tiles.push(c);
  }
  const tm = new THREE.InstancedMesh(G.tile, M.stone, tiles.length);
  const trm = new THREE.InstancedMesh(G.trim, M.trim, tiles.length * 2);
  tm.receiveShadow = true;
  trm.castShadow = trm.receiveShadow = true;
  tiles.forEach((c, i) => {
    _m4.makeTranslation(0, -0.5, -c);
    tm.setMatrixAt(i, _m4);
    _col.setHSL(0.085 + rand(-0.012, 0.012), 0.24 + rand(-0.06, 0.06), 0.56 + rand(-0.07, 0.05));
    tm.setColorAt(i, _col);
    _m4.makeTranslation(-2.75, 0.25, -c); trm.setMatrixAt(i * 2, _m4);
    _m4.makeTranslation(2.75, 0.25, -c); trm.setMatrixAt(i * 2 + 1, _m4);
  });
  g.add(tm, trm);

  // moss patches on some tiles
  for (const c of tiles) {
    if (Math.random() < 0.12) {
      const m = mesh(boxGeo(1.2, 0.06, 1.0), M.moss, rand(-2, 2), 0.02, -c + rand(-0.8, 0.8), g, false);
      m.receiveShadow = true;
      m.rotation.y = rand(0, Math.PI);
    }
  }

  // corner square, guard wall and carved face in front
  const L = st.L;
  mesh(G.corner, M.corner, 0, -0.5, -L, g).castShadow = false;
  mesh(boxGeo(PATH_W + 1.4, 3.4, 0.8), M.wall, 0, 1.2, -L - 3.4, g);
  mesh(boxGeo(1.2, 4.6, 1.2), M.dark, -3.6, 1.8, -L - 3.4, g);
  mesh(boxGeo(1.2, 4.6, 1.2), M.dark, 3.6, 1.8, -L - 3.4, g);
  const face = mesh(boxGeo(2.2, 1.8, 1.0), M.dark, 0, 3.8, -L - 3.4, g);
  mesh(boxGeo(0.45, 0.22, 0.1), M.glow, -0.5, 0.2, -0.52, face, false);
  mesh(boxGeo(0.45, 0.22, 0.1), M.glow, 0.5, 0.2, -0.52, face, false);
  mesh(boxGeo(1.0, 0.15, 0.1), M.eye, 0, -0.45, -0.52, face, false);
  if (st.corner === 'L') mesh(boxGeo(0.5, 0.5, PATH_W), M.trim, 2.75, 0.25, -L, g);
  if (st.corner === 'R') mesh(boxGeo(0.5, 0.5, PATH_W), M.trim, -2.75, 0.25, -L, g);

  // supports dropping into the abyss
  const sup = [];
  for (let s = st.sStart + 4.5; s < L - 6; s += 18) if (!inGapCentre(st, s)) sup.push(s);
  sup.push(L);
  const sm = new THREE.InstancedMesh(G.support, M.dark, sup.length);
  sup.forEach((s, i) => { _m4.makeTranslation(0, -35.5, -s); sm.setMatrixAt(i, _m4); });
  g.add(sm);

  // torches along the edges
  let side = Math.random() < 0.5 ? -1 : 1;
  for (let s = st.sStart + 10; s < L - 8; s += 21) {
    if (inGapCentre(st, s)) continue;
    const x = side * 2.75;
    mesh(boxGeo(0.25, 1.3, 0.25), M.wood, x, 1.05, -s, g);
    mesh(boxGeo(0.45, 0.2, 0.45), M.dark, x, 1.75, -s, g);
    const fl = mesh(G.flame, M.flame, x, 2.1, -s, g, false);
    st.flames.push(fl);
    side = -side;
  }

  // obstacles
  for (const ob of st.obstacles) {
    if (ob.type === 'log') {
      const m = mesh(G.log, M.wood, 0, 0.45, -ob.s, g);
      m.rotation.y = rand(-0.06, 0.06);
      const moss = mesh(boxGeo(1.3, 0.12, 0.6), M.moss, rand(-1.5, 1.5), 0.9, -ob.s, g, false);
      ob.meshes.push(m, moss);
    } else if (ob.type === 'arch') {
      const a = mesh(boxGeo(0.8, 3.6, 0.8), M.dark, -3.1, 1.3, -ob.s, g);
      const b = mesh(boxGeo(0.8, 3.6, 0.8), M.dark, 3.1, 1.3, -ob.s, g);
      const beam = mesh(boxGeo(PATH_W + 1.4, 1.0, 0.9), M.wall, 0, 1.92, -ob.s, g);
      const rune = mesh(boxGeo(0.8, 0.35, 0.06), M.glow, 0, 1.95, -ob.s - 0.47, g, false);
      ob.meshes.push(a, b, beam, rune);
      for (let i = 0; i < 5; i++) {
        const len = rand(0.25, 0.55);
        ob.meshes.push(mesh(boxGeo(0.08, len, 0.08), M.leaf2, rand(-2.6, 2.6), 1.42 - len / 2, -ob.s + rand(-0.3, 0.3), g, false));
      }
    } else if (ob.type === 'block') {
      for (const l of ob.lanes) {
        const m = mesh(boxGeo(1.7, 2.3, 1.6), M.dark, l * LANE_W, 0.65, -ob.s, g);
        const top = mesh(G.rock, M.wall, l * LANE_W + rand(-0.2, 0.2), 2.05, -ob.s, g);
        top.scale.set(0.9, 0.7, 0.85);
        top.rotation.set(rand(0, 3), rand(0, 3), 0);
        const eye = mesh(boxGeo(0.9, 0.18, 0.06), M.glow, l * LANE_W, 1.3, -ob.s - 0.82, g, false);
        ob.meshes.push(m, top, eye);
      }
    } else if (ob.type === 'gap') {
      // crumbled lips at both edges of the gap
      for (const e of [ob.s - ob.half, ob.s + ob.half]) {
        for (let i = 0; i < 3; i++) {
          const r = mesh(G.rock, M.corner, rand(-2.4, 2.4), -0.3, -e + (e < ob.s ? -0.1 : 0.1), g, false);
          r.scale.setScalar(rand(0.25, 0.45));
        }
      }
    }
  }

  // coins: one instanced mesh per straight
  if (st.coins.length) {
    st.coinMesh = new THREE.InstancedMesh(G.coin, M.gold, st.coins.length);
    st.coinMesh.castShadow = true;
    st.coins.forEach((c, i) => {
      _m4.makeTranslation(c.x, c.y, -c.s);
      st.coinMesh.setMatrixAt(i, _m4);
    });
    g.add(st.coinMesh);
  }

  // power-ups
  for (const p of st.powers) {
    const holder = new THREE.Group();
    holder.position.set(p.x, 1.1, -p.s);
    if (p.type === 'magnet') {
      const m = mesh(G.magnet, M.magnet, 0, 0, 0, holder);
      m.rotation.z = Math.PI;
      mesh(boxGeo(0.26, 0.2, 0.26), M.magnetTip, -0.38, -0.08, 0, holder);
      mesh(boxGeo(0.26, 0.2, 0.26), M.magnetTip, 0.38, -0.08, 0, holder);
    } else if (p.type === 'shield') {
      mesh(G.gem, M.shield, 0, 0, 0, holder);
    } else {
      mesh(G.ico, M.double, 0, 0, 0, holder);
    }
    mesh(G.halo, M.halo, 0, 0, 0, holder, false);
    g.add(holder);
    p.mesh = holder;
  }

  // scenery: jungle trees and ruined pillars rising from the abyss
  const n = Math.floor(st.L / 11);
  for (let i = 0; i < n; i++) {
    const s = rand(14, Math.max(16, L - 14));
    const sd = Math.random() < 0.5 ? -1 : 1;
    const x = sd * rand(10, 32);
    if (Math.random() < 0.62) {
      const top = rand(-8, 14);
      const h = top + 80;
      const r = rand(0.8, 1.7);
      const t = mesh(G.trunk, M.bark, x, top - h / 2, -s, g, false);
      t.scale.set(r, h, r);
      const cr = Math.min(rand(3, 6.5), Math.abs(x) - 5);
      for (let k = 0; k < 3; k++) {
        const c = mesh(G.canopy, Math.random() < 0.5 ? M.leaf : M.leaf2, x + rand(-1.5, 1.5), top + rand(0.5, 2.5), -s + rand(-1.5, 1.5), g, false);
        c.scale.set(cr * rand(0.8, 1.1), cr * rand(0.55, 0.8), cr * rand(0.8, 1.1));
        c.rotation.y = rand(0, 3);
      }
    } else {
      const top = rand(-12, 8);
      const h = top + 80;
      const p = mesh(cylGeo(1.6, 2.2, 1, 6), M.wall, x, top - h / 2, -s, g, false);
      p.scale.y = h;
      mesh(boxGeo(4.4, 0.8, 4.4), M.dark, x, top + 0.4, -s, g, false);
      if (Math.random() < 0.5) mesh(boxGeo(1.2, 1.4, 1.2), M.moss, x + rand(-1, 1), top + 1.4, -s + rand(-1, 1), g, false);
    }
  }
  for (let i = 0; i < 2; i++) {
    const rk = mesh(G.rock, M.corner, (Math.random() < 0.5 ? -1 : 1) * rand(16, 32), rand(-14, 18), -rand(14, Math.max(16, L - 14)), g, false);
    rk.scale.set(rand(1.5, 4), rand(1.2, 3), rand(1.5, 4));
    rk.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  }

  // the temple you escape from, behind the very first straight
  if (st.first) {
    mesh(boxGeo(1.4, 8, 1.4), M.dark, -4, 3.5, 9, g);
    mesh(boxGeo(1.4, 8, 1.4), M.dark, 4, 3.5, 9, g);
    mesh(boxGeo(10, 1.6, 2), M.wall, 0, 8, 9, g);
    mesh(boxGeo(14, 12, 2), M.wall, 0, 5, 16.5, g);
    mesh(boxGeo(PATH_W, 8, 0.2), M.eye, 0, 3.5, 15.4, g, false);
    const f = mesh(boxGeo(3, 2.4, 1.2), M.dark, 0, 10.3, 9, g);
    mesh(boxGeo(0.6, 0.3, 0.1), M.glow, -0.7, 0.3, -0.62, f, false);
    mesh(boxGeo(0.6, 0.3, 0.1), M.glow, 0.7, 0.3, -0.62, f, false);
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
  st: null, s: 0, x: 0, y: 0, vy: 0, lane: 0,
  air: false, falling: false, slideT: 0, pendingTurn: 0,
  magnet: 0, shield: 0, double: 0,
  yaw: 0, pos: new THREE.Vector3(),
};
const game = {
  state: 'loading', slow: 0, dist: 0, score: 0, coins: 0, speed: BASE_SPEED, mult: 1,
  chaseGap: 4, chaseHold: 1.5, stumbleT: 0, deathT: 0, deathKind: '', time: 0,
  trail: [], camYaw: 0, camY: 4.2, nextMilestone: 500,
  best: store.get('sunstone.best', 0), bank: store.get('sunstone.bank', 0),
};
const flyingCoins = [];
const coinPool = [];

function newGame() {
  for (const st of [...straights]) disposeStraight(st);
  straights = []; passed = []; removeQueue = [];
  for (const c of flyingCoins) c.mesh.visible = false;
  coinPool.push(...flyingCoins.splice(0));
  Object.assign(game, {
    dist: 0, slow: 0, score: 0, coins: 0, speed: BASE_SPEED, mult: 1,
    chaseGap: 4.5, chaseHold: 1.8, stumbleT: 0, deathT: 0, deathKind: '',
    trail: [], camYaw: 0, camY: 4.2, nextMilestone: 500,
  });
  Object.assign(player, {
    s: 0, x: 0, y: 0, vy: 0, lane: 0, air: false, falling: false, slideT: 0, pendingTurn: 0,
    magnet: 0, shield: 0, double: 0, yaw: 0,
  });
  player.st = createStraight({ x: 0, z: 0 }, 0, { first: true });
  ensureAhead();
  for (let d = -30; d <= 0; d += 1) game.trail.push({ d, x: 0, y: 0, z: -d });
  explorer.root.rotation.set(0, 0, 0);
  explorer.root.position.set(0, 0, 0);
  explorer.bubble.visible = false;
  golem.root.visible = true;
  updatePlayerWorld();
  hud.reset();
}

// ============================================================ controls / actions
function turnWindow() { return Math.max(8, game.speed * 0.62); }

function tryTurn(side) {
  const st = player.st;
  if (player.falling) return false;
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
    if (ob.type === 'block' && !ob.smashed && ob.lanes.includes(target) && Math.abs(player.s - ob.s) < ob.half + 0.5) {
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
function actJump() {
  if (game.state !== 'playing' || player.air) return;
  player.vy = JUMP_V; player.air = true; player.slideT = 0;
  sfx('jump');
}
function actSlide() {
  if (game.state !== 'playing' || player.falling) return;
  if (player.air) player.vy = Math.min(player.vy, -22);
  if (player.slideT <= 0) sfx('slide');
  player.slideT = SLIDE_TIME;
}

function stumble() {
  sfx('stumble');
  if (game.stumbleT > 0) { die('caught'); return; }
  game.stumbleT = 7;
  game.chaseGap = 3.2;
  game.chaseHold = 2.4;
  game.slow = 0.12;
  hud.toast('Careful!');
  shake = 0.35;
}

function hitObstacle(ob) {
  if (player.shield > 0) {
    ob.smashed = true;
    for (const m of ob.meshes) m.visible = false;
    sfx('smash');
    shake = 0.25;
    return;
  }
  die(ob.type === 'log' ? 'trip' : 'crash');
}

function die(kind) {
  if (game.state !== 'playing') return;
  game.state = 'dying';
  game.deathKind = kind;
  game.deathT = 0;
  player.slideT = 0;
  shake = kind === 'fall' ? 0 : 0.5;
  sfx(kind === 'fall' ? 'fall' : 'death');
  stopMusic();
}

// ============================================================ per-frame simulation
let shake = 0;

function overGap(st, s) { return st.gaps.some(([a, b]) => s > a + 0.35 && s < b - 0.35); }

function updatePlayerWorld() {
  worldOf(player.st, player.s, player.x, player.y, player.pos);
}

function updatePlaying(dt) {
  const st = player.st;
  game.slow = Math.max(0, game.slow - dt * 0.04);
  game.speed = Math.min(MAX_SPEED, BASE_SPEED + Math.sqrt(game.dist) * 0.32) * (1 - game.slow);
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

  // lateral and vertical motion
  player.x += (player.lane * LANE_W - player.x) * damp(14, dt);
  if (player.slideT > 0) player.slideT -= dt;
  if (player.air) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0 && !player.falling) {
      if (overGap(st, player.s)) player.falling = true;
      else { player.y = 0; player.vy = 0; player.air = false; sfx('land'); }
    }
  } else if (overGap(st, player.s)) {
    player.falling = true; player.air = true; player.vy = 0;
  }
  if (player.falling && player.y < -1.2) { die('fall'); return; }

  // corners
  if (player.pendingTurn && player.s >= st.L - 1.0) executeTurn();
  else if (player.s > st.L + HALF - 0.7) { die('wall'); return; }

  // obstacles
  const cur = player.st;
  for (const ob of cur.obstacles) {
    if (ob.smashed || ob.type === 'gap') continue;
    if (Math.abs(player.s - ob.s) > ob.half + 0.35) continue;
    if (ob.type === 'log' && player.y < 0.9) hitObstacle(ob);
    else if (ob.type === 'arch' && player.slideT <= 0) hitObstacle(ob);
    else if (ob.type === 'block' && ob.lanes.some((l) => Math.abs(player.x - l * LANE_W) < 1.2)) hitObstacle(ob);
    if (game.state !== 'playing') return;
  }

  // coins
  const centre = player.y + (player.slideT > 0 ? 0.5 : 1.0);
  const mag = player.magnet > 0;
  if (cur.coinMesh) {
    for (let i = 0; i < cur.coins.length; i++) {
      const c = cur.coins[i];
      if (c.taken) continue;
      const ds = c.s - player.s;
      if (mag && ds > -1 && ds < 11) {
        takeCoin(cur, i);
        launchFlyingCoin(cur, c);
      } else if (Math.abs(ds) < 1.0 && Math.abs(c.x - player.x) < 1.1 && Math.abs(c.y - centre) < 1.2) {
        takeCoin(cur, i);
        collectCoin();
      }
    }
  }

  // power-ups
  for (const p of cur.powers) {
    if (p.taken) continue;
    if (Math.abs(p.s - player.s) < 1.1 && Math.abs(p.x - player.x) < 1.2 && player.y < 2.2) {
      p.taken = true;
      p.mesh.visible = false;
      player[p.type] = POWER_TIME[p.type];
      sfx('power');
      hud.toast(POWER_INFO[p.type].label + '!');
    }
  }
  for (const k of ['magnet', 'shield', 'double']) if (player[k] > 0) player[k] = Math.max(0, player[k] - dt);
  explorer.bubble.visible = player.shield > 0 && (player.shield > 1.5 || Math.floor(game.time * 8) % 2 === 0);

  // chaser
  if (game.stumbleT > 0) game.stumbleT -= dt;
  if (game.chaseHold > 0) game.chaseHold -= dt;
  else game.chaseGap = Math.min(CHASE_FAR, game.chaseGap + dt * 2.4);

  updatePlayerWorld();
  game.trail.push({ d: game.dist, x: player.pos.x, y: player.y, z: player.pos.z });
  while (game.trail.length > 2 && game.trail[1].d < game.dist - 45) game.trail.shift();
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
  const m = coinPool.pop() || new THREE.Mesh(G.coin, M.gold);
  if (!m.parent) scene.add(m);
  m.visible = true;
  worldOf(st, c.s, c.x, c.y, m.position);
  flyingCoins.push({ mesh: m, t: 0 });
}

function updateFlyingCoins(dt) {
  for (let i = flyingCoins.length - 1; i >= 0; i--) {
    const f = flyingCoins[i];
    f.t += dt;
    _v.copy(player.pos); _v.y += 1.0;
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
  if (k === 'fall') {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    player.s += game.speed * 0.35 * dt * Math.max(0, 1 - game.deathT);
    game.chaseGap = lerp(game.chaseGap, 4, damp(2, dt));
  } else {
    game.chaseGap = lerp(game.chaseGap, 1.7, damp(k === 'caught' ? 6 : 2.5, dt));
    if (k === 'caught' && game.deathT < 0.3) player.s += game.speed * dt * (1 - game.deathT / 0.3);
    if (player.y > 0) { player.vy -= GRAVITY * dt; player.y = Math.max(0, player.y + player.vy * dt); }
  }
  updatePlayerWorld();
  if (game.deathT > 1.9 && game.state === 'dying') gameOver();
}

function chaserPosition(out) {
  const tr = game.trail;
  const d = game.dist - game.chaseGap;
  let i = tr.length - 1;
  while (i > 0 && tr[i - 1].d > d) i--;
  const a = tr[Math.max(0, i - 1)];
  const b = tr[i];
  const t = b.d === a.d ? 1 : clamp((d - a.d) / (b.d - a.d), 0, 1);
  out.set(lerp(a.x, b.x, t), Math.max(0, lerp(a.y, b.y, t)) * 0.8, lerp(a.z, b.z, t));
  // heading from a sample a little further ahead
  let j = i;
  while (j < tr.length - 1 && tr[j].d < d + 2) j++;
  const hx = tr[j].x - out.x;
  const hz = tr[j].z - out.z;
  return Math.hypot(hx, hz) > 0.01 ? Math.atan2(-hx, -hz) : null;
}

// ============================================================ animation
function animateExplorer(dt) {
  const e = explorer;
  const k = damp(16, dt);
  let lL = 0, lR = 0, aL = 0, aR = 0, bodyX = -0.12, bodyY = 0, bodyZ = 0, headX = 0;
  if (game.state === 'menu' || game.state === 'loading') {
    e.phase += dt * 2;
    bodyY = Math.sin(e.phase) * 0.02;
    aL = 0.1; aR = -0.1; bodyX = 0; headX = Math.sin(e.phase * 0.5) * 0.1;
  } else if (game.state === 'dying' && game.deathKind !== 'fall') {
    const t = clamp(game.deathT * 2.5, 0, 1);
    e.root.rotation.x = lerp(0, 1.45, t);
    e.root.position.y = player.pos.y + 0.2 * t;
    aL = 2.6; aR = 2.2; lL = 0.6; lR = 0.2; bodyX = 0;
  } else if (player.falling || game.state === 'dying') {
    e.phase += dt * 14;
    aL = 2.8 + Math.sin(e.phase) * 0.5; aR = 2.8 - Math.sin(e.phase) * 0.5;
    lL = Math.sin(e.phase) * 0.7; lR = -lL; bodyX = 0.2;
  } else if (player.slideT > 0) {
    bodyX = 1.15; bodyY = 0.05; bodyZ = -0.5;
    aL = 0.7; aR = 0.9; lL = 0.25; lR = 0.1; headX = -0.6;
  } else if (player.air) {
    lL = 1.0; lR = -0.4; aL = 2.3; aR = 1.8; bodyX = -0.05;
  } else {
    e.phase += dt * (6 + game.speed * 0.45);
    const s = Math.sin(e.phase);
    lL = s * 0.95; lR = -s * 0.95; aL = -s * 0.85; aR = s * 0.85;
    bodyY = Math.abs(Math.cos(e.phase)) * 0.09;
    bodyX = -0.18;
  }
  e.legL.rotation.x = lerp(e.legL.rotation.x, lL, k);
  e.legR.rotation.x = lerp(e.legR.rotation.x, lR, k);
  e.armL.rotation.x = lerp(e.armL.rotation.x, aL, k);
  e.armR.rotation.x = lerp(e.armR.rotation.x, aR, k);
  e.body.rotation.x = lerp(e.body.rotation.x, bodyX, k);
  e.body.position.y = lerp(e.body.position.y, bodyY, k);
  e.body.position.z = lerp(e.body.position.z, bodyZ, k);
  e.head.rotation.x = lerp(e.head.rotation.x, headX, k);

  const targetYaw = yawOf(player.st.dir);
  player.yaw = lerpAngle(player.yaw, targetYaw, damp(14, dt));
  e.root.position.x = player.pos.x;
  e.root.position.z = player.pos.z;
  if (!(game.state === 'dying' && game.deathKind !== 'fall')) e.root.position.y = player.pos.y;
  e.root.rotation.y = player.yaw;
}

function animateGolem(dt) {
  const g = golem;
  const yaw = chaserPosition(g.root.position);
  if (yaw !== null) g.root.rotation.y = lerpAngle(g.root.rotation.y, yaw, damp(10, dt));
  const moving = game.state === 'playing' || (game.state === 'dying' && game.chaseGap > 1.9);
  if (moving) g.phase += dt * (5 + game.speed * 0.3);
  const s = Math.sin(g.phase);
  const k = damp(10, dt);
  const grab = game.state === 'dying' && game.chaseGap < 2.5;
  g.legL.rotation.x = lerp(g.legL.rotation.x, moving ? s * 0.7 : 0, k);
  g.legR.rotation.x = lerp(g.legR.rotation.x, moving ? -s * 0.7 : 0, k);
  g.armL.rotation.x = lerp(g.armL.rotation.x, grab ? 2.2 : moving ? -s * 0.6 + 0.3 : 0.2, k);
  g.armR.rotation.x = lerp(g.armR.rotation.x, grab ? 2.2 : moving ? s * 0.6 + 0.3 : 0.2, k);
  g.body.position.y = moving ? Math.abs(Math.cos(g.phase)) * 0.18 : 0;
  g.body.rotation.x = -0.15;
  const pulse = 0.7 + 0.3 * Math.sin(game.time * 6);
  M.golemEye.color.setRGB(1, 0.55 + 0.25 * pulse, 0.1);
}

function animateWorld(dt) {
  const t = game.time;
  _q.setFromEuler(_euler.set(0, t * 3, 0));
  for (const st of activeStraights()) {
    if (st.coinMesh) {
      for (let i = 0; i < st.coins.length; i++) {
        const c = st.coins[i];
        if (c.taken) continue;
        _v.set(c.x, c.y + Math.sin(t * 4 + c.s) * 0.06, -c.s);
        _m4.compose(_v, _q, _one);
        st.coinMesh.setMatrixAt(i, _m4);
      }
      st.coinMesh.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < st.flames.length; i++) {
      const f = st.flames[i];
      f.scale.set(1, 1 + 0.25 * Math.sin(t * 17 + i * 3.1) + 0.1 * Math.sin(t * 31 + i), 1);
    }
    for (const p of st.powers) {
      if (p.taken) continue;
      p.mesh.rotation.y = t * 2.2;
      p.mesh.position.y = 1.15 + Math.sin(t * 3 + p.s) * 0.15;
    }
  }
  for (let i = removeQueue.length - 1; i >= 0; i--) {
    removeQueue[i].t -= dt;
    if (removeQueue[i].t <= 0) { disposeStraight(removeQueue[i].st); removeQueue.splice(i, 1); }
  }
}

function updateCamera(dt) {
  const targetYaw = yawOf(player.st.dir);
  game.camYaw = lerpAngle(game.camYaw, targetYaw, damp(game.state === 'menu' ? 3 : 7, dt));
  const fx = -Math.sin(game.camYaw);
  const fz = -Math.cos(game.camYaw);
  const portrait = camera.aspect < 0.9;
  const caughtView = (game.state === 'dying' || game.state === 'over') && game.deathKind !== 'fall';
  game.camPull = lerp(game.camPull || 0, caughtView ? 1 : 0, damp(caughtView ? 2.5 : 20, dt));
  const back = (portrait ? 7.5 : 6.6) + game.camPull * 6;
  const up = (portrait ? 4.8 : 4.2) + game.camPull * 4;
  // follow the path centre-line more than the lane, so lane changes read clearly
  worldOf(player.st, player.s, player.x * 0.45, 0, _v);
  const fallen = game.deathKind === 'fall' && game.state !== 'playing';
  const targetY = fallen ? up : up + Math.max(0, player.y) * 0.45;
  game.camY = lerp(game.camY, targetY, damp(8, dt));
  let cx = _v.x - fx * back;
  let cz = _v.z - fz * back;
  let cy = game.camY;
  if (game.state === 'menu') {
    const a = game.time * 0.25;
    cx += Math.sin(a) * 0.8; cy += Math.sin(a * 1.3) * 0.2;
  }
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    cx += rand(-1, 1) * shake * 0.6; cy += rand(-1, 1) * shake * 0.6;
  }
  camera.position.set(cx, cy, cz);
  _v2.set(_v.x + fx * 6, fallen ? Math.max(player.pos.y, -6) + 1 : 1.2 + Math.max(0, player.y) * 0.3, _v.z + fz * 6);
  camera.lookAt(_v2);
  const fovTarget = (portrait ? 78 : 64) + (game.state === 'playing' ? (game.speed - BASE_SPEED) * 0.35 : 0);
  camera.fov = lerp(camera.fov, fovTarget, damp(2, dt));
  camera.updateProjectionMatrix();

  sky.position.copy(camera.position);
  mist.position.x = camera.position.x;
  mist.position.z = camera.position.z;
  sun.position.set(player.pos.x - 14, 32, player.pos.z + 10);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
}

// ============================================================ audio (WebAudio synth, no files)
let actx = null, master = null, musicBus = null, noiseBuf = null;
let muted = store.get('sunstone.muted', false);
let musicTimer = null, musicNext = 0, musicStep = 0;

function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(actx.destination);
  musicBus = actx.createGain();
  musicBus.gain.value = 0.4;
  musicBus.connect(master);
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(t, freq, dur, type = 'sine', vol = 0.3, slideTo = 0, dest = master) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
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
    case 'coin': tone(t, 1320, 0.08, 'square', 0.07); tone(t + 0.05, 1760, 0.12, 'square', 0.06); break;
    case 'jump': tone(t, 280, 0.2, 'triangle', 0.25, 620); break;
    case 'land': noise(t, 0.08, 0.15, 400, 1); break;
    case 'slide': noise(t, 0.35, 0.25, 1600, 0.7); break;
    case 'swish': noise(t, 0.12, 0.12, 2500, 1.2); break;
    case 'turn': noise(t, 0.22, 0.2, 900, 0.8); tone(t, 520, 0.12, 'triangle', 0.08, 780); break;
    case 'stumble': tone(t, 140, 0.25, 'sine', 0.5, 60); noise(t, 0.2, 0.3, 300, 1); tone(t + 0.05, 90, 0.5, 'sawtooth', 0.12, 55); break;
    case 'smash': noise(t, 0.4, 0.5, 500, 0.6); tone(t, 200, 0.3, 'sine', 0.4, 50); break;
    case 'power': [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.06, f, 0.16, 'triangle', 0.16)); break;
    case 'death': tone(t, 300, 0.7, 'sawtooth', 0.22, 60); noise(t, 0.5, 0.4, 250, 0.8); tone(t, 70, 0.8, 'sine', 0.5, 35); break;
    case 'fall': tone(t, 900, 1.3, 'sine', 0.2, 120); break;
    default: break;
  }
}

const PENTA = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
function musicStepAt(step, t) {
  // tribal drum loop with a sparse marimba line
  if (step === 0 || step === 3 || step === 8 || step === 11) tone(t, 150, 0.28, 'sine', 0.7, 42, musicBus);
  if (step === 6 || step === 14) tone(t, 240, 0.18, 'sine', 0.4, 120, musicBus);
  if (step === 7 || step === 15) tone(t, 180, 0.16, 'sine', 0.3, 95, musicBus);
  if (step % 2 === 1) noise(t, 0.05, 0.08, 7000, 0.8, 'highpass', musicBus);
  if (step % 4 === 2 && Math.random() < 0.7) {
    const f = pick(PENTA);
    tone(t, f, 0.25, 'triangle', 0.13, 0, musicBus);
    tone(t, f * 2, 0.12, 'sine', 0.05, 0, musicBus);
  }
}
function startMusic() {
  if (!actx || musicTimer) return;
  musicNext = actx.currentTime + 0.05;
  musicStep = 0;
  musicTimer = setInterval(() => {
    const bpm = 112 + (game.speed - BASE_SPEED) * 1.4;
    while (musicNext < actx.currentTime + 0.12) {
      musicStepAt(musicStep, musicNext);
      musicNext += 60 / bpm / 4;
      musicStep = (musicStep + 1) % 16;
    }
  }, 25);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
function setMuted(m) {
  muted = m;
  store.set('sunstone.muted', m);
  if (master) master.gain.value = m ? 0 : 0.55;
  ui.muteBtn.textContent = m ? '🔇' : '🔊';
}

// ============================================================ UI
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), dist: $('dist'), mult: $('mult'), coins: $('coins'), powers: $('powers'), toast: $('toast'),
  menu: $('menu'), pause: $('pause'), over: $('over'), loading: $('loading'),
  muteBtn: $('muteBtn'), bestMenu: $('bestMenu'), bankMenu: $('bankMenu'),
  finalScore: $('finalScore'), finalDist: $('finalDist'), finalCoins: $('finalCoins'),
  bestOver: $('bestOver'), newBest: $('newBest'), deathMsg: $('deathMsg'),
};
const show = (el, v) => el.classList.toggle('hidden', !v);

const hud = {
  last: {},
  toastTimer: 0,
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
  powerEls: {},
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
  hud.toast('Run!');
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
  if (record) { game.best = score; store.set('sunstone.best', score); }
  game.bank += game.coins;
  store.set('sunstone.bank', game.bank);
  const msgs = {
    fall: 'You fell into the abyss',
    wall: 'You ran straight into a wall',
    trip: 'You tripped on a root',
    crash: 'You smashed into the ruins',
    caught: 'The Guardian caught you',
  };
  ui.deathMsg.textContent = msgs[game.deathKind] || 'Run over';
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
    case 'ArrowUp': case 'w': case 'W': case ' ': actJump(); break;
    case 'ArrowDown': case 's': case 'S': actSlide(); break;
    case 'p': case 'P': case 'Escape': pauseGame(); break;
    case 'm': case 'M': setMuted(!muted); break;
    default: break;
  }
});

// swipe controls
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
  else if (dy < 0) actJump();
  else actSlide();
}, { passive: true });
canvas.addEventListener('touchend', () => { touch = null; }, { passive: true });

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
    updateFlyingCoins(dt);
    animateExplorer(dt);
    animateGolem(dt);
    animateWorld(dt);
    updateCamera(dt);
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
window.__sunstone = { game, player };

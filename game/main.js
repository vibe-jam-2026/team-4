// Wings of War Forever: an endless 3D sky-track flyer with a JAS 39 Gripen E.
// Plain ES module + Three.js (vendored). No build step.
import * as THREE from './vendor/three.module.min.js';

// ============================================================ helpers
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
function angleDiff(a, b) { return ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; }
function lerpAngle(a, b, t) { return a + angleDiff(a, b) * t; }
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ============================================================ constants
const TILE = 3;            // segment length along a straight
const HALF = 3;            // half width of the track (6 wide, corners 6x6)
const LANE_W = 2;          // three lanes at x = -2, 0, 2
const PATH_W = HALF * 2;
const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W in (x, z); N = -z
const yawOf = (d) => -d * Math.PI / 2;
const CRUISE = 1.3;        // flying altitude above the track line
const DIVE_ALT = 0.45;
const GRAVITY = 30;
const CLIMB_V = 10.5;      // pull-up: ~0.7 s, ~1.8 m above cruise
const DIVE_TIME = 0.75;
const BASE_SPEED = 15;
const MAX_SPEED = 34;
const CHASE_FAR = 18;
const RELOAD = 1.1;        // seconds to reload one wingtip missile
const LOOP_TIME = 1.35;
const LOOP_R = 3.4;
const LOOP_COOLDOWN = 1.5;
const ROLL_TIME = 0.55;
const FLARE_TIME = 2.6;     // how long boss fire is fooled after a flare drop
const FLARE_COOLDOWN = 7;
const POWER_TIME = { magnet: 10, shield: 8, double: 12 };
const POWER_INFO = {
  magnet: { label: 'Tractor Beam', color: '#4d9bff' },
  shield: { label: 'Deflector', color: '#3fe0c5' },
  double: { label: 'Double Rings', color: '#ff5fae' },
};
// fuselage, dark parts, wings and canards, tail fin
const SKINS = [
  { id: 'default', name: 'Standard grey', price: 0, c: [0x8f989f, 0x5f676e, 0x8f989f, 0x8f989f] },
  { id: 'sweden', name: 'Sweden', price: 50, c: [0x1f5fae, 0x174a8a, 0x1f5fae, 0xfecc02] },
  { id: 'ukraine', name: 'Ukraine', price: 100, c: [0x0057b7, 0x004494, 0xffd700, 0xffd700] },
  { id: 'brazil', name: 'Brazil', price: 150, c: [0x009c3b, 0x007a2e, 0xffdf00, 0x002776] },
];
const LB_KEY = 'wowf.leaderboard';
const WINGMEN = 3;         // loyal wingman saves per run (or per level)
const THEMES = {
  sky: { top: 0x2f6fd0, mid: 0xc4def6, bot: 0xf4f8ff, sunCol: 0xfff2d0, fog: [70, 250], hemi: [0xe2f0ff, 0x8a9cb8, 1.4], sun: [0xfff3dd, 2.4],
    cloud: [0xffffff, 0x8796a8], cloudShade: [0xf0f5fb, 0x7a8a9e], sea: 'cloud', seaColor: 0xffffff, peak: [0x9db3d0, 0xffffff], peakScale: 1, stars: false, scenery: 'clouds', dust: 0xffffff },
  ocean: { top: 0x1f6fd8, mid: 0xbfe3f7, bot: 0x2b7fb8, sunCol: 0xfff4d6, fog: [80, 260], hemi: [0xe8f6ff, 0x3a6f95, 1.45], sun: [0xfff6e0, 2.5],
    cloud: [0xffffff, 0x8fa0b4], cloudShade: [0xf3f7fb, 0x8394a8], sea: 'water', seaColor: 0x1f72ad, peak: [0x7f9fb8, 0xeaf2fa], peakScale: 0.6, stars: false, scenery: 'islands', dust: 0xffffff },
  mountains: { top: 0x4f7fc0, mid: 0xd3e0ec, bot: 0xe9eef4, sunCol: 0xfff0d8, fog: [60, 230], hemi: [0xe6eef8, 0x6a7280, 1.35], sun: [0xfff0dc, 2.3],
    cloud: [0xf4f6f9, 0x7c8796], cloudShade: [0xe6eaf0, 0x6e7988], sea: 'cloud', seaColor: 0xe8edf3, peak: [0x7e8796, 0xffffff], peakScale: 1.7, stars: false, scenery: 'peaks', dust: 0xffffff },
  night: { top: 0x040818, mid: 0x18264d, bot: 0x0a1028, sunCol: 0xc8d8ff, fog: [45, 190], hemi: [0x7f90c8, 0x10142a, 0.8], sun: [0xa8c0ff, 1.2],
    cloud: [0x6d7aa3, 0x252e4e], cloudShade: [0x5f6b92, 0x1e2643], sea: 'cloud', seaColor: 0x2a3658, peak: [0x2a3552, 0x7c8bb0], peakScale: 1, stars: true, scenery: 'clouds', dust: 0x9fb4ff, glowMines: true },
  storm: { top: 0x1b2230, mid: 0x4b5569, bot: 0x2a3140, sunCol: 0x8a98b8, fog: [40, 175], hemi: [0xa6b0c6, 0x1e222b, 0.95], sun: [0xc4cce2, 1.3],
    cloud: [0x6c7488, 0x262b38], cloudShade: [0x5c6478, 0x1f2430], sea: 'water', seaColor: 0x22384b, peak: [0x3a4252, 0x6a7488], peakScale: 0.8, stars: false, scenery: 'storm', dust: 0xc8d4ff, glowMines: true, lightning: true, waves: 1.9 },
};
const LEVELS = [
  { n: 1, name: 'Ocean', theme: 'ocean', target: 1500, boss: 'flanker' },
  { n: 2, name: 'Mountains', theme: 'mountains', target: 2500, boss: 'bomber' },
  { n: 3, name: 'Night', theme: 'night', target: 3500, boss: 'stealth' },
  // the finale: one long straight, one huge boss
  { n: 4, name: 'Storm', theme: 'storm', target: 0, bossDist: 45, boss: 'monster', straight: true },
];
// bosses are original low-poly designs inspired by Russian aircraft
const BOSSES = {
  flanker: { name: 'Boss · Heavy fighter "Flanker"', hp: 8, gap: 30, y: 3.2, clear: 6.6 },
  bomber: { name: 'Boss · Strategic bomber "Blackjack"', hp: 14, gap: 38, y: 4.4, clear: 7.4 },
  stealth: { name: 'Boss · Stealth fighter "Felon"', hp: 14, gap: 30, y: 3.4, clear: 6.6 },
  monster: { name: 'Final boss · Ekranoplan "Sea Monster"', hp: 26, gap: 44, y: 3.8, clear: 8.6 },
};

// ============================================================ renderer / scene
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const HORIZON = new THREE.Color(0xc4def6);
const scene = new THREE.Scene();
scene.background = HORIZON.clone();
scene.fog = new THREE.Fog(HORIZON, 70, 250);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 700);

// Background: sky gradient with sun (or moon), distant peaks and stars. Follows the camera.
const SUN_DIR = new THREE.Vector3(0.4, 0.45, -1).normalize();
const skyGroup = new THREE.Group();
scene.add(skyGroup);
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(520, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fd0) },
      mid: { value: HORIZON.clone() },
      bot: { value: new THREE.Color(0xf4f8ff) },
      sunDir: { value: SUN_DIR },
      sunCol: { value: new THREE.Color(0xfff2d0) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.5, 0.0, 1.0), 0.65)) : mix(mid, bot, pow(clamp(-h * 4.0, 0.0, 1.0), 0.5));
        float s = max(dot(normalize(vP), sunDir), 0.0);
        c += sunCol * (pow(s, 600.0) * 2.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -2;
skyGroup.add(sky);
const peakRock = new THREE.MeshLambertMaterial({ color: 0x9db3d0, flatShading: true, fog: false });
const peakSnow = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false });
const peaks = new THREE.Group();
skyGroup.add(peaks);
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2 + rand(-0.15, 0.15);
  const r = rand(70, 120);
  const h = rand(90, 160);
  const x = Math.cos(a) * 440;
  const z = Math.sin(a) * 440;
  const base = -75;
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), peakRock);
  m.position.set(x, base + h / 2, z);
  m.rotation.y = rand(0, 3);
  peaks.add(m);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 7), peakSnow);
  cap.position.set(x, base + h - h * 0.16 + 0.5, z);
  cap.rotation.y = m.rotation.y;
  peaks.add(cap);
}
const stars = (() => {
  const n = 1600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 0.95 + 0.05;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * 480;
    pos[i * 3] = Math.cos(t) * r; pos[i * 3 + 1] = u * 480; pos[i * 3 + 2] = Math.sin(t) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false }));
  p.renderOrder = -1;
  p.visible = false;
  return p;
})();
skyGroup.add(stars);

// sea of clouds far below the track
const cloudSea = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: 0xffffff }),
);
cloudSea.position.y = -42;
scene.add(cloudSea);
// ...or an ocean with rolling low-poly waves
const WATER_CELL = 1400 / 56;
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400, 56, 56).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x1f72ad, roughness: 0.35, metalness: 0.15, flatShading: true }),
);
water.position.y = -30;
water.visible = false;
scene.add(water);

const hemi = new THREE.HemisphereLight(0xe2f0ff, 0x8a9cb8, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
scene.add(sun, sun.target);

// ============================================================ materials & geometry
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, flatShading: true, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const M = {
  frame: std(0x3d4654, { metalness: 0.6 }),
  edge: std(0x59636f, { metalness: 0.5 }),
  bead: basic(0xff9a2e),
  dash: basic(0xffffff, { transparent: true, opacity: 0.45, depthWrite: false }),
  navRedL: basic(0xff3030),
  navGreenL: basic(0x30ff60),
  railRed: basic(0xff3b3b),
  warn: basic(0xffb020),
  laser: basic(0xff2950),
  energy: basic(0xff3b6b, { transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  cloud: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8796a8, flatShading: true }),
  cloudShade: new THREE.MeshLambertMaterial({ color: 0xf0f5fb, emissive: 0x7a8a9e, flatShading: true }),
  basket: std(0x8a5a2b),
  balloons: [0xff5a4f, 0xffc93c, 0x4fa3ff, 0x7bd66b, 0xb57bff].map((c) => std(c, { roughness: 0.6 })),
  ring: new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0xc06a00, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 }),
  glassDark: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, emissive: 0x153a5a, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.15 }),
  // sky mines
  mine: std(0x3a3f46, { metalness: 0.6, roughness: 0.4 }),
  spike: std(0x9aa1a9, { metalness: 0.7, roughness: 0.3 }),
  mineLight: basic(0xff2020),
  // the Gripen (skinnable)
  jet: std(0x8f989f, { roughness: 0.6, metalness: 0.35 }),
  jetDark: std(0x5f676e, { roughness: 0.6, metalness: 0.35 }),
  jetWing: std(0x8f989f, { roughness: 0.6, metalness: 0.35 }),
  jetTail: std(0x8f989f, { roughness: 0.6, metalness: 0.35 }),
  jetBlack: std(0x23272b, { roughness: 0.4, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, emissive: 0x153a5a, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.15 }),
  flameOuter: basic(0xff8a3d, { transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
  flameInner: basic(0x9fe8ff, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
  navRed: basic(0xff3030),
  navGreen: basic(0x30ff60),
  missile: std(0xf2f2f2, { roughness: 0.5 }),
  missileFin: std(0x8d969e),
  missileNose: std(0x40464d),
  // enemy fighters
  bandit: std(0x7d93aa, { roughness: 0.6, metalness: 0.3 }),
  banditLight: std(0xa9bccd, { roughness: 0.6, metalness: 0.3 }),
  banditDark: std(0x48535e, { roughness: 0.5, metalness: 0.4 }),
  starRed: std(0xd8232a, { flatShading: false }),
  starWhite: std(0xffffff, { flatShading: false }),
  tracer: basic(0xffc040, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
  // pilot / ejection
  seat: std(0x2d3138),
  suit: std(0x6b7a4a),
  harness: std(0x2b2b2b),
  skin: std(0xe0a878),
  helmet: std(0xf2f2f2, { roughness: 0.4 }),
  visor: basic(0xffb23f),
  glove: std(0x3a3a3a),
  chuteA: std(0xff5a3c, { side: THREE.DoubleSide, flatShading: false }),
  chuteB: std(0xffffff, { side: THREE.DoubleSide, flatShading: false }),
  line: basic(0x333333),
  // drone
  drone: std(0x2b3040, { metalness: 0.7, roughness: 0.4 }),
  droneEye: basic(0xff2a2a),
  droneRing: basic(0xff4a3a, { transparent: true, opacity: 0.8 }),
  // pickups
  magnet: new THREE.MeshStandardMaterial({ color: 0x4d9bff, emissive: 0x1a4cff, emissiveIntensity: 0.9, roughness: 0.4 }),
  shield: new THREE.MeshStandardMaterial({ color: 0x3fe0c5, emissive: 0x0f8a76, emissiveIntensity: 0.9, roughness: 0.3 }),
  double: new THREE.MeshStandardMaterial({ color: 0xff5fae, emissive: 0x991d5c, emissiveIntensity: 0.9, roughness: 0.3 }),
  halo: basic(0xffffff, { transparent: true, opacity: 0.6, depthWrite: false }),
  bubble: basic(0x3fe0c5, { transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }),
  spark: basic(0xffc060, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  smoke: basic(0xe8ecf0, { transparent: true, depthWrite: false }),
  // themed scenery
  grass: std(0x4f9a44),
  sand: std(0xe8d39a),
  rockPeak: new THREE.MeshLambertMaterial({ color: 0x7e8796, flatShading: true }),
  snowPeak: new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
  // bosses
  bossWhite: std(0xeef0f2, { roughness: 0.5 }),
  stealth: std(0x4c535c, { roughness: 0.5, metalness: 0.4 }),
  stealthLight: std(0x6c737c, { roughness: 0.5, metalness: 0.4 }),
  goldGlass: new THREE.MeshStandardMaterial({ color: 0x806020, emissive: 0x3a2a08, metalness: 0.9, roughness: 0.2 }),
  mineHalo: basic(0xff3030, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  monster: std(0xb9c2c9, { roughness: 0.55, metalness: 0.3 }),
  monsterDark: std(0x55606b, { roughness: 0.5, metalness: 0.4 }),
  windowGlow: basic(0xffc56a),
  // loyal wingman
  wingman: std(0xb8c4cf, { roughness: 0.5, metalness: 0.3 }),
  wingDark: std(0x5c6773),
  wingStripe: basic(0x3fa0ff),
};

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (rt, rb, h, s = 8) => cached(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

const G = {
  bead: new THREE.SphereGeometry(0.1, 8, 6),
  dash: new THREE.BoxGeometry(0.08, 0.02, 1.1),
  ring: new THREE.TorusGeometry(0.42, 0.08, 8, 20),
  puff: new THREE.IcosahedronGeometry(1, 1),
  mine: new THREE.IcosahedronGeometry(0.7, 1),
  spike: new THREE.ConeGeometry(0.14, 0.5, 6),
  halo: new THREE.TorusGeometry(0.75, 0.05, 6, 24),
  magnet: new THREE.TorusGeometry(0.38, 0.13, 8, 16, Math.PI),
  gem: new THREE.OctahedronGeometry(0.5, 0),
  ico: new THREE.IcosahedronGeometry(0.45, 0),
  bubble: new THREE.SphereGeometry(1.9, 16, 12),
  spark: new THREE.BoxGeometry(0.18, 0.18, 0.18),
  smoke: new THREE.IcosahedronGeometry(0.28, 0),
  beacon: new THREE.SphereGeometry(0.14, 8, 6),
  envelope: new THREE.SphereGeometry(2.2, 12, 10),
  tracer: new THREE.BoxGeometry(0.08, 0.08, 1.4),
  cone: new THREE.ConeGeometry(1, 1, 7),
  disc: new THREE.CylinderGeometry(1, 1, 1, 14),
};

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _euler = new THREE.Euler();

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

// flat extruded plate from 2D points
function plate(points, depth) {
  const sh = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
}

function starPoints(r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

// a missile pointing along -z (nose forward)
function makeMissile() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.2, 8).rotateX(Math.PI / 2), M.missile, 0, 0, 0, g);
  mesh(new THREE.ConeGeometry(0.065, 0.28, 8).rotateX(-Math.PI / 2), M.missileNose, 0, 0, -0.74, g);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = mesh(boxGeo(0.02, 0.2, 0.22), M.missileFin, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.45, g);
    fin.rotation.z = a + Math.PI / 2;
    const cfin = mesh(boxGeo(0.02, 0.12, 0.12), M.missileFin, Math.cos(a) * 0.08, Math.sin(a) * 0.08, -0.35, g);
    cfin.rotation.z = a + Math.PI / 2;
  }
  return g;
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

  const fus = mesh(new THREE.CylinderGeometry(0.3, 0.34, 3.0, 10).rotateX(Math.PI / 2), M.jet, 0, 0, 0.1, body);
  fus.scale.y = 0.85;
  mesh(new THREE.ConeGeometry(0.3, 1.25, 10).rotateX(-Math.PI / 2), M.jet, 0, -0.02, -2.0, body).scale.y = 0.8;
  mesh(new THREE.ConeGeometry(0.06, 0.4, 6).rotateX(-Math.PI / 2), M.jetBlack, 0, -0.02, -2.75, body);
  mesh(boxGeo(0.3, 0.16, 1.9), M.jetDark, 0, 0.27, 0.45, body);
  const canopy = mesh(new THREE.SphereGeometry(0.24, 12, 8), M.glass, 0, 0.24, -1.15, body);
  canopy.scale.set(0.85, 0.75, 2.4);
  for (const s of [-1, 1]) {
    mesh(boxGeo(0.26, 0.42, 1.2), M.jetDark, s * 0.36, -0.05, -0.35, body);
    mesh(boxGeo(0.2, 0.34, 0.05), M.jetBlack, s * 0.36, -0.05, -0.96, body);
  }
  const wingR = plate([[0.25, -0.55], [1.75, 0.95], [1.75, 1.2], [0.25, 1.25]], 0.06).rotateX(Math.PI / 2);
  const wingL = plate([[-0.25, -0.55], [-0.25, 1.25], [-1.75, 1.2], [-1.75, 0.95]], 0.06).rotateX(Math.PI / 2);
  mesh(wingR, M.jetWing, 0, -0.04, 0, body);
  mesh(wingL, M.jetWing, 0, -0.04, 0, body);
  // wingtip rails with missiles (index 0 = left, 1 = right)
  const msl = [];
  for (const s of [-1, 1]) {
    mesh(boxGeo(0.06, 0.06, 1.0), M.jetDark, s * 1.78, -0.04, 0.65, body);
    const m = makeMissile();
    m.position.set(s * 1.78, -0.15, 0.5);
    body.add(m);
    msl.push(m);
  }
  const canR = plate([[0.3, -1.05], [0.95, -0.55], [0.95, -0.42], [0.3, -0.45]], 0.04).rotateX(Math.PI / 2);
  const canL = plate([[-0.3, -1.05], [-0.3, -0.45], [-0.95, -0.42], [-0.95, -0.55]], 0.04).rotateX(Math.PI / 2);
  mesh(canR, M.jetWing, 0, 0.1, 0, body);
  mesh(canL, M.jetWing, 0, 0.1, 0, body);
  const tail = plate([[0.35, 0.3], [1.2, 1.25], [1.5, 1.25], [1.55, 0.3]], 0.06).rotateY(-Math.PI / 2);
  mesh(tail, M.jetTail, 0.03, 0, 0, body);
  mesh(boxGeo(0.07, 0.12, 0.28), M.jetBlack, 0, 1.18, 1.35, body);
  mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.4, 10).rotateX(Math.PI / 2), M.jetBlack, 0, 0, 1.75, body);
  const flame = new THREE.Group();
  flame.position.set(0, 0, 1.95);
  body.add(flame);
  mesh(new THREE.ConeGeometry(0.22, 1.4, 10).rotateX(-Math.PI / 2), M.flameOuter, 0, 0, 0.7, flame);
  mesh(new THREE.ConeGeometry(0.12, 0.8, 8).rotateX(-Math.PI / 2), M.flameInner, 0, 0, 0.4, flame);
  mesh(boxGeo(0.08, 0.08, 0.08), M.navRed, -1.78, 0.06, 0.05, body);
  mesh(boxGeo(0.08, 0.08, 0.08), M.navGreen, 1.78, 0.06, 0.05, body);
  const bubble = mesh(G.bubble, M.bubble, 0, 0, 0, air);
  bubble.scale.set(1.1, 0.6, 1.6);
  bubble.visible = false;
  return { root, air, body, flame, bubble, canopy, msl, reload: [0, 0], nextSide: 0, baseRoll: 0, basePitch: 0 };
}

// ============================================================ enemy fighter (twin tails, red stars)
function makeBandit() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(0.9);
  root.add(body);
  const fus = mesh(new THREE.CylinderGeometry(0.28, 0.3, 3.4, 10).rotateX(Math.PI / 2), M.bandit, 0, 0.05, -0.2, body);
  fus.scale.y = 0.8;
  mesh(new THREE.ConeGeometry(0.28, 1.4, 10).rotateX(-Math.PI / 2), M.banditDark, 0, 0.05, -2.6, body).scale.y = 0.8;
  const can = mesh(new THREE.SphereGeometry(0.22, 12, 8), M.glassDark, 0, 0.3, -1.7, body);
  can.scale.set(0.8, 0.75, 2.2);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.24, 0.22, 2.2, 10).rotateX(Math.PI / 2), M.banditLight, s * 0.42, -0.08, 0.7, body);
    mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.35, 10).rotateX(Math.PI / 2), M.banditDark, s * 0.42, -0.08, 1.9, body);
    mesh(boxGeo(0.34, 0.4, 0.9), M.banditDark, s * 0.42, -0.12, -0.6, body);
  }
  const wingR = plate([[0.4, -1.2], [0.7, -0.5], [2.3, 0.75], [2.3, 1.0], [0.6, 1.1]], 0.06).rotateX(Math.PI / 2);
  const wingL = plate([[-0.4, -1.2], [-0.6, 1.1], [-2.3, 1.0], [-2.3, 0.75], [-0.7, -0.5]], 0.06).rotateX(Math.PI / 2);
  mesh(wingR, M.bandit, 0, 0, 0, body);
  mesh(wingL, M.bandit, 0, 0, 0, body);
  const stabR = plate([[0.6, 1.3], [1.5, 1.9], [1.5, 2.1], [0.6, 2.05]], 0.05).rotateX(Math.PI / 2);
  const stabL = plate([[-0.6, 1.3], [-0.6, 2.05], [-1.5, 2.1], [-1.5, 1.9]], 0.05).rotateX(Math.PI / 2);
  mesh(stabR, M.bandit, 0, -0.05, 0, body);
  mesh(stabL, M.bandit, 0, -0.05, 0, body);
  const finGeo = plate([[0.6, 0.15], [1.4, 1.15], [1.75, 1.15], [1.85, 0.15]], 0.05).rotateY(-Math.PI / 2);
  const starW = plate(starPoints(0.2), 0.02).rotateY(Math.PI / 2);
  const starR = plate(starPoints(0.16), 0.02).rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const fin = mesh(finGeo, M.bandit, s * 0.5 + (s > 0 ? 0.025 : 0.025), 0.05, 0, body);
    fin.rotation.z = -s * 0.22;
    // red star with a white border, on the outer face of each fin
    const out = s > 0 ? 0.01 : -0.08;
    mesh(starW, M.starWhite, out, 0.6, 1.3, fin);
    mesh(starR, M.starRed, out + (s > 0 ? 0.015 : -0.015), 0.6, 1.3, fin);
  }
  const flame = new THREE.Group();
  for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.17, 0.9, 8).rotateX(-Math.PI / 2), M.flameOuter, s * 0.42, -0.08, 2.5, flame);
  body.add(flame);
  return root;
}
const BANDIT = makeBandit();

// ============================================================ bosses (original designs inspired by Russian aircraft)
function finStars(parent, z, y, r, xR, xL) {
  const w = plate(starPoints(r * 1.25), 0.02).rotateY(Math.PI / 2);
  const red = plate(starPoints(r), 0.02).rotateY(Math.PI / 2);
  mesh(w, M.starWhite, xR, y, z, parent);
  mesh(red, M.starRed, xR + 0.015, y, z, parent);
  mesh(w, M.starWhite, xL, y, z, parent);
  mesh(red, M.starRed, xL - 0.015, y, z, parent);
}

// level 1: a heavy twin-tail fighter, a scaled-up bandit loaded with missiles
function makeFlankerBoss() {
  const root = new THREE.Group();
  const b = BANDIT.clone();
  b.scale.setScalar(1.9);
  root.add(b);
  for (const [x, z] of [[-1.5, 0.2], [-2.5, 0.7], [1.5, 0.2], [2.5, 0.7]]) {
    const m = makeMissile();
    m.scale.setScalar(1.7);
    m.position.set(x, -0.35, z);
    root.add(m);
  }
  return root;
}

// level 2: a white swing-wing strategic bomber with four engines
function makeBomber() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const W = M.bossWhite;
  const D = M.banditDark;
  mesh(new THREE.CylinderGeometry(0.6, 0.62, 9, 12).rotateX(Math.PI / 2), W, 0, 0, 0, body).scale.y = 0.85;
  mesh(new THREE.ConeGeometry(0.6, 2.6, 12).rotateX(-Math.PI / 2), W, 0, 0.05, -5.8, body).scale.y = 0.8;
  mesh(new THREE.ConeGeometry(0.6, 1.8, 12).rotateX(Math.PI / 2), W, 0, 0, 5.4, body).scale.y = 0.7;
  mesh(new THREE.SphereGeometry(0.4, 12, 8), M.glassDark, 0, 0.42, -4.6, body).scale.set(1, 0.6, 2);
  mesh(plate([[0.5, -2.6], [1.8, -1.4], [6.4, 2.4], [6.4, 2.9], [1.6, 1.4], [0.5, 1.6]], 0.12).rotateX(Math.PI / 2), W, 0, -0.1, 0, body);
  mesh(plate([[-0.5, -2.6], [-0.5, 1.6], [-1.6, 1.4], [-6.4, 2.9], [-6.4, 2.4], [-1.8, -1.4]], 0.12).rotateX(Math.PI / 2), W, 0, -0.1, 0, body);
  const flame = new THREE.Group();
  body.add(flame);
  for (const s of [-1, 1]) {
    mesh(boxGeo(1.4, 0.7, 3.4), W, s * 1.6, -0.6, 1.8, body);
    for (const k of [-0.35, 0.35]) {
      mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.4, 10).rotateX(Math.PI / 2), D, s * 1.6 + k, -0.6, 3.6, body);
      mesh(new THREE.ConeGeometry(0.24, 1.4, 8).rotateX(-Math.PI / 2), M.flameOuter, s * 1.6 + k, -0.6, 4.4, flame);
    }
  }
  mesh(plate([[2.2, 0.4], [4.4, 3.4], [5.4, 3.4], [5.6, 0.4]], 0.12).rotateY(-Math.PI / 2), W, 0.06, 0.2, 0, body);
  mesh(plate([[0.1, 3.8], [2.6, 4.9], [2.6, 5.3], [0.1, 5.1]], 0.08).rotateX(Math.PI / 2), W, 0, 2.2, 0, body);
  mesh(plate([[-0.1, 3.8], [-0.1, 5.1], [-2.6, 5.3], [-2.6, 4.9]], 0.08).rotateX(Math.PI / 2), W, 0, 2.2, 0, body);
  finStars(body, -4.6, 1.6, 0.5, 0.065, -0.085);
  mesh(G.beacon, M.navRed, -6.4, -0.05, 2.65, body).scale.setScalar(2);
  mesh(G.beacon, M.navGreen, 6.4, -0.05, 2.65, body).scale.setScalar(2);
  return root;
}

// level 3: a dark angular stealth fighter with canted fins
function makeStealth() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.9);
  root.add(body);
  const S = M.stealth;
  const L = M.stealthLight;
  mesh(new THREE.CylinderGeometry(0.5, 0.55, 4.2, 6).rotateX(Math.PI / 2), S, 0, 0, 0.2, body).scale.set(1.5, 0.45, 1);
  mesh(new THREE.ConeGeometry(0.5, 1.8, 6).rotateX(-Math.PI / 2), S, 0, 0.02, -2.9, body).scale.set(1.1, 0.5, 1);
  mesh(new THREE.SphereGeometry(0.22, 12, 8), M.goldGlass, 0, 0.24, -1.9, body).scale.set(0.8, 0.7, 2.4);
  mesh(plate([[0.6, -1.6], [1.0, -1.0], [3.2, 1.2], [3.2, 1.7], [0.8, 2.0]], 0.06).rotateX(Math.PI / 2), S, 0, -0.02, 0, body);
  mesh(plate([[-0.6, -1.6], [-0.8, 2.0], [-3.2, 1.7], [-3.2, 1.2], [-1.0, -1.0]], 0.06).rotateX(Math.PI / 2), S, 0, -0.02, 0, body);
  mesh(plate([[0.45, -2.3], [1.05, -1.5], [0.6, -1.4]], 0.04).rotateX(Math.PI / 2), L, 0, 0.02, 0, body);
  mesh(plate([[-0.45, -2.3], [-0.6, -1.4], [-1.05, -1.5]], 0.04).rotateX(Math.PI / 2), L, 0, 0.02, 0, body);
  mesh(plate([[0.9, 1.9], [1.9, 2.5], [1.9, 2.75], [0.9, 2.7]], 0.05).rotateX(Math.PI / 2), S, 0, -0.04, 0, body);
  mesh(plate([[-0.9, 1.9], [-0.9, 2.7], [-1.9, 2.75], [-1.9, 2.5]], 0.05).rotateX(Math.PI / 2), S, 0, -0.04, 0, body);
  const flame = new THREE.Group();
  body.add(flame);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.26, 0.28, 1.8, 10).rotateX(Math.PI / 2), L, s * 0.62, -0.1, 1.6, body);
    mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.35, 10).rotateX(Math.PI / 2), M.banditDark, s * 0.62, -0.1, 2.65, body);
    mesh(new THREE.ConeGeometry(0.2, 1.0, 8).rotateX(-Math.PI / 2), M.flameOuter, s * 0.62, -0.1, 3.3, flame);
    const fin = mesh(plate([[1.1, 0.1], [1.9, 0.95], [2.35, 0.95], [2.55, 0.1]], 0.05).rotateY(-Math.PI / 2), S, s * 0.72 + 0.025, 0.12, 0, body);
    fin.rotation.z = -s * 0.5;
    const out = s > 0 ? 0.01 : -0.08;
    mesh(plate(starPoints(0.2), 0.02).rotateY(Math.PI / 2), M.starWhite, out, 0.5, 1.95, fin);
    mesh(plate(starPoints(0.16), 0.02).rotateY(Math.PI / 2), M.starRed, out + (s > 0 ? 0.015 : -0.015), 0.5, 1.95, fin);
  }
  mesh(G.beacon, M.navRed, -3.2, 0, 1.45, body);
  mesh(G.beacon, M.navGreen, 3.2, 0, 1.45, body);
  mesh(boxGeo(0.9, 0.04, 0.05), M.railRed, 0, 0.05, -3.6, body); // glowing intake edge
  return root;
}

// final level: a giant wing-in-ground-effect craft with nose engines and missile tubes
function makeMonster() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const H = M.monster;
  const D = M.monsterDark;
  mesh(new THREE.CylinderGeometry(1.1, 1.2, 16, 12).rotateX(Math.PI / 2), H, 0, 0, 0, body).scale.y = 0.85;
  mesh(new THREE.ConeGeometry(1.1, 3.2, 12).rotateX(-Math.PI / 2), H, 0, 0.1, -9.6, body).scale.y = 0.8;
  mesh(new THREE.ConeGeometry(1.2, 2.6, 12).rotateX(Math.PI / 2), H, 0, 0, 9.3, body).scale.y = 0.7;
  mesh(boxGeo(1.9, 0.5, 14), D, 0, -0.95, 0.4, body); // boat hull
  mesh(boxGeo(1.2, 0.35, 1.6), M.glassDark, 0, 0.85, -7.6, body);
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) mesh(boxGeo(0.05, 0.18, 0.4), M.windowGlow, sx * 1.12, 0.25, -5.5 + i * 1.6, body);
  // stubby wings with tip floats
  mesh(plate([[1, -1], [6.2, 1.6], [6.2, 3.3], [1, 3.6]], 0.22).rotateX(Math.PI / 2), H, 0, -0.35, 0, body);
  mesh(plate([[-1, -1], [-1, 3.6], [-6.2, 3.3], [-6.2, 1.6]], 0.22).rotateX(Math.PI / 2), H, 0, -0.35, 0, body);
  for (const sx of [-1, 1]) mesh(boxGeo(0.7, 0.9, 3.2), D, sx * 6.2, -0.8, 2.4, body);
  // forward pylons carrying the engines
  mesh(plate([[0.8, -6.6], [4.0, -5.3], [4.0, -4.4], [0.8, -4.6]], 0.16).rotateX(Math.PI / 2), H, 0, 0.35, 0, body);
  mesh(plate([[-0.8, -6.6], [-0.8, -4.6], [-4.0, -4.4], [-4.0, -5.3]], 0.16).rotateX(Math.PI / 2), H, 0, 0.35, 0, body);
  const flame = new THREE.Group();
  body.add(flame);
  for (const sx of [-1, 1]) {
    for (const ex of [1.5, 2.3, 3.1]) {
      mesh(new THREE.CylinderGeometry(0.32, 0.3, 1.8, 10).rotateX(Math.PI / 2), D, sx * ex, 0.75, -5.6, body);
      mesh(new THREE.ConeGeometry(0.24, 1.2, 8).rotateX(-Math.PI / 2), M.flameOuter, sx * ex, 0.75, -4.1, flame);
    }
  }
  // missile launch tubes on the spine
  for (const z of [-2.8, 0.2, 3.2]) for (const sx of [-1, 1]) {
    const t = mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.4, 10).rotateX(Math.PI / 2), D, sx * 0.55, 1.15, z, body);
    t.rotation.x = 0.12;
  }
  // big T-tail
  mesh(plate([[4.6, 0.8], [7.2, 5.6], [8.3, 5.6], [8.6, 0.8]], 0.22).rotateY(-Math.PI / 2), H, 0.11, 0, 0, body);
  mesh(plate([[0.1, 6.6], [4.8, 7.9], [4.8, 8.6], [0.1, 8.4]], 0.16).rotateX(Math.PI / 2), H, 0, 5.4, 0, body);
  mesh(plate([[-0.1, 6.6], [-0.1, 8.4], [-4.8, 8.6], [-4.8, 7.9]], 0.16).rotateX(Math.PI / 2), H, 0, 5.4, 0, body);
  finStars(body, 7.2, 3.0, 0.75, 0.12, -0.14);
  mesh(G.beacon, M.navRed, -6.2, 0, 2.4, body).scale.setScalar(2.5);
  mesh(G.beacon, M.navGreen, 6.2, 0, 2.4, body).scale.setScalar(2.5);
  mesh(G.beacon, M.mineLight, 0, 6.0, 7.6, body).scale.setScalar(2.5);
  return root;
}

// ============================================================ loyal wingman drone
function makeWingman() {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const body = new THREE.Group();
  body.scale.setScalar(0.8);
  root.add(body);
  mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.8, 8).rotateX(Math.PI / 2), M.wingman, 0, 0, 0, body).scale.y = 0.7;
  mesh(new THREE.ConeGeometry(0.28, 1.2, 8).rotateX(-Math.PI / 2), M.wingman, 0, 0, -2.0, body).scale.y = 0.7;
  mesh(boxGeo(0.4, 0.22, 1.0), M.wingDark, 0, 0.2, -0.6, body);
  mesh(boxGeo(0.06, 0.03, 2.6), M.wingStripe, 0, 0.21, 0.1, body);
  mesh(plate([[0.2, -0.8], [2.0, 0.9], [2.0, 1.15], [0.2, 1.3]], 0.05).rotateX(Math.PI / 2), M.wingman, 0, -0.03, 0, body);
  mesh(plate([[-0.2, -0.8], [-0.2, 1.3], [-2.0, 1.15], [-2.0, 0.9]], 0.05).rotateX(Math.PI / 2), M.wingman, 0, -0.03, 0, body);
  for (const s of [-1, 1]) {
    const fin = mesh(plate([[0.7, 0.1], [1.2, 0.8], [1.45, 0.8], [1.55, 0.1]], 0.04).rotateY(-Math.PI / 2), M.wingDark, s * 0.25, 0.05, 0, body);
    fin.rotation.z = -s * 0.65;
  }
  mesh(new THREE.ConeGeometry(0.18, 1.0, 8).rotateX(-Math.PI / 2), M.flameOuter, 0, 0, 1.9, body);
  return root;
}

// ============================================================ ejection seat, pilot and parachute
function makeEjection() {
  const seatG = new THREE.Group();
  mesh(boxGeo(0.5, 0.1, 0.5), M.seat, 0, 0, 0, seatG);
  mesh(boxGeo(0.5, 0.9, 0.1), M.seat, 0, 0.45, 0.24, seatG);
  mesh(boxGeo(0.08, 0.3, 0.45), M.seat, -0.27, 0.12, 0, seatG);
  mesh(boxGeo(0.08, 0.3, 0.45), M.seat, 0.27, 0.12, 0, seatG);
  mesh(boxGeo(0.3, 0.12, 0.1), M.warn, 0, 0.94, 0.24, seatG);
  const flame = mesh(new THREE.ConeGeometry(0.14, 0.7, 8).rotateX(Math.PI), M.flameOuter, 0, -0.4, 0.1, seatG);

  // the pilot (origin at the hips)
  const pilot = new THREE.Group();
  const pivot = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  mesh(boxGeo(0.36, 0.46, 0.24), M.suit, 0, 0.25, 0, pilot);
  mesh(boxGeo(0.38, 0.06, 0.26), M.harness, 0, 0.02, 0, pilot);
  mesh(boxGeo(0.06, 0.46, 0.26), M.harness, -0.1, 0.25, 0, pilot);
  mesh(boxGeo(0.06, 0.46, 0.26), M.harness, 0.1, 0.25, 0, pilot);
  const head = pivot(0, 0.56, 0, pilot);
  mesh(new THREE.SphereGeometry(0.12, 10, 8), M.skin, 0, 0.1, 0, head);
  const helm = mesh(new THREE.SphereGeometry(0.15, 12, 8), M.helmet, 0, 0.14, 0.02, head);
  helm.scale.set(1, 0.95, 1.05);
  mesh(boxGeo(0.2, 0.08, 0.05), M.visor, 0, 0.13, -0.13, head);
  const armL = pivot(-0.23, 0.44, 0, pilot);
  const armR = pivot(0.23, 0.44, 0, pilot);
  for (const a of [armL, armR]) {
    mesh(boxGeo(0.1, 0.42, 0.11), M.suit, 0, -0.2, 0, a);
    mesh(boxGeo(0.1, 0.1, 0.1), M.glove, 0, -0.45, 0, a);
  }
  const legL = pivot(-0.1, 0, 0, pilot);
  const legR = pivot(0.1, 0, 0, pilot);
  for (const l of [legL, legR]) {
    mesh(boxGeo(0.14, 0.5, 0.15), M.suit, 0, -0.25, 0, l);
    mesh(boxGeo(0.15, 0.12, 0.26), M.harness, 0, -0.55, -0.05, l);
  }
  // parachute, rigged above the shoulders
  const chute = new THREE.Group();
  chute.position.y = 0.5;
  pilot.add(chute);
  const gores = 10;
  for (let i = 0; i < gores; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(1.9, 4, 6, (i / gores) * Math.PI * 2, (Math.PI * 2) / gores, 0, Math.PI / 2.3), i % 2 ? M.chuteA : M.chuteB);
    seg.position.y = 2.6;
    seg.scale.y = 0.55;
    chute.add(seg);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = new THREE.Mesh(boxGeo(0.015, 2.8, 0.015), M.line);
    l.position.set(Math.cos(a) * 0.85, 1.35, Math.sin(a) * 0.85);
    l.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    chute.add(l);
  }
  seatG.add(pilot);
  seatG.visible = false;
  return { seatG, pilot, chute, flame, armL, armR, legL, legR, head };
}

function seatPilot(ej) {
  // put the pilot back in the seat, seated pose
  ej.seatG.add(ej.pilot);
  ej.pilot.position.set(0, 0.12, 0.02);
  ej.pilot.rotation.set(0, 0, 0);
  ej.legL.rotation.set(1.45, 0, 0);
  ej.legR.rotation.set(1.45, 0, 0);
  ej.armL.rotation.set(0.5, 0, 0.1);
  ej.armR.rotation.set(0.5, 0, -0.1);
  ej.chute.visible = false;
  ej.chute.scale.setScalar(0.01);
  ej.flame.visible = true;
  ej.seatG.rotation.set(0, 0, 0);
}

// ============================================================ the hunter drone (the chaser)
function makeDrone() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const core = mesh(new THREE.OctahedronGeometry(1, 0), M.drone, 0, 0, 0, body);
  core.scale.set(1.3, 0.6, 1.8);
  for (const s of [-1, 1]) {
    mesh(boxGeo(0.18, 0.18, 2.0), M.drone, s * 0.85, 0, -0.9, body);
    mesh(boxGeo(0.22, 0.22, 0.22), M.droneEye, s * 0.85, 0, -1.95, body);
    const fin = mesh(boxGeo(1.2, 0.08, 0.7), M.drone, s * 1.3, 0.1, 0.4, body);
    fin.rotation.z = s * 0.35;
  }
  const eye = mesh(new THREE.SphereGeometry(0.32, 12, 8), M.droneEye, 0, 0.1, -1.2, body);
  const ring = mesh(new THREE.TorusGeometry(1.6, 0.07, 6, 32).rotateX(Math.PI / 2), M.droneRing, 0, 0, 0.1, body);
  return { root, body, eye, ring };
}

const jet = makeGripen();
scene.add(jet.root);
const ej = makeEjection();
scene.add(ej.seatG);
const looseCanopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M.glass);
looseCanopy.scale.set(0.85, 0.75, 2.4);
looseCanopy.visible = false;
scene.add(looseCanopy);
const drone = makeDrone();
scene.add(drone.root);
const wingMesh = makeWingman();
wingMesh.visible = false;
scene.add(wingMesh);
const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), M.tracer);
beam.visible = false;
scene.add(beam);
const wing = { active: false, t: 0, side: 1, target: new THREE.Vector3() };

// ============================================================ skins
let ownedSkins = store.get('wowf.skins', ['default']);
let currentSkin = store.get('wowf.skin', 'default');
function applySkin(id) {
  const sk = SKINS.find((s) => s.id === id) || SKINS[0];
  currentSkin = sk.id;
  M.jet.color.setHex(sk.c[0]);
  M.jetDark.color.setHex(sk.c[1]);
  M.jetWing.color.setHex(sk.c[2]);
  M.jetTail.color.setHex(sk.c[3]);
}
applySkin(ownedSkins.includes(currentSkin) ? currentSkin : 'default');

// ============================================================ world generation
// The sky track is a chain of straights. Each starts at a corner centre P, runs in
// direction dir for L metres and ends at the next corner. Headings are only ever
// N, E or W, so the track can never loop back over itself.
let straights = [];
let passed = [];
let removeQueue = [];

function endPoint(st) { return { x: st.P.x + st.fx * st.L, z: st.P.z + st.fz * st.L }; }
function worldOf(st, s, x, y, out) { return out.set(st.P.x + st.fx * s + st.rx * x, y, st.P.z + st.fz * s + st.rz * x); }

function createStraight(P, dir, opts = {}) {
  const first = !!opts.first;
  const L = first ? 111 : randInt(17, 38) * 3;
  let corner;
  if (game.straightOnly) corner = 'S'; // no turns: the next straight carries straight on
  else if (dir === 0) corner = pick(['L', 'R', 'L', 'R', 'T']);
  else corner = dir === 1 ? 'L' : 'R';
  const f = DIRV[dir];
  const r = DIRV[(dir + 1) % 4];
  const st = {
    P: { x: P.x, z: P.z }, dir, L, corner, first,
    fx: f[0], fz: f[1], rx: r[0], rz: r[1],
    sStart: first ? -15 : HALF,
    obstacles: [], coins: [], powers: [], beacons: [], spinners: [], mineLights: [], drops: [],
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

function difficulty() { return clamp((game.dist + game.diffOffset) / 4000, 0, 1); }

function populate(st) {
  const diff = difficulty();
  const end = st.L - 18;
  const calm = !!game.boss || game.straightOnly; // during a boss fight the boss lays the mines
  let s = st.first ? 38 : 6;
  for (;;) {
    s += rand(lerp(22, 11, diff), lerp(32, 18, diff)) * (calm ? 1.8 : 1);
    if (s > end) break;
    const r = Math.random();
    const type = calm ? (r < 0.5 ? 'fence' : 'gate') : r < 0.3 ? 'fence' : r < 0.58 ? 'gate' : 'rock';
    if (type === 'rock') {
      const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
      const n = Math.random() < 0.35 + 0.4 * diff ? 2 : 1;
      for (const l of lanes.slice(0, n)) st.obstacles.push({ type, s, half: 0.9, lane: l, meshes: [] });
    } else {
      st.obstacles.push({ type, s, half: 0.5, meshes: [] });
    }
  }

  // ring rows (arching over fences, dipping under gates, avoiding mine lanes)
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

  if (!st.first && Math.random() < 0.42) {
    const s2 = rand(18, st.L - 20);
    const near = st.obstacles.filter((ob) => Math.abs(ob.s - s2) < 4);
    const free = [-1, 0, 1].filter((l) => !near.some((ob) => ob.type !== 'rock' || ob.lane === l));
    if (free.length) st.powers.push({ s: s2, x: pick(free) * LANE_W, type: pick(['magnet', 'shield', 'double']), taken: false, mesh: null });
  }
}

function chevron(parent, x, y, z, side, mat, size = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(size);
  const a = mesh(boxGeo(0.95, 0.22, 0.08), mat, 0, 0.28, 0, g);
  const b = mesh(boxGeo(0.95, 0.22, 0.08), mat, 0, -0.28, 0, g);
  a.rotation.z = -side * 0.6;
  b.rotation.z = side * 0.6;
  parent.add(g);
  return g;
}

function cloud(parent, x, y, z, size, shade = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const n = randInt(4, 7);
  for (let i = 0; i < n; i++) {
    const p = mesh(G.puff, shade && i % 2 ? M.cloudShade : M.cloud, rand(-1.4, 1.4) * size, rand(-0.2, 0.5) * size, rand(-0.8, 0.8) * size, g);
    p.scale.set(size * rand(0.7, 1.2), size * rand(0.5, 0.8), size * rand(0.7, 1.1));
    p.rotation.y = rand(0, 3);
  }
  parent.add(g);
  return g;
}

function balloon(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mat = pick(M.balloons);
  mesh(G.envelope, mat, 0, 2.6, 0, g).scale.set(1, 1.2, 1);
  mesh(cylGeo(1.2, 0.5, 1.2, 10), mat, 0, 0.6, 0, g);
  mesh(new THREE.TorusGeometry(2.05, 0.12, 6, 20).rotateX(Math.PI / 2), M.cloud, 0, 2.6, 0, g);
  mesh(boxGeo(0.7, 0.55, 0.7), M.basket, 0, -0.45, 0, g);
  parent.add(g);
  return g;
}

function buildMine(st, ob, fromY = CRUISE) {
  const holder = new THREE.Group();
  holder.position.set(ob.lane * LANE_W, fromY, -ob.s);
  const core = new THREE.Group();
  holder.add(core);
  mesh(G.mine, M.mine, 0, 0, 0, core);
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, -0.7, 0]];
  for (const [x, y, z] of dirs) {
    const sp = mesh(G.spike, M.spike, x * 0.78, y * 0.78, z * 0.78, core);
    sp.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _v2.set(x, y, z).normalize());
  }
  st.mineLights.push(mesh(G.beacon, M.mineLight, 0, 0.45, -0.55, holder));
  st.mineLights[st.mineLights.length - 1].scale.setScalar(1.5);
  mesh(G.halo, M.mineHalo, 0, 0, 0, holder).scale.setScalar(1.45);
  st.group.add(holder);
  ob.meshes.push(holder);
  st.spinners.push({ m: core, sx: rand(-0.8, 0.8), sy: rand(0.5, 1.2) });
  if (fromY !== CRUISE) st.drops.push(holder);
}

function peak(parent, x, z, top) {
  const r = Math.min(rand(8, 13), Math.abs(x) - 5);
  const h = top + 70;
  const ry = rand(0, 3);
  const m = mesh(G.cone, M.rockPeak, x, top - h / 2, z, parent);
  m.scale.set(r, h, r);
  m.rotation.y = ry;
  if (top > 3) {
    const hc = h * 0.16;
    const c = mesh(G.cone, M.snowPeak, x, top - hc / 2 + 0.05, z, parent);
    c.scale.set(r * 0.165, hc, r * 0.165);
    c.rotation.y = ry;
  }
}

function island(parent, x, z) {
  const r = rand(6, 14);
  const h = rand(5, 15);
  const m = mesh(G.cone, M.grass, x, -30 + h / 2, z, parent);
  m.scale.set(r, h, r);
  m.rotation.y = rand(0, 3);
  mesh(G.disc, M.sand, x, -30.3, z, parent).scale.set(r * 1.3, 1, r * 1.3);
}

function buildCorner(st, g) {
  const L = st.L;
  const turnSides = st.corner === 'T' ? [-1, 1] : [st.corner === 'L' ? -1 : 1];
  for (const sd of turnSides) {
    for (let k = 0; k < 2; k++) chevron(g, sd * (0.6 + k * 1.2), 0.03, -L, sd, M.warn, 1.3).rotation.x = -Math.PI / 2;
  }
  // edge lights around the corner on its closed sides
  const cornerBeads = [];
  for (let k = -1; k <= 1; k++) cornerBeads.push([k * 2.5, -L - 3]);
  if (st.corner === 'L') for (let k = -1; k <= 1; k++) cornerBeads.push([3, -L + k * 2.5]);
  if (st.corner === 'R') for (let k = -1; k <= 1; k++) cornerBeads.push([-3, -L + k * 2.5]);
  for (const [x, z] of cornerBeads) mesh(G.bead, M.railRed, x, 0, z, g);
  mesh(boxGeo(PATH_W + 0.6, 0.3, 0.3), M.frame, 0, 0.7, -L - 3.2, g);
  mesh(boxGeo(PATH_W + 0.6, 1.3, 0.04), M.energy, 0, 0.6, -L - 3.2, g);
  for (const sx of [-1, 1]) mesh(boxGeo(0.3, 5.2, 0.3), M.frame, sx * 3.3, 2.0, -L - 3.2, g);
  mesh(boxGeo(PATH_W + 0.6, 1.2, 0.15), M.frame, 0, 4.6, -L - 3.2, g);
  for (const sd of turnSides) {
    for (let k = 0; k < 3; k++) chevron(g, sd * (0.6 + k * 0.9), 4.6, -L - 3.1, sd, M.warn, 0.8);
  }

}

function build(st) {
  const g = st.group;
  const L = st.L;

  // no floor: the track is only floating edge lights and faint lane dashes
  const marks = [];
  for (let s = st.sStart; s < L - HALF - 0.01; s += TILE) marks.push(s + TILE / 2);
  const bm = new THREE.InstancedMesh(G.bead, M.bead, marks.length * 2);
  const dm = new THREE.InstancedMesh(G.dash, M.dash, marks.length * 2);
  marks.forEach((c, i) => {
    for (const [k, sx] of [[0, -1], [1, 1]]) {
      _m4.makeTranslation(sx * 3.0, 0, -c); bm.setMatrixAt(i * 2 + k, _m4);
      _m4.makeTranslation(sx * 1.0, 0, -c); dm.setMatrixAt(i * 2 + k, _m4);
    }
  });
  g.add(bm, dm);

  if (st.corner === 'S') {
    // no corner here: just keep the edge lights and lane dashes going
    for (const z of [L - 1.5, L + 1.5]) for (const sx of [-1, 1]) {
      mesh(G.bead, M.bead, sx * 3, 0, -z, g);
      mesh(G.dash, M.dash, sx * 1.0, 0, -z, g);
    }
  } else buildCorner(st, g);
  // blinking nav lights: red on the left, green on the right
  for (let s = st.sStart + 6; s < L - 6; s += 12) {
    st.beacons.push(mesh(G.beacon, M.navRedL, -3.0, 0.25, -s, g));
    st.beacons.push(mesh(G.beacon, M.navGreenL, 3.0, 0.25, -s, g));
  }

  // obstacles
  for (const ob of st.obstacles) {
    if (ob.type === 'fence') {
      for (const sx of [-1, 1]) ob.meshes.push(mesh(boxGeo(0.3, 2.3, 0.3), M.frame, sx * 3.0, 1.0, -ob.s, g));
      for (const y of [0.35, 0.95, 1.55, 2.05]) ob.meshes.push(mesh(boxGeo(PATH_W, 0.07, 0.07), M.laser, 0, y, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(PATH_W, 2.0, 0.03), M.energy, 0, 1.15, -ob.s, g));
    } else if (ob.type === 'gate') {
      for (const sx of [-1, 1]) ob.meshes.push(mesh(boxGeo(0.4, 4.8, 0.4), M.frame, sx * 3.25, 1.9, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(PATH_W + 0.5, 0.45, 0.45), M.frame, 0, 1.22, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(PATH_W + 0.5, 0.25, 0.3), M.frame, 0, 4.2, -ob.s, g));
      ob.meshes.push(mesh(boxGeo(PATH_W, 2.75, 0.03), M.energy, 0, 2.82, -ob.s, g));
      for (let i = -2; i <= 2; i++) {
        const stripe = mesh(boxGeo(0.45, 0.3, 0.04), i % 2 ? M.warn : M.frame, i * 1.2, 1.22, -ob.s - 0.24, g);
        stripe.rotation.z = 0.5;
        ob.meshes.push(stripe);
      }
      ob.meshes.push(mesh(boxGeo(PATH_W, 0.05, 0.05), M.railRed, 0, 0.98, -ob.s - 0.24, g));
    } else if (ob.type === 'rock') {
      buildMine(st, ob);
    }
  }

  if (st.coins.length) {
    st.coinMesh = new THREE.InstancedMesh(G.ring, M.ring, st.coins.length);
    st.coins.forEach((c, i) => {
      _m4.makeTranslation(c.x, c.y, -c.s);
      st.coinMesh.setMatrixAt(i, _m4);
    });
    g.add(st.coinMesh);
  }

  for (const p of st.powers) {
    const holder = new THREE.Group();
    holder.position.set(p.x, CRUISE, -p.s);
    if (p.type === 'magnet') mesh(G.magnet, M.magnet, 0, 0, 0, holder).rotation.z = Math.PI;
    else if (p.type === 'shield') mesh(G.gem, M.shield, 0, 0, 0, holder);
    else mesh(G.ico, M.double, 0, 0, 0, holder);
    mesh(G.halo, M.halo, 0, 0, 0, holder);
    g.add(holder);
    p.mesh = holder;
  }

  // scenery depends on the map: clouds, islands on the ocean, or peaks in the mountains
  const n = Math.floor(st.L / 8);
  const kind = theme.scenery;
  for (let i = 0; i < n; i++) {
    const s = rand(14, Math.max(16, L - 14));
    const r = Math.random();
    const sd = Math.random() < 0.5 ? -1 : 1;
    if (kind === 'islands') {
      if (r < 0.35) island(g, rand(-45, 45), -s);
      else if (r < 0.8) cloud(g, sd * rand(13, 33), rand(-8, 10), -s, rand(2, 4), true);
      else if (r < 0.95) cloud(g, rand(-30, 30), rand(-22, -12), -s, rand(2.5, 4.5), true);
      else st.spinners.push({ m: balloon(g, sd * rand(15, 30), rand(-4, 12), -s), sx: 0, sy: rand(-0.1, 0.1) });
    } else if (kind === 'storm') {
      if (r < 0.55) cloud(g, sd * rand(13, 33), rand(-6, 14), -s, rand(3, 6), true);
      else cloud(g, rand(-30, 30), rand(-24, -12), -s, rand(3, 5.5), true);
    } else if (kind === 'peaks') {
      if (r < 0.5) peak(g, sd * rand(14, 32), -s, rand(-4, 24));
      else if (r < 0.8) cloud(g, rand(-30, 30), rand(-30, -10), -s, rand(2.5, 5), true);
      else cloud(g, sd * rand(13, 33), rand(-10, 6), -s, rand(2, 3.5), true);
    } else if (r < 0.45) {
      cloud(g, rand(-30, 30), rand(-30, -10), -s, rand(2.5, 5), true);
    } else if (r < 0.92) {
      cloud(g, sd * rand(13, 33), rand(-12, 10), -s, rand(2, 4.5), true);
    } else {
      st.spinners.push({ m: balloon(g, sd * rand(15, 30), rand(-4, 12), -s), sx: 0, sy: rand(-0.1, 0.1) });
    }
  }

  if (st.first) {
    mesh(boxGeo(14, 0.8, 22), M.edge, 0, -0.45, 24, g);
    for (let z = 15; z < 34; z += 4) mesh(boxGeo(0.3, 0.02, 2), M.dash, 0, 0, z, g);
    mesh(boxGeo(3, 6, 3), M.frame, -5.5, 3, 30, g);
    mesh(boxGeo(3.6, 1.4, 3.6), M.glass, -5.5, 6.6, 30, g);
    cloud(g, 0, -6, 24, 6, true);
    cloud(g, 8, -9, 32, 5, true);
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
  const nd = st.corner === 'S' ? st.dir : st.corner === 'L' ? (st.dir + 3) % 4 : (st.dir + 1) % 4;
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
  looping: false, loopT: 0, rollT: 0, rollDir: 0,
  magnet: 0, shield: 0, double: 0,
  yaw: 0, pos: new THREE.Vector3(),
};
const game = {
  state: 'loading', slow: 0, dist: 0, score: 0, coins: 0, speed: BASE_SPEED, mult: 1,
  chaseGap: 12, chaseHold: 0, stumbleT: 0, deathT: 0, deathKind: '', time: 0,
  trail: [], camYaw: 0, camY: 4, camPull: 0, nextMilestone: 500, ej: null,
  loopCd: 0, enemyT: 8, kills: 0,
  mode: 'endless', level: 0, wingmen: WINGMEN, boss: null, bossDone: false, levelClear: false,
  levelStartScore: 0, speedBonus: 0, diffOffset: 0, straightOnly: false, flash: 0, flashT: 3,
  flareT: 0, flareCd: 0,
  best: store.get('starlane.best', 0), bank: store.get('starlane.bank', 0),
};
let campaign = store.get('wowf.campaign', { unlocked: 1, cleared: 0 });
if (!campaign || typeof campaign.unlocked !== 'number') campaign = { unlocked: 1, cleared: 0 };
campaign.unlocked = Math.max(campaign.unlocked, Math.min(LEVELS.length, (campaign.cleared || 0) + 1)); // new levels unlock for past winners

// ============================================================ map themes
let theme = THEMES.sky;
function applyTheme(id) {
  theme = THEMES[id] || THEMES.sky;
  const t = theme;
  const u = sky.material.uniforms;
  u.top.value.setHex(t.top); u.mid.value.setHex(t.mid); u.bot.value.setHex(t.bot); u.sunCol.value.setHex(t.sunCol);
  scene.background.setHex(t.mid);
  scene.fog.color.setHex(t.mid);
  scene.fog.near = t.fog[0]; scene.fog.far = t.fog[1];
  hemi.color.setHex(t.hemi[0]); hemi.groundColor.setHex(t.hemi[1]); hemi.intensity = t.hemi[2];
  sun.color.setHex(t.sun[0]); sun.intensity = t.sun[1];
  M.cloud.color.setHex(t.cloud[0]); M.cloud.emissive.setHex(t.cloud[1]);
  M.cloudShade.color.setHex(t.cloudShade[0]); M.cloudShade.emissive.setHex(t.cloudShade[1]);
  peakRock.color.setHex(t.peak[0]); peakSnow.color.setHex(t.peak[1]);
  M.rockPeak.color.setHex(id === 'night' ? 0x3a4562 : 0x7e8796);
  M.snowPeak.color.setHex(id === 'night' ? 0x8a98bd : 0xffffff);
  peaks.scale.y = t.peakScale;
  stars.visible = t.stars;
  cloudSea.visible = t.sea === 'cloud';
  cloudSea.material.color.setHex(t.seaColor);
  water.visible = t.sea === 'water';
  water.material.color.setHex(t.seaColor);
  dust.material.color.setHex(t.dust);
  // mines glow red in the dark so they stay easy to see
  M.mine.emissive.setHex(t.glowMines ? 0x6a0d0d : 0x000000);
  M.spike.emissive.setHex(t.glowMines ? 0x4a1010 : 0x000000);
  M.mineHalo.opacity = t.glowMines ? 0.75 : 0;
  bolt.visible = false;
}

// lightning for the storm level: a flicker of light and a jagged bolt in the distance
const FLASH_COL = new THREE.Color(0xe4ebff);
const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(10).fill(0).map(() => new THREE.Vector3())),
  new THREE.LineBasicMaterial({ color: 0xffffff, fog: false }));
bolt.visible = false;
bolt.frustumCulled = false;
scene.add(bolt);
function updateLightning(dt) {
  if (!theme.lightning) return;
  game.flashT -= dt;
  if (game.flashT <= 0) {
    game.flash = 1;
    game.flashT = rand(2.5, 6);
    const pos = bolt.geometry.attributes.position;
    const fx = -Math.sin(game.camYaw);
    const fz = -Math.cos(game.camYaw);
    const side = rand(-90, 90);
    let x = camera.position.x + fx * 160 - fz * side;
    let z = camera.position.z + fz * 160 + fx * side;
    for (let i = 0; i < 10; i++) {
      pos.setXYZ(i, x, 70 - i * 11, z);
      x += rand(-7, 7); z += rand(-7, 7);
    }
    pos.needsUpdate = true;
    setTimeout(() => sfx('thunder'), rand(200, 700));
  }
  game.flash = Math.max(0, game.flash - dt * 3.2);
  const f = game.flash * (0.65 + 0.35 * Math.sin(game.time * 70));
  hemi.intensity = theme.hemi[2] + f * 2.4;
  sun.intensity = theme.sun[1] + f * 1.5;
  const mid = sky.material.uniforms.mid.value.setHex(theme.mid).lerp(FLASH_COL, f * 0.45);
  scene.background.copy(mid);
  scene.fog.color.copy(mid);
  bolt.visible = game.flash > 0.35;
}

function updateWater() {
  water.position.x = Math.round(camera.position.x / WATER_CELL) * WATER_CELL;
  water.position.z = Math.round(camera.position.z / WATER_CELL) * WATER_CELL;
  const pos = water.geometry.attributes.position;
  const t = game.time;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + water.position.x;
    const wz = pos.getZ(i) + water.position.z;
    pos.setY(i, (Math.sin(wx * 0.12 + t * 1.1) * 0.7 + Math.cos(wz * 0.1 + t * 0.8) * 0.7) * (theme.waves || 1));
  }
  pos.needsUpdate = true;
}
const flyingCoins = [];
const coinPool = [];
const missiles = [];
const missilePool = [];
const sparks = [];
const sparkPool = [];
const smokes = [];
const smokePool = [];
const enemies = [];
const flares = [];
const flarePool = [];
const bullets = [];
const bulletPool = [];

function clearEnemies() {
  for (const e of enemies) scene.remove(e.mesh);
  enemies.length = 0;
  for (const b of bullets) b.mesh.visible = false;
  bulletPool.push(...bullets.splice(0).map((b) => b.mesh));
}

function newGame(opts = {}) {
  const mode = opts.mode || 'endless';
  const level = mode === 'campaign' ? opts.level || 1 : 0;
  applyTheme(mode === 'campaign' ? LEVELS[level - 1].theme : 'sky');
  removeBoss();
  setMusicTrack('cruise');
  wing.active = false; wingMesh.visible = false; beam.visible = false;
  for (const st of [...straights]) disposeStraight(st);
  straights = []; passed = []; removeQueue = [];
  for (const c of flyingCoins) c.mesh.visible = false;
  coinPool.push(...flyingCoins.splice(0));
  for (const m of missiles) m.mesh.visible = false;
  missilePool.push(...missiles.splice(0).map((m) => m.mesh));
  for (const p of sparks) p.mesh.visible = false;
  sparkPool.push(...sparks.splice(0).map((p) => p.mesh));
  for (const p of smokes) p.mesh.visible = false;
  smokePool.push(...smokes.splice(0).map((p) => p.mesh));
  clearEnemies();
  Object.assign(game, {
    dist: 0, slow: 0, score: 0, coins: 0, speed: BASE_SPEED, mult: 1,
    chaseGap: 12, chaseHold: 0, stumbleT: 0, deathT: 0, deathKind: '',
    trail: [], camYaw: 0, camY: 4, camPull: 0, nextMilestone: 500, ej: null,
    loopCd: 0, enemyT: 8, kills: 0,
    mode, level, wingmen: WINGMEN, boss: null, bossDone: false, levelClear: false,
    score: opts.score || 0, levelStartScore: opts.score || 0,
    speedBonus: level ? Math.min(2, level - 1) * 3 : 0, diffOffset: level ? (level - 1) * 1200 : 0,
    straightOnly: !!(level && LEVELS[level - 1].straight), flash: 0, flashT: 3,
    flareT: 0, flareCd: 0,
  });
  for (const f of flares) f.mesh.visible = false;
  flarePool.push(...flares.splice(0).map((f) => f.mesh));
  Object.assign(player, {
    s: 0, x: 0, y: 0, vy: 0, lane: 0, alt: CRUISE, air: false, slideT: 0, pendingTurn: 0, fireCd: 0,
    looping: false, loopT: 0, rollT: 0, rollDir: 0,
    magnet: 0, shield: 0, double: 0, yaw: 0,
  });
  player.st = createStraight({ x: 0, z: 0 }, 0, { first: true });
  ensureAhead();
  for (let d = -30; d <= 0; d += 1) game.trail.push({ d, x: 0, y: CRUISE, z: -d });
  jet.root.visible = true;
  jet.canopy.visible = true;
  jet.air.rotation.set(0, 0, 0);
  jet.baseRoll = 0; jet.basePitch = 0;
  jet.bubble.visible = false;
  jet.msl.forEach((m) => { m.visible = true; });
  jet.reload = [0, 0];
  seatPilot(ej);
  ej.seatG.visible = false;
  looseCanopy.visible = false;
  drone.root.visible = true;
  updatePlayerWorld();
  hud.reset();
}

// ============================================================ controls / actions
function turnWindow() { return Math.max(14, game.speed * 0.9); }
function inTurnWindow() {
  const st = player.st;
  if (st.corner === 'S') return false;
  return player.s >= st.L - HALF - turnWindow() && player.s <= st.L + HALF;
}

function tryTurn(side) {
  const st = player.st;
  if (!inTurnWindow()) return false;
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

// straight-only levels: hop onto the next straight without turning
function carryOn() {
  const st = player.st;
  player.s -= st.L;
  passed.push(st);
  while (passed.length > 2) disposeStraight(passed.shift());
  player.st = st.next;
  ensureAhead();
}

function changeLane(side) {
  const target = player.lane + side;
  if (target < -1 || target > 1) return;
  for (const ob of player.st.obstacles) {
    if (ob.type === 'rock' && !ob.smashed && ob.lane === target && Math.abs(player.s - ob.s) < ob.half + 0.5
      && Math.abs(player.alt - CRUISE) < 1.4) {
      if (player.shield > 0) break;
      stumble();
      return;
    }
  }
  player.lane = target;
  sfx('swish');
}

function actSide(side, roll = false) {
  if (game.state !== 'playing') return;
  if (roll && player.rollT <= 0) {
    player.rollT = ROLL_TIME;
    player.rollDir = side;
    game.score += 10 * game.mult;
    sfx('roll');
  }
  if (!tryTurn(side)) changeLane(side);
}
function actClimb() {
  if (game.state !== 'playing' || player.air || player.looping) return;
  player.vy = CLIMB_V; player.air = true; player.slideT = 0;
  sfx('climb');
}
function actDive() {
  if (game.state !== 'playing' || player.looping) return;
  if (player.air) player.vy = Math.min(player.vy, -22);
  if (player.slideT <= 0) sfx('dive');
  player.slideT = DIVE_TIME;
}
function actLoop() {
  if (game.state !== 'playing' || player.looping || game.loopCd > 0) return;
  player.looping = true;
  player.loopT = 0;
  player.air = false; player.vy = 0; player.y = 0; player.slideT = 0;
  game.score += 25 * game.mult;
  hud.toast('Loop!');
  sfx('loop');
}

const targetX = (t) => (t.type === 'rock' ? t.lane * LANE_W : t.x);
const targetY = (t) => (t.type === 'rock' ? CRUISE : t.type === 'boss' ? t.liftY ?? t.y : t.y);

function findTarget(fromS) {
  if (game.boss && !game.boss.dying) return game.boss;
  let best = null;
  let bestScore = Infinity;
  for (const e of enemies) {
    if (e.smashed || e.targeted || e.st !== player.st) continue;
    const d = e.s - fromS;
    if (d < 6 || d > 140) continue;
    const sc = d - 40;
    if (sc < bestScore) { bestScore = sc; best = e; }
  }
  for (const ob of player.st.obstacles) {
    if (ob.type !== 'rock' || ob.smashed || ob.targeted) continue;
    const d = ob.s - fromS;
    if (d < 3 || d > 85) continue;
    const sc = d + Math.abs(ob.lane - player.lane) * 12;
    if (sc < bestScore) { bestScore = sc; best = ob; }
  }
  return best;
}

function actFire() {
  if (game.state !== 'playing' || player.fireCd > 0) return;
  let side = jet.nextSide;
  if (!jet.msl[side].visible) side = 1 - side;
  if (!jet.msl[side].visible) { sfx('click'); return; }
  jet.msl[side].visible = false;
  jet.reload[side] = RELOAD;
  jet.nextSide = 1 - side;
  player.fireCd = 0.25;
  const m = missilePool.pop() || makeMissile();
  if (!m.parent) scene.add(m);
  m.visible = true;
  const target = findTarget(player.s);
  if (target && target.type !== 'boss') target.targeted = true;
  missiles.push({
    mesh: m, st: player.st, s: player.s + 0.4, prevS: player.s, x: player.x + (side ? 1.5 : -1.5), y: player.alt - 0.15,
    vs: game.speed + 4, t: 0, smokeT: 0, target,
  });
  sfx('missile');
}

// ---------- flares: decoys that pull boss fire away from the jet
const FLARE_GEO = new THREE.SphereGeometry(0.16, 8, 6);
function deployFlares(source = 'key') {
  if (game.state !== 'playing') return false;
  if (game.flareCd > 0) {
    if (source !== 'voice') { sfx('click'); hud.toast(`Flares in ${Math.ceil(game.flareCd)}s`); }
    return false;
  }
  game.flareT = FLARE_TIME;
  game.flareCd = FLARE_COOLDOWN;
  // fan of burning flares to both sides, with a little of the jet's speed so they hang in view
  const fx = -Math.sin(player.yaw);
  const fz = -Math.cos(player.yaw);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const m = flarePool.pop() || new THREE.Mesh(FLARE_GEO, new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    if (!m.parent) scene.add(m);
    m.visible = true;
    m.material.opacity = 1;
    m.position.copy(player.pos);
    const out = side * rand(5, 10);
    const fwd = game.speed * rand(0.45, 0.7);
    flares.push({
      mesh: m, t: -Math.floor(i / 2) * 0.07, life: rand(1.6, 2.2), smokeT: 0,
      vx: fx * fwd - fz * out, vy: rand(1.5, 4.5), vz: fz * fwd + fx * out,
    });
  }
  // anything a boss already has in the air goes for the flares
  for (const b of bullets) if (b.boss) decoy(b);
  sfx('flares');
  hud.toast(source === 'voice' ? '🎙 Flares!' : 'Flares!');
  return true;
}
function decoy(b) {
  if (b.decoy) return;
  b.decoy = true;
  b.dx = (b.x >= player.x ? 1 : -1) * rand(5, 9);
  b.dy = -rand(2, 5);
}
function updateFlares(dt) {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.t += dt;
    if (f.t < 0) { f.mesh.position.copy(player.pos); continue; } // staggered launch
    if (f.t >= f.life) { f.mesh.visible = false; flarePool.push(f.mesh); flares.splice(i, 1); continue; }
    f.vy -= 6 * dt;
    f.vx *= 0.985; f.vz *= 0.985;
    f.mesh.position.x += f.vx * dt;
    f.mesh.position.y += f.vy * dt;
    f.mesh.position.z += f.vz * dt;
    const flick = 1.6 + Math.sin(f.t * 40 + i) * 0.4;
    f.mesh.scale.setScalar(flick * (1 - f.t / f.life * 0.5));
    f.mesh.material.opacity = 1 - (f.t / f.life) ** 2;
    f.smokeT -= dt;
    if (f.smokeT <= 0) { f.smokeT = 0.05; puff(f.mesh.position, 1, 0.45, 0.9, 0xf2f2f2); }
  }
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

function smash(ob, st, byMissile) {
  ob.smashed = true;
  for (const m of ob.meshes) m.visible = false;
  worldOf(st, ob.s, ob.type === 'rock' ? ob.lane * LANE_W : 0, ob.type === 'rock' ? CRUISE : 1.5, _v);
  burst(_v, ob.type === 'rock' ? 0xffa040 : 0xff5070, byMissile ? 28 : 18);
  puff(_v, 6, 1.6);
  sfx('boom');
  if (byMissile) { game.score += 50 * game.mult; hud.toast(`+${50 * game.mult}`); }
}

function killEnemy(e, byMissile) {
  e.smashed = true;
  burst(e.mesh.position, 0xffa040, 40);
  puff(e.mesh.position, 10, 2.2, 1.2, 0x666666);
  scene.remove(e.mesh);
  sfx('boom');
  shake = Math.max(shake, 0.2);
  if (byMissile) {
    game.kills++;
    game.score += 150 * game.mult;
    hud.toast(`Splash one! +${150 * game.mult}`);
  }
}

function hitObstacle(ob) {
  if (player.shield > 0 || game.levelClear) { smash(ob, player.st, false); shake = 0.25; return; }
  if (ob.type === 'rock' && game.wingmen > 0) { wingmanSave(ob); return; }
  die(ob.type);
}

// a loyal wingman swoops in and shoots the mine down just before impact
function wingmanSave(ob) {
  smash(ob, player.st, false); // leaves the mine's world position in _v
  launchWingman(_v, 'Wingman saved you!');
}

// ...or flies into the line of fire and soaks up a whole boss burst
function wingmanBlock(hit) {
  for (const b of bullets) {
    if (!b.boss || b.st !== player.st) continue;
    const r = b.s - player.s;
    if (r > -2 && r < 26 && Math.abs(b.x - player.x) < 1.6) {
      b.kill = true;
      burst(b.mesh.position, 0xffe080, 6);
    }
  }
  launchWingman(hit.mesh.position, 'Wingman blocked the burst!');
}

function launchWingman(target, msg) {
  game.wingmen--;
  wing.target.copy(target);
  wing.side = player.x <= 0 ? 1 : -1;
  wing.t = 0;
  wing.active = true;
  wingMesh.visible = true;
  shake = 0.2;
  sfx('wingman');
  hud.toast(game.wingmen > 0 ? `${msg} ${game.wingmen} left` : `${msg} None left`);
}

function animateWingman(dt) {
  if (!wing.active) return;
  wing.t += dt;
  const T = 2.0;
  const p = Math.min(1, wing.t / T);
  const climb = Math.max(0, wing.t - 0.9);
  const x = player.x + wing.side * lerp(3.4, 2.4, Math.min(1, p * 3));
  worldOf(player.st, player.s + lerp(-3, 42, ease(p)), x, CRUISE + 1.1 + climb * 5, wingMesh.position);
  wingMesh.rotation.set(climb * 0.6, player.yaw, -wing.side * (0.3 + climb * 1.3));
  if (wing.t < 0.25) {
    beam.visible = true;
    const len = wingMesh.position.distanceTo(wing.target);
    beam.position.copy(wingMesh.position).lerp(wing.target, 0.5);
    beam.scale.set(1, 1, Math.max(0.1, len));
    beam.lookAt(wing.target);
  } else beam.visible = false;
  if (wing.t > T) { wing.active = false; wingMesh.visible = false; beam.visible = false; }
}

// ============================================================ boss fights
function spawnBoss() {
  const lv = LEVELS[game.level - 1];
  const def = BOSSES[lv.boss];
  const m = lv.boss === 'flanker' ? makeFlankerBoss() : lv.boss === 'bomber' ? makeBomber() : lv.boss === 'monster' ? makeMonster() : makeStealth();
  scene.add(m);
  worldOf(player.st, player.s + 170, 0, def.y + 8, m.position);
  game.boss = {
    type: 'boss', id: lv.boss, def, mesh: m, hp: def.hp, maxHp: def.hp, gap: 170, x: 0, y: def.y, lane: 0,
    st: player.st, s: player.s + 170, attackT: 3.2, moveT: 2, pulse: 0, dying: 0, smashed: false, bank: 0,
    yaw: yawOf(player.st.dir), attackN: 0, angry: false,
  };
  ui.bossName.textContent = def.name;
  hud.toast('Warning! Boss incoming');
  setMusicTrack('boss');
  sfx('warn');
  setTimeout(() => sfx('warn'), 450);
}

function removeBoss() {
  if (game.boss) { scene.remove(game.boss.mesh); game.boss = null; }
}

function placeBoss(dt, b) {
  // where the boss is drawn: follow the track round a corner once it is past it,
  // and climb over gates, fences and corner barriers instead of flying through them.
  // Gameplay (gap, lane, attacks, hit box) is unchanged.
  let st = player.st;
  let s = player.s + b.gap;
  let afterTurn = false;
  if (s > st.L && st.next) { afterTurn = st.corner !== 'S'; s -= st.L; st = st.next; }
  let need = b.y;
  if (!b.dying) {
    for (const ob of st.obstacles) {
      if (ob.smashed) continue;
      if (ob.type === 'gate' && Math.abs(ob.s - s) < 9) need = Math.max(need, b.def.clear);
      if (ob.type === 'fence' && Math.abs(ob.s - s) < 7) need = Math.max(need, 4.4);
    }
    // stay high around a turn: before the corner barrier and just after it
    if ((st.corner !== 'S' && s > st.L - 10) || (afterTurn && s < 12)) need = Math.max(need, b.def.clear + 0.6);
  }
  b.liftY = b.dying ? b.y : lerp(b.liftY ?? b.y, need, damp(3.5, dt));
  worldOf(st, s, b.x, b.liftY + Math.sin(game.time * 1.6) * 0.25, _v);
  b.mesh.position.lerp(_v, damp(b.dying ? 3 : 6, dt));
  b.yaw = lerpAngle(b.yaw, yawOf(st.dir), damp(3, dt));
  b.mesh.rotation.y = b.yaw;
  if (!b.dying) { b.mesh.rotation.z = -b.bank; b.mesh.rotation.x = 0; }
  if (b.pulse > 0) { b.pulse -= dt; b.mesh.scale.setScalar(1 + Math.max(0, b.pulse) * 0.4); } else b.mesh.scale.setScalar(1);
}

function updateBoss(dt) {
  const b = game.boss;
  if (!b) return;
  b.st = player.st;
  b.s = player.s + b.gap;
  if (b.dying > 0) {
    b.dying += dt;
    b.y -= dt * (2 + b.dying * 5);
    b.gap += dt * 4;
    b.mesh.rotation.z += dt * 2.5;
    b.mesh.rotation.x = -0.35;
    if (Math.random() < dt * 12) {
      _v.copy(b.mesh.position).add(_v3.set(rand(-3, 3), rand(-1, 1), rand(-3, 3)));
      burst(_v, 0xffa040, 10);
      puff(_v, 2, 1.5, 1.0, 0x555555);
    }
    if (Math.random() < dt * 3) sfx('boom');
    placeBoss(dt, b);
    if (b.dying > 2.6) {
      burst(b.mesh.position, 0xffd080, 60);
      puff(b.mesh.position, 14, 3);
      sfx('boom');
      removeBoss();
      levelComplete();
    }
    return;
  }
  const angry = b.hp <= b.maxHp / 2;
  b.gap = lerp(b.gap, b.def.gap + Math.sin(game.time * 0.7) * 3, damp(0.9, dt));
  b.moveT -= dt;
  if (b.moveT <= 0) { b.lane = randInt(-1, 1); b.moveT = rand(1.4, 2.6) * (angry ? 0.7 : 1); }
  const dx = b.lane * LANE_W - b.x;
  b.x += dx * damp(2.2, dt);
  b.bank = lerp(b.bank, clamp(dx * 0.35, -0.6, 0.6), damp(4, dt));
  if (b.gap < b.def.gap + 12) {
    b.attackT -= dt;
    if (b.attackT <= 0) bossAttack(b, angry);
  }
  placeBoss(dt, b);
}

function bossAttack(b, angry) {
  b.attackN++;
  if (b.id === 'flanker') {
    if (b.attackN % 2) dropMine(b, b.lane); else bossGuns(b, 3);
    b.attackT = angry ? 1.2 : 1.7;
  } else if (b.id === 'monster') {
    const ratio = b.hp / b.maxHp;
    const k = b.attackN % 4;
    if (k === 0) bossGuns(b, ratio < 0.66 ? 5 : 4);
    else if (k === 1) [-1, 0, 1].sort(() => Math.random() - 0.5).slice(0, 2).forEach((l) => dropMine(b, l));
    else if (k === 2) { dropMine(b, player.lane); bossGuns(b, 3); }
    else bossGuns(b, ratio < 0.33 ? 7 : 5);
    b.attackT = ratio < 0.33 ? 0.9 : ratio < 0.66 ? 1.2 : 1.55;
  } else if (b.id === 'bomber') {
    // carpet of mines, never all three lanes
    const n = angry || Math.random() < 0.5 ? 2 : 1;
    [-1, 0, 1].sort(() => Math.random() - 0.5).slice(0, n).forEach((l) => dropMine(b, l));
    b.attackT = angry ? 1.5 : 2.1;
  } else {
    const k = b.attackN % 3;
    if (k === 0) bossGuns(b, 5);
    else if (k === 1) [-1, 0, 1].sort(() => Math.random() - 0.5).slice(0, 2).forEach((l) => dropMine(b, l));
    else { bossGuns(b, 3); dropMine(b, player.lane); }
    b.attackT = angry ? 1.15 : 1.6;
  }
}

function dropMine(b, lane) {
  let st = player.st;
  let s = b.s - 3;
  if (s < player.s + 12) return;
  if (s > st.L - 10) {
    if (st.corner !== 'S' || !st.next) return;
    s -= st.L;
    st = st.next;
    if (s < st.sStart + 2 || s > st.L - 10) return;
  }
  const ob = { type: 'rock', s, half: 0.9, lane, meshes: [] };
  st.obstacles.push(ob);
  buildMine(st, ob, (b.liftY ?? b.y) - 0.6);
  sfx('drop');
}

function bossGuns(b, n) {
  for (let i = 0; i < n; i++) {
    for (const off of [-0.4, 0.4]) {
      const m = bulletPool.pop() || new THREE.Mesh(G.tracer, M.tracer);
      if (!m.parent) scene.add(m);
      m.visible = true;
      bullets.push({ mesh: m, st: player.st, s: b.s - 3 - i * 2.4, x: b.x + off, y: CRUISE, prevR: Infinity, v: 34, boss: true });
    }
  }
  sfx('gun');
}

function hitBoss() {
  const b = game.boss;
  if (!b || b.dying) return;
  b.hp--;
  b.pulse = 0.25;
  burst(b.mesh.position, 0xffb050, 16);
  puff(b.mesh.position, 3, 1.2, 0.8, 0x777777);
  sfx('hit');
  game.score += 100 * game.mult;
  if (b.hp <= 0) {
    b.dying = 0.0001;
    game.levelClear = true;
    game.bossDone = true;
    game.score += 2000 * game.level;
    hud.toast(game.level === LEVELS.length ? 'Final boss destroyed!' : 'Boss destroyed!');
    setMusicTrack('cruise');
    sfx('boom');
    shake = 0.5;
  } else if (b.id === 'monster') {
    if (!b.phase2 && b.hp <= (b.maxHp * 2) / 3) { b.phase2 = true; hud.toast('Phase 2!'); }
    if (!b.phase3 && b.hp <= b.maxHp / 3) { b.phase3 = true; b.angry = true; hud.toast('Final phase!'); }
  } else if (!b.angry && b.hp <= b.maxHp / 2) {
    b.angry = true;
    hud.toast('Boss damaged! It is getting angry');
  }
}

function die(kind) {
  if (game.state !== 'playing') return;
  game.state = 'dying';
  game.deathKind = kind;
  game.deathT = 0;
  player.slideT = 0;
  player.looping = false;
  hideTurnHint();
  stopMusic();
  if (kind === 'eject') {
    sfx('eject');
    jet.canopy.visible = false;
    worldOf(player.st, player.s, player.x, player.alt + 0.25, _v);
    looseCanopy.position.copy(_v);
    looseCanopy.rotation.set(0, player.yaw, 0);
    looseCanopy.visible = true;
    seatPilot(ej);
    ej.seatG.position.copy(_v);
    ej.seatG.rotation.set(0, player.yaw, 0);
    ej.seatG.visible = true;
    game.ej = { vy: 17, cvy: 9, svy: 0, pvy: 0, separated: false, jetAhead: 0, jetAlt: player.alt, pitch: 0 };
    shake = 0.2;
    return;
  }
  shake = 0.6;
  burst(player.pos, 0xff9040, 34);
  sfx('death');
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

function puff(pos, n = 1, size = 1, life = 0.8, grey = 0xe8ecf0) {
  for (let i = 0; i < n; i++) {
    let m = smokePool.pop();
    if (!m) { m = new THREE.Mesh(G.smoke, M.smoke.clone()); scene.add(m); }
    m.material.color.setHex(grey);
    m.visible = true;
    m.position.copy(pos);
    if (n > 1) m.position.add(_v3.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(size * 0.5));
    m.rotation.set(rand(0, 3), rand(0, 3), 0);
    smokes.push({ mesh: m, t: 0, life: life * rand(0.8, 1.2), size: size * rand(0.8, 1.2) });
  }
}
function updateSmoke(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const p = smokes[i];
    p.t += dt;
    if (p.t >= p.life) { p.mesh.visible = false; smokePool.push(p.mesh); smokes.splice(i, 1); continue; }
    const k = p.t / p.life;
    p.mesh.scale.setScalar(p.size * (1 + k * 3));
    p.mesh.material.opacity = 0.7 * (1 - k);
    p.mesh.position.y += dt * 0.6;
  }
}

// wind streaks rushing past for a sense of speed
const DUST_N = 220;
const dustPos = new Float32Array(DUST_N * 3);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.8, depthWrite: false }));
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
      dustPos[o + 1] = rand(-10, 14);
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
  game.speed = Math.min(MAX_SPEED, BASE_SPEED + game.speedBonus + Math.sqrt(game.dist) * 0.34) * (1 - game.slow);
  const sp = game.speed;
  const prevS = player.s;
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
  if (game.loopCd > 0) game.loopCd -= dt;
  if (game.flareCd > 0) game.flareCd -= dt;
  if (game.flareT > 0) game.flareT -= dt;
  if (player.rollT > 0) player.rollT -= dt;
  for (let i = 0; i < 2; i++) {
    if (jet.reload[i] > 0) {
      jet.reload[i] -= dt;
      if (jet.reload[i] <= 0) jet.msl[i].visible = true;
    }
  }

  // lateral and vertical motion
  player.x += (player.lane * LANE_W - player.x) * damp(13, dt);
  if (player.slideT > 0) player.slideT -= dt;
  if (player.looping) {
    player.loopT += dt;
    const th = 2 * Math.PI * Math.min(1, player.loopT / LOOP_TIME);
    player.alt = CRUISE + LOOP_R * (1 - Math.cos(th));
    player.y = player.alt - CRUISE;
    if (player.loopT >= LOOP_TIME) {
      player.looping = false;
      player.alt = CRUISE; player.y = 0;
      game.loopCd = LOOP_COOLDOWN;
    }
  } else {
    if (player.air) {
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) { player.y = 0; player.vy = 0; player.air = false; }
    }
    const altTarget = player.slideT > 0 ? DIVE_ALT : CRUISE + player.y;
    player.alt = player.air ? altTarget : lerp(player.alt, altTarget, damp(16, dt));
  }

  // corners (the autopilot takes the turn while a beaten boss goes down)
  if (game.levelClear && !player.pendingTurn && inTurnWindow()) player.pendingTurn = st.corner === 'R' ? 1 : -1;
  if (st.corner === 'S' && player.s >= st.L && st.next) carryOn();
  else if (player.pendingTurn && player.s >= st.L - 1.0) executeTurn();
  else if (player.s > st.L + HALF - 0.7) { die('wall'); return; }
  updateTurnHint();

  // obstacles
  const cur = player.st;
  for (const ob of cur.obstacles) {
    if (ob.smashed) continue;
    if (Math.abs(player.s - ob.s) > ob.half + 0.4) continue;
    if (ob.type === 'fence' && player.y < 0.7) hitObstacle(ob);
    else if (ob.type === 'gate' && player.alt > 0.8 && player.alt < 4.5) hitObstacle(ob);
    else if (ob.type === 'rock' && Math.abs(player.x - ob.lane * LANE_W) < 1.35 && Math.abs(player.alt - CRUISE) < 1.4) hitObstacle(ob);
    if (game.state !== 'playing') return;
  }

  updateEnemies(dt, prevS);
  if (game.state !== 'playing') return;
  if (game.mode === 'campaign') {
    const lv = LEVELS[game.level - 1];
    const ready = lv.bossDist ? game.dist >= lv.bossDist : game.score - game.levelStartScore >= lv.target;
    if (!game.boss && !game.bossDone && ready) spawnBoss();
    updateBoss(dt);
    if (game.state !== 'playing') return;
  }

  // rings
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

  if (game.stumbleT > 0) game.stumbleT -= dt;
  if (game.chaseHold > 0) game.chaseHold -= dt;
  else game.chaseGap = Math.min(CHASE_FAR, game.chaseGap + dt * 2.4);

  updatePlayerWorld();
  game.trail.push({ d: game.dist, x: player.pos.x, y: player.alt, z: player.pos.z });
  while (game.trail.length > 2 && game.trail[1].d < game.dist - 45) game.trail.shift();
}

// ============================================================ enemy fighters
function spawnEnemy(ahead = 125) {
  const st = player.st;
  const s = player.s + ahead;
  if (s > st.L - 8) return false;
  const lane = randInt(-1, 1);
  const m = BANDIT.clone();
  scene.add(m);
  enemies.push({
    type: 'fighter', st, s, x: lane * LANE_W, y: CRUISE + 0.2, lane, mesh: m,
    vs: -lerp(10, 18, difficulty()), fireT: 0.2, aimed: false, smashed: false, targeted: false, prevR: Infinity, bank: 0,
  });
  hud.toast('Bandit ahead!');
  sfx('warn');
  return true;
}

function updateEnemies(dt, prevPlayerS) {
  // spawning
  if (game.dist > 250 && !game.boss) {
    game.enemyT -= dt;
    if (game.enemyT <= 0 && !enemies.some((e) => !e.smashed)) {
      const diff = difficulty();
      game.enemyT = spawnEnemy() ? rand(lerp(11, 5, diff), lerp(16, 9, diff)) : 1;
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.smashed) { enemies.splice(i, 1); continue; }
    e.s += e.vs * dt;
    const onTrack = e.st === player.st;
    const r = onTrack ? e.s - player.s : Infinity;
    // line up on the player's lane at range, then commit
    if (!e.aimed && r < 95) { e.lane = player.lane; e.aimed = true; }
    const dx = e.lane * LANE_W - e.x;
    e.x += dx * damp(4, dt);
    e.bank = lerp(e.bank, clamp(dx * 0.5, -0.8, 0.8), damp(6, dt));
    // guns
    if (onTrack && r > 22 && r < 85) {
      e.fireT -= dt;
      if (e.fireT <= 0) { e.fireT = 0.42; fireBullet(e); }
    }
    // head-on collision
    if (onTrack && e.prevR >= -1.5 && r <= 1.8 && Math.abs(e.x - player.x) < 1.9 && Math.abs(player.alt - e.y) < 1.5) {
      if (player.shield > 0 || game.levelClear) { killEnemy(e, false); enemies.splice(i, 1); continue; }
      die('fighter');
      return;
    }
    e.prevR = r;
    if (!onTrack || r < -25 || e.s < e.st.sStart - 10) { scene.remove(e.mesh); enemies.splice(i, 1); continue; }
    let lift = 0;
    for (const ob of e.st.obstacles) {
      if (ob.smashed || Math.abs(ob.s - e.s) > 6) continue;
      if (ob.type === 'gate') lift = Math.max(lift, 3.8);
      else if (ob.type === 'fence') lift = Math.max(lift, 1.6);
    }
    e.visY = lerp(e.visY ?? e.y, e.y + lift, damp(5, dt));
    worldOf(e.st, e.s, e.x, e.visY + Math.sin(game.time * 3 + i) * 0.08, e.mesh.position);
    e.mesh.rotation.set(0, yawOf(e.st.dir) + Math.PI, -e.bank);
  }
  updateBullets(dt, prevPlayerS);
}

function fireBullet(e) {
  for (const off of [-0.35, 0.35]) {
    const m = bulletPool.pop() || new THREE.Mesh(G.tracer, M.tracer);
    if (!m.parent) scene.add(m);
    m.visible = true;
    bullets.push({ mesh: m, st: e.st, s: e.s - 2.6, x: e.x + off, y: e.y, prevR: Infinity, v: 70 });
  }
  sfx('gun');
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.s -= b.v * dt;
    const onTrack = b.st === player.st;
    const r = onTrack ? b.s - player.s : -Infinity;
    if (b.boss && game.flareT > 0 && r < 34) decoy(b);
    if (b.decoy) { b.x += b.dx * dt; b.y += b.dy * dt; }
    let dead = !onTrack || r < -12 || b.kill || (b.decoy && b.y < -6);
    if (!dead && !b.decoy && b.prevR >= -0.8 && r <= 1.0 && Math.abs(b.x - player.x) < 0.95 && Math.abs(b.y - player.alt) < 0.9) {
      if (player.rollT > 0 || player.shield > 0 || game.levelClear) {
        burst(b.mesh.position, 0xffe080, 5);
        sfx('ping');
        if (player.rollT > 0) hud.toast('Deflected!');
        dead = true;
      } else if (b.boss && game.wingmen > 0) {
        wingmanBlock(b);
        dead = true;
      } else {
        die('shot');
        return;
      }
    }
    b.prevR = r;
    if (dead) { b.mesh.visible = false; bulletPool.push(b.mesh); bullets.splice(i, 1); continue; }
    worldOf(b.st, b.s, b.x, b.y, b.mesh.position);
    b.mesh.rotation.set(0, yawOf(b.st.dir), 0);
  }
}

// ============================================================ missiles
function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.t += dt;
    m.prevS = m.s;
    m.vs = Math.min(m.vs + 170 * dt, game.speed + 110);
    m.s += m.vs * dt;
    const tg = m.target && !m.target.smashed ? m.target : null;
    if (m.t < 0.15) {
      m.y -= 3 * dt; // drop clear of the rail before the motor bites
    } else if (tg) {
      m.x += (targetX(tg) - m.x) * damp(9, dt);
      m.y += (targetY(tg) - m.y) * damp(9, dt);
    }
    let dead = m.t > 1.8 || m.s > m.st.L + HALF + 2 || m.st.dead;
    const bo = game.boss;
    if (!dead && bo && !bo.dying && bo.st === m.st && m.s >= bo.s - 3 && Math.abs(m.x - bo.x) < 3 && Math.abs(m.y - (bo.liftY ?? bo.y)) < 2.6) {
      hitBoss();
      dead = true;
    }
    if (!dead) {
      for (const e of enemies) {
        if (e.smashed || e.st !== m.st) continue;
        if (m.s >= e.s - 1.6 && m.prevS <= e.s + 2 && Math.abs(m.x - e.x) < 1.8 && Math.abs(m.y - e.y) < 1.4) {
          killEnemy(e, true);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ob of m.st.obstacles) {
        if (ob.smashed || ob.type !== 'rock') continue;
        if (m.s >= ob.s - 1.4 && m.prevS <= ob.s + 1.4 && Math.abs(m.x - ob.lane * LANE_W) < 1.2 && Math.abs(m.y - CRUISE) < 1.3) {
          smash(ob, m.st, true);
          dead = true;
          break;
        }
      }
      if (!dead && m.target && m.target.smashed && Math.abs(m.s - m.target.s) < 2) dead = true;
    }
    _v2.copy(m.mesh.position);
    worldOf(m.st, m.s, m.x, m.y, m.mesh.position);
    if (dead) {
      if (m.target) m.target.targeted = false;
      puff(m.mesh.position, 3, 0.8);
      m.mesh.visible = false;
      missilePool.push(m.mesh);
      missiles.splice(i, 1);
      continue;
    }
    if (m.t > 0.02) m.mesh.lookAt(_v2); // +z points back along the flight path, so the nose leads
    m.smokeT -= dt;
    if (m.smokeT <= 0 && m.t > 0.1) { m.smokeT = 0.018; puff(m.mesh.position, 1, 0.55, 0.7); }
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

// ============================================================ dying
function pilotY() { return game.ej && game.ej.separated ? ej.pilot.position.y : ej.seatG.position.y; }

function updateDying(dt) {
  game.deathT += dt;
  const t = game.deathT;
  const k = game.deathKind;
  if (k === 'eject') {
    const e = game.ej;
    if (!e.separated) {
      // seat and pilot rocket up together
      e.vy -= 20 * dt;
      ej.seatG.position.y += e.vy * dt;
      if (Math.random() < 0.8) puff(ej.seatG.position, 1, 0.5, 0.6, 0xd0d0d0);
      if (t > 0.65) {
        // seat drops away, the pilot hangs under the opening chute
        e.separated = true;
        scene.attach(ej.pilot);
        ej.pilot.rotation.set(0, player.yaw, 0);
        ej.flame.visible = false;
        ej.chute.visible = true;
        e.pvy = e.vy; e.svy = e.vy;
        ej.legL.rotation.set(0.1, 0, 0.05);
        ej.legR.rotation.set(-0.05, 0, -0.05);
        ej.armL.rotation.set(0, 0, -2.75);
        ej.armR.rotation.set(0, 0, 2.75);
        sfx('chute');
      }
    } else {
      ej.chute.scale.setScalar(Math.min(1, (t - 0.65) * 3.5));
      e.pvy = lerp(e.pvy, -1.3, damp(3, dt));
      ej.pilot.position.y += e.pvy * dt;
      ej.pilot.rotation.z = Math.sin(t * 2) * 0.1;
      ej.legL.rotation.x = 0.1 + Math.sin(t * 3) * 0.15;
      ej.legR.rotation.x = -0.05 - Math.sin(t * 3) * 0.15;
      e.svy -= 22 * dt;
      ej.seatG.position.y += e.svy * dt;
      ej.seatG.rotation.x += dt * 4;
      ej.seatG.rotation.z += dt * 2;
    }
    e.cvy -= 20 * dt;
    looseCanopy.position.y += e.cvy * dt;
    looseCanopy.rotation.x += dt * 6;
    // the empty jet flies on, noses over and blows up
    e.jetAhead += game.speed * dt * Math.max(0.3, 1 - t * 0.3);
    if (t > 0.8) { e.pitch = Math.min(0.9, e.pitch + dt * 0.8); e.jetAlt -= (t - 0.8) * 14 * dt; }
    if (jet.root.visible && t > 0.8 && Math.random() < dt * 20) puff(jet.root.position, 1, 0.7, 0.9, 0x707070);
    if (t > 2.2 && jet.root.visible) { jet.root.visible = false; burst(jet.root.position, 0xffa040, 36); puff(jet.root.position, 8, 2); sfx('boom'); }
    game.chaseGap = lerp(game.chaseGap, 30, damp(1, dt));
    if (t > 3.9 && game.state === 'dying') gameOver();
    return;
  }
  if (t < 1.2) {
    player.s += game.speed * dt * Math.max(0, 0.6 - t);
    player.alt -= dt * (2 + t * 6);
  }
  game.chaseGap = lerp(game.chaseGap, 2.6, damp(k === 'caught' ? 6 : 2.5, dt));
  updatePlayerWorld();
  if (jet.root.visible && Math.random() < dt * 14) puff(player.pos, 1, 0.8, 1.0, 0x555555);
  if (t > 1.0 && jet.root.visible) { jet.root.visible = false; burst(player.pos, 0xffc060, 30); puff(player.pos, 8, 2); sfx('boom'); }
  if (t > 2.1 && game.state === 'dying') gameOver();
}

function chaserPosition(out) {
  const tr = game.trail;
  const d = game.dist - game.chaseGap;
  let i = tr.length - 1;
  while (i > 0 && tr[i - 1].d > d) i--;
  const a = tr[Math.max(0, i - 1)];
  const b = tr[i];
  const t = b.d === a.d ? 1 : clamp((d - a.d) / (b.d - a.d), 0, 1);
  const rise = 2.6 * clamp((9 - game.chaseGap) / 5, 0, 1);
  out.set(lerp(a.x, b.x, t), Math.min(lerp(a.y, b.y, t), CRUISE + 2) + 0.5 + rise, lerp(a.z, b.z, t));
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
  player.yaw = lerpAngle(player.yaw, targetYaw, damp(7, dt));
  if (game.state === 'dying' || game.state === 'over') {
    if (game.deathKind === 'eject' && game.ej) {
      worldOf(player.st, player.s + game.ej.jetAhead, player.x, game.ej.jetAlt, jet.root.position);
      jet.air.rotation.x = -game.ej.pitch;
      jet.air.rotation.z = lerp(jet.air.rotation.z, 0.3, k);
      return;
    }
    jet.air.rotation.z += dt * 9;
    jet.air.rotation.x = lerp(jet.air.rotation.x, -0.6, k);
    jet.root.position.copy(player.pos);
    return;
  }
  let pitch = 0;
  let roll = 0;
  if (game.state === 'menu' || game.state === 'loading' || game.state === 'levelDone') {
    roll = Math.sin(game.time * 1.2) * 0.12;
    pitch = Math.sin(game.time * 0.9) * 0.05;
    jet.root.position.y = CRUISE + Math.sin(game.time * 1.7) * 0.12;
  } else {
    const dx = player.lane * LANE_W - player.x;
    // bank into lane changes, and bank hard into corner turns with a little back-pressure, like a real fighter
    roll = clamp(-dx * 0.45, -0.9, 0.9) + clamp(yawErr * 1.7, -1.3, 1.3);
    pitch = player.air ? clamp(player.vy * 0.045, -0.5, 0.45) : 0;
    pitch += Math.min(0.22, Math.abs(yawErr) * 0.3);
    if (player.slideT > 0 && player.alt > DIVE_ALT + 0.15) pitch = -0.3;
    jet.root.position.y = player.pos.y + (player.looping ? 0 : Math.sin(game.time * 3.1) * 0.04);
  }
  jet.baseRoll = lerp(jet.baseRoll, roll, k);
  jet.basePitch = lerp(jet.basePitch, pitch, k);
  let extraRoll = 0;
  if (player.rollT > 0) extraRoll = -player.rollDir * 2 * Math.PI * ease(1 - player.rollT / ROLL_TIME);
  let loopPitch = 0;
  let loopAhead = 0;
  if (player.looping) {
    const th = 2 * Math.PI * Math.min(1, player.loopT / LOOP_TIME);
    loopPitch = th;
    loopAhead = Math.sin(th) * LOOP_R * 0.7;
  }
  jet.air.rotation.z = jet.baseRoll + extraRoll;
  jet.air.rotation.x = jet.basePitch + loopPitch;
  worldOf(player.st, player.s + loopAhead, player.x, jet.root.position.y, jet.root.position);
  jet.root.rotation.y = player.yaw;
  const boost = game.state === 'playing' ? 0.9 + (game.speed - BASE_SPEED) / 40 + (player.looping ? 0.4 : 0) : 0.6;
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
  updateLightning(dt);
  _q.setFromEuler(_euler.set(0, t * 2.5, 0));
  const blink = Math.sin(t * 5) > 0;
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
    for (let i = 0; i < st.beacons.length; i++) st.beacons[i].visible = Math.sin(t * 3 - i * 0.5) > -0.2;
    for (const l of st.mineLights) l.visible = blink;
    for (const d of st.drops) d.position.y = lerp(d.position.y, CRUISE, damp(5, dt));
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
  const ejecting = ended && game.deathKind === 'eject';
  game.camPull = lerp(game.camPull, ended ? 1 : 0, damp(ended ? 2 : 20, dt));
  const back = (portrait ? 8.8 : 7.6) + game.camPull * (ejecting ? 8 : 6);
  const up = (portrait ? 4.5 : 3.9) + game.camPull * 4;
  worldOf(player.st, player.s, player.x * 0.5, 0, _v);
  // follow the loop only part of the way, so the jet visibly climbs through the frame
  const altFollow = ended ? CRUISE : CRUISE + (player.alt - CRUISE) * (player.looping ? 0.35 : 1);
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
  let lookY = CRUISE - 0.4 + (altFollow - CRUISE) * 0.6;
  if (ejecting) lookY = Math.max(lookY, pilotY() * 0.8);
  _v2.set(_v.x + fx * 12, lookY, _v.z + fz * 12);
  camera.lookAt(_v2);
  if (game.state === 'playing') camera.rotateZ(jet.baseRoll * 0.12);
  const fovTarget = (portrait ? 78 : 64) + (game.state === 'playing' ? (game.speed - BASE_SPEED) * 0.4 : 0);
  camera.fov = lerp(camera.fov, fovTarget, damp(2, dt));
  camera.updateProjectionMatrix();

  skyGroup.position.copy(camera.position);
  cloudSea.position.x = camera.position.x;
  cloudSea.position.z = camera.position.z;
  if (water.visible) updateWater();
  sun.position.set(player.pos.x + 14, 32, player.pos.z + 10);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
}

// ============================================================ audio (WebAudio synth, no files)
let actx = null, master = null, musicBus = null, guitarBus = null, leadBus = null, noiseBuf = null;
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
  musicBus.gain.value = 0.42;
  musicBus.connect(master);
  // power-chord synth through a soft distortion
  guitarBus = actx.createGain();
  guitarBus.gain.value = 0.5;
  const drive = actx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 4); }
  drive.curve = curve;
  const tame = actx.createBiquadFilter();
  tame.type = 'lowpass'; tame.frequency.value = 2600;
  guitarBus.connect(drive).connect(tame).connect(musicBus);
  // lead synth with a dotted-eighth echo
  leadBus = actx.createGain();
  leadBus.gain.value = 0.55;
  const echo = actx.createDelay(1);
  echo.delayTime.value = (60 / MUSIC_BPM) * 0.75;
  const fb = actx.createGain();
  fb.gain.value = 0.32;
  leadBus.connect(musicBus);
  leadBus.connect(echo);
  echo.connect(fb).connect(echo);
  echo.connect(musicBus);
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
    case 'roll': noise(t, 0.5, 0.25, 1600, 0.6); tone(t, 300, 0.45, 'triangle', 0.08, 900); break;
    case 'loop': tone(t, 160, 1.2, 'sawtooth', 0.08, 420, master, 1200); noise(t, 1.2, 0.18, 700, 0.5); break;
    case 'turn': noise(t, 0.3, 0.18, 800, 0.7); tone(t, 330, 0.2, 'triangle', 0.08, 660); break;
    case 'missile': tone(t, 90, 0.12, 'square', 0.2, 50); noise(t, 0.9, 0.35, 1400, 0.5, 'bandpass'); noise(t + 0.08, 0.7, 0.2, 3500, 0.8, 'highpass'); break;
    case 'gun': for (let i = 0; i < 3; i++) noise(t + i * 0.04, 0.05, 0.15, 1800, 1.2); break;
    case 'ping': tone(t, 2400, 0.08, 'square', 0.06, 3200); break;
    case 'warn': [0, 0.18].forEach((d) => tone(t + d, 880, 0.12, 'square', 0.07)); break;
    case 'click': tone(t, 900, 0.04, 'square', 0.05); break;
    case 'wingman': noise(t, 0.7, 0.3, 1200, 0.5); for (let i = 0; i < 5; i++) noise(t + 0.05 + i * 0.035, 0.04, 0.2, 2200, 1.2); tone(t, 520, 0.6, 'sawtooth', 0.05, 260, master, 1400); break;
    case 'hit': tone(t, 300, 0.12, 'square', 0.15, 120); noise(t, 0.15, 0.3, 900, 0.8); break;
    case 'flares': for (let i = 0; i < 7; i++) { noise(t + i * 0.07, 0.12, 0.35, 2600, 1.2); tone(t + i * 0.07, 900, 0.08, 'square', 0.04, 300); } noise(t, 1.4, 0.18, 4200, 0.4, 'highpass'); break;
    case 'heard': tone(t, 1320, 0.07, 'sine', 0.08); tone(t + 0.07, 1760, 0.09, 'sine', 0.08); break;
    case 'thunder': noise(t, 2.2, 0.5, 120, 0.4, 'lowpass'); noise(t + 0.05, 0.5, 0.35, 400, 0.6, 'lowpass'); break;
    case 'drop': tone(t, 700, 0.35, 'sine', 0.08, 250); break;
    case 'victory': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(t + i * 0.12, f, 0.3, 'triangle', 0.15)); break;
    case 'chute': noise(t, 0.4, 0.3, 500, 0.4, 'lowpass'); break;
    case 'stumble': tone(t, 160, 0.3, 'sawtooth', 0.15, 60, master, 900); noise(t, 0.25, 0.3, 500, 0.8); break;
    case 'boom': noise(t, 0.7, 0.6, 300, 0.5, 'lowpass'); tone(t, 120, 0.5, 'sine', 0.5, 35); break;
    case 'power': [523, 784, 1046, 1568].forEach((f, i) => tone(t + i * 0.06, f, 0.18, 'triangle', 0.14)); break;
    case 'buy': [659, 880, 1318].forEach((f, i) => tone(t + i * 0.07, f, 0.2, 'triangle', 0.15)); break;
    case 'death': noise(t, 1.2, 0.6, 400, 0.4, 'lowpass'); tone(t, 200, 1.0, 'sawtooth', 0.18, 40, master, 800); break;
    case 'eject': tone(t, 180, 0.15, 'square', 0.3, 60); noise(t, 0.12, 0.6, 2000, 0.5, 'highpass'); noise(t + 0.05, 1.0, 0.4, 900, 0.6, 'bandpass'); [880, 740, 590].forEach((f, i) => tone(t + 0.5 + i * 0.18, f, 0.25, 'triangle', 0.12)); break;
    default: break;
  }
}

// ---------- music: an original 80s rock-synth jet anthem, composed for this game ----------
const MUSIC_BPM = 132; // boss anthem tempo
const CRUISE_BPM = 120;
let musicTrack = 'cruise';
let wantTrack = 'cruise';
function setMusicTrack(name) { wantTrack = name; }
// normal flying: a driving synthwave groove (original)
const CRUISE_CHORDS = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8], [82.4, 98, 123.5]];
function cruiseStepAt(step, t) {
  const ch = CRUISE_CHORDS[musicBar % 4];
  if (step % 4 === 0) tone(t, 140, 0.25, 'sine', 0.8, 45, musicBus);
  if (step === 4 || step === 12) noise(t, 0.18, 0.35, 1800, 0.7, 'bandpass', musicBus);
  if (step % 2 === 1) noise(t, 0.04, 0.08, 8000, 0.8, 'highpass', musicBus);
  tone(t, (ch[0] / 2) * (step % 2 ? 2 : 1), 0.12, 'sawtooth', 0.12, 0, musicBus, 600);
  tone(t, ch[step % 3] * (step % 8 < 4 ? 4 : 2), 0.1, 'square', 0.035, 0, musicBus, 3200);
  if (step === 0 && musicBar % 2 === 0) tone(t, ch[0] * 2, STEP_CRUISE * 14, 'triangle', 0.05, 0, musicBus, 1800); // soft pad swell
}
const STEP_CRUISE = 60 / CRUISE_BPM / 4;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// one chord per bar (MIDI root): Em C G D Em C D B
const BAR_ROOTS = [40, 36, 43, 38, 40, 36, 38, 35];
// lead melody for bars 9-16 of the 16-bar loop: [16th step, MIDI note, length in 16ths]
const LEAD = [
  [[0, 76, 4], [4, 79, 2], [6, 83, 6], [12, 81, 4]],
  [[0, 79, 6], [6, 76, 2], [8, 84, 8]],
  [[0, 83, 4], [4, 86, 4], [8, 83, 2], [10, 79, 6]],
  [[0, 81, 8], [8, 78, 4], [12, 81, 4]],
  [[0, 88, 6], [6, 86, 2], [8, 83, 8]],
  [[0, 84, 4], [4, 83, 4], [8, 79, 4], [12, 76, 4]],
  [[0, 78, 4], [4, 81, 4], [8, 86, 8]],
  [[0, 87, 8], [8, 83, 8]],
];
const STEP = 60 / MUSIC_BPM / 4;
function crash(t) { noise(t, 1.4, 0.4, 6000, 0.5, 'highpass', musicBus); tone(t, 110, 0.6, 'sawtooth', 0.12, 55, musicBus, 900); }

function powerChord(t, root, dur, vol) {
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(guitarBus);
  for (const [iv, det] of [[0, -6], [0, 6], [7, 0], [12, -4]]) {
    const o = actx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(root + 12 + iv);
    o.detune.value = det;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

function leadNote(t, midi, dur) {
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.03);
  g.gain.setValueAtTime(0.11, t + Math.max(0.04, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  const f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 3800;
  f.connect(g).connect(leadBus);
  const vib = actx.createOscillator();
  const vibAmt = actx.createGain();
  vib.frequency.value = 5.5;
  vibAmt.gain.setValueAtTime(0, t);
  vibAmt.gain.linearRampToValueAtTime(9, t + Math.min(0.35, dur));
  vib.connect(vibAmt);
  for (const [type, det] of [['sawtooth', -7], ['sawtooth', 7], ['square', 0]]) {
    const o = actx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(midi);
    o.detune.value = det;
    vibAmt.connect(o.detune);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.15);
  }
  vib.start(t);
  vib.stop(t + dur + 0.15);
}

function musicStepAt(step, t) {
  if (musicTrack === 'cruise') { cruiseStepAt(step, t); return; }
  bossStepAt(step, t);
}
// boss fights: the anthem. Bars 0-3 riff, 4-11 lead melody, 12-15 riff again.
function bossStepAt(step, t) {
  const bar = musicBar % 16;
  const root = BAR_ROOTS[bar % 8];
  const intro = false;
  if (!intro) {
    if (step === 0 || step === 6 || step === 8 || step === 10 || (bar % 4 === 3 && step === 14)) tone(t, 150, 0.28, 'sine', 0.85, 45, musicBus);
    if (step === 4 || step === 12) {
      noise(t, 0.22, 0.55, 1900, 0.6, 'bandpass', musicBus);
      tone(t, 200, 0.12, 'triangle', 0.25, 130, musicBus);
    }
    // drum fill into every 8th bar
    if (bar % 8 === 7 && step >= 12) noise(t, 0.09, 0.35, 900 + step * 120, 0.8, 'bandpass', musicBus);
  }
  noise(t, 0.03, step % 2 ? 0.04 : 0.08, 8500, 0.8, 'highpass', musicBus); // 16th hats drive the fight
  // pulsing 8th-note bass with an octave pop
  if (step % 2 === 0 && !intro) tone(t, mtof(root - 12 + (step % 8 === 6 ? 12 : 0)), 0.2, 'sawtooth', 0.16, 0, musicBus, 520);
  // power chords: a long hit on the downbeat, palm-muted chugs after
  if (step === 0) powerChord(t, root, STEP * 5, 0.32);
  else if (step % 2 === 0) powerChord(t, root, STEP * 1.2, 0.13);
  if (bar >= 4 && bar < 12) for (const [st, midi, len] of LEAD[bar - 4]) if (st === step) leadNote(t, midi, len * STEP);
}
function startMusic() {
  if (!actx || musicTimer || !guitarBus) return;
  musicNext = actx.currentTime + 0.05;
  musicStep = 0;
  musicBar = 0;
  musicTrack = wantTrack;
  musicTimer = setInterval(() => {
    while (musicNext < actx.currentTime + 0.15) {
      // switch tracks on a bar line; the boss anthem comes in with a crash
      if (musicStep === 0 && wantTrack !== musicTrack) {
        musicTrack = wantTrack;
        musicBar = 0;
        if (musicTrack === 'boss') crash(musicNext);
      }
      musicStepAt(musicStep, musicNext);
      musicNext += musicTrack === 'boss' ? STEP : STEP_CRUISE;
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
  hud: $('hud'), score: $('score'), dist: $('dist'), mult: $('mult'), coins: $('coins'), powers: $('powers'),
  toast: $('toast'), turnHint: $('turnHint'), mslL: $('mslL'), mslR: $('mslR'), loopIco: $('loopIco'),
  menu: $('menu'), pause: $('pause'), over: $('over'), loading: $('loading'), board: $('board'), hangar: $('hangar'),
  muteBtn: $('muteBtn'), bestMenu: $('bestMenu'), bankMenu: $('bankMenu'),
  finalScore: $('finalScore'), finalDist: $('finalDist'), finalCoins: $('finalCoins'),
  newBest: $('newBest'), deathMsg: $('deathMsg'), overTitle: $('overTitle'),
  nameRow: $('nameRow'), nameInput: $('nameInput'), boardList: $('boardList'),
  skinList: $('skinList'), hangarBank: $('hangarBank'),
  wmIcons: $('wmIcons'), levelBar: $('levelBar'), levelLbl: $('levelLbl'), levelFill: $('levelFill'),
  bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'),
  campaign: $('campaign'), levelList: $('levelList'), levelDone: $('levelDone'),
  ldKicker: $('ldKicker'), ldTitle: $('ldTitle'), ldScore: $('ldScore'), ldRings: $('ldRings'), ldKills: $('ldKills'), ldNext: $('ldNext'),
  againBtn: $('againBtn'), overBoardBtn: $('overBoardBtn'),
  flareBtn: $('flareBtn'), flareSub: $('flareSub'), flareFill: $('flareFill'),
  micBadge: $('micBadge'), micLabel: $('micLabel'), micLevelBar: document.querySelector('#micLevel i'),
  voiceBtn: $('voiceBtn'), voiceInfo: $('voiceInfo'),
};
const PLANE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l1.6 6.2 7.9 5.3v2.2l-7.6-2.6-.6 5.4 2.9 2v1.8L12 21l-4.2.8V20l2.9-2-.6-5.4-7.6 2.6V13l7.9-5.3z"/></svg>';
function renderWingmen() {
  ui.wmIcons.innerHTML = '';
  for (let i = 0; i < WINGMEN; i++) {
    const sp = document.createElement('span');
    sp.className = 'wm' + (i < game.wingmen ? '' : ' lost');
    sp.innerHTML = PLANE_SVG;
    ui.wmIcons.appendChild(sp);
  }
}
function hideScreens() {
  for (const el of [ui.menu, ui.over, ui.pause, ui.board, ui.hangar, ui.campaign, ui.levelDone]) show(el, false);
}
const show = (el, v) => el.classList.toggle('hidden', !v);
const fmt = (n) => Math.floor(n).toLocaleString('en-US');

let turnHintText = '';
function updateTurnHint() {
  const st = player.st;
  let text = '';
  if (!player.pendingTurn && inTurnWindow()) {
    text = st.corner === 'T' ? '◀ Turn ▶' : st.corner === 'L' ? '◀ Turn' : 'Turn ▶';
  }
  if (text !== turnHintText) {
    turnHintText = text;
    if (text) ui.turnHint.textContent = text;
    ui.turnHint.classList.toggle('show', !!text);
  }
}
function hideTurnHint() { turnHintText = ''; ui.turnHint.classList.remove('show'); }

const hud = {
  last: {},
  toastTimer: 0,
  powerEls: {},
  reset() { this.last = {}; ui.powers.innerHTML = ''; this.powerEls = {}; hideTurnHint(); renderWingmen(); show(ui.levelBar, false); show(ui.bossBar, false); },
  set(key, el, val) { if (this.last[key] !== val) { this.last[key] = val; el.textContent = val; } },
  update() {
    this.set('score', ui.score, fmt(game.score));
    this.set('dist', ui.dist, Math.floor(game.dist));
    this.set('mult', ui.mult, 'x' + game.mult);
    this.set('coins', ui.coins, game.coins);
    ui.mslL.classList.toggle('empty', !jet.msl[0].visible);
    ui.mslR.classList.toggle('empty', !jet.msl[1].visible);
    ui.loopIco.classList.toggle('empty', player.looping || game.loopCd > 0);
    if (this.last.wm !== game.wingmen) { this.last.wm = game.wingmen; renderWingmen(); }
    const cd = game.flareCd > 0;
    ui.flareBtn.classList.toggle('cooldown', cd && game.flareT <= 0);
    ui.flareBtn.classList.toggle('active', game.flareT > 0);
    ui.flareFill.style.width = cd ? `${(1 - game.flareCd / FLARE_COOLDOWN) * 100}%` : '100%';
    this.set('flsub', ui.flareSub, game.flareT > 0 ? 'Decoying!' : cd ? `Ready in ${Math.ceil(game.flareCd)}s` : voice.on ? 'Say "flares" · Q' : 'Q · tap');
    updateMicMeter();
    const camp = game.mode === 'campaign';
    const b = game.boss;
    show(ui.levelBar, camp && !b);
    show(ui.bossBar, !!b);
    if (camp && !b) {
      const lv = LEVELS[game.level - 1];
      const pct = Math.min(100, lv.bossDist ? (game.dist / lv.bossDist) * 100 : ((game.score - game.levelStartScore) / lv.target) * 100);
      ui.levelFill.style.width = `${pct}%`;
      this.set('lvl', ui.levelLbl, game.bossDone ? `Level ${lv.n} · ${lv.name} · clear!` : `Level ${lv.n} · ${lv.name} · boss at ${Math.floor(pct)}%`);
    }
    if (b) ui.bossFill.style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
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

// ---------- voice commands: say "flares" into the laptop microphone ----------
// Speech recognition (Chrome, Edge, Safari) listens through the default microphone, which on a
// laptop is the built-in one. We also open that microphone ourselves to show its name and a
// live level meter, so players can see which mic is listening.
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const FLARE_WORDS = /\b(flares?|flairs?|flayers?|fl[ae]re?s?|deploy)\b/;
const voice = { on: false, rec: null, stream: null, analyser: null, data: null, label: 'Microphone', lastHit: 0 };

function voiceHeard(text) {
  const t = (text || '').toLowerCase();
  if (!FLARE_WORDS.test(t)) return false;
  const now = performance.now();
  if (now - voice.lastHit < 1200) return false; // one utterance arrives as several partial results
  voice.lastHit = now;
  ui.micBadge.classList.add('heard');
  setTimeout(() => ui.micBadge.classList.remove('heard'), 400);
  sfx('heard');
  return deployFlares('voice');
}

async function startVoice() {
  if (!SpeechRec) {
    ui.voiceInfo.textContent = 'Voice commands need Chrome, Edge or Safari. You can still press Q or tap the Flares button.';
    return;
  }
  initAudio();
  try {
    // ask for the laptop microphone (the default input) and keep it open for the level meter
    voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const track = voice.stream.getAudioTracks()[0];
    voice.label = (track && track.label) || 'Microphone';
    if (actx && actx.createMediaStreamSource) {
      voice.analyser = actx.createAnalyser();
      voice.analyser.fftSize = 512;
      voice.data = new Uint8Array(voice.analyser.fftSize);
      actx.createMediaStreamSource(voice.stream).connect(voice.analyser);
    }
  } catch (err) {
    ui.voiceInfo.textContent = 'The microphone was blocked. Allow microphone access for this page in the browser, then try again.';
    return;
  }
  const rec = new SpeechRec();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true; // react as soon as the word is heard, not at the end of the sentence
  rec.maxAlternatives = 3;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      for (let k = 0; k < e.results[i].length; k++) if (voiceHeard(e.results[i][k].transcript)) return;
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      ui.voiceInfo.textContent = 'Speech recognition was blocked by the browser. Press Q or tap Flares instead.';
      stopVoice();
    }
  };
  rec.onend = () => { if (voice.on) { try { rec.start(); } catch { /* already restarting */ } } }; // keep listening
  voice.rec = rec;
  voice.on = true;
  try { rec.start(); } catch { /* started already */ }
  store.set('wowf.voice', true);
  updateVoiceUi();
}

function stopVoice() {
  voice.on = false;
  if (voice.rec) { try { voice.rec.stop(); } catch { /* not running */ } voice.rec = null; }
  if (voice.stream) { voice.stream.getTracks().forEach((t) => t.stop()); voice.stream = null; }
  voice.analyser = null;
  store.set('wowf.voice', false);
  updateVoiceUi();
}

function updateVoiceUi() {
  ui.voiceBtn.textContent = voice.on ? '🎤 Voice commands: on' : '🎤 Voice commands: off';
  ui.voiceBtn.classList.toggle('on', voice.on);
  if (voice.on) ui.voiceInfo.textContent = `Listening on: ${voice.label}. Say "Flares!" during a run.`;
  ui.micLabel.textContent = voice.label.replace(/\s*\(.*\)\s*$/, '');
  show(ui.micBadge, voice.on);
}

function updateMicMeter() {
  if (!voice.on || !voice.analyser) return;
  voice.analyser.getByteTimeDomainData(voice.data);
  let peak = 0;
  for (let i = 0; i < voice.data.length; i++) peak = Math.max(peak, Math.abs(voice.data[i] - 128));
  ui.micLevelBar.style.width = `${Math.min(100, (peak / 64) * 100)}%`;
}

// ---------- leaderboard (local storage) ----------
let lastEntryId = null;
let pendingEntry = null;
function loadBoard() { const b = store.get(LB_KEY, []); return Array.isArray(b) ? b : []; }
function qualifies(score) {
  if (score <= 0) return false;
  const b = loadBoard();
  return b.length < 10 || score > b[b.length - 1].score;
}
function saveEntry(name) {
  if (!pendingEntry) return 0;
  const clean = (name || '').trim().slice(0, 12) || 'Pilot';
  store.set('wowf.lastName', clean);
  const entry = { ...pendingEntry, name: clean };
  pendingEntry = null;
  const b = loadBoard();
  b.push(entry);
  b.sort((a, c) => c.score - a.score);
  const top = b.slice(0, 10);
  store.set(LB_KEY, top);
  lastEntryId = entry.id;
  show(ui.nameRow, false);
  return top.findIndex((e) => e.id === entry.id) + 1;
}
function renderBoard() {
  const b = loadBoard();
  ui.boardList.innerHTML = '';
  if (!b.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No flights logged yet. Take off!';
    ui.boardList.appendChild(li);
    return;
  }
  for (const e of b) {
    const li = document.createElement('li');
    if (e.id === lastEntryId) li.classList.add('me');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.name;
    const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = fmt(e.score);
    const ds = document.createElement('span'); ds.className = 'ds'; ds.textContent = `${fmt(e.dist)} m`;
    li.append(nm, sc, ds);
    ui.boardList.appendChild(li);
  }
}
let boardReturn = 'menu';
function openBoard(from) {
  boardReturn = from;
  if (from === 'over') commitPending();
  renderBoard();
  show(ui.menu, false); show(ui.over, false); show(ui.board, true);
}
function closeBoard() {
  show(ui.board, false);
  show(boardReturn === 'over' ? ui.over : ui.menu, true);
}
function commitPending() {
  if (!pendingEntry) return;
  const rank = saveEntry(ui.nameInput.value);
  if (rank) ui.newBest.innerHTML = `Saved to the leaderboard at <b>#${rank}</b>`;
}

// ---------- hangar (skins) ----------
function renderHangar() {
  ui.hangarBank.textContent = fmt(game.bank);
  ui.skinList.innerHTML = '';
  for (const sk of SKINS) {
    const owned = ownedSkins.includes(sk.id);
    const card = document.createElement('div');
    card.className = 'skin' + (currentSkin === sk.id ? ' equipped' : '');
    const sw = document.createElement('div');
    sw.className = 'swatch';
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    sw.style.background = `linear-gradient(135deg, ${hex(sk.c[0])} 0 45%, ${hex(sk.c[2])} 45% 72%, ${hex(sk.c[3])} 72%)`;
    const nm = document.createElement('div');
    nm.className = 'skin-name';
    nm.textContent = sk.name;
    const btn = document.createElement('button');
    btn.className = 'mid-btn';
    if (currentSkin === sk.id) { btn.textContent = 'Equipped'; btn.classList.add('on'); btn.disabled = true; }
    else if (owned) { btn.textContent = 'Equip'; }
    else { btn.textContent = `Buy · ${sk.price}`; btn.disabled = game.bank < sk.price; }
    btn.addEventListener('click', () => {
      if (!ownedSkins.includes(sk.id)) {
        if (game.bank < sk.price) return;
        game.bank -= sk.price;
        store.set('starlane.bank', game.bank);
        ownedSkins = [...ownedSkins, sk.id];
        store.set('wowf.skins', ownedSkins);
        sfx('buy');
      }
      applySkin(sk.id);
      store.set('wowf.skin', sk.id);
      renderHangar();
      refreshMenuStats();
    });
    card.append(sw, nm, btn);
    ui.skinList.appendChild(card);
  }
}
function openHangar() { initAudio(); renderHangar(); show(ui.menu, false); show(ui.hangar, true); }
function closeHangar() { show(ui.hangar, false); show(ui.menu, true); }

function refreshMenuStats() {
  ui.bestMenu.textContent = fmt(game.best);
  ui.bankMenu.textContent = fmt(game.bank);
}

function startRun() {
  initAudio();
  commitPending();
  if (game.state !== 'menu' || game.mode !== 'endless') newGame({ mode: 'endless' });
  game.state = 'playing';
  hideScreens();
  show(ui.hud, true);
  hud.toast('Take off!');
  sfx('power');
  startMusic();
}

function startCampaign(level, carry = 0) {
  initAudio();
  commitPending();
  newGame({ mode: 'campaign', level, score: carry });
  game.state = 'playing';
  hideScreens();
  show(ui.hud, true);
  const lv = LEVELS[level - 1];
  hud.toast(`Level ${lv.n} · ${lv.name}`);
  sfx('power');
  startMusic();
}
function restart() {
  if (game.mode === 'campaign') startCampaign(game.level, game.levelStartScore);
  else startRun();
}

function renderCampaign() {
  ui.levelList.innerHTML = '';
  for (const lv of LEVELS) {
    const t = THEMES[lv.theme];
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const locked = lv.n > campaign.unlocked;
    const card = document.createElement('div');
    card.className = 'level-card' + (locked ? ' locked' : '') + (lv.n <= campaign.cleared ? ' cleared' : '');
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = `linear-gradient(${hex(t.top)}, ${hex(t.mid)} 55%, ${hex(t.sea === 'water' ? t.seaColor : t.peak[0])})`;
    const txt = document.createElement('div');
    const tt = document.createElement('div'); tt.className = 't'; tt.textContent = `Level ${lv.n} · ${lv.name}`;
    const dd = document.createElement('div'); dd.className = 'd';
    dd.textContent = lv.bossDist ? `One long straight. Final boss: ${BOSSES[lv.boss].name.replace(/^.*· /, '')}` : `${fmt(lv.target)} points, then ${BOSSES[lv.boss].name.replace(/^.*· /, '')}`;
    txt.append(tt, dd);
    const btn = document.createElement('button');
    btn.className = 'mid-btn';
    btn.textContent = locked ? 'Locked' : 'Fly';
    btn.disabled = locked;
    btn.addEventListener('click', () => startCampaign(lv.n, 0));
    card.append(sw, txt, btn);
    ui.levelList.appendChild(card);
  }
}
function openCampaign() { initAudio(); renderCampaign(); show(ui.menu, false); show(ui.campaign, true); }
function closeCampaign() { show(ui.campaign, false); show(ui.menu, true); }

function levelComplete() {
  game.state = 'levelDone';
  stopMusic();
  hideTurnHint();
  const lv = LEVELS[game.level - 1];
  const final = lv.n === LEVELS.length;
  game.bank += game.coins;
  store.set('starlane.bank', game.bank);
  campaign.cleared = Math.max(campaign.cleared, lv.n);
  campaign.unlocked = Math.max(campaign.unlocked, Math.min(LEVELS.length, lv.n + 1));
  store.set('wowf.campaign', campaign);
  ui.ldKicker.textContent = final ? 'Campaign complete' : `Level ${lv.n} · ${lv.name} complete`;
  ui.ldTitle.textContent = final ? 'Victory!' : 'Boss down!';
  ui.ldScore.textContent = fmt(game.score);
  ui.ldRings.textContent = game.coins;
  ui.ldKills.textContent = game.kills;
  ui.ldNext.textContent = final ? 'Play again' : `Level ${lv.n + 1}: ${LEVELS[lv.n].name}`;
  show(ui.hud, false);
  show(ui.levelDone, true);
  sfx('victory');
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
  commitPending();
  stopMusic();
  newGame({ mode: 'endless' });
  game.state = 'menu';
  refreshMenuStats();
  hideScreens();
  show(ui.hud, false);
  show(ui.menu, true);
}

function gameOver() {
  game.state = 'over';
  const score = Math.floor(game.score);
  const camp = game.mode === 'campaign';
  const record = !camp && score > game.best;
  if (record) { game.best = score; store.set('starlane.best', score); }
  game.bank += game.coins;
  store.set('starlane.bank', game.bank);
  const msgs = {
    wall: 'You missed the turn and hit the barrier',
    fence: 'You flew into a laser fence',
    gate: 'You hit an overhead barrier',
    rock: 'You flew into a sky mine',
    caught: 'The hunter drone shot you down',
    shot: 'Enemy fire shot you down',
    fighter: 'You collided head-on with an enemy fighter',
    eject: 'Esc never paused the game. It pulled the ejection handle.',
  };
  ui.deathMsg.textContent = msgs[game.deathKind] || 'Mission over';
  ui.overTitle.textContent = game.deathKind === 'eject' ? 'You ejected!' : 'Shot down';
  ui.finalScore.textContent = fmt(score);
  ui.finalDist.textContent = `${Math.floor(game.dist)} m`;
  ui.finalCoins.textContent = game.coins;
  ui.newBest.classList.toggle('record', record);
  ui.newBest.innerHTML = record ? 'New best score!' : `Best: <b>${fmt(game.best)}</b>`;
  if (game.kills) ui.newBest.innerHTML += ` · Bandits downed: <b>${game.kills}</b>`;
  if (camp) ui.newBest.innerHTML = `Level ${game.level} · ${LEVELS[game.level - 1].name}` + (game.kills ? ` · Bandits downed: <b>${game.kills}</b>` : '');
  ui.againBtn.textContent = camp ? `Retry level ${game.level}` : 'Fly again';
  show(ui.overBoardBtn, !camp);
  pendingEntry = null;
  if (!camp && qualifies(score)) {
    pendingEntry = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), score, dist: Math.floor(game.dist), date: Date.now() };
    ui.nameInput.value = store.get('wowf.lastName', 'Pilot');
    show(ui.nameRow, true);
  } else {
    show(ui.nameRow, false);
  }
  show(ui.hud, false);
  show(ui.over, true);
  // the callsign box is not focused, so Space and Enter go straight to "Fly again"
}

$('playBtn').addEventListener('click', startRun);
$('againBtn').addEventListener('click', restart);
$('campaignBtn').addEventListener('click', openCampaign);
ui.flareBtn.addEventListener('click', (e) => { e.stopPropagation(); deployFlares('tap'); });
ui.flareBtn.addEventListener('touchend', (e) => { e.stopPropagation(); }, { passive: true });
ui.voiceBtn.addEventListener('click', () => { if (voice.on) stopVoice(); else startVoice(); });
if (!SpeechRec) ui.voiceInfo.textContent = 'Voice commands need Chrome, Edge or Safari. You can still press Q or tap the Flares button.';
$('campaignBack').addEventListener('click', closeCampaign);
ui.ldNext.addEventListener('click', () => {
  if (game.level >= LEVELS.length) startCampaign(1, 0);
  else startCampaign(game.level + 1, Math.floor(game.score));
});
$('ldMenu').addEventListener('click', toMenu);
$('menuBtn').addEventListener('click', toMenu);
$('resumeBtn').addEventListener('click', resumeGame);
$('quitBtn').addEventListener('click', toMenu);
$('pauseBtn').addEventListener('click', pauseGame);
$('hangarBtn').addEventListener('click', openHangar);
$('hangarBack').addEventListener('click', closeHangar);
$('boardBtn').addEventListener('click', () => openBoard('menu'));
$('overBoardBtn').addEventListener('click', () => openBoard('over'));
$('boardBack').addEventListener('click', closeBoard);
$('saveBtn').addEventListener('click', () => {
  const rank = saveEntry(ui.nameInput.value);
  if (rank) { ui.newBest.innerHTML = `Saved to the leaderboard at <b>#${rank}</b>`; sfx('power'); }
});
ui.muteBtn.addEventListener('click', () => { initAudio(); setMuted(!muted); });
setMuted(muted);

const overlayOpen = () => [ui.board, ui.hangar, ui.campaign].some((el) => !el.classList.contains('hidden'));

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (e.target === ui.nameInput) {
    if (k === 'Enter') { $('saveBtn').click(); ui.nameInput.blur(); }
    return; // typing a callsign: don't steer the jet
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (game.state === 'playing' && (k === ' ' || k === 'f' || k === 'F' || k === 'Enter')) { actFire(); return; }
  if (e.repeat) return;
  if (overlayOpen()) {
    if (k === 'Escape') {
      if (!ui.board.classList.contains('hidden')) closeBoard();
      else if (!ui.hangar.classList.contains('hidden')) closeHangar();
      else closeCampaign();
    }
    return;
  }
  if (game.state === 'levelDone') {
    if (k === 'Enter' || k === ' ') ui.ldNext.click();
    return;
  }
  if (game.state === 'menu' || game.state === 'over') {
    if (k === 'Enter' || k === ' ') { if (game.state === 'over') restart(); else startRun(); }
    return;
  }
  if (game.state === 'paused') {
    if (k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter' || k === ' ') resumeGame();
    if (k === 'm' || k === 'M') setMuted(!muted);
    return;
  }
  switch (k) {
    case 'ArrowLeft': case 'a': case 'A': actSide(-1, e.shiftKey); break;
    case 'ArrowRight': case 'd': case 'D': actSide(1, e.shiftKey); break;
    case 'ArrowUp': case 'w': case 'W': actClimb(); break;
    case 'ArrowDown': case 's': case 'S': actDive(); break;
    case 'e': case 'E': actLoop(); break;
    case 'q': case 'Q': deployFlares('key'); break;
    case 'Escape': if (game.state === 'playing') die('eject'); break; // the menu says Esc pauses. It doesn't.
    case 'p': case 'P': pauseGame(); break;
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
  if (Math.abs(dx) > Math.abs(dy)) actSide(dx < 0 ? -1 : 1, e.touches.length > 1);
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
    updateMissiles(dt);
    updateSparks(dt);
    updateSmoke(dt);
    updateFlares(dt);
    updateFlyingCoins(dt);
    animateJet(dt);
    animateDrone(dt);
    animateWingman(dt);
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
window.__game = { game, player, enemies, jet, spawnEnemy, spawnBoss, hitBoss, wing, startCampaign, startRun, actFire, actLoop, actSide, actClimb,
  // music control for recording trailers
  deployFlares, voiceHeard, bullets,
  music: {
    want: setMusicTrack,
    force(name, bar = 0) { wantTrack = name; musicTrack = name; musicBar = bar; musicStep = 0; if (actx) { musicNext = actx.currentTime + 0.02; if (name === 'boss') crash(musicNext); } },
  },
};

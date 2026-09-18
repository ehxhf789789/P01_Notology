/**
 * Brain3D — the nerve nodes THEMSELVES form the brain (W4-R · 2026-09-18).
 *
 * HanBin (6th report): *"배경으로 점이 깔리고 그 위에 신경을 배치하는 게
 * 아니라, 2D 를 구성하는 신경 노드들이 이동하면서 뇌의 형상을 만드는
 * 방식"* — so there is NO decorative point cloud here. The ~500 real nodes
 * are laid ON the parametric brain SURFACE (cortex is a surface): each
 * region owns an angular patch of the hemisphere ellipsoid, filled with an
 * R₂ low-discrepancy sequence, so the dots' own density draws the
 * silhouette and gyri. cerebellum nodes tile the cerebellum bulb,
 * substrate sits at the brainstem. Deterministic — same brain every load.
 *
 * Also per HanBin's reports:
 *  - activation CHAINS render in 3D (GL line pass + travelling pulse dots,
 *    same lit rule as the 2D overlay);
 *  - labels are projected inside the rAF loop (a 250ms interval made them
 *    stutter against the 60fps canvas — «드드드»);
 *  - the front camera distance is DERIVED from the letterbox so the flat
 *    board registers pixel-true with the SVG map during morphs; the render
 *    pose is mix(front, orbit, morph), so both morph directions are smooth.
 *
 * One living brain: BrainMap keeps the single SSE subscription and hands
 * `lit` down — toggling views never re-subscribes (v51 invariant).
 */
import { useEffect, useRef } from 'react';

type N3 = { id: string; region: string; status: string; kind: string;
            label?: string };
type Reg = { label: string; hue: number; layer?: string | null;
             core?: boolean };
type E3 = { a: string; b: string; kind: string };

/** anatomical anchors — unit directions: x right(+), y up, z front(+) */
const ANCHOR: Record<string, [number, number, number]> = {
  occipital:  [0.35, 0.10, -0.92],
  afferent:   [0.40, -0.25, -0.80],
  sensed:     [0.30, 0.65, -0.60],
  temporal:   [0.95, -0.30, 0.05],
  retrieval:  [0.85, -0.45, -0.25],
  parietal:   [0.25, 0.92, -0.15],
  front:      [0.35, 0.45, 0.85],
  self:       [0.20, 0.15, 0.98],
  verify:     [0.55, 0.70, 0.55],
  broca:      [0.90, 0.05, 0.55],
  express:    [0.75, -0.25, 0.75],
  errand:     [0.45, 0.75, 0.60],
  motor:      [0.30, 0.95, 0.25],
};
const LAYER_FALL: Record<string, [number, number, number]> = {
  '구심': [0.4, 0.1, -0.85], '연합': [0.9, 0.1, 0.1], '원심': [0.4, 0.5, 0.8],
};
/** how wide a region's cortical patch spreads with its population */
const spreadOf = (n: number) => Math.min(0.62, 0.16 + 0.052 * Math.sqrt(n));

function srand(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

const STATUS_C: Record<string, [number, number, number]> = {
  ok: [0.45, 0.85, 0.6], warn: [1, 0.8, 0.4], bad: [0.95, 0.35, 0.3],
  building: [0.65, 0.55, 1], idle: [0.5, 0.58, 0.75], dark: [0.36, 0.42, 0.55],
};
function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

// ── tiny mat4 (column-major) ──────────────────────────────────────────
const FOV = 0.9;
function persp(ar: number, n: number, f: number): Float32Array {
  const t = 1 / Math.tan(FOV / 2), d = 1 / (n - f);
  return new Float32Array([t / ar, 0, 0, 0, 0, t, 0, 0,
    0, 0, (n + f) * d, -1, 0, 0, 2 * n * f * d, 0]);
}
function mul(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}
function lookAt(yaw: number, pitch: number, dist: number): Float32Array {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const ex = dist * cp * sy, ey = dist * sp, ez = dist * cp * cy;
  const fl = Math.hypot(ex, ey, ez);
  const fx = -ex / fl, fy = -ey / fl, fz = -ez / fl;
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  return new Float32Array([
    rx, ux, -fx, 0, 0, uy, -fy, 0, rz, uz, -fz, 0,
    -(rx * ex + rz * ez), -(ux * ex + uy * ey + uz * ez),
    fx * ex + fy * ey + fz * ez, 1]);
}

/** point on the (side-mirrored) brain surface for a unit direction */
function surface(dir: [number, number, number], side: 1 | -1)
  : [number, number, number] {
  let [dx, dy, dz] = dir;
  const L = Math.hypot(dx, dy, dz) || 1;
  dx /= L; dy /= L; dz /= L;
  // gyri feel — a low-frequency radial ripple over the ellipsoid
  const u = Math.atan2(dz, dx), v = Math.acos(Math.max(-1, Math.min(1, dy)));
  const ripple = 1 + 0.05 * Math.sin(6 * u) * Math.sin(8 * v);
  const x = dx * 0.36 * ripple + 0.17;      // hemisphere offset
  return [x * side, dy * 0.50 * ripple, dz * 0.72 * ripple];
}

const VS = `
attribute vec3 aP3; attribute vec3 aP2; attribute vec3 aC;
attribute float aS; attribute float aS2; attribute vec3 aPick; attribute float aLit;
uniform mat4 uMVP; uniform float uMorph; uniform float uPick; uniform float uPx;
uniform float uPxVb;
varying vec3 vC; varying float vLit; varying vec3 vPick;
void main(){
  vec3 p = mix(aP2, aP3, uMorph);
  gl_Position = uMVP * vec4(p, 1.0);
  float d = max(gl_Position.w, 0.3);
  // W4-R (HanBin 7th): at morph=0 the dot must BE the 2D dot — aS2 is the
  // SVG diameter in viewBox units, uPxVb the device px per viewBox unit.
  float s3 = (aS + aLit * 6.0) * uPx / d;
  float s2 = aS2 * uPxVb + aLit * 6.0;
  gl_PointSize = clamp(mix(s2, s3, uMorph), 1.2, 64.0);
  vC = aC; vLit = aLit; vPick = aPick;
}`;
const FS = `
precision mediump float;
varying vec3 vC; varying float vLit; varying vec3 vPick;
uniform float uPick;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  if (r > 0.5) discard;
  if (uPick > 0.5) { gl_FragColor = vec4(vPick, 1.0); return; }
  float a = smoothstep(0.5, 0.34, r);   // crisp edge — no blur feel
  vec3 c = vC + vLit * vec3(0.55, 0.45, 0.2);
  gl_FragColor = vec4(c, a * (0.85 + vLit * 0.15));
}`;
// activation chain lines + travelling pulses — one program, uKind switches
const LVS = `
attribute vec3 aA3; attribute vec3 aA2;
uniform mat4 uMVP; uniform float uMorph; uniform float uPt;
void main(){
  vec3 p = mix(aA2, aA3, uMorph);
  gl_Position = uMVP * vec4(p, 1.0);
  gl_PointSize = uPt / max(gl_Position.w, 0.3);
}`;
const LFS = `
precision mediump float;
uniform float uKind;              // 0 = line, 1 = pulse point
void main(){
  if (uKind > 0.5) {
    vec2 q = gl_PointCoord - 0.5;
    if (length(q) > 0.5) discard;
    gl_FragColor = vec4(1.0, 0.92, 0.66, smoothstep(0.5, 0.1, length(q)));
  } else {
    gl_FragColor = vec4(0.62, 0.76, 1.0, 0.34);
  }
}`;

export function Brain3D({ nodes, chainEdges, regions, pos2d, lit, onPick,
                          boardW, boardH, morphTo = 1, onMorphDone }: {
  nodes: N3[]; chainEdges: E3[]; regions: Record<string, Reg>;
  pos2d: Record<string, { x: number; y: number }>;
  lit: string[]; onPick: (id: string | null) => void;
  boardW: number; boardH: number;
  /** W4-T — 1 = brain, 0 = flat 2D board plane; animated each frame.
   *  onMorphDone fires once when the target is reached (view handoff). */
  morphTo?: number; onMorphDone?: (() => void) | null;
}) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const buildRef = useRef(0);
  const litRef = useRef(lit); litRef.current = lit;
  const labelRef = useRef<HTMLDivElement | null>(null);
  const morphToRef = useRef(morphTo); morphToRef.current = morphTo;
  const doneRef = useRef(onMorphDone); doneRef.current = onMorphDone;

  useEffect(() => {
    const cv = cvRef.current; if (!cv || !nodes.length) return;
    buildRef.current += 1;
    cv.parentElement?.setAttribute('data-build', String(buildRef.current));
    const gl = cv.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) return;
    const mk = (vs: string, fsSrc: string) => {
      const sh = (t: number, src: string) => {
        const x = gl.createShader(t)!; gl.shaderSource(x, src); gl.compileShader(x);
        return x;
      };
      const pr = gl.createProgram()!;
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(pr);
      return pr;
    };
    const prog = mk(VS, FS);
    const lprog = mk(LVS, LFS);

    // ── geometry — the nodes ARE the brain ────────────────────────────
    const P3: number[] = [], P2: number[] = [], C: number[] = [], S: number[] = [];
    const S2: number[] = [], PK: number[] = [], LIT: number[] = [];
    const idOf: string[] = [];
    const p3Of: Record<string, [number, number, number]> = {};
    const p2Of: Record<string, [number, number, number]> = {};
    const byRegion: Record<string, N3[]> = {};
    nodes.forEach(nd => { (byRegion[nd.region] ||= []).push(nd); });
    const toPlane = (id: string, fall: [number, number, number]) => {
      const q = pos2d[id];
      return (q ? [(q.x / boardW - 0.5) * 1.5, (0.5 - q.y / boardH) * 1.5, 0]
                : fall) as [number, number, number];
    };
    Object.entries(byRegion).forEach(([rk, list]) => {
      const R = regions[rk];
      list.forEach((nd, j) => {
        let p3: [number, number, number];
        const side: 1 | -1 = srand(nd.id, 7) < 0.5 ? -1 : 1;
        // R₂ low-discrepancy fill of the region's cortical patch — the same
        // sequence trick the 2D board uses; even coverage means the dot
        // density itself draws the lobe.
        const u = ((j + 1) * 0.7548776662) % 1 - 0.5;
        const v = ((j + 1) * 0.5698402910) % 1 - 0.5;
        if (rk === 'cerebellum') {
          const a = u * Math.PI * 2;
          const b = Math.acos(Math.max(-1, Math.min(1, v * 1.9)));
          p3 = [Math.sin(b) * Math.cos(a) * 0.27 * side,
                -0.44 + Math.cos(b) * 0.17,
                -0.56 + Math.sin(b) * Math.sin(a) * 0.24];
        } else if (R?.core) {
          p3 = [u * 0.10, -0.30 - Math.abs(v) * 0.35, -0.12 + u * 0.06];
        } else {
          const A = ANCHOR[rk] || LAYER_FALL[R?.layer || ''] || [0.5, 0.1, 0.1];
          const sp = spreadOf(list.length);
          const jit = (k: number) => (srand(nd.id, k) - 0.5) * 0.12;
          // spread around the anchor along two rough tangents + a whisper
          // of per-id jitter so twins never coincide
          const dir: [number, number, number] = [
            A[0] + (-A[2] * v + A[1] * u * 0.4) * sp * 2.4 + jit(1) * sp,
            A[1] + u * sp * 2.4 + jit(2) * sp,
            A[2] + (A[0] * v - A[0] * u * 0.2) * sp * 2.4 + jit(3) * sp];
          p3 = surface(dir, side);
        }
        const p2 = toPlane(nd.id, p3);
        const base = STATUS_C[nd.status] || STATUS_C.dark;
        const tint = hsl(R?.hue ?? 210, 0.6, 0.62);
        const c: [number, number, number] = [
          base[0] * 0.5 + tint[0] * 0.5, base[1] * 0.5 + tint[1] * 0.5,
          base[2] * 0.5 + tint[2] * 0.5];
        p3Of[nd.id] = p3; p2Of[nd.id] = p2;
        P3.push(...p3); P2.push(...p2); C.push(...c);
        S.push(nd.kind === '신경' ? 3.6 : nd.kind === '기관' ? 2.9
             : nd.kind === '갈래' ? 3.0 : 2.2);
        // 2D diameters — the SVG base radii ×2 (BrainMap baseLayer)
        S2.push(2 * (nd.kind === '접힘' ? 5.5 : nd.kind === '계획' ? 3.4
              : nd.kind === '갈래' ? 2.4 : nd.kind === '걸음' ? 1.3 : 1.6));
        const pi = idOf.length + 1;
        idOf.push(nd.id);
        PK.push(((pi >> 16) & 255) / 255, ((pi >> 8) & 255) / 255, (pi & 255) / 255);
        LIT.push(0);
      });
    });
    const nTot = S.length;
    gl.useProgram(prog);
    const mkBuf = (data: number[]) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      return b;
    };
    const bufs: [string, WebGLBuffer, number][] = [
      ['aP3', mkBuf(P3), 3], ['aP2', mkBuf(P2), 3], ['aC', mkBuf(C), 3],
      ['aS', mkBuf(S), 1], ['aS2', mkBuf(S2), 1], ['aPick', mkBuf(PK), 3]];
    const litBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, litBuf);
    const litArr = new Float32Array(LIT);
    gl.bufferData(gl.ARRAY_BUFFER, litArr, gl.DYNAMIC_DRAW);
    const litIdx: Record<string, number> = {};
    idOf.forEach((id, i) => { litIdx[id] = i; });
    const nameOf: Record<string, string> = {};
    nodes.forEach(nd => { if (nd.label) nameOf[nd.id] = nd.label; });

    const U = {
      mvp: gl.getUniformLocation(prog, 'uMVP'),
      morph: gl.getUniformLocation(prog, 'uMorph'),
      pick: gl.getUniformLocation(prog, 'uPick'),
      px: gl.getUniformLocation(prog, 'uPx'),
      pxVb: gl.getUniformLocation(prog, 'uPxVb'),
    };
    const LU = {
      mvp: gl.getUniformLocation(lprog, 'uMVP'),
      morph: gl.getUniformLocation(lprog, 'uMorph'),
      kind: gl.getUniformLocation(lprog, 'uKind'),
      pt: gl.getUniformLocation(lprog, 'uPt'),
    };
    const lA3 = gl.getAttribLocation(lprog, 'aA3');
    const lA2 = gl.getAttribLocation(lprog, 'aA2');
    const lineB3 = gl.createBuffer()!, lineB2 = gl.createBuffer()!;
    const pulseB3 = gl.createBuffer()!, pulseB2 = gl.createBuffer()!;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── activation chain (R2) — rebuilt only when the lit set changes ─
    let chain: { a3: [number, number, number]; b3: [number, number, number];
                 a2: [number, number, number]; b2: [number, number, number];
                 ph: number }[] = [];
    let chainKey = '';
    const rebuildChain = () => {
      const set = new Set(litRef.current);
      const key = [...set].sort().join('|');
      if (key === chainKey) return;
      chainKey = key;
      chain = [];
      if (set.size) {
        for (const e of chainEdges) {
          if (chain.length >= 160) break;
          if (!set.has(e.a) && !set.has(e.b)) continue;
          const a3 = p3Of[e.a], b3 = p3Of[e.b];
          if (!a3 || !b3) continue;
          chain.push({ a3, b3, a2: p2Of[e.a], b2: p2Of[e.b],
                       ph: srand(e.a + e.b, 9) });
        }
      }
      const l3: number[] = [], l2: number[] = [];
      chain.forEach(cn => { l3.push(...cn.a3, ...cn.b3); l2.push(...cn.a2, ...cn.b2); });
      gl.bindBuffer(gl.ARRAY_BUFFER, lineB3);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(l3), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineB2);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(l2), gl.DYNAMIC_DRAW);
    };

    // ── camera — render pose = mix(front, orbit, morph) (R3) ──────────
    // HanBin 8th: less margin — the brain fills the frame by default
    const orbit = { yaw: 0.6, pitch: 0.26, dist: 1.85 };
    let morph = morphToRef.current >= 1 ? 0 : 1;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) morph = morphToRef.current;
    let lastTouch = 0, raf = 0, dead = false, doneFired = -1;
    let mvp: Float32Array = new Float32Array(16);
    // label pool (R5) — positioned every FRAME inside the loop; the old
    // 250ms interval stuttered against the 60fps canvas («드드드»)
    const pool: HTMLDivElement[] = [];
    const labBox = labelRef.current;
    if (labBox) {
      labBox.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const d = document.createElement('div');
        d.className = 'b3d-lab'; d.style.display = 'none';
        labBox.appendChild(d); pool.push(d);
      }
    }
    const draw = (tms: number) => {
      if (dead) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w && h && (cv.width !== w * devicePixelRatio || cv.height !== h * devicePixelRatio)) {
        cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio;
      }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0.027, 0.039, 0.07, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const tgt = morphToRef.current;
      const step = reduced ? 1 : 0.015;   // ≈1.1s — HanBin 16th: unhurried
      morph = morph < tgt ? Math.min(tgt, morph + step)
            : morph > tgt ? Math.max(tgt, morph - step) : morph;
      if (morph === tgt && doneFired !== tgt) {
        doneFired = tgt;
        if (doneRef.current) window.setTimeout(() => doneRef.current?.(), 0);
      }
      if (!reduced && morph === 1 && tms - lastTouch > 4000) orbit.yaw += 0.0016;
      // front-pose distance is DERIVED so the flat board registers with
      // the SVG letterbox: dist = 0.75·cot(fov/2)·h / min(w,h)
      const distF = 0.75 * (1 / Math.tan(FOV / 2))
        * ((h || 1) / Math.max(1, Math.min(w || 1, h || 1)));
      const sm = morph * morph * (3 - 2 * morph);          // smoothstep
      // positions ride the SAME ease — dots accelerate and settle, not glide
      // linearly (HanBin 16th «부드럽고 자연스럽게»)
      const yaw = orbit.yaw * sm, pitch = orbit.pitch * sm;
      const dist = distF + (orbit.dist - distF) * sm;
      mvp = mul(persp((w || 1) / (h || 1), 0.1, 20), lookAt(yaw, pitch, dist));

      // lit decay — same 5.2s spirit as the 2D overlay
      const cur = litRef.current;
      let dirty = false;
      for (let i = 0; i < litArr.length; i++) if (litArr[i] > 0) { litArr[i] = Math.max(0, litArr[i] - 0.012); dirty = true; }
      cur.forEach(id => {
        const i = litIdx[id]; if (i != null && litArr[i] < 1) { litArr[i] = 1; dirty = true; }
      });
      if (dirty) {
        gl.bindBuffer(gl.ARRAY_BUFFER, litBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, litArr);
      }
      rebuildChain();

      // pass 1 — activation chain beneath the dots (R2)
      if (chain.length) {
        gl.useProgram(lprog);
        gl.uniformMatrix4fv(LU.mvp, false, mvp);
        gl.uniform1f(LU.morph, sm);
        gl.uniform1f(LU.kind, 0); gl.uniform1f(LU.pt, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineB3);
        gl.enableVertexAttribArray(lA3);
        gl.vertexAttribPointer(lA3, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineB2);
        gl.enableVertexAttribArray(lA2);
        gl.vertexAttribPointer(lA2, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, chain.length * 2);
        // travelling pulses — light flows along the active edges
        const t = tms / 1000;
        const q3: number[] = [], q2: number[] = [];
        chain.slice(0, 60).forEach(cn => {
          const f = (t * 0.55 + cn.ph) % 1;
          q3.push(cn.a3[0] + (cn.b3[0] - cn.a3[0]) * f,
                  cn.a3[1] + (cn.b3[1] - cn.a3[1]) * f,
                  cn.a3[2] + (cn.b3[2] - cn.a3[2]) * f);
          q2.push(cn.a2[0] + (cn.b2[0] - cn.a2[0]) * f,
                  cn.a2[1] + (cn.b2[1] - cn.a2[1]) * f,
                  cn.a2[2] + (cn.b2[2] - cn.a2[2]) * f);
        });
        gl.uniform1f(LU.kind, 1);
        gl.uniform1f(LU.pt, 7 * (cv.height / 760));
        gl.bindBuffer(gl.ARRAY_BUFFER, pulseB3);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(q3), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(lA3, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, pulseB2);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(q2), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(lA2, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, Math.min(chain.length, 60));
      }

      // pass 2 — the nodes (the brain itself)
      gl.useProgram(prog);
      bufs.forEach(([nm, b, sz]) => {
        const l = gl.getAttribLocation(prog, nm);
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 0, 0);
      });
      const lLit = gl.getAttribLocation(prog, 'aLit');
      gl.bindBuffer(gl.ARRAY_BUFFER, litBuf);
      gl.enableVertexAttribArray(lLit);
      gl.vertexAttribPointer(lLit, 1, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(U.mvp, false, mvp);
      gl.uniform1f(U.morph, sm);
      gl.uniform1f(U.pick, 0);
      gl.uniform1f(U.px, (cv.height / 760) * 3.4);
      gl.uniform1f(U.pxVb, Math.min(cv.width, cv.height) / 760);
      gl.drawArrays(gl.POINTS, 0, nTot);

      // labels — every frame, GPU-composited transforms (R5). HanBin 10th:
      // every fired nerve says its name, and the text fades on the SAME
      // decay curve as its dot — appearing and leaving without a pop.
      if (labBox) {
        const names = litRef.current.slice(0, pool.length);
        for (let i = 0; i < pool.length; i++) {
          const d = pool[i];
          const id = names[i];
          const gi = id != null ? litIdx[id] : undefined;
          if (id == null || gi == null) { d.style.display = 'none'; continue; }
          const glow = litArr[gi];
          if (glow <= 0.03) { d.style.display = 'none'; continue; }
          const A3 = p3Of[id], A2 = p2Of[id];
          const P: [number, number, number] = [
            A2[0] + (A3[0] - A2[0]) * sm,
            A2[1] + (A3[1] - A2[1]) * sm,
            A2[2] + (A3[2] - A2[2]) * sm];
          const cx = mvp[0] * P[0] + mvp[4] * P[1] + mvp[8] * P[2] + mvp[12];
          const cyy = mvp[1] * P[0] + mvp[5] * P[1] + mvp[9] * P[2] + mvp[13];
          const cw = mvp[3] * P[0] + mvp[7] * P[1] + mvp[11] * P[2] + mvp[15];
          if (cw <= 0) { d.style.display = 'none'; continue; }
          const nm = nameOf[id]
            || (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id);
          if (d.textContent !== nm) d.textContent = nm;
          d.style.display = '';
          d.style.opacity = String(Math.min(1, glow * 1.4));
          d.style.transform = `translate3d(${((cx / cw * 0.5 + 0.5) * w).toFixed(1)}px,`
            + `${((0.5 - cyy / cw * 0.5) * h).toFixed(1)}px,0) translate(-50%,-160%)`;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // orbit input — no pointer capture (it eats clicks; jig-measured)
    let drag: { x: number; y: number } | null = null, moved = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY }; moved = false; lastTouch = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      orbit.yaw += dx * 0.006;
      orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy * 0.005));
      drag = { x: e.clientX, y: e.clientY }; lastTouch = performance.now();
    };
    const up = () => { drag = null; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.dist = Math.max(1.1, Math.min(6, orbit.dist * Math.exp(e.deltaY * 0.0012)));
      lastTouch = performance.now();
    };
    const click = (e: MouseEvent) => {
      if (moved) { moved = false; return; }
      const r = cv.getBoundingClientRect();
      const px = Math.round((e.clientX - r.left) * cv.width / r.width);
      const py = Math.round(cv.height - (e.clientY - r.top) * cv.height / r.height);
      gl.useProgram(prog);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.uniformMatrix4fv(U.mvp, false, mvp);
      gl.uniform1f(U.pick, 1);
      gl.drawArrays(gl.POINTS, 0, nTot);
      const b = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
      gl.enable(gl.BLEND);
      const pi = (b[0] << 16) | (b[1] << 8) | b[2];
      onPick(pi > 0 ? idOf[pi - 1] ?? null : null);
    };
    cv.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.addEventListener('click', click);
    return () => {
      dead = true; cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cv.removeEventListener('wheel', wheel);
      cv.removeEventListener('click', click);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, chainEdges, regions, pos2d, boardW, boardH]);

  return (
    <div className="brain3d" data-lit={lit.length}
         data-chain={lit.length ? 1 : 0}>
      <canvas ref={cvRef} className="brain3d__cv"
              aria-label="dobbin brain — the nerve nodes form the brain" />
      <div ref={labelRef} className="brain3d__labels" aria-hidden="true" />
    </div>
  );
}

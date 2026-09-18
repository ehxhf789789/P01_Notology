/**
 * Brain3D — anatomical 3D view of dobbin's brain (W4 · 2026-09-18).
 *
 * HanBin's decisions (final): anatomical two-hemisphere silhouette with a
 * gyri-like surface feel · panel opens in 3D (2D one toggle away) · idle
 * auto-rotation off under prefers-reduced-motion · dependency-free WebGL
 * (point shader + orbit camera + GPU color picking) — vendor bundle +0KB.
 *
 * One living brain: this renderer draws the SAME nodes/lit state the 2D map
 * owns. It subscribes to nothing — BrainMap keeps the single SSE
 * subscription and hands `lit` down, so toggling views never re-subscribes
 * and activation never pauses (v51 invariants).
 *
 * Region → lobe mapping is deterministic and semantic (구심 Input → back,
 * 연합 Thought → temporal/central, 원심 Output → frontal, substrate →
 * brainstem/thalamus); the same seed lays the same brain every load.
 */
import { useEffect, useRef } from 'react';

type N3 = { id: string; region: string; status: string; kind: string;
            label?: string };
type Reg = { label: string; hue: number; layer?: string | null;
             core?: boolean };

/** anatomical anchors — unit brain space: x right(+)/left(−), y up, z front(+) */
const ANCHOR: Record<string, [number, number, number]> = {
  occipital:  [0, 0.10, -0.72],       // back — perception
  afferent:   [0, -0.12, -0.60],
  sensed:     [0, 0.42, -0.42],       // parietal-ish top-back
  temporal:   [0.58, -0.18, 0.02],    // side lobes — memory
  retrieval:  [0.44, -0.26, -0.10],   // medial temporal (hippocampus)
  parietal:   [0, 0.52, -0.10],       // crown — relations
  front:      [0, 0.30, 0.62],        // frontal — judgment
  self:       [0, 0.12, 0.72],        // medial prefrontal
  verify:     [0.30, 0.42, 0.42],
  broca:      [0.52, 0.06, 0.42],     // lateral frontal — language
  express:    [0.40, -0.10, 0.55],
  errand:     [0.22, 0.44, 0.45],
  motor:      [0, 0.55, 0.18],        // precentral strip
  cerebellum: [0, -0.42, -0.55],      // little brain
  substrate:  [0, -0.28, -0.05],      // brainstem/thalamus
  '미분류':    [0, 0.0, 0.0],
};
const LAYER_FALL: Record<string, [number, number, number]> = {
  '구심': [0, 0.05, -0.6], '연합': [0.5, 0, 0.1], '원심': [0, 0.3, 0.6],
};

/** deterministic per-string rand in [0,1) — same brain every load */
function srand(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

const STATUS_C: Record<string, [number, number, number]> = {
  ok: [0.45, 0.85, 0.6], warn: [1, 0.8, 0.4], bad: [0.95, 0.35, 0.3],
  building: [0.65, 0.55, 1], idle: [0.45, 0.52, 0.68], dark: [0.3, 0.34, 0.45],
};

function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

// ── tiny mat4 (column-major, WebGL order) ─────────────────────────────
function persp(fov: number, ar: number, n: number, f: number): Float32Array {
  const t = 1 / Math.tan(fov / 2), d = 1 / (n - f);
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
  // forward = -eye/|eye| (looking at origin)
  const fl = Math.hypot(ex, ey, ez);
  const fx = -ex / fl, fy = -ey / fl, fz = -ez / fl;
  // right = f × up(0,1,0)
  let rx = -fz, ry = 0, rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; rz /= rl;
  // up = r × f
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return new Float32Array([
    rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0,
    -(rx * ex + ry * ey + rz * ez), -(ux * ex + uy * ey + uz * ez),
    fx * ex + fy * ey + fz * ez, 1]);
}

const VS = `
attribute vec3 aP3; attribute vec3 aP2; attribute vec3 aC;
attribute float aS; attribute vec3 aPick; attribute float aLit;
attribute float aKind;
uniform mat4 uMVP; uniform float uMorph; uniform float uPick; uniform float uPx;
varying vec3 vC; varying float vLit; varying vec3 vPick; varying float vFade;
void main(){
  vec3 p = mix(aP2, aP3, uMorph);
  vFade = mix(1.0, uMorph, aKind);   // shell fades out toward the flat board
  gl_Position = uMVP * vec4(p, 1.0);
  float d = max(gl_Position.w, 0.3);
  gl_PointSize = clamp((aS + aLit * 6.0) * uPx / d, 1.5, 64.0);
  vC = aC; vLit = aLit; vPick = aPick;
}`;
const FS = `
precision mediump float;
varying vec3 vC; varying float vLit; varying vec3 vPick; varying float vFade;
uniform float uPick;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  if (r > 0.5) discard;
  if (uPick > 0.5) { gl_FragColor = vec4(vPick, 1.0); return; }
  float a = smoothstep(0.5, 0.12, r) * vFade;
  if (a < 0.004) discard;
  vec3 c = vC + vLit * vec3(0.55, 0.45, 0.2);
  gl_FragColor = vec4(c, a * (0.55 + vLit * 0.45));
}`;

export function Brain3D({ nodes, regions, pos2d, lit, onPick, boardW, boardH,
                          morphTo = 1, onMorphDone }: {
  nodes: N3[]; regions: Record<string, Reg>;
  pos2d: Record<string, { x: number; y: number }>;
  lit: string[]; onPick: (id: string | null) => void;
  boardW: number; boardH: number;
  /** W4-T — 1 = brain, 0 = flat 2D board plane. Animated toward each frame;
   *  onMorphDone fires once when the target is reached (view handoff). */
  morphTo?: number; onMorphDone?: (() => void) | null;
}) {
  const morphToRef = useRef(morphTo); morphToRef.current = morphTo;
  const doneRef = useRef(onMorphDone); doneRef.current = onMorphDone;
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const litRef = useRef(lit); litRef.current = lit;
  const labelRef = useRef<HTMLDivElement | null>(null);
  const glState = useRef<{
    idOf: string[]; litBuf: WebGLBuffer | null; n: number;
    proj: (i: number) => [number, number, number] | null } | null>(null);

  // build + render loop — nodes/regions rebuild the buffers; lit only pokes
  // one attribute buffer (no re-layout, no re-subscription)
  useEffect(() => {
    const cv = cvRef.current; if (!cv || !nodes.length) return;
    const gl = cv.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) return;
    const sh = (t: number, src: string) => {
      const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);

    // ── geometry ──────────────────────────────────────────────────────
    const P3: number[] = [], P2: number[] = [], C: number[] = [], S: number[] = [];
    const PK: number[] = [], LIT: number[] = [], KD: number[] = [];
    const idOf: string[] = [];
    const push = (p3: [number, number, number], p2: [number, number, number],
                  c: [number, number, number], sz: number, id: string | null) => {
      P3.push(...p3); P2.push(...p2); C.push(...c); S.push(sz);
      const pi = id ? idOf.length + 1 : 0;          // 0 = unpickable
      if (id) idOf.push(id);
      PK.push(((pi >> 16) & 255) / 255, ((pi >> 8) & 255) / 255, (pi & 255) / 255);
      LIT.push(0);
      KD.push(id ? 0 : 1);                          // shell/stem = 1 → fades on flatten
    };
    // silhouette shell — two lobed hemispheres + cerebellum + brainstem.
    // Parametric, no model file; gyri feel from a low-freq radial ripple.
    const SHELL = 2400;
    for (let i = 0; i < SHELL; i++) {
      const u = srand('sh' + i, 1) * Math.PI * 2;         // around y
      const v = Math.acos(2 * srand('sh' + i, 2) - 1);    // from pole
      const side = i % 2 === 0 ? 1 : -1;
      let x = Math.sin(v) * Math.cos(u) * 0.34;
      const y = Math.cos(v) * 0.50;
      let z = Math.sin(v) * Math.sin(u) * 0.72;
      const ripple = 1 + 0.045 * Math.sin(7 * u) * Math.sin(9 * v);
      x = (x * ripple + 0.17) * side; z *= ripple;
      if (y < -0.25 && z > 0.2) continue;                 // jaw cutaway
      push([x, y * ripple, z], [x, y, z], [0.45, 0.55, 0.8], 1.6, null);
    }
    for (let i = 0; i < 320; i++) {                       // cerebellum
      const u = srand('cb' + i, 3) * Math.PI * 2, v = Math.acos(2 * srand('cb' + i, 4) - 1);
      push([Math.sin(v) * Math.cos(u) * 0.26, -0.42 + Math.cos(v) * 0.16,
            -0.55 + Math.sin(v) * Math.sin(u) * 0.22],
           [0, -0.5, -0.6], [0.5, 0.5, 0.75], 1.4, null);
    }
    for (let i = 0; i < 120; i++) {                       // brainstem
      const a = srand('bs' + i, 5) * Math.PI * 2, t = srand('bs' + i, 6);
      push([Math.cos(a) * 0.09, -0.35 - t * 0.4, -0.18 + Math.sin(a) * 0.09],
           [0, -0.6, -0.2], [0.5, 0.5, 0.75], 1.4, null);
    }
    // nodes — anchored per region, mirrored across hemispheres by id hash
    const litIdx: Record<string, number> = {};
    nodes.forEach(n => {
      const R = regions[n.region];
      const a = ANCHOR[n.region]
        || (R?.core ? ANCHOR.substrate : null)
        || LAYER_FALL[R?.layer || ''] || [0, 0, 0];
      const side = a[0] === 0 ? (srand(n.id, 7) < 0.5 ? -1 : 1)
                             : (srand(n.id, 7) < 0.85 ? 1 : -1) * Math.sign(a[0]) as (1 | -1);
      const sx = Math.abs(a[0]) === 0 ? 0.20 : Math.abs(a[0]);
      const g = (k: number) => (srand(n.id, k) + srand(n.id, k + 10) - 1) * 0.13;
      const p3: [number, number, number] = [
        (sx + g(1) * 0.9) * side * (R?.core ? 0.3 : 1),
        a[1] + g(2), a[2] + g(3)];
      // 2D board plane (x→x, y→−y, z=0.9 front) for the morph
      const q = pos2d[n.id];
      const p2: [number, number, number] = q
        ? [(q.x / boardW - 0.5) * 1.5, (0.5 - q.y / boardH) * 1.5, 0]
        : p3;
      const base = STATUS_C[n.status] || STATUS_C.dark;
      const tint = hsl(R?.hue ?? 210, 0.55, 0.6);
      const c: [number, number, number] = [
        base[0] * 0.55 + tint[0] * 0.45, base[1] * 0.55 + tint[1] * 0.45,
        base[2] * 0.55 + tint[2] * 0.45];
      litIdx[n.id] = S.length;
      push(p3, p2, c, n.kind === '신경' ? 3.4 : n.kind === '기관' ? 2.6 : 2.0, n.id);
    });
    const n = S.length;
    const buf = (data: number[], loc: string, size: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(prog, loc);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    buf(P3, 'aP3', 3); buf(P2, 'aP2', 3); buf(C, 'aC', 3); buf(S, 'aS', 1);
    buf(PK, 'aPick', 3); buf(KD, 'aKind', 1);
    const litBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, litBuf);
    const litArr = new Float32Array(LIT);
    gl.bufferData(gl.ARRAY_BUFFER, litArr, gl.DYNAMIC_DRAW);
    const lLit = gl.getAttribLocation(prog, 'aLit');
    gl.enableVertexAttribArray(lLit);
    gl.vertexAttribPointer(lLit, 1, gl.FLOAT, false, 0, 0);

    const uMVP = gl.getUniformLocation(prog, 'uMVP');
    const uMorph = gl.getUniformLocation(prog, 'uMorph');
    const uPick = gl.getUniformLocation(prog, 'uPick');
    const uPx = gl.getUniformLocation(prog, 'uPx');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── camera + loop ─────────────────────────────────────────────────
    const cam = { yaw: 0.6, pitch: 0.28, dist: 2.5 };
    let morph = morphToRef.current >= 1 ? 0 : 1;          // opposite → glide in
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastTouch = 0, raf = 0, dead = false, doneFired = -1;
    let mvp: Float32Array = new Float32Array(16);
    const draw = (tms: number) => {
      if (dead) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w && h && (cv.width !== w * devicePixelRatio || cv.height !== h * devicePixelRatio)) {
        cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio;
      }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0.027, 0.039, 0.07, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // W4-T — glide toward the requested layout (~700ms; instant if reduced)
      const tgt = morphToRef.current;
      const step = reduced ? 1 : 0.024;
      morph = morph < tgt ? Math.min(tgt, morph + step)
            : morph > tgt ? Math.max(tgt, morph - step) : morph;
      if (morph === tgt && doneFired !== tgt) {
        doneFired = tgt;
        if (doneRef.current) window.setTimeout(() => doneRef.current?.(), 0);
      }
      // heading toward the flat board the camera eases to a straight-on view,
      // so the settling dots register with the SVG board underneath
      if (tgt === 0) {
        cam.yaw += (0 - cam.yaw) * 0.08;
        cam.pitch += (0 - cam.pitch) * 0.08;
        cam.dist += (1.62 - cam.dist) * 0.08;
      } else if (!reduced && tms - lastTouch > 4000 && morph === 1) {
        cam.yaw += 0.0016;                                 // idle orbit (3D only)
      }
      // lit decay — same 5.2s spirit as 2D
      const now = Date.now();
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
      mvp = mul(persp(0.9, (w || 1) / (h || 1), 0.1, 20), lookAt(cam.yaw, cam.pitch, cam.dist));
      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniform1f(uMorph, morph);
      gl.uniform1f(uPick, 0);
      gl.uniform1f(uPx, (cv.height / 760) * 3.2);
      gl.drawArrays(gl.POINTS, 0, n);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // orbit — drag rotates, wheel dollies (no capture: clicks must live)
    let drag: { x: number; y: number } | null = null, moved = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY }; moved = false; lastTouch = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      cam.yaw += dx * 0.006;
      cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch + dy * 0.005));
      drag = { x: e.clientX, y: e.clientY }; lastTouch = performance.now();
    };
    const up = () => { drag = null; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.dist = Math.max(1.1, Math.min(6, cam.dist * Math.exp(e.deltaY * 0.0012)));
      lastTouch = performance.now();
    };
    // GPU picking — render ids to a 1px read under the cursor
    const click = (e: MouseEvent) => {
      if (moved) { moved = false; return; }
      const r = cv.getBoundingClientRect();
      const px = Math.round((e.clientX - r.left) * cv.width / r.width);
      const py = Math.round(cv.height - (e.clientY - r.top) * cv.height / r.height);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.uniform1f(uPick, 1);
      gl.drawArrays(gl.POINTS, 0, n);
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

    glState.current = {
      idOf, litBuf, n,
      proj: (i: number) => {
        const x = P3[i * 3], y = P3[i * 3 + 1], z = P3[i * 3 + 2];
        const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
        const cyy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
        const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        if (cw <= 0) return null;
        return [(cx / cw * 0.5 + 0.5), (0.5 - cyy / cw * 0.5), cw];
      },
    };
    return () => {
      dead = true; cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cv.removeEventListener('wheel', wheel);
      cv.removeEventListener('click', click);
      glState.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, regions, pos2d, boardW, boardH]);

  // HTML labels for lit nerves — WebGL text is heavy; six divs are free.
  useEffect(() => {
    const box = labelRef.current; if (!box) return;
    const t = window.setInterval(() => {
      const st = glState.current; if (!st) return;
      const names = litRef.current.slice(0, 6);
      const idx: Record<string, number> = {};
      st.idOf.forEach((id, i) => { idx[id] = i; });
      const shellOff = st.n - st.idOf.length;
      box.innerHTML = '';
      names.forEach(id => {
        const i = idx[id]; if (i == null) return;
        const pr = st.proj(shellOff + i); if (!pr) return;
        const d = document.createElement('div');
        d.className = 'b3d-lab';
        d.textContent = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
        d.style.left = `${(pr[0] * 100).toFixed(2)}%`;
        d.style.top = `${(pr[1] * 100).toFixed(2)}%`;
        box.appendChild(d);
      });
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="brain3d" data-lit={lit.length}>
      <canvas ref={cvRef} className="brain3d__cv"
              aria-label="dobbin brain — 3D anatomical view" />
      <div ref={labelRef} className="brain3d__labels" aria-hidden="true" />
    </div>
  );
}

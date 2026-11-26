// ─────────────────────────────────────────────────────────────
//  Sonido (sintetizado, sin archivos), vibración y efectos
// ─────────────────────────────────────────────────────────────
const cfg = { sound: true, haptics: true };
export const configure = (o) => Object.assign(cfg, o);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctx = null;
function audio() {
  if (!cfg.sound) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    // En iOS 17+ respeta el interruptor de silencio
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (_) { /* nada */ }
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, { type = 'sine', gain = 0.06, at = 0, to = null } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap() { tone(880, 0.05, { gain: 0.025 }); },
  place() { tone(660, 0.09, { type: 'triangle', gain: 0.05 }); },
  note() { tone(1240, 0.05, { gain: 0.02 }); },
  erase() { tone(420, 0.07, { type: 'triangle', gain: 0.03, to: 300 }); },
  error() { tone(190, 0.18, { type: 'square', gain: 0.03, to: 120 }); },
  unit() { [784, 988, 1175].forEach((f, k) => tone(f, 0.16, { type: 'triangle', gain: 0.04, at: k * 0.06 })); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.32, { type: 'triangle', gain: 0.05, at: k * 0.09 })); },
  coin() { tone(1319, 0.08, { type: 'square', gain: 0.02 }); tone(1760, 0.14, { type: 'square', gain: 0.02, at: 0.07 }); },
  buy() { [880, 1109, 1319].forEach((f, k) => tone(f, 0.12, { type: 'triangle', gain: 0.04, at: k * 0.05 })); },
  hint() { tone(988, 0.12, { gain: 0.04 }); tone(1319, 0.18, { gain: 0.035, at: 0.08 }); },
};

// Vibración: Android usa vibrate; iPhone (iOS 18+) responde a un interruptor nativo oculto
export function haptic(kind = 'light') {
  if (!cfg.haptics) return;
  if (navigator.vibrate) {
    navigator.vibrate(kind === 'error' ? [30, 40, 30] : kind === 'success' ? [15, 30, 15, 30, 40] : 10);
    return;
  }
  try {
    const times = kind === 'error' ? 2 : kind === 'success' ? 3 : 1;
    for (let k = 0; k < times; k++) setTimeout(tick, k * 90);
  } catch (_) { /* sin vibración */ }
}
function tick() {
  const label = document.createElement('label');
  label.ariaHidden = 'true';
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

// ── Partículas de victoria ──────────────────────────────────
export function celebrate(kind, colors) {
  if (reduced || kind === 'glaze') return;
  const cv = document.createElement('canvas');
  cv.className = 'fx-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  // Como "popover" queda por encima del diálogo de victoria
  cv.setAttribute('popover', 'manual');
  document.body.appendChild(cv);
  try { cv.showPopover(); } catch (_) { /* navegadores antiguos: queda detrás */ }
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const N = kind === 'stars' ? 70 : 120;
  const parts = Array.from({ length: N }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 1.6,
    vy: 2 + Math.random() * 3.2,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    s: kind === 'stars' ? 8 + Math.random() * 10 : 6 + Math.random() * 7,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const star = (x, y, s) => {
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, rr = k % 2 ? s * 0.28 : s;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  const t0 = performance.now();
  (function frame(t) {
    const life = (t - t0) / 1000;
    g.clearRect(0, 0, W, H);
    g.globalAlpha = Math.max(0, Math.min(1, 3.4 - life));
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.02;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      if (kind === 'stars') star(0, 0, p.s / 2);
      else { g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-p.s / 6, -p.s / 6, p.s / 3, p.s / 3); }
      g.restore();
    }
    if (life < 3.4) requestAnimationFrame(frame);
    else cv.remove();
  })(t0);
}

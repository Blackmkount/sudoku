// ─────────────────────────────────────────────────────────────
//  Estado del jugador
//  · Monedas, pistas y vidas son contadores por dispositivo
//    (cada "escritor" suma en su propia casilla). Al sincronizar
//    se toma el máximo de cada casilla: nada se duplica ni se pierde.
//  · El progreso se une: mejor tiempo y más estrellas por nivel.
// ─────────────────────────────────────────────────────────────
import { WELCOME, REWARD } from './catalog.js';

export const STATE_VERSION = 3;
export const GUEST_KEY = 'azulejo.v1';
export const accountKey = (uid) => `azulejo.u.${uid}`;

export const newId = (p = 'w') => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function defaults() {
  return {
    v: STATE_VERSION,
    profile: { name: '', avatar: '🦉' },
    settings: { showErrors: true, errorLimit: false, sameHighlight: true, autoNotes: true, showTimer: true, sound: true, haptics: true },
    equipped: { theme: 'auto', effect: 'glaze' },
    owned: {},
    progress: {},
    daily: {},
    wallet: { earned: { welcome: WELCOME.coins }, spent: {} },
    hints: { got: { welcome: WELCOME.hints }, used: {} },
    lives: { got: { welcome: WELCOME.lives }, used: {} },
    stats: { solved: {}, time: {}, best: {} },
    achievements: {},
    lastTier: 'dificil',
    tipDismissed: false,
    onboarded: false,
    levelsVersion: 2,
    game: null,
    meta: { updatedAt: 0 },
  };
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
function fill(target, base) {
  for (const k of Object.keys(base)) {
    if (target[k] === undefined) target[k] = JSON.parse(JSON.stringify(base[k]));
    else if (isObj(base[k]) && isObj(target[k]) && k !== 'game') fill(target[k], base[k]);
  }
  return target;
}
const rec = (r) => (typeof r === 'number' ? { t: r, s: 1 } : r && typeof r === 'object' ? { t: +r.t || 0, s: Math.min(3, Math.max(1, +r.s || 1)) } : null);

// Convierte partidas guardadas de versiones anteriores
export function migrate(raw) {
  const s = isObj(raw) ? raw : {};
  if (!s.v) {
    // Versión 1/2: progreso como número de segundos, tema en ajustes
    if ((s.levelsVersion || 1) < 2) {
      if (s.progress) delete s.progress.diabolico;
      if (s.stats?.best) delete s.stats.best.diabolico;
      if (s.game?.tier === 'diabolico') s.game = null;
      s.levelsVersion = 2;
    }
    if (s.settings?.theme) { s.equipped = { theme: s.settings.theme, effect: 'glaze' }; delete s.settings.theme; }
    if (s.stats) {
      s.stats = {
        solved: { legacy: typeof s.stats.solved === 'number' ? s.stats.solved : 0 },
        time: { legacy: typeof s.stats.time === 'number' ? s.stats.time : 0 },
        best: s.stats.best || {},
      };
    }
    const hadProgress = s.progress && Object.values(s.progress).some((p) => p && Object.keys(p.done || {}).length);
    // Monedas retroactivas por los niveles que ya habías resuelto
    let legacy = 0;
    for (const [tier, p] of Object.entries(s.progress || {})) legacy += (REWARD[tier] || 0) * Object.keys(p?.done || {}).length;
    s.wallet = { earned: { welcome: WELCOME.coins, legacy }, spent: {} };
    s.onboarded = false;
    if (hadProgress) s.meta = { updatedAt: Date.now() };
    s.v = STATE_VERSION;
  }
  for (const p of Object.values(s.progress || {})) {
    if (!p || !p.done) continue;
    for (const k of Object.keys(p.done)) { const r = rec(p.done[k]); if (r) p.done[k] = r; else delete p.done[k]; }
  }
  for (const k of Object.keys(s.daily || {})) { const r = rec(s.daily[k]); if (r) s.daily[k] = r; else delete s.daily[k]; }
  fill(s, defaults());
  if (s.game && !Array.isArray(s.game.history)) s.game.history = [];
  return s;
}

// ── Contadores ──────────────────────────────────────────────
export const sumC = (c) => Object.values(c || {}).reduce((a, b) => a + (+b || 0), 0);
export const addC = (c, writer, n) => { c[writer] = (c[writer] || 0) + n; };
export const mergeC = (a = {}, b = {}) => {
  const o = { ...a };
  for (const k of Object.keys(b)) o[k] = Math.max(o[k] || 0, b[k] || 0);
  return o;
};
export const coins = (S) => sumC(S.wallet.earned) - sumC(S.wallet.spent);
export const hintsLeft = (S) => sumC(S.hints.got) - sumC(S.hints.used);
export const livesLeft = (S) => sumC(S.lives.got) - sumC(S.lives.used);

// ── Fusión entre dispositivos ───────────────────────────────
const mergeRec = (x, y) => (!x ? y : !y ? x : { t: Math.min(x.t, y.t), s: Math.max(x.s, y.s) });

export function mergeStates(a, b) {
  const [newer, older] = (a.meta?.updatedAt || 0) >= (b.meta?.updatedAt || 0) ? [a, b] : [b, a];
  const o = JSON.parse(JSON.stringify(newer));
  for (const [tier, p] of Object.entries(older.progress || {})) {
    const dst = (o.progress[tier] ||= { done: {} }).done;
    for (const [i, r] of Object.entries(p?.done || {})) dst[i] = mergeRec(dst[i], r);
  }
  for (const [d, r] of Object.entries(older.daily || {})) o.daily[d] = mergeRec(o.daily[d], r);
  for (const [k, subs] of [['wallet', ['earned', 'spent']], ['hints', ['got', 'used']], ['lives', ['got', 'used']], ['stats', ['solved', 'time']]]) {
    for (const sub of subs) o[k][sub] = mergeC(o[k][sub], older[k]?.[sub]);
  }
  for (const [tier, t] of Object.entries(older.stats?.best || {})) {
    if (o.stats.best[tier] == null || t < o.stats.best[tier]) o.stats.best[tier] = t;
  }
  o.owned = { ...(older.owned || {}), ...o.owned };
  for (const [id, ts] of Object.entries(older.achievements || {})) {
    o.achievements[id] = o.achievements[id] ? Math.min(o.achievements[id], ts) : ts;
  }
  o.onboarded = !!(o.onboarded || older.onboarded);
  o.meta = { updatedAt: Math.max(a.meta?.updatedAt || 0, b.meta?.updatedAt || 0) };
  return o;
}

// Copia para la nube: sin el historial de deshacer (solo sirve en el dispositivo)
export function forCloud(S) {
  const c = JSON.parse(JSON.stringify(S));
  if (c.game) c.game.history = [];
  return c;
}

// ── Almacenamiento local ────────────────────────────────────
export function readState(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch (_) { return null; }
}
export function writeState(key, S) {
  try { localStorage.setItem(key, JSON.stringify(S)); return true; } catch (_) { return false; }
}
export function removeState(key) {
  try { localStorage.removeItem(key); localStorage.removeItem(`azulejo.writer.${key}`); } catch (_) { /* nada */ }
}
// Identificador de "escritor" para los contadores de este dispositivo y perfil
export function writerFor(key) {
  const k = `azulejo.writer.${key}`;
  try {
    let w = localStorage.getItem(k);
    if (!w) { w = newId(); localStorage.setItem(k, w); }
    return w;
  } catch (_) { return 'local'; }
}

// ── Resumen y puntos ────────────────────────────────────────
export function summary(S, tiers, streak) {
  const x = { levels: 0, twoStars: 0, threeStars: 0, byTier: {}, fullTiers: 0, fastDificil: false, stars: 0 };
  for (const t of tiers) {
    const done = S.progress[t.id]?.done || {};
    const recs = Object.values(done);
    x.byTier[t.id] = recs.length;
    x.levels += recs.length;
    if (recs.length >= t.levels.length) x.fullTiers++;
    for (const r of recs) {
      x.stars += r.s;
      if (r.s >= 2) x.twoStars++;
      if (r.s >= 3) x.threeStars++;
      if (t.id === 'dificil' && r.t > 0 && r.t < 360) x.fastDificil = true;
    }
  }
  x.solved = sumC(S.stats.solved);
  x.time = sumC(S.stats.time);
  x.streak = streak;
  x.cosmetics = Object.keys(S.owned).length;
  x.dailies = Object.keys(S.daily).length;
  return x;
}

export function points(S, tiers, POINTS, dailyPoints) {
  let p = 0;
  for (const t of tiers) for (const r of Object.values(S.progress[t.id]?.done || {})) p += (POINTS[t.id] || 0) * r.s;
  return p + Object.keys(S.daily).length * dailyPoints;
}

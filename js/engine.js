// ─────────────────────────────────────────────────────────────
//  Motor de Sudoku
//  · Solver por bits con conteo de soluciones (unicidad)
//  · Generador simétrico de puzzles mínimos
//  · Calificador "humano": resuelve con técnicas reales y
//    mide cuál es la más difícil que hace falta
//  · Pistas paso a paso y transformaciones que preservan dificultad
// ─────────────────────────────────────────────────────────────

export const ALL = 0x1ff;
const POP = new Uint8Array(512);
for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
const DIGIT_OF = new Int8Array(512);
for (let d = 1; d <= 9; d++) DIGIT_OF[1 << (d - 1)] = d;
const BIT = (d) => 1 << (d - 1);

export const ROW_OF = new Int8Array(81);
export const COL_OF = new Int8Array(81);
export const BOX_OF = new Int8Array(81);
for (let i = 0; i < 81; i++) {
  const r = (i / 9) | 0, c = i % 9;
  ROW_OF[i] = r; COL_OF[i] = c; BOX_OF[i] = ((r / 3) | 0) * 3 + ((c / 3) | 0);
}

// Unidades: 0-8 filas, 9-17 columnas, 18-26 cajas
export const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, k) => r * 9 + k));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, k) => k * 9 + c));
for (let b = 0; b < 9; b++) {
  const br = ((b / 3) | 0) * 3, bc = (b % 3) * 3, cells = [];
  for (let k = 0; k < 9; k++) cells.push((br + ((k / 3) | 0)) * 9 + bc + (k % 3));
  UNITS.push(cells);
}
const UNIT_ORDER = [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export const PEERS = [];
const IS_PEER = new Uint8Array(81 * 81);
for (let i = 0; i < 81; i++) {
  const set = new Set([...UNITS[ROW_OF[i]], ...UNITS[9 + COL_OF[i]], ...UNITS[18 + BOX_OF[i]]]);
  set.delete(i);
  PEERS.push([...set]);
  for (const p of set) IS_PEER[i * 81 + p] = 1;
}
const sees = (a, b) => IS_PEER[a * 81 + b] === 1;

export const digitsOf = (m) => {
  const out = [];
  for (let d = 1; d <= 9; d++) if (m & BIT(d)) out.push(d);
  return out;
};

// ── RNG reproducible ─────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Solver por backtracking (MRV + bits) ─────────────────────
export function countSolutions(grid, limit = 2, out = null, rng = null) {
  const g = Int8Array.from(grid);
  const rm = new Int16Array(9), cm = new Int16Array(9), bm = new Int16Array(9);
  for (let i = 0; i < 81; i++) {
    const d = g[i];
    if (!d) continue;
    const b = BIT(d), r = ROW_OF[i], c = COL_OF[i], x = BOX_OF[i];
    if ((rm[r] | cm[c] | bm[x]) & b) return 0;
    rm[r] |= b; cm[c] |= b; bm[x] |= b;
  }
  const empties = [];
  for (let i = 0; i < 81; i++) if (!g[i]) empties.push(i);
  const n = empties.length;
  let count = 0;

  function rec(k) {
    if (k === n) {
      count++;
      if (out && count === 1) for (let i = 0; i < 81; i++) out[i] = g[i];
      return count >= limit;
    }
    let bi = -1, bMask = 0, bCnt = 10;
    for (let j = k; j < n; j++) {
      const i = empties[j];
      const m = ALL & ~(rm[ROW_OF[i]] | cm[COL_OF[i]] | bm[BOX_OF[i]]);
      const p = POP[m];
      if (p < bCnt) { bCnt = p; bMask = m; bi = j; if (p <= 1) break; }
    }
    if (bCnt === 0) return false;
    const tmp = empties[k]; empties[k] = empties[bi]; empties[bi] = tmp;
    const i = empties[k], r = ROW_OF[i], c = COL_OF[i], x = BOX_OF[i];
    let bits = [];
    for (let m = bMask; m; m &= m - 1) bits.push(m & -m);
    if (rng) shuffle(bits, rng);
    for (const b of bits) {
      g[i] = DIGIT_OF[b]; rm[r] |= b; cm[c] |= b; bm[x] |= b;
      const stop = rec(k + 1);
      rm[r] ^= b; cm[c] ^= b; bm[x] ^= b; g[i] = 0;
      if (stop) return true;
    }
    return false;
  }
  rec(0);
  return count;
}

export function solve(grid) {
  const out = new Array(81).fill(0);
  return countSolutions(grid, 1, out) === 1 ? out : null;
}

export function randomSolution(rng) {
  const out = new Array(81).fill(0);
  countSolutions(new Array(81).fill(0), 1, out, rng);
  return out;
}

// Genera un puzzle mínimo con simetría rotacional y solución única
export function generate(rng) {
  const sol = randomSolution(rng);
  const p = sol.slice();
  const cells = shuffle(Array.from({ length: 41 }, (_, i) => i), rng);
  for (const i of cells) {
    const j = 80 - i;
    const a = p[i], b = p[j];
    p[i] = 0; p[j] = 0;
    if (countSolutions(p, 2) !== 1) { p[i] = a; p[j] = b; }
  }
  return { puzzle: p, solution: sol };
}

// ── Tablero lógico con candidatos ───────────────────────────
class Board {
  constructor(values) {
    this.v = new Int8Array(81);
    this.c = new Int16Array(81).fill(ALL);
    if (values) for (let i = 0; i < 81; i++) if (values[i]) this.place(i, values[i]);
  }
  clone() {
    const b = new Board(null);
    b.v.set(this.v); b.c.set(this.c);
    return b;
  }
  place(i, d) {
    this.v[i] = d; this.c[i] = 0;
    const nb = ~BIT(d);
    const P = PEERS[i];
    for (let k = 0; k < P.length; k++) this.c[P[k]] &= nb;
  }
  solved() {
    for (let i = 0; i < 81; i++) if (!this.v[i]) return false;
    return true;
  }
  contradiction() {
    for (let i = 0; i < 81; i++) if (!this.v[i] && !this.c[i]) return true;
    for (let u = 0; u < 27; u++) {
      let have = 0, cand = 0, placed = 0;
      for (const i of UNITS[u]) {
        if (this.v[i]) { have |= BIT(this.v[i]); placed++; } else cand |= this.c[i];
      }
      if (POP[have] !== placed || (have | cand) !== ALL) return true;
    }
    return false;
  }
}

function applyStep(B, s) {
  if (s.place) B.place(s.place[0], s.place[1]);
  for (const [i, m] of s.elim) B.c[i] &= ~m;
}

function combos(arr, k, fn, start = 0, acc = []) {
  if (acc.length === k) return fn(acc);
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]);
    if (combos(arr, k, fn, i + 1, acc)) { acc.pop(); return true; }
    acc.pop();
  }
  return false;
}

// ── Técnicas ────────────────────────────────────────────────
export const TECH = {
  hiddenSingle: { r: 1.0, name: 'Único oculto' },
  nakedSingle: { r: 1.1, name: 'Único desnudo' },
  pointing: { r: 2.0, name: 'Candidatos apuntando' },
  claiming: { r: 2.1, name: 'Candidatos reclamando' },
  nakedPair: { r: 2.5, name: 'Par desnudo' },
  hiddenPair: { r: 2.7, name: 'Par oculto' },
  nakedTriple: { r: 3.0, name: 'Trío desnudo' },
  hiddenTriple: { r: 3.2, name: 'Trío oculto' },
  xWing: { r: 3.4, name: 'X-Wing' },
  nakedQuad: { r: 3.6, name: 'Cuarteto desnudo' },
  hiddenQuad: { r: 3.8, name: 'Cuarteto oculto' },
  swordfish: { r: 4.0, name: 'Swordfish' },
  xyWing: { r: 4.2, name: 'XY-Wing' },
  xyzWing: { r: 4.4, name: 'XYZ-Wing' },
  jellyfish: { r: 4.6, name: 'Jellyfish' },
  forcing: { r: 5.0, name: 'Cadena forzada' },
  forcingDeep: { r: 5.5, name: 'Cadena forzada profunda' },
};

function hiddenSingle(B) {
  for (const u of UNIT_ORDER) {
    const cells = UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const b = BIT(d);
      let pos = -1, n = 0;
      for (let k = 0; k < 9; k++) if (B.c[cells[k]] & b) { n++; pos = cells[k]; if (n > 1) break; }
      if (n === 1) return { t: 'hiddenSingle', place: [pos, d], elim: [], cells: [pos], unit: u, digits: b };
    }
  }
  return null;
}

function nakedSingle(B) {
  for (let i = 0; i < 81; i++) {
    if (!B.v[i] && POP[B.c[i]] === 1) return { t: 'nakedSingle', place: [i, DIGIT_OF[B.c[i]]], elim: [], cells: [i], unit: null, digits: B.c[i] };
  }
  return null;
}

function pointing(B) {
  for (let bx = 0; bx < 9; bx++) {
    const cells = UNITS[18 + bx];
    for (let d = 1; d <= 9; d++) {
      const b = BIT(d);
      let rows = 0, cols = 0;
      const list = [];
      for (const i of cells) if (B.c[i] & b) { rows |= 1 << ROW_OF[i]; cols |= 1 << COL_OF[i]; list.push(i); }
      if (list.length < 2) continue;
      for (const [mask, unitBase, of] of [[rows, 0, ROW_OF], [cols, 9, COL_OF]]) {
        if (POP[mask] !== 1) continue;
        const u = unitBase + of[list[0]];
        const elim = [];
        for (const i of UNITS[u]) if (BOX_OF[i] !== bx && (B.c[i] & b)) elim.push([i, b]);
        if (elim.length) return { t: 'pointing', place: null, elim, cells: list, unit: 18 + bx, digits: b };
      }
    }
  }
  return null;
}

function claiming(B) {
  for (let u = 0; u < 18; u++) {
    const cells = UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const b = BIT(d);
      let boxes = 0;
      const list = [];
      for (const i of cells) if (B.c[i] & b) { boxes |= 1 << BOX_OF[i]; list.push(i); }
      if (list.length < 2 || POP[boxes] !== 1) continue;
      const bx = BOX_OF[list[0]];
      const elim = [];
      for (const i of UNITS[18 + bx]) if (!cells.includes(i) && (B.c[i] & b)) elim.push([i, b]);
      if (elim.length) return { t: 'claiming', place: null, elim, cells: list, unit: u, digits: b };
    }
  }
  return null;
}

function nakedSubset(B, n, t) {
  for (const u of UNIT_ORDER) {
    const empt = UNITS[u].filter((i) => !B.v[i]);
    if (empt.length <= n) continue;
    const cand = empt.filter((i) => POP[B.c[i]] >= 2 && POP[B.c[i]] <= n);
    if (cand.length < n) continue;
    let found = null;
    combos(cand, n, (combo) => {
      let m = 0;
      for (const i of combo) m |= B.c[i];
      if (POP[m] !== n) return false;
      const elim = [];
      for (const i of empt) if (!combo.includes(i) && (B.c[i] & m)) elim.push([i, B.c[i] & m]);
      if (!elim.length) return false;
      found = { t, place: null, elim, cells: combo.slice(), unit: u, digits: m };
      return true;
    });
    if (found) return found;
  }
  return null;
}

function hiddenSubset(B, n, t) {
  for (const u of UNIT_ORDER) {
    const cells = UNITS[u];
    const pos = new Int16Array(10);
    for (let k = 0; k < 9; k++) {
      const m = B.c[cells[k]];
      for (let d = 1; d <= 9; d++) if (m & BIT(d)) pos[d] |= 1 << k;
    }
    const ds = [];
    for (let d = 1; d <= 9; d++) if (POP[pos[d]] >= 2 && POP[pos[d]] <= n) ds.push(d);
    if (ds.length < n) continue;
    let found = null;
    combos(ds, n, (combo) => {
      let union = 0, dm = 0;
      for (const d of combo) { union |= pos[d]; dm |= BIT(d); }
      if (POP[union] !== n) return false;
      const elim = [], inv = [];
      for (let k = 0; k < 9; k++) {
        if (!(union & (1 << k))) continue;
        const i = cells[k];
        inv.push(i);
        const extra = B.c[i] & ~dm;
        if (extra) elim.push([i, extra]);
      }
      if (!elim.length) return false;
      found = { t, place: null, elim, cells: inv, unit: u, digits: dm };
      return true;
    });
    if (found) return found;
  }
  return null;
}

function fish(B, n, t) {
  for (let d = 1; d <= 9; d++) {
    const b = BIT(d);
    for (let orient = 0; orient < 2; orient++) {
      const at = (L, k) => (orient === 0 ? L * 9 + k : k * 9 + L);
      const lines = [];
      for (let L = 0; L < 9; L++) {
        let mask = 0;
        for (let k = 0; k < 9; k++) if (B.c[at(L, k)] & b) mask |= 1 << k;
        if (POP[mask] >= 2 && POP[mask] <= n) lines.push([L, mask]);
      }
      if (lines.length < n) continue;
      let found = null;
      combos(lines, n, (combo) => {
        let cover = 0;
        const base = new Set();
        for (const [L, m] of combo) { cover |= m; base.add(L); }
        if (POP[cover] !== n) return false;
        const elim = [];
        for (let k = 0; k < 9; k++) {
          if (!(cover & (1 << k))) continue;
          for (let L = 0; L < 9; L++) {
            if (base.has(L)) continue;
            const i = at(L, k);
            if (B.c[i] & b) elim.push([i, b]);
          }
        }
        if (!elim.length) return false;
        const cells = [];
        for (const [L, m] of combo) for (let k = 0; k < 9; k++) if (m & (1 << k)) cells.push(at(L, k));
        found = { t, place: null, elim, cells, unit: null, digits: b };
        return true;
      });
      if (found) return found;
    }
  }
  return null;
}

function xyWing(B) {
  for (let p = 0; p < 81; p++) {
    const cp = B.c[p];
    if (B.v[p] || POP[cp] !== 2) continue;
    for (const a of PEERS[p]) {
      const ca = B.c[a];
      if (POP[ca] !== 2 || ca === cp || POP[ca & cp] !== 1) continue;
      const z = ca & ~cp;
      const want = (cp & ~ca) | z;
      for (const bb of PEERS[p]) {
        if (bb === a || B.c[bb] !== want) continue;
        const elim = [];
        for (let i = 0; i < 81; i++) {
          if (i === p || i === a || i === bb) continue;
          if ((B.c[i] & z) && sees(i, a) && sees(i, bb)) elim.push([i, z]);
        }
        if (elim.length) return { t: 'xyWing', place: null, elim, cells: [p, a, bb], unit: null, digits: z };
      }
    }
  }
  return null;
}

function xyzWing(B) {
  for (let p = 0; p < 81; p++) {
    const cp = B.c[p];
    if (B.v[p] || POP[cp] !== 3) continue;
    const wings = PEERS[p].filter((i) => POP[B.c[i]] === 2 && (B.c[i] & ~cp) === 0);
    for (let x = 0; x < wings.length; x++) {
      for (let y = x + 1; y < wings.length; y++) {
        const a = wings[x], bb = wings[y];
        if (B.c[a] === B.c[bb] || (B.c[a] | B.c[bb]) !== cp) continue;
        const z = B.c[a] & B.c[bb];
        const elim = [];
        for (let i = 0; i < 81; i++) {
          if (i === p || i === a || i === bb) continue;
          if ((B.c[i] & z) && sees(i, p) && sees(i, a) && sees(i, bb)) elim.push([i, z]);
        }
        if (elim.length) return { t: 'xyzWing', place: null, elim, cells: [p, a, bb], unit: null, digits: z };
      }
    }
  }
  return null;
}

const SINGLES = [hiddenSingle, nakedSingle];
const LOGIC = [
  hiddenSingle,
  nakedSingle,
  pointing,
  claiming,
  (B) => nakedSubset(B, 2, 'nakedPair'),
  (B) => hiddenSubset(B, 2, 'hiddenPair'),
  (B) => nakedSubset(B, 3, 'nakedTriple'),
  (B) => hiddenSubset(B, 3, 'hiddenTriple'),
  (B) => fish(B, 2, 'xWing'),
  (B) => nakedSubset(B, 4, 'nakedQuad'),
  (B) => hiddenSubset(B, 4, 'hiddenQuad'),
  (B) => fish(B, 3, 'swordfish'),
  xyWing,
  xyzWing,
  (B) => fish(B, 4, 'jellyfish'),
];

function propagate(T, techs) {
  for (let guard = 0; guard < 400; guard++) {
    if (T.contradiction()) return false;
    if (T.solved()) return true;
    let s = null;
    for (const f of techs) { s = f(T); if (s) break; }
    if (!s) return true;
    applyStep(T, s);
  }
  return !T.contradiction();
}

// Prueba un candidato y busca contradicción (cadena forzada / Nishio)
function forcing(B, deep) {
  const techs = deep ? LOGIC : SINGLES;
  for (const size of [2, 3]) {
    for (let i = 0; i < 81; i++) {
      if (B.v[i] || POP[B.c[i]] !== size) continue;
      for (const d of digitsOf(B.c[i])) {
        const T = B.clone();
        T.place(i, d);
        if (!propagate(T, techs)) {
          return { t: deep ? 'forcingDeep' : 'forcing', place: null, elim: [[i, BIT(d)]], cells: [i], unit: null, digits: BIT(d) };
        }
      }
    }
  }
  return null;
}

function nextStep(B, allowForcing = true) {
  for (const f of LOGIC) {
    const s = f(B);
    if (s) return s;
  }
  if (!allowForcing) return null;
  return forcing(B, false) || forcing(B, true);
}

// Califica un puzzle: técnica más difícil necesaria, nº de pasos avanzados
export function rate(puzzle) {
  const B = new Board(puzzle);
  let max = 0, hardest = 'hiddenSingle', adv = 0, steps = 0;
  const used = {};
  while (!B.solved()) {
    const s = nextStep(B, true);
    if (!s) return { rating: 10, hardest: 'unsolved', solved: false, adv, steps, used };
    applyStep(B, s);
    const r = TECH[s.t].r;
    used[s.t] = (used[s.t] || 0) + 1;
    if (r > max) { max = r; hardest = s.t; }
    if (r >= 2) adv++;
    steps++;
  }
  return { rating: max, hardest, solved: true, adv, steps, used, values: Array.from(B.v) };
}

// Pista: próxima celda que se puede deducir y la técnica necesaria
export function hint(values, solution) {
  const B = new Board(values);
  let first = null, hardest = null, hr = 0;
  for (let guard = 0; guard < 300 && !B.solved(); guard++) {
    const s = nextStep(B, true);
    if (!s) break;
    if (s.place) {
      const tech = hardest || s.t;
      return { cell: s.place[0], digit: s.place[1], tech, step: first || s, direct: !first };
    }
    if (!first) first = s;
    if (TECH[s.t].r > hr) { hr = TECH[s.t].r; hardest = s.t; }
    applyStep(B, s);
  }
  let best = -1, bc = 10;
  for (let i = 0; i < 81; i++) if (!values[i] && POP[B.c[i]] < bc) { bc = POP[B.c[i]]; best = i; }
  if (best < 0) return null;
  return { cell: best, digit: solution[best], tech: 'unsolved', step: null, direct: false };
}

// Candidatos completos para un tablero (para "autonotas")
export function candidates(values) {
  const B = new Board(values);
  return Array.from(B.c);
}

// ── Transformaciones que preservan la dificultad ─────────────
export function transform(puzzle, solution, rng) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const order = () => {
    const out = [];
    for (const band of shuffle([0, 1, 2], rng)) for (const k of shuffle([0, 1, 2], rng)) out.push(band * 3 + k);
    return out;
  };
  const rows = order(), cols = order(), tr = rng() < 0.5;
  const map = (g) => {
    const out = new Array(81);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const src = tr ? cols[c] * 9 + rows[r] : rows[r] * 9 + cols[c];
      const v = g[src];
      out[r * 9 + c] = v ? digits[v - 1] : 0;
    }
    return out;
  };
  return { puzzle: map(puzzle), solution: map(solution) };
}

export const toStr = (g) => g.map((v) => (v ? String(v) : '.')).join('');
export const fromStr = (s) => [...s].map((ch) => (ch >= '1' && ch <= '9' ? +ch : 0));

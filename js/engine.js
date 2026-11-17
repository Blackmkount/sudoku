// ─────────────────────────────────────────────────────────────
//  Motor de Sudoku (cualquier tamaño N×N con cajas BR×BC)
//  · Solver por bits con conteo de soluciones (unicidad)
//  · Generador simétrico de puzzles mínimos
//  · Calificador "humano": resuelve con técnicas reales y
//    mide cuál es la más difícil que hace falta
//  · Pistas paso a paso y transformaciones que preservan dificultad
// ─────────────────────────────────────────────────────────────

// Cajas por tamaño: [filas, columnas]
export const BOXES = { 4: [2, 2], 6: [2, 3], 9: [3, 3], 12: [3, 4] };
const ENGINES = {};
export function getEngine(n) {
  if (!ENGINES[n]) ENGINES[n] = createEngine(n, ...BOXES[n]);
  return ENGINES[n];
}

// ── Utilidades comunes ──────────────────────────────────────
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
// Codificación: 1-9 como dígitos, 10-16 como A-G, vacío como "."
export const charOf = (v) => (!v ? '.' : v <= 9 ? String(v) : String.fromCharCode(55 + v));
export const valOf = (ch) => (ch >= '1' && ch <= '9' ? +ch : ch >= 'A' && ch <= 'G' ? ch.charCodeAt(0) - 55 : 0);
export const toStr = (g) => g.map(charOf).join('');
export const fromStr = (s) => [...s].map(valOf);
export const sizeOfStr = (len) => Math.round(Math.sqrt(len));

// Ratings de técnicas (comunes a todos los tamaños)
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

function combos(arr, k, fn, start = 0, acc = []) {
  if (acc.length === k) return fn(acc);
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]);
    if (combos(arr, k, fn, i + 1, acc)) { acc.pop(); return true; }
    acc.pop();
  }
  return false;
}

// ── Motor por tamaño ────────────────────────────────────────
function createEngine(N, BR, BC) {
  const NN = N * N;
  const ALL = (1 << N) - 1;
  const BPR = N / BC; // cajas por banda horizontal
  const POP = new Uint8Array(1 << N);
  for (let m = 1; m < 1 << N; m++) POP[m] = POP[m >> 1] + (m & 1);
  const DIGIT_OF = new Int8Array(1 << N);
  for (let d = 1; d <= N; d++) DIGIT_OF[1 << (d - 1)] = d;
  const BIT = (d) => 1 << (d - 1);

  const ROW_OF = new Int8Array(NN), COL_OF = new Int8Array(NN), BOX_OF = new Int8Array(NN);
  for (let i = 0; i < NN; i++) {
    const r = (i / N) | 0, c = i % N;
    ROW_OF[i] = r; COL_OF[i] = c; BOX_OF[i] = ((r / BR) | 0) * BPR + ((c / BC) | 0);
  }
  // Unidades: 0..N-1 filas, N..2N-1 columnas, 2N..3N-1 cajas
  const UNITS = [];
  for (let r = 0; r < N; r++) UNITS.push(Array.from({ length: N }, (_, k) => r * N + k));
  for (let c = 0; c < N; c++) UNITS.push(Array.from({ length: N }, (_, k) => k * N + c));
  for (let b = 0; b < N; b++) {
    const r0 = ((b / BPR) | 0) * BR, c0 = (b % BPR) * BC, cells = [];
    for (let k = 0; k < N; k++) cells.push((r0 + ((k / BC) | 0)) * N + c0 + (k % BC));
    UNITS.push(cells);
  }
  const UNIT_ORDER = [];
  for (let u = 2 * N; u < 3 * N; u++) UNIT_ORDER.push(u);
  for (let u = 0; u < 2 * N; u++) UNIT_ORDER.push(u);

  const PEERS = [];
  const IS_PEER = new Uint8Array(NN * NN);
  for (let i = 0; i < NN; i++) {
    const set = new Set([...UNITS[ROW_OF[i]], ...UNITS[N + COL_OF[i]], ...UNITS[2 * N + BOX_OF[i]]]);
    set.delete(i);
    PEERS.push([...set]);
    for (const p of set) IS_PEER[i * NN + p] = 1;
  }
  const sees = (a, b) => IS_PEER[a * NN + b] === 1;
  const digitsOf = (m) => {
    const out = [];
    for (let d = 1; d <= N; d++) if (m & BIT(d)) out.push(d);
    return out;
  };

  // ── Solver por backtracking (MRV + bits) ──
  function countSolutions(grid, limit = 2, out = null, rng = null, budget = Infinity) {
    const g = Int8Array.from(grid);
    const rm = new Int32Array(N), cm = new Int32Array(N), bm = new Int32Array(N);
    for (let i = 0; i < NN; i++) {
      const d = g[i];
      if (!d) continue;
      const b = BIT(d), r = ROW_OF[i], c = COL_OF[i], x = BOX_OF[i];
      if ((rm[r] | cm[c] | bm[x]) & b) return 0;
      rm[r] |= b; cm[c] |= b; bm[x] |= b;
    }
    const empties = [];
    for (let i = 0; i < NN; i++) if (!g[i]) empties.push(i);
    const n = empties.length;
    let count = 0, nodes = 0, aborted = false;

    function rec(k) {
      if (k === n) {
        count++;
        if (out && count === 1) for (let i = 0; i < NN; i++) out[i] = g[i];
        return count >= limit;
      }
      if (++nodes > budget) { aborted = true; return true; }
      let bi = -1, bMask = 0, bCnt = 99;
      for (let j = k; j < n; j++) {
        const i = empties[j];
        const m = ALL & ~(rm[ROW_OF[i]] | cm[COL_OF[i]] | bm[BOX_OF[i]]);
        const p = POP[m];
        if (p < bCnt) { bCnt = p; bMask = m; bi = j; if (p <= 1) break; }
      }
      if (bCnt === 0) return false;
      const tmp = empties[k]; empties[k] = empties[bi]; empties[bi] = tmp;
      const i = empties[k], r = ROW_OF[i], c = COL_OF[i], x = BOX_OF[i];
      const bits = [];
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
    return aborted ? -1 : count;
  }

  function solve(grid) {
    const out = new Array(NN).fill(0);
    return countSolutions(grid, 1, out) === 1 ? out : null;
  }

  function randomSolution(rng) {
    for (;;) {
      const out = new Array(NN).fill(0);
      if (countSolutions(new Array(NN).fill(0), 1, out, rng, 200000) === 1) return out;
    }
  }

  // Puzzle mínimo con simetría rotacional y solución única
  function generate(rng) {
    const sol = randomSolution(rng);
    const p = sol.slice();
    const half = Math.ceil(NN / 2);
    const cells = shuffle(Array.from({ length: half }, (_, i) => i), rng);
    for (const i of cells) {
      const j = NN - 1 - i;
      const a = p[i], b = p[j];
      p[i] = 0; p[j] = 0;
      if (countSolutions(p, 2, null, null, 400000) !== 1) { p[i] = a; p[j] = b; }
    }
    return { puzzle: p, solution: sol };
  }

  // ── Tablero lógico con candidatos ──
  class Board {
    constructor(values) {
      this.v = new Int8Array(NN);
      this.c = new Int32Array(NN).fill(ALL);
      if (values) for (let i = 0; i < NN; i++) if (values[i]) this.place(i, values[i]);
    }
    clone() {
      const b = new Board(null);
      b.v.set(this.v); b.c.set(this.c);
      return b;
    }
    place(i, d) {
      this.v[i] = d; this.c[i] = 0;
      const nb = ~BIT(d), P = PEERS[i];
      for (let k = 0; k < P.length; k++) this.c[P[k]] &= nb;
    }
    solved() {
      for (let i = 0; i < NN; i++) if (!this.v[i]) return false;
      return true;
    }
    contradiction() {
      for (let i = 0; i < NN; i++) if (!this.v[i] && !this.c[i]) return true;
      for (let u = 0; u < 3 * N; u++) {
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

  // ── Técnicas ──
  function hiddenSingle(B) {
    for (const u of UNIT_ORDER) {
      const cells = UNITS[u];
      for (let d = 1; d <= N; d++) {
        const b = BIT(d);
        let pos = -1, n = 0;
        for (let k = 0; k < N; k++) if (B.c[cells[k]] & b) { n++; pos = cells[k]; if (n > 1) break; }
        if (n === 1) return { t: 'hiddenSingle', place: [pos, d], elim: [], cells: [pos], unit: u, digits: b };
      }
    }
    return null;
  }

  function nakedSingle(B) {
    for (let i = 0; i < NN; i++) {
      if (!B.v[i] && POP[B.c[i]] === 1) return { t: 'nakedSingle', place: [i, DIGIT_OF[B.c[i]]], elim: [], cells: [i], unit: null, digits: B.c[i] };
    }
    return null;
  }

  function pointing(B) {
    for (let bx = 0; bx < N; bx++) {
      const cells = UNITS[2 * N + bx];
      for (let d = 1; d <= N; d++) {
        const b = BIT(d);
        const list = [];
        let rows = new Set(), cols = new Set();
        for (const i of cells) if (B.c[i] & b) { rows.add(ROW_OF[i]); cols.add(COL_OF[i]); list.push(i); }
        if (list.length < 2) continue;
        for (const [set, base, of] of [[rows, 0, ROW_OF], [cols, N, COL_OF]]) {
          if (set.size !== 1) continue;
          const u = base + of[list[0]];
          const elim = [];
          for (const i of UNITS[u]) if (BOX_OF[i] !== bx && (B.c[i] & b)) elim.push([i, b]);
          if (elim.length) return { t: 'pointing', place: null, elim, cells: list, unit: 2 * N + bx, digits: b };
        }
      }
    }
    return null;
  }

  function claiming(B) {
    for (let u = 0; u < 2 * N; u++) {
      const cells = UNITS[u];
      for (let d = 1; d <= N; d++) {
        const b = BIT(d);
        const boxes = new Set(), list = [];
        for (const i of cells) if (B.c[i] & b) { boxes.add(BOX_OF[i]); list.push(i); }
        if (list.length < 2 || boxes.size !== 1) continue;
        const bx = BOX_OF[list[0]];
        const elim = [];
        for (const i of UNITS[2 * N + bx]) if (!cells.includes(i) && (B.c[i] & b)) elim.push([i, b]);
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
      const pos = new Int32Array(N + 1);
      for (let k = 0; k < N; k++) {
        const m = B.c[cells[k]];
        for (let d = 1; d <= N; d++) if (m & BIT(d)) pos[d] |= 1 << k;
      }
      const ds = [];
      for (let d = 1; d <= N; d++) if (POP[pos[d]] >= 2 && POP[pos[d]] <= n) ds.push(d);
      if (ds.length < n) continue;
      let found = null;
      combos(ds, n, (combo) => {
        let union = 0, dm = 0;
        for (const d of combo) { union |= pos[d]; dm |= BIT(d); }
        if (POP[union] !== n) return false;
        const elim = [], inv = [];
        for (let k = 0; k < N; k++) {
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
    for (let d = 1; d <= N; d++) {
      const b = BIT(d);
      for (let orient = 0; orient < 2; orient++) {
        const at = (L, k) => (orient === 0 ? L * N + k : k * N + L);
        const lines = [];
        for (let L = 0; L < N; L++) {
          let mask = 0;
          for (let k = 0; k < N; k++) if (B.c[at(L, k)] & b) mask |= 1 << k;
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
          for (let k = 0; k < N; k++) {
            if (!(cover & (1 << k))) continue;
            for (let L = 0; L < N; L++) {
              if (base.has(L)) continue;
              const i = at(L, k);
              if (B.c[i] & b) elim.push([i, b]);
            }
          }
          if (!elim.length) return false;
          const cells = [];
          for (const [L, m] of combo) for (let k = 0; k < N; k++) if (m & (1 << k)) cells.push(at(L, k));
          found = { t, place: null, elim, cells, unit: null, digits: b };
          return true;
        });
        if (found) return found;
      }
    }
    return null;
  }

  function xyWing(B) {
    for (let p = 0; p < NN; p++) {
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
          for (let i = 0; i < NN; i++) {
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
    for (let p = 0; p < NN; p++) {
      const cp = B.c[p];
      if (B.v[p] || POP[cp] !== 3) continue;
      const wings = PEERS[p].filter((i) => POP[B.c[i]] === 2 && (B.c[i] & ~cp) === 0);
      for (let x = 0; x < wings.length; x++) {
        for (let y = x + 1; y < wings.length; y++) {
          const a = wings[x], bb = wings[y];
          if (B.c[a] === B.c[bb] || (B.c[a] | B.c[bb]) !== cp) continue;
          const z = B.c[a] & B.c[bb];
          const elim = [];
          for (let i = 0; i < NN; i++) {
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
    for (let guard = 0; guard < 4 * NN; guard++) {
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
      for (let i = 0; i < NN; i++) {
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

  function nextStep(B, allowDeep = true) {
    for (const f of LOGIC) {
      const s = f(B);
      if (s) return s;
    }
    return forcing(B, false) || (allowDeep ? forcing(B, true) : null);
  }

  // Califica un puzzle: técnica más difícil necesaria y nº de pasos avanzados
  function rate(puzzle, { allowDeep = true } = {}) {
    const B = new Board(puzzle);
    let max = 0, hardest = 'hiddenSingle', adv = 0, steps = 0;
    const used = {};
    while (!B.solved()) {
      const s = nextStep(B, allowDeep);
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
  function hint(values, solution) {
    const B = new Board(values);
    let first = null, hardest = null, hr = 0;
    for (let guard = 0; guard < 4 * NN && !B.solved(); guard++) {
      const s = nextStep(B, true);
      if (!s) break;
      if (s.place) {
        return { cell: s.place[0], digit: s.place[1], tech: hardest || s.t, step: first || s, direct: !first };
      }
      if (!first) first = s;
      if (TECH[s.t].r > hr) { hr = TECH[s.t].r; hardest = s.t; }
      applyStep(B, s);
    }
    let best = -1, bc = 99;
    for (let i = 0; i < NN; i++) if (!values[i] && POP[B.c[i]] < bc) { bc = POP[B.c[i]]; best = i; }
    if (best < 0) return null;
    return { cell: best, digit: solution[best], tech: 'unsolved', step: null, direct: false };
  }

  function candidates(values) {
    return Array.from(new Board(values).c);
  }

  // Permutaciones que conservan reglas y dificultad
  function transform(puzzle, solution, rng) {
    const digits = shuffle(Array.from({ length: N }, (_, i) => i + 1), rng);
    const order = (group, count) => {
      const out = [];
      for (const g of shuffle(Array.from({ length: count }, (_, i) => i), rng)) {
        for (const k of shuffle(Array.from({ length: group }, (_, i) => i), rng)) out.push(g * group + k);
      }
      return out;
    };
    const rows = order(BR, N / BR), cols = order(BC, N / BC);
    const tr = BR === BC && rng() < 0.5;
    const map = (g) => {
      const out = new Array(NN);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const src = tr ? cols[c] * N + rows[r] : rows[r] * N + cols[c];
        const v = g[src];
        out[r * N + c] = v ? digits[v - 1] : 0;
      }
      return out;
    };
    return { puzzle: map(puzzle), solution: map(solution) };
  }

  return {
    N, NN, BR, BC, ALL, ROW_OF, COL_OF, BOX_OF, UNITS, PEERS, digitsOf,
    countSolutions, solve, randomSolution, generate, rate, hint, candidates, transform,
  };
}

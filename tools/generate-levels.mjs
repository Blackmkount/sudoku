// Genera el banco de niveles.
//   node tools/generate-levels.mjs                  → todas las categorías
//   node tools/generate-levels.mjs --only diabolico → solo una (conserva las demás)
//   --seed N para cambiar la semilla
// Cada nivel tiene solución única y se califica resolviéndolo con técnicas humanas.
import { writeFileSync } from 'node:fs';
import * as M from '../js/engine.js';

const PER_TIER = 50;
const TIME_LIMIT = 8 * 60 * 1000;

const TIERS = [
  { id: 'dificil', name: 'Difícil', desc: 'Pares y tríos ocultos desde el nivel 1', size: 9, min: 2.5, max: 3.2, maxClues: 27, pool: 400 },
  { id: 'experto', name: 'Experto', desc: 'X-Wing, Swordfish y cuartetos', size: 9, min: 3.4, max: 4.0, maxClues: 27, pool: 400 },
  { id: 'maestro', name: 'Maestro', desc: 'XY-Wing y XYZ-Wing', size: 9, min: 4.2, max: 4.6, maxClues: 26, pool: 400 },
  // Diabólico: 12×12 con números del 1 al 12, siempre exige cadenas forzadas.
  // Se genera un banco amplio y se quedan solo los más duros.
  { id: 'diabolico', name: 'Diabólico', desc: 'Tablero 12×12 con números del 1 al 12 y cadenas forzadas', size: 12, min: 5.0, max: 5.5, maxClues: 54, pool: 1500, keepTop: 0.15 },
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const seed = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 20261117;

function score(t, r, clues) {
  const forcing = (r.used.forcing || 0) + (r.used.forcingDeep || 0) * 3;
  if (t.size === 12) return r.rating * 100 + forcing * 12 + Math.min(r.adv, 60) * 2 + (t.maxClues - clues) * 6;
  return r.rating * 100 + Math.min(r.adv, 40) * 3 + (28 - clues) * 4 + forcing * 6;
}

function buildTier(t, rng) {
  const E = M.getEngine(t.size);
  const pool = [];
  const seen = new Set();
  const start = Date.now();
  let generated = 0;
  while (Date.now() - start < TIME_LIMIT && pool.length < t.pool) {
    const { puzzle, solution } = E.generate(rng);
    generated++;
    const clues = puzzle.filter(Boolean).length;
    const key = M.toStr(puzzle);
    if (clues > t.maxClues || seen.has(key)) continue;
    seen.add(key);
    const r = E.rate(puzzle);
    if (!r.solved || r.rating < t.min || r.rating > t.max) continue;
    if (M.toStr(r.values) !== M.toStr(solution)) throw new Error('El calificador produjo una solución incorrecta');
    pool.push({ p: key, s: M.toStr(solution), t: r.hardest, score: score(t, r, clues), clues, forcing: (r.used.forcing || 0) + (r.used.forcingDeep || 0) });
    if (pool.length % 100 === 0) console.log(`  ${t.id}: ${pool.length} candidatos (${generated} generados, ${((Date.now() - start) / 1000).toFixed(0)}s)`);
  }
  pool.sort((a, b) => a.score - b.score);
  // Recorte: las categorías normales saltan el 25 % más fácil; Diabólico se queda solo con la cima.
  const from = t.keepTop ? Math.floor(pool.length * (1 - t.keepTop)) : Math.floor(pool.length * 0.25);
  const band = pool.slice(Math.min(from, Math.max(0, pool.length - PER_TIER)));
  const n = Math.min(PER_TIER, band.length);
  const picked = [];
  for (let k = 0; k < n; k++) picked.push(band[Math.round((n === 1 ? 1 : k / (n - 1)) * (band.length - 1))]);
  const uniq = [...new Map(picked.map((l) => [l.p, l])).values()];
  for (const l of band.slice().reverse()) { if (uniq.length >= n) break; if (!uniq.includes(l)) uniq.push(l); }
  uniq.sort((a, b) => a.score - b.score);
  console.log(`${t.name}: ${uniq.length} niveles de ${pool.length} candidatos · pistas ${Math.min(...uniq.map((l) => l.clues))}-${Math.max(...uniq.map((l) => l.clues))}` +
    (t.size === 12 ? ` · cadenas forzadas por tablero ${Math.min(...uniq.map((l) => l.forcing))}-${Math.max(...uniq.map((l) => l.forcing))}` : ''));
  return { id: t.id, name: t.name, desc: t.desc, size: t.size, levels: uniq.map((l) => `${l.p}${l.s}${l.t}`) };
}

let existing = [];
if (only) existing = (await import('../js/levels.js')).TIERS;

const rng = M.mulberry32(seed);
const out = TIERS.map((t) => {
  if (only && t.id !== only) {
    const prev = existing.find((x) => x.id === t.id);
    return { id: t.id, name: t.name, desc: t.desc, size: t.size, levels: prev.levels };
  }
  return buildTier(t, rng);
});

const file = `// Generado por tools/generate-levels.mjs (semilla ${seed}). No editar a mano.
// Formato de cada nivel: N² caracteres de puzzle + N² de solución + técnica clave.
// Valores: 1-9 y A=10, B=11, C=12; "." es una casilla vacía.
export const TIERS = ${JSON.stringify(out, null, 1)};
`;
writeFileSync(new URL('../js/levels.js', import.meta.url), file);
console.log('Escrito js/levels.js');

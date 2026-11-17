// Genera el banco de niveles: node tools/generate-levels.mjs [semilla]
// Cada nivel tiene solución única y se califica resolviéndolo con técnicas humanas.
import { writeFileSync } from 'node:fs';
import * as E from '../js/engine.js';

const PER_TIER = 50;
const POOL = 400;
const TIME_LIMIT = 6 * 60 * 1000;

const TIERS = [
  { id: 'dificil', name: 'Difícil', desc: 'Pares y tríos ocultos desde el nivel 1', min: 2.5, max: 3.2, maxClues: 27 },
  { id: 'experto', name: 'Experto', desc: 'X-Wing, Swordfish y cuartetos', min: 3.4, max: 4.0, maxClues: 27 },
  { id: 'maestro', name: 'Maestro', desc: 'XY-Wing y XYZ-Wing', min: 4.2, max: 4.6, maxClues: 26 },
  { id: 'diabolico', name: 'Diabólico', desc: 'Requiere cadenas forzadas', min: 5.0, max: 5.5, maxClues: 25 },
];

const seed = Number(process.argv[2] || 20261117);
const rng = E.mulberry32(seed);
const pools = TIERS.map(() => []);
const seen = new Set();
const start = Date.now();
let generated = 0;

while (Date.now() - start < TIME_LIMIT && pools.some((p) => p.length < POOL)) {
  const { puzzle, solution } = E.generate(rng);
  generated++;
  const clues = puzzle.filter(Boolean).length;
  const key = E.toStr(puzzle);
  if (seen.has(key)) continue;
  seen.add(key);
  const r = E.rate(puzzle);
  if (!r.solved) continue;
  if (r.values.join('') !== solution.join('')) throw new Error('El calificador produjo una solución incorrecta');
  const ti = TIERS.findIndex((t) => r.rating >= t.min && r.rating <= t.max && clues <= t.maxClues);
  if (ti < 0 || pools[ti].length >= POOL) continue;
  const forcingSteps = (r.used.forcing || 0) + (r.used.forcingDeep || 0) * 2;
  const score = r.rating * 100 + Math.min(r.adv, 40) * 3 + (28 - clues) * 4 + forcingSteps * 6;
  pools[ti].push({ p: key, s: solution.join(''), t: r.hardest, score, clues, adv: r.adv });
  if (generated % 2000 === 0) {
    console.log(`${generated} generados · ${((Date.now() - start) / 1000).toFixed(0)}s · ` + pools.map((p, i) => `${TIERS[i].id}:${p.length}`).join(' '));
  }
}

console.log(`Total generados: ${generated}`);
const out = TIERS.map((t, i) => {
  const pool = pools[i].sort((a, b) => a.score - b.score);
  if (pool.length < PER_TIER) console.warn(`⚠ ${t.id}: solo ${pool.length} candidatos`);
  // Muestreo uniforme sobre la curva de dificultad, sesgado hacia la mitad alta
  const n = Math.min(PER_TIER, pool.length);
  const picked = [];
  for (let k = 0; k < n; k++) {
    const x = n === 1 ? 1 : k / (n - 1);
    const idx = Math.round((0.25 + 0.75 * x) * (pool.length - 1));
    picked.push(pool[idx]);
  }
  const uniq = [...new Map(picked.map((l) => [l.p, l])).values()];
  for (const l of pool) { if (uniq.length >= n) break; if (!uniq.includes(l)) uniq.push(l); }
  uniq.sort((a, b) => a.score - b.score);
  console.log(`${t.name}: ${uniq.length} niveles · pistas ${Math.min(...uniq.map((l) => l.clues))}-${Math.max(...uniq.map((l) => l.clues))}`);
  return { id: t.id, name: t.name, desc: t.desc, levels: uniq.map((l) => `${l.p}${l.s}${l.t}`) };
});

const file = `// Generado por tools/generate-levels.mjs (semilla ${seed}). No editar a mano.
// Formato de cada nivel: 81 caracteres de puzzle + 81 de solución + técnica clave.
export const TIERS = ${JSON.stringify(out, null, 1)};
`;
writeFileSync(new URL('../js/levels.js', import.meta.url), file);
console.log('Escrito js/levels.js');

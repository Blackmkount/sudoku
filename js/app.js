import * as E from './engine.js';
import { TIERS } from './levels.js';

const $ = (id) => document.getElementById(id);
const KEY = 'azulejo.v1';
const HISTORY_MAX = 80;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const list = (ds) => (ds.length < 2 ? `${ds[0]}` : `${ds.slice(0, -1).join(', ')} y ${ds[ds.length - 1]}`);
// Explicaciones breves para cada técnica (d: dígito, ds: lista de dígitos)
const TECH_HELP = {
  pointing: (d) => `En esa caja, el ${d} solo puede ir en una línea: quítalo del resto de la línea.`,
  claiming: (d) => `En esa línea, el ${d} solo cae dentro de una caja: quítalo del resto de la caja.`,
  nakedPair: (d, ds) => `Las celdas doradas solo admiten ${list(ds)}: esos números salen del resto de la unidad.`,
  hiddenPair: (d, ds) => `Los números ${list(ds)} solo caben en las celdas doradas: borra sus otros candidatos.`,
  nakedTriple: (d, ds) => `Las tres celdas doradas solo admiten ${list(ds)}: salen del resto de la unidad.`,
  hiddenTriple: (d, ds) => `Los números ${list(ds)} solo caben en las tres celdas doradas: borra sus otros candidatos.`,
  nakedQuad: (d, ds) => `Las cuatro celdas doradas solo admiten ${list(ds)}: salen del resto de la unidad.`,
  hiddenQuad: (d, ds) => `Los números ${list(ds)} solo caben en las cuatro celdas doradas: borra sus otros candidatos.`,
  xWing: (d) => `El ${d} forma un rectángulo en las celdas doradas: quítalo del resto de esas filas o columnas.`,
  swordfish: (d) => `El ${d} queda atrapado en tres líneas (celdas doradas): quítalo del resto de las líneas que cruzan.`,
  jellyfish: (d) => `El ${d} queda atrapado en cuatro líneas (celdas doradas): quítalo del resto de las líneas que cruzan.`,
  xyWing: (d) => `Pivote y pinzas en dorado: el ${d} sale de toda celda que vea a las dos pinzas.`,
  xyzWing: (d) => `El ${d} sale de toda celda que vea a las tres celdas doradas.`,
  forcing: (d) => `Si pones el ${d} en la celda dorada, llegas a una contradicción: descártalo.`,
  forcingDeep: (d) => `Poner el ${d} en la celda dorada acaba, tras varias deducciones, en contradicción: descártalo.`,
};

// ── Estado persistente ─────────────────────────────────────
function defaults() {
  return {
    settings: { showErrors: true, errorLimit: false, sameHighlight: true, autoNotes: true, showTimer: true, theme: 'auto' },
    progress: {},
    daily: {},
    stats: { solved: 0, time: 0 },
    lastTier: TIERS[0].id,
    tipDismissed: false,
    game: null,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw), d = defaults();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, stats: { ...d.stats, ...(s.stats || {}) } };
    }
  } catch (_) { /* almacenamiento no disponible */ }
  return defaults();
}
let S = load();
let G = S.game;
function persist() {
  S.game = G;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* modo privado */ }
}

// ── Utilidades ─────────────────────────────────────────────
const tierById = Object.fromEntries(TIERS.map((t, i) => [t.id, { ...t, i }]));
const prog = (id) => (S.progress[id] ||= { done: {} });
const doneCount = (id) => Object.keys(prog(id).done).length;
function levelData(id, idx) {
  const L = tierById[id].levels[idx];
  return { puzzle: L.slice(0, 81), solution: L.slice(81, 162), tech: L.slice(162) };
}
function nextIndex(id) {
  const d = prog(id).done, n = tierById[id].levels.length;
  for (let i = 0; i < n; i++) if (!(i in d)) return i;
  return n - 1;
}
const unlocked = (id, i) => i === 0 || (i - 1) in prog(id).done || i in prog(id).done;
const fmt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
const unitName = (u) => (u < 9 ? `la fila ${u + 1}` : u < 18 ? `la columna ${u - 8}` : `la caja ${u - 17}`);
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'long' });
};
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function setAppHeight() {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
  fitBoard();
}
// El tablero ocupa todo el espacio que dejan la cabecera y los controles
function fitBoard() {
  const g = document.getElementById('game');
  if (!g || !g.classList.contains('is-active')) return;
  const cs = getComputedStyle(g);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const used = g.querySelector('.game-bar').offsetHeight + g.querySelector('.status').offsetHeight + 8
    + g.querySelector('.controls').offsetHeight + 8;
  const size = Math.floor(Math.min(window.innerWidth - padX, window.innerHeight - padY - used, 560));
  g.style.setProperty('--board', `${Math.max(size, 240)}px`);
}
addEventListener('resize', setAppHeight);
addEventListener('orientationchange', () => setTimeout(setAppHeight, 300));

// ── Tema ───────────────────────────────────────────────────
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  requestAnimationFrame(() => {
    $('themeColor').setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ── Pantallas ──────────────────────────────────────────────
let screen = 'home';
function show(id) {
  screen = id;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
  if (id === 'home') renderHome();
  if (id === 'game') { render(); fitBoard(); }
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));

// ── Inicio ─────────────────────────────────────────────────
function renderTile(el, puzzle, values) {
  el.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const s = document.createElement('span');
    const given = puzzle[i] !== '.';
    const v = given ? puzzle[i] : values && values[i] ? values[i] : '';
    s.textContent = v;
    if (!given && v) s.className = 'u';
    el.appendChild(s);
  }
}
function inProgress() { return G && !G.done && !G.failed; }
function gameLabel(g) {
  if (g.mode === 'daily') return `Desafío del ${dateLabel(g.date)}`;
  if (g.mode === 'quick') return 'Partida rápida';
  return `Nivel ${g.index + 1} de ${tierById[g.tier].levels.length}`;
}
function renderHome() {
  if (inProgress()) {
    renderTile($('heroTile'), G.puzzle, G.values);
    $('heroTier').textContent = tierById[G.tier].name;
    $('heroLevel').textContent = gameLabel(G);
    $('heroNote').textContent = `Llevas ${fmt(G.time)}`;
    $('playBtn').textContent = 'Continuar';
  } else {
    const id = S.lastTier in tierById ? S.lastTier : TIERS[0].id;
    const idx = nextIndex(id);
    renderTile($('heroTile'), levelData(id, idx).puzzle);
    $('heroTier').textContent = tierById[id].name;
    $('heroLevel').textContent = `Nivel ${idx + 1} de ${tierById[id].levels.length}`;
    $('heroNote').textContent = tierById[id].desc;
    $('playBtn').textContent = 'Jugar';
  }

  const list = $('tierList');
  list.innerHTML = '';
  for (const t of TIERS) {
    const n = doneCount(t.id), total = t.levels.length;
    const li = document.createElement('li');
    li.innerHTML = `<button class="tier-row">
      <span class="tier-name">${t.name}</span>
      <span class="tier-count">${n} de ${total}</span>
      <span class="tier-desc">${t.desc}</span>
      <span class="tier-bar"><i style="width:${(n / total) * 100}%"></i></span>
    </button>`;
    li.firstElementChild.addEventListener('click', () => openLevels(t.id));
    list.appendChild(li);
  }

  const k = todayKey();
  const daily = $('dailyBtn');
  if (S.daily[k] != null) {
    daily.classList.add('is-done');
    $('dailySub').textContent = `Resuelto hoy en ${fmt(S.daily[k])}. Vuelve mañana por otro.`;
  } else {
    daily.classList.remove('is-done');
    const st = streak();
    $('dailySub').textContent = st ? `Racha de ${st} ${st === 1 ? 'día' : 'días'}. No la pierdas.` : 'Un Maestro o Diabólico nuevo cada día';
  }
  $('statsSub').textContent = S.stats.solved
    ? `${S.stats.solved} ${S.stats.solved === 1 ? 'tablero resuelto' : 'tableros resueltos'}`
    : 'Tus tiempos y tu racha diaria';

  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  $('installTip').hidden = !(isIOS && !standalone && !S.tipDismissed);
}
$('installClose').addEventListener('click', () => { S.tipDismissed = true; persist(); $('installTip').hidden = true; });
$('playBtn').addEventListener('click', () => {
  if (inProgress()) return openGame();
  const id = S.lastTier in tierById ? S.lastTier : TIERS[0].id;
  startLevel(id, nextIndex(id));
});

function streak() {
  let n = 0;
  const d = new Date();
  if (S.daily[todayKey(d)] == null) d.setDate(d.getDate() - 1);
  while (S.daily[todayKey(d)] != null) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ── Niveles ────────────────────────────────────────────────
function openLevels(id) {
  const t = tierById[id];
  $('levelsTitle').textContent = t.name;
  $('levelsCount').textContent = `${doneCount(id)} de ${t.levels.length}`;
  $('levelsDesc').textContent = t.desc;
  const grid = $('levelGrid');
  grid.innerHTML = '';
  const done = prog(id).done;
  const cur = nextIndex(id);
  t.levels.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'lvl';
    if (i in done) {
      b.classList.add('done');
      b.innerHTML = `${i + 1}<small>${fmt(done[i])}</small>`;
      b.setAttribute('aria-label', `Nivel ${i + 1}, resuelto en ${fmt(done[i])}`);
    } else if (unlocked(id, i)) {
      if (i === cur) b.classList.add('current');
      b.textContent = i + 1;
      b.setAttribute('aria-label', `Nivel ${i + 1}`);
    } else {
      b.classList.add('locked');
      b.disabled = true;
      b.textContent = i + 1;
      b.setAttribute('aria-label', `Nivel ${i + 1}, bloqueado`);
    }
    b.addEventListener('click', () => startLevel(id, i));
    grid.appendChild(b);
  });
  show('levels');
  const curEl = grid.children[cur];
  if (curEl && cur > 14) curEl.scrollIntoView({ block: 'center' });
}

// ── Crear partidas ─────────────────────────────────────────
function newGame(o) {
  return {
    mode: o.mode, tier: o.tier, index: o.index ?? null, date: o.date ?? null,
    puzzle: o.puzzle, solution: o.solution, tech: o.tech,
    values: [...o.puzzle].map((ch) => (ch === '.' ? 0 : +ch)),
    notes: new Array(81).fill(0),
    time: 0, errors: 0, hints: 0, done: false, failed: false, history: [],
  };
}
const sameGame = (o) => G && G.mode === o.mode && G.tier === o.tier && G.index === (o.index ?? null) && G.date === (o.date ?? null);
async function replaceGame(o) {
  if (inProgress() && sameGame(o)) return openGame();
  if (inProgress() && (G.time > 20 || G.history.length)) {
    const ok = await confirmBox({
      title: '¿Dejar la partida actual?',
      text: `Tienes ${G.mode === 'level' ? `el nivel ${G.index + 1} de ${tierById[G.tier].name}` : 'una partida'} a medias. Si empiezas otra, se perderá.`,
      yes: 'Empezar otra', no: 'Cancelar',
    });
    if (!ok) return;
  }
  G = newGame(o);
  if (o.mode === 'level') S.lastTier = o.tier;
  persist();
  openGame();
}
function startLevel(id, idx) {
  if (!unlocked(id, idx)) return;
  replaceGame({ mode: 'level', tier: id, index: idx, ...levelData(id, idx) });
}
function dailyData(key) {
  const pool = [...TIERS[2].levels.map((l) => [TIERS[2].id, l]), ...TIERS[3].levels.map((l) => [TIERS[3].id, l])];
  const seed = E.hashString(`azulejo-${key}`);
  const [tier, L] = pool[seed % pool.length];
  const t = E.transform(E.fromStr(L.slice(0, 81)), E.fromStr(L.slice(81, 162)), E.mulberry32(seed));
  return { mode: 'daily', tier, date: key, puzzle: E.toStr(t.puzzle), solution: t.solution.join(''), tech: L.slice(162) };
}
$('dailyBtn').addEventListener('click', () => {
  const k = todayKey();
  if (S.daily[k] != null && !(inProgress() && G.mode === 'daily' && G.date === k)) {
    toast(`Ya resolviste el desafío de hoy en ${fmt(S.daily[k])}.`);
    return;
  }
  replaceGame(dailyData(k));
});
function quickData(id) {
  const t = tierById[id];
  const L = t.levels[Math.floor(Math.random() * t.levels.length)];
  const tr = E.transform(E.fromStr(L.slice(0, 81)), E.fromStr(L.slice(81, 162)), E.mulberry32((Math.random() * 2 ** 32) >>> 0));
  return { mode: 'quick', tier: id, date: String(Date.now()), puzzle: E.toStr(tr.puzzle), solution: tr.solution.join(''), tech: L.slice(162) };
}
$('quickBtn').addEventListener('click', () => {
  const list = $('quickList');
  list.innerHTML = '';
  for (const t of TIERS) {
    const b = document.createElement('button');
    b.className = 'menu-item';
    b.innerHTML = `<span class="q-name">${t.name}</span><small>${t.desc}</small>`;
    b.addEventListener('click', () => { $('quickDialog').close(); replaceGame(quickData(t.id)); });
    list.appendChild(b);
  }
  $('quickDialog').showModal();
});

// ── Tablero ────────────────────────────────────────────────
const boardEl = $('board');
const cells = new Array(81);
for (let b = 0; b < 9; b++) {
  const box = document.createElement('div');
  box.className = 'box';
  for (const i of E.UNITS[18 + b]) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.i = i;
    c.setAttribute('role', 'gridcell');
    c.innerHTML = `<span class="v"></span><div class="n">${'<i></i>'.repeat(9)}</div>`;
    [...c.querySelectorAll('.n i')].forEach((el, k) => { el.textContent = k + 1; });
    c.style.setProperty('--d', `${(E.ROW_OF[i] + E.COL_OF[i]) * 34}ms`);
    cells[i] = c;
    box.appendChild(c);
  }
  boardEl.appendChild(box);
}
boardEl.addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.cell');
  if (!c) return;
  e.preventDefault();
  select(+c.dataset.i);
});

const pad = $('pad');
const keys = [];
for (let d = 1; d <= 9; d++) {
  const k = document.createElement('button');
  k.className = 'key';
  k.innerHTML = `${d}<small></small>`;
  k.setAttribute('aria-label', `Número ${d}`);
  k.addEventListener('click', () => inputDigit(d));
  keys.push(k);
  pad.appendChild(k);
}

let sel = -1;
let notesMode = false;
let hintState = null;
let paused = false;

const isGiven = (i) => G.puzzle[i] !== '.';
const solAt = (i) => +G.solution[i];

function render() {
  if (!G) return;
  const s = S.settings;
  const sv = sel >= 0 ? G.values[sel] : 0;
  const sr = sel >= 0 ? E.ROW_OF[sel] : -1, sc = sel >= 0 ? E.COL_OF[sel] : -1, sb = sel >= 0 ? E.BOX_OF[sel] : -1;
  const zone = hintState ? new Set(hintState.zone) : null;
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = G.values[i];
    counts[v]++;
    let cls = 'cell';
    if (isGiven(i)) cls += ' given';
    else if (v) cls += ' user';
    if (v && !isGiven(i) && s.showErrors && v !== solAt(i)) cls += ' err';
    if (i === sel) cls += ' sel';
    else if (sel >= 0 && (E.ROW_OF[i] === sr || E.COL_OF[i] === sc || E.BOX_OF[i] === sb)) cls += ' peer';
    if (s.sameHighlight && sv && v === sv && i !== sel) cls += ' same';
    if (zone && zone.has(i)) cls += ' hint-zone';
    if (hintState && hintState.cell === i) cls += ' hint-target';
    const c = cells[i];
    c.className = cls;
    c.firstChild.textContent = v || '';
    const nm = v ? 0 : G.notes[i];
    const ns = c.lastChild.children;
    for (let d = 1; d <= 9; d++) {
      const on = (nm >> (d - 1)) & 1;
      ns[d - 1].className = on ? (s.sameHighlight && sv === d ? 'on hl' : 'on') : '';
    }
    c.setAttribute('aria-label', `Fila ${E.ROW_OF[i] + 1}, columna ${E.COL_OF[i] + 1}: ${v || 'vacía'}`);
  }
  keys.forEach((k, idx) => {
    const left = 9 - counts[idx + 1];
    k.lastChild.textContent = left > 0 ? left : '';
    k.classList.toggle('spent', left <= 0);
  });
  pad.classList.toggle('notes', notesMode);
  $('notesBtn').setAttribute('aria-pressed', String(notesMode));
  $('notesFlag').textContent = notesMode ? 'Sí' : 'No';
  $('undoBtn').disabled = !G.history.length || G.done;
  $('hintLabel').textContent = hintState ? 'Revelar' : 'Pista';
  $('hintBtn').classList.toggle('armed', !!hintState);
  $('errCount').textContent = s.errorLimit ? `${G.errors} de 3` : G.errors;
  $('errWrap').hidden = !s.showErrors;
  $('errWrap').classList.toggle('bad', G.errors > 0);
  $('hintCount').textContent = G.hints;
  $('timerBtn').classList.toggle('hidden-time', !s.showTimer);
  updateTimer();
}
function updateTimer() { if (G) $('timer').textContent = fmt(G.time); }

function flash(i, cls) {
  const c = cells[i];
  c.classList.remove(cls);
  void c.offsetWidth;
  c.classList.add(cls);
  setTimeout(() => c.classList.remove(cls), 360);
}

function openGame() {
  sel = -1; notesMode = false; hintState = null; paused = false;
  $('hintCard').hidden = true;
  boardEl.classList.remove('paused');
  $('gTier').textContent = tierById[G.tier].name;
  $('gLevel').textContent = gameLabel(G);
  show('game');
  if (G.failed) setTimeout(lose, 250);
}

function select(i) {
  if (!G || G.done || paused) return;
  sel = i;
  render();
}

function snapshot() {
  G.history.push([G.values.slice(), G.notes.slice()]);
  if (G.history.length > HISTORY_MAX) G.history.shift();
}

function clearPeersNote(i, d) {
  const b = 1 << (d - 1);
  for (const p of E.PEERS[i]) G.notes[p] &= ~b;
}

function inputDigit(d) {
  if (!G || G.done || G.failed || paused) return;
  if (sel < 0) { toast('Toca una celda primero'); return; }
  if (isGiven(sel)) return;
  const i = sel;
  if (notesMode) {
    if (G.values[i]) return;
    snapshot();
    G.notes[i] ^= 1 << (d - 1);
    clearHint();
    render();
    persist();
    return;
  }
  snapshot();
  if (G.values[i] === d) {
    G.values[i] = 0;
  } else {
    G.values[i] = d;
    G.notes[i] = 0;
    const ok = d === solAt(i);
    if (!ok && S.settings.showErrors) G.errors++;
    if (S.settings.autoNotes && (ok || !S.settings.showErrors)) clearPeersNote(i, d);
    clearHint();
    render();
    flash(i, !ok && S.settings.showErrors ? 'shake' : 'pop');
    persist();
    afterPlace();
    return;
  }
  clearHint();
  render();
  persist();
}

function afterPlace() {
  if (S.settings.showErrors && S.settings.errorLimit && G.errors >= 3) { G.failed = true; persist(); lose(); return; }
  if (G.values.every((v, i) => v === solAt(i))) { win(); return; }
  if (G.values.every((v) => v)) toast('El tablero está lleno, pero hay números incorrectos.');
}

$('eraseBtn').addEventListener('click', () => {
  if (!G || G.done || paused || sel < 0 || isGiven(sel)) return;
  if (!G.values[sel] && !G.notes[sel]) return;
  snapshot();
  G.values[sel] = 0;
  G.notes[sel] = 0;
  clearHint();
  render();
  persist();
});
$('undoBtn').addEventListener('click', undo);
function undo() {
  if (!G || G.done || paused || !G.history.length) return;
  const [v, n] = G.history.pop();
  G.values = v;
  G.notes = n;
  clearHint();
  render();
  persist();
}
$('notesBtn').addEventListener('click', () => { notesMode = !notesMode; render(); });

// ── Pistas ─────────────────────────────────────────────────
function clearHint() {
  hintState = null;
  $('hintCard').hidden = true;
}
function showHint(title, text) {
  $('hintTech').textContent = title;
  $('hintText').textContent = text;
  $('hintCard').hidden = false;
}
$('hintClose').addEventListener('click', () => { $('hintCard').hidden = true; });
$('hintReveal').addEventListener('click', () => { if (hintState) reveal(); });
$('hintBtn').addEventListener('click', () => {
  if (!G || G.done || G.failed || paused) return;
  if (hintState) { reveal(); return; }
  const wrong = G.values.findIndex((v, i) => v && !isGiven(i) && v !== solAt(i));
  if (wrong >= 0) {
    sel = wrong;
    hintState = { cell: wrong, zone: [] };
    showHint('Revisa esta celda', 'El número de la celda marcada no es correcto. Bórralo o toca Revelar para corregirlo.');
    render();
    return;
  }
  const h = E.hint(G.values.slice(), [...G.solution].map(Number));
  if (!h) return;
  let zone = [], title, text;
  if (h.tech === 'unsolved') {
    title = 'Deducción profunda';
    text = 'Este punto exige una cadena muy larga. Toca Revelar para ver el número de la celda marcada.';
  } else if (h.direct) {
    if (h.step.t === 'hiddenSingle') {
      zone = E.UNITS[h.step.unit].filter((i) => i !== h.cell);
      title = 'Único oculto';
      text = `En ${unitName(h.step.unit)} hay un número que solo cabe en la celda marcada. ¿Cuál es?`;
    } else {
      zone = E.PEERS[h.cell];
      title = 'Único desnudo';
      text = 'Revisa la fila, la columna y la caja de la celda marcada: solo le queda un número posible.';
    }
  } else {
    zone = h.step.cells.filter((i) => i !== h.cell);
    title = E.TECH[h.step.t].name;
    const ds = E.digitsOf(h.step.digits);
    text = TECH_HELP[h.step.t] ? TECH_HELP[h.step.t](ds[0], ds) : '';
    if (h.tech !== h.step.t) text += ` Después necesitarás ${E.TECH[h.tech].name}.`;
  }
  sel = h.cell;
  hintState = { cell: h.cell, zone };
  showHint(title, text);
  render();
});
function reveal() {
  const i = hintState.cell, d = solAt(i);
  snapshot();
  G.values[i] = d;
  G.notes[i] = 0;
  G.hints++;
  if (S.settings.autoNotes) clearPeersNote(i, d);
  clearHint();
  sel = i;
  render();
  flash(i, 'pop');
  persist();
  afterPlace();
}

// ── Reloj y pausa ──────────────────────────────────────────
setInterval(() => {
  if (screen === 'game' && G && !G.done && !G.failed && !paused && document.visibilityState === 'visible') {
    G.time++;
    updateTimer();
    if (G.time % 5 === 0) persist();
  }
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
addEventListener('pagehide', persist);

$('timerBtn').addEventListener('click', () => {
  if (!G || G.done) return;
  paused = true;
  boardEl.classList.add('paused');
  $('pauseSub').textContent = `Llevas ${fmt(G.time)}. El reloj está detenido.`;
  $('pauseDialog').showModal();
});
$('resumeBtn').addEventListener('click', () => $('pauseDialog').close());
$('pauseDialog').addEventListener('close', () => { paused = false; boardEl.classList.remove('paused'); });

$('exitBtn').addEventListener('click', () => { persist(); show('home'); });

// ── Victoria / derrota ─────────────────────────────────────
function win() {
  G.done = true;
  sel = -1;
  clearHint();
  let record = false;
  if (G.mode === 'level') {
    const d = prog(G.tier).done;
    record = d[G.index] != null && G.time < d[G.index];
    d[G.index] = d[G.index] == null ? G.time : Math.min(d[G.index], G.time);
  }
  if (G.mode === 'daily') S.daily[G.date] = G.time;
  S.stats.solved++;
  S.stats.time += G.time;
  const best = (S.stats.best ||= {});
  if (best[G.tier] == null || G.time < best[G.tier]) best[G.tier] = G.time;
  persist();
  render();
  cells.forEach((c) => c.classList.add('glaze'));
  setTimeout(() => {
    cells.forEach((c) => c.classList.remove('glaze'));
    openWin(record);
  }, reducedMotion ? 80 : 1500);
}
function openWin(record) {
  const t = tierById[G.tier];
  $('winSub').textContent = G.mode === 'level' ? `${t.name}, nivel ${G.index + 1}` : G.mode === 'daily' ? `Desafío del ${dateLabel(G.date)}` : `Partida rápida, ${t.name}`;
  $('winTime').textContent = fmt(G.time);
  $('winErr').textContent = S.settings.showErrors ? G.errors : '—';
  $('winHints').textContent = G.hints;
  const tech = E.TECH[G.tech]?.name;
  $('winNote').innerHTML = (tech ? `Este tablero exigía <b>${tech}</b>.` : '') + (record ? ' Nuevo mejor tiempo.' : '');
  const next = $('winNext');
  next.hidden = false;
  if (G.mode === 'level') {
    const has = G.index + 1 < t.levels.length;
    next.textContent = has ? 'Siguiente nivel' : 'Ver categorías';
  } else if (G.mode === 'quick') {
    next.textContent = 'Otra partida';
  } else {
    next.hidden = true;
  }
  $('winDialog').showModal();
}
$('winNext').addEventListener('click', () => {
  $('winDialog').close();
  if (G.mode === 'level') {
    const t = tierById[G.tier];
    if (G.index + 1 < t.levels.length) startLevel(G.tier, G.index + 1);
    else show('home');
  } else if (G.mode === 'quick') {
    replaceGame(quickData(G.tier));
  }
});
$('winHome').addEventListener('click', () => { $('winDialog').close(); show('home'); });

async function lose() {
  const again = await confirmBox({
    title: 'Tres errores',
    text: 'La partida terminó. Puedes empezar este mismo tablero desde cero.',
    yes: 'Reiniciar tablero', no: 'Volver al inicio',
  });
  if (again) restart();
  else show('home');
}
function restart() {
  const o = { ...G };
  G = newGame(o);
  persist();
  openGame();
}

// ── Menú de partida ────────────────────────────────────────
$('moreBtn').addEventListener('click', () => { if (G && !G.done) $('moreDialog').showModal(); });
$('fillNotesBtn').addEventListener('click', () => {
  $('moreDialog').close();
  snapshot();
  const cand = E.candidates(G.values);
  for (let i = 0; i < 81; i++) if (!G.values[i]) G.notes[i] = cand[i];
  clearHint();
  render();
  persist();
});
$('clearNotesBtn').addEventListener('click', () => {
  $('moreDialog').close();
  snapshot();
  G.notes = new Array(81).fill(0);
  render();
  persist();
});
$('restartBtn').addEventListener('click', async () => {
  $('moreDialog').close();
  const ok = await confirmBox({ title: '¿Reiniciar el tablero?', text: 'Se borrarán tus números, notas y el tiempo de esta partida.', yes: 'Reiniciar', no: 'Cancelar' });
  if (ok) restart();
});
$('settingsFromGame').addEventListener('click', () => { $('moreDialog').close(); openSettings(); });

// ── Ajustes ────────────────────────────────────────────────
function openSettings() {
  document.querySelectorAll('[data-setting]').forEach((inp) => { inp.checked = !!S.settings[inp.dataset.setting]; });
  document.querySelectorAll('[data-theme-opt]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeOpt === S.settings.theme)));
  $('settingsDialog').showModal();
}
$('settingsBtn').addEventListener('click', openSettings);
document.querySelectorAll('[data-setting]').forEach((inp) => inp.addEventListener('change', () => {
  S.settings[inp.dataset.setting] = inp.checked;
  persist();
  render();
}));
document.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => {
  S.settings.theme = b.dataset.themeOpt;
  document.querySelectorAll('[data-theme-opt]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  applyTheme();
  persist();
}));

// ── Estadísticas ───────────────────────────────────────────
$('statsBtn').addEventListener('click', () => {
  const best = S.stats.best || {};
  let html = `<dl class="stat-total">
    <div><dd>${S.stats.solved}</dd><dt>Resueltos</dt></div>
    <div><dd>${fmt(S.stats.time)}</dd><dt>Tiempo total</dt></div>
    <div><dd>${streak()}</dd><dt>Racha diaria</dt></div>
  </dl>`;
  for (const t of TIERS) {
    html += `<div class="stat-row"><span class="s-name">${t.name}</span>
      <span class="s-val"><b>${doneCount(t.id)}</b> de ${t.levels.length}</span>
      <span class="s-val">${best[t.id] != null ? `mejor <b>${fmt(best[t.id])}</b>` : 'sin tiempo'}</span></div>`;
  }
  $('statsBody').innerHTML = html;
  $('statsDialog').showModal();
});

// ── Diálogos genéricos ─────────────────────────────────────
function confirmBox({ title, text, yes = 'Sí', no = 'Cancelar' }) {
  const dlg = $('confirmDialog');
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmYes').textContent = yes;
  $('confirmNo').textContent = no;
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => { if (answered) return; answered = true; dlg.close(); resolve(v); };
    $('confirmYes').onclick = () => done(true);
    $('confirmNo').onclick = () => done(false);
    dlg.oncancel = (e) => { e.preventDefault(); done(false); };
    dlg.showModal();
  });
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
for (const id of ['moreDialog', 'settingsDialog', 'statsDialog', 'quickDialog', 'pauseDialog']) {
  const dlg = $(id);
  dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dlg.close();
  });
}
$('winDialog').addEventListener('cancel', (e) => e.preventDefault());

// ── Teclado (iPad con teclado / escritorio) ────────────────
addEventListener('keydown', (e) => {
  if (screen !== 'game' || document.querySelector('dialog[open]')) return;
  if (e.key >= '1' && e.key <= '9') { inputDigit(+e.key); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { $('eraseBtn').click(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key.toLowerCase() === 'n') { notesMode = !notesMode; render(); return; }
  const mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (mv) {
    e.preventDefault();
    if (sel < 0) { select(40); return; }
    const r = E.ROW_OF[sel], c = E.COL_OF[sel];
    const nr = (r + (mv === 9 ? 1 : mv === -9 ? -1 : 0) + 9) % 9, nc = (c + (mv === 1 ? 1 : mv === -1 ? -1 : 0) + 9) % 9;
    select(nr * 9 + nc);
  }
});

// ── Arranque ───────────────────────────────────────────────
setAppHeight();
applyTheme();
show('home');
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

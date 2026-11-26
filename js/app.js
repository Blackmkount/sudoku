import * as M from './engine.js';
import { TIERS } from './levels.js';
import * as cloud from './cloud.js';
import * as fx from './fx.js';
import {
  PALETTES, THEMES, AVATARS, FREE_AVATARS, EFFECTS, CONSUMABLES, REWARD, POINTS, STAR_MULT, DAILY, ACHIEVEMENTS, TECH_GUIDE,
} from './catalog.js';
import {
  GUEST_KEY, accountKey, defaults, migrate, mergeStates, forCloud, readState, writeState, removeState, writerFor,
  sumC, addC, coins, hintsLeft, livesLeft, summary, points,
} from './store.js';

const $ = (id) => document.getElementById(id);
const HISTORY_MAX = 80;
let E = M.getEngine(9); // motor del tamaño de la partida actual
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coinSvg = '<svg class="coin"><use href="#i-coin"/></svg>';
const nf = new Intl.NumberFormat('es');

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

// ── Perfil activo ──────────────────────────────────────────
// ctxKey: dónde se guarda en este teléfono (invitado o cuenta); W: casilla de este dispositivo en los contadores
let ctxKey = GUEST_KEY;
let W = writerFor(GUEST_KEY);
let S = readState(GUEST_KEY) || defaults();
let G = S.game;

function persist(kind = 'event') {
  S.game = G;
  S.meta.updatedAt = Date.now();
  writeState(ctxKey, S);
  sync.schedule(kind === 'event');
}

function useProfile(key, state) {
  ctxKey = key;
  W = writerFor(key);
  S = migrate(state || defaults());
  if (S.game && !TIERS.some((t) => t.id === S.game.tier)) S.game = null;
  G = S.game;
  writeState(ctxKey, S);
  applyPrefs();
}

// ── Sincronización con la nube ─────────────────────────────
const sync = {
  status: 'idle', dirty: false, timer: 0, lastPush: 0, lastPull: 0, message: '',
  schedule(urgent) {
    if (!cloud.user() || ctxKey === GUEST_KEY) return;
    this.dirty = true;
    clearTimeout(this.timer);
    const wait = urgent ? 900 : Math.max(2000, 30000 - (Date.now() - this.lastPush));
    this.timer = setTimeout(() => this.push(), wait);
  },
  async push({ keepalive = false } = {}) {
    if (!cloud.user() || ctxKey === GUEST_KEY || !this.dirty) return;
    // Al cerrar la app solo se sube si lo local está al día con la nube; si no, se sube al volver
    if (keepalive && Date.now() - this.lastPull > 120000) return;
    clearTimeout(this.timer);
    this.dirty = false;
    this.status = 'saving';
    renderSync();
    try {
      // Antes de subir, trae lo que otro dispositivo haya guardado y júntalo
      if (!keepalive) {
        const row = await cloud.pullSave();
        this.lastPull = Date.now();
        if (row?.state) absorb(migrate(row.state));
      }
      await cloud.pushSave(forCloud(S), S.meta.updatedAt, { keepalive });
      await cloud.pushPlayer(playerCard(), { keepalive });
      this.lastPush = Date.now();
      this.status = 'ok';
    } catch (e) {
      this.dirty = true;
      this.status = e.code === 'network' ? 'offline' : 'error';
      this.message = e.message;
    }
    renderSync();
  },
  async pull() {
    if (!cloud.user() || ctxKey === GUEST_KEY) return;
    this.status = 'saving';
    renderSync();
    try {
      const row = await cloud.pullSave();
      this.lastPull = Date.now();
      if (row?.state) applyRemote(migrate(row.state));
      else { this.dirty = true; await this.push(); }
      if (this.status === 'saving') this.status = 'ok';
    } catch (e) {
      this.status = e.code === 'network' ? 'offline' : 'error';
      this.message = e.message;
    }
    renderSync();
  },
};
// Une un estado de la nube con el local. Devuelve true si el resultado tiene algo que la nube no tenía.
function absorb(remote) {
  const localGame = G;
  const merged = mergeStates(S, remote);
  if (screen === 'game' && localGame) merged.game = localGame; // no cambiar la partida que tienes en pantalla
  const out = JSON.stringify(forCloud(merged));
  const changedHere = out !== JSON.stringify(forCloud(S));
  const newForCloud = out !== JSON.stringify(forCloud(remote));
  S = merged;
  G = S.game;
  writeState(ctxKey, S);
  if (changedHere) { applyPrefs(); refreshScreen(); }
  return newForCloud;
}
function applyRemote(remote) {
  if (absorb(remote)) { sync.dirty = true; sync.schedule(true); }
}
function playerCard() {
  return {
    name: (S.profile.name || 'Jugador').slice(0, 24),
    avatar: S.profile.avatar || '🦉',
    points: myPoints(),
    levels: summary(S, TIERS, 0).levels,
  };
}
const myPoints = () => points(S, TIERS, POINTS, DAILY.points);
function syncLabel() {
  if (sync.status === 'saving') return 'Guardando en la nube…';
  if (sync.status === 'offline') return 'Sin conexión: se guardará al volver internet';
  if (sync.status === 'error') return sync.message || 'No se pudo guardar en la nube';
  if (sync.lastPush || sync.lastPull) return 'Guardado en la nube';
  return 'Conectado a la nube';
}
function renderSync() {
  const el = document.querySelector('[data-sync]');
  if (el) { el.textContent = syncLabel(); el.dataset.state = sync.status; }
  renderTopbar();
}

// ── Utilidades ─────────────────────────────────────────────
const tierById = Object.fromEntries(TIERS.map((t, i) => [t.id, { ...t, i }]));
const prog = (id) => (S.progress[id] ||= { done: {} });
const doneCount = (id) => Object.keys(prog(id).done).length;
function levelData(id, idx) {
  const t = tierById[id], L = t.levels[idx], NN = t.size * t.size;
  return { puzzle: L.slice(0, NN), solution: L.slice(NN, 2 * NN), tech: L.slice(2 * NN) };
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
const unitName = (u) => (u < E.N ? `la fila ${u + 1}` : u < 2 * E.N ? `la columna ${u - E.N + 1}` : `la caja ${u - 2 * E.N + 1}`);
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'long' });
};
const starsHTML = (n, total = 3) => Array.from({ length: total }, (_, k) => `<svg class="st${k < n ? ' on' : ''}"><use href="#i-rate"/></svg>`).join('');
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function setAppHeight() {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
  fitBoard();
}
// El tablero ocupa todo el espacio que dejan la cabecera y los controles
function fitBoard() {
  const g = $('game');
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
function streak() {
  let n = 0;
  const d = new Date();
  if (!S.daily[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (S.daily[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ── Tema y preferencias ────────────────────────────────────
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function paletteOf(id) {
  if (id === 'auto') return darkMQ.matches ? PALETTES.dark : PALETTES.light;
  return PALETTES[id] || PALETTES.light;
}
function applyTheme() {
  const p = paletteOf(S.equipped.theme);
  const r = document.documentElement.style;
  const set = (k, v) => r.setProperty(k, v);
  set('--bg', p.bg); set('--surface', p.surface); set('--ink', p.ink); set('--ink-soft', p.inkSoft);
  set('--cobalt', p.accent); set('--cobalt-strong', p.accentStrong); set('--on-cobalt', p.onAccent);
  set('--line', p.line); set('--box', p.box); set('--peer', p.peer); set('--same', p.same); set('--sel', p.sel);
  set('--error', p.error); set('--error-bg', p.errorBg); set('--gold', p.gold); set('--hair', p.hair);
  set('--shadow', p.scheme === 'dark'
    ? '0 1px 0 rgba(0,0,0,.2), 0 16px 40px -20px rgba(0,0,0,.8)'
    : `0 1px 0 rgba(${p.shade},.06), 0 12px 32px -18px rgba(${p.shade},.45)`);
  set('color-scheme', p.scheme);
  document.documentElement.dataset.scheme = p.scheme;
  $('themeColor').setAttribute('content', p.bg);
}
darkMQ.addEventListener?.('change', () => { if (S.equipped.theme === 'auto') applyTheme(); });
function applyPrefs() {
  applyTheme();
  fx.configure({ sound: S.settings.sound, haptics: S.settings.haptics });
}

// ── Pantallas ──────────────────────────────────────────────
let screen = 'home';
let shopReturn = 'home';
function show(id) {
  screen = id;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
  if (id === 'home') renderHome();
  if (id === 'game') { render(); fitBoard(); }
  if (id === 'profile') renderProfile();
  if (id === 'shop') renderShop();
  if (id === 'techniques') renderTechniques();
}
function refreshScreen() {
  if (screen === 'home') renderHome();
  else if (screen === 'profile') renderProfile();
  else if (screen === 'shop') renderShop();
  else if (screen === 'game') render();
  renderTopbar();
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));

// ── Inicio ─────────────────────────────────────────────────
function renderTile(el, puzzle, values) {
  const n = M.sizeOfStr(puzzle.length), T = M.getEngine(n);
  el.innerHTML = '';
  el.style.setProperty('--tn', n);
  for (let i = 0; i < n * n; i++) {
    const s = document.createElement('span');
    const r = T.ROW_OF[i], c = T.COL_OF[i];
    const given = puzzle[i] !== '.';
    const v = given ? M.valOf(puzzle[i]) : values && values[i] ? values[i] : '';
    s.textContent = v;
    const cls = [];
    if (!given && v) cls.push('u');
    if (c === n - 1) cls.push('lc'); else if ((c + 1) % T.BC === 0) cls.push('br');
    if (r === n - 1) cls.push('lr'); else if ((r + 1) % T.BR === 0) cls.push('bb');
    s.className = cls.join(' ');
    el.appendChild(s);
  }
}
function inProgress() { return G && !G.done && !G.failed; }
function gameLabel(g) {
  if (g.mode === 'daily') return `Desafío del ${dateLabel(g.date)}`;
  if (g.mode === 'quick') return 'Partida rápida';
  return `Nivel ${g.index + 1} de ${tierById[g.tier].levels.length}`;
}
function renderTopbar() {
  $('meAvatar').textContent = S.profile.avatar || '🦉';
  $('meName').textContent = S.profile.name || 'Invitado';
  const u = cloud.user();
  $('meState').textContent = u && ctxKey !== GUEST_KEY
    ? (sync.status === 'offline' ? 'Sin conexión' : 'Cuenta en la nube')
    : 'Perfil en este teléfono';
  $('meChip').classList.toggle('cloud', !!(u && ctxKey !== GUEST_KEY));
  $('coinCount').textContent = nf.format(coins(S));
  $('shopCoins').textContent = nf.format(coins(S));
}
function renderHome() {
  renderTopbar();
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
    $('heroNote').innerHTML = `${esc(tierById[id].desc)}<span class="hero-reward">${coinSvg}hasta ${REWARD[id] * 2}</span>`;
    $('playBtn').textContent = 'Jugar';
  }

  const ul = $('tierList');
  ul.innerHTML = '';
  for (const t of TIERS) {
    const done = Object.values(prog(t.id).done), n = done.length, total = t.levels.length;
    const stars = done.reduce((a, r) => a + r.s, 0);
    const li = document.createElement('li');
    li.innerHTML = `<button class="tier-row">
      <span class="tier-name">${t.name}</span>
      <span class="tier-count">${n} de ${total}${stars ? `<span class="tier-stars"><svg class="st on"><use href="#i-rate"/></svg>${stars}</span>` : ''}</span>
      <span class="tier-desc">${t.desc}</span>
      <span class="tier-bar"><i style="width:${(n / total) * 100}%"></i></span>
    </button>`;
    li.firstElementChild.addEventListener('click', () => openLevels(t.id));
    ul.appendChild(li);
  }

  const k = todayKey();
  const daily = $('dailyBtn');
  const st = streak();
  if (S.daily[k]) {
    daily.classList.add('is-done');
    $('dailySub').textContent = `Resuelto hoy en ${fmt(S.daily[k].t)}. Vuelve mañana por otro.`;
    $('dailyReward').innerHTML = '';
  } else {
    daily.classList.remove('is-done');
    $('dailySub').textContent = st ? `Racha de ${st} ${st === 1 ? 'día' : 'días'}. No la pierdas.` : 'Un Maestro o Diabólico nuevo cada día';
    $('dailyReward').innerHTML = `${coinSvg}+${DAILY.coins + Math.min(DAILY.perStreakDay * st, DAILY.maxStreakBonus)}`;
  }
  const sm = summary(S, TIERS, st);
  $('statsSub').textContent = sm.solved ? `${sm.solved} ${sm.solved === 1 ? 'tablero resuelto' : 'tableros resueltos'}` : 'Tus tiempos y tu racha';
  $('rankSub').textContent = cloud.user() && ctxKey !== GUEST_KEY ? `${nf.format(myPoints())} puntos` : 'Compite con otros jugadores';

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
$('meChip').addEventListener('click', () => show('profile'));
$('coinPill').addEventListener('click', () => openShop('help'));
$('shopBtn').addEventListener('click', () => openShop('themes'));
$('rankBtn').addEventListener('click', openRanking);
$('techBtn').addEventListener('click', () => show('techniques'));

// ── Niveles ────────────────────────────────────────────────
function openLevels(id) {
  const t = tierById[id];
  $('levelsTitle').textContent = t.name;
  $('levelsCount').textContent = `${doneCount(id)} de ${t.levels.length}`;
  $('levelsDesc').textContent = `${t.desc}. Cada nivel da hasta ${REWARD[id] * 2} monedas.`;
  const grid = $('levelGrid');
  grid.innerHTML = '';
  const done = prog(id).done;
  const cur = nextIndex(id);
  t.levels.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'lvl';
    if (done[i]) {
      b.classList.add('done');
      b.innerHTML = `${i + 1}<span class="lvl-stars">${starsHTML(done[i].s)}</span>`;
      b.setAttribute('aria-label', `Nivel ${i + 1}, ${done[i].s} estrellas, mejor tiempo ${fmt(done[i].t)}`);
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
  const n = M.sizeOfStr(o.puzzle.length);
  return {
    mode: o.mode, tier: o.tier, index: o.index ?? null, date: o.date ?? null, n,
    puzzle: o.puzzle, solution: o.solution, tech: o.tech,
    values: M.fromStr(o.puzzle),
    notes: new Array(n * n).fill(0),
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
// Variante de un nivel (permuta números, filas y columnas): misma dificultad, tablero distinto
function variant(tierId, L, rng) {
  const n = tierById[tierId].size, NN = n * n, T = M.getEngine(n);
  const tr = T.transform(M.fromStr(L.slice(0, NN)), M.fromStr(L.slice(NN, 2 * NN)), rng);
  return { puzzle: M.toStr(tr.puzzle), solution: M.toStr(tr.solution), tech: L.slice(2 * NN) };
}
function dailyData(key) {
  const pool = [...TIERS[2].levels.map((l) => [TIERS[2].id, l]), ...TIERS[3].levels.map((l) => [TIERS[3].id, l])];
  const seed = M.hashString(`azulejo-${key}`);
  const [tier, L] = pool[seed % pool.length];
  return { mode: 'daily', tier, date: key, ...variant(tier, L, M.mulberry32(seed)) };
}
$('dailyBtn').addEventListener('click', () => {
  const k = todayKey();
  if (S.daily[k] && !(inProgress() && G.mode === 'daily' && G.date === k)) {
    toast(`Ya resolviste el desafío de hoy en ${fmt(S.daily[k].t)}.`);
    return;
  }
  replaceGame(dailyData(k));
});
function quickData(id) {
  const t = tierById[id];
  const L = t.levels[Math.floor(Math.random() * t.levels.length)];
  return { mode: 'quick', tier: id, date: String(Date.now()), ...variant(id, L, M.mulberry32((Math.random() * 2 ** 32) >>> 0)) };
}
$('quickBtn').addEventListener('click', () => {
  const ql = $('quickList');
  ql.innerHTML = '';
  for (const t of TIERS) {
    const b = document.createElement('button');
    b.className = 'menu-item';
    b.innerHTML = `<span class="q-name">${t.name}</span><small>${t.desc}. Hasta ${Math.round(REWARD[t.id] * 0.6 * 2)} monedas.</small>`;
    b.addEventListener('click', () => { $('quickDialog').close(); replaceGame(quickData(t.id)); });
    ql.appendChild(b);
  }
  $('quickDialog').showModal();
});

// ── Tablero ────────────────────────────────────────────────
const boardEl = $('board');
const pad = $('pad');
const keys = [];
let cells = [];
let builtN = 0;

// Construye tablero, adornos y teclado para el tamaño de la partida (9×9 o 12×12)
function buildBoard() {
  const n = G.n;
  E = M.getEngine(n);
  if (builtN === n) return;
  builtN = n;
  const game = $('game');
  game.classList.toggle('n12', n === 12);
  game.style.setProperty('--n', n);
  game.style.setProperty('--nr', Math.ceil(n / 3));
  boardEl.style.setProperty('--bx', n / E.BC);
  boardEl.style.setProperty('--by', n / E.BR);
  boardEl.style.setProperty('--bc', E.BC);
  boardEl.style.setProperty('--br', E.BR);
  boardEl.innerHTML = '';
  cells = new Array(E.NN);
  const step = Math.round(300 / n);
  for (let b = 0; b < n; b++) {
    const box = document.createElement('div');
    box.className = 'box';
    for (const i of E.UNITS[2 * n + b]) {
      const c = document.createElement('div');
      c.className = 'cell';
      c.dataset.i = i;
      c.setAttribute('role', 'gridcell');
      c.innerHTML = `<span class="v"></span><div class="n">${'<i></i>'.repeat(n)}</div>`;
      [...c.querySelectorAll('.n i')].forEach((el, k) => { el.textContent = k + 1; });
      c.style.setProperty('--d', `${(E.ROW_OF[i] + E.COL_OF[i]) * step}ms`);
      cells[i] = c;
      box.appendChild(c);
    }
    boardEl.appendChild(box);
  }
  let orn = '';
  for (let x = 1; x < n / E.BC; x++) {
    for (let y = 1; y < n / E.BR; y++) {
      orn += `<svg style="left:${(x * E.BC * 100) / n}%;top:${(y * E.BR * 100) / n}%"><use href="#i-star"/></svg>`;
    }
  }
  document.querySelector('.ornaments').innerHTML = orn;
  pad.innerHTML = '';
  keys.length = 0;
  pad.style.setProperty('--pc', n === 12 ? 6 : n);
  for (let d = 1; d <= n; d++) {
    const k = document.createElement('button');
    k.className = 'key';
    k.innerHTML = `${d}<small></small>`;
    k.setAttribute('aria-label', `Número ${d}`);
    k.addEventListener('click', () => inputDigit(d));
    keys.push(k);
    pad.appendChild(k);
  }
}
boardEl.addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.cell');
  if (!c) return;
  e.preventDefault();
  select(+c.dataset.i);
});

let sel = -1;
let notesMode = false;
let hintState = null;
let paused = false;

const isGiven = (i) => G.puzzle[i] !== '.';
const solAt = (i) => M.valOf(G.solution[i]);
// Estrellas: 3 sin pistas ni errores, 2 sin pistas, 1 con pistas
const starsOf = (g) => (g.hints > 0 ? 1 : g.errors > 0 ? 2 : 3);

function render() {
  if (!G || builtN !== G.n) return;
  const s = S.settings;
  const sv = sel >= 0 ? G.values[sel] : 0;
  const sr = sel >= 0 ? E.ROW_OF[sel] : -1, sc = sel >= 0 ? E.COL_OF[sel] : -1, sb = sel >= 0 ? E.BOX_OF[sel] : -1;
  const zone = hintState ? new Set(hintState.zone) : null;
  const counts = new Array(E.N + 1).fill(0);
  for (let i = 0; i < E.NN; i++) {
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
    for (let d = 1; d <= E.N; d++) {
      const on = (nm >> (d - 1)) & 1;
      ns[d - 1].className = on ? (s.sameHighlight && sv === d ? 'on hl' : 'on') : '';
    }
    c.setAttribute('aria-label', `Fila ${E.ROW_OF[i] + 1}, columna ${E.COL_OF[i] + 1}: ${v || 'vacía'}`);
  }
  keys.forEach((k, idx) => {
    const left = E.N - counts[idx + 1];
    k.lastChild.textContent = left > 0 ? left : '';
    k.classList.toggle('spent', left <= 0);
  });
  pad.classList.toggle('notes', notesMode);
  $('notesBtn').setAttribute('aria-pressed', String(notesMode));
  $('notesFlag').textContent = notesMode ? 'Sí' : 'No';
  $('undoBtn').disabled = !G.history.length || G.done;
  $('hintLabel').textContent = hintState ? 'Revelar' : 'Pista';
  $('hintBtn').classList.toggle('armed', !!hintState);
  $('hintFlag').textContent = hintsLeft(S);
  $('hintFlag').classList.toggle('empty', hintsLeft(S) <= 0);
  $('errCount').textContent = s.errorLimit ? `${G.errors} de 3` : G.errors;
  $('errWrap').hidden = !s.showErrors;
  $('errWrap').classList.toggle('bad', G.errors > 0);
  const st = starsOf(G);
  $('liveStars').innerHTML = starsHTML(st);
  $('liveStars').setAttribute('aria-label', `Estrellas posibles: ${st}`);
  $('timerBtn').classList.toggle('hidden-time', !s.showTimer);
  updateTimer();
}
function updateTimer() { if (G) $('timer').textContent = fmt(G.time); }

function flash(i, cls, ms = 360) {
  const c = cells[i];
  if (!c) return;
  c.classList.remove(cls);
  void c.offsetWidth;
  c.classList.add(cls);
  setTimeout(() => c.classList.remove(cls), ms);
}

function openGame() {
  G.n ||= M.sizeOfStr(G.puzzle.length);
  buildBoard();
  sel = -1; notesMode = false; hintState = null; paused = false;
  $('hintCard').hidden = true;
  boardEl.classList.remove('paused');
  $('gTier').textContent = tierById[G.tier].name;
  $('gLevel').textContent = gameLabel(G);
  show('game');
  if (G.failed) setTimeout(onThreeErrors, 250);
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

// Destello cuando una fila, columna o caja queda completa y correcta
function checkUnits(i) {
  const units = [E.ROW_OF[i], E.N + E.COL_OF[i], 2 * E.N + E.BOX_OF[i]];
  let any = false;
  for (const u of units) {
    const cs = E.UNITS[u];
    if (!cs.every((k) => G.values[k] === solAt(k))) continue;
    any = true;
    cs.forEach((k, n) => setTimeout(() => flash(k, 'unit-done', 650), n * 28));
  }
  if (any) { fx.sfx.unit(); fx.haptic('success'); }
  return any;
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
    fx.sfx.note();
    clearHint();
    render();
    persist('tick');
    return;
  }
  snapshot();
  if (G.values[i] === d) {
    G.values[i] = 0;
    fx.sfx.erase();
    clearHint();
    render();
    persist('tick');
    return;
  }
  G.values[i] = d;
  G.notes[i] = 0;
  const ok = d === solAt(i);
  const shown = !ok && S.settings.showErrors;
  if (shown) G.errors++;
  if (S.settings.autoNotes && (ok || !S.settings.showErrors)) clearPeersNote(i, d);
  clearHint();
  render();
  flash(i, shown ? 'shake' : 'pop');
  if (shown) { fx.sfx.error(); fx.haptic('error'); } else { fx.haptic(); }
  const unit = ok && checkUnits(i);
  if (!shown && !unit) fx.sfx.place();
  persist('tick');
  afterPlace();
}

function afterPlace() {
  if (S.settings.showErrors && S.settings.errorLimit && G.errors >= 3) { G.failed = true; persist(); onThreeErrors(); return; }
  if (G.values.every((v, i) => v === solAt(i))) { win(); return; }
  if (G.values.every((v) => v)) toast('El tablero está lleno, pero hay números incorrectos.');
}

$('eraseBtn').addEventListener('click', () => {
  if (!G || G.done || paused || sel < 0 || isGiven(sel)) return;
  if (!G.values[sel] && !G.notes[sel]) return;
  snapshot();
  G.values[sel] = 0;
  G.notes[sel] = 0;
  fx.sfx.erase();
  clearHint();
  render();
  persist('tick');
});
$('undoBtn').addEventListener('click', undo);
function undo() {
  if (!G || G.done || paused || !G.history.length) return;
  const [v, n] = G.history.pop();
  G.values = v;
  G.notes = n;
  fx.sfx.erase();
  clearHint();
  render();
  persist('tick');
}
$('notesBtn').addEventListener('click', () => { notesMode = !notesMode; fx.haptic(); render(); });

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
$('hintBtn').addEventListener('click', async () => {
  if (!G || G.done || G.failed || paused) return;
  if (hintState) { reveal(); return; }
  const wrong = G.values.findIndex((v, i) => v && !isGiven(i) && v !== solAt(i));
  // Señalar un error que ya se ve en rojo es gratis
  if (wrong >= 0 && S.settings.showErrors) {
    sel = wrong;
    hintState = { cell: wrong, zone: [], paid: false };
    showHint('Revisa esta celda', 'El número de la celda marcada no es correcto. Bórralo o toca Revelar para corregirlo (usa una pista).');
    render();
    return;
  }
  if (hintsLeft(S) <= 0 && !(await offerHints())) return;
  addC(S.hints.used, W, 1);
  G.hints++;
  fx.sfx.hint();
  if (wrong >= 0) {
    sel = wrong;
    hintState = { cell: wrong, zone: [], paid: true };
    showHint('Revisa esta celda', 'El número de la celda marcada no es correcto. Bórralo o toca Revelar para corregirlo.');
    render();
    persist();
    return;
  }
  const h = E.hint(G.values.slice(), M.fromStr(G.solution));
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
    title = M.TECH[h.step.t].name;
    const ds = E.digitsOf(h.step.digits);
    text = TECH_HELP[h.step.t] ? TECH_HELP[h.step.t](ds[0], ds) : '';
    if (h.tech !== h.step.t) text += ` Después necesitarás ${M.TECH[h.tech].name}.`;
  }
  sel = h.cell;
  hintState = { cell: h.cell, zone, paid: true };
  showHint(title, text);
  render();
  persist();
});
async function reveal() {
  if (!hintState.paid) {
    const cell = hintState.cell;
    if (hintsLeft(S) <= 0 && !(await offerHints())) return;
    addC(S.hints.used, W, 1);
    G.hints++;
    hintState = { cell, zone: [], paid: true };
  }
  const i = hintState.cell, d = solAt(i);
  snapshot();
  G.values[i] = d;
  G.notes[i] = 0;
  if (S.settings.autoNotes) clearPeersNote(i, d);
  clearHint();
  sel = i;
  render();
  flash(i, 'pop');
  fx.sfx.place();
  checkUnits(i);
  persist();
  afterPlace();
}
// Sin pistas: ofrece comprar un paquete sin salir de la partida
async function offerHints() {
  const pack = CONSUMABLES.find((c) => c.id === 'hint3');
  if (coins(S) >= pack.price) {
    const ok = await confirmBox({
      title: 'Te quedaste sin pistas',
      text: `Compra ${pack.qty} pistas por ${pack.price} monedas. Tienes ${nf.format(coins(S))}.`,
      yes: `Comprar ${pack.qty} pistas`, no: 'Ahora no',
    });
    if (!ok) return false;
    purchase(pack, { silent: true });
    return true;
  }
  const go = await confirmBox({
    title: 'Te quedaste sin pistas',
    text: `Un paquete de ${pack.qty} pistas cuesta ${pack.price} monedas y tienes ${nf.format(coins(S))}. Resuelve niveles para ganar más.`,
    yes: 'Ver la tienda', no: 'Seguir jugando',
  });
  if (go) openShop('help', 'game');
  return false;
}

// ── Reloj y pausa ──────────────────────────────────────────
setInterval(() => {
  if (screen === 'game' && G && !G.done && !G.failed && !paused && document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) {
    G.time++;
    updateTimer();
    if (G.time % 5 === 0) persist('tick');
  }
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    writeState(ctxKey, S);
    sync.push({ keepalive: true });
  } else if (cloud.user() && ctxKey !== GUEST_KEY && Date.now() - sync.lastPull > 60000) {
    sync.pull();
  }
});
addEventListener('pagehide', () => { writeState(ctxKey, S); sync.push({ keepalive: true }); });

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

// ── Victoria y recompensas ─────────────────────────────────
function settle() {
  const stars = starsOf(G);
  const base = REWARD[G.tier] || 20;
  const lines = [];
  let earned = 0, record = false;
  if (G.mode === 'level') {
    const done = prog(G.tier).done, prev = done[G.index];
    if (!prev) {
      earned = Math.round(base * STAR_MULT[stars]);
      lines.push(['Nivel completado', base]);
      if (stars > 1) lines.push([stars === 3 ? 'Tres estrellas, doble' : 'Dos estrellas', earned - base]);
    } else if (stars > prev.s) {
      earned = Math.round(base * (STAR_MULT[stars] - STAR_MULT[prev.s]));
      lines.push([`Subiste a ${stars} estrellas`, earned]);
    } else {
      earned = Math.max(2, Math.round(base * 0.2));
      lines.push(['Nivel repetido', earned]);
    }
    record = !!prev && G.time < prev.t;
    done[G.index] = prev ? { t: Math.min(prev.t, G.time), s: Math.max(prev.s, stars) } : { t: G.time, s: stars };
  } else if (G.mode === 'daily') {
    S.daily[G.date] = { t: G.time, s: stars };
    const st = streak();
    const bonus = Math.min(DAILY.perStreakDay * (st - 1), DAILY.maxStreakBonus);
    earned = DAILY.coins + bonus;
    lines.push(['Desafío del día', DAILY.coins]);
    if (bonus > 0) lines.push([`Racha de ${st} días`, bonus]);
    addC(S.hints.got, W, DAILY.hints);
    lines.push(['Pista de regalo', null, '+1 pista']);
  } else {
    earned = Math.round(base * 0.6 * STAR_MULT[stars]);
    lines.push([`Partida rápida, ${stars} ${stars === 1 ? 'estrella' : 'estrellas'}`, earned]);
  }
  addC(S.wallet.earned, W, earned);
  addC(S.stats.solved, W, 1);
  addC(S.stats.time, W, G.time);
  if (S.stats.best[G.tier] == null || G.time < S.stats.best[G.tier]) S.stats.best[G.tier] = G.time;
  const ach = unlockAchievements();
  for (const a of ach) lines.push([`Logro: ${a.name}`, a.coins]);
  const total = earned + ach.reduce((s, a) => s + a.coins, 0);
  return { stars, total, lines, record };
}
function unlockAchievements() {
  const sm = summary(S, TIERS, streak());
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (S.achievements[a.id] || !a.test(sm)) continue;
    S.achievements[a.id] = Date.now();
    addC(S.wallet.earned, W, a.coins);
    got.push(a);
  }
  return got;
}
function win() {
  G.done = true;
  sel = -1;
  clearHint();
  const result = settle();
  persist();
  render();
  fx.sfx.win();
  fx.haptic('success');
  cells.forEach((c) => c.classList.add('glaze'));
  setTimeout(() => {
    cells.forEach((c) => c.classList.remove('glaze'));
    openWin(result);
  }, reducedMotion ? 80 : 1500);
}
function openWin({ stars, total, lines, record }) {
  const t = tierById[G.tier];
  $('winSub').textContent = G.mode === 'level' ? `${t.name}, nivel ${G.index + 1}` : G.mode === 'daily' ? `Desafío del ${dateLabel(G.date)}` : `Partida rápida, ${t.name}`;
  $('winStars').innerHTML = starsHTML(stars);
  $('winTime').textContent = fmt(G.time);
  $('winErr').textContent = S.settings.showErrors ? G.errors : '—';
  $('winHints').textContent = G.hints;
  $('winLines').innerHTML = lines.map(([label, n, txt]) => `<li><span>${esc(label)}</span><b>${txt || `+${n}`}</b></li>`).join('');
  const tech = M.TECH[G.tech]?.name;
  const tips = [];
  if (tech) tips.push(`Este tablero exigía <b>${tech}</b>.`);
  if (record) tips.push('Nuevo mejor tiempo.');
  if (stars < 3) tips.push(stars === 1 ? 'Sin pistas consigues dos estrellas.' : 'Sin errores consigues tres estrellas.');
  $('winNote').innerHTML = tips.join(' ');
  const next = $('winNext');
  next.hidden = false;
  if (G.mode === 'level') next.textContent = G.index + 1 < t.levels.length ? 'Siguiente nivel' : 'Ver categorías';
  else if (G.mode === 'quick') next.textContent = 'Otra partida';
  else next.hidden = true;
  $('winDialog').showModal();
  const p = paletteOf(S.equipped.theme);
  fx.celebrate(S.equipped.effect, [p.accent, p.gold, p.box, p.sel, '#E7B53C']);
  countUp($('winCoins'), total);
  renderTopbar();
}
function countUp(el, to) {
  if (reducedMotion || to <= 0) { el.textContent = `+${to}`; return; }
  const t0 = performance.now(), dur = Math.min(1200, 300 + to * 6);
  let lastTick = 0;
  (function step(t) {
    const k = Math.min(1, (t - t0) / dur);
    const v = Math.round(to * (1 - (1 - k) ** 3));
    el.textContent = `+${v}`;
    if (t - lastTick > 90 && k < 1) { fx.sfx.coin(); lastTick = t; }
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
$('winDialog').addEventListener('close', () => document.querySelectorAll('.fx-canvas').forEach((c) => c.remove()));
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

// Tres errores: vida extra, comprar una o reiniciar
async function onThreeErrors() {
  const life = CONSUMABLES.find((c) => c.id === 'life1');
  if (livesLeft(S) > 0) {
    const use = await confirmBox({
      title: 'Tres errores',
      text: `Tienes ${livesLeft(S)} ${livesLeft(S) === 1 ? 'vida extra' : 'vidas extra'}. Usa una para seguir con este tablero.`,
      yes: 'Usar una vida', no: 'Terminar partida',
    });
    if (use) { addC(S.lives.used, W, 1); return revive(); }
  } else if (coins(S) >= life.price) {
    const buy = await confirmBox({
      title: 'Tres errores',
      text: `Compra una vida extra por ${life.price} monedas y sigue con este tablero. Tienes ${nf.format(coins(S))}.`,
      yes: 'Comprar y seguir', no: 'Terminar partida',
    });
    if (buy) { purchase(life, { silent: true }); addC(S.lives.used, W, 1); return revive(); }
  }
  const again = await confirmBox({
    title: 'Partida terminada',
    text: 'Puedes empezar este mismo tablero desde cero.',
    yes: 'Reiniciar tablero', no: 'Volver al inicio',
  });
  if (again) restart();
  else show('home');
}
function revive() {
  G.failed = false;
  G.errors = 2;
  persist();
  render();
  toast('Sigues en juego. Te queda un error.');
}
function restart() {
  G = newGame({ ...G });
  persist();
  openGame();
}

// ── Menú de partida ────────────────────────────────────────
$('moreBtn').addEventListener('click', () => { if (G && !G.done) $('moreDialog').showModal(); });
$('fillNotesBtn').addEventListener('click', () => {
  $('moreDialog').close();
  snapshot();
  const cand = E.candidates(G.values);
  for (let i = 0; i < E.NN; i++) if (!G.values[i]) G.notes[i] = cand[i];
  clearHint();
  render();
  persist('tick');
});
$('clearNotesBtn').addEventListener('click', () => {
  $('moreDialog').close();
  snapshot();
  G.notes = new Array(E.NN).fill(0);
  render();
  persist('tick');
});
$('restartBtn').addEventListener('click', async () => {
  $('moreDialog').close();
  const ok = await confirmBox({ title: '¿Reiniciar el tablero?', text: 'Se borrarán tus números, notas y el tiempo de esta partida.', yes: 'Reiniciar', no: 'Cancelar' });
  if (ok) restart();
});
$('techFromGame').addEventListener('click', () => { $('moreDialog').close(); techReturn = 'game'; show('techniques'); });
$('settingsFromGame').addEventListener('click', () => { $('moreDialog').close(); openSettings(); });

// ── Tienda ─────────────────────────────────────────────────
let shopTab = 'help';
const owns = (type, item) => !item.price || !!S.owned[`${type}:${item.id}`];
function openShop(tab = shopTab, from = screen) {
  shopTab = tab;
  shopReturn = from === 'shop' ? shopReturn : from;
  show('shop');
}
$('shopBack').addEventListener('click', () => (shopReturn === 'game' && G ? openGame() : show(shopReturn === 'profile' ? 'profile' : 'home')));
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; renderShop(); }));

function swatch(id) {
  const ps = id === 'auto' ? [PALETTES.light, PALETTES.dark] : [PALETTES[id]];
  return `<span class="swatch${ps.length > 1 ? ' duo' : ''}">${ps.map((p) => `<span style="background:${p.bg}">
    <i style="background:${p.surface};border-color:${p.box}"><b style="color:${p.ink}">7</b><b style="color:${p.accent}">3</b><em style="background:${p.sel}"></em></i></span>`).join('')}</span>`;
}
function priceBtn(type, item, extra = '') {
  const cost = item.price;
  const can = coins(S) >= cost;
  return `<button class="price ${can ? '' : 'short'}" data-buy="${type}:${item.id}" ${extra}>${coinSvg}${nf.format(cost)}</button>`;
}
function renderShop() {
  renderTopbar();
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === shopTab)));
  const box = $('shopList');
  let html = '';
  if (shopTab === 'help') {
    const h = hintsLeft(S), l = livesLeft(S);
    html += `<div class="inv"><span><svg class="inv-ic"><use href="#i-hint"/></svg><b>${h}</b> ${h === 1 ? 'pista' : 'pistas'}</span><span><svg class="inv-ic heart"><use href="#i-heart"/></svg><b>${l}</b> ${l === 1 ? 'vida extra' : 'vidas extra'}</span></div>`;
    for (const c of CONSUMABLES) {
      html += `<div class="item">
        <span class="item-ic ${c.kind}"><svg><use href="#i-${c.kind === 'hints' ? 'hint' : 'heart'}"/></svg><em>×${c.qty}</em></span>
        <span class="item-text"><b>${c.name}</b><small>${c.desc}</small></span>
        ${priceBtn('item', c)}
      </div>`;
    }
    html += '<p class="shop-foot">El desafío del día te regala una pista cada vez que lo resuelves.</p>';
  } else if (shopTab === 'themes') {
    for (const t of THEMES) {
      const own = owns('theme', t), on = S.equipped.theme === t.id;
      html += `<div class="item theme">
        ${swatch(t.id)}
        <span class="item-text"><b>${t.name}</b><small>${t.desc}</small></span>
        ${own ? `<button class="use ${on ? 'on' : ''}" data-use="theme:${t.id}" ${on ? 'disabled' : ''}>${on ? 'En uso' : 'Usar'}</button>` : priceBtn('theme', t)}
      </div>`;
    }
  } else if (shopTab === 'avatars') {
    html += '<div class="avatar-grid shop-avatars">';
    for (const a of AVATARS) {
      const own = owns('avatar', a), on = S.profile.avatar === a.id;
      html += `<button class="av ${on ? 'on' : ''} ${own ? 'own' : ''}" data-${own ? 'use' : 'buy'}="avatar:${a.id}" aria-label="Avatar ${a.id}${own ? '' : `, ${a.price} monedas`}">
        <span>${a.id}</span>${own ? (on ? '<small>En uso</small>' : '<small>Usar</small>') : `<small class="p">${coinSvg}${a.price}</small>`}
      </button>`;
    }
    html += '</div>';
  } else {
    for (const f of EFFECTS) {
      const own = owns('effect', f), on = S.equipped.effect === f.id;
      html += `<div class="item">
        <button class="item-ic effect" data-try="${f.id}" aria-label="Probar ${f.name}"><svg><use href="#i-star"/></svg><em>Probar</em></button>
        <span class="item-text"><b>${f.name}</b><small>${f.desc}</small></span>
        ${own ? `<button class="use ${on ? 'on' : ''}" data-use="effect:${f.id}" ${on ? 'disabled' : ''}>${on ? 'En uso' : 'Usar'}</button>` : priceBtn('effect', f)}
      </div>`;
    }
  }
  box.innerHTML = html;
}
$('shopList').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.try) {
    const p = paletteOf(S.equipped.theme);
    if (b.dataset.try === 'glaze') toast('El esmalte es la ola de color que recorre el tablero al resolver.');
    else fx.celebrate(b.dataset.try, [p.accent, p.gold, p.box, p.sel, '#E7B53C']);
    return;
  }
  if (b.dataset.use) { const [type, id] = b.dataset.use.split(':'); equip(type, id); return; }
  if (b.dataset.buy) {
    const [type, id] = b.dataset.buy.split(/:(.+)/);
    const item = type === 'item' ? CONSUMABLES.find((c) => c.id === id)
      : type === 'theme' ? THEMES.find((t) => t.id === id)
        : type === 'avatar' ? AVATARS.find((a) => a.id === id) : EFFECTS.find((f) => f.id === id);
    if (item) buyFlow(type, item);
  }
});
function equip(type, id) {
  if (type === 'theme') { S.equipped.theme = id; applyTheme(); }
  if (type === 'effect') S.equipped.effect = id;
  if (type === 'avatar') S.profile.avatar = id;
  fx.haptic();
  persist();
  refreshScreen();
}
async function buyFlow(type, item) {
  const name = type === 'avatar' ? `el avatar ${item.id}` : type === 'theme' ? `el tema ${item.name}` : type === 'effect' ? `el efecto ${item.name}` : item.name;
  if (coins(S) < item.price) {
    toast(`Te faltan ${nf.format(item.price - coins(S))} monedas. Resuelve niveles para ganarlas.`);
    fx.haptic('error');
    return;
  }
  const ok = await confirmBox({
    title: `¿Comprar ${name}?`,
    text: `Cuesta ${nf.format(item.price)} monedas. Te quedarán ${nf.format(coins(S) - item.price)}.`,
    yes: 'Comprar', no: 'Cancelar',
  });
  if (!ok) return;
  purchase(item, { type });
}
function purchase(item, { type = 'item', silent = false } = {}) {
  addC(S.wallet.spent, W, item.price);
  if (type === 'item') {
    addC((item.kind === 'hints' ? S.hints : S.lives).got, W, item.qty);
  } else {
    S.owned[`${type}:${item.id}`] = Date.now();
    equip(type, item.id);
  }
  const ach = unlockAchievements();
  fx.sfx.buy();
  fx.haptic('success');
  persist();
  if (!silent) toast(type === 'item' ? `Compraste ${item.name}.` : 'Listo, ya es tuyo y está en uso.');
  if (ach.length) setTimeout(() => toast(`Logro: ${ach[0].name} (+${ach[0].coins} monedas)`), silent ? 0 : 2200);
  refreshScreen();
  if (screen === 'game') render();
}

// ── Perfil y cuenta ────────────────────────────────────────
function renderProfile() {
  renderTopbar();
  $('pAvatar').textContent = S.profile.avatar || '🦉';
  if (document.activeElement !== $('pName')) $('pName').value = S.profile.name || '';
  const u = cloud.user();
  const box = $('accountBox');
  if (!cloud.enabled()) {
    box.innerHTML = `<div class="acc-card"><svg><use href="#i-cloud"/></svg><div><b>Cuentas en la nube, muy pronto</b>
      <small>Por ahora tu progreso se guarda en este teléfono. Añade Azulejo a la pantalla de inicio para que Safari no lo borre.</small></div></div>`;
  } else if (u && ctxKey !== GUEST_KEY) {
    box.innerHTML = `<div class="acc-card on"><svg><use href="#i-cloud"/></svg><div><b>${esc(u.email || 'Cuenta')}</b>
      <small data-sync data-state="${sync.status}">${syncLabel()}</small></div></div>
      <div class="acc-actions"><button class="btn-quiet" id="syncNow">Sincronizar ahora</button><button class="btn-quiet danger" id="logoutBtn">Cerrar sesión</button></div>`;
    $('syncNow').onclick = async () => { sync.dirty = true; await sync.push(); await sync.pull(); toast(sync.status === 'ok' ? 'Todo guardado en la nube.' : syncLabel()); };
    $('logoutBtn').onclick = logout;
  } else {
    box.innerHTML = `<div class="acc-card"><svg><use href="#i-cloud"/></svg><div><b>Guarda tu progreso en la nube</b>
      <small>Con una cuenta no pierdes nada si cambias de teléfono, juegas en otros dispositivos y apareces en el ranking.</small></div></div>
      <div class="acc-actions"><button class="btn-primary" id="signupBtn">Crear cuenta</button><button class="btn-quiet" id="signinBtn">Ya tengo cuenta</button></div>`;
    $('signupBtn').onclick = () => openAuth('signup');
    $('signinBtn').onclick = () => openAuth('signin');
  }
  const st = streak();
  const sm = summary(S, TIERS, st);
  $('pStats').innerHTML = `
    <div><dd>${sm.levels}</dd><dt>Niveles</dt></div>
    <div><dd>${sm.stars}</dd><dt>Estrellas</dt></div>
    <div><dd>${nf.format(myPoints())}</dd><dt>Puntos</dt></div>
    <div><dd>${st}</dd><dt>Racha</dt></div>`;
  const got = ACHIEVEMENTS.filter((a) => S.achievements[a.id]).length;
  $('achCount').textContent = `${got} de ${ACHIEVEMENTS.length}`;
  $('achList').innerHTML = ACHIEVEMENTS.map((a) => {
    const on = !!S.achievements[a.id];
    return `<li class="${on ? 'on' : ''}"><span class="ach-ic"><svg><use href="#i-${on ? 'check' : 'lock'}"/></svg></span>
      <span class="ach-text"><b>${a.name}</b><small>${a.desc}</small></span><span class="ach-coins">${coinSvg}${a.coins}</span></li>`;
  }).join('');
}
$('pName').addEventListener('change', () => {
  const v = $('pName').value.trim().slice(0, 20);
  if (!v) { $('pName').value = S.profile.name; return; }
  S.profile.name = v;
  persist();
  renderTopbar();
  toast('Nombre guardado.');
});
$('pName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('pName').blur(); });
$('pAvatar').addEventListener('click', openAvatarPicker);

function openAvatarPicker() {
  const grid = $('avatarGrid');
  grid.innerHTML = AVATARS.map((a) => {
    const own = owns('avatar', a), on = S.profile.avatar === a.id;
    return `<button class="av ${on ? 'on' : ''} ${own ? 'own' : ''}" data-av="${a.id}" aria-label="Avatar ${a.id}${own ? '' : `, ${a.price} monedas`}">
      <span>${a.id}</span>${own ? '' : `<small class="p">${coinSvg}${a.price}</small>`}</button>`;
  }).join('');
  $('avatarDialog').showModal();
}
$('avatarGrid').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-av]');
  if (!b) return;
  const a = AVATARS.find((x) => x.id === b.dataset.av);
  if (owns('avatar', a)) { equip('avatar', a.id); $('avatarDialog').close(); return; }
  $('avatarDialog').close();
  await buyFlow('avatar', a);
});

// Registro / inicio de sesión
let authMode = 'signup';
function openAuth(mode) {
  if (!cloud.enabled()) { toast('Las cuentas en la nube aún no están activadas.'); return; }
  authMode = mode;
  $('authSubmit').hidden = false;
  const f = (id, on) => { $(id).hidden = !on; };
  $('authMsg').textContent = '';
  $('authMsg').className = 'form-msg';
  if (mode === 'signup') {
    $('authTitle').textContent = 'Crear cuenta';
    $('authSub').textContent = 'Tu progreso se guardará en la nube y podrás jugar en cualquier dispositivo.';
    $('authSubmit').textContent = 'Crear cuenta';
    $('authSwitch').textContent = 'Ya tengo una cuenta';
    $('authName').value = S.profile.name || '';
    $('authPass').autocomplete = 'new-password';
  } else if (mode === 'signin') {
    $('authTitle').textContent = 'Iniciar sesión';
    $('authSub').textContent = 'Entra con el correo y la contraseña de tu cuenta.';
    $('authSubmit').textContent = 'Entrar';
    $('authSwitch').textContent = 'Crear una cuenta nueva';
    $('authPass').autocomplete = 'current-password';
  } else {
    $('authTitle').textContent = 'Recuperar contraseña';
    $('authSub').textContent = 'Te enviaremos un enlace para crear una contraseña nueva. Ábrelo en este mismo teléfono.';
    $('authSubmit').textContent = 'Enviar enlace';
    $('authSwitch').textContent = 'Volver a iniciar sesión';
  }
  f('authNameField', mode === 'signup');
  f('authPassField', mode !== 'recover');
  f('authForgot', mode === 'signin');
  $('authPass').value = '';
  if (!$('authDialog').open) $('authDialog').showModal();
}
$('authSwitch').addEventListener('click', () => {
  if (authMode === 'done') { $('authDialog').close(); return; }
  openAuth(authMode === 'signup' ? 'signin' : authMode === 'signin' ? 'signup' : 'signin');
});
$('authForgot').addEventListener('click', () => openAuth('recover'));
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('authMsg');
  const name = $('authName').value.trim().slice(0, 20);
  const email = $('authEmail').value.trim().toLowerCase();
  const pass = $('authPass').value;
  const fail = (t) => { msg.textContent = t; msg.className = 'form-msg bad'; fx.haptic('error'); };
  if (authMode === 'signup' && !name) return fail('Escribe tu nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Escribe un correo válido.');
  if (authMode !== 'recover' && pass.length < 6) return fail('La contraseña debe tener al menos 6 caracteres.');
  const btn = $('authSubmit');
  btn.disabled = true;
  msg.className = 'form-msg';
  msg.textContent = 'Un momento…';
  try {
    if (authMode === 'signup') {
      const r = await cloud.signUp(email, pass, name);
      if (r.confirm) {
        try { localStorage.setItem('azulejo.pendingName', name); } catch (_) { /* nada */ }
        msg.className = 'form-msg ok';
        msg.textContent = `Te enviamos un correo a ${email}. Ábrelo en este teléfono para activar la cuenta.`;
        authMode = 'done';
        btn.hidden = true;
        $('authSwitch').textContent = 'Cerrar';
        return;
      }
      $('authDialog').close();
      await afterLogin({ name });
      toast(`Cuenta creada. Tu progreso ya se guarda en la nube, ${S.profile.name}.`, 3200);
    } else if (authMode === 'signin') {
      await cloud.signIn(email, pass);
      $('authDialog').close();
      await afterLogin();
      toast(`Hola de nuevo, ${S.profile.name}.`);
    } else {
      await cloud.recover(email);
      msg.className = 'form-msg ok';
      msg.textContent = 'Si existe una cuenta con ese correo, te llegará un enlace en unos minutos.';
    }
  } catch (err) {
    fail(err.message || 'No se pudo completar. Inténtalo de nuevo.');
  } finally {
    btn.disabled = false;
  }
});

const hasProgress = (st) => summary(st, TIERS, 0).levels > 0 || sumC(st.wallet.earned) > sumC(defaults().wallet.earned) || !!st.game;

// Tras entrar: une el progreso de invitado (si quieres) con el de la cuenta
async function afterLogin({ name } = {}) {
  const u = cloud.user();
  if (!u) return;
  const wasGuest = ctxKey === GUEST_KEY;
  const guest = S;
  let remote = null;
  try {
    const row = await cloud.pullSave();
    remote = row?.state ? migrate(row.state) : null;
  } catch (e) {
    toast(e.message);
  }
  const cached = readState(accountKey(u.id));
  const base = remote && cached ? mergeStates(cached, remote) : remote || cached;
  let next;
  let adoptGuest = false;
  if (!base) {
    next = wasGuest ? guest : defaults();
    adoptGuest = wasGuest;
  } else if (wasGuest && hasProgress(guest)) {
    const sm = summary(guest, TIERS, 0);
    adoptGuest = await confirmBox({
      title: '¿Juntar tu progreso?',
      text: `En este teléfono jugaste como invitado: ${sm.levels} ${sm.levels === 1 ? 'nivel' : 'niveles'} y ${nf.format(coins(guest))} monedas. ¿Lo añadimos a tu cuenta?`,
      yes: 'Añadir a mi cuenta', no: 'Usar solo mi cuenta',
    });
    next = adoptGuest ? mergeStates(guest, base) : base;
    if (adoptGuest && base.profile?.name) next.profile = { ...base.profile };
  } else {
    next = base;
  }
  if (name) next.profile.name = name;
  if (!next.profile.name) next.profile.name = guest.profile.name || (u.email || 'Jugador').split('@')[0].slice(0, 20);
  next.onboarded = true;
  next.meta.updatedAt = Date.now();
  if (adoptGuest) removeState(GUEST_KEY);
  useProfile(accountKey(u.id), next);
  sync.dirty = true;
  await sync.push();
  refreshScreen();
}

async function logout() {
  const ok = await confirmBox({
    title: '¿Cerrar sesión?',
    text: 'Tu progreso queda guardado en la nube. En este teléfono volverás al perfil de invitado.',
    yes: 'Cerrar sesión', no: 'Cancelar',
  });
  if (!ok) return;
  sync.dirty = true;
  await sync.push();
  if (sync.dirty) {
    const anyway = await confirmBox({
      title: 'No hay conexión',
      text: 'Tus últimos cambios aún no llegaron a la nube. Se guardarán cuando vuelvas a entrar en este teléfono.',
      yes: 'Cerrar sesión igualmente', no: 'Esperar',
    });
    if (!anyway) return;
  }
  const uid = cloud.user()?.id;
  await cloud.signOut();
  if (uid && !sync.dirty) removeState(accountKey(uid));
  sync.status = 'idle';
  sync.lastPush = 0;
  sync.lastPull = 0;
  useProfile(GUEST_KEY, readState(GUEST_KEY) || { ...defaults(), onboarded: true });
  show('home');
  toast('Sesión cerrada.');
}
cloud.onSessionChange((u) => {
  if (!u && ctxKey !== GUEST_KEY) { sync.status = 'error'; sync.message = 'Tu sesión caducó. Vuelve a iniciar sesión.'; renderSync(); }
});

// Contraseña nueva (enlace de recuperación)
$('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('newPass').value;
  const msg = $('passMsg');
  if (pass.length < 6) { msg.textContent = 'La contraseña debe tener al menos 6 caracteres.'; msg.className = 'form-msg bad'; return; }
  try {
    await cloud.updatePassword(pass);
    $('passwordDialog').close();
    toast('Contraseña actualizada.');
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg bad';
  }
});

// ── Bienvenida ─────────────────────────────────────────────
let welcomeAvatar = FREE_AVATARS[0];
function openWelcome() {
  $('wName').value = S.profile.name || '';
  welcomeAvatar = S.profile.avatar || FREE_AVATARS[0];
  const row = $('wAvatars');
  row.innerHTML = FREE_AVATARS.map((a) => `<button type="button" role="radio" class="av-pick" data-pick="${a}" aria-checked="${a === welcomeAvatar}">${a}</button>`).join('');
  $('wLogin').hidden = !cloud.enabled();
  $('welcomeDialog').showModal();
}
$('wAvatars').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  welcomeAvatar = b.dataset.pick;
  $('wAvatars').querySelectorAll('[data-pick]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  fx.haptic();
});
$('welcomeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('wName').value.trim().slice(0, 20);
  if (!name) { $('wName').focus(); toast('Escribe tu nombre para empezar.'); return; }
  S.profile.name = name;
  S.profile.avatar = welcomeAvatar;
  S.onboarded = true;
  persist();
  $('welcomeDialog').close();
  renderHome();
  toast(`¡A jugar, ${name}! Tienes ${coins(S)} monedas para la tienda.`, 3200);
  setTimeout(grantPending, 3300);
});
$('wLogin').addEventListener('click', () => { $('welcomeDialog').close(); openAuth('signin'); });
$('welcomeDialog').addEventListener('cancel', (e) => e.preventDefault());

// ── Ranking ────────────────────────────────────────────────
async function openRanking() {
  show('ranking');
  const body = $('rankBody');
  $('rankAside').textContent = '';
  if (!cloud.enabled()) {
    body.innerHTML = '<div class="empty"><svg><use href="#i-trophy"/></svg><b>El ranking llegará con las cuentas en la nube</b><small>Mientras tanto, sigue sumando estrellas: tus puntos ya cuentan.</small></div>';
    return;
  }
  body.innerHTML = '<div class="empty"><small>Cargando ranking…</small></div>';
  const me = cloud.user() && ctxKey !== GUEST_KEY ? cloud.user() : null;
  if (me) await sync.push();
  try {
    const rows = await cloud.leaderboard(50);
    let html = '<ol class="rank-list">';
    rows.forEach((r, k) => {
      html += `<li class="${me && r.user_id === me.id ? 'me' : ''}"><span class="rk ${k < 3 ? `top${k + 1}` : ''}">${k + 1}</span>
        <span class="avatar sm">${esc(r.avatar || '🦉')}</span>
        <span class="rn"><b>${esc(r.display_name)}</b><small>${r.levels_done} ${r.levels_done === 1 ? 'nivel' : 'niveles'}</small></span>
        <span class="rp">${nf.format(r.points)}</span></li>`;
    });
    html += '</ol>';
    if (!rows.length) html = '<div class="empty"><svg><use href="#i-trophy"/></svg><b>Aún no hay nadie</b><small>Resuelve un nivel con tu cuenta y serás el primero.</small></div>';
    if (me && !rows.some((r) => r.user_id === me.id)) {
      const rank = await cloud.rankOf(myPoints()).catch(() => null);
      html += `<ol class="rank-list mine"><li class="me"><span class="rk">${rank || '—'}</span><span class="avatar sm">${esc(S.profile.avatar)}</span>
        <span class="rn"><b>${esc(S.profile.name)}</b><small>Tú</small></span><span class="rp">${nf.format(myPoints())}</span></li></ol>`;
    }
    if (!me) html += '<div class="rank-cta"><p>Crea una cuenta para aparecer en el ranking.</p><button class="btn-primary" id="rankSignup">Crear cuenta</button></div>';
    body.innerHTML = html;
    if (me) $('rankAside').textContent = `${nf.format(myPoints())} pts`;
    const cta = $('rankSignup');
    if (cta) cta.onclick = () => openAuth('signup');
  } catch (e) {
    body.innerHTML = `<div class="empty"><b>No se pudo cargar el ranking</b><small>${esc(e.message)}</small><button class="btn-quiet" id="rankRetry">Reintentar</button></div>`;
    $('rankRetry').onclick = openRanking;
  }
}

// ── Técnicas ───────────────────────────────────────────────
let techReturn = 'home';
function renderTechniques() {
  $('techList').innerHTML = TECH_GUIDE.map((t) => `<li><div class="tech-head"><b>${M.TECH[t.id].name}</b><span class="tag">${t.tier}</span></div><p>${t.text}</p></li>`).join('');
}
$('techBack').addEventListener('click', () => {
  if (techReturn === 'game' && G && !G.done) { techReturn = 'home'; openGame(); } else show('home');
});

// ── Ajustes ────────────────────────────────────────────────
function openSettings() {
  document.querySelectorAll('[data-setting]').forEach((inp) => { inp.checked = !!S.settings[inp.dataset.setting]; });
  renderThemeChips();
  $('settingsDialog').showModal();
}
function renderThemeChips() {
  $('themeChips').innerHTML = THEMES.filter((t) => owns('theme', t)).map((t) => `<button class="chip ${S.equipped.theme === t.id ? 'on' : ''}" data-theme-id="${t.id}">${swatch(t.id)}${t.name}</button>`).join('');
}
$('themeChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-id]');
  if (!b) return;
  equip('theme', b.dataset.themeId);
  renderThemeChips();
});
$('moreThemes').addEventListener('click', () => { $('settingsDialog').close(); openShop('themes'); });
$('settingsBtn').addEventListener('click', openSettings);
document.querySelectorAll('[data-setting]').forEach((inp) => inp.addEventListener('change', () => {
  S.settings[inp.dataset.setting] = inp.checked;
  applyPrefs();
  if (inp.checked && (inp.dataset.setting === 'sound')) fx.sfx.tap();
  if (inp.checked && (inp.dataset.setting === 'haptics')) fx.haptic();
  persist();
  render();
}));

// ── Estadísticas ───────────────────────────────────────────
$('statsBtn').addEventListener('click', () => {
  const best = S.stats.best || {};
  const st = streak();
  const sm = summary(S, TIERS, st);
  let html = `<dl class="stat-total">
    <div><dd>${sm.solved}</dd><dt>Resueltos</dt></div>
    <div><dd>${fmt(sm.time)}</dd><dt>Tiempo total</dt></div>
    <div><dd>${st}</dd><dt>Racha diaria</dt></div>
  </dl>`;
  for (const t of TIERS) {
    const recs = Object.values(prog(t.id).done);
    const stars = recs.reduce((a, r) => a + r.s, 0);
    html += `<div class="stat-row"><span class="s-name">${t.name}</span>
      <span class="s-val"><b>${recs.length}</b> de ${t.levels.length}<br><span class="s-stars"><svg class="st on"><use href="#i-rate"/></svg>${stars}</span></span>
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
for (const id of ['moreDialog', 'settingsDialog', 'statsDialog', 'quickDialog', 'pauseDialog', 'avatarDialog', 'authDialog', 'passwordDialog']) {
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
  if (E.N === 12) {
    const extra = { 0: 10, a: 10, b: 11, c: 12 }[e.key.toLowerCase()];
    if (extra) { inputDigit(extra); return; }
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || (E.N === 9 && e.key === '0')) { $('eraseBtn').click(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key.toLowerCase() === 'n') { notesMode = !notesMode; render(); return; }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) {
    e.preventDefault();
    const n = E.N;
    if (sel < 0) { select(Math.floor(E.NN / 2)); return; }
    select(((E.ROW_OF[sel] + mv[0] + n) % n) * n + ((E.COL_OF[sel] + mv[1] + n) % n));
  }
});

// ── Arranque ───────────────────────────────────────────────
// Enlaces del correo (activar cuenta o recuperar contraseña)
async function handleRedirect(redirect) {
  if (!redirect) return false;
  if (redirect.type === 'error') { show('home'); toast(redirect.message, 3600); return true; }
  if (!cloud.user()) return false;
  let name;
  try { name = localStorage.getItem('azulejo.pendingName') || undefined; localStorage.removeItem('azulejo.pendingName'); } catch (_) { /* nada */ }
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  show('home');
  await afterLogin({ name });
  if (redirect.type === 'recovery') { $('passMsg').textContent = ''; $('newPass').value = ''; $('passwordDialog').showModal(); }
  else toast('Cuenta activada. Tu progreso ya se guarda en la nube.', 3200);
  return true;
}
addEventListener('hashchange', async () => { await handleRedirect(await cloud.consumeRedirect()); });

async function boot() {
  setAppHeight();
  useProfile(GUEST_KEY, S);
  const redirect = await cloud.consumeRedirect();
  const u = cloud.user();
  if (redirect && redirect.type !== 'error' && u) {
    await handleRedirect(redirect);
  } else if (u) {
    const cached = readState(accountKey(u.id));
    if (cached) {
      useProfile(accountKey(u.id), cached);
      show('home');
      sync.pull();
    } else {
      show('home');
      await afterLogin();
    }
  } else {
    show('home');
    if (redirect?.type === 'error') toast(redirect.message, 3600);
  }
  if (!S.onboarded && !cloud.user()) openWelcome();
  else grantPending();
}
// Logros que ya cumplías (por ejemplo, al venir de la versión anterior)
function grantPending() {
  const ach = unlockAchievements();
  if (!ach.length) return;
  persist();
  renderTopbar();
  const total = ach.reduce((a, x) => a + x.coins, 0);
  toast(ach.length === 1 ? `Logro: ${ach[0].name} (+${total} monedas)` : `Desbloqueaste ${ach.length} logros: +${total} monedas`, 3400);
}
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

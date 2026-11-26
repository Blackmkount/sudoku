// ─────────────────────────────────────────────────────────────
//  Cliente mínimo de Supabase (Auth + REST) sin dependencias
// ─────────────────────────────────────────────────────────────
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let BASE = SUPABASE_URL.replace(/\/+$/, '');
let KEY = SUPABASE_KEY;
// Para pruebas en local se puede apuntar a un servidor simulado
try {
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname) && localStorage.getItem('azulejo.cloud.dev');
  if (dev) { const o = JSON.parse(dev); BASE = o.url; KEY = o.key; }
} catch (_) { /* sin almacenamiento */ }

export const enabled = () => !!(BASE && KEY);
export const siteURL = () => location.origin + location.pathname;

const SESSION_KEY = 'azulejo.session';
let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { session = null; }
const listeners = new Set();
export const onSessionChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(session?.user || null));

export const user = () => (enabled() ? session?.user || null : null);

function saveSession() {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (_) { /* nada */ }
}
function setSession(d) {
  const now = Math.floor(Date.now() / 1000);
  session = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || now + (d.expires_in || 3600),
    user: { id: d.user?.id || session?.user?.id, email: d.user?.email || session?.user?.email },
  };
  saveSession();
}
function clearSession() {
  session = null;
  saveSession();
  emit();
}

export class CloudError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Traduce los errores de Supabase a mensajes claros
function toError(status, d) {
  const code = d?.error_code || d?.code || d?.error || '';
  const raw = `${d?.msg || ''} ${d?.error_description || ''} ${d?.message || ''}`.toLowerCase();
  const is = (...xs) => xs.some((x) => String(code).includes(x) || raw.includes(x));
  if (is('invalid_credentials', 'invalid login', 'invalid_grant') && !is('refresh')) return new CloudError('credentials', 'El correo o la contraseña no son correctos.');
  if (is('email_not_confirmed', 'not confirmed')) return new CloudError('unconfirmed', 'Confirma tu correo con el enlace que te enviamos y vuelve a entrar.');
  if (is('user_already_exists', 'already registered', 'already been registered')) return new CloudError('exists', 'Ya existe una cuenta con ese correo. Inicia sesión.');
  if (is('weak_password', 'password should be', 'at least 6')) return new CloudError('weak', 'La contraseña debe tener al menos 6 caracteres.');
  if (is('email_address_invalid', 'invalid email', 'unable to validate email', 'validation_failed')) return new CloudError('email', 'Revisa el correo: no parece válido.');
  if (is('over_email_send_rate_limit', 'rate limit', 'too many')) return new CloudError('rate', 'Demasiados intentos seguidos. Espera unos minutos.');
  if (is('same_password')) return new CloudError('same', 'La nueva contraseña debe ser distinta a la anterior.');
  if (is('refresh_token', 'session_not_found', 'jwt expired') || status === 401) return new CloudError('session', 'Tu sesión caducó. Vuelve a iniciar sesión.');
  return new CloudError('server', 'La nube no respondió bien. Inténtalo de nuevo en un momento.');
}

let refreshing = null;
async function token() {
  if (!session) return null;
  if (Date.now() / 1000 > session.expires_at - 60) {
    refreshing ||= refresh().finally(() => { refreshing = null; });
    await refreshing;
  }
  return session?.access_token || null;
}
async function refresh() {
  try {
    const { data } = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
    setSession(data);
  } catch (e) {
    if (e.code !== 'network') clearSession();
    throw e;
  }
}

async function req(path, { method = 'GET', body, auth = false, headers = {}, keepalive = false } = {}) {
  if (!enabled()) throw new CloudError('disabled', 'La nube todavía no está activada.');
  const h = { apikey: KEY, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth) {
    const t = await token();
    if (!t) throw new CloudError('session', 'Inicia sesión para guardar en la nube.');
    h.Authorization = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, keepalive });
  } catch (_) {
    throw new CloudError('network', 'Sin conexión. Se guardará cuando vuelva internet.');
  }
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!res.ok) {
    const err = toError(res.status, data);
    if (err.code === 'session' && auth) clearSession();
    throw err;
  }
  return { data, res };
}

// ── Cuentas ─────────────────────────────────────────────────
export async function signUp(email, password, name) {
  const { data } = await req(`/auth/v1/signup?redirect_to=${encodeURIComponent(siteURL())}`, {
    method: 'POST', body: { email, password, data: { display_name: name } },
  });
  if (data?.access_token) { setSession(data); emit(); return { confirm: false }; }
  // Si el proyecto pide confirmar el correo, Supabase no devuelve sesión
  if (data && Array.isArray(data.identities) && data.identities.length === 0) {
    throw new CloudError('exists', 'Ya existe una cuenta con ese correo. Inicia sesión.');
  }
  return { confirm: true };
}

export async function signIn(email, password) {
  const { data } = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  setSession(data);
  emit();
}

export async function signOut() {
  try { await req('/auth/v1/logout', { method: 'POST', auth: true }); } catch (_) { /* da igual */ }
  clearSession();
}

export async function recover(email) {
  await req(`/auth/v1/recover?redirect_to=${encodeURIComponent(siteURL())}`, { method: 'POST', body: { email } });
}

export async function updatePassword(password) {
  await req('/auth/v1/user', { method: 'PUT', auth: true, body: { password } });
}

// Al volver de un enlace del correo (confirmación o recuperación) los datos vienen en el #hash
export async function consumeRedirect() {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!h || !/access_token|error/.test(h)) return null;
  const q = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  if (q.get('error')) {
    const expired = /expired/i.test(q.get('error_code') || q.get('error_description') || '');
    return { type: 'error', message: expired ? 'El enlace caducó. Pide uno nuevo.' : 'No se pudo usar el enlace. Pide uno nuevo.' };
  }
  const access = q.get('access_token');
  if (!access || !enabled()) return null;
  const tmp = { access_token: access, refresh_token: q.get('refresh_token'), expires_at: +q.get('expires_at') || 0, expires_in: +q.get('expires_in') || 3600 };
  try {
    const res = await fetch(`${BASE}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${access}` } });
    const u = await res.json();
    if (!res.ok || !u?.id) throw new Error('user');
    setSession({ ...tmp, user: u });
    emit();
    return { type: q.get('type') || 'signup' };
  } catch (_) {
    return { type: 'error', message: 'No se pudo usar el enlace. Pide uno nuevo.' };
  }
}

// ── Datos ───────────────────────────────────────────────────
export async function pullSave() {
  const u = user();
  const { data } = await req(`/rest/v1/saves?user_id=eq.${u.id}&select=state,updated_at`, { auth: true });
  return Array.isArray(data) && data[0] ? data[0] : null;
}

export async function pushSave(state, updatedAt, { keepalive = false } = {}) {
  const u = user();
  await req('/rest/v1/saves?on_conflict=user_id', {
    method: 'POST', auth: true, keepalive,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: u.id, state, updated_at: new Date(updatedAt || Date.now()).toISOString() },
  });
}

export async function pushPlayer(p, { keepalive = false } = {}) {
  const u = user();
  await req('/rest/v1/players?on_conflict=user_id', {
    method: 'POST', auth: true, keepalive,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: u.id, display_name: p.name, avatar: p.avatar, points: p.points, levels_done: p.levels, updated_at: new Date().toISOString() },
  });
}

export async function leaderboard(limit = 50) {
  const { data } = await req(`/rest/v1/players?select=user_id,display_name,avatar,points,levels_done&order=points.desc,updated_at.asc&limit=${limit}`);
  return Array.isArray(data) ? data : [];
}

// Puesto del jugador: cuántos tienen más puntos + 1
export async function rankOf(points) {
  const { res } = await req(`/rest/v1/players?select=user_id&points=gt.${Math.floor(points)}`, {
    method: 'HEAD', headers: { Prefer: 'count=exact' },
  });
  const m = /\/(\d+)/.exec(res.headers.get('content-range') || '');
  return m ? +m[1] + 1 : null;
}

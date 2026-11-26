// Cliente HTTP de la consola. Habla con stack-line-services (/api/platform/*),
// con el contrato de API.md. En desarrollo Vite reenvía /api al backend.

const TOKEN_KEY = 'gestion_token';
const SESSION_KEY = 'gestion_session';
const LOGIN_PATH = '/api/platform/auth/login';

function store() {
  try { return window.sessionStorage; } catch { return null; }
}

export function getToken() { return store()?.getItem(TOKEN_KEY) || null; }
export function setToken(token) { store()?.setItem(TOKEN_KEY, token); }

export function clearSession() {
  store()?.removeItem(TOKEN_KEY);
  store()?.removeItem(SESSION_KEY);
}

export function loadSession() {
  try { return JSON.parse(store()?.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function saveSession(sess) { store()?.setItem(SESSION_KEY, JSON.stringify(sess)); }

export class ApiError extends Error {
  constructor(status, message, { code, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

// Al vencer la sesión se avisa a la app (que vuelve al login) en vez de
// recargar la página: así no se pierde lo que se estaba escribiendo sin aviso.
const listeners = new Set();
export function onUnauthorized(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function send(method, path, body) {
  const token = getToken();
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifica que stack-line-services esté activo.');
  }
  let data = null;
  if (res.status !== 204) {
    try { data = await res.json(); } catch { data = null; }
  }
  return { status: res.status, body: data };
}

export async function request(path, { method = 'GET', body } = {}) {
  const { status, body: data } = await send(method, path, body);
  if (status >= 200 && status < 300) return data;
  if (status === 401 && path !== LOGIN_PATH) {
    clearSession();
    listeners.forEach((fn) => fn());
  }
  throw new ApiError(status, data?.message || 'Error inesperado', { code: data?.code, fields: data?.fields });
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
};

// Funciones del contrato /api/platform (ver API.md).
import { api, setToken, saveSession, clearSession } from './client.js';

const P = '/api/platform';

function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join('').slice(0, 2) || 'OP';
}

export async function login(email, password) {
  const { token, operator } = await api.post(`${P}/auth/login`, { email, password });
  setToken(token);
  const session = { operator: { ...operator, initials: initials(operator.name) } };
  saveSession(session);
  return session;
}

export function logout() { clearSession(); }

export const me = () => api.get(`${P}/auth/me`);

export function listCompanies({ q = '', status = '', plan = '' } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (status) qs.set('status', status);
  if (plan) qs.set('plan', plan);
  const s = qs.toString();
  return api.get(`${P}/companies${s ? `?${s}` : ''}`);
}

export const checkCode = (code) => api.get(`${P}/companies/check-code?code=${encodeURIComponent(code)}`);
// El backend omite listas y mapas vacíos al serializar: se rellenan aquí para
// que las pantallas no truenen con una empresa recién creada.
const lista = (x) => (Array.isArray(x) ? x : []);
const mapa = (x) => (x && typeof x === 'object' ? x : {});
const empresaDetalle = (c) => ({
  ...c, establishments: lista(c.establishments), branches: lista(c.branches),
  admins: lista(c.admins), statusHistory: lista(c.statusHistory),
});
export const getCompany = (id) => api.get(`${P}/companies/${id}`).then(empresaDetalle);
export const createCompany = (payload) => api.post(`${P}/companies`, payload);
export const updateCompany = (id, changes) => api.patch(`${P}/companies/${id}`, changes);
export const changeStatus = (id, status, reason) => api.post(`${P}/companies/${id}/status`, { status, reason });
export const renewInvitation = (companyId, userId) =>
  api.post(`${P}/companies/${companyId}/admins/${userId}/invitation`, {});

/** Permisos por rol de operador (el backend los hace cumplir igual). */
export const can = {
  create: (op) => op?.role === 'owner',
  edit: (op) => op?.role === 'owner',
  changeStatus: (op) => op?.role === 'owner' || op?.role === 'support',
  invite: (op) => op?.role === 'owner',
};

// ── Planes y módulos ──
export const listModules = () => api.get(`${P}/modules`);
const plan = (p) => ({ ...p, modules: lista(p.modules), limits: mapa(p.limits) });
export const suscripcion = (s) => ({
  ...s,
  overrides: { enabled: lista(s.overrides?.enabled), disabled: lista(s.overrides?.disabled) },
  limitOverrides: mapa(s.limitOverrides),
  effective: { ...s.effective, modules: lista(s.effective?.modules), limits: mapa(s.effective?.limits) },
  usage: mapa(s.usage),
});
export const listPlans = () => api.get(`${P}/plans`).then((r) => lista(r).map(plan));
export const createPlan = (p) => api.post(`${P}/plans`, p).then(plan);
export const updatePlan = (id, changes) => api.patch(`${P}/plans/${id}`, changes).then(plan);
export const getSubscription = (companyId) => api.get(`${P}/companies/${companyId}/subscription`).then(suscripcion);
export const saveSubscription = (companyId, sub) => api.put(`${P}/companies/${companyId}/subscription`, sub).then(suscripcion);

export const canManagePlans = (op) => op?.role === 'owner';

// ── Uso y costos ──
const mes = (month) => (month ? `?month=${encodeURIComponent(month)}` : '');
// Como en la suscripción: el backend puede omitir listas vacías; aquí se rellenan.
const usoResumen = (u) => ({
  ...u, fx: u?.fx || { usdToGtq: null }, totals: u?.totals || {},
  items: lista(u?.items).map((i) => ({ ...i, limits: lista(i.limits) })),
});
export const usoEmpresa = (u) => ({
  ...u, fx: u?.fx || { usdToGtq: null },
  ai: {
    turns: 0, calls: 0, tokensIn: 0, tokensCached: 0, tokensOut: 0, ...(u?.ai || {}),
    images: u?.ai?.images || { count: 0, costUsd: 0 },
    byModel: lista(u?.ai?.byModel), byKind: lista(u?.ai?.byKind), byChannel: lista(u?.ai?.byChannel),
  },
  whatsapp: u?.whatsapp || { templates: 0, costUsd: 0 },
  fel: u?.fel || { count: 0 },
  daily: lista(u?.daily), limits: lista(u?.limits), history: lista(u?.history),
});
export const getUsage = (month) => api.get(`${P}/usage${mes(month)}`).then(usoResumen);
export const getCompanyUsage = (companyId, month) => api.get(`${P}/companies/${companyId}/usage${mes(month)}`).then(usoEmpresa);

/** Precios, ingresos, costos y márgenes: solo el dueño (el backend devuelve null al resto). */
export const canSeeMoney = (op) => op?.role === 'owner';

// ── Modelos y agentes (agents-services, vía stack-line-services) ──
// Las listas y nulos pueden no venir si el backend los omite: se completan
// aquí para que las pantallas no tengan que defenderse en cada uso.
const modelo = (m) => ({ usedBy: [], companiesCount: 0, cachedCost1k: null, imageCost: 0, ...m, usedBy: m.usedBy || [] });
const agente = (a) => ({ fallbackModelId: null, imageModelId: null, description: null, companiesCount: 0, tenantAgentsCount: 0, archived: false, ...a, tools: a.tools || [] });
export const getAiCatalog = () => api.get(`${P}/ai/catalog`).then((c) => ({
  providers: c?.providers || [], tools: c?.tools || [], models: (c?.models || []).map(modelo),
}));
export const createModel = (m) => api.post(`${P}/ai/models`, m).then(modelo);
export const updateModel = (id, changes) => api.patch(`${P}/ai/models/${id}`, changes).then(modelo);
export const listAgents = () => api.get(`${P}/ai/agents`).then((l) => (l || []).map(agente));
export const updateAgent = (id, changes) => api.patch(`${P}/ai/agents/${id}`, changes).then(agente);
export const listPrompts = (agentId) => api.get(`${P}/ai/agents/${agentId}/prompts`);
export const createPrompt = (agentId, body, activate = true) => api.post(`${P}/ai/agents/${agentId}/prompts`, { body, activate });
export const activatePrompt = (agentId, promptId) => api.post(`${P}/ai/agents/${agentId}/prompts/${promptId}/activate`, {});

export const createAgentType = (a) => api.post(`${P}/ai/agents`, a).then(agente);
export const archiveAgentType = (id) => api.post(`${P}/ai/agents/${id}/archive`, {}).then(agente);
export const restoreAgentType = (id) => api.post(`${P}/ai/agents/${id}/restore`, {}).then(agente);
export const createProvider = (p) => api.post(`${P}/ai/providers`, p);
export const updateProvider = (id, changes) => api.patch(`${P}/ai/providers/${id}`, changes);

// ── Identidad de Tino (global, versionada) ──
const identidad = (i) => ({ active: i?.active || null, versions: i?.versions || [] });
export const getIdentity = () => api.get(`${P}/ai/identity`).then(identidad);
export const createIdentity = (body, activate = true) => api.post(`${P}/ai/identity`, { body, activate }).then(identidad);
export const activateIdentity = (promptId) => api.post(`${P}/ai/identity/${promptId}/activate`, {}).then(identidad);

// ── Agentes de una empresa (solo consola; el ERP no los ve) ──
const agenteEmpresa = (a) => ({
  modelId: null, fallbackModelId: null, imageModelId: null, temperature: null, tools: null, instructions: null, playbook: null,
  ...a, channelIds: a.channelIds || [], effective: { tools: [], ...(a.effective || {}) },
});
const widgetWeb = (w) => ({ title: null, greeting: null, color: null, tenantAgentId: null, showPrices: true, ...w, allowedOrigins: lista(w.allowedOrigins) });
const planificador = (p) => ({
  title: null, accentColor: null, lang: 'es', fitThresholdPct: 90, retentionDays: 7, maxOptions: 10, contactWhatsapp: null, tenantAgentId: null,
  ...p, allowedOrigins: lista(p.allowedOrigins), projectTypes: lista(p.projectTypes), categoryIds: lista(p.categoryIds),
});
const iaEmpresa = (v) => ({
  policy: { enabled: false, quoteLimit: null, escalationUser: null, tone: null, locale: 'es-GT', ...(v?.policy || {}) },
  channels: v?.channels || [],
  agents: (v?.agents || []).map(agenteEmpresa),
  webChannels: lista(v?.webChannels).map(widgetWeb),
  widgetScriptUrl: v?.widgetScriptUrl || null,
  plannerWidgets: lista(v?.plannerWidgets).map(planificador),
  plannerScriptUrl: v?.plannerScriptUrl || null,
  // null = el ERP no respondió (no es lo mismo que una empresa sin categorías).
  catalogCategories: v?.catalogCategories == null ? null : lista(v.catalogCategories),
});
const A = (companyId) => `${P}/companies/${companyId}/agents`;
export const getCompanyAgents = (companyId) => api.get(A(companyId)).then(iaEmpresa);
export const saveCompanyAiPolicy = (companyId, policy) => api.put(`${A(companyId)}/policy`, policy).then(iaEmpresa);
export const createCompanyAgent = (companyId, agent) => api.post(A(companyId), agent).then(iaEmpresa);
export const updateCompanyAgent = (companyId, id, changes) => api.patch(`${A(companyId)}/${id}`, changes).then(iaEmpresa);
export const archiveCompanyAgent = (companyId, id) => api.post(`${A(companyId)}/${id}/archive`, {}).then(iaEmpresa);
export const listAgentInstructions = (companyId, id) => api.get(`${A(companyId)}/${id}/instructions`).then((l) => l || []);
export const createAgentInstructions = (companyId, id, body, activate = true) =>
  api.post(`${A(companyId)}/${id}/instructions`, { body, activate }).then((l) => l || []);
export const activateAgentInstructions = (companyId, id, versionId) =>
  api.post(`${A(companyId)}/${id}/instructions/${versionId}/activate`, {}).then((l) => l || []);
export const clearAgentInstructions = (companyId, id) => api.post(`${A(companyId)}/${id}/instructions/clear`, {}).then((l) => l || []);
export const saveAgentPlaybook = (companyId, id, config) => api.put(`${A(companyId)}/${id}/playbook`, { config }).then(iaEmpresa);
// WhatsApp: números de la cuenta de Stackline en Meta (por su phone_number_id).
export const lookupWhatsApp = (companyId, phoneNumberId) =>
  api.get(`${A(companyId)}/whatsapp/lookup?phoneNumberId=${encodeURIComponent(phoneNumberId)}`);
export const connectWhatsApp = (companyId, body) => api.post(`${A(companyId)}/whatsapp-channels`, body).then(iaEmpresa);
export const disconnectWhatsApp = (companyId, channelId) =>
  api.post(`${A(companyId)}/whatsapp-channels/${channelId}/disconnect`, {}).then(iaEmpresa);
// Canal web: widgets de chat para la página de la empresa.
export const createWebChannel = (companyId, w) => api.post(`${A(companyId)}/web-channels`, w).then(iaEmpresa);
export const updateWebChannel = (companyId, id, changes) => api.patch(`${A(companyId)}/web-channels/${id}`, changes).then(iaEmpresa);
// Planificador por presupuesto: bloque para la página de la empresa (sin cotización en el ERP).
export const createPlannerWidget = (companyId, p) => api.post(`${A(companyId)}/planner-widgets`, p).then(iaEmpresa);
export const updatePlannerWidget = (companyId, id, changes) => api.patch(`${A(companyId)}/planner-widgets/${id}`, changes).then(iaEmpresa);

/** Quién cambia qué: catálogo, agentes y ajustes, solo el dueño; instrucciones y playbook, también soporte. */
export const canManageAi = (op) => op?.role === 'owner';
export const canEditPlaybook = (op) => op?.role === 'owner' || op?.role === 'support';

// Planes, módulos y límites. La misma regla que aplica el backend (API.md):
//
//   módulos efectivos = base ∪ (módulos del plan ∪ activados) − desactivados
//   límite efectivo   = excepción de la empresa ?? límite del plan
//
// `null` en un límite significa ilimitado.

export const BASE = 'base';

/** Límites que se controlan, en el orden en que se muestran. */
export const LIMIT_KEYS = ['maxUsers', 'maxBranches', 'maxFelPerMonth', 'maxAiMessagesPerMonth'];

/** Qué medida de uso corresponde a cada límite. */
export const USAGE_OF = {
  maxUsers: 'users',
  maxBranches: 'branches',
  maxFelPerMonth: 'felThisMonth',
  maxAiMessagesPerMonth: 'aiMessagesThisMonth',
};

/**
 * Deja las excepciones en su forma mínima: solo se "activa" lo que el plan no
 * trae y solo se "desactiva" lo que sí trae. Base nunca se desactiva.
 */
export function normalizeOverrides(planModules, { enabled = [], disabled = [] } = {}) {
  const enPlan = new Set(planModules);
  return {
    enabled: [...new Set(enabled)].filter((m) => m !== BASE && !enPlan.has(m)).sort(),
    disabled: [...new Set(disabled)].filter((m) => m !== BASE && enPlan.has(m)).sort(),
  };
}

export function effectiveModules(planModules, overrides = {}) {
  const { enabled, disabled } = normalizeOverrides(planModules, overrides);
  const set = new Set([BASE, ...planModules, ...enabled]);
  disabled.forEach((m) => set.delete(m));
  return [...set];
}

export function effectiveLimits(planLimits = {}, limitOverrides = {}) {
  return Object.fromEntries(LIMIT_KEYS.map((k) => [
    k,
    limitOverrides[k] !== undefined && limitOverrides[k] !== null ? limitOverrides[k] : (planLimits[k] ?? null),
  ]));
}

/** De dónde sale cada módulo para una empresa: 'base' | 'plan' | 'added' | 'removed' | 'off'. */
export function moduleSource(code, planModules, overrides = {}) {
  if (code === BASE) return 'base';
  const { enabled, disabled } = normalizeOverrides(planModules, overrides);
  if (enabled.includes(code)) return 'added';
  if (disabled.includes(code)) return 'removed';
  return planModules.includes(code) ? 'plan' : 'off';
}

/** Uso frente a límite: 'ok' | 'near' (≥ 80 %) | 'over'. Sin límite, siempre 'ok'. */
export function usageLevel(used, limit) {
  if (limit === null || limit === undefined) return 'ok';
  if (used > limit) return 'over';
  return used >= limit * 0.8 ? 'near' : 'ok';
}

/** Entero ≥ 0, o null si el campo queda vacío (ilimitado). Lanza si no es válido. */
export function parseLimit(raw) {
  const v = String(raw ?? '').trim();
  if (v === '') return null;
  if (!/^\d+$/.test(v)) throw new Error('invalid');
  return Number(v);
}

/** Precio en quetzales (≥ 0, hasta 2 decimales), o null si queda vacío. Lanza si no es válido. */
export function parsePrice(raw) {
  const v = String(raw ?? '').trim().replace(/,/g, '');
  if (v === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) throw new Error('invalid');
  return Number(v);
}

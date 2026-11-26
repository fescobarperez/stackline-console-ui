// Estados de una empresa y las transiciones que permite la plataforma.
// Es la misma tabla que API.md: el backend la hace cumplir y el front solo
// ofrece lo que se puede (y explica por qué no lo demás).

export const STATUSES = ['trial', 'active', 'suspended', 'cancelled'];

export const TRANSITIONS = {
  trial: ['active', 'suspended', 'cancelled'],
  active: ['suspended', 'cancelled'],
  suspended: ['active', 'cancelled'],
  cancelled: [],
};

/** Clase de badge-m3 para cada estado. */
export const STATUS_BADGE = {
  trial: 'neutral',
  active: 'success',
  suspended: 'warning',
  cancelled: 'danger',
};

export function allowedTransitions(status) {
  return TRANSITIONS[status] || [];
}

export function canTransition(from, to) {
  return allowedTransitions(from).includes(to);
}

/** Suspender o cancelar exige un motivo: queda en el historial. */
export function needsReason(to) {
  return to === 'suspended' || to === 'cancelled';
}

/**
 * Código de empresa: el que se escribe en el login junto al correo.
 * Mayúsculas, letras, números y guiones; 3 a 20 caracteres.
 */
export function normalizeCode(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '')
    .slice(0, 20);
}

export function isValidCode(code) {
  return /^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$/.test(code);
}

/** Propuesta de código a partir del nombre comercial. */
export function suggestCode(name) {
  return normalizeCode(String(name || '').replace(/\s+/g, ''));
}

/** NIT guatemalteco: dígitos con verificador opcional (K o dígito), o CF. */
export function isValidNit(nit) {
  const v = String(nit || '').trim().toUpperCase();
  return v === 'CF' || /^\d{1,12}-?[\dK]$/.test(v);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

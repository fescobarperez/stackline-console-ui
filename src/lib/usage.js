// Uso y costos por empresa. Las mismas reglas que aplica el backend (API.md):
//
//   costo de una llamada (USD) = ((tokens_in − cacheados) × precio entrada
//                                 + cacheados × precio cacheado
//                                 + tokens_out × precio salida) / 1000
//   costo de un render (USD)   = precio por imagen del modelo de imágenes
//   ingreso del mes (GTQ)      = precio vigente si la empresa estuvo activa; prueba,
//                                suspendida o cancelada no facturan
//   margen (GTQ)               = ingreso − costo × tipo de cambio
//
// Un «mensaje de IA» (lo que cuenta contra el límite del plan) es un turno del
// cliente que el agente respondió, aunque por dentro haya hecho varias llamadas
// al modelo (respaldo, resumen).

/** Costo en USD de una llamada. `tokensIn` incluye los cacheados (así lo reporta el proveedor). */
export function runCostUsd({ tokensIn = 0, tokensCached = 0, tokensOut = 0 }, { inputCost1k = 0, cachedCost1k, outputCost1k = 0 }) {
  const cacheados = Math.min(tokensCached, tokensIn);
  const precioCache = cachedCost1k ?? inputCost1k;
  return ((tokensIn - cacheados) * inputCost1k + cacheados * precioCache + tokensOut * outputCost1k) / 1000;
}

/**
 * Costo en USD de las imágenes de ejemplo (renders): cada una al precio por
 * imagen del modelo, congelado en `render_jobs.cost_usd`. Un render fallido
 * también cuenta: el proveedor lo cobra igual.
 */
export const imagesCostUsd = (count, imageCost = 0) => (count || 0) * (imageCost || 0);

/** Solo una empresa activa factura; la prueba es costo de adquisición. */
export function revenueGtq(status, priceGtq) {
  return status === 'active' ? (priceGtq ?? 0) : 0;
}

const r2 = (n) => Math.round(n * 100) / 100;

/** Margen del mes. `marginPct` es null cuando no hay ingreso (no hay sobre qué calcularlo). */
export function marginOf(revenue, costUsd, usdToGtq) {
  const costGtq = r2(costUsd * usdToGtq);
  const margin = r2(revenue - costGtq);
  return { costGtq, marginGtq: margin, marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : null };
}

/**
 * Cómo se ve el margen: 'negative' (pierde dinero), 'low' (< 60 %), 'ok' o
 * 'none' (no factura y no cuesta).
 */
export function marginLevel(marginGtq, marginPct) {
  if (marginGtq < 0) return 'negative';
  if (marginPct == null) return 'none';
  return marginPct < 60 ? 'low' : 'ok';
}

/** 'YYYY-MM' del instante dado (hora de Guatemala no cambia el mes salvo en el borde; se usa UTC−6). */
export function monthKey(date = new Date()) {
  const d = new Date(new Date(date).getTime() - 6 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const isValidMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));

/** Los últimos `n` meses, del más reciente al más antiguo. */
export function lastMonths(n = 6, now = new Date()) {
  const [y, m] = monthKey(now).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Días del mes: todos si ya cerró; hasta hoy si es el mes en curso. */
export function daysOf(month, now = new Date()) {
  const [y, m] = month.split('-').map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const hasta = month === monthKey(now) ? Number(new Date(now.getTime() - 6 * 3600000).getUTCDate()) : total;
  return Array.from({ length: hasta }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** Límites cerca o por encima, para las alertas. */
export const alertsOf = (limits = []) => limits.filter((l) => l.level === 'near' || l.level === 'over');

// Planificador por presupuesto: las mismas reglas que valida agents-services
// (PlannerWidgetRules), para avisar en el formulario antes de guardar.

export const MAX_TYPES = 12;
export const MAX_CATEGORIES = 12;
export const DEFAULT_ACCENT = '#8B6549';
export const FIT = { min: 50, max: 100, def: 90 };
export const RETENTION = { min: 1, max: 90, def: 7 };
export const OPTIONS = { min: 1, max: 26, def: 10 };
export const LANGS = ['es', 'en'];

const CODE = /^[a-z][a-z0-9_]{0,39}$/;

/** Código de un tipo a partir de su nombre: «Pérgola de madera» → «pergola_de_madera». */
export function typeCode(label) {
  const base = String(label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!base) return '';
  return /^[a-z]/.test(base) ? base : `t_${base}`.slice(0, 40);
}

export const validCode = (c) => CODE.test(String(c || ''));

/** «+502 1234-5678» → «50212345678»; null si no son 8 a 15 dígitos (con código de país, sin el +). */
export function normalizeWhatsapp(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (!/^[0-9 +\-().]+$/.test(s)) return null;
  const d = s.replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

/**
 * Valida los tipos de proyecto del formulario ([{ label, code, productId }]).
 * Devuelve { types, error } con los tipos listos para mandar o el primer error.
 */
export function parseTypes(rows) {
  const limpios = rows.map((r) => ({ label: String(r.label || '').trim(), code: String(r.code || '').trim(), productId: String(r.productId ?? '').trim() }))
    .filter((r) => r.label || r.code || r.productId);
  // Sin tipos también vale: el planificador puede trabajar solo con categorías.
  if (!limpios.length) return { types: [] };
  if (limpios.length > MAX_TYPES) return { error: 'max' };
  const vistos = new Set();
  const types = [];
  for (let i = 0; i < limpios.length; i += 1) {
    const r = limpios[i];
    if (!r.label || r.label.length > 40) return { error: 'label', index: i };
    if (!validCode(r.code)) return { error: 'code', index: i };
    if (vistos.has(r.code)) return { error: 'dup', index: i, code: r.code };
    if (!/^\d{1,18}$/.test(r.productId) || Number(r.productId) <= 0) return { error: 'product', index: i };
    vistos.add(r.code);
    types.push({ code: r.code, label: r.label, productId: Number(r.productId) });
  }
  return { types };
}

/**
 * El código que la empresa pega donde quiere el planificador (un bloque, no una
 * burbuja). En una línea: el campo de copiar es de una sola línea.
 */
export function plannerSnippet(scriptUrl, publicKey, lang = 'es') {
  return `<div id="planificador"></div><script src="${scriptUrl}" data-key="${publicKey}" data-target="#planificador" data-lang="${lang}" async></script>`;
}

/**
 * Las categorías del ERP en orden de lectura: cada raíz y debajo sus
 * subcategorías, con su nivel (`depth`) para la sangría. Tolera ciclos y
 * padres que no vinieron (quedan como raíz).
 */
export function categoryTree(cats) {
  const lista = Array.isArray(cats) ? cats : [];
  const ids = new Set(lista.map((c) => c.id));
  const out = [];
  const vistos = new Set();
  const bajar = (padre, depth) => {
    lista.filter((c) => (padre == null ? c.parentId == null || !ids.has(c.parentId) : c.parentId === padre))
      .forEach((c) => {
        if (vistos.has(c.id)) return;
        vistos.add(c.id);
        out.push({ id: c.id, name: c.name, depth });
        bajar(c.id, depth + 1);
      });
  };
  bajar(null, 0);
  return out;
}

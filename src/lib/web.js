// Canal web (widget de chat): las mismas reglas de dominios que valida
// agents-services (WebOrigins), para avisar en el formulario antes de guardar.

const FORMA = /^(https?):\/\/(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*)(:(\d{1,5}))?$/;
const LOCALES = new Set(['localhost', '127.0.0.1']);
export const MAX_ORIGINS = 10;

/** Forma canónica de un dominio permitido, o null si no es válido. */
export function normalizeOrigin(entrada) {
  const s = String(entrada ?? '').trim().toLowerCase().replace(/\/+$/, '');
  const m = FORMA.exec(s);
  if (!m) return null;
  const [, esquema, comodin, host, , , , , puerto] = m;
  if (puerto && !(Number(puerto) >= 1 && Number(puerto) <= 65535)) return null;
  const local = LOCALES.has(host);
  if (esquema === 'http' && !local) return null;
  if (comodin && (local || !host.includes('.'))) return null;
  if (!local && !host.includes('.')) return null;
  return s;
}

/** Texto del formulario (uno por línea o separados por coma) → { valid, invalid }. */
export function parseOrigins(texto) {
  const crudos = String(texto ?? '').split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
  const invalid = crudos.filter((x) => normalizeOrigin(x) == null);
  const valid = [...new Set(crudos.map(normalizeOrigin).filter(Boolean))];
  return { valid, invalid };
}

/** El código que la empresa pega antes de </body>. */
export function widgetSnippet(scriptUrl, publicKey) {
  return `<script src="${scriptUrl}" data-key="${publicKey}" charset="utf-8" async></script>`;
}

export const DEFAULT_COLOR = '#731C37';

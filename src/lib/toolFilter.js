// Búsqueda y páginas de listas largas (herramientas, modelos).

const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Los elementos cuyo texto (`textOf`) contiene todas las palabras de `q`, sin tildes ni mayúsculas. */
export function filterItems(items, q, textOf) {
  const palabras = plano(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return items;
  return items.filter((x) => {
    const texto = plano(textOf(x));
    return palabras.every((p) => texto.includes(p));
  });
}

/** Las herramientas que contienen todas las palabras de `q` en su nombre, grupo o descripción. */
export const filterTools = (tools, q) => filterItems(tools, q, (x) => `${x.name} ${x.group || ''} ${x.description || ''}`);

/** Una página de la lista; la página se acota si la lista se achica. */
export function pageOf(items, page, size) {
  const total = Math.max(1, Math.ceil(items.length / size));
  const actual = Math.min(Math.max(0, page), total - 1);
  return { items: items.slice(actual * size, actual * size + size), page: actual, total };
}

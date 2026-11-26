# Guía para trabajar en stack-line-gestion-ui

- Textos siempre con `t('clave', 'Texto en español')` y la clave en
  `src/i18n/locales/es` y `en`. Hay tests que fallan si falta una.
- Toasts con `useToast()`: tipos `''`, `'success'`, `'danger'`.
- Sin tamaños de letra a mano en los módulos: usa las clases de
  `global.css` / `console.css`.
- Secciones con el estándar de `console.css`: `.section` / `.subsection` /
  `.section-card` (dos niveles de título, una sola tarjeta).
- Responsivo igual que stack-line-ui: `DataTable` con `cards`, tablas a mano
  con `tbl-stack`, breakpoints de `src/lib/breakpoints.js`.
- Cualquier cambio en la API va primero a `API.md` y luego al backend
  (stack-line-services). En los tests, el backend se falsea con `vi.mock`
  de `src/api/platform.js`.
- Revisa las pantallas en el navegador (escritorio, tablet y teléfono)
  después de cambiar algo.

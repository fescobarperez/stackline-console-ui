import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import es from './locales/es/translation.json';

// Toda llamada t('clave', 'Texto') debe tener su clave en es (y por el otro
// test, también en en): así no se escapa un texto sin traducir.
function archivos(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? archivos(p) : /\.(jsx?|js)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}
const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);

describe('claves de i18n', () => {
  it('cada t() usado en el código existe en es', () => {
    const faltan = [];
    for (const f of archivos(join(__dirname, '..'))) {
      for (const [, k] of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (typeof get(es, k) !== 'string') faltan.push(`${k} (${f})`);
      }
    }
    expect(faltan).toEqual([]);
  });
});

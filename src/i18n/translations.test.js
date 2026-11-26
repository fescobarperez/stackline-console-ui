import { describe, expect, it } from 'vitest';
import es from './locales/es/translation.json';
import en from './locales/en/translation.json';

const claves = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  (v && typeof v === 'object' ? claves(v, `${p}${k}.`) : [`${p}${k}`]));

describe('traducciones', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(claves(en).sort()).toEqual(claves(es).sort());
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeOrigin, parseOrigins, widgetSnippet } from './web.js';

describe('dominios del widget', () => {
  it('acepta https, subdominios con comodín y http solo en localhost', () => {
    expect(normalizeOrigin(' HTTPS://www.Ejemplo.com/ ')).toBe('https://www.ejemplo.com');
    expect(normalizeOrigin('https://*.ejemplo.com')).toBe('https://*.ejemplo.com');
    expect(normalizeOrigin('http://localhost:5173')).toBe('http://localhost:5173');
    expect(normalizeOrigin('http://ejemplo.com')).toBeNull();
    expect(normalizeOrigin('https://ejemplo.com/tienda')).toBeNull();
    expect(normalizeOrigin('ejemplo.com')).toBeNull();
    expect(normalizeOrigin('https://*.com')).toBeNull();
    expect(normalizeOrigin('https://ejemplo.com:99999')).toBeNull();
  });

  it('separa por línea o coma, quita repetidos y reporta los inválidos', () => {
    expect(parseOrigins('https://a.com\nhttps://A.com/, ejemplo.com\n\n')).toEqual({ valid: ['https://a.com'], invalid: ['ejemplo.com'] });
  });

  it('arma el script con la llave', () => {
    expect(widgetSnippet('https://x.gt/v1/web/widget.js', 'wk_1')).toBe('<script src="https://x.gt/v1/web/widget.js" data-key="wk_1" charset="utf-8" async></script>');
  });
});

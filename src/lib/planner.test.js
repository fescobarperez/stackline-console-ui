import { describe, expect, it } from 'vitest';
import { typeCode, validCode, normalizeWhatsapp, parseTypes, plannerSnippet, categoryTree, MAX_TYPES } from './planner.js';

describe('planificador', () => {
  it('el código del tipo sale del nombre, sin tildes ni espacios', () => {
    expect(typeCode('Pérgola de madera')).toBe('pergola_de_madera');
    expect(typeCode('  Deck  ')).toBe('deck');
    expect(typeCode('3 aguas')).toBe('t_3_aguas');
    expect(typeCode('¿?')).toBe('');
    expect(validCode('pergola')).toBe(true);
    expect(validCode('Pergola')).toBe(false);
    expect(validCode('3d')).toBe(false);
  });

  it('el WhatsApp queda en dígitos con código de país', () => {
    expect(normalizeWhatsapp('+502 1234-5678')).toBe('50212345678');
    expect(normalizeWhatsapp('')).toBe('');
    expect(normalizeWhatsapp('1234')).toBeNull();
    expect(normalizeWhatsapp('llámame')).toBeNull();
  });

  it('valida los tipos de proyecto como agents-services', () => {
    expect(parseTypes([{ label: 'Pérgola', code: 'pergola', productId: '501' }, { label: '', code: '', productId: '' }]))
      .toEqual({ types: [{ code: 'pergola', label: 'Pérgola', productId: 501 }] });
    // Sin tipos también vale: el planificador puede ir solo con categorías.
    expect(parseTypes([{ label: '', code: '', productId: '' }])).toEqual({ types: [] });
    expect(parseTypes([])).toEqual({ types: [] });
    expect(parseTypes([{ label: 'Deck', code: 'deck', productId: '' }])).toMatchObject({ error: 'product', index: 0 });
    expect(parseTypes([{ label: 'Deck', code: 'Deck', productId: '2' }])).toMatchObject({ error: 'code', index: 0 });
    expect(parseTypes([
      { label: 'Deck', code: 'deck', productId: '1' }, { label: 'Deck 2', code: 'deck', productId: '2' },
    ])).toMatchObject({ error: 'dup', index: 1, code: 'deck' });
    const muchos = Array.from({ length: MAX_TYPES + 1 }, (_, i) => ({ label: `T${i}`, code: `t${i}`, productId: String(i + 1) }));
    expect(parseTypes(muchos).error).toBe('max');
  });

  it('el código para la página es un bloque con su destino', () => {
    expect(plannerSnippet('https://app/v1/planner/embed.js', 'pk_X', 'en'))
      .toBe('<div id="planificador"></div><script src="https://app/v1/planner/embed.js" data-key="pk_X" data-target="#planificador" data-lang="en" async></script>');
  });

  it('las categorías del ERP salen en árbol, con su nivel', () => {
    const cats = [
      { id: 17, name: 'Juegos', parentId: 16 }, { id: 2, name: 'Pérgolas', parentId: null },
      { id: 16, name: 'Jardines', parentId: null }, { id: 18, name: 'Columpios', parentId: 17 },
      { id: 9, name: 'Huérfana', parentId: 99 },
    ];
    expect(categoryTree(cats)).toEqual([
      { id: 2, name: 'Pérgolas', depth: 0 },
      { id: 16, name: 'Jardines', depth: 0 }, { id: 17, name: 'Juegos', depth: 1 }, { id: 18, name: 'Columpios', depth: 2 },
      { id: 9, name: 'Huérfana', depth: 0 },
    ]);
    expect(categoryTree(null)).toEqual([]);
    expect(categoryTree([{ id: 1, name: 'A', parentId: 2 }, { id: 2, name: 'B', parentId: 1 }])).toEqual([]);
  });
});

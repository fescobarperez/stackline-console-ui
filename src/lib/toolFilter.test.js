import { describe, expect, it } from 'vitest';
import { filterTools, pageOf } from './toolFilter.js';

const tools = [
  { name: 'productos.search', group: 'productos', description: 'Busca productos por nombre' },
  { name: 'cotizacion.diseno', group: 'cotizacion', description: 'Anota la ficha de diseño' },
  { name: 'cotizaciones.issue', group: 'cotizaciones', description: 'Emite la cotización' },
];

describe('filterTools', () => {
  it('sin texto devuelve todas', () => expect(filterTools(tools, '  ')).toHaveLength(3));
  it('busca en nombre y descripción, sin tildes ni mayúsculas', () => {
    expect(filterTools(tools, 'DISENO').map((x) => x.name)).toEqual(['cotizacion.diseno']);
    expect(filterTools(tools, 'cotización emite').map((x) => x.name)).toEqual(['cotizaciones.issue']);
  });
});

describe('pageOf', () => {
  it('parte en páginas y acota la página fuera de rango', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(pageOf(items, 1, 3)).toEqual({ items: [4, 5, 6], page: 1, total: 3 });
    expect(pageOf(items, 9, 3)).toEqual({ items: [7], page: 2, total: 3 });
    expect(pageOf([], 0, 3)).toEqual({ items: [], page: 0, total: 1 });
  });
});

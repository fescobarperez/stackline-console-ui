import { describe, expect, it } from 'vitest';
import {
  normalizeOverrides, effectiveModules, effectiveLimits, moduleSource, usageLevel, parseLimit,
} from './plans.js';
import { parsePrice } from './plans.js';

const PLAN = ['base', 'pos', 'fel'];

describe('excepciones por empresa', () => {
  it('solo activa lo que el plan no trae y solo quita lo que sí trae; base no se quita', () => {
    expect(normalizeOverrides(PLAN, { enabled: ['pos', 'quotes'], disabled: ['base', 'fel', 'ai'] }))
      .toEqual({ enabled: ['quotes'], disabled: ['fel'] });
  });

  it('módulos efectivos = base + plan + activados − desactivados', () => {
    expect(effectiveModules(PLAN, { enabled: ['quotes'], disabled: ['pos'] }).sort())
      .toEqual(['base', 'fel', 'quotes']);
    expect(effectiveModules([], {})).toEqual(['base']);
  });

  it('origen de cada módulo', () => {
    const ov = { enabled: ['quotes'], disabled: ['pos'] };
    expect(moduleSource('base', PLAN, ov)).toBe('base');
    expect(moduleSource('fel', PLAN, ov)).toBe('plan');
    expect(moduleSource('quotes', PLAN, ov)).toBe('added');
    expect(moduleSource('pos', PLAN, ov)).toBe('removed');
    expect(moduleSource('ai', PLAN, ov)).toBe('off');
  });
});

describe('límites', () => {
  it('la excepción gana sobre el plan; null es ilimitado', () => {
    expect(effectiveLimits({ maxUsers: 5, maxBranches: 1 }, { maxUsers: 10 }))
      .toEqual({ maxUsers: 10, maxBranches: 1, maxFelPerMonth: null, maxAiMessagesPerMonth: null });
  });

  it('nivel de uso', () => {
    expect(usageLevel(3, null)).toBe('ok');
    expect(usageLevel(8, 10)).toBe('near');
    expect(usageLevel(11, 10)).toBe('over');
  });

  it('lee el campo del límite', () => {
    expect(parseLimit('')).toBeNull();
    expect(parseLimit(' 25 ')).toBe(25);
    expect(() => parseLimit('2.5')).toThrow();
  });

  it('precio: vacío es null; acepta comas de miles y hasta 2 decimales', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('1,200.50')).toBe(1200.5);
    expect(parsePrice('0')).toBe(0);
    expect(() => parsePrice('-1')).toThrow();
    expect(() => parsePrice('10.555')).toThrow();
    expect(() => parsePrice('abc')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import {
  runCostUsd, imagesCostUsd, revenueGtq, marginOf, marginLevel, monthKey, isValidMonth, lastMonths, daysOf, alertsOf,
} from './usage.js';

const GPT4O = { inputCost1k: 0.0025, cachedCost1k: 0.00125, outputCost1k: 0.01 };

describe('uso y costos', () => {
  it('el costo cobra los cacheados a su precio, no dos veces', () => {
    // 3000 normales × 0.0025 + 2000 cacheados × 0.00125 + 400 × 0.01 = 0.0075 + 0.0025 + 0.004
    expect(runCostUsd({ tokensIn: 5000, tokensCached: 2000, tokensOut: 400 }, GPT4O)).toBeCloseTo(0.014, 6);
  });

  it('sin precio de cacheado, se cobran como entrada normal', () => {
    expect(runCostUsd({ tokensIn: 1000, tokensCached: 1000, tokensOut: 0 }, { inputCost1k: 0.002, outputCost1k: 0 })).toBeCloseTo(0.002, 6);
  });

  it('solo factura una empresa activa', () => {
    expect(revenueGtq('active', 1200)).toBe(1200);
    expect(revenueGtq('trial', 1200)).toBe(0);
    expect(revenueGtq('suspended', 1200)).toBe(0);
  });

  it('margen en quetzales y porcentaje; sin ingreso no hay porcentaje', () => {
    expect(marginOf(1000, 10, 7.75)).toEqual({ costGtq: 77.5, marginGtq: 922.5, marginPct: 92.3 });
    expect(marginOf(0, 2, 7.75)).toEqual({ costGtq: 15.5, marginGtq: -15.5, marginPct: null });
  });

  it('nivel del margen', () => {
    expect(marginLevel(-1, null)).toBe('negative');
    expect(marginLevel(0, null)).toBe('none');
    expect(marginLevel(100, 40)).toBe('low');
    expect(marginLevel(900, 90)).toBe('ok');
  });

  it('meses en hora de Guatemala', () => {
    // 1 de noviembre 03:00 UTC = 31 de octubre 21:00 en Guatemala
    expect(monthKey(new Date('2026-11-01T03:00:00Z'))).toBe('2026-10');
    expect(lastMonths(3, new Date('2026-01-15T12:00:00Z'))).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-02')).toBe(true);
  });

  it('días del mes: completo si cerró, hasta hoy si está en curso', () => {
    const hoy = new Date('2026-10-14T18:00:00Z');
    expect(daysOf('2026-09', hoy)).toHaveLength(30);
    expect(daysOf('2026-10', hoy)).toHaveLength(14);
    expect(daysOf('2026-10', hoy)[0]).toBe('2026-10-01');
  });

  it('alertas: solo lo que está cerca o pasado', () => {
    expect(alertsOf([{ key: 'a', level: 'ok' }, { key: 'b', level: 'near' }, { key: 'c', level: 'over' }]).map((l) => l.key)).toEqual(['b', 'c']);
  });
});

describe('imágenes', () => {
  it('cada render al precio por imagen', () => {
    expect(imagesCostUsd(3, 0.042)).toBeCloseTo(0.126);
    expect(imagesCostUsd(0, 0.042)).toBe(0);
    expect(imagesCostUsd(2, null)).toBe(0);
  });
});

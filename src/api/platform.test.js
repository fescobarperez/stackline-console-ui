import { describe, it, expect, vi } from 'vitest';
vi.mock('./client.js', () => ({ api: {}, setToken: vi.fn(), saveSession: vi.fn(), clearSession: vi.fn() }));
const { suscripcion } = await import('./platform.js');

describe('suscripcion', () => {
  it('rellena listas y mapas que el backend omite cuando vienen vacíos (empresa recién creada)', () => {
    const s = suscripcion({ plan: { id: 1, name: 'Básico' }, effective: { price: 500 }, usage: { users: 1 } });
    expect(s.limitOverrides).toEqual({});
    expect(s.overrides).toEqual({ enabled: [], disabled: [] });
    expect(s.effective).toEqual({ price: 500, modules: [], limits: {} });
    expect(s.usage).toEqual({ users: 1 });
  });
  it('conserva lo que sí viene', () => {
    const s = suscripcion({ overrides: { enabled: ['ai'] }, limitOverrides: { maxUsers: 5 }, effective: { modules: ['base'], limits: { maxUsers: 5 } }, usage: {} });
    expect(s.overrides.enabled).toEqual(['ai']);
    expect(s.limitOverrides.maxUsers).toBe(5);
    expect(s.effective.modules).toEqual(['base']);
  });
});

describe('usoEmpresa', async () => {
  const { usoEmpresa } = await import('./platform.js');
  it('rellena el detalle de uso de una empresa sin consumo', () => {
    const u = usoEmpresa({ month: '2026-10', ai: { turns: 0 } });
    expect(u.ai.byModel).toEqual([]);
    expect(u.ai.images).toEqual({ count: 0, costUsd: 0 });
    expect(u.daily).toEqual([]);
    expect(u.history).toEqual([]);
    expect(u.fel.count).toBe(0);
  });
});

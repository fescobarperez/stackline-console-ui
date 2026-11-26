import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';
import Plans from './Plans.jsx';
import { ToastProvider } from '../components/Toast.jsx';
import { _resetModulesCache } from '../hooks/useCatalog.js';

// Backend falso con lo justo para esta pantalla (el real es /api/platform).
const MODULOS = [
  { code: 'base', name: 'Base', description: '', alwaysOn: true },
  { code: 'fel', name: 'Facturación FEL', description: '', alwaysOn: false },
  { code: 'quotes', name: 'Cotizaciones y proyectos', description: '', alwaysOn: false },
];
const sinLimites = { maxUsers: null, maxBranches: null, maxFelPerMonth: null, maxAiMessagesPerMonth: null };
const api = vi.hoisted(() => ({ planes: [], rol: 'owner' }));
vi.mock('../api/platform.js', async (original) => ({
  ...(await original()),
  listModules: async () => MODULOS,
  listPlans: async () => (api.rol === 'owner' ? api.planes : api.planes.map((p) => ({ ...p, price: null }))),
  createPlan: async (plan) => {
    const nuevo = { ...plan, id: api.planes.length + 1, active: true, companiesCount: 0 };
    api.planes = [...api.planes, nuevo];
    return nuevo;
  },
}));

function montar(role = 'owner') {
  api.rol = role;
  render(<MemoryRouter><ToastProvider><Plans session={{ operator: { role } }} /></ToastProvider></MemoryRouter>);
}

describe('Planes y módulos', () => {
  beforeEach(async () => {
    api.planes = [
      { id: 1, code: 'basico', name: 'Básico', description: null, price: 350, modules: ['base', 'fel'], limits: { ...sinLimites, maxUsers: 3 }, active: true, companiesCount: 3 },
      { id: 2, code: 'comercial', name: 'Comercial', description: null, price: 900, modules: ['base', 'fel', 'quotes'], limits: sinLimites, active: true, companiesCount: 2 },
    ];
    _resetModulesCache();
    await i18n.changeLanguage('es');
  });

  it('lista los planes con sus módulos y cuántas empresas los usan', async () => {
    montar();
    const comercial = (await screen.findByRole('heading', { name: 'Comercial' })).closest('article');
    expect(within(comercial).getByText('Cotizaciones y proyectos')).toBeInTheDocument();
    expect(within(comercial).getByText('2 empresas')).toBeInTheDocument();
  });

  it('soporte no ve los botones de crear ni editar', async () => {
    montar('support');
    await screen.findByRole('heading', { name: 'Básico' });
    expect(screen.queryByRole('button', { name: /Nuevo plan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Q .* al mes$/)).not.toBeInTheDocument();
  });

  it('crea un plan con base siempre incluida', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Básico' });
    await screen.findByRole('button', { name: /Nuevo plan/ });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByRole('button', { name: /Nuevo plan/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Solo FEL' } });
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'solo_fel' } });
    fireEvent.change(screen.getByLabelText('Precio mensual (Q)'), { target: { value: '199.50' } });
    expect(screen.getByRole('checkbox', { name: /Base/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Facturación FEL/ }));
    fireEvent.change(screen.getByLabelText('Usuarios activos'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const tarjeta = (await screen.findByRole('heading', { name: 'Solo FEL' })).closest('article');
    expect(within(tarjeta).getByText('Base')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Facturación FEL')).toBeInTheDocument();
    expect(within(tarjeta).getByText('0 empresas')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Q 199.50 al mes')).toBeInTheDocument();
  });
});

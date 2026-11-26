import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';
import CompanyCreate, { validarPaso } from './CompanyCreate.jsx';
import { ToastProvider } from '../components/Toast.jsx';
import { _resetModulesCache } from '../hooks/useCatalog.js';

// Backend falso con lo justo para el alta (el real es /api/platform).
vi.mock('../api/platform.js', async (original) => ({
  ...(await original()),
  listPlans: async () => [{ id: 1, code: 'basico', name: 'Básico', price: 350, modules: ['base'], limits: {}, active: true, companiesCount: 0 }],
  listModules: async () => [{ code: 'base', name: 'Base', description: '', alwaysOn: true }],
  checkCode: async (code) => ({ available: code !== 'MADERAVIVA' }),
  createCompany: async (p) => ({
    id: 7, code: p.company.code, name: p.company.name, nit: p.company.nit, status: 'trial',
    invitation: { email: p.admin.email, url: 'https://app.stackline.gt/activar?t=abc123', expiresAt: '2026-10-25T00:00:00Z' },
  }),
}));

const t = (_k, d) => d;
const owner = { operator: { id: 1, name: 'Fernando Escobar', role: 'owner' } };

function montar(session = owner) {
  render(<MemoryRouter><ToastProvider><CompanyCreate session={session} /></ToastProvider></MemoryRouter>);
}
const campo = (label) => screen.getByLabelText(label);

describe('alta guiada de empresa', () => {
  beforeEach(async () => { _resetModulesCache(); await i18n.changeLanguage('es'); });

  it('valida cada paso por separado', () => {
    const vacio = {
      company: { name: '', code: 'X', nit: 'ABC' }, establishment: { satCode: '0', commercialName: '' },
      branch: { name: '' }, admin: { name: '', email: 'x' },
    };
    expect(Object.keys(validarPaso(0, vacio, t))).toEqual(['company.name', 'company.code', 'company.nit', 'company.planId']);
    expect(Object.keys(validarPaso(2, vacio, t))).toEqual(['admin.name', 'admin.email']);
  });

  it('el código sigue al nombre y avisa si ya está en uso', async () => {
    montar();
    fireEvent.change(campo('Nombre de la empresa'), { target: { value: 'Madera Viva' } });
    expect(campo('Código de acceso')).toHaveValue('MADERAVIVA');
    expect(await screen.findByText('Ese código ya está en uso')).toBeInTheDocument();
  });

  it('crea la empresa y muestra el enlace de activación', async () => {
    montar();
    fireEvent.change(campo('Nombre de la empresa'), { target: { value: 'Pinturas Sol' } });
    fireEvent.change(campo('NIT'), { target: { value: '5556667-1' } });
    await screen.findByText('Disponible');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(campo('Nombre comercial')).toHaveValue('Pinturas Sol');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    fireEvent.change(campo('Nombre completo'), { target: { value: 'Rosa Pérez' } });
    fireEvent.change(campo('Correo'), { target: { value: 'rosa@sol.gt' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText('PINTURASSOL')).toBeInTheDocument();
    expect(screen.getByText('Básico')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Crear empresa/ }));
    expect(await screen.findByText('Pinturas Sol está lista')).toBeInTheDocument();
    expect(screen.getByLabelText('Enlace de activación para rosa@sol.gt').value).toMatch(/activar\?t=/);
  });

  it('un operador de soporte no ve el formulario', () => {
    montar({ operator: { id: 2, role: 'support' } });
    expect(screen.getByText('Tu rol no permite crear empresas.')).toBeInTheDocument();
  });

  it('no avanza si faltan datos del paso', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument());
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Empresa');
  });
});

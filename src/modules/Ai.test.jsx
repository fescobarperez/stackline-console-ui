import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';
import Ai from './Ai.jsx';
import { ToastProvider } from '../components/Toast.jsx';
import { ConfirmProvider } from '../components/ConfirmDialog.jsx';

// Respuestas crudas de /api/platform/ai (API.md · «IA»). Pasan por la
// normalización real de platform.js: el backend puede omitir listas vacías y
// nulos (el agente interno sin herramientas, el modelo que nadie usa).
const proveedor = { id: 1, code: 'openai', name: 'OpenAI', credentialRef: 'OPENAI_API_KEY', credentialSet: false, active: true };
const modelo = (id, modelName, extra = {}) => ({
  id, providerId: 1, provider: { id: 1, code: 'openai', name: 'OpenAI', credentialSet: false }, modelName,
  contextWindow: 128000, inputCost1k: 0.0025, outputCost1k: 0.01, supportsTools: true,
  supportsCache: true, supportsVision: true, generatesImages: false, imageCost: 0, active: true, companiesCount: 0, ...extra,
});
const RESPUESTAS = {
  '/api/platform/ai/identity': { versions: [] },
  '/api/platform/ai/catalog': {
    providers: [proveedor],
    models: [modelo(1, 'gpt-4o', { usedBy: ['ventas'] }), modelo(2, 'gpt-image-1', { generatesImages: true, imageCost: 0.042, supportsTools: false })],
    tools: [{ name: 'productos.search', mode: 'read', group: 'productos', description: 'Busca' }],
  },
  '/api/platform/ai/agents': [
    {
      id: 1, code: 'ventas', name: 'Ventas (Tino)', kind: 'conversational', description: 'Atiende clientes',
      modelId: 1, imageModelId: 2, temperature: 0.2, maxToolLoops: 5, responseTimeoutMs: 30000, active: true,
      prompt: { id: 1, version: 1, createdAt: '2026-10-01T00:00:00Z' },
      tools: [{ pattern: 'productos.search', mode: 'read', autoApprove: true }], companiesCount: 2,
    },
    {
      id: 2, code: 'resumen', name: 'Resumen de conversacion', kind: 'internal',
      modelId: 1, temperature: 0, maxToolLoops: 0, responseTimeoutMs: 15000, active: true,
      prompt: { id: 2, version: 1, createdAt: '2026-09-26T00:00:00Z' },
    },
  ],
};
vi.mock('../api/client.js', async (original) => ({
  ...(await original()),
  api: { get: async (path) => RESPUESTAS[path], post: async () => ({}), patch: async () => ({}), put: async () => ({}) },
}));

function montar(role = 'owner') {
  render(<MemoryRouter><ToastProvider><ConfirmProvider><Ai session={{ operator: { role } }} /></ConfirmProvider></ToastProvider></MemoryRouter>);
}

describe('Modelos y agentes', () => {
  beforeEach(async () => { await i18n.changeLanguage('es'); });

  it('lista proveedores, modelos y agentes del backend', async () => {
    montar();
    expect((await screen.findAllByText('gpt-image-1')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ventas (Tino)').length).toBeGreaterThan(0);
    expect(screen.getByText('Falta la llave')).toBeInTheDocument();
    // Sin identidad escrita se dice qué pasa, no se muestra vacío.
    expect(screen.getAllByText(/Sin identidad/).length).toBeGreaterThan(0);
  });

  it('edita un agente que llegó sin lista de herramientas', async () => {
    montar();
    const tarjeta = (await screen.findByText('Resumen de conversacion')).closest('article') || document.body;
    const botones = within(tarjeta).getAllByRole('button', { name: /Editar/ });
    fireEvent.click(botones[botones.length - 1]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('soporte no ve los botones de edición', async () => {
    montar('support');
    await screen.findAllByText('gpt-image-1');
    expect(screen.queryByRole('button', { name: /Nuevo modelo/ })).not.toBeInTheDocument();
  });
});

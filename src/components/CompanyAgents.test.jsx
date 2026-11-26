import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '../i18n/index.js';
import i18n from 'i18next';
import CompanyAgents from './CompanyAgents.jsx';
import { ToastProvider } from './Toast.jsx';
import { ConfirmProvider } from './ConfirmDialog.jsx';

// Backend falso con la forma de /api/platform/companies/{id}/agents (API.md).
const modelo = (id, modelName, extra = {}) => ({
  id, providerId: 1, provider: { id: 1, code: 'openai', name: 'OpenAI' }, modelName, contextWindow: 128000,
  inputCost1k: 0, outputCost1k: 0, supportsTools: true, supportsVision: true, generatesImages: false, imageCost: 0, active: true, ...extra,
});
const ventas = {
  id: 1, code: 'ventas', name: 'Ventas (Tino)', kind: 'conversational', active: true, archived: false,
  modelId: 1, fallbackModelId: null, imageModelId: 3, temperature: 0.2, maxToolLoops: 5, responseTimeoutMs: 30000,
  prompt: { id: 1, version: 1, createdAt: '2026-10-01T00:00:00Z' },
  tools: [{ pattern: 'productos.search', mode: 'read', autoApprove: true }, { pattern: 'cotizaciones.issue', mode: 'write', autoApprove: false, maxAmount: 25000 }],
};
/** Lo que un test cambia de la vista de la empresa (se reinicia en cada test). */
let vista = {};
const tenantView = () => ({
  tenantId: 2,
  policy: { enabled: true, quoteLimit: 25000, escalationUser: 'Ana López', tone: 'cercano', locale: 'es-GT' },
  channels: [
    { id: 10, kind: 'whatsapp', accountRef: 'wa:123456', tenantAgentId: 5 },
    { id: null, kind: 'erp', accountRef: 'erp:2', tenantAgentId: null },
  ],
  agents: [{
    id: 5, tenantId: 2, agentId: 1, agentCode: 'ventas', agentName: 'Ventas (Tino)', kind: 'conversational', name: 'Ventas WhatsApp',
    modelId: null, fallbackModelId: null, imageModelId: null, temperature: null,
    effective: { modelId: 1, fallbackModelId: null, imageModelId: 3, temperature: 0.2, tools: ventas.tools },
    tools: null, instructions: null, playbook: null, channelIds: [10], active: true, archived: false, createdAt: '2026-10-01T00:00:00Z',
  }],
  webChannels: [{
    id: 20, name: 'Tienda en línea', publicKey: 'wk_AbCdEfGhIjKlMnOpQrStUvWx', allowedOrigins: ['https://www.maderaviva.gt'],
    title: 'Madera Viva', greeting: null, color: '#2F5D3A', active: true, tenantAgentId: null, createdAt: '2026-10-19T00:00:00Z',
  }],
  widgetScriptUrl: 'https://app.stackline.gt/v1/web/widget.js',
  plannerWidgets: [{
    id: 30, name: 'Planificador Madera Viva', publicKey: 'pk_PlAnNeRpLaNnErPlAnNeR1', allowedOrigins: ['https://www.maderaviva.gt'],
    title: null, accentColor: '#8B6549', lang: 'es', projectTypes: [{ code: 'pergola', label: 'Pérgola', productId: 501 }],
    fitThresholdPct: 90, retentionDays: 7, maxOptions: 10, contactWhatsapp: '50212345678', active: true, tenantAgentId: null,
    createdAt: '2026-11-20T00:00:00Z',
  }],
  plannerScriptUrl: 'https://app.stackline.gt/v1/planner/embed.js',
  catalogCategories: [
    { id: 2, name: 'Pérgolas y Terrazas', parentId: null },
    { id: 16, name: 'Jardines', parentId: null },
    { id: 17, name: 'Juegos', parentId: 16 },
  ],
  ...vista,
});
const enviados = vi.hoisted(() => []);
vi.mock('../api/client.js', async (original) => ({
  ...(await original()),
  api: {
    get: async (path) => ({
      '/api/platform/companies/2/agents': tenantView(),
      '/api/platform/ai/catalog': {
        providers: [], providerCodes: ['openai'],
        models: [modelo(1, 'gpt-4o'), modelo(2, 'gpt-4o-mini'), modelo(3, 'gpt-image-1', { generatesImages: true, supportsTools: false })],
        tools: [
          { name: 'productos.search', mode: 'read', group: 'productos', description: 'Busca' },
          { name: 'cotizaciones.issue', mode: 'write', group: 'cotizaciones', description: 'Emite' },
          { name: 'nomina.read', mode: 'read', group: 'nomina', description: 'Fuera del tipo' },
        ],
      },
      '/api/platform/ai/agents': [ventas],
      '/api/platform/companies/2/subscription': { effective: { modules: ['base', 'ai'] } },
      '/api/platform/companies/2/agents/whatsapp/lookup?phoneNumberId=1098765432': {
        phoneNumberId: '1098765432', displayPhoneNumber: '+502 5555 1234', verifiedName: 'Madera Viva', qualityRating: 'GREEN', status: 'available',
      },
    }[path]),
    post: async (path, body) => { enviados.push({ path, body }); return tenantView(); },
    patch: async (path, body) => { enviados.push({ path, body }); return tenantView(); },
    put: async (path, body) => { enviados.push({ path, body }); return tenantView(); },
  },
}));

function montar(role = 'owner') {
  render(<ToastProvider><ConfirmProvider>
    <CompanyAgents company={{ id: 2, status: 'active' }} operator={{ role }} />
  </ConfirmProvider></ToastProvider>);
}

describe('Agentes de la empresa', () => {
  beforeEach(async () => { enviados.length = 0; vista = {}; await i18n.changeLanguage('es'); });

  it('muestra cada agente con sus canales y lo heredado del tipo', async () => {
    montar();
    const tarjeta = (await screen.findByRole('heading', { name: 'Ventas WhatsApp' })).closest('article');
    expect(within(tarjeta).getByText('WhatsApp · 123456')).toBeInTheDocument();
    expect(within(tarjeta).getByText('gpt-4o')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Todas las del tipo')).toBeInTheDocument();
  });

  it('crea un agente web con menos herramientas y el canal del ERP', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Ventas WhatsApp' });
    fireEvent.click(screen.getByRole('button', { name: /Nuevo agente/ }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: 'Ventas Web' } });
    fireEvent.change(within(dlg).getByLabelText('Modelo'), { target: { value: '2' } });
    fireEvent.click(within(dlg).getByLabelText('Asistente en el ERP'));
    fireEvent.click(within(dlg).getByLabelText('Solo algunas'));
    // Solo se ofrecen las del tipo: la de nómina no aparece.
    expect(within(dlg).queryByText('nomina.read')).not.toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('checkbox', { name: /cotizaciones.issue/ }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0].path).toBe('/api/platform/companies/2/agents');
    expect(enviados[0].body).toMatchObject({
      agentId: 1, name: 'Ventas Web', modelId: 2, tools: ['productos.search'], channelIds: [], includeErp: true,
    });
  });

  it('soporte no crea ni edita agentes', async () => {
    montar('support');
    await screen.findByRole('heading', { name: 'Ventas WhatsApp' });
    expect(screen.queryByRole('button', { name: /Nuevo agente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('crea un chat web con sus dominios y el agente que lo atiende', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Tienda en línea' });
    fireEvent.click(screen.getByRole('button', { name: /Nuevo chat web/ }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: 'Landing' } });
    const dominios = within(dlg).getByLabelText('Dominios permitidos');
    fireEvent.change(dominios, { target: { value: 'maderaviva.gt' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    expect(await within(dlg).findByText(/Dominio inválido: maderaviva.gt/)).toBeInTheDocument();
    expect(enviados).toHaveLength(0);

    fireEvent.change(dominios, { target: { value: 'https://www.maderaviva.gt/\nhttps://*.maderaviva.gt' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0].path).toBe('/api/platform/companies/2/agents/web-channels');
    expect(enviados[0].body).toMatchObject({
      name: 'Landing', allowedOrigins: ['https://www.maderaviva.gt', 'https://*.maderaviva.gt'], tenantAgentId: 5, color: '#731C37',
    });
  });

  it('el chat sin agente avisa y el código trae la llave', async () => {
    montar('support');
    const tarjeta = (await screen.findByRole('heading', { name: 'Tienda en línea' })).closest('article');
    expect(within(tarjeta).getByText('Sin agente')).toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: /Editar/ })).toBeNull();
    fireEvent.click(within(tarjeta).getByRole('button', { name: /Código/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByDisplayValue(/data-key="wk_AbCdEfGhIjKlMnOpQrStUvWx"/)).toBeInTheDocument();
  });

  it('el planificador muestra sus tipos, su WhatsApp y que sin agente no hay chat', async () => {
    montar('support');
    const tarjeta = (await screen.findByRole('heading', { name: 'Planificador Madera Viva' })).closest('article');
    expect(within(tarjeta).getByText('Sin chat')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Pérgola')).toBeInTheDocument();
    expect(within(tarjeta).getByText('+50212345678')).toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: /Editar/ })).toBeNull();
    fireEvent.click(within(tarjeta).getByRole('button', { name: /Código/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByDisplayValue(/data-key="pk_PlAnNeRpLaNnErPlAnNeR1" data-target="#planificador"/)).toBeInTheDocument();
  });

  it('crea un planificador con categorías del ERP y el WhatsApp del asesor', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Planificador Madera Viva' });
    fireEvent.click(screen.getByRole('button', { name: /Nuevo planificador/ }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: 'Pérgolas' } });
    fireEvent.change(within(dlg).getByLabelText('Dominios permitidos'), { target: { value: 'https://www.maderaviva.gt' } });
    // Uno nuevo ya no pide tipos fijos: se eligen categorías del catálogo.
    expect(within(dlg).queryByLabelText('Código')).not.toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText('WhatsApp del asesor'), { target: { value: 'llámame' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    expect(await within(dlg).findByText('Elige al menos una categoría')).toBeInTheDocument();
    expect(within(dlg).getByText(/Número con código de país/)).toBeInTheDocument();
    expect(enviados).toHaveLength(0);

    // Se marcan en cualquier orden; se mandan en el del árbol del ERP.
    fireEvent.click(within(dlg).getByLabelText('Juegos'));
    fireEvent.click(within(dlg).getByLabelText('Pérgolas y Terrazas'));
    fireEvent.change(within(dlg).getByLabelText('WhatsApp del asesor'), { target: { value: '+502 1234 5678' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0].path).toBe('/api/platform/companies/2/agents/planner-widgets');
    expect(enviados[0].body).toMatchObject({
      name: 'Pérgolas', allowedOrigins: ['https://www.maderaviva.gt'],
      categoryIds: [2, 17], projectTypes: [],
      contactWhatsapp: '50212345678', fitThresholdPct: 90, retentionDays: 7, maxOptions: 10, lang: 'es',
      accentColor: '#8B6549', tenantAgentId: 5,
    });
  });

  it('un planificador con tipos fijos los conserva y avisa si el ERP no respondió', async () => {
    vista = { catalogCategories: null };
    montar();
    const titulo = await screen.findByRole('heading', { name: 'Planificador Madera Viva' });
    fireEvent.click(within(titulo.closest('article')).getByRole('button', { name: 'Editar' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/No se pudo leer el catálogo del ERP/)).toBeInTheDocument();
    expect(within(dlg).getByLabelText('Código')).toHaveValue('pergola');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0].body).toMatchObject({ categoryIds: [], projectTypes: [{ code: 'pergola', label: 'Pérgola', productId: 501 }] });
  });

  it('verifica un número en Meta y lo conecta con el agente', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Ventas WhatsApp' });
    fireEvent.click(screen.getByRole('button', { name: /Conectar número/ }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('ID del número'), { target: { value: '10987 65432' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /Verificar en Meta/ }));
    expect(await within(dlg).findByText('+502 5555 1234')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: /^Conectar$/ }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toEqual({ path: '/api/platform/companies/2/agents/whatsapp-channels', body: { phoneNumberId: '1098765432', tenantAgentId: 5 } });
  });
});

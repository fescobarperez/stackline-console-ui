import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../i18n/index.js';
import i18n from 'i18next';
import AgentDialog from './AgentDialog.jsx';

const modelos = [{
  id: 1, modelName: 'claude-sonnet-5-5', provider: { name: 'Anthropic' }, active: true,
  supportsTools: true, supportsVision: true, generatesImages: false,
}];
const catalogo = [{ name: 'productos.search', mode: 'read', group: 'productos', description: 'Busca' }];
const planificador = {
  id: 3, code: 'planificador', name: 'Planificador por presupuesto', kind: 'conversational', description: null,
  modelId: 1, fallbackModelId: null, imageModelId: null, temperature: 0.3, maxToolLoops: 4, responseTimeoutMs: 30000,
  tools: [
    { pattern: 'productos.search', mode: 'read', autoApprove: true, maxAmount: null },
    // Comodín: no está en el catálogo de herramientas, así que la lista no lo muestra.
    { pattern: 'planificador.*', mode: 'read', autoApprove: true, maxAmount: null },
  ],
};

describe('AgentDialog', () => {
  beforeEach(async () => { await i18n.changeLanguage('es'); });

  it('al guardar conserva los permisos que la lista no muestra (comodines)', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<AgentDialog agent={planificador} models={modelos} tools={catalogo} onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const patrones = onSubmit.mock.calls[0][0].tools.map((x) => x.pattern);
    expect(patrones).toEqual(['productos.search', 'planificador.*']);
  });
});

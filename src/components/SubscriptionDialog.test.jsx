import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../i18n/index.js';
import i18n from 'i18next';
import SubscriptionDialog from './SubscriptionDialog.jsx';

const modules = [
  { code: 'base', name: 'Base', alwaysOn: true },
  { code: 'pos', name: 'Punto de venta', alwaysOn: false },
  { code: 'fel', name: 'Facturación FEL', alwaysOn: false },
  { code: 'ai', name: 'Asistente de IA', alwaysOn: false },
];
const plans = [
  { id: 1, name: 'Básico', active: true, modules: ['base', 'pos', 'fel'], limits: { maxUsers: 5 } },
  { id: 2, name: 'Viejo', active: false, modules: ['base', 'pos'], limits: {} },
  { id: 3, name: 'Completo', active: true, modules: ['base', 'pos', 'fel', 'ai'], limits: {} },
];
const sub = {
  plan: { id: 1, name: 'Básico' },
  overrides: { enabled: [], disabled: [] },
  limitOverrides: {},
  effective: { modules: ['base', 'pos', 'fel'], limits: { maxUsers: 5 } },
};

describe('SubscriptionDialog', () => {
  beforeEach(async () => { await i18n.changeLanguage('es'); });

  it('no ofrece planes inactivos que la empresa no tiene', () => {
    render(<SubscriptionDialog subscription={sub} plans={plans} modules={modules} onClose={() => {}} onSubmit={() => {}} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Básico', 'Completo']);
  });

  it('activar y quitar módulos se guarda como excepciones; los límites vacíos usan el plan', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<SubscriptionDialog subscription={sub} plans={plans} modules={modules} onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Asistente de IA/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Punto de venta/ }));
    expect(screen.getByText('Agregado')).toBeInTheDocument();
    expect(screen.getByText('Quitado')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Usuarios activos'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith({
      planId: 1, overrides: { enabled: ['ai'], disabled: ['pos'] }, limitOverrides: { maxUsers: 12 }, priceOverride: null,
    });
  });

  it('el precio pactado se guarda; uno inválido no se envía', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<SubscriptionDialog subscription={sub} plans={plans} modules={modules} onClose={() => {}} onSubmit={onSubmit} />);
    const precio = screen.getByLabelText('Precio pactado (Q al mes)');
    fireEvent.change(precio, { target: { value: '12.345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Monto en quetzales, hasta 2 decimales')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(precio, { target: { value: '1,000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ priceOverride: 1000 })));
  });

  it('cambiar de plan regresa los módulos a los del plan nuevo', () => {
    render(<SubscriptionDialog subscription={sub} plans={plans} modules={modules} onClose={() => {}} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Punto de venta/ }));
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: '3' } });
    expect(screen.getByRole('checkbox', { name: /Punto de venta/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Asistente de IA/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Base/ })).toBeDisabled();
  });
});

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../i18n/index.js';
import i18n from 'i18next';
import StatusDialog from './StatusDialog.jsx';

const empresa = { id: 2, code: 'MADERAVIVA', name: 'Madera Viva', status: 'active' };

describe('StatusDialog', () => {
  beforeEach(async () => { await i18n.changeLanguage('es'); });

  it('solo ofrece las transiciones permitidas', () => {
    render(<StatusDialog company={empresa} onClose={() => {}} onSubmit={() => {}} />);
    const opciones = screen.getAllByRole('radio').map((r) => r.value);
    expect(opciones).toEqual(['suspended', 'cancelled']);
  });

  it('suspender pide motivo antes de habilitar el botón', () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<StatusDialog company={empresa} onClose={() => {}} onSubmit={onSubmit} />);
    const boton = screen.getByRole('button', { name: 'Cambiar a suspendida' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Falta de pago' } });
    fireEvent.click(boton);
    expect(onSubmit).toHaveBeenCalledWith('suspended', 'Falta de pago');
  });

  it('cancelar exige escribir el código de la empresa', () => {
    render(<StatusDialog company={empresa} onClose={() => {}} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: /Cancelada/ }));
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Cierre' } });
    const boton = screen.getByRole('button', { name: 'Cambiar a cancelada' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Escribe MADERAVIVA para confirmar'), { target: { value: 'maderaviva' } });
    expect(boton).toBeEnabled();
  });
});

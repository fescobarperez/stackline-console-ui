import { describe, expect, it } from 'vitest';
import {
  allowedTransitions, canTransition, needsReason, normalizeCode, isValidCode,
  suggestCode, isValidNit, isValidEmail,
} from './companyStatus.js';

describe('transiciones de estado', () => {
  it('cancelada es final; suspendida puede reactivarse', () => {
    expect(allowedTransitions('cancelled')).toEqual([]);
    expect(canTransition('suspended', 'active')).toBe(true);
    expect(canTransition('active', 'trial')).toBe(false);
  });

  it('suspender y cancelar piden motivo; activar no', () => {
    expect(needsReason('suspended')).toBe(true);
    expect(needsReason('cancelled')).toBe(true);
    expect(needsReason('active')).toBe(false);
  });
});

describe('código de empresa', () => {
  it('normaliza acentos, espacios y minúsculas', () => {
    expect(normalizeCode('Ferretería el ángel 01')).toBe('FERRETERIAELANGEL01');
    expect(suggestCode('Madera Viva')).toBe('MADERAVIVA');
  });

  it('valida longitud y guiones en los extremos', () => {
    expect(isValidCode('MV')).toBe(false);
    expect(isValidCode('MADERA-VIVA')).toBe(true);
    expect(isValidCode('-MADERA')).toBe(false);
  });
});

describe('NIT y correo', () => {
  it('acepta NIT con verificador K, con guion o CF', () => {
    expect(isValidNit('1234567-K')).toBe(true);
    expect(isValidNit('12345678')).toBe(true);
    expect(isValidNit('CF')).toBe(true);
    expect(isValidNit('ABC')).toBe(false);
  });

  it('valida correo', () => {
    expect(isValidEmail('ana@maderaviva.gt')).toBe(true);
    expect(isValidEmail('ana@')).toBe(false);
  });
});

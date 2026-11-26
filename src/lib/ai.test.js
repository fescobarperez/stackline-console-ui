import { describe, expect, it } from 'vitest';
import {
  reasonOff, validateAgent, validateModel, parseDecimal, slugKey,
  normalizePlaybook, validatePlaybook, effectiveTools, imageWarnings, effectiveConfirmations,
} from './ai.js';

const MODELS = [
  { id: 1, active: true, supportsTools: true },
  { id: 2, active: true, supportsTools: false },
  { id: 3, active: false, supportsTools: true },
];
const AGENTE = { modelId: 1, fallbackModelId: 2, temperature: 0.2, maxToolLoops: 5, responseTimeoutMs: 30000, tools: [{ pattern: 'x', maxAmount: null }] };

describe('IA', () => {
  it('el asistente responde solo con módulo, empresa operando y política encendida', () => {
    expect(reasonOff({ moduleEnabled: false, companyStatus: 'active', policyEnabled: true })).toBe('module');
    expect(reasonOff({ moduleEnabled: true, companyStatus: 'suspended', policyEnabled: true })).toBe('status');
    expect(reasonOff({ moduleEnabled: true, companyStatus: 'trial', policyEnabled: false })).toBe('disabled');
    expect(reasonOff({ moduleEnabled: true, companyStatus: 'trial', policyEnabled: true })).toBeNull();
  });

  it('agente: modelo activo con herramientas, respaldo distinto, rangos', () => {
    expect(validateAgent(AGENTE, MODELS)).toEqual({});
    expect(validateAgent({ ...AGENTE, modelId: 2 }, MODELS).modelId).toBe('Ese modelo no usa herramientas');
    expect(validateAgent({ ...AGENTE, modelId: 2, tools: [] }, MODELS).modelId).toBeUndefined();
    expect(validateAgent({ ...AGENTE, modelId: 3 }, MODELS).modelId).toBeDefined();
    expect(validateAgent({ ...AGENTE, fallbackModelId: 1 }, MODELS).fallbackModelId).toBeDefined();
    expect(Object.keys(validateAgent({ ...AGENTE, temperature: 1.5, maxToolLoops: 11, responseTimeoutMs: 1000 }, MODELS)))
      .toEqual(['temperature', 'maxToolLoops', 'responseTimeoutMs']);
    expect(validateAgent({ ...AGENTE, tools: [{ pattern: 'x', maxAmount: 0 }] }, MODELS)['tools.x']).toBeDefined();
  });

  it('modelo: nombre, contexto y precios ≥ 0 (el de cacheado es opcional)', () => {
    const m = { modelName: 'gpt', contextWindow: 128000, inputCost1k: 0.0025, cachedCost1k: null, outputCost1k: 0.01 };
    expect(validateModel(m)).toEqual({});
    expect(Object.keys(validateModel({ ...m, modelName: ' ', contextWindow: 10, outputCost1k: -1 }))).toEqual(['modelName', 'contextWindow', 'outputCost1k']);
  });

  it('decimales y claves', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('0.00015')).toBe(0.00015);
    expect(() => parseDecimal('-1')).toThrow();
    expect(slugKey('Dirección de entrega')).toBe('direccion_de_entrega');
  });

  it('playbook: completa los valores por defecto y conserva lo que no se edita', () => {
    const p = normalizePlaybook({ negocio: { descripcion: 'Muebles' }, mensajes: { x: 1 }, cotizacion: { datos_requeridos: [{ clave: 'fecha', etiqueta: 'Fecha', origen: 'cliente' }] } });
    expect(p.negocio.descripcion).toBe('Muebles');
    expect(p.negocio.pagos).toBe('');
    expect(p.mensajes).toEqual({ x: 1 });
    expect(p.limites.mostrar_precios).toBe('unitario');
    expect(p.cotizacion.datos_requeridos.map((d) => d.clave)).toEqual(['cliente', 'lineas', 'fecha']);
    expect(p.cotizacion.cierre.inactividad_horas).toBe(24);
  });

  it('playbook: montos, claves únicas y etiquetas', () => {
    const p = normalizePlaybook({});
    expect(validatePlaybook(p)).toEqual({});
    p.limites.monto_maximo = -5;
    p.cotizacion.datos_requeridos.push({ clave: 'fecha', etiqueta: 'Fecha', origen: 'cliente' }, { clave: 'fecha', etiqueta: 'Otra', origen: 'cliente' }, { clave: 'x', etiqueta: '', origen: 'cliente' });
    const f = validatePlaybook(p);
    expect(f['limites.monto_maximo']).toBeDefined();
    expect(f['datos.1']).toBe('Clave repetida');
    expect(f['datos.2']).toBe('La etiqueta es obligatoria');
  });

  it('herramientas efectivas', () => {
    expect(effectiveTools([{ pattern: 'a' }, { pattern: 'b' }], ['b']).map((t) => t.pattern)).toEqual(['a']);
  });
});

describe('imágenes y productos nuevos', () => {
  const modelos = [
    { id: 1, active: true, supportsTools: true, supportsVision: true },
    { id: 3, active: true, supportsTools: false, generatesImages: true, imageCost: 0.04 },
  ];
  const agente = { modelId: 1, fallbackModelId: null, temperature: 0.2, maxToolLoops: 5, responseTimeoutMs: 30000, tools: [] };

  it('modelo de imágenes del agente debe editar imágenes', () => {
    expect(validateAgent({ ...agente, imageModelId: 3 }, modelos)).toEqual({});
    expect(validateAgent({ ...agente, imageModelId: 1 }, modelos).imageModelId).toBeTruthy();
    expect(validateAgent({ ...agente, imageModelId: null }, modelos)).toEqual({});
  });

  it('costo por imagen obligatorio si edita imágenes', () => {
    const base = { modelName: 'gpt-image-1', contextWindow: 32000, inputCost1k: 0, outputCost1k: 0 };
    expect(validateModel({ ...base, generatesImages: true, imageCost: 0.042 })).toEqual({});
    expect(validateModel({ ...base, generatesImages: true, imageCost: null }).imageCost).toBeTruthy();
    expect(validateModel({ ...base, generatesImages: false, imageCost: null })).toEqual({});
  });

  it('defaults conservan lo guardado', () => {
    const p = normalizePlaybook({ imagenes: { aceptar: true }, cotizacion: { productos_nuevos: { permitido: true } } });
    expect(p.imagenes).toEqual({ aceptar: true, max_por_turno: 3, generar_renders: false, renders_max: 3 });
    expect(p.cotizacion.productos_nuevos).toEqual({ permitido: true, lineas: [], mensaje_fuera_de_linea: null });
  });

  it('renders necesitan fotos y topes válidos', () => {
    const p = normalizePlaybook({ imagenes: { aceptar: false, generar_renders: true } });
    expect(validatePlaybook(p)['imagenes.generar_renders']).toBeTruthy();
    const q = normalizePlaybook({ imagenes: { aceptar: true, max_por_turno: 9, generar_renders: true, renders_max: 0 } });
    const f = validatePlaybook(q);
    expect(f['imagenes.max_por_turno']).toBeTruthy();
    expect(f['imagenes.renders_max']).toBeTruthy();
  });

  it('avisos de lo que falta', () => {
    const pb = { imagenes: { aceptar: true, generar_renders: true } };
    expect(imageWarnings(pb, { supportsVision: false }, null)).toEqual(['noVision', 'noImageModel']);
    expect(imageWarnings(pb, { supportsVision: true }, { id: 3 })).toEqual([]);
    expect(imageWarnings({ imagenes: {} }, null, null)).toEqual([]);
  });

  it('confirmaciones: por defecto pregunta poco y lo viejo manda en enviar y reabrir', () => {
    const p = normalizePlaybook({});
    expect(p.confirmaciones.repreguntar_datos).toBe(false);
    expect(p.confirmaciones.medidas_foto).toBe('resumen');
    expect(effectiveConfirmations(p)).toMatchObject({ enviar: true, reabrir: true, aprobar_texto: true, rechazar_texto: false });
    const viejo = normalizePlaybook({ cotizacion: { reapertura: { requiere_confirmacion: false } } });
    expect(effectiveConfirmations(viejo).reabrir).toBe(false);
    const propio = normalizePlaybook({ confirmaciones: { enviar: false }, cotizacion: { envio: { requiere_confirmacion: true } } });
    expect(effectiveConfirmations(propio).enviar).toBe(false);
  });

  it('confirmaciones: valida las opciones', () => {
    const p = normalizePlaybook({ confirmaciones: { medidas_foto: 'nunca', aprobar_diseno: 'x' } });
    const f = validatePlaybook(p);
    expect(f['confirmaciones.medidas_foto']).toBeTruthy();
    expect(f['confirmaciones.aprobar_diseno']).toBeTruthy();
    expect(validatePlaybook(normalizePlaybook({}))['confirmaciones.medidas_foto']).toBeUndefined();
  });

  it('estilo: breve y sin repetir por defecto; valida el largo', () => {
    const p = normalizePlaybook({});
    expect(p.estilo).toMatchObject({ largo: 'breve', repetir_resumen: false, un_tema: true, sin_listas: true });
    expect(validatePlaybook(normalizePlaybook({ estilo: { largo: 'eterno' } }))['estilo.largo']).toBeTruthy();
    expect(validatePlaybook(p)['estilo.largo']).toBeUndefined();
    expect(p.estilo.pedir_datos).toBe('al_final');
    expect(validatePlaybook(normalizePlaybook({ estilo: { pedir_datos: 'nunca' } }))['estilo.pedir_datos']).toBeTruthy();
  });
});

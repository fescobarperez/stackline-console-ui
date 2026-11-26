// Modelos, agentes y asistente por empresa. Las mismas reglas que aplica el
// backend (API.md, sección «IA»):
//
//   el asistente responde  ⇔ la empresa tiene el módulo `ai`
//                            ∧ está activa o en prueba
//                            ∧ su política está encendida
//   modelo efectivo        = modelo propio de la empresa ?? modelo del agente
//   herramientas efectivas = las del agente − las que la empresa apagó

export const TEMPERATURE = { min: 0, max: 1 };
export const TOOL_LOOPS = { min: 0, max: 10 };
export const TIMEOUT_MS = { min: 5000, max: 120000 };
/** Fotos que lee por mensaje y renders por cotización (playbook `imagenes`). */
export const FOTOS_POR_TURNO = { min: 1, max: 5 };
export const RENDERS_MAX = { min: 1, max: 5 };
/** Opciones de la sección Confirmaciones del playbook. */
export const MEDIDAS_FOTO = ['aparte', 'resumen', 'no'];
export const APROBAR_DISENO = ['flexible', 'literal'];
/** Largo de los mensajes del agente (playbook `estilo`). */
export const LARGO_MENSAJE = ['breve', 'normal', 'detallado'];

/** Cuándo pide el agente nombre, teléfono y NIT (playbook `estilo.pedir_datos`). */
export const PEDIR_DATOS = ['al_final', 'al_inicio'];

/**
 * Lo que el agente pregunta, con enviar y reabrir ya resueltos: si la sección
 * no los define, valen los de cotizacion.envio y cotizacion.reapertura.
 */
export function effectiveConfirmations(p) {
  const k = p.confirmaciones || {};
  return {
    ...k,
    enviar: k.enviar ?? p.cotizacion?.envio?.requiere_confirmacion ?? true,
    reabrir: k.reabrir ?? p.cotizacion?.reapertura?.requiere_confirmacion ?? true,
  };
}

/** Por qué el asistente no responde: 'module' | 'status' | 'disabled' | null (sí responde). */
export function reasonOff({ moduleEnabled, companyStatus, policyEnabled }) {
  if (!moduleEnabled) return 'module';
  if (companyStatus !== 'active' && companyStatus !== 'trial') return 'status';
  if (!policyEnabled) return 'disabled';
  return null;
}

/** Validación de la configuración de un agente; devuelve { campo: mensaje }. */
export function validateAgent(a, models) {
  const f = {};
  const modelo = models.find((m) => m.id === a.modelId);
  if (!modelo || !modelo.active) f.modelId = 'Elige un modelo activo';
  else if (a.tools?.length && !modelo.supportsTools) f.modelId = 'Ese modelo no usa herramientas';
  if (a.fallbackModelId != null) {
    const resp = models.find((m) => m.id === a.fallbackModelId);
    if (!resp || !resp.active) f.fallbackModelId = 'Elige un modelo activo';
    else if (a.fallbackModelId === a.modelId) f.fallbackModelId = 'El respaldo debe ser otro modelo';
  }
  if (a.imageModelId != null) {
    const img = models.find((m) => m.id === a.imageModelId);
    if (!img || !img.active || !img.generatesImages) f.imageModelId = 'Elige un modelo activo que edite imágenes';
  }
  if (!(typeof a.temperature === 'number' && a.temperature >= TEMPERATURE.min && a.temperature <= TEMPERATURE.max)) f.temperature = 'Entre 0 y 1';
  if (!(Number.isInteger(a.maxToolLoops) && a.maxToolLoops >= TOOL_LOOPS.min && a.maxToolLoops <= TOOL_LOOPS.max)) f.maxToolLoops = 'Entero entre 0 y 10';
  if (!(Number.isInteger(a.responseTimeoutMs) && a.responseTimeoutMs >= TIMEOUT_MS.min && a.responseTimeoutMs <= TIMEOUT_MS.max)) f.responseTimeoutMs = 'Entre 5 y 120 segundos';
  (a.tools || []).forEach((t) => {
    if (t.maxAmount != null && !(typeof t.maxAmount === 'number' && t.maxAmount > 0)) f[`tools.${t.pattern}`] = 'Monto mayor a 0';
  });
  return f;
}

/** Validación de un modelo (precios por 1 000 tokens, en USD). */
export function validateModel(m) {
  const f = {};
  if (!String(m.modelName || '').trim()) f.modelName = 'El nombre es obligatorio';
  if (!(Number.isInteger(m.contextWindow) && m.contextWindow >= 1000)) f.contextWindow = 'Entero de 1 000 o más';
  ['inputCost1k', 'cachedCost1k', 'outputCost1k'].forEach((k) => {
    const v = m[k];
    if (k === 'cachedCost1k' && v == null) return;
    if (!(typeof v === 'number' && v >= 0)) f[k] = 'Número mayor o igual a 0';
  });
  // Costo por imagen (USD): obligatorio si el modelo edita imágenes.
  if (m.generatesImages && !(typeof m.imageCost === 'number' && m.imageCost >= 0)) f.imageCost = 'Número mayor o igual a 0';
  return f;
}

/** Número decimal ≥ 0 o null si queda vacío; lanza si no es válido. */
export function parseDecimal(raw) {
  const v = String(raw ?? '').trim().replace(/,/g, '');
  if (v === '') return null;
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error('invalid');
  return Number(v);
}

/** Clave de un dato requerido: minúsculas, números y guion bajo. */
export const slugKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

const SISTEMA = [
  { clave: 'cliente', etiqueta: 'Cliente identificado (nombre y NIT o CF)', origen: 'sistema' },
  { clave: 'lineas', etiqueta: 'Productos y cantidades', origen: 'sistema' },
];

/** Playbook con todos los valores por defecto que aplica agents-services. */
export function playbookDefaults() {
  return {
    negocio: { descripcion: '', entregas: '', pagos: '', horario: '', notas: '' },
    audiencias: { whatsapp: 'cliente' },
    imagenes: { aceptar: false, max_por_turno: 3, generar_renders: false, renders_max: 3 },
    // null en enviar/reabrir = usa lo de cotizacion.envio / cotizacion.reapertura.
    confirmaciones: {
      repreguntar_datos: false, medidas_foto: 'resumen', aprobar_diseno: 'flexible',
      reabrir: null, rechazar_texto: false, aprobar_texto: true, enviar: null, instrucciones: null,
    },
    estilo: { largo: 'breve', repetir_resumen: false, un_tema: true, sin_listas: true, pedir_datos: 'al_final', instrucciones: null },
    limites: { monto_maximo: null, lineas_maximas: null, puede_ofrecer_descuentos: false, fuera_de_alcance: [], mostrar_precios: 'unitario' },
    cotizacion: {
      datos_requeridos: [...SISTEMA],
      cierre: { al_enviar_pdf: true, inactividad_horas: 24, si_cambia_estado_en_erp: true },
      envio: { requiere_confirmacion: true, marcar_preliminar: true },
      reapertura: { permitida: true, requiere_confirmacion: true },
      productos_nuevos: { permitido: false, lineas: [], mensaje_fuera_de_linea: null },
    },
  };
}

/**
 * Completa un playbook guardado con los valores por defecto, sin perder lo
 * que la consola no edita (p. ej. `mensajes`).
 */
export function normalizePlaybook(cfg = {}) {
  const d = playbookDefaults();
  const c = cfg || {};
  const datos = c.cotizacion?.datos_requeridos;
  return {
    ...c,
    negocio: { ...d.negocio, ...(c.negocio || {}) },
    audiencias: { ...d.audiencias, ...(c.audiencias || {}) },
    imagenes: { ...d.imagenes, ...(c.imagenes || {}) },
    confirmaciones: { ...d.confirmaciones, ...(c.confirmaciones || {}) },
    estilo: { ...d.estilo, ...(c.estilo || {}) },
    limites: { ...d.limites, ...(c.limites || {}) },
    cotizacion: {
      ...d.cotizacion,
      ...(c.cotizacion || {}),
      // Los datos del sistema siempre van primero y no se editan.
      datos_requeridos: [...SISTEMA, ...((datos || []).filter((x) => x.origen !== 'sistema'))],
      cierre: { ...d.cotizacion.cierre, ...(c.cotizacion?.cierre || {}) },
      envio: { ...d.cotizacion.envio, ...(c.cotizacion?.envio || {}) },
      reapertura: { ...d.cotizacion.reapertura, ...(c.cotizacion?.reapertura || {}) },
      productos_nuevos: { ...d.cotizacion.productos_nuevos, ...(c.cotizacion?.productos_nuevos || {}) },
    },
  };
}

/** Validación del playbook; devuelve { campo: mensaje }. */
export function validatePlaybook(p) {
  const f = {};
  const l = p.limites || {};
  if (l.monto_maximo != null && !(typeof l.monto_maximo === 'number' && l.monto_maximo > 0)) f['limites.monto_maximo'] = 'Monto mayor a 0';
  if (l.lineas_maximas != null && !(Number.isInteger(l.lineas_maximas) && l.lineas_maximas > 0)) f['limites.lineas_maximas'] = 'Entero mayor a 0';
  if (!['unitario', 'total'].includes(l.mostrar_precios)) f['limites.mostrar_precios'] = 'Unitario o total';
  const h = p.cotizacion?.cierre?.inactividad_horas;
  if (h != null && !(Number.isInteger(h) && h >= 0)) f['cotizacion.cierre.inactividad_horas'] = 'Entero mayor o igual a 0';
  const img = p.imagenes || {};
  const entre = (v, r) => Number.isInteger(v) && v >= r.min && v <= r.max;
  if (img.aceptar && !entre(img.max_por_turno, FOTOS_POR_TURNO)) f['imagenes.max_por_turno'] = 'Entero entre 1 y 5';
  if (img.generar_renders && !img.aceptar) f['imagenes.generar_renders'] = 'Necesita que acepte fotos';
  if (img.generar_renders && !entre(img.renders_max, RENDERS_MAX)) f['imagenes.renders_max'] = 'Entero entre 1 y 5';
  const k = p.confirmaciones || {};
  if (k.medidas_foto != null && !MEDIDAS_FOTO.includes(k.medidas_foto)) f['confirmaciones.medidas_foto'] = 'aparte, resumen o no';
  if (k.aprobar_diseno != null && !APROBAR_DISENO.includes(k.aprobar_diseno)) f['confirmaciones.aprobar_diseno'] = 'flexible o literal';
  const es = p.estilo || {};
  if (es.largo != null && !LARGO_MENSAJE.includes(es.largo)) f['estilo.largo'] = 'breve, normal o detallado';
  if (es.pedir_datos != null && !PEDIR_DATOS.includes(es.pedir_datos)) f['estilo.pedir_datos'] = 'al_final o al_inicio';
  const claves = new Set();
  (p.cotizacion?.datos_requeridos || []).filter((x) => x.origen !== 'sistema').forEach((x, i) => {
    if (!String(x.etiqueta || '').trim()) f[`datos.${i}`] = 'La etiqueta es obligatoria';
    else if (!/^[a-z0-9_]{1,40}$/.test(x.clave || '')) f[`datos.${i}`] = 'Clave inválida';
    else if (claves.has(x.clave) || ['cliente', 'lineas'].includes(x.clave)) f[`datos.${i}`] = 'Clave repetida';
    claves.add(x.clave);
  });
  return f;
}

/** Herramientas que la empresa realmente puede usar. */
export const effectiveTools = (agentTools, disabled = []) => agentTools.filter((t) => !disabled.includes(t.pattern));

/**
 * Lo que falta para que funcione lo que el playbook pide de imágenes:
 * 'noVision' (acepta fotos y el modelo de la empresa no las lee) y
 * 'noImageModel' (genera renders y el agente no tiene modelo de imágenes).
 * El agente no se rompe: avisa al cliente y sigue sin la foto o sin el render.
 */
export function imageWarnings(playbook, chatModel, imageModel) {
  const img = playbook?.imagenes || {};
  const w = [];
  if (img.aceptar && !chatModel?.supportsVision) w.push('noVision');
  if (img.generar_renders && !imageModel) w.push('noImageModel');
  return w;
}

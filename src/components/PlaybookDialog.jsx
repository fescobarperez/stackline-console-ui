// Playbook de la empresa: cómo vende el agente (agent_playbooks.config).
// Lo que se edita aquí lo APLICA el código del agente (checklist, topes,
// cierre); cada guardado es una versión nueva.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import Icon from './Icon.jsx';
import { normalizePlaybook, validatePlaybook, parseDecimal, slugKey, imageWarnings, effectiveConfirmations } from '../lib/ai.js';

const txt = (v) => (v == null ? '' : String(v));

// chatModel / imageModel: los que usará el agente para esta empresa; solo
// para avisar si falta algo para lo que se enciende aquí.
export default function PlaybookDialog({ playbook, chatModel = null, imageModel = null, onClose, onSubmit }) {
  const { t } = useTranslation();
  const base = normalizePlaybook(playbook.config);
  const [neg, setNeg] = useState({ ...base.negocio });
  const [lim, setLim] = useState({
    monto_maximo: txt(base.limites.monto_maximo),
    lineas_maximas: txt(base.limites.lineas_maximas),
    puede_ofrecer_descuentos: base.limites.puede_ofrecer_descuentos,
    mostrar_precios: base.limites.mostrar_precios,
    fuera_de_alcance: base.limites.fuera_de_alcance.join('\n'),
  });
  const [datos, setDatos] = useState(base.cotizacion.datos_requeridos.filter((d) => d.origen !== 'sistema').map((d) => ({ ...d, nueva: false })));
  const [horas, setHoras] = useState(txt(base.cotizacion.cierre.inactividad_horas));
  const [img, setImg] = useState({ ...base.imagenes, max_por_turno: txt(base.imagenes.max_por_turno), renders_max: txt(base.imagenes.renders_max) });
  const pn = base.cotizacion.productos_nuevos;
  const [nuevos, setNuevos] = useState({ permitido: Boolean(pn.permitido), lineas: (pn.lineas || []).join('\n'), mensaje: pn.mensaje_fuera_de_linea || '' });
  const [conf, setConf] = useState(() => {
    const k = effectiveConfirmations(base);
    return { ...k, instrucciones: k.instrucciones || '' };
  });
  const [estilo, setEstilo] = useState({ ...base.estilo, instrucciones: base.estilo.instrucciones || '' });
  const avisos = imageWarnings({ imagenes: img }, chatModel, imageModel);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const setDato = (i, k, v) => setDatos((xs) => xs.map((d, j) => {
    if (j !== i) return d;
    const n = { ...d, [k]: v };
    // La clave de un dato nuevo sigue a la etiqueta; la de uno guardado no cambia
    // (las cotizaciones ya registradas la usan).
    if (k === 'etiqueta' && d.nueva) n.clave = slugKey(v);
    return n;
  }));

  const guardar = async () => {
    const e = {};
    const dec = (raw, campo, entero = false) => {
      try {
        const v = parseDecimal(raw);
        if (v != null && entero && !Number.isInteger(v)) throw new Error('x');
        return v;
      } catch { e[campo] = entero ? t('pb.err.int', 'Entero mayor a 0') : t('ai.err.amount', 'Monto mayor a 0'); return null; }
    };
    const config = {
      ...base,
      negocio: Object.fromEntries(Object.entries(neg).map(([k, v]) => [k, String(v || '').trim()])),
      limites: {
        ...base.limites,
        monto_maximo: dec(lim.monto_maximo, 'limites.monto_maximo'),
        lineas_maximas: dec(lim.lineas_maximas, 'limites.lineas_maximas', true),
        puede_ofrecer_descuentos: lim.puede_ofrecer_descuentos,
        mostrar_precios: lim.mostrar_precios,
        fuera_de_alcance: lim.fuera_de_alcance.split('\n').map((x) => x.trim()).filter(Boolean),
      },
      cotizacion: {
        ...base.cotizacion,
        datos_requeridos: [
          ...base.cotizacion.datos_requeridos.filter((d) => d.origen === 'sistema'),
          ...datos.map(({ nueva, ...d }) => ({ ...d, etiqueta: d.etiqueta.trim(), descripcion: String(d.descripcion || '').trim() || null, origen: 'cliente' })),
        ],
        cierre: { ...base.cotizacion.cierre, inactividad_horas: dec(horas, 'cotizacion.cierre.inactividad_horas', true) },
        // Se reflejan aquí para que lo viejo y la sección nueva no digan cosas distintas.
        envio: { ...base.cotizacion.envio, requiere_confirmacion: conf.enviar },
        reapertura: { ...base.cotizacion.reapertura, requiere_confirmacion: conf.reabrir },
        // Tener la herramienta es el permiso: el agente siempre crea el producto.
        productos_nuevos: {
          permitido: true,
          lineas: nuevos.lineas.split('\n').map((x) => x.trim()).filter(Boolean),
          mensaje_fuera_de_linea: pn.mensaje_fuera_de_linea || null,
        },
      },
      imagenes: {
        aceptar: img.aceptar,
        // Apagado, se guarda el valor que había (o el de siempre) para no perderlo.
        max_por_turno: img.aceptar ? dec(img.max_por_turno, 'imagenes.max_por_turno', true) : base.imagenes.max_por_turno,
        generar_renders: img.generar_renders,
        renders_max: img.generar_renders ? dec(img.renders_max, 'imagenes.renders_max', true) : base.imagenes.renders_max,
      },
      confirmaciones: { ...conf, instrucciones: conf.instrucciones.trim() || null },
      estilo: { ...estilo, instrucciones: estilo.instrucciones.trim() || null },
    };
    const v = validatePlaybook(config);
    const msg = {
      'limites.monto_maximo': t('ai.err.amount', 'Monto mayor a 0'),
      'limites.lineas_maximas': t('pb.err.int', 'Entero mayor a 0'),
      'cotizacion.cierre.inactividad_horas': t('pb.err.int0', 'Entero mayor o igual a 0'),
      'imagenes.max_por_turno': t('pb.err.range15', 'Entero entre 1 y 5'),
      'imagenes.renders_max': t('pb.err.range15', 'Entero entre 1 y 5'),
      'imagenes.generar_renders': t('pb.err.rendersNeedPhotos', 'Primero activa «Acepta fotos del cliente»'),
    };
    Object.entries(v).forEach(([k, m]) => {
      if (e[k]) return;
      if (k.startsWith('datos.')) {
        e[k] = m === 'Clave repetida' ? t('pb.err.dupKey', 'Ya hay un dato con esa etiqueta')
          : m === 'La etiqueta es obligatoria' ? t('pb.err.label', 'La etiqueta es obligatoria') : t('pb.err.key', 'Usa letras o números en la etiqueta');
      } else e[k] = msg[k] || m;
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await onSubmit(config); } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  const campoNeg = (k, label, hint, rows = 2) => (
    <Field label={label} hint={hint} span2>
      <textarea className="field-input" rows={rows} value={neg[k]} onChange={(e) => setNeg({ ...neg, [k]: e.target.value })} />
    </Field>
  );

  return (
    <Modal size="modal-lg" title={t('pb.title', 'Playbook de ventas')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('pb.save', 'Guardar versión {{v}}', { v: playbook.version + 1 })}</Button>
      </>}>
      <p className="field-hint" style={{ marginTop: 0 }}>{t('pb.hint', 'Lo que el agente sabe del negocio y las reglas que el código le hace cumplir. Cada guardado crea una versión nueva.')}</p>

      <h4 className="subsection-title" style={{ margin: '16px 0 8px' }}>{t('pb.business', 'El negocio')}</h4>
      <div className="form-grid">
        {campoNeg('descripcion', t('pb.description', 'Qué vende'), t('pb.descriptionHint', 'Una o dos frases: el giro y lo que más se vende.'), 3)}
        {campoNeg('entregas', t('pb.deliveries', 'Entregas'), null)}
        {campoNeg('pagos', t('pb.payments', 'Formas de pago'), null)}
        {campoNeg('horario', t('pb.hours', 'Horario de atención'), null, 1)}
        {campoNeg('notas', t('pb.notes', 'Otras notas para el agente'), null)}
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 8px' }}>{t('pb.limits', 'Límites')}</h4>
      <div className="form-grid">
        <Field label={t('pb.maxAmount', 'Monto máximo que envía solo (Q)')} error={errors['limites.monto_maximo']}
          hint={t('pb.maxAmountHint', 'Por encima, la revisa un vendedor.')}>
          <input className="field-input mono" inputMode="decimal" value={lim.monto_maximo} placeholder={t('ai.noMax', 'Sin tope')} onChange={(e) => setLim({ ...lim, monto_maximo: e.target.value })} />
        </Field>
        <Field label={t('pb.maxLines', 'Líneas máximas por cotización')} error={errors['limites.lineas_maximas']}>
          <input className="field-input mono" inputMode="numeric" value={lim.lineas_maximas} placeholder={t('ai.noMax', 'Sin tope')} onChange={(e) => setLim({ ...lim, lineas_maximas: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
        <Field label={t('pb.prices', 'Precios que dice al cliente')}>
          <select className="field-input" value={lim.mostrar_precios} onChange={(e) => setLim({ ...lim, mostrar_precios: e.target.value })}>
            <option value="unitario">{t('pb.pricesUnit', 'Por producto y total')}</option>
            <option value="total">{t('pb.pricesTotal', 'Solo el total de la cotización')}</option>
          </select>
        </Field>
        <Field label={t('pb.closeHours', 'Cierra la cotización tras (horas sin actividad)')} error={errors['cotizacion.cierre.inactividad_horas']}
          hint={t('pb.closeHoursHint', '0 = nunca por tiempo.')}>
          <input className="field-input mono" inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value.replace(/[^\d]/g, ''))} />
        </Field>
        <Field label={t('pb.outOfScope', 'Temas que pasa a una persona')} hint={t('pb.outOfScopeHint', 'Uno por línea.')} span2>
          <textarea className="field-input" rows={3} value={lim.fuera_de_alcance} onChange={(e) => setLim({ ...lim, fuera_de_alcance: e.target.value })} />
        </Field>
      </div>
      <label className="switch-row">
        <input type="checkbox" checked={lim.puede_ofrecer_descuentos} onChange={(e) => setLim({ ...lim, puede_ofrecer_descuentos: e.target.checked })} />
        <span>{t('pb.discounts', 'Puede ofrecer descuentos')}</span>
      </label>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pb.images', 'Fotos e imágenes de ejemplo')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pb.imagesHint', 'Solo en WhatsApp. El agente lee las fotos para cotizar (no las guarda) y, si se activa, le muestra al cliente cómo quedaría lo que cotiza sobre su foto.')}</p>
      <label className="switch-row">
        <input type="checkbox" checked={img.aceptar} onChange={(e) => setImg({ ...img, aceptar: e.target.checked, generar_renders: e.target.checked && img.generar_renders })} />
        <span>{t('pb.acceptPhotos', 'Acepta fotos del cliente')}</span>
      </label>
      {img.aceptar && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label={t('pb.photosPerTurn', 'Fotos que lee por mensaje')} error={errors['imagenes.max_por_turno']}
            hint={t('pb.photosPerTurnHint', 'De 1 a 5. Las demás las ignora y se lo dice al cliente.')}>
            <input className="field-input mono" inputMode="numeric" value={img.max_por_turno} onChange={(e) => setImg({ ...img, max_por_turno: e.target.value.replace(/[^\d]/g, '') })} />
          </Field>
        </div>
      )}
      <label className="switch-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={img.generar_renders} disabled={!img.aceptar} onChange={(e) => setImg({ ...img, generar_renders: e.target.checked })} />
        <span>{t('pb.renders', 'Hace imágenes de ejemplo')}<span className="field-hint">{t('pb.rendersHint', 'Antes de la primera pide todos los datos del diseño. Solo muestra lo que se cotiza.')}</span></span>
      </label>
      {errors['imagenes.generar_renders'] && <div className="field-error" role="alert">{errors['imagenes.generar_renders']}</div>}
      {img.generar_renders && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label={t('pb.rendersMax', 'Imágenes de ejemplo por cotización')} error={errors['imagenes.renders_max']}
            hint={t('pb.rendersMaxHint', 'De 1 a 5. Cada una tiene costo, aunque el cliente no la apruebe.')}>
            <input className="field-input mono" inputMode="numeric" value={img.renders_max} onChange={(e) => setImg({ ...img, renders_max: e.target.value.replace(/[^\d]/g, '') })} />
          </Field>
        </div>
      )}
      {avisos.map((a) => (
        <p key={a} className="pb-warn" role="status">
          <Icon name="warning" size={18} />
          {a === 'noVision'
            ? t('pb.warnNoVision', 'El modelo de esta empresa no lee imágenes: el agente le dirá al cliente que no puede verlas.')
            : t('pb.warnNoImageModel', 'El agente de ventas no tiene modelo de imágenes: elige uno en «Modelos y agentes».')}
        </p>
      ))}

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pb.style', 'Estilo de respuesta')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pb.styleHint', 'Cómo escribe el agente. Mensajes cortos y directos cansan menos al cliente.')}</p>
      <div className="form-grid">
        <Field label={t('pb.styleLength', 'Largo de los mensajes')} error={errors['estilo.largo']}>
          <select className="field-input" value={estilo.largo} onChange={(e) => setEstilo({ ...estilo, largo: e.target.value })}>
            <option value="breve">{t('pb.styleShort', 'Breve (unas 3 líneas)')}</option>
            <option value="normal">{t('pb.styleNormal', 'Normal (uno o dos párrafos)')}</option>
            <option value="detallado">{t('pb.styleDetailed', 'Detallado')}</option>
          </select>
        </Field>
        <Field label={t('pb.styleAskData', 'Cuándo pide los datos del cliente')} error={errors['estilo.pedir_datos']}
          hint={t('pb.styleAskDataHint', 'Nombre, teléfono y NIT. Al final, el cliente primero cuenta qué quiere y los productos quedan en espera.')}>
          <select className="field-input" value={estilo.pedir_datos} onChange={(e) => setEstilo({ ...estilo, pedir_datos: e.target.value })}>
            <option value="al_final">{t('pb.styleAskEnd', 'Al final, cuando ya sabe qué quiere')}</option>
            <option value="al_inicio">{t('pb.styleAskStart', 'Al inicio, antes de cotizar')}</option>
          </select>
        </Field>
      </div>
      <label className="switch-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={estilo.repetir_resumen} onChange={(e) => setEstilo({ ...estilo, repetir_resumen: e.target.checked })} />
        <span>{t('pb.styleRepeat', 'Repite el resumen de lo cotizado en cada mensaje')}<span className="field-hint">{t('pb.styleRepeatHint', 'Apagado: el resumen va una vez, antes de enviar o si el cliente lo pide.')}</span></span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={estilo.un_tema} onChange={(e) => setEstilo({ ...estilo, un_tema: e.target.checked })} />
        <span>{t('pb.styleOneTopic', 'Un tema y una pregunta por mensaje')}</span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={estilo.sin_listas} onChange={(e) => setEstilo({ ...estilo, sin_listas: e.target.checked })} />
        <span>{t('pb.styleNoLists', 'Sin listas ni viñetas')}</span>
      </label>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <Field label={t('pb.styleNotes', 'Otras indicaciones de estilo')} hint={t('pb.styleNotesHint', 'Opcional. Por ejemplo: «Saluda por el nombre», «Usa usted».')} span2>
          <textarea className="field-input" rows={2} value={estilo.instrucciones} onChange={(e) => setEstilo({ ...estilo, instrucciones: e.target.value })} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pb.confirm', 'Confirmaciones')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pb.confirmHint', 'Qué pregunta el agente antes de seguir. Menos preguntas hacen la conversación más ágil; las que comprometen al cliente conviene dejarlas.')}</p>
      <label className="switch-row">
        <input type="checkbox" checked={conf.repreguntar_datos} onChange={(e) => setConf({ ...conf, repreguntar_datos: e.target.checked })} />
        <span>{t('pb.confirmData', 'Repregunta lo que el cliente ya dijo')}<span className="field-hint">{t('pb.confirmDataHint', 'Apagado: si dice «azul», se anota azul y sigue.')}</span></span>
      </label>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <Field label={t('pb.confirmPhoto', 'Medidas estimadas de una foto')} error={errors['confirmaciones.medidas_foto']}>
          <select className="field-input" value={conf.medidas_foto} onChange={(e) => setConf({ ...conf, medidas_foto: e.target.value })}>
            <option value="resumen">{t('pb.confirmPhotoSummary', 'Se confirman en el resumen final')}</option>
            <option value="aparte">{t('pb.confirmPhotoSeparate', 'Pregunta aparte antes de usarlas')}</option>
            <option value="no">{t('pb.confirmPhotoNo', 'No las confirma (las revisa el asesor)')}</option>
          </select>
        </Field>
        <Field label={t('pb.confirmDesign', 'Aprobar el diseño de la imagen')} error={errors['confirmaciones.aprobar_diseno']}>
          <select className="field-input" value={conf.aprobar_diseno} onChange={(e) => setConf({ ...conf, aprobar_diseno: e.target.value })}>
            <option value="flexible">{t('pb.confirmDesignFlexible', 'Basta con «me gusta» o «así está bien»')}</option>
            <option value="literal">{t('pb.confirmDesignLiteral', 'Solo con un «sí»')}</option>
          </select>
        </Field>
      </div>
      <label className="switch-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={conf.enviar} onChange={(e) => setConf({ ...conf, enviar: e.target.checked })} />
        <span>{t('pb.confirmSend', 'Pide confirmación antes de enviar la cotización')}<span className="field-hint">{t('pb.confirmSendHint', 'Un solo resumen con todo y una pregunta. Recomendado.')}</span></span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={conf.aprobar_texto} onChange={(e) => setConf({ ...conf, aprobar_texto: e.target.checked })} />
        <span>{t('pb.confirmApprove', 'Pide confirmación para aprobar por texto')}<span className="field-hint">{t('pb.confirmApproveHint', 'Repite número y total. Recomendado: es un compromiso de compra.')}</span></span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={conf.rechazar_texto} onChange={(e) => setConf({ ...conf, rechazar_texto: e.target.checked })} />
        <span>{t('pb.confirmReject', 'Pide confirmación para rechazar por texto')}</span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={conf.reabrir} onChange={(e) => setConf({ ...conf, reabrir: e.target.checked })} />
        <span>{t('pb.confirmReopen', 'Pregunta antes de reabrir una cotización enviada')}<span className="field-hint">{t('pb.confirmReopenHint', 'Apagado: que el cliente pida cambiarla ya es su confirmación.')}</span></span>
      </label>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <Field label={t('pb.confirmNotes', 'Otras indicaciones sobre confirmaciones')} hint={t('pb.confirmNotesHint', 'Opcional. Por ejemplo: «No preguntes el color dos veces».')} span2>
          <textarea className="field-input" rows={2} value={conf.instrucciones} onChange={(e) => setConf({ ...conf, instrucciones: e.target.value })} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pb.newProducts', 'Productos que no están en el catálogo')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pb.newProductsAlways', 'Si el agente tiene la herramienta «producto nuevo», crea el producto con lo que pidió el cliente y arma la cotización preliminar. Queda en Inventario › Por revisar y el precio lo confirma un vendedor.')}</p>
      <div className="form-grid">
        <Field label={t('pb.lines', 'Líneas de producto')} hint={t('pb.linesHintCategory', 'Opcional. Categorías del ERP, una por línea: el agente usa la que encaje para clasificarlo.')} span2>
          <textarea className="field-input" rows={3} value={nuevos.lineas} onChange={(e) => setNuevos({ ...nuevos, lineas: e.target.value })} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pb.data', 'Datos que pide antes de enviar la cotización')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pb.dataHint', 'Además del cliente y los productos, que siempre pide. Se guardan en las notas de la cotización.')}</p>
      <div className="pb-data">
        {datos.map((d, i) => (
          <div key={i} className="pb-data-row">
            <Field label={t('pb.label', 'Dato')} error={errors[`datos.${i}`]}>
              <input className="field-input" value={d.etiqueta} onChange={(e) => setDato(i, 'etiqueta', e.target.value)} />
            </Field>
            <Field label={t('pb.dataHintLabel', 'Pista para el agente')}>
              <input className="field-input" value={d.descripcion || ''} onChange={(e) => setDato(i, 'descripcion', e.target.value)} />
            </Field>
            <label className="pb-optional">
              <input type="checkbox" checked={Boolean(d.opcional)} onChange={(e) => setDato(i, 'opcional', e.target.checked)} />
              {t('pb.optional', 'Opcional')}
            </label>
            <button type="button" className="icon-btn" aria-label={t('pb.remove', 'Quitar {{d}}', { d: d.etiqueta || '' })} onClick={() => setDatos((xs) => xs.filter((_, j) => j !== i))}>
              <Icon name="delete" size={20} />
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" icon="plus" onClick={() => setDatos((xs) => [...xs, { clave: '', etiqueta: '', origen: 'cliente', opcional: false, descripcion: '', nueva: true }])}>
          {t('pb.addData', 'Agregar dato')}
        </Button>
      </div>
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

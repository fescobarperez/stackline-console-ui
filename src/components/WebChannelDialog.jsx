// Widget de chat para la página de la empresa (canal web). La llave del widget
// es pública; lo que lo protege son los dominios permitidos: desde cualquier
// otro sitio, agents-services lo rechaza.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import { parseOrigins, MAX_ORIGINS, DEFAULT_COLOR } from '../lib/web.js';

const HEX = /^#[0-9a-f]{6}$/i;

export default function WebChannelDialog({ widget, agents, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !widget;
  const atienden = agents.filter((a) => !a.archived);
  const [f, setF] = useState(() => ({
    name: widget?.name ?? '',
    origins: (widget?.allowedOrigins ?? []).join('\n'),
    title: widget?.title ?? '',
    greeting: widget?.greeting ?? '',
    color: widget?.color ?? DEFAULT_COLOR,
    tenantAgentId: widget ? (widget.tenantAgentId ?? '') : (atienden[0]?.id ?? ''),
    active: widget?.active ?? true,
    showPrices: widget?.showPrices ?? true,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const guardar = async () => {
    const e = {};
    if (!f.name.trim()) e.name = t('ai.err.name', 'El nombre es obligatorio');
    const { valid, invalid } = parseOrigins(f.origins);
    if (invalid.length) e.allowedOrigins = t('web.err.origin', 'Dominio inválido: {{d}} (usa https://www.ejemplo.com)', { d: invalid[0] });
    else if (!valid.length) e.allowedOrigins = t('web.err.noOrigins', 'Agrega al menos un dominio');
    else if (valid.length > MAX_ORIGINS) e.allowedOrigins = t('web.err.maxOrigins', 'Máximo {{n}} dominios', { n: MAX_ORIGINS });
    if (!HEX.test(f.color)) e.color = t('web.err.color', 'Color en formato #RRGGBB');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const datos = {
      name: f.name.trim(),
      allowedOrigins: valid,
      title: f.title.trim() || null,
      greeting: f.greeting.trim() || null,
      color: f.color.toUpperCase(),
      tenantAgentId: f.tenantAgentId === '' ? null : Number(f.tenantAgentId),
      showPrices: f.showPrices,
    };
    if (!nuevo) datos.active = f.active;
    try {
      await onSubmit(datos);
    } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  return (
    <Modal title={nuevo ? t('web.new', 'Nuevo chat web') : t('web.editTitle', 'Editar {{name}}', { name: widget.name })}
      onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid" style={{ marginTop: 0 }}>
        <Field label={t('web.name', 'Nombre')} error={errors.name} hint={t('web.nameHint', 'Solo para la consola, p. ej. «Tienda en línea».')}>
          <input className="field-input" value={f.name} maxLength={80} onChange={set('name')} />
        </Field>
        <Field label={t('web.agent', 'Agente que atiende')} error={errors.tenantAgentId}
          hint={atienden.length ? t('web.agentHint', 'Sin agente, el chat no responde.') : t('web.noAgents', 'Crea primero un agente para la empresa.')}>
          <select className="field-input" value={f.tenantAgentId} onChange={set('tenantAgentId')}>
            <option value="">{t('web.noAgent', 'Sin agente')}</option>
            {atienden.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field span2 label={t('web.origins', 'Dominios permitidos')} error={errors.allowedOrigins}
          hint={t('web.originsHint', 'Uno por línea, con https://. Usa https://*.ejemplo.com para todos sus subdominios. Desde otro sitio el chat no carga.')}>
          <textarea className="field-input mono" rows={3} value={f.origins} onChange={set('origins')}
            placeholder={'https://www.ejemplo.com\nhttps://tienda.ejemplo.com'} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('web.look', 'Cómo se ve')}</h4>
      <div className="form-grid">
        <Field label={t('web.title', 'Título')} error={errors.title} hint={t('web.titleHint', 'Encabezado del chat. Vacío: «Asistente virtual».')}>
          <input className="field-input" value={f.title} maxLength={60} onChange={set('title')} />
        </Field>
        <Field label={t('web.color', 'Color')} error={errors.color}>
          <div className="web-color">
            <input type="color" value={HEX.test(f.color) ? f.color : DEFAULT_COLOR} onChange={set('color')} aria-label={t('web.color', 'Color')} />
            <input className="field-input mono" value={f.color} maxLength={7} onChange={set('color')} />
          </div>
        </Field>
        <Field span2 label={t('web.greeting', 'Saludo')} error={errors.greeting}
          hint={t('web.greetingHint', 'Primer mensaje que ve el visitante al abrir el chat. Opcional.')}>
          <textarea className="field-input" rows={2} maxLength={300} value={f.greeting} onChange={set('greeting')} />
        </Field>
      </div>

      <label className="switch-row">
        <input type="checkbox" checked={f.showPrices} onChange={(e) => setF({ ...f, showPrices: e.target.checked })} />
        <span>{t('web.showPrices', 'Mostrar precios en el carrito')}
          <span className="field-hint">{t('web.showPricesHint', 'El panel «Tu cotización» muestra precios y total. Apagado, solo productos y cantidades; el precio llega con el PDF.')}</span>
        </span>
      </label>

      {!nuevo && (
        <label className="switch-row">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>{t('ta.active', 'Encendido')}
            <span className="field-hint">{t('web.activeHint', 'Apagado, el chat desaparece de la página.')}</span>
          </span>
        </label>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

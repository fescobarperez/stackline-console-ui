// Agente de una empresa: instancia de un tipo con lo suyo. Lo que queda vacío
// hereda del tipo (modelo, respaldo, imágenes, temperatura) y las herramientas
// solo se pueden quitar, nunca agregar: el tipo es el techo.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import ToolBrowser from './ToolBrowser.jsx';
import { channelLabel } from '../lib/agents.js';

export default function TenantAgentDialog({ agent, types, models, tools, channels, agents, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !agent;
  const disponibles = types.filter((x) => x.kind === 'conversational' && !x.archived && x.active);
  const [f, setF] = useState(() => ({
    agentId: agent?.agentId ?? disponibles[0]?.id ?? '',
    name: agent?.name ?? '',
    modelId: agent?.modelId ?? '',
    fallbackModelId: agent?.fallbackModelId ?? '',
    imageModelId: agent?.imageModelId ?? '',
    temperature: agent?.temperature == null ? '' : String(agent.temperature),
    toolsMode: agent?.tools == null ? 'all' : 'some',
    tools: new Set(agent?.tools ?? []),
    channels: new Set(channels.filter((c) => agent && c.tenantAgentId === agent.id).map((c) => c.id ?? 'erp')),
    active: agent?.active ?? true,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const tipo = types.find((x) => x.id === Number(f.agentId));
  const modelo = (id) => models.find((m) => m.id === id);
  const nombre = (id) => (id ? modelo(id)?.modelName || '—' : t('ai.none', 'Ninguno'));
  // Las del tipo, una por herramienta del catálogo que cubren (un patrón con * cubre varias).
  const delTipo = useMemo(() => tools.filter((x) => tipo?.tools.some((g) => g.pattern === x.name
    || (g.pattern.endsWith('.*') && x.name.startsWith(g.pattern.slice(0, -1))))), [tipo, tools]);
  const deChat = models.filter((m) => m.active && m.supportsTools);
  const deImagenes = models.filter((m) => m.active && m.generatesImages);

  const toggle = (k, v) => setF((x) => {
    const s = new Set(x[k]);
    if (s.has(v)) s.delete(v); else s.add(v);
    return { ...x, [k]: s };
  });
  const elegirTipo = (id) => setF((x) => ({ ...x, agentId: id, tools: new Set(), toolsMode: 'all',
    name: !x.name || x.name === tipo?.name ? (types.find((y) => y.id === Number(id))?.name || '') : x.name }));

  const guardar = async () => {
    const e = {};
    if (nuevo && !tipo) e.agentId = t('ta.err.type', 'Elige un tipo de agente');
    const nombreLimpio = (f.name.trim() || tipo?.name || '').trim();
    if (!nombreLimpio) e.name = t('ai.err.name', 'El nombre es obligatorio');
    let temperature = null;
    if (f.temperature.trim() !== '') {
      temperature = Number(f.temperature);
      if (!(temperature >= 0 && temperature <= 1)) e.temperature = t('ai.err.temperature', 'Entre 0 y 1');
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    const ids = [...f.channels].filter((c) => c !== 'erp');
    const datos = {
      ...(nuevo ? { agentId: Number(f.agentId) } : { active: f.active }),
      name: nombreLimpio,
      modelId: f.modelId === '' ? null : Number(f.modelId),
      fallbackModelId: f.fallbackModelId === '' ? null : Number(f.fallbackModelId),
      imageModelId: f.imageModelId === '' ? null : Number(f.imageModelId),
      temperature,
      tools: f.toolsMode === 'all' ? null : delTipo.filter((x) => f.tools.has(x.name)).map((x) => x.name),
      channelIds: ids,
      includeErp: f.channels.has('erp') || f.channels.has(channels.find((c) => c.kind === 'erp')?.id),
    };
    setBusy(true);
    try { await onSubmit(datos); } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  const heredado = (id) => t('ta.inherit', 'Del tipo ({{m}})', { m: nombre(id) });
  const ocupadoPor = (c) => (c.tenantAgentId && c.tenantAgentId !== agent?.id ? agents.find((a) => a.id === c.tenantAgentId)?.name : null);

  return (
    <Modal size="modal-lg" title={nuevo ? t('ta.new', 'Nuevo agente') : t('ta.edit', 'Agente {{name}}', { name: agent.name })} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy || (nuevo && disponibles.length === 0)}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <Field label={t('ta.type', 'Tipo de agente')} error={errors.agentId}
          hint={nuevo ? t('ta.typeHint', 'Define el rol y las herramientas que puede usar. No se cambia después.') : undefined}>
          <select className="field-input" value={f.agentId} disabled={!nuevo} onChange={(e) => elegirTipo(e.target.value)}>
            {(nuevo ? disponibles : types.filter((x) => x.id === agent.agentId)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label={t('ta.name', 'Nombre')} error={errors.name} hint={t('ta.nameHint', 'Para distinguirlo en la empresa, p. ej. «Ventas WhatsApp» o «Ventas Web».')}>
          <input className="field-input" value={f.name} placeholder={tipo?.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('ai.model', 'Modelo')} error={errors.modelId}>
          <select className="field-input" value={f.modelId} onChange={(e) => setF({ ...f, modelId: e.target.value })}>
            <option value="">{heredado(tipo?.modelId)}</option>
            {deChat.map((m) => <option key={m.id} value={m.id}>{m.modelName} · {m.provider?.name}</option>)}
          </select>
        </Field>
        <Field label={t('ai.fallback', 'Modelo de respaldo')} error={errors.fallbackModelId}>
          <select className="field-input" value={f.fallbackModelId} onChange={(e) => setF({ ...f, fallbackModelId: e.target.value })}>
            <option value="">{heredado(tipo?.fallbackModelId)}</option>
            {deChat.map((m) => <option key={m.id} value={m.id}>{m.modelName} · {m.provider?.name}</option>)}
          </select>
        </Field>
        <Field label={t('ai.imageModel', 'Modelo de imágenes')} error={errors.imageModelId}
          hint={t('ta.imageHint', 'Si la empresa no quiere imágenes de ejemplo, apágalas en el playbook o quita la herramienta de render.')}>
          <select className="field-input" value={f.imageModelId} onChange={(e) => setF({ ...f, imageModelId: e.target.value })}>
            <option value="">{heredado(tipo?.imageModelId)}</option>
            {deImagenes.map((m) => <option key={m.id} value={m.id}>{m.modelName} · {m.provider?.name}</option>)}
          </select>
        </Field>
        <Field label={t('ai.temperature', 'Temperatura')} error={errors.temperature}>
          <input className="field-input mono" inputMode="decimal" value={f.temperature} placeholder={tipo ? String(tipo.temperature) : ''}
            onChange={(e) => setF({ ...f, temperature: e.target.value })} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('ta.channels', 'Canales que atiende')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('ta.channelsHint', 'Un canal lo atiende un solo agente: al marcarlo aquí, deja de atenderlo el anterior.')}</p>
      {channels.length === 0 ? <p className="field-hint">{t('ta.noChannels', 'La empresa aún no tiene canales.')}</p> : (
        <div className="channel-checks">
          {channels.map((c) => {
            const clave = c.id ?? 'erp';
            const otro = ocupadoPor(c);
            return (
              <label key={clave} className={`module-check ${f.channels.has(clave) ? 'on' : ''}`}>
                <input type="checkbox" checked={f.channels.has(clave)} onChange={() => toggle('channels', clave)} />
                <span>
                  <span className="module-check-name">{channelLabel(c, t)}</span>
                  {otro && <span className="field-hint">{t('ta.attendedBy', 'Hoy lo atiende {{name}}', { name: otro })}</span>}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('ai.tools', 'Herramientas')}</h4>
      <div className="seg-choice" role="radiogroup" aria-label={t('ai.tools', 'Herramientas')}>
        <label className="switch-inline"><input type="radio" name="toolsMode" checked={f.toolsMode === 'all'} onChange={() => setF({ ...f, toolsMode: 'all' })} />
          {t('ta.toolsAll', 'Todas las del tipo ({{n}})', { n: delTipo.length })}</label>
        <label className="switch-inline"><input type="radio" name="toolsMode" checked={f.toolsMode === 'some'}
          onChange={() => setF({ ...f, toolsMode: 'some', tools: f.tools.size ? f.tools : new Set(delTipo.map((x) => x.name)) })} />
          {t('ta.toolsSome', 'Solo algunas')}</label>
      </div>
      {errors.tools && <div className="field-error">{errors.tools}</div>}
      {f.toolsMode === 'some' && (
        <div style={{ marginTop: 8 }}>
        <ToolBrowser tools={delTipo} className="module-checks" isSelected={(x) => f.tools.has(x.name)} renderItem={(x) => (
            <label key={x.name} className={`module-check ${f.tools.has(x.name) ? 'on' : ''}`}>
              <input type="checkbox" checked={f.tools.has(x.name)} onChange={() => toggle('tools', x.name)} />
              <span>
                <span className="module-check-name mono">{x.name}{x.mode === 'write' && <span className="badge-m3 warning" style={{ marginLeft: 6 }}>{t('ai.write', 'Escribe')}</span>}</span>
                <span className="field-hint">{x.description}</span>
              </span>
            </label>
          )} />
        </div>
      )}

      {!nuevo && (
        <label className="switch-row">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>{t('ta.active', 'Encendido')}
            <span className="field-hint">{t('ta.activeHint', 'Apagado, sus canales quedan sin respuesta automática.')}</span>
          </span>
        </label>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

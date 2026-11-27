// Tipo de agente (catálogo global): nombre, modelo, respaldo, parámetros y
// herramientas que PUEDE usar (el techo). Sin `agent` es el alta: además pide
// código, tipo y el prompt del rol. Lo que cambia cada empresa (modelo propio,
// menos herramientas, instrucciones) se hace en los agentes de su ficha.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import ToolBrowser from './ToolBrowser.jsx';
import { parseDecimal, validateAgent, slugKey } from '../lib/ai.js';

export default function AgentDialog({ agent: existente, models, tools, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !existente;
  const agent = existente || {
    name: '', code: '', kind: 'conversational', description: '',
    modelId: models.find((m) => m.active && m.supportsTools)?.id ?? '', fallbackModelId: null, imageModelId: null,
    temperature: 0.2, maxToolLoops: 5, responseTimeoutMs: 30000, tools: [],
  };
  const activos = models.filter((m) => m.active || m.id === agent.modelId || m.id === agent.fallbackModelId);
  const deImagenes = models.filter((m) => (m.active && m.generatesImages) || m.id === agent.imageModelId);
  const deAgente = useMemo(() => Object.fromEntries(agent.tools.map((x) => [x.pattern, x])), [agent.tools]);
  const [f, setF] = useState({
    name: agent.name || '',
    code: agent.code || '',
    kind: agent.kind,
    description: agent.description || '',
    prompt: '',
    modelId: agent.modelId,
    fallbackModelId: agent.fallbackModelId ?? '',
    imageModelId: agent.imageModelId ?? '',
    temperature: String(agent.temperature),
    maxToolLoops: String(agent.maxToolLoops),
    timeoutS: String(Math.round(agent.responseTimeoutMs / 1000)),
    tools: Object.fromEntries(tools.map((x) => [x.name, {
      on: Boolean(deAgente[x.name]),
      autoApprove: deAgente[x.name]?.autoApprove ?? x.mode === 'read',
      maxAmount: deAgente[x.name]?.maxAmount == null ? '' : String(deAgente[x.name].maxAmount),
    }])),
  });
  const conversacional = f.kind === 'conversational';
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const setTool = (name, k, v) => setF((x) => ({ ...x, tools: { ...x.tools, [name]: { ...x.tools[name], [k]: v } } }));

  const mensajes = {
    modelId: t('ai.err.model', 'Elige un modelo activo que use herramientas'),
    fallbackModelId: t('ai.err.fallback', 'Elige otro modelo activo'),
    imageModelId: t('ai.err.imageModel', 'Elige un modelo activo que edite imágenes'),
    temperature: t('ai.err.temperature', 'Entre 0 y 1'),
    maxToolLoops: t('ai.err.loops', 'Entero entre 0 y 10'),
    responseTimeoutMs: t('ai.err.timeout', 'Entre 5 y 120 segundos'),
  };

  const guardar = async () => {
    const e = {};
    const elegidas = tools.filter((x) => f.tools[x.name].on).map((x) => {
      let tope = null;
      try { tope = parseDecimal(f.tools[x.name].maxAmount); } catch { e[`tools.${x.name}`] = t('ai.err.amount', 'Monto mayor a 0'); }
      return { pattern: x.name, mode: x.mode, autoApprove: x.mode === 'read' ? true : f.tools[x.name].autoApprove, maxAmount: x.mode === 'write' ? tope : null };
    });
    // Los permisos que la lista no muestra (p. ej. el comodín «planificador.*»
    // del planificador) se conservan tal cual: guardar no le quita permisos.
    const enLista = new Set(tools.map((x) => x.name));
    const ocultas = agent.tools.filter((x) => !enLista.has(x.pattern));
    if (!f.name.trim()) e.name = t('ai.err.name', 'El nombre es obligatorio');
    if (nuevo && !/^[a-z][a-z0-9_]{1,59}$/.test(f.code)) e.code = t('ai.err.code', 'Minúsculas, números y guion bajo (2 a 60)');
    if (nuevo && f.prompt.trim().length < 20) e.prompt = t('ai.err.prompt', 'Mínimo 20 caracteres');
    const datos = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      ...(nuevo ? { code: f.code, kind: f.kind, prompt: f.prompt.trim() } : {}),
      modelId: Number(f.modelId),
      fallbackModelId: f.fallbackModelId === '' ? null : Number(f.fallbackModelId),
      ...(conversacional ? { imageModelId: f.imageModelId === '' ? null : Number(f.imageModelId) } : {}),
      temperature: f.temperature.trim() === '' ? NaN : Number(f.temperature),
      maxToolLoops: /^\d+$/.test(f.maxToolLoops) ? Number(f.maxToolLoops) : NaN,
      responseTimeoutMs: /^\d+$/.test(f.timeoutS) ? Number(f.timeoutS) * 1000 : NaN,
      tools: conversacional ? [...elegidas, ...ocultas] : [],
    };
    Object.keys(validateAgent(datos, models)).forEach((k) => {
      if (!e[k]) e[k] = k.startsWith('tools.') ? t('ai.err.amount', 'Monto mayor a 0') : mensajes[k];
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await onSubmit(datos); } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  const opcion = (m) => `${m.modelName} · ${m.provider?.name || ''}${m.supportsTools ? '' : ` (${t('ai.noTools', 'sin herramientas')})`}`;

  return (
    <Modal size="modal-lg" title={nuevo ? t('ai.newType', 'Nuevo tipo de agente') : t('ai.editAgent', 'Agente {{name}}', { name: agent.name })} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <Field label={t('ai.typeName', 'Nombre')} error={errors.name}>
          <input className="field-input" value={f.name} maxLength={120}
            onChange={(e) => setF({ ...f, name: e.target.value, ...(nuevo && slugKey(f.name) === f.code ? { code: slugKey(e.target.value) } : {}) })} />
        </Field>
        {nuevo ? (
          <Field label={t('ai.typeCode', 'Código')} error={errors.code} hint={t('ai.typeCodeHint', 'Identifica el tipo en el sistema; no se cambia después.')}>
            <input className="field-input mono" value={f.code} maxLength={60} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
          </Field>
        ) : (
          <Field label={t('ai.typeCode', 'Código')}><input className="field-input mono" value={agent.code} disabled /></Field>
        )}
        {nuevo && (
          <Field label={t('ai.kind', 'Tipo')} hint={t('ai.kindHint', 'Conversa: atiende canales de las empresas. Interno: lo invoca el sistema (p. ej. resúmenes).')}>
            <select className="field-input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="conversational">{t('ai.kindConversational', 'Conversa')}</option>
              <option value="internal">{t('ai.kindInternal', 'Interno')}</option>
            </select>
          </Field>
        )}
        <Field label={t('ai.description', 'Descripción')} span2>
          <input className="field-input" value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label={t('ai.model', 'Modelo')} error={errors.modelId}>
          <select className="field-input" value={f.modelId} onChange={(e) => setF({ ...f, modelId: e.target.value })}>
            {activos.map((m) => <option key={m.id} value={m.id}>{opcion(m)}</option>)}
          </select>
        </Field>
        <Field label={t('ai.fallback', 'Modelo de respaldo')} error={errors.fallbackModelId}
          hint={t('ai.fallbackHint', 'Responde si el principal falla o tarda demasiado.')}>
          <select className="field-input" value={f.fallbackModelId} onChange={(e) => setF({ ...f, fallbackModelId: e.target.value })}>
            <option value="">{t('ai.noFallback', 'Sin respaldo')}</option>
            {activos.map((m) => <option key={m.id} value={m.id}>{opcion(m)}</option>)}
          </select>
        </Field>
        {conversacional && (
          <Field label={t('ai.imageModel', 'Modelo de imágenes')} error={errors.imageModelId}
            hint={t('ai.imageModelHint', 'Hace las imágenes de ejemplo sobre la foto del cliente. Cada empresa decide en su playbook si las usa.')}>
            <select className="field-input" value={f.imageModelId} onChange={(e) => setF({ ...f, imageModelId: e.target.value })}>
              <option value="">{t('ai.noImageModel', 'Sin imágenes de ejemplo')}</option>
              {deImagenes.map((m) => <option key={m.id} value={m.id}>{`${m.modelName} · ${m.provider?.name || ''}`}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('ai.temperature', 'Temperatura')} error={errors.temperature}
          hint={t('ai.temperatureHint', '0 = siempre igual; 1 = más variado. Para vender, 0.2.')}>
          <input className="field-input mono" inputMode="decimal" value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })} />
        </Field>
        <Field label={t('ai.loops', 'Herramientas por respuesta (máx.)')} error={errors.maxToolLoops}>
          <input className="field-input mono" inputMode="numeric" value={f.maxToolLoops} onChange={(e) => setF({ ...f, maxToolLoops: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
        <Field label={t('ai.timeout', 'Tiempo máximo de respuesta (s)')} error={errors.responseTimeoutMs}>
          <input className="field-input mono" inputMode="numeric" value={f.timeoutS} onChange={(e) => setF({ ...f, timeoutS: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
      </div>

      {nuevo && (
        <div style={{ marginTop: 16 }}>
        <Field label={t('ai.rolePrompt', 'Prompt del rol')} error={errors.prompt}
          hint={t('ai.rolePromptHint', 'Qué hace este tipo de agente. La identidad de Tino va antes y las instrucciones de cada empresa después.')}>
          <textarea className="field-input prompt-edit" rows={8} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} />
        </Field>
        </div>
      )}

      {conversacional && (
        <>
          <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('ai.tools', 'Herramientas')}</h4>
          <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('ai.toolsHint', 'Lo que el agente puede hacer en el ERP. Las de escritura piden confirmación al cliente; el monto máximo las detiene por encima de ese total.')}</p>
          <ToolBrowser tools={tools} isSelected={(x) => f.tools[x.name].on} renderItem={(x) => {
              const st = f.tools[x.name];
              return (
                <div key={x.name} className={`tool-row ${st.on ? 'on' : ''}`}>
                  <label className="tool-main">
                    <input type="checkbox" checked={st.on} onChange={(e) => setTool(x.name, 'on', e.target.checked)} />
                    <span>
                      <span className="mono tool-name">{x.name}</span>
                      <span className="field-hint">{x.description}</span>
                    </span>
                  </label>
                  <span className={`badge-m3 ${x.mode === 'write' ? 'warning' : 'neutral'}`}>{x.mode === 'write' ? t('ai.write', 'Escribe') : t('ai.read', 'Lee')}</span>
                  {x.mode === 'write' && st.on && (
                    <div className="tool-write">
                      <label className="tool-auto">
                        <input type="checkbox" checked={st.autoApprove} onChange={(e) => setTool(x.name, 'autoApprove', e.target.checked)} />
                        {t('ai.autoApprove', 'Sin revisión de un vendedor')}
                      </label>
                      <Field label={t('ai.maxAmount', 'Monto máximo (Q)')} error={errors[`tools.${x.name}`]}>
                        <input className="field-input mono" inputMode="decimal" value={st.maxAmount} placeholder={t('ai.noMax', 'Sin tope')}
                          onChange={(e) => setTool(x.name, 'maxAmount', e.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              );
          }} />
        </>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

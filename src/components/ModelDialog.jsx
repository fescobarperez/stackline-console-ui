// Alta o edición de un modelo: precios por 1 000 tokens (USD) y qué soporta.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import { parseDecimal, validateModel } from '../lib/ai.js';

const txt = (v) => (v == null ? '' : String(v));

export default function ModelDialog({ model, providers, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !model;
  const [f, setF] = useState({
    providerId: model?.providerId ?? providers[0]?.id,
    modelName: model?.modelName || '',
    contextWindow: txt(model?.contextWindow),
    inputCost1k: txt(model?.inputCost1k),
    cachedCost1k: txt(model?.cachedCost1k),
    outputCost1k: txt(model?.outputCost1k),
    supportsTools: model?.supportsTools ?? true,
    supportsCache: model?.supportsCache ?? false,
    supportsVision: model?.supportsVision ?? false,
    generatesImages: model?.generatesImages ?? false,
    imageCost: txt(model?.imageCost || ''),
    active: model?.active ?? true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const num = t('ai.err.number', 'Número mayor o igual a 0');

  const guardar = async () => {
    const e = {};
    const dec = (k) => { try { return parseDecimal(f[k]); } catch { e[k] = num; return null; } };
    const datos = {
      contextWindow: /^\d+$/.test(f.contextWindow) ? Number(f.contextWindow) : NaN,
      inputCost1k: dec('inputCost1k'), cachedCost1k: dec('cachedCost1k'), outputCost1k: dec('outputCost1k'),
      supportsTools: f.supportsTools, supportsCache: f.supportsCache,
      supportsVision: f.supportsVision, generatesImages: f.generatesImages,
      imageCost: f.generatesImages ? dec('imageCost') : 0,
      ...(nuevo ? { providerId: Number(f.providerId), modelName: f.modelName.trim() } : { active: f.active }),
    };
    const v = validateModel({ ...datos, modelName: nuevo ? datos.modelName : model.modelName });
    Object.entries(v).forEach(([k]) => { if (!e[k]) e[k] = k === 'modelName' ? t('ai.err.modelName', 'El nombre es obligatorio') : k === 'contextWindow' ? t('ai.err.context', 'Entero de 1 000 o más') : num; });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await onSubmit(datos); } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  return (
    <Modal size="modal-lg" title={nuevo ? t('ai.newModel', 'Nuevo modelo') : t('ai.editModel', 'Editar {{name}}', { name: model.modelName })}
      onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <Field label={t('ai.provider', 'Proveedor')} error={errors.providerId}>
          <select className="field-input" value={f.providerId} onChange={set('providerId')} disabled={!nuevo}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label={t('ai.modelName', 'Nombre del modelo')} error={errors.modelName}
          hint={nuevo ? t('ai.modelNameHint', 'Tal como lo nombra el proveedor en su API.') : null}>
          <input className="field-input mono" value={f.modelName} onChange={set('modelName')} disabled={!nuevo} />
        </Field>
        <Field label={t('ai.context', 'Ventana de contexto (tokens)')} error={errors.contextWindow}>
          <input className="field-input mono" inputMode="numeric" value={f.contextWindow} onChange={(e) => setF({ ...f, contextWindow: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
        <div />
        <Field label={t('ai.inputCost', 'Entrada (US$ por 1 000 tokens)')} error={errors.inputCost1k}>
          <input className="field-input mono" inputMode="decimal" value={f.inputCost1k} onChange={set('inputCost1k')} />
        </Field>
        <Field label={t('ai.cachedCost', 'Entrada cacheada (US$ por 1 000)')} error={errors.cachedCost1k}
          hint={t('ai.cachedHint', 'Vacío = se cobra como entrada normal.')}>
          <input className="field-input mono" inputMode="decimal" value={f.cachedCost1k} onChange={set('cachedCost1k')} />
        </Field>
        <Field label={t('ai.outputCost', 'Salida (US$ por 1 000 tokens)')} error={errors.outputCost1k}>
          <input className="field-input mono" inputMode="decimal" value={f.outputCost1k} onChange={set('outputCost1k')} />
        </Field>
      </div>
      <p className="field-hint">{t('ai.priceHint', 'Un cambio de precio aplica a las llamadas nuevas: lo ya registrado conserva su costo.')}</p>
      <label className="switch-row">
        <input type="checkbox" checked={f.supportsTools} onChange={set('supportsTools')} />
        <span>{t('ai.supportsTools', 'Usa herramientas')}<span className="field-hint">{t('ai.supportsToolsHint', 'Necesario para un agente que consulta o escribe en el ERP.')}</span></span>
      </label>
      <label className="switch-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={f.supportsCache} onChange={set('supportsCache')} />
        <span>{t('ai.supportsCache', 'Cachea la entrada')}</span>
      </label>
      <label className="switch-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={f.supportsVision} onChange={set('supportsVision')} />
        <span>{t('ai.supportsVision', 'Lee imágenes')}<span className="field-hint">{t('ai.supportsVisionHint', 'Necesario para que el agente entienda las fotos que manda el cliente.')}</span></span>
      </label>
      <label className="switch-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={f.generatesImages} onChange={set('generatesImages')} />
        <span>{t('ai.generatesImages', 'Edita imágenes')}<span className="field-hint">{t('ai.generatesImagesHint', 'Para las imágenes de ejemplo que el agente hace sobre la foto del cliente.')}</span></span>
      </label>
      {f.generatesImages && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label={t('ai.imageCost', 'Costo por imagen (US$)')} error={errors.imageCost}
            hint={t('ai.imageCostHint', 'Lo que cobra el proveedor por cada imagen; con él se calcula el costo de los renders.')}>
            <input className="field-input mono" inputMode="decimal" value={f.imageCost} onChange={set('imageCost')} />
          </Field>
        </div>
      )}
      {!nuevo && (
        <label className="switch-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={f.active} onChange={set('active')} />
          <span>{t('ai.modelActive', 'Disponible')}<span className="field-hint">{t('ai.modelActiveHint', 'No se puede apagar mientras lo use un agente o una empresa.')}</span></span>
        </label>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

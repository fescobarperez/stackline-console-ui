// Crear o editar un plan: módulos incluidos y límites. Base siempre va.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import LimitsFields from './LimitsFields.jsx';
import { BASE, LIMIT_KEYS, parseLimit, parsePrice } from '../lib/plans.js';

const aTexto = (limits = {}) => Object.fromEntries(LIMIT_KEYS.map((k) => [k, limits[k] == null ? '' : String(limits[k])]));

export default function PlanDialog({ plan, modules, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !plan;
  const [f, setF] = useState({
    code: plan?.code || '',
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price == null ? '' : String(plan.price),
    modules: new Set(plan?.modules || [BASE]),
    limits: aTexto(plan?.limits),
    active: plan?.active ?? true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const toggle = (code) => setF((x) => {
    const m = new Set(x.modules);
    if (m.has(code)) m.delete(code); else m.add(code);
    return { ...x, modules: m };
  });

  const guardar = async () => {
    const e = {};
    if (nuevo && !/^[a-z0-9_]{2,30}$/.test(f.code)) e.code = t('plans.err.code', 'Minúsculas, números o guion bajo; 2 a 30 caracteres');
    if (!f.name.trim()) e.name = t('create.err.name', 'El nombre es obligatorio');
    let price = null;
    try { price = parsePrice(f.price); } catch { /* abajo */ }
    if (price == null) e.price = t('plans.err.price', 'Monto en quetzales, hasta 2 decimales');
    const limits = {};
    LIMIT_KEYS.forEach((k) => {
      try { limits[k] = parseLimit(f.limits[k]); } catch { e[`limits.${k}`] = t('plans.err.limit', 'Número entero'); }
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    const datos = {
      name: f.name.trim(), description: f.description.trim(), price,
      modules: modules.map((m) => m.code).filter((c) => f.modules.has(c) || c === BASE), limits,
      ...(nuevo ? { code: f.code } : { active: f.active }),
    };
    setBusy(true);
    try {
      await onSubmit(datos);
    } catch (err) {
      setErrors(err.fields || { _: err.message });
      setBusy(false);
    }
  };

  const limitErrors = Object.fromEntries(LIMIT_KEYS.map((k) => [k, errors[`limits.${k}`]]));

  return (
    <Modal size="modal-lg" title={nuevo ? t('plans.new', 'Nuevo plan') : t('plans.editTitle', 'Editar plan {{name}}', { name: plan.name })}
      onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <Field label={t('plans.name', 'Nombre')} error={errors.name}>
          <input className="field-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t('plans.code', 'Código')} error={errors.code}
          hint={nuevo ? t('plans.codeHint', 'Identificador interno; no cambia después.') : null}>
          <input className="field-input mono" value={f.code} disabled={!nuevo}
            onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
        </Field>
        <Field label={t('plans.price', 'Precio mensual (Q)')} error={errors.price}
          hint={t('plans.priceHint', 'Lo que paga una empresa con este plan; en la ficha se puede pactar otro.')}>
          <input className="field-input mono" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        </Field>
        <Field label={t('plans.description', 'Descripción')}>
          <input className="field-input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 8px' }}>{t('plans.modules', 'Módulos incluidos')}</h4>
      {errors.modules && <div className="field-error" style={{ marginBottom: 8 }}>{errors.modules}</div>}
      <div className="module-checks">
        {modules.map((m) => (
          <label key={m.code} className={`module-check ${f.modules.has(m.code) || m.alwaysOn ? 'on' : ''}`}>
            <input type="checkbox" checked={f.modules.has(m.code) || m.alwaysOn} disabled={m.alwaysOn} onChange={() => toggle(m.code)} />
            <span>
              <span className="module-check-name">{m.name}{m.alwaysOn && <span className="muted"> · {t('plans.always', 'siempre')}</span>}</span>
              <span className="field-hint">{m.description}</span>
            </span>
          </label>
        ))}
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('plans.limits', 'Límites')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('plans.limitsHint', 'Vacío = ilimitado.')}</p>
      <LimitsFields values={f.limits} errors={limitErrors} onChange={(k, v) => setF((x) => ({ ...x, limits: { ...x.limits, [k]: v } }))} />

      {!nuevo && (
        <label className="switch-row">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>
            {t('plans.active', 'Disponible para empresas nuevas')}
            <span className="field-hint">{t('plans.activeHint', 'Desactivarlo no afecta a las empresas que ya lo tienen.')}</span>
          </span>
        </label>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

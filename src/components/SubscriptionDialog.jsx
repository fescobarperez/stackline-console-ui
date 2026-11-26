// Cambiar el plan de una empresa y sus excepciones: módulos activados o
// quitados por encima del plan, y límites propios.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import LimitsFields from './LimitsFields.jsx';
import { BASE, LIMIT_KEYS, effectiveModules, parseLimit, parsePrice } from '../lib/plans.js';
import { fmtGtq } from '../lib/fmt.js';

export default function SubscriptionDialog({ subscription, plans, modules, onClose, onSubmit }) {
  const { t } = useTranslation();
  const actualId = subscription.plan.id;
  // Se ofrecen los planes activos y, aunque esté inactivo, el que ya tiene.
  const opciones = plans.filter((p) => p.active || p.id === actualId);
  const [planId, setPlanId] = useState(actualId);
  const plan = plans.find((p) => p.id === planId);
  const [on, setOn] = useState(() => new Set(subscription.effective.modules));
  const [limits, setLimits] = useState(() => Object.fromEntries(LIMIT_KEYS.map((k) => [k, subscription.limitOverrides[k] == null ? '' : String(subscription.limitOverrides[k])])));
  const [precio, setPrecio] = useState(subscription.priceOverride == null ? '' : String(subscription.priceOverride));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Al cambiar de plan los módulos vuelven a los del plan nuevo: arrastrar
  // excepciones pensadas para otro plan suele dejar combinaciones raras.
  const cambiarPlan = (id) => {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    setOn(new Set(effectiveModules(p.modules)));
  };

  const toggle = (code) => setOn((s) => {
    const n = new Set(s);
    if (n.has(code)) n.delete(code); else n.add(code);
    return n;
  });

  const overrides = useMemo(() => {
    const enPlan = new Set(plan?.modules || []);
    const codes = modules.map((m) => m.code).filter((c) => c !== BASE);
    return {
      enabled: codes.filter((c) => on.has(c) && !enPlan.has(c)),
      disabled: codes.filter((c) => !on.has(c) && enPlan.has(c)),
    };
  }, [on, plan, modules]);

  const guardar = async () => {
    const e = {};
    const limitOverrides = {};
    LIMIT_KEYS.forEach((k) => {
      try {
        const v = parseLimit(limits[k]);
        if (v !== null) limitOverrides[k] = v;
      } catch { e[k] = t('plans.err.limit', 'Número entero'); }
    });
    let priceOverride = null;
    try { priceOverride = parsePrice(precio); } catch { e.priceOverride = t('plans.err.price', 'Monto en quetzales, hasta 2 decimales'); }
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSubmit({ planId, overrides, limitOverrides, priceOverride });
    } catch (err) {
      setErrors({ _: err.message });
      setBusy(false);
    }
  };

  const etiqueta = (code) => {
    if (code === BASE) return t('sub.src.base', 'Siempre');
    const enPlan = plan?.modules.includes(code);
    if (on.has(code)) return enPlan ? t('sub.src.plan', 'Del plan') : t('sub.src.added', 'Agregado');
    return enPlan ? t('sub.src.removed', 'Quitado') : t('sub.src.off', 'No incluido');
  };

  return (
    <Modal size="modal-lg" title={t('sub.title', 'Plan y módulos')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <Field label={t('sub.plan', 'Plan')} hint={planId !== actualId ? t('sub.planChangeHint', 'Al cambiar de plan, los módulos vuelven a los del plan nuevo.') : null}>
        <select className="field-input" value={planId} onChange={(e) => cambiarPlan(Number(e.target.value))}>
          {opciones.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ` (${t('plans.inactive', 'Inactivo')})`}</option>
          ))}
        </select>
      </Field>

      <div style={{ marginTop: 16 }}>
        <Field label={t('sub.agreedPriceLabel', 'Precio pactado (Q al mes)')} error={errors.priceOverride}
          hint={t('sub.agreedPriceHint', 'Vacío = el precio del plan ({{price}}).', { price: fmtGtq(plan?.price ?? 0) })}>
          <input className="field-input mono" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 8px' }}>{t('sub.modules', 'Módulos')}</h4>
      <div className="module-checks">
        {modules.map((m) => {
          const activo = on.has(m.code) || m.alwaysOn;
          const fuente = etiqueta(m.code);
          const excepcion = (overrides.enabled.includes(m.code) || overrides.disabled.includes(m.code));
          return (
            <label key={m.code} className={`module-check ${activo ? 'on' : ''}`}>
              <input type="checkbox" checked={activo} disabled={m.alwaysOn} onChange={() => toggle(m.code)} aria-describedby={`src-${m.code}`} />
              <span>
                <span className="module-check-name">{m.name}</span>
                <span id={`src-${m.code}`} className={`module-src ${excepcion ? 'override' : ''}`}>{fuente}</span>
              </span>
            </label>
          );
        })}
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('sub.limits', 'Límites propios')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('sub.limitsHint', 'Vacío = el límite del plan.')}</p>
      <LimitsFields values={limits} errors={errors} fallback={plan?.limits || {}} onChange={(k, v) => setLimits((x) => ({ ...x, [k]: v }))} />
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

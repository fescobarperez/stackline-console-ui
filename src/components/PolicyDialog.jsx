// Ajustes del asistente para toda la empresa (agent_tenant_policies): si
// responde, tope por cotización, a quién pasa la conversación, tono e idioma.
// Lo de cada agente (modelo, herramientas, canales) va en el agente.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import { parseDecimal } from '../lib/ai.js';

export default function PolicyDialog({ policy, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    enabled: policy.enabled,
    quoteLimit: policy.quoteLimit == null ? '' : String(policy.quoteLimit),
    escalationUser: policy.escalationUser || '',
    tone: policy.tone || '',
    locale: policy.locale || 'es-GT',
  });
  const tonos = {
    cercano: t('cai.tones.cercano', 'Cercano'),
    formal: t('cai.tones.formal', 'Formal'),
    breve: t('cai.tones.breve', 'Breve'),
  };
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    const e = {};
    let quoteLimit = null;
    try { quoteLimit = parseDecimal(f.quoteLimit); } catch { e.quoteLimit = t('ai.err.amount', 'Monto mayor a 0'); }
    if (quoteLimit === 0) e.quoteLimit = t('ai.err.amount', 'Monto mayor a 0');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSubmit({ enabled: f.enabled, quoteLimit, escalationUser: f.escalationUser.trim() || null, tone: f.tone || null, locale: f.locale });
    } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  return (
    <Modal title={t('cai.settings', 'Ajustes del asistente')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <label className="switch-row" style={{ marginTop: 0 }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
        <span>{t('cai.enabled', 'El asistente responde')}
          <span className="field-hint">{t('ta.enabledHint', 'Apagado, ningún agente de la empresa responde, en ningún canal.')}</span>
        </span>
      </label>
      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field label={t('cai.quoteLimit', 'Tope por cotización (Q)')} error={errors.quoteLimit}
          hint={t('cai.quoteLimitHint', 'Por encima, la cotización la revisa un vendedor antes de enviarse.')}>
          <input className="field-input mono" inputMode="decimal" value={f.quoteLimit} placeholder={t('ai.noMax', 'Sin tope')} onChange={(e) => setF({ ...f, quoteLimit: e.target.value })} />
        </Field>
        <Field label={t('cai.escalation', 'Pasa la conversación a')} error={errors.escalationUser} hint={t('cai.escalationHint', 'Quien atiende cuando el cliente pide una persona.')}>
          <input className="field-input" value={f.escalationUser} maxLength={120} onChange={(e) => setF({ ...f, escalationUser: e.target.value })} />
        </Field>
        <Field label={t('cai.tone', 'Tono')}>
          <select className="field-input" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}>
            <option value="">{t('cai.toneDefault', 'Predeterminado')}</option>
            {Object.entries(tonos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={t('cai.locale', 'Idioma y región')}>
          <select className="field-input" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>
            <option value="es-GT">Español (Guatemala)</option>
            <option value="en-US">English (US)</option>
          </select>
        </Field>
      </div>
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

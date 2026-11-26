// Campos de límites: vacío = ilimitado (o «usa el del plan» si `fallback`).
import React from 'react';
import { useTranslation } from 'react-i18next';
import Field from './Field.jsx';
import { LIMIT_KEYS } from '../lib/plans.js';
import { useLimitLabels } from '../hooks/useCatalog.js';

export default function LimitsFields({ values, onChange, errors = {}, fallback = null }) {
  const { t } = useTranslation();
  const labels = useLimitLabels();
  const placeholder = (k) => {
    if (!fallback) return t('limits.unlimited', 'Ilimitado');
    const v = fallback[k];
    return v === null || v === undefined
      ? t('limits.planUnlimited', 'Plan: ilimitado')
      : t('limits.planValue', 'Plan: {{v}}', { v: v.toLocaleString() });
  };
  return (
    <div className="form-grid">
      {LIMIT_KEYS.map((k) => (
        <Field key={k} label={labels[k]} error={errors[k]}>
          <input className="field-input mono" inputMode="numeric" value={values[k] ?? ''} placeholder={placeholder(k)}
            onChange={(e) => onChange(k, e.target.value.replace(/[^\d]/g, ''))} />
        </Field>
      ))}
    </div>
  );
}

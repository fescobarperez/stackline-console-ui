// Selector de mes para los reportes de uso: los últimos 6 meses.
import React, { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { lastMonths } from '../lib/usage.js';
import { fmtMonth } from '../lib/fmt.js';

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function MonthSelect({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const meses = useMemo(() => lastMonths(6), []);
  return (
    <div className="month-select">
      <label htmlFor={id} className="sr-only">{t('usage.month', 'Mes')}</label>
      <select id={id} className="field-input" value={value} onChange={(e) => onChange(e.target.value)} data-lang={i18n.language}>
        {meses.map((m) => <option key={m} value={m}>{capital(fmtMonth(m))}</option>)}
      </select>
    </div>
  );
}

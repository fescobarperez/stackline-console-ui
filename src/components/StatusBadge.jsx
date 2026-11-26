import React from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_BADGE } from '../lib/companyStatus.js';

export function useStatusLabel() {
  const { t } = useTranslation();
  return (s) => ({
    trial: t('status.trial', 'Prueba'),
    active: t('status.active', 'Activa'),
    suspended: t('status.suspended', 'Suspendida'),
    cancelled: t('status.cancelled', 'Cancelada'),
  }[s] || s);
}

export default function StatusBadge({ status }) {
  const label = useStatusLabel();
  return (
    <span className={`badge-m3 ${STATUS_BADGE[status] || ''}`}>
      <span className="dot" />
      {label(status)}
    </span>
  );
}

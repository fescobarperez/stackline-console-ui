// Cambio de estado de una empresa: solo ofrece las transiciones permitidas y
// pide motivo al suspender o cancelar. Cancelar es definitivo, así que se
// confirma escribiendo el código de la empresa.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import StatusBadge, { useStatusLabel } from './StatusBadge.jsx';
import { allowedTransitions, needsReason } from '../lib/companyStatus.js';

export default function StatusDialog({ company, onClose, onSubmit }) {
  const { t } = useTranslation();
  const label = useStatusLabel();
  const opciones = allowedTransitions(company.status);
  const [to, setTo] = useState(opciones[0]);
  const [reason, setReason] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const efecto = {
    active: t('statusDlg.effActive', 'La empresa vuelve a tener acceso a la app y a su agente.'),
    suspended: t('statusDlg.effSuspended', 'Nadie de la empresa podrá iniciar sesión y su agente deja de responder. Se puede reactivar.'),
    cancelled: t('statusDlg.effCancelled', 'Igual que suspender, pero definitivo. Los datos no se borran.'),
  };

  const faltaMotivo = needsReason(to) && !reason.trim();
  const faltaCodigo = to === 'cancelled' && confirmCode.trim().toUpperCase() !== company.code;

  const enviar = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit(to, reason.trim());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t('statusDlg.title', 'Cambiar estado')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant={to === 'cancelled' ? 'error' : 'accent'} onClick={enviar} disabled={busy || faltaMotivo || faltaCodigo}>
          {busy ? t('common.saving', 'Guardando…') : t('statusDlg.apply', 'Cambiar a {{s}}', { s: label(to).toLowerCase() })}
        </Button>
      </>}>
      <p className="section-description" style={{ marginTop: 0, marginBottom: 12 }}>
        {company.name} · {t('statusDlg.current', 'hoy está')} <StatusBadge status={company.status} />
      </p>
      <div className="status-options" role="radiogroup" aria-label={t('statusDlg.to', 'Nuevo estado')}>
        {opciones.map((s) => (
          <label key={s} className={`status-option ${to === s ? 'selected' : ''}`}>
            <input type="radio" name="to" value={s} checked={to === s} onChange={() => setTo(s)} />
            <span>
              <StatusBadge status={s} />
              <div className="field-hint" style={{ marginTop: 4 }}>{efecto[s]}</div>
            </span>
          </label>
        ))}
      </div>
      {needsReason(to) && (
        <div style={{ marginTop: 16 }}>
          <Field label={t('statusDlg.reason', 'Motivo')} hint={t('statusDlg.reasonHint', 'Queda en el historial de la empresa.')}>
            <input className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </Field>
        </div>
      )}
      {to === 'cancelled' && (
        <div style={{ marginTop: 12 }}>
          <Field label={t('statusDlg.confirmCode', 'Escribe {{code}} para confirmar', { code: company.code })}>
            <input className="field-input mono" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      )}
      {error && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

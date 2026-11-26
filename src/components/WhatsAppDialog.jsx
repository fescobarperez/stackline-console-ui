// Conectar un número de WhatsApp a la empresa por el registro integrado de Meta.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { metaSignupConfigured, startEmbeddedSignup } from '../lib/metaSignup.js';

export default function WhatsAppDialog({ company, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const listo = metaSignupConfigured();

  const conectar = async () => {
    setError(null);
    setBusy(true);
    try {
      const signup = await startEmbeddedSignup();
      await onSubmit(signup);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={t('wa.title', 'Conectar WhatsApp')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" icon="open_in_new" onClick={conectar} disabled={busy || !listo}>
          {busy ? t('wa.connecting', 'Conectando…') : t('wa.open', 'Abrir Meta')}
        </Button>
      </>}>
      <ol className="wa-steps">
        <li>{t('wa.step1', 'Se abre la ventana de Meta. Quien administra el negocio inicia sesión con su Facebook.')}</li>
        <li>{t('wa.step2', 'Elige o crea su cuenta de WhatsApp Business y verifica el número con un código.')}</li>
        <li>{t('wa.step3', 'El número queda bajo la app de Stackline y el agente de ventas empieza a responder. El token se guarda en el servidor; nadie lo ve.')}</li>
      </ol>
      <p className="field-hint">{t('wa.note', 'El número no puede estar en uso en la app de WhatsApp del teléfono.')}</p>
      {!listo && <p className="field-error">{t('wa.notConfigured', 'Falta configurar VITE_META_APP_ID y VITE_META_CONFIG_ID en la consola.')}</p>}
      {error && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

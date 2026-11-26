// El código que la empresa pega en su página para mostrar el chat.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import CopyField from './CopyField.jsx';
import Icon from './Icon.jsx';
import { widgetSnippet } from '../lib/web.js';

export default function WidgetCodeDialog({ widget, scriptUrl, onClose }) {
  const { t } = useTranslation();
  return (
    <Modal title={t('web.codeTitle', 'Código de {{name}}', { name: widget.name })} onClose={onClose}
      footer={<Button variant="accent" onClick={onClose}>{t('common.close', 'Cerrar')}</Button>}>
      {scriptUrl ? (
        <>
          <p className="body-small" style={{ marginTop: 0 }}>
            {t('web.codeHint', 'Pégalo en la página de la empresa, justo antes de </body>. El chat aparece abajo a la derecha.')}
          </p>
          <CopyField value={widgetSnippet(scriptUrl, widget.publicKey)} label={t('web.code', 'Código')} />
          <p className="field-hint" style={{ marginTop: 12 }}>
            <Icon name="info" size={14} /> {t('web.codeOrigins', 'Solo funciona en: {{list}}', { list: widget.allowedOrigins.join(', ') })}
          </p>
          <p className="field-hint">
            {t('web.codeOptions', 'Opcional: data-position="left" lo pone a la izquierda y data-open="true" lo abre al cargar.')}
          </p>
        </>
      ) : (
        <p className="field-error" role="alert" style={{ marginTop: 0 }}>
          {t('web.noPublicUrl', 'Falta AGENT_PUBLIC_URL en agents-services: sin la dirección pública no se puede armar el código.')}
        </p>
      )}
    </Modal>
  );
}

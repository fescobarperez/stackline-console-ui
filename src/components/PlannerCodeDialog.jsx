// El código que la empresa pega en su página para mostrar el planificador.
// Es un bloque fijo (no una burbuja): va donde la empresa quiera que aparezca.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import CopyField from './CopyField.jsx';
import Icon from './Icon.jsx';
import { plannerSnippet } from '../lib/planner.js';

export default function PlannerCodeDialog({ planner, scriptUrl, onClose }) {
  const { t } = useTranslation();
  return (
    <Modal title={t('web.codeTitle', 'Código de {{name}}', { name: planner.name })} onClose={onClose}
      footer={<Button variant="accent" onClick={onClose}>{t('common.close', 'Cerrar')}</Button>}>
      {scriptUrl ? (
        <>
          <p className="body-small" style={{ marginTop: 0 }}>
            {t('pln.codeHint', 'Pégalo en la página de la empresa, en el lugar donde debe aparecer el planificador.')}
          </p>
          <CopyField value={plannerSnippet(scriptUrl, planner.publicKey, planner.lang)} label={t('web.code', 'Código')} />
          <p className="field-hint" style={{ marginTop: 12 }}>
            <Icon name="info" size={14} /> {t('web.codeOrigins', 'Solo funciona en: {{list}}', { list: planner.allowedOrigins.join(', ') })}
          </p>
          <p className="field-hint">
            {t('pln.codeOptions', 'Opcional: data-accent="#RRGGBB" cambia el color en esa página. Convive con scroll suave (Lenis) sin configurar nada.')}
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

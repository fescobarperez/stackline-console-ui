// Valor de solo lectura con botón para copiarlo (p. ej. el enlace de
// activación, que el backend entrega una sola vez).
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

export default function CopyField({ value, label }) {
  const { t } = useTranslation();
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles: el campo se puede seleccionar a mano */ }
  };
  return (
    <div className="copy-field">
      {label && <span className="field-label">{label}</span>}
      <div className="copy-field-row">
        <input className="field-input mono" readOnly value={value} onFocus={(e) => e.target.select()} aria-label={label} />
        <button type="button" className="btn" onClick={copiar}>
          <Icon name={copiado ? 'check' : 'copy'} size={18} />
          {copiado ? t('common.copied', 'Copiado') : t('common.copy', 'Copiar')}
        </button>
      </div>
    </div>
  );
}

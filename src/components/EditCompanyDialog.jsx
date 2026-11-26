// Editar los datos generales. El código no cambia: es el que los usuarios
// de la empresa escriben al iniciar sesión.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import { isValidNit } from '../lib/companyStatus.js';

export default function EditCompanyDialog({ company, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: company.name, nit: company.nit || '', baseCurrency: company.baseCurrency || 'GTQ' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    const e = {};
    if (!f.name.trim()) e.name = t('create.err.name', 'El nombre es obligatorio');
    if (!isValidNit(f.nit)) e.nit = t('create.err.nit', 'NIT inválido (p. ej. 1234567-8 o CF)');
    setErrors(e);
    if (Object.keys(e).length) return;
    const cambios = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== (company[k] || '')));
    if (!Object.keys(cambios).length) { onClose(); return; }
    setBusy(true);
    try {
      await onSubmit(cambios);
    } catch (err) {
      setErrors(err.fields || { _: err.message });
      setBusy(false);
    }
  };

  return (
    <Modal title={t('edit.title', 'Editar datos')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <Field label={t('create.name', 'Nombre de la empresa')} error={errors.name} span2>
          <input className="field-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="NIT" error={errors.nit}>
          <input className="field-input mono" value={f.nit} onChange={(e) => setF({ ...f, nit: e.target.value.toUpperCase() })} />
        </Field>
        <Field label={t('create.currency', 'Moneda base')}>
          <select className="field-input" value={f.baseCurrency} onChange={(e) => setF({ ...f, baseCurrency: e.target.value })}>
            <option value="GTQ">GTQ · Quetzal</option>
            <option value="USD">USD · Dólar</option>
          </select>
        </Field>
      </div>
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

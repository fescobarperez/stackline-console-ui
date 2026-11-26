// Alta y edición de un proveedor de modelos. La llave nunca pasa por aquí:
// solo el NOMBRE de la variable de entorno donde el servidor la tiene.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';

const SUGERIDOS = {
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', authType: 'bearer', credentialRef: 'OPENAI_API_KEY' },
  anthropic: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', authType: 'x-api-key', credentialRef: 'ANTHROPIC_API_KEY' },
};

export function validateProvider(p) {
  const e = {};
  if (!p.code) e.code = 'Elige un proveedor';
  if (!p.name.trim()) e.name = 'El nombre es obligatorio';
  if (!/^https?:\/\/\S+$/.test(p.baseUrl.trim())) e.baseUrl = 'URL http(s) válida';
  if (!/^[A-Z][A-Z0-9_]{2,119}$/.test(p.credentialRef.trim())) e.credentialRef = 'Nombre de variable en MAYÚSCULAS (p. ej. OPENAI_API_KEY), no la llave';
  return e;
}

export default function ProviderDialog({ provider, codes, existing, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !provider;
  const libres = codes.filter((c) => !existing.some((p) => p.code === c));
  const inicial = provider || { code: libres[0] || '', ...(SUGERIDOS[libres[0]] || { name: '', baseUrl: '', authType: 'bearer', credentialRef: '' }), active: true };
  const [f, setF] = useState({
    code: inicial.code, name: inicial.name || '', baseUrl: inicial.baseUrl || '', authType: inicial.authType || 'bearer',
    credentialRef: inicial.credentialRef || '', active: inicial.active ?? true,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const elegir = (code) => setF({ ...f, code, ...(SUGERIDOS[code] || {}) });

  const guardar = async () => {
    const e = validateProvider(f);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const datos = { name: f.name.trim(), baseUrl: f.baseUrl.trim(), authType: f.authType, credentialRef: f.credentialRef.trim(),
      ...(nuevo ? { code: f.code } : { active: f.active }) };
    try { await onSubmit(datos); } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  return (
    <Modal title={nuevo ? t('ai.newProvider', 'Nuevo proveedor') : t('ai.editProvider', 'Proveedor {{name}}', { name: provider.name })} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy || (nuevo && libres.length === 0)}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      {nuevo && libres.length === 0 ? (
        <p className="field-hint">{t('ai.noProviderCodes', 'Ya están registrados todos los proveedores que el sistema sabe llamar. Uno nuevo requiere programar su integración.')}</p>
      ) : (
        <div className="form-grid">
          <Field label={t('ai.providerCode', 'Proveedor')} error={errors.code}
            hint={nuevo ? t('ai.providerCodeHint', 'Solo los que el sistema sabe llamar.') : undefined}>
            <select className="field-input" value={f.code} disabled={!nuevo} onChange={(e) => elegir(e.target.value)}>
              {(nuevo ? libres : [f.code]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t('ai.providerName', 'Nombre')} error={errors.name}>
            <input className="field-input" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label={t('ai.baseUrl', 'URL de la API')} error={errors.baseUrl} span2>
            <input className="field-input mono" value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} />
          </Field>
          <Field label={t('ai.authType', 'Cómo se manda la llave')} error={errors.authType}>
            <select className="field-input" value={f.authType} onChange={(e) => setF({ ...f, authType: e.target.value })}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="x-api-key">x-api-key</option>
            </select>
          </Field>
          <Field label={t('ai.credentialRef', 'Variable con la llave')} error={errors.credentialRef}
            hint={t('ai.credentialRefHint', 'El nombre de la variable de entorno del servidor. La llave se pone allá, nunca aquí.')}>
            <input className="field-input mono" value={f.credentialRef} onChange={(e) => setF({ ...f, credentialRef: e.target.value.toUpperCase() })} />
          </Field>
          {!nuevo && (
            <label className="switch-row span-2">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
              <span>{t('ai.providerActive', 'Activo')}
                <span className="field-hint">{t('ai.providerActiveHint', 'Inactivo, sus modelos dejan de responder. No se puede desactivar mientras un agente los use.')}</span>
              </span>
            </label>
          )}
        </div>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

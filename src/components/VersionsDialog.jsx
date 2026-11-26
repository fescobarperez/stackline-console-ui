// Texto versionado (prompt de un tipo, identidad de Tino, instrucciones de un
// agente de empresa): ver cualquier versión, volver a una anterior o escribir
// una nueva, que queda activa al guardarla. Las versiones no se editan.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import { useToast } from './Toast.jsx';
import { fmtDateTime } from '../lib/fmt.js';

/**
 * @param load      () => Promise<versiones[]>  ({ id, version, body, createdBy, createdAt, active })
 * @param create    (body) => Promise<{ id, version } | versiones[]>
 * @param activate  (version) => Promise
 * @param clear     opcional: () => Promise — dejar sin versión activa
 */
export default function VersionsDialog({ title, hint, emptyText, canEdit, load, create, activate, clear, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [versiones, setVersiones] = useState(null);
  const [verId, setVerId] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const cargar = (elegir) => load().then((v) => {
    setVersiones(v);
    setVerId((id) => elegir ?? id ?? v.find((x) => x.active)?.id ?? v[0]?.id ?? null);
    return v;
  }).catch((e) => toast(e.message, 'danger'));
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vista = versiones?.find((x) => x.id === verId);
  const hecho = (v) => { onChanged?.(); toast(t('ai.promptSaved', 'Versión {{v}} activa', { v }), 'success'); };

  const guardar = async () => {
    if (borrador.trim().length < 20) { setError(t('ai.err.prompt', 'Mínimo 20 caracteres')); return; }
    setBusy(true);
    try {
      const r = await create(borrador.trim());
      setBorrador(null);
      setError(null);
      const lista = await cargar();
      const nueva = Array.isArray(r) ? lista?.find((x) => x.active) : r;
      if (nueva) setVerId(nueva.id);
      hecho(nueva?.version);
    } catch (e) { setError(e.fields?.body || e.message); }
    setBusy(false);
  };

  const usar = async (v) => {
    setBusy(true);
    try { await activate(v); await cargar(v.id); hecho(v.version); } catch (e) { toast(e.message, 'danger'); }
    setBusy(false);
  };

  const quitar = async () => {
    setBusy(true);
    try { await clear(); await cargar(); onChanged?.(); toast(t('ver.cleared', 'Sin versión activa'), 'success'); } catch (e) { toast(e.message, 'danger'); }
    setBusy(false);
  };

  return (
    <Modal size="modal-lg" title={title} onClose={onClose} busy={busy}
      footer={borrador != null ? <>
        <Button variant="ghost" onClick={() => { setBorrador(null); setError(null); }} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('ai.saveVersion', 'Guardar y activar')}</Button>
      </> : <Button variant="accent" onClick={onClose}>{t('common.done', 'Listo')}</Button>}>
      {!versiones && <p className="page-sub">{t('common.loading', 'Cargando…')}</p>}
      {versiones && borrador == null && versiones.length === 0 && (
        <div className="empty">
          <p>{emptyText || t('ver.empty', 'Aún no hay versiones.')}</p>
          {canEdit && <Button variant="accent" icon="edit" onClick={() => setBorrador('')}>{t('ai.newVersion', 'Nueva versión')}</Button>}
        </div>
      )}
      {versiones && borrador == null && versiones.length > 0 && (
        <div className="prompt-layout">
          <ol className="prompt-versions" aria-label={t('ai.versions', 'Versiones')}>
            {versiones.map((v) => (
              <li key={v.id}>
                <button type="button" className={`prompt-version ${v.id === verId ? 'selected' : ''}`} onClick={() => setVerId(v.id)} aria-pressed={v.id === verId}>
                  <span className="prompt-version-title">v{v.version}{v.active && <span className="badge-m3 success">{t('ai.active', 'Activa')}</span>}</span>
                  <span className="field-hint">{fmtDateTime(v.createdAt)}{v.createdBy ? ` · ${v.createdBy}` : ''}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="prompt-view">
            {vista && <pre className="prompt-body">{vista.body}</pre>}
            {canEdit && (
              <div className="prompt-actions">
                {clear && versiones.some((x) => x.active) && (
                  <Button size="sm" variant="ghost" icon="block" onClick={quitar} disabled={busy}>{t('ver.clear', 'Quitar la activa')}</Button>
                )}
                {vista && !vista.active && <Button size="sm" icon="history" onClick={() => usar(vista)} disabled={busy}>{t('ai.useVersion', 'Usar esta versión')}</Button>}
                <Button size="sm" variant="accent" icon="edit" onClick={() => setBorrador(vista?.body || '')}>{t('ai.newVersion', 'Nueva versión')}</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {borrador != null && (
        <Field label={t('ai.newVersionOf', 'Nueva versión (parte de la v{{v}})', { v: vista?.version ?? 0 })} error={error} hint={hint}>
          <textarea className="field-input prompt-edit" rows={14} value={borrador} onChange={(e) => setBorrador(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

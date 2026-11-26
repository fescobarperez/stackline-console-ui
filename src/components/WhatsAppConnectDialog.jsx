// Conectar a la empresa un número de la cuenta de WhatsApp Business de
// Stackline (el registro integrado de Meta, para que cada cliente conecte el
// suyo, llega cuando la app sea Tech Provider). Primero se verifica el ID del
// número contra Meta y se muestra qué número es; luego se conecta.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import Icon from './Icon.jsx';

export default function WhatsAppConnectDialog({ agents, lookup, onClose, onSubmit }) {
  const { t } = useTranslation();
  const atienden = agents.filter((a) => !a.archived);
  const [id, setId] = useState('');
  const [agente, setAgente] = useState(atienden[0]?.id ?? '');
  const [numero, setNumero] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const limpio = id.replace(/\s+/g, '');
  const verificar = async () => {
    setErrors({}); setNumero(null);
    if (!/^\d{6,25}$/.test(limpio)) {
      setErrors({ phoneNumberId: t('wa.err.id', 'El ID del número son solo dígitos.') });
      return;
    }
    setBusy(true);
    try { setNumero(await lookup(limpio)); } catch (e) { setErrors(e.fields || { _: e.message }); }
    setBusy(false);
  };
  const conectar = async () => {
    setBusy(true);
    try {
      await onSubmit({ phoneNumberId: limpio, tenantAgentId: agente === '' ? null : Number(agente) });
    } catch (e) { setErrors(e.fields || { _: e.message }); setBusy(false); }
  };

  const calidad = { GREEN: t('wa.q.green', 'Alta'), YELLOW: t('wa.q.yellow', 'Media'), RED: t('wa.q.red', 'Baja') };
  const ocupado = numero?.status === 'in_use';

  return (
    <Modal title={t('wa.connectTitle', 'Conectar número de WhatsApp')} onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        {numero
          ? <Button variant="accent" icon="link" onClick={conectar} disabled={busy || ocupado}>{busy ? t('wa.connecting', 'Conectando…') : t('wa.connect', 'Conectar')}</Button>
          : <Button variant="accent" icon="search" onClick={verificar} disabled={busy || !limpio}>{busy ? t('wa.checking', 'Verificando…') : t('wa.check', 'Verificar en Meta')}</Button>}
      </>}>
      <p className="body-small" style={{ marginTop: 0 }}>
        {t('wa.connectHint', 'El número debe estar en la cuenta de WhatsApp Business de Stackline. Su ID está en Meta › WhatsApp › Configuración de la API («Identificador del número de teléfono»).')}
      </p>
      <div className="form-grid">
        <Field label={t('wa.phoneNumberId', 'ID del número')} error={errors.phoneNumberId}>
          <input className="field-input mono" inputMode="numeric" value={id} autoFocus
            onChange={(e) => { setId(e.target.value); setNumero(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !numero) verificar(); }} />
        </Field>
        <Field label={t('web.agent', 'Agente que atiende')} error={errors.tenantAgentId}
          hint={atienden.length ? t('wa.agentHint', 'Sin agente, el número no responde.') : t('web.noAgents', 'Crea primero un agente para la empresa.')}>
          <select className="field-input" value={agente} onChange={(e) => setAgente(e.target.value)}>
            <option value="">{t('web.noAgent', 'Sin agente')}</option>
            {atienden.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>

      {numero && (
        <div className={`wa-found ${ocupado ? 'is-busy' : ''}`}>
          <Icon name={ocupado ? 'block' : 'check_circle'} size={22} className="icon" />
          <div>
            <div className="wa-found-number">{numero.displayPhoneNumber || numero.phoneNumberId}</div>
            <div className="body-small">
              {numero.verifiedName || t('wa.noName', 'Sin nombre verificado')}
              {numero.qualityRating && <> · {t('wa.quality', 'Calidad')}: {calidad[numero.qualityRating] || numero.qualityRating}</>}
            </div>
            {ocupado && <div className="field-error">{t('wa.inUse', 'Este número ya lo atiende otra empresa. Desconéctalo allá primero.')}</div>}
            {numero.status === 'connected' && <div className="field-hint">{t('wa.already', 'Ya está conectado a esta empresa: al conectar solo cambias el agente.')}</div>}
          </div>
        </div>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

// Alta guiada de una empresa: datos de la empresa, establecimiento y
// sucursal, administrador y revisión. El backend lo aprovisiona todo en una
// sola transacción y devuelve el enlace de activación del administrador, que
// se muestra una única vez.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import Field from '../components/Field.jsx';
import CopyField from '../components/CopyField.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { createCompany, checkCode, can } from '../api/platform.js';
import {
  normalizeCode, isValidCode, suggestCode, isValidNit, isValidEmail,
} from '../lib/companyStatus.js';
import { fmtDateTime } from '../lib/fmt.js';
import { usePlans } from '../hooks/useCatalog.js';

const VACIO = {
  company: { name: '', code: '', nit: '', baseCurrency: 'GTQ', status: 'trial', planId: null },
  establishment: { satCode: '1', commercialName: '', address: '', phone: '' },
  branch: { name: 'Central', address: '' },
  admin: { name: '', email: '' },
};

// Qué paso contiene cada campo: para volver a él si el servidor lo rechaza.
const PASO_DE = { company: 0, establishment: 1, branch: 1, admin: 2 };

export function validarPaso(paso, f, t) {
  const e = {};
  if (paso === 0) {
    if (!f.company.name.trim()) e['company.name'] = t('create.err.name', 'El nombre es obligatorio');
    if (!isValidCode(f.company.code)) e['company.code'] = t('create.err.code', 'De 3 a 20 caracteres: letras, números o guiones');
    if (!isValidNit(f.company.nit)) e['company.nit'] = t('create.err.nit', 'NIT inválido (p. ej. 1234567-8 o CF)');
    if (!f.company.planId) e['company.planId'] = t('create.err.plan', 'Elige un plan');
  }
  if (paso === 1) {
    if (!(Number(f.establishment.satCode) >= 1)) e['establishment.satCode'] = t('create.err.sat', 'Número de establecimiento SAT inválido');
    if (!f.establishment.commercialName.trim()) e['establishment.commercialName'] = t('create.err.commercial', 'El nombre comercial es obligatorio');
    if (!f.branch.name.trim()) e['branch.name'] = t('create.err.branch', 'El nombre de la sucursal es obligatorio');
  }
  if (paso === 2) {
    if (!f.admin.name.trim()) e['admin.name'] = t('create.err.adminName', 'El nombre es obligatorio');
    if (!isValidEmail(f.admin.email)) e['admin.email'] = t('create.err.email', 'Correo inválido');
  }
  return e;
}

export default function CompanyCreate({ session }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState(VACIO);
  const [errors, setErrors] = useState({});
  const [codeTocado, setCodeTocado] = useState(false);
  const [codeLibre, setCodeLibre] = useState(null); // null: sin verificar
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState(null);
  const { plans } = usePlans();
  const activos = (plans || []).filter((p) => p.active);

  // Preselecciona el primer plan activo en cuanto llegan.
  useEffect(() => {
    if (activos.length && !f.company.planId) {
      setF((prev) => ({ ...prev, company: { ...prev.company, planId: activos[0].id } }));
    }
  }, [plans]); // eslint-disable-line react-hooks/exhaustive-deps

  const pasos = [
    t('create.step1', 'Empresa'),
    t('create.step2', 'Establecimiento'),
    t('create.step3', 'Administrador'),
    t('create.step4', 'Revisión'),
  ];

  const set = (grupo, campo, valor) => {
    setF((prev) => {
      const next = { ...prev, [grupo]: { ...prev[grupo], [campo]: valor } };
      // El código y el nombre comercial siguen al nombre hasta que se tocan.
      if (grupo === 'company' && campo === 'name') {
        if (!codeTocado) next.company.code = suggestCode(valor);
        if (!prev.establishment.commercialName || prev.establishment.commercialName === prev.company.name) {
          next.establishment = { ...next.establishment, commercialName: valor };
        }
      }
      return next;
    });
    setErrors((e) => ({ ...e, [`${grupo}.${campo}`]: undefined }));
  };

  // Disponibilidad del código, en vivo.
  const code = f.company.code;
  useEffect(() => {
    setCodeLibre(null);
    if (!isValidCode(code)) return undefined;
    let vivo = true;
    const h = setTimeout(() => {
      checkCode(code).then((r) => { if (vivo) setCodeLibre(r.available); }).catch(() => {});
    }, 350);
    return () => { vivo = false; clearTimeout(h); };
  }, [code]);

  const siguiente = () => {
    const e = validarPaso(paso, f, t);
    if (paso === 0 && codeLibre === false) e['company.code'] = t('create.err.codeTaken', 'Ese código ya está en uso');
    setErrors(e);
    if (Object.keys(e).length === 0) setPaso((p) => p + 1);
  };

  const crear = async () => {
    setEnviando(true);
    try {
      const payload = {
        ...f,
        establishment: { ...f.establishment, satCode: Number(f.establishment.satCode) },
      };
      const res = await createCompany(payload);
      setCreada(res);
      toast(t('create.done', 'Empresa creada'), 'success');
    } catch (err) {
      const campos = err.fields || {};
      if (Object.keys(campos).length) {
        setErrors(campos);
        const primero = Object.keys(campos)[0].split('.')[0];
        setPaso(PASO_DE[primero] ?? 0);
      }
      toast(err.message, 'danger');
    } finally {
      setEnviando(false);
    }
  };

  const codeHint = useMemo(() => {
    if (!isValidCode(code)) return t('create.codeHint', 'Es lo que el cliente escribe en el login, junto a su correo.');
    if (codeLibre === null) return t('create.codeChecking', 'Verificando disponibilidad…');
    return codeLibre ? t('create.codeFree', 'Disponible') : null;
  }, [code, codeLibre, t]);

  if (!can.create(session.operator)) {
    return (
      <div className="page">
        <h1 className="page-title">{t('create.title', 'Nueva empresa')}</h1>
        <p className="page-sub">{t('create.forbidden', 'Tu rol no permite crear empresas.')}</p>
      </div>
    );
  }

  if (creada) {
    return (
      <div className="page">
        <div className="section-card result-card">
          <div className="result-icon"><Icon name="check" size={28} /></div>
          <h1 className="section-title" style={{ fontSize: 22, lineHeight: '28px' }}>
            {t('create.resultTitle', '{{name}} está lista', { name: creada.name })}
          </h1>
          <p className="section-description" style={{ marginBottom: 16 }}>
            {t('create.resultDesc', 'Código de acceso {{code}}. El administrador debe activar su cuenta con este enlace; se muestra una sola vez, así que cópialo y envíaselo.', { code: creada.code })}
          </p>
          <CopyField value={creada.invitation.url} label={t('create.inviteFor', 'Enlace de activación para {{email}}', { email: creada.invitation.email })} />
          <p className="field-hint">{t('create.expires', 'Vence: {{date}}', { date: fmtDateTime(creada.invitation.expiresAt) })}</p>
          <div className="wizard-foot">
            <Button onClick={() => { setCreada(null); setF({ ...VACIO, company: { ...VACIO.company, planId: activos[0]?.id ?? null } }); setPaso(0); setCodeTocado(false); }}>{t('create.another', 'Crear otra')}</Button>
            <Button variant="accent" iconRight="chevronRight" onClick={() => navigate(`/empresas/${creada.id}`)}>{t('create.view', 'Ver empresa')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const err = (k) => errors[k];

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={() => navigate('/empresas')}>
        <Icon name="chevronLeft" size={18} />{t('companies.title', 'Empresas')}
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('create.title', 'Nueva empresa')}</h1>
          <div className="page-sub">{t('create.subtitle', 'Se crea con su establecimiento, una sucursal y el usuario administrador.')}</div>
        </div>
      </div>

      <div className="wizard">
        <ol className="steps">
          {pasos.map((p, i) => (
            <li key={p} className={i < paso ? 'done' : i === paso ? 'current' : ''} aria-current={i === paso ? 'step' : undefined}>{p}</li>
          ))}
        </ol>

        <div className="section-card">
          {paso === 0 && (
            <div className="form-grid">
              <Field label={t('create.name', 'Nombre de la empresa')} error={err('company.name')} span2>
                <input className="field-input" value={f.company.name} onChange={(e) => set('company', 'name', e.target.value)} autoFocus />
              </Field>
              <Field label={t('create.code', 'Código de acceso')} error={err('company.code') || (codeLibre === false ? t('create.err.codeTaken', 'Ese código ya está en uso') : null)}
                hint={codeHint} hintOk={codeLibre === true}>
                <input className="field-input mono" value={f.company.code}
                  onChange={(e) => { setCodeTocado(true); set('company', 'code', normalizeCode(e.target.value)); }} />
              </Field>
              <Field label="NIT" error={err('company.nit')}>
                <input className="field-input mono" value={f.company.nit} onChange={(e) => set('company', 'nit', e.target.value.toUpperCase())} placeholder="1234567-8" />
              </Field>
              <Field label={t('create.currency', 'Moneda base')}>
                <select className="field-input" value={f.company.baseCurrency} onChange={(e) => set('company', 'baseCurrency', e.target.value)}>
                  <option value="GTQ">GTQ · Quetzal</option>
                  <option value="USD">USD · Dólar</option>
                </select>
              </Field>
              <Field label={t('create.plan', 'Plan')} error={err('company.planId')}
                hint={activos.find((p) => p.id === f.company.planId)?.description}>
                <select className="field-input" value={f.company.planId ?? ''} onChange={(e) => set('company', 'planId', Number(e.target.value))}>
                  {activos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label={t('create.initialStatus', 'Estado inicial')}>
                <select className="field-input" value={f.company.status} onChange={(e) => set('company', 'status', e.target.value)}>
                  <option value="trial">{t('status.trial', 'Prueba')}</option>
                  <option value="active">{t('status.active', 'Activa')}</option>
                </select>
              </Field>
            </div>
          )}

          {paso === 1 && (
            <>
              <div className="subsection-heading" style={{ padding: '0 0 8px' }}>
                <div>
                  <h2 className="subsection-title">{t('create.establishment', 'Establecimiento SAT')}</h2>
                  <div className="section-description">{t('create.establishmentHint', 'El que aparece en las facturas FEL.')}</div>
                </div>
              </div>
              <div className="form-grid">
                <Field label={t('create.satCode', 'Número de establecimiento')} error={err('establishment.satCode')}>
                  <input className="field-input mono" inputMode="numeric" value={f.establishment.satCode} onChange={(e) => set('establishment', 'satCode', e.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field label={t('create.commercialName', 'Nombre comercial')} error={err('establishment.commercialName')}>
                  <input className="field-input" value={f.establishment.commercialName} onChange={(e) => set('establishment', 'commercialName', e.target.value)} />
                </Field>
                <Field label={t('create.address', 'Dirección')} span2>
                  <input className="field-input" value={f.establishment.address} onChange={(e) => set('establishment', 'address', e.target.value)} />
                </Field>
                <Field label={t('create.phone', 'Teléfono')}>
                  <input className="field-input" inputMode="tel" value={f.establishment.phone} onChange={(e) => set('establishment', 'phone', e.target.value)} />
                </Field>
              </div>
              <div className="subsection-heading" style={{ padding: '24px 0 8px' }}>
                <div>
                  <h2 className="subsection-title">{t('create.branch', 'Primera sucursal')}</h2>
                  <div className="section-description">{t('create.branchHint', 'El administrador puede agregar más después.')}</div>
                </div>
              </div>
              <div className="form-grid">
                <Field label={t('create.branchName', 'Nombre')} error={err('branch.name')}>
                  <input className="field-input" value={f.branch.name} onChange={(e) => set('branch', 'name', e.target.value)} />
                </Field>
                <Field label={t('create.address', 'Dirección')}>
                  <input className="field-input" value={f.branch.address} onChange={(e) => set('branch', 'address', e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <p className="section-description" style={{ marginTop: 0, marginBottom: 12 }}>
                {t('create.adminHint', 'Recibe un enlace para definir su contraseña. Nadie más la conoce, tampoco la consola.')}
              </p>
              <div className="form-grid">
                <Field label={t('create.adminName', 'Nombre completo')} error={err('admin.name')}>
                  <input className="field-input" value={f.admin.name} onChange={(e) => set('admin', 'name', e.target.value)} autoFocus />
                </Field>
                <Field label={t('create.adminEmail', 'Correo')} error={err('admin.email')}>
                  <input className="field-input" type="email" value={f.admin.email} onChange={(e) => set('admin', 'email', e.target.value.trim())} />
                </Field>
              </div>
            </>
          )}

          {paso === 3 && (
            <dl className="kv-list">
              <dt>{t('create.name', 'Nombre de la empresa')}</dt><dd>{f.company.name}</dd>
              <dt>{t('create.code', 'Código de acceso')}</dt><dd className="mono">{f.company.code}</dd>
              <dt>NIT</dt><dd className="mono">{f.company.nit}</dd>
              <dt>{t('create.currency', 'Moneda base')}</dt><dd>{f.company.baseCurrency}</dd>
              <dt>{t('create.plan', 'Plan')}</dt><dd>{activos.find((p) => p.id === f.company.planId)?.name || '—'}</dd>
              <dt>{t('create.initialStatus', 'Estado inicial')}</dt><dd><StatusBadge status={f.company.status} /></dd>
              <dt>{t('create.establishment', 'Establecimiento SAT')}</dt>
              <dd>{`#${f.establishment.satCode} · ${f.establishment.commercialName}`}{f.establishment.address && ` · ${f.establishment.address}`}</dd>
              <dt>{t('create.branch', 'Primera sucursal')}</dt><dd>{f.branch.name}</dd>
              <dt>{t('create.step3', 'Administrador')}</dt><dd>{`${f.admin.name} · ${f.admin.email}`}</dd>
            </dl>
          )}
        </div>

        <div className="wizard-foot">
          {paso > 0
            ? <Button variant="ghost" icon="chevronLeft" onClick={() => setPaso((p) => p - 1)} disabled={enviando}>{t('common.back', 'Atrás')}</Button>
            : <Button variant="ghost" onClick={() => navigate('/empresas')}>{t('common.cancel', 'Cancelar')}</Button>}
          <span className="grow" />
          {paso < 3
            ? <Button variant="accent" iconRight="chevronRight" onClick={siguiente}>{t('common.next', 'Siguiente')}</Button>
            : <Button variant="accent" icon="check" onClick={crear} disabled={enviando}>{enviando ? t('create.creating', 'Creando…') : t('create.submit', 'Crear empresa')}</Button>}
        </div>
      </div>
    </div>
  );
}

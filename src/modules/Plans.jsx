// Catálogo de planes: qué módulos trae cada uno, sus límites y cuántas
// empresas lo usan.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PlanDialog from '../components/PlanDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { useModules, usePlans, useLimitLabels } from '../hooks/useCatalog.js';
import { createPlan, updatePlan, canManagePlans } from '../api/platform.js';
import { LIMIT_KEYS } from '../lib/plans.js';
import { fmtGtq } from '../lib/fmt.js';

export default function Plans({ session }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const modules = useModules();
  const { plans, error, reload } = usePlans();
  const limitLabels = useLimitLabels();
  const [dlg, setDlg] = useState(null); // 'new' | plan
  const owner = canManagePlans(session.operator);
  const nombre = (code) => modules.find((m) => m.code === code)?.name || code;

  const guardar = async (datos) => {
    if (dlg === 'new') await createPlan(datos); else await updatePlan(dlg.id, datos);
    setDlg(null);
    reload();
    toast(t('plans.saved', 'Plan guardado'), 'success');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('plans.title', 'Planes y módulos')}</h1>
          <div className="page-sub">{t('plans.subtitle', 'Qué incluye cada plan. Las excepciones por empresa se hacen en su ficha.')}</div>
        </div>
        {owner && (
          <div className="page-head-actions">
            <Button variant="accent" icon="plus" onClick={() => setDlg('new')} disabled={!modules.length}>{t('plans.new', 'Nuevo plan')}</Button>
          </div>
        )}
      </div>

      {error && <p className="field-error">{error.message}</p>}
      {!plans && !error && <p className="page-sub">{t('common.loading', 'Cargando…')}</p>}

      <div className="plan-grid">
        {plans?.map((p) => (
          <article key={p.id} className={`section-card plan-card ${p.active ? '' : 'inactive'}`}>
            <header className="plan-card-head">
              <div>
                <h2 className="section-title">{p.name}</h2>
                <div className="mono muted body-small">{p.code}</div>
              </div>
              {!p.active && <span className="badge-m3 neutral">{t('plans.inactive', 'Inactivo')}</span>}
            </header>
            {owner && <div className="plan-price">{t('plans.perMonth', '{{price}} al mes', { price: fmtGtq(p.price) })}</div>}
            {p.description && <p className="plan-card-desc">{p.description}</p>}

            <div className="chip-list" aria-label={t('plans.modules', 'Módulos incluidos')}>
              {p.modules.map((c) => <span key={c} className="badge-m3 primary">{nombre(c)}</span>)}
            </div>

            <dl className="kv-list plan-limits">
              {LIMIT_KEYS.map((k) => (
                <React.Fragment key={k}>
                  <dt>{limitLabels[k]}</dt>
                  <dd className="mono">{p.limits[k] == null ? t('limits.unlimited', 'Ilimitado') : p.limits[k].toLocaleString()}</dd>
                </React.Fragment>
              ))}
            </dl>

            <footer className="plan-card-foot">
              <button type="button" className="link-btn" onClick={() => navigate(`/empresas?plan=${p.code}`)}>
                {t('plans.companies', '{{count}} empresas', { count: p.companiesCount })}
              </button>
              {owner && <Button size="sm" icon="edit" onClick={() => setDlg(p)}>{t('common.edit', 'Editar')}</Button>}
            </footer>
          </article>
        ))}
      </div>

      {dlg && <PlanDialog plan={dlg === 'new' ? null : dlg} modules={modules} onClose={() => setDlg(null)} onSubmit={guardar} />}
    </div>
  );
}

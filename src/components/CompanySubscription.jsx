// Sección «Plan y módulos» de la ficha: plan, módulos con su origen
// (del plan, agregado, quitado) y uso contra cada límite.
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button.jsx';
import SubscriptionDialog from './SubscriptionDialog.jsx';
import LimitBars from './LimitBars.jsx';
import { useToast } from './Toast.jsx';
import { getSubscription, saveSubscription, canManagePlans, canSeeMoney } from '../api/platform.js';
import { useModules, usePlans } from '../hooks/useCatalog.js';
import { fmtGtq } from '../lib/fmt.js';
import { LIMIT_KEYS, USAGE_OF, usageLevel, moduleSource } from '../lib/plans.js';

export default function CompanySubscription({ company, operator, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const modules = useModules();
  const { plans, reload: recargarPlanes } = usePlans();
  const [sub, setSub] = useState(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(() => {
    getSubscription(company.id).then(setSub).catch((e) => toast(e.message, 'danger'));
  }, [company.id, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!sub) return <p className="page-sub">{t('common.loading', 'Cargando…')}</p>;

  const plan = plans?.find((p) => p.id === sub.plan.id);
  const planModules = plan?.modules || [];
  const fuenteTxt = {
    base: t('sub.src.base', 'Siempre'), plan: t('sub.src.plan', 'Del plan'),
    added: t('sub.src.added', 'Agregado'), removed: t('sub.src.removed', 'Quitado'), off: t('sub.src.off', 'No incluido'),
  };

  const guardar = async (datos) => {
    const nuevo = await saveSubscription(company.id, datos);
    setSub(nuevo);
    setAbierto(false);
    recargarPlanes();
    onChanged?.();
    toast(t('sub.saved', 'Plan actualizado'), 'success');
  };

  const editable = canManagePlans(operator) && company.status !== 'cancelled';

  return (
    <>
      <div className="subscription-head">
        <div>
          <div className="subsection-title">{sub.plan.name}</div>
          {canSeeMoney(operator) && (
            <div className="body-small muted">
              {t('sub.priceLine', '{{price}} al mes', { price: fmtGtq(sub.effective.price) })}
              {sub.priceOverride != null && <span className="module-src override">{t('sub.agreedPrice', 'Pactado')}</span>}
            </div>
          )}
          {plan && !plan.active && <span className="field-hint">{t('sub.inactivePlan', 'Este plan ya no se ofrece a empresas nuevas.')}</span>}
        </div>
        {editable && plans && modules.length > 0 && (
          <Button size="sm" icon="tune" onClick={() => setAbierto(true)}>{t('sub.change', 'Cambiar plan y módulos')}</Button>
        )}
      </div>

      <ul className="module-list">
        {modules.map((m) => {
          const fuente = moduleSource(m.code, planModules, sub.overrides);
          const activo = sub.effective.modules.includes(m.code);
          return (
            <li key={m.code} className={activo ? 'on' : 'off'}>
              <span className="module-dot" aria-hidden="true" />
              <span className="module-name">{m.name}</span>
              {(fuente === 'added' || fuente === 'removed') && <span className="module-src override">{fuenteTxt[fuente]}</span>}
              <span className="sr-only">{activo ? t('sub.on', 'activo') : t('sub.off', 'inactivo')}</span>
            </li>
          );
        })}
      </ul>

      <h3 className="subsection-title" style={{ margin: '20px 0 8px' }}>{t('sub.usage', 'Uso y límites')}</h3>
      <LimitBars rows={LIMIT_KEYS.map((k) => {
        const used = sub.usage[USAGE_OF[k]] ?? 0;
        const limit = sub.effective.limits[k];
        return { key: k, used, limit, level: usageLevel(used, limit), own: sub.limitOverrides[k] != null };
      })} />

      {abierto && <SubscriptionDialog subscription={sub} plans={plans} modules={modules} onClose={() => setAbierto(false)} onSubmit={guardar} />}
    </>
  );
}

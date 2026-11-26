// Uso y costos de todas las empresas en un mes: consumo, costo directo
// (modelo de IA; WhatsApp cuando haya plantillas), ingreso y margen.
// El dinero solo lo ve el dueño; soporte ve el consumo y las alertas.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DataTable from '../components/DataTable.jsx';
import StatCard from '../components/StatCard.jsx';
import MonthSelect from '../components/MonthSelect.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import MarginValue from '../components/MarginValue.jsx';
import { useToast } from '../components/Toast.jsx';
import { useLimitLabels } from '../hooks/useCatalog.js';
import { getUsage, canSeeMoney } from '../api/platform.js';
import { alertsOf, monthKey, isValidMonth } from '../lib/usage.js';
import { fmtGtq, fmtUsd, fmtInt, fmtPct } from '../lib/fmt.js';

export default function Usage({ session }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const limitLabels = useLimitLabels();
  const [params, setParams] = useSearchParams();
  const mesParam = params.get('mes');
  const month = isValidMonth(mesParam) ? mesParam : monthKey();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const dinero = canSeeMoney(session.operator);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    getUsage(month)
      .then((d) => { if (vivo) setData(d); })
      .catch((e) => toast(e.message, 'danger'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [month, toast]);

  const cambiarMes = (m) => {
    const next = new URLSearchParams(params);
    if (m === monthKey()) next.delete('mes'); else next.set('mes', m);
    setParams(next, { replace: true });
  };

  const items = data?.items || [];
  const alertas = items.flatMap((i) => alertsOf(i.limits).map((l) => ({ ...l, company: i.company })))
    .sort((a, b) => (a.level === b.level ? b.used / (b.limit || 1) - a.used / (a.limit || 1) : a.level === 'over' ? -1 : 1));
  const tot = data?.totals;

  const columns = [
    {
      key: 'company', header: t('companies.company', 'Empresa'), sortable: true, card: 'title',
      sortValue: (r) => r.company.name,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.company.name}</div>
          <div className="mono muted body-small">{r.company.code}</div>
        </div>
      ),
    },
    { key: 'status', header: t('companies.status', 'Estado'), card: 'badge', sortable: true, sortValue: (r) => r.company.status, render: (r) => <StatusBadge status={r.company.status} /> },
    { key: 'plan', header: t('companies.plan', 'Plan'), sortable: true, hideOnLaptop: true, sortValue: (r) => r.plan?.name, render: (r) => r.plan?.name || '—' },
    { key: 'aiTurns', header: t('usage.aiTurns', 'Mensajes de IA'), align: 'right', sortable: true, render: (r) => fmtInt(r.aiTurns) },
    { key: 'felCount', header: t('usage.fel', 'FEL'), align: 'right', sortable: true, hideOnTablet: true, render: (r) => fmtInt(r.felCount) },
    ...(dinero ? [
      { key: 'revenueGtq', header: t('usage.revenue', 'Ingreso'), align: 'right', sortable: true, hideOnLaptop: true, render: (r) => fmtGtq(r.revenueGtq) },
      { key: 'costUsd', header: t('usage.cost', 'Costo directo'), align: 'right', sortable: true, render: (r) => fmtUsd(r.costUsd) },
      { key: 'marginGtq', header: t('usage.margin', 'Margen'), align: 'right', sortable: true, card: 'amount', render: (r) => <MarginValue gtq={r.marginGtq} pct={r.marginPct} /> },
    ] : []),
    {
      key: 'alerts', header: t('usage.alerts', 'Alertas'), sortable: true, sortValue: (r) => alertsOf(r.limits).length,
      render: (r) => {
        const a = alertsOf(r.limits);
        if (!a.length) return <span className="muted">—</span>;
        const pasado = a.some((l) => l.level === 'over');
        return <span className={`badge-m3 ${pasado ? 'error' : 'warning'}`}>{t('usage.alertCount', '{{count}} límites', { count: a.length })}</span>;
      },
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('usage.title', 'Uso y costos')}</h1>
          <div className="page-sub">
            {dinero
              ? t('usage.subtitle', 'Consumo, costo directo y margen de cada empresa en el mes.')
              : t('usage.subtitleNoMoney', 'Consumo de cada empresa en el mes y límites por alcanzar.')}
          </div>
        </div>
        <div className="page-head-actions">
          <MonthSelect value={month} onChange={cambiarMes} />
        </div>
      </div>

      {data?.partial && <p className="field-hint usage-partial">{t('usage.partial', 'Mes en curso: los datos llegan hasta hoy.')}</p>}

      {tot && (
        <div className="kpi-grid usage-kpis">
          {dinero && <StatCard icon="payments" tone="pri" label={t('usage.revenue', 'Ingreso')} value={fmtGtq(tot.revenueGtq)} foot={t('usage.revenueFoot', 'Empresas activas, precio vigente')} />}
          {dinero && <StatCard icon="receipt_long" tone="ter" label={t('usage.cost', 'Costo directo')} value={fmtUsd(tot.costUsd)} foot={t('usage.costFoot', '≈ {{gtq}} · US$ 1 = Q {{fx}}', { gtq: fmtGtq(tot.costGtq), fx: data.fx.usdToGtq })} />}
          {dinero && (
            <StatCard icon="trending_up" tone={tot.marginGtq < 0 ? 'err' : 'sec'} label={t('usage.margin', 'Margen')} value={fmtGtq(tot.marginGtq)}
              valueColor={tot.marginGtq < 0 ? 'var(--danger)' : null} foot={tot.marginPct == null ? null : t('usage.ofRevenue', '{{pct}} del ingreso', { pct: fmtPct(tot.marginPct) })} />
          )}
          <StatCard icon="smart_toy" tone="sec" label={t('usage.aiTurns', 'Mensajes de IA')} value={fmtInt(tot.aiTurns)} foot={t('usage.felFoot', '{{n}} documentos FEL', { n: fmtInt(tot.felCount) })} />
          {!dinero && <StatCard icon="warning" tone={alertas.length ? 'err' : 'pri'} label={t('usage.alerts', 'Alertas')} value={fmtInt(alertas.length)} foot={t('usage.alertsFoot', 'Límites al 80 % o más')} />}
        </div>
      )}

      {alertas.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <h2 className="section-title">{t('usage.nearTitle', 'Cerca del límite')}</h2>
              <div className="section-description">{t('usage.nearHint', 'Al 80 % o más del límite de su plan. Conviene ofrecer un plan mayor o un límite propio.')}</div>
            </div>
          </div>
          <ul className="section-card alert-list">
            {alertas.map((a) => (
              <li key={`${a.company.id}-${a.key}`}>
                <button type="button" className="alert-row" onClick={() => navigate(`/empresas/${a.company.id}${month === monthKey() ? '' : `?mes=${month}`}`)}>
                  <span className={`badge-m3 ${a.level === 'over' ? 'error' : 'warning'}`}>
                    {a.level === 'over' ? t('usage.over', 'Pasado') : t('usage.near', 'Cerca')}
                  </span>
                  <span className="alert-company">{a.company.name}</span>
                  <span className="alert-limit">{limitLabels[a.key]}</span>
                  <span className="mono alert-used">{fmtInt(a.used)} / {fmtInt(a.limit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <DataTable
          rowKey={(r) => r.company.id}
          columns={columns}
          rows={items}
          loading={loading}
          defaultSort={dinero ? { key: 'costUsd', dir: 'desc' } : { key: 'aiTurns', dir: 'desc' }}
          onRowClick={(r) => navigate(`/empresas/${r.company.id}${month === monthKey() ? '' : `?mes=${month}`}`)}
          cards="tablet"
          pageSize={25}
          empty={t('usage.empty', 'Ninguna empresa operó en este mes')}
          emptyIcon="monitoring"
        />
      </section>
    </div>
  );
}

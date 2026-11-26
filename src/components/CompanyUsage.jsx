// Sección «Uso y costos» de la ficha: un mes de la empresa con su consumo
// por día, contra los límites, desglose de la IA por modelo y canal, y los
// últimos meses. El dinero solo lo ve el dueño.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatCard from './StatCard.jsx';
import MonthSelect from './MonthSelect.jsx';
import DailyBars from './DailyBars.jsx';
import LimitBars from './LimitBars.jsx';
import { useToast } from './Toast.jsx';
import MarginValue from './MarginValue.jsx';
import { getCompanyUsage, canSeeMoney } from '../api/platform.js';
import { monthKey } from '../lib/usage.js';
import { fmtGtq, fmtUsd, fmtInt, fmtPct, fmtMonth } from '../lib/fmt.js';

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function CompanyUsage({ company, operator, initialMonth }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [month, setMonth] = useState(initialMonth || monthKey());
  const [u, setU] = useState(null);
  const dinero = canSeeMoney(operator);

  useEffect(() => {
    let vivo = true;
    getCompanyUsage(company.id, month)
      .then((d) => { if (vivo) setU(d); })
      .catch((e) => toast(e.message, 'danger'));
    return () => { vivo = false; };
  }, [company.id, month, toast]);

  if (!u) return <p className="page-sub">{t('common.loading', 'Cargando…')}</p>;

  const canal = {
    erp: t('usage.ch.erp', 'Asistente en el ERP'), whatsapp: t('usage.ch.whatsapp', 'WhatsApp'),
    web: t('usage.ch.web', 'Chat en la página web'), api: t('usage.ch.api', 'API'),
  };
  const tipo = {
    turn: t('usage.kind.turn', 'Respuestas'),
    summary: t('usage.kind.summary', 'Resúmenes de conversación'),
    vision: t('usage.kind.vision', 'Lectura de fotos'),
    image: t('usage.kind.image', 'Imágenes de ejemplo'),
  };
  const sinIngreso = {
    trial: t('usage.noRevenue.trial', 'En prueba: no factura'),
    suspended: t('usage.noRevenue.suspended', 'Suspendida: no factura'),
    cancelled: t('usage.noRevenue.cancelled', 'Cancelada: no factura'),
  };
  const ingresoPie = u.status !== 'active'
    ? sinIngreso[u.status]
    : u.priceSource === 'override' ? t('usage.agreedPrice', 'Precio pactado') : t('usage.planPrice', 'Precio del plan');

  return (
    <>
      <div className="usage-head">
        <MonthSelect value={month} onChange={setMonth} />
        {u.partial && <span className="field-hint">{t('usage.partial', 'Mes en curso: los datos llegan hasta hoy.')}</span>}
      </div>

      <div className="kpi-grid usage-kpis">
        {dinero && <StatCard icon="payments" tone="pri" size="title" label={t('usage.revenue', 'Ingreso')} value={fmtGtq(u.revenueGtq)} foot={ingresoPie} />}
        {dinero && <StatCard icon="receipt_long" tone="ter" size="title" label={t('usage.cost', 'Costo directo')} value={fmtUsd(u.costUsd)} foot={`≈ ${fmtGtq(u.costGtq)}`} />}
        {dinero && (
          <StatCard icon="trending_up" tone={u.marginGtq < 0 ? 'err' : 'sec'} size="title" label={t('usage.margin', 'Margen')}
            value={fmtGtq(u.marginGtq)} valueColor={u.marginGtq < 0 ? 'var(--danger)' : null}
            foot={u.marginPct == null ? null : t('usage.ofRevenue', '{{pct}} del ingreso', { pct: fmtPct(u.marginPct) })} />
        )}
        <StatCard icon="smart_toy" tone="sec" size="title" label={t('usage.aiTurns', 'Mensajes de IA')} value={fmtInt(u.ai.turns)}
          foot={u.ai.images?.count
            ? t('usage.callsImages', '{{n}} llamadas al modelo · {{i}} imágenes', { n: fmtInt(u.ai.calls), i: fmtInt(u.ai.images.count) })
            : t('usage.calls', '{{n}} llamadas al modelo', { n: fmtInt(u.ai.calls) })} />
      </div>

      <h3 className="subsection-title usage-subtitle">{t('usage.perDay', 'Mensajes de IA por día')}</h3>
      {u.ai.turns > 0
        ? <DailyBars days={u.daily} label={t('usage.perDay', 'Mensajes de IA por día')} />
        : <p className="field-hint">{t('usage.noAi', 'Sin mensajes de IA en este mes.')}</p>}

      <h3 className="subsection-title usage-subtitle">{t('sub.usage', 'Uso y límites')}</h3>
      <LimitBars rows={u.limits} />

      {u.ai.calls > 0 && (
        <>
          <h3 className="subsection-title usage-subtitle">{t('usage.byModel', 'IA por modelo')}</h3>
          <table className="data-table tbl-stack">
            <thead><tr>
              <th>{t('usage.model', 'Modelo')}</th>
              <th style={{ textAlign: 'right' }}>{t('usage.callsCol', 'Llamadas')}</th>
              <th style={{ textAlign: 'right' }}>{t('usage.tokensIn', 'Tokens de entrada')}</th>
              <th className="hide-tablet" style={{ textAlign: 'right' }}>{t('usage.tokensCached', 'Cacheados')}</th>
              <th style={{ textAlign: 'right' }}>{t('usage.tokensOut', 'Tokens de salida')}</th>
              {dinero && <th style={{ textAlign: 'right' }}>{t('usage.cost', 'Costo directo')}</th>}
            </tr></thead>
            <tbody>
              {u.ai.byModel.map((m) => (
                <tr key={m.model}>
                  <td className="stack-title"><span className="mono">{m.model}</span> <span className="muted body-small">{m.provider}</span></td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {m.images ? t('usage.imagesN', '{{n}} imágenes', { n: fmtInt(m.images) }) : fmtInt(m.calls)}
                  </td>
                  {/* Un modelo de imágenes cobra por imagen, no por tokens. */}
                  <td className="mono" style={{ textAlign: 'right' }}>{m.images ? '—' : fmtInt(m.tokensIn)}</td>
                  <td className="mono hide-tablet" style={{ textAlign: 'right' }}>{m.images ? '—' : fmtInt(m.tokensCached)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{m.images ? '—' : fmtInt(m.tokensOut)}</td>
                  {dinero && <td className="mono" style={{ textAlign: 'right' }}>{fmtUsd(m.costUsd)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="usage-split">
            <div>
              <h3 className="subsection-title usage-subtitle">{t('usage.byChannel', 'Por canal')}</h3>
              <dl className="kv-list plan-limits">
                {u.ai.byChannel.map((c) => (
                  <React.Fragment key={c.channel}>
                    <dt>{canal[c.channel] || c.channel}</dt>
                    <dd className="mono">{t('usage.turnsShort', '{{n}} msj.', { n: fmtInt(c.turns) })}{dinero && ` · ${fmtUsd(c.costUsd)}`}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="subsection-title usage-subtitle">{t('usage.byKind', 'Por tipo de llamada')}</h3>
              <dl className="kv-list plan-limits">
                {u.ai.byKind.map((k) => (
                  <React.Fragment key={k.kind}>
                    <dt>{tipo[k.kind] || k.kind}</dt>
                    <dd className="mono">{fmtInt(k.calls)}{dinero && ` · ${fmtUsd(k.costUsd)}`}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          </div>
        </>
      )}
      <p className="field-hint">{t('usage.waNote', 'Las plantillas de WhatsApp (mensajes fuera de la ventana de 24 h) todavía no se envían; cuando existan, su costo se suma aquí.')}</p>

      {u.history.length > 1 && (
        <>
          <h3 className="subsection-title usage-subtitle">{t('usage.history', 'Últimos meses')}</h3>
          <table className="data-table tbl-stack">
            <thead><tr>
              <th>{t('usage.month', 'Mes')}</th>
              <th style={{ textAlign: 'right' }}>{t('usage.aiTurns', 'Mensajes de IA')}</th>
              <th className="hide-tablet" style={{ textAlign: 'right' }}>{t('usage.fel', 'FEL')}</th>
              {dinero && <th style={{ textAlign: 'right' }}>{t('usage.revenue', 'Ingreso')}</th>}
              {dinero && <th style={{ textAlign: 'right' }}>{t('usage.cost', 'Costo directo')}</th>}
              {dinero && <th style={{ textAlign: 'right' }}>{t('usage.margin', 'Margen')}</th>}
            </tr></thead>
            <tbody>
              {u.history.map((h) => (
                <tr key={h.month} className={h.month === month ? 'selected' : undefined}>
                  <td className="stack-title">
                    <button type="button" className="link-btn" onClick={() => setMonth(h.month)}>{capital(fmtMonth(h.month))}</button>
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtInt(h.aiTurns)}</td>
                  <td className="mono hide-tablet" style={{ textAlign: 'right' }}>{fmtInt(h.felCount)}</td>
                  {dinero && <td className="mono" style={{ textAlign: 'right' }}>{fmtGtq(h.revenueGtq)}</td>}
                  {dinero && <td className="mono" style={{ textAlign: 'right' }}>{fmtUsd(h.costUsd)}</td>}
                  {dinero && <td style={{ textAlign: 'right' }}><MarginValue gtq={h.marginGtq} pct={h.marginPct} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

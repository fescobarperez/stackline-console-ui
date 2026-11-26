// Listado de empresas cliente: búsqueda, filtro por estado (con conteos) y
// acceso a la ficha de cada una.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DataTable from '../components/DataTable.jsx';
import Button from '../components/Button.jsx';
import StatusBadge, { useStatusLabel } from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { listCompanies, can } from '../api/platform.js';
import { STATUSES } from '../lib/companyStatus.js';
import { fmtDate, fmtAgo } from '../lib/fmt.js';

export default function Companies({ session }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const statusLabel = useStatusLabel();
  const [params, setParams] = useSearchParams();
  const status = params.get('estado') || '';
  const plan = params.get('plan') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [data, setData] = useState({ items: [], counts: {} });
  const [loading, setLoading] = useState(true);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const h = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q.trim()) next.set('q', q.trim()); else next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(h);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = params.get('q') || '';
  useEffect(() => {
    let vivo = true;
    setLoading(true);
    listCompanies({ q: query, status, plan })
      .then((d) => { if (vivo) setData(d); })
      .catch((e) => toast(e.message, 'danger'))
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [query, status, plan, toast]);

  const setStatus = (s) => {
    const next = new URLSearchParams(params);
    if (s) next.set('estado', s); else next.delete('estado');
    setParams(next, { replace: true });
  };

  const total = STATUSES.reduce((n, s) => n + (data.counts?.[s] || 0), 0);

  const columns = [
    {
      key: 'name', header: t('companies.company', 'Empresa'), sortable: true, card: 'title',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.name}</div>
          <div className="mono muted body-small">{r.code}</div>
        </div>
      ),
    },
    { key: 'status', header: t('companies.status', 'Estado'), sortable: true, card: 'badge', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'plan', header: t('companies.plan', 'Plan'), sortable: true, sortValue: (r) => r.plan?.name, render: (r) => r.plan?.name || '—' },
    { key: 'nit', header: 'NIT', mono: true, cardLabel: 'NIT', hideOnTablet: true },
    { key: 'usersCount', header: t('companies.users', 'Usuarios'), align: 'right', sortable: true, hideOnTablet: true },
    { key: 'branchesCount', header: t('companies.branches', 'Sucursales'), align: 'right', sortable: true, hideOnTablet: true },
    { key: 'lastActivityAt', header: t('companies.lastActivity', 'Última actividad'), sortable: true, render: (r) => fmtAgo(r.lastActivityAt) },
    { key: 'createdAt', header: t('companies.created', 'Alta'), sortable: true, hideOnLaptop: true, render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('companies.title', 'Empresas')}</h1>
          <div className="page-sub">{t('companies.subtitle', 'Clientes de la plataforma y su estado')}</div>
        </div>
        {can.create(session.operator) && (
          <div className="page-head-actions">
            <Button variant="accent" icon="plus" onClick={() => navigate('/empresas/nueva')}>
              {t('companies.new', 'Nueva empresa')}
            </Button>
          </div>
        )}
      </div>

      <div className="filterbar">
        <div className="filterbar-search filterbar-grow" style={{ position: 'relative' }}>
          <input className="input field-input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t('companies.search', 'Buscar por nombre, código o NIT')}
            aria-label={t('companies.search', 'Buscar por nombre, código o NIT')} style={{ width: '100%' }} />
        </div>
        {plan && (
          <button type="button" className="chip active" onClick={() => { const n = new URLSearchParams(params); n.delete('plan'); setParams(n, { replace: true }); }}
            aria-label={t('companies.clearPlan', 'Quitar filtro de plan')}>
            {t('companies.plan', 'Plan')}: {plan} ✕
          </button>
        )}
        <div className="status-chips" role="group" aria-label={t('companies.status', 'Estado')}>
          <button type="button" className={`chip ${!status ? 'active' : ''}`} onClick={() => setStatus('')} aria-pressed={!status}>
            {t('companies.all', 'Todas')} <span className="chip-count">{total}</span>
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
              {statusLabel(s)} <span className="chip-count">{data.counts?.[s] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <DataTable
        rowKey={(r) => r.id}
        columns={columns}
        rows={data.items}
        loading={loading}
        defaultSort={{ key: 'name', dir: 'asc' }}
        onRowClick={(r) => navigate(`/empresas/${r.id}`)}
        cards="tablet"
        pageSize={25}
        empty={query || status || plan ? t('companies.noMatch', 'Ninguna empresa coincide con el filtro') : t('companies.empty', 'Todavía no hay empresas')}
        emptyIcon="apartment"
      />
      {!loading && data.items.length === 0 && !query && !status && !plan && can.create(session.operator) && (
        <div style={{ marginTop: 12 }}>
          <Button icon="plus" onClick={() => navigate('/empresas/nueva')}>{t('companies.createFirst', 'Crear la primera empresa')}</Button>
        </div>
      )}
    </div>
  );
}

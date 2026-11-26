// Ficha de una empresa: datos generales, establecimientos y sucursales,
// administradores e historial de estado. Desde aquí se cambia el estado, se
// editan los datos y se genera un nuevo enlace de activación.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import CopyField from '../components/CopyField.jsx';
import StatusBadge, { useStatusLabel } from '../components/StatusBadge.jsx';
import StatusDialog from '../components/StatusDialog.jsx';
import EditCompanyDialog from '../components/EditCompanyDialog.jsx';
import CompanySubscription from '../components/CompanySubscription.jsx';
import CompanyUsage from '../components/CompanyUsage.jsx';
import CompanyAgents from '../components/CompanyAgents.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  getCompany, changeStatus, updateCompany, renewInvitation, can, canSeeMoney,
} from '../api/platform.js';
import { allowedTransitions } from '../lib/companyStatus.js';
import { isValidMonth } from '../lib/usage.js';
import { IA_EMPRESA, USO } from '../lib/features.js';
import { fmtDate, fmtDateTime, fmtAgo } from '../lib/fmt.js';

function Section({ title, description, action, children }) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2 className="section-title">{title}</h2>
          {description && <div className="section-description">{description}</div>}
        </div>
        {action}
      </div>
      <div className="section-card" style={{ marginTop: 8 }}>{children}</div>
    </section>
  );
}

export default function CompanyDetail({ session }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const mesInicial = isValidMonth(params.get('mes')) ? params.get('mes') : null;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const statusLabel = useStatusLabel();
  const op = session.operator;
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [dlg, setDlg] = useState(null); // 'status' | 'edit' | { invite }

  const cargar = useCallback(() => {
    getCompany(id).then(setC).catch((e) => setError(e));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) {
    return (
      <div className="page">
        <button type="button" className="back-link" onClick={() => navigate('/empresas')}><Icon name="chevronLeft" size={18} />{t('companies.title', 'Empresas')}</button>
        <h1 className="page-title">{error.status === 404 ? t('detail.notFound', 'Empresa no encontrada') : t('detail.error', 'No se pudo cargar')}</h1>
        <p className="page-sub">{error.message}</p>
      </div>
    );
  }
  if (!c) return <div className="page"><p className="page-sub">{t('common.loading', 'Cargando…')}</p></div>;

  const puedeEstado = can.changeStatus(op) && allowedTransitions(c.status).length > 0;

  const aplicarEstado = async (to, reason) => {
    const nuevo = await changeStatus(c.id, to, reason);
    setC(nuevo);
    setDlg(null);
    toast(t('detail.statusChanged', 'Estado cambiado a {{s}}', { s: statusLabel(to).toLowerCase() }), 'success');
  };
  const guardarDatos = async (cambios) => {
    setC(await updateCompany(c.id, cambios));
    setDlg(null);
    toast(t('detail.saved', 'Datos guardados'), 'success');
  };
  const nuevoEnlace = async (admin) => {
    try {
      setDlg({ invite: await renewInvitation(c.id, admin.id) });
    } catch (e) { toast(e.message, 'danger'); }
  };

  const est = (eid) => c.establishments.find((e) => e.id === eid);

  return (
    <div className="page" style={{ maxWidth: 1040 }}>
      <button type="button" className="back-link" onClick={() => navigate('/empresas')}>
        <Icon name="chevronLeft" size={18} />{t('companies.title', 'Empresas')}
      </button>

      <div className="company-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="company-head-title">
            <h1 className="page-title">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <div className="company-head-meta">
            <span className="mono">{c.code}</span> · NIT <span className="mono">{c.nit}</span> · {t('detail.since', 'cliente desde {{d}}', { d: fmtDate(c.createdAt) })}
          </div>
        </div>
        <div className="page-head-actions">
          {can.edit(op) && c.status !== 'cancelled' && (
            <Button icon="edit" onClick={() => setDlg('edit')}>{t('detail.edit', 'Editar datos')}</Button>
          )}
          {puedeEstado && (
            <Button variant="accent" icon="swap_horiz" onClick={() => setDlg('status')}>{t('statusDlg.title', 'Cambiar estado')}</Button>
          )}
        </div>
      </div>

      <Section title={t('detail.general', 'Datos generales')}>
        <dl className="kv-list">
          <dt>{t('create.code', 'Código de acceso')}</dt><dd className="mono">{c.code}</dd>
          <dt>NIT</dt><dd className="mono">{c.nit}</dd>
          <dt>{t('create.currency', 'Moneda base')}</dt><dd>{c.baseCurrency}</dd>
          <dt>{t('companies.users', 'Usuarios')}</dt><dd>{c.usersCount ?? '—'}</dd>
          <dt>{t('companies.lastActivity', 'Última actividad')}</dt><dd>{fmtAgo(c.lastActivityAt)}</dd>
        </dl>
      </Section>

      <Section title={t('sub.title', 'Plan y módulos')}
        description={t('sub.hint', 'Lo que la empresa puede usar en el ERP y con qué límites.')}>
        <CompanySubscription company={c} operator={op} onChanged={cargar} />
      </Section>

      {IA_EMPRESA && (
      <div id="ia">
        <Section title={t('ta.title', 'Agentes de IA')}
          description={t('ta.hint', 'Los agentes de Tino en esta empresa: qué canal atiende cada uno, con qué modelo y herramientas, sus instrucciones y su playbook.')}>
          <CompanyAgents company={c} operator={op} />
        </Section>
      </div>
      )}

      {USO && (
      <div id="uso">
        <Section title={t('usage.title', 'Uso y costos')}
          description={canSeeMoney(op)
            ? t('usage.detailHint', 'Consumo del mes, su costo directo y el margen contra lo que paga la empresa.')
            : t('usage.detailHintNoMoney', 'Consumo del mes contra los límites del plan.')}>
          <CompanyUsage company={c} operator={op} initialMonth={mesInicial} />
        </Section>
      </div>
      )}

      <Section title={t('detail.locations', 'Establecimientos y sucursales')}
        description={t('detail.locationsHint', 'El administrador de la empresa los gestiona desde la app.')}>
        <table className="data-table tbl-stack">
          <thead><tr>
            <th>{t('detail.branch', 'Sucursal')}</th>
            <th>{t('create.establishment', 'Establecimiento SAT')}</th>
            <th>{t('create.address', 'Dirección')}</th>
            <th>{t('companies.status', 'Estado')}</th>
          </tr></thead>
          <tbody>
            {c.branches.map((b) => (
              <tr key={b.id}>
                <td className="stack-title">{b.name}</td>
                <td>{est(b.establishmentId) ? `#${est(b.establishmentId).satCode} · ${est(b.establishmentId).commercialName}` : '—'}</td>
                <td>{b.address || est(b.establishmentId)?.address || '—'}</td>
                <td>{b.status === 'active' ? t('status.active', 'Activa') : b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('detail.admins', 'Administradores')}
        description={t('detail.adminsHint', 'Usuarios con el rol de administrador de la empresa.')}>
        <table className="data-table tbl-stack">
          <thead><tr>
            <th>{t('create.adminName', 'Nombre completo')}</th>
            <th>{t('create.adminEmail', 'Correo')}</th>
            <th>{t('detail.access', 'Acceso')}</th>
            <th />
          </tr></thead>
          <tbody>
            {c.admins.map((a) => (
              <tr key={a.id}>
                <td className="stack-title">{a.name}</td>
                <td>{a.email}</td>
                <td>
                  {a.status === 'invited'
                    ? <span className="badge-m3 warning">{t('detail.invited', 'Invitación pendiente')}</span>
                    : t('detail.lastSeen', 'Último ingreso {{when}}', { when: fmtAgo(a.lastSeenAt) })}
                </td>
                <td className="stack-actions" style={{ textAlign: 'right' }}>
                  {a.status === 'invited' && can.invite(op) && (
                    <Button size="sm" variant="ghost" icon="link" onClick={() => nuevoEnlace(a)}>
                      {t('detail.newLink', 'Nuevo enlace')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('detail.history', 'Historial de estado')}>
        <ol className="timeline">
          {[...c.statusHistory].reverse().map((h, i) => (
            <li key={i}>
              <div>
                <StatusBadge status={h.status} />
                {h.reason && <span style={{ marginLeft: 8 }}>{h.reason}</span>}
                <div className="timeline-when">{fmtDateTime(h.at)} · {h.by}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {dlg === 'status' && <StatusDialog company={c} onClose={() => setDlg(null)} onSubmit={aplicarEstado} />}
      {dlg === 'edit' && <EditCompanyDialog company={c} onClose={() => setDlg(null)} onSubmit={guardarDatos} />}
      {dlg?.invite && (
        <Modal title={t('detail.newLinkTitle', 'Nuevo enlace de activación')} onClose={() => setDlg(null)}
          footer={<Button variant="accent" onClick={() => setDlg(null)}>{t('common.done', 'Listo')}</Button>}>
          <p className="section-description" style={{ marginTop: 0, marginBottom: 12 }}>
            {t('detail.newLinkDesc', 'El enlace anterior dejó de servir. Este se muestra una sola vez.')}
          </p>
          <CopyField value={dlg.invite.url} label={dlg.invite.email} />
          <p className="field-hint">{t('create.expires', 'Vence: {{date}}', { date: fmtDateTime(dlg.invite.expiresAt) })}</p>
        </Modal>
      )}
    </div>
  );
}

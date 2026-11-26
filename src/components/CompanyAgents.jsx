// Sección «Agentes de IA» de la ficha: los ajustes del asistente para toda la
// empresa y sus agentes (instancias de un tipo con su modelo, herramientas,
// canales, instrucciones y playbook). Solo operadores: el ERP no ve esto.
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import PolicyDialog from './PolicyDialog.jsx';
import TenantAgentDialog from './TenantAgentDialog.jsx';
import PlaybookDialog from './PlaybookDialog.jsx';
import VersionsDialog from './VersionsDialog.jsx';
import WebChannelDialog from './WebChannelDialog.jsx';
import WidgetCodeDialog from './WidgetCodeDialog.jsx';
import PlannerDialog from './PlannerDialog.jsx';
import PlannerCodeDialog from './PlannerCodeDialog.jsx';
import WhatsAppConnectDialog from './WhatsAppConnectDialog.jsx';
import { useToast } from './Toast.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import {
  getCompanyAgents, saveCompanyAiPolicy, createCompanyAgent, updateCompanyAgent, archiveCompanyAgent,
  listAgentInstructions, createAgentInstructions, activateAgentInstructions, clearAgentInstructions, saveAgentPlaybook,
  getAiCatalog, listAgents, getSubscription, canManageAi, canEditPlaybook, createWebChannel, updateWebChannel,
  createPlannerWidget, updatePlannerWidget,
  lookupWhatsApp, connectWhatsApp, disconnectWhatsApp,
} from '../api/platform.js';
import { channelLabel } from '../lib/agents.js';
import { fmtDate, fmtGtq } from '../lib/fmt.js';

export default function CompanyAgents({ company, operator }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const owner = canManageAi(operator);
  const editaTexto = canEditPlaybook(operator);
  const [ia, setIa] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [modulo, setModulo] = useState(null);
  const [error, setError] = useState(null);
  const [dlg, setDlg] = useState(null); // 'policy' | 'new' | { edit } | { instructions } | { playbook } | 'newWeb' | { editWeb } | { code } | 'newPlanner' | { editPlanner } | { plannerCode }
  const [verArchivados, setVerArchivados] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    Promise.all([getCompanyAgents(company.id), getAiCatalog(), listAgents(), getSubscription(company.id)])
      .then(([v, c, a, sub]) => { setIa(v); setCatalog(c); setTipos(a); setModulo(sub.effective.modules.includes('ai')); })
      .catch(setError);
  }, [company.id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error && !ia) {
    return (
      <div className="section-card empty" role="alert">
        <p className="field-error">{error.message}</p>
        <Button variant="ghost" icon="refresh" onClick={cargar}>{t('common.retry', 'Reintentar')}</Button>
      </div>
    );
  }
  if (!ia || !catalog) return <p className="page-sub">{t('common.loading', 'Cargando…')}</p>;

  const modelo = (id) => catalog.models.find((m) => m.id === id);
  const nombreModelo = (id) => (id ? modelo(id)?.modelName || '—' : '—');
  const activos = ia.agents.filter((a) => !a.archived);
  const archivados = ia.agents.filter((a) => a.archived);
  const lista = verArchivados ? ia.agents : activos;
  const respondeEstado = company.status === 'active' || company.status === 'trial';

  const aplicar = (promesa, mensaje) => promesa.then((v) => { setIa(v); setDlg(null); toast(mensaje, 'success'); });
  const guardarAgente = (datos) => (dlg === 'new'
    ? aplicar(createCompanyAgent(company.id, datos), t('ta.created', 'Agente creado'))
    : aplicar(updateCompanyAgent(company.id, dlg.edit.id, datos), t('ai.agentSaved', 'Agente guardado')));
  const guardarWeb = (datos) => (dlg === 'newWeb'
    ? aplicar(createWebChannel(company.id, datos), t('web.created', 'Chat web creado'))
    : aplicar(updateWebChannel(company.id, dlg.editWeb.id, datos), t('web.saved', 'Chat web guardado')));
  const guardarPlanificador = (datos) => (dlg === 'newPlanner'
    ? aplicar(createPlannerWidget(company.id, datos), t('pln.created', 'Planificador creado'))
    : aplicar(updatePlannerWidget(company.id, dlg.editPlanner.id, datos), t('pln.saved', 'Planificador guardado')));
  const nombreAgente = (id) => ia.agents.find((a) => a.id === id)?.name;
  const numeros = ia.channels.filter((c) => c.kind === 'whatsapp');
  const desconectar = async (c) => {
    const ok = await confirm({
      title: t('wa.disconnectTitle', 'Desconectar {{name}}', { name: c.name || c.accountRef.replace(/^wa:/, '') }),
      message: t('wa.disconnectMsg', 'El agente deja de responder en este número ahora mismo. Sus conversaciones se conservan y lo puedes volver a conectar.'),
      confirmLabel: t('wa.disconnect', 'Desconectar'), danger: true,
    });
    if (!ok) return;
    try { setIa(await disconnectWhatsApp(company.id, c.id)); toast(t('wa.disconnected', 'Número desconectado'), 'success'); } catch (e) { toast(e.message, 'danger'); }
  };
  const archivar = async (a) => {
    const ok = await confirm({
      title: t('ta.archiveTitle', 'Archivar {{name}}', { name: a.name }),
      message: t('ta.archiveMsg', 'Deja de atender sus canales ahora mismo. Sus conversaciones y su historial se conservan.'),
      confirmLabel: t('ai.archive', 'Archivar'), danger: true,
    });
    if (!ok) return;
    try { setIa(await archiveCompanyAgent(company.id, a.id)); toast(t('ai.archived', 'Archivado'), 'success'); } catch (e) { toast(e.message, 'danger'); }
  };

  const avisos = [];
  if (modulo === false) avisos.push(t('ta.noModule', 'La empresa no tiene el módulo Asistente de IA: agrégalo en «Plan y módulos» para que sus agentes respondan.'));
  if (!respondeEstado) avisos.push(t('cai.offReason.status', 'Apagado: la empresa no está activa ni en prueba.'));
  if (!ia.policy.enabled) avisos.push(t('ta.policyOff', 'El asistente está apagado para toda la empresa.'));

  return (
    <div className="ta-section">
      <div className="section-card">
        <div className="ta-policy">
          <span className={`badge-m3 ${ia.policy.enabled && respondeEstado && modulo !== false ? 'success' : 'neutral'}`}>
            <span className="dot" />{ia.policy.enabled ? t('ta.on', 'Responde') : t('ta.off', 'Apagado')}
          </span>
          <span className="kv-inline">{t('cai.quoteLimit', 'Tope por cotización (Q)')}: {ia.policy.quoteLimit == null ? t('ai.noMax', 'Sin tope') : fmtGtq(ia.policy.quoteLimit)}</span>
          {ia.policy.escalationUser && <span className="kv-inline">{t('cai.escalation', 'Pasa la conversación a')}: {ia.policy.escalationUser}</span>}
          <span style={{ flex: 1 }} />
          {owner && <Button size="sm" variant="ghost" icon="tune" onClick={() => setDlg('policy')}>{t('cai.settings', 'Ajustes del asistente')}</Button>}
        </div>
        {avisos.map((a) => <p key={a} className="field-hint" style={{ margin: '8px 0 0' }}><Icon name="info" size={14} /> {a}</p>)}
      </div>

      <div className="head-actions" style={{ margin: '16px 0 8px' }}>
        {archivados.length > 0 && (
          <label className="switch-inline"><input type="checkbox" checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} /> {t('ai.showArchived', 'Ver archivados')}</label>
        )}
        {owner && <Button icon="plus" onClick={() => setDlg('new')}>{t('ta.new', 'Nuevo agente')}</Button>}
      </div>

      {lista.length === 0 && (
        <div className="section-card empty">{t('ta.empty', 'La empresa no tiene agentes. Crea uno a partir de un tipo (p. ej. Ventas) y asígnale sus canales.')}</div>
      )}
      <div className="plan-grid">
        {lista.map((a) => {
          const canales = ia.channels.filter((c) => c.tenantAgentId === a.id);
          const escriben = a.effective.tools.filter((x) => x.mode === 'write').length;
          return (
            <article key={a.id} className={`section-card plan-card ${a.archived ? 'is-archived' : ''}`}>
              <header className="plan-card-head">
                <div>
                  <h3 className="section-title">{a.name}</h3>
                  <div className="muted body-small">{a.agentName}</div>
                </div>
                <span className={`badge-m3 ${a.archived ? 'neutral' : a.active ? 'success' : 'warning'}`}>
                  {a.archived ? t('ai.archivedBadge', 'Archivado') : a.active ? t('ta.on', 'Responde') : t('ta.off', 'Apagado')}
                </span>
              </header>
              <dl className="kv-list plan-limits">
                <dt>{t('ta.channels', 'Canales que atiende')}</dt>
                <dd>{canales.length ? <span className="ta-channels">{canales.map((c) => <span key={c.id ?? 'erp'} className="badge-m3 primary">{channelLabel(c, t)}</span>)}</span> : '—'}</dd>
                <dt>{t('ai.model', 'Modelo')}</dt>
                <dd className={`mono ${a.modelId == null ? 'ta-inherited' : ''}`}>{nombreModelo(a.effective.modelId)}</dd>
                <dt>{t('ai.imageModel', 'Modelo de imágenes')}</dt>
                <dd className={`mono ${a.imageModelId == null ? 'ta-inherited' : ''}`}>{nombreModelo(a.effective.imageModelId)}</dd>
                <dt>{t('ai.tools', 'Herramientas')}</dt>
                <dd>{a.tools == null ? t('ta.toolsAllShort', 'Todas las del tipo') : t('ai.toolsCount', '{{n}} ({{w}} escriben)', { n: a.effective.tools.length, w: escriben })}</dd>
                <dt>{t('ta.instructions', 'Instrucciones')}</dt>
                <dd>{a.instructions ? `v${a.instructions.version} · ${fmtDate(a.instructions.createdAt)}` : '—'}</dd>
                <dt>{t('ta.playbook', 'Playbook')}</dt>
                <dd>{a.playbook?.version ? `v${a.playbook.version} · ${fmtDate(a.playbook.updatedAt)}` : t('ta.playbookDefault', 'El general del tipo')}</dd>
              </dl>
              {!a.archived && (
                <footer className="plan-card-foot">
                  <Button size="sm" variant="ghost" icon="description" onClick={() => setDlg({ instructions: a })}>{t('ta.instructions', 'Instrucciones')}</Button>
                  <Button size="sm" variant="ghost" icon="menu_book" onClick={() => setDlg({ playbook: a })}>{t('ta.playbook', 'Playbook')}</Button>
                  {owner && <Button size="sm" variant="ghost" icon="archive" onClick={() => archivar(a)}>{t('ai.archive', 'Archivar')}</Button>}
                  {owner && <Button size="sm" icon="edit" onClick={() => setDlg({ edit: a })}>{t('common.edit', 'Editar')}</Button>}
                </footer>
              )}
            </article>
          );
        })}
      </div>

      <div className="ta-web-head">
        <div>
          <h3 className="subsection-title">{t('wa.section', 'WhatsApp')}</h3>
          <p className="field-hint" style={{ margin: 0 }}>{t('wa.sectionHint', 'Números de la cuenta de WhatsApp Business de Stackline que atiende esta empresa.')}</p>
        </div>
        {owner && <Button icon="plus" onClick={() => setDlg('connectWa')}>{t('wa.connectNew', 'Conectar número')}</Button>}
      </div>
      {numeros.length === 0 ? (
        <div className="section-card empty">{t('wa.empty', 'La empresa no tiene números de WhatsApp conectados.')}</div>
      ) : (
        <div className="plan-grid">
          {numeros.map((c) => {
            const agente = nombreAgente(c.tenantAgentId);
            const [numero, nombre] = (c.name || c.accountRef.replace(/^wa:/, '')).split(' · ');
            return (
              <article key={c.id} className="section-card plan-card">
                <header className="plan-card-head">
                  <div>
                    <h3 className="section-title">{numero}</h3>
                    <div className="muted body-small">{nombre || t('wa.noName', 'Sin nombre verificado')}</div>
                  </div>
                  <span className={`badge-m3 ${agente ? 'success' : 'warning'}`}>{agente ? t('ta.on', 'Responde') : t('web.noAgent', 'Sin agente')}</span>
                </header>
                <dl className="kv-list plan-limits web-kv">
                  <dt>{t('web.agentShort', 'Agente')}</dt>
                  <dd>{agente || '—'}</dd>
                  <dt>{t('wa.phoneNumberId', 'ID del número')}</dt>
                  <dd className="mono web-break">{c.accountRef.replace(/^wa:/, '')}</dd>
                </dl>
                {owner && (
                  <footer className="plan-card-foot">
                    <Button size="sm" variant="ghost" icon="link_off" onClick={() => desconectar(c)}>{t('wa.disconnect', 'Desconectar')}</Button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="ta-web-head">
        <div>
          <h3 className="subsection-title">{t('web.section', 'Chat en la página web')}</h3>
          <p className="field-hint" style={{ margin: 0 }}>{t('web.sectionHint', 'Un widget que la empresa pega en su sitio. El visitante chatea sin registrarse; el agente le pide sus datos cuando quiere cotizar.')}</p>
        </div>
        {owner && <Button icon="plus" onClick={() => setDlg('newWeb')}>{t('web.new', 'Nuevo chat web')}</Button>}
      </div>
      {ia.webChannels.length === 0 ? (
        <div className="section-card empty">{t('web.empty', 'La empresa no tiene chat en su página web.')}</div>
      ) : (
        <div className="plan-grid">
          {ia.webChannels.map((w) => {
            const agente = nombreAgente(w.tenantAgentId);
            const estado = !w.active ? ['neutral', t('ta.off', 'Apagado')]
              : !agente ? ['warning', t('web.noAgent', 'Sin agente')] : ['success', t('ta.on', 'Responde')];
            return (
              <article key={w.id} className={`section-card plan-card ${w.active ? '' : 'is-archived'}`}>
                <header className="plan-card-head">
                  <div className="web-card-title">
                    <span className="web-swatch" style={{ background: w.color || '#731C37' }} aria-hidden="true" />
                    <div>
                      <h3 className="section-title">{w.name}</h3>
                      <div className="muted body-small">{w.title || t('web.defaultTitle', 'Asistente virtual')}</div>
                    </div>
                  </div>
                  <span className={`badge-m3 ${estado[0]}`}>{estado[1]}</span>
                </header>
                <dl className="kv-list plan-limits web-kv">
                  <dt>{t('web.agentShort', 'Agente')}</dt>
                  <dd>{agente || '—'}</dd>
                  <dt>{t('web.originsShort', 'Dominios')}</dt>
                  <dd><span className="web-origins">{w.allowedOrigins.map((o) => <span key={o} className="mono">{o}</span>)}</span></dd>
                  <dt>{t('web.keyShort', 'Llave')}</dt>
                  <dd className="mono web-break">{w.publicKey}</dd>
                </dl>
                <footer className="plan-card-foot">
                  <Button size="sm" variant="ghost" icon="code" onClick={() => setDlg({ code: w })}>{t('web.code', 'Código')}</Button>
                  {owner && <Button size="sm" icon="edit" onClick={() => setDlg({ editWeb: w })}>{t('common.edit', 'Editar')}</Button>}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <div className="ta-web-head">
        <div>
          <h3 className="subsection-title">{t('pln.section', 'Planificador por presupuesto')}</h3>
          <p className="field-hint" style={{ margin: 0 }}>{t('pln.sectionHint', 'Un bloque en la página de la empresa: el visitante arma opciones con precios reales contra su presupuesto y contacta a un asesor por WhatsApp. No crea cotizaciones.')}</p>
        </div>
        {owner && <Button icon="plus" onClick={() => setDlg('newPlanner')}>{t('pln.new', 'Nuevo planificador')}</Button>}
      </div>
      {ia.plannerWidgets.length === 0 ? (
        <div className="section-card empty">{t('pln.empty', 'La empresa no tiene planificador en su página.')}</div>
      ) : (
        <div className="plan-grid">
          {ia.plannerWidgets.map((p) => {
            const agente = nombreAgente(p.tenantAgentId);
            // Sin agente sigue funcionando (campos, chips y precios), solo sin chat ni renders.
            const estado = !p.active ? ['neutral', t('ta.off', 'Apagado')]
              : !agente ? ['warning', t('pln.noChat', 'Sin chat')] : ['success', t('pln.withChat', 'Con chat')];
            return (
              <article key={p.id} className={`section-card plan-card ${p.active ? '' : 'is-archived'}`}>
                <header className="plan-card-head">
                  <div className="web-card-title">
                    <span className="web-swatch" style={{ background: p.accentColor || '#8B6549' }} aria-hidden="true" />
                    <div>
                      <h3 className="section-title">{p.name}</h3>
                      <div className="muted body-small">{p.title || t('pln.defaultTitle', 'Planificador de proyectos')}</div>
                    </div>
                  </div>
                  <span className={`badge-m3 ${estado[0]}`}>{estado[1]}</span>
                </header>
                <dl className="kv-list plan-limits web-kv">
                  <dt>{t('web.agentShort', 'Agente')}</dt>
                  <dd>{agente || '—'}</dd>
                  <dt>{t('pln.categoriesShort', 'Categorías')}</dt>
                  <dd>{[
                    ...p.categoryIds.map((id) => (ia.catalogCategories || []).find((c) => c.id === id)?.name || `#${id}`),
                    ...p.projectTypes.map((x) => x.label),
                  ].join(', ') || '—'}</dd>
                  <dt>{t('pln.whatsapp', 'WhatsApp del asesor')}</dt>
                  <dd className={p.contactWhatsapp ? 'mono' : ''}>{p.contactWhatsapp ? `+${p.contactWhatsapp}` : t('pln.noContact', 'Sin botón de contacto')}</dd>
                  <dt>{t('web.originsShort', 'Dominios')}</dt>
                  <dd><span className="web-origins">{p.allowedOrigins.map((o) => <span key={o} className="mono">{o}</span>)}</span></dd>
                  <dt>{t('web.keyShort', 'Llave')}</dt>
                  <dd className="mono web-break">{p.publicKey}</dd>
                </dl>
                <footer className="plan-card-foot">
                  <Button size="sm" variant="ghost" icon="code" onClick={() => setDlg({ plannerCode: p })}>{t('web.code', 'Código')}</Button>
                  {owner && <Button size="sm" icon="edit" onClick={() => setDlg({ editPlanner: p })}>{t('common.edit', 'Editar')}</Button>}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {(dlg === 'newPlanner' || dlg?.editPlanner) && (
        <PlannerDialog planner={dlg.editPlanner || null} agents={ia.agents} categories={ia.catalogCategories} onClose={() => setDlg(null)} onSubmit={guardarPlanificador} />
      )}
      {dlg?.plannerCode && <PlannerCodeDialog planner={dlg.plannerCode} scriptUrl={ia.plannerScriptUrl} onClose={() => setDlg(null)} />}
      {(dlg === 'newWeb' || dlg?.editWeb) && (
        <WebChannelDialog widget={dlg.editWeb || null} agents={ia.agents} onClose={() => setDlg(null)} onSubmit={guardarWeb} />
      )}
      {dlg === 'connectWa' && (
        <WhatsAppConnectDialog agents={ia.agents} lookup={(id) => lookupWhatsApp(company.id, id)} onClose={() => setDlg(null)}
          onSubmit={(body) => aplicar(connectWhatsApp(company.id, body), t('wa.connected', 'Número conectado'))} />
      )}
      {dlg?.code && <WidgetCodeDialog widget={dlg.code} scriptUrl={ia.widgetScriptUrl} onClose={() => setDlg(null)} />}
      {dlg === 'policy' && (
        <PolicyDialog policy={ia.policy} onClose={() => setDlg(null)}
          onSubmit={(p) => aplicar(saveCompanyAiPolicy(company.id, p), t('ta.policySaved', 'Ajustes guardados'))} />
      )}
      {(dlg === 'new' || dlg?.edit) && (
        <TenantAgentDialog agent={dlg.edit || null} types={tipos} models={catalog.models} tools={catalog.tools}
          channels={ia.channels} agents={ia.agents} onClose={() => setDlg(null)} onSubmit={guardarAgente} />
      )}
      {dlg?.instructions && (
        <VersionsDialog title={t('ta.instructionsTitle', 'Instrucciones de {{name}}', { name: dlg.instructions.name })} canEdit={editaTexto}
          hint={t('ta.instructionsHint', 'Lo propio de este agente en esta empresa: sus procesos, qué ofrecer, qué no. Va después de la identidad de Tino y del rol del tipo, y prevalece sobre ellos.')}
          emptyText={t('ta.instructionsEmpty', 'Sin instrucciones: el agente usa la identidad de Tino, el rol de su tipo y el playbook.')}
          load={() => listAgentInstructions(company.id, dlg.instructions.id)}
          create={(body) => createAgentInstructions(company.id, dlg.instructions.id, body)}
          activate={(v) => activateAgentInstructions(company.id, dlg.instructions.id, v.id)}
          clear={() => clearAgentInstructions(company.id, dlg.instructions.id)}
          onClose={() => setDlg(null)} onChanged={cargar} />
      )}
      {dlg?.playbook && (
        <PlaybookDialog playbook={dlg.playbook.playbook || { version: 0, config: {} }}
          chatModel={modelo(dlg.playbook.effective.modelId) || null} imageModel={modelo(dlg.playbook.effective.imageModelId) || null}
          onClose={() => setDlg(null)}
          onSubmit={(config) => (editaTexto
            ? aplicar(saveAgentPlaybook(company.id, dlg.playbook.id, config), t('cai.playbookSaved', 'Playbook guardado'))
            : Promise.reject(new Error(t('ta.noPermission', 'Tu rol no permite cambiarlo'))))} />
      )}
    </div>
  );
}

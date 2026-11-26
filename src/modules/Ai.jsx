// Modelos y agentes: lo global del asistente. La identidad de Tino (igual en
// todas las empresas), los proveedores, los modelos con sus precios y los tipos
// de agente (rol, herramientas que pueden usar y prompt). Los agentes de cada
// empresa —sus canales, instrucciones y playbook— van en su ficha.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';
import ModelDialog from '../components/ModelDialog.jsx';
import AgentDialog from '../components/AgentDialog.jsx';
import ProviderDialog from '../components/ProviderDialog.jsx';
import VersionsDialog from '../components/VersionsDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { SearchBox, Pager } from '../components/ListControls.jsx';
import { filterItems, pageOf } from '../lib/toolFilter.js';
import {
  getAiCatalog, listAgents, createModel, updateModel, updateAgent, createAgentType, archiveAgentType, restoreAgentType,
  createProvider, updateProvider, getIdentity, createIdentity, activateIdentity,
  listPrompts, createPrompt, activatePrompt, canManageAi,
} from '../api/platform.js';
import { fmtDate, fmtInt } from '../lib/fmt.js';

const MODELOS_POR_PAGINA = 8;

const precio = (v) => (v == null ? '—' : `US$ ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`);

function Section({ title, description, action, children }) {
  return (
    <section className="section section-panel">
      <div className="section-heading">
        <div>
          <h2 className="section-title">{title}</h2>
          {description && <div className="section-description">{description}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Ai({ session }) {
  const { t } = useTranslation();
  const toast = useToast();
  const owner = canManageAi(session.operator);
  const [catalog, setCatalog] = useState(null);
  const [agents, setAgents] = useState(null);
  const [dlg, setDlg] = useState(null); // { model } | { newModel } | { agent } | { prompt }
  const [error, setError] = useState(null);
  const [identidad, setIdentidad] = useState(null);
  const [archivados, setArchivados] = useState(false);
  const confirm = useConfirm();

  const cargar = useCallback(() => {
    // Un fallo de carga se muestra en la página (con reintentar), no como
    // toast: sin datos no hay nada más que ver aquí.
    setError(null);
    Promise.all([getAiCatalog(), listAgents(), getIdentity()])
      .then(([c, a, i]) => { setCatalog(c); setAgents(a); setIdentidad(i); })
      .catch(setError);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const nombreModelo = (id) => catalog?.models.find((m) => m.id === id)?.modelName || '—';
  const toolsWrite = (a) => a.tools.filter((x) => x.mode === 'write').length;

  const guardarModelo = async (datos) => {
    if (dlg.newModel) await createModel(datos); else await updateModel(dlg.model.id, datos);
    setDlg(null);
    cargar();
    toast(t('ai.modelSaved', 'Modelo guardado'), 'success');
  };
  const guardarAgente = async (datos) => {
    if (dlg.newAgent) await createAgentType(datos); else await updateAgent(dlg.agent.id, datos);
    setDlg(null);
    cargar();
    toast(t('ai.agentSaved', 'Agente guardado'), 'success');
  };
  const guardarProveedor = async (datos) => {
    if (dlg.newProvider) await createProvider(datos); else await updateProvider(dlg.provider.id, datos);
    setDlg(null);
    cargar();
    toast(t('ai.providerSaved', 'Proveedor guardado'), 'success');
  };
  const archivar = async (a) => {
    const ok = await confirm({
      title: t('ai.archiveTitle', 'Archivar {{name}}', { name: a.name }),
      message: t('ai.archiveMsg', 'No se podrá usar en agentes de empresa nuevos. Su historial se conserva y se puede restaurar.'),
      confirmLabel: t('ai.archive', 'Archivar'), danger: true,
    });
    if (!ok) return;
    try { await archiveAgentType(a.id); cargar(); toast(t('ai.archived', 'Archivado'), 'success'); } catch (e) { toast(e.message, 'danger'); }
  };
  const restaurar = async (a) => {
    try { await restoreAgentType(a.id); cargar(); toast(t('ai.restored', 'Restaurado'), 'success'); } catch (e) { toast(e.message, 'danger'); }
  };
  const visibles = (agents || []).filter((a) => archivados || !a.archived);

  // Modelos: buscador y páginas para que la tabla no crezca sin fin.
  const [mq, setMq] = useState('');
  const [mpage, setMpage] = useState(0);
  const modelos = useMemo(() => filterItems(catalog?.models || [], mq,
    (m) => `${m.modelName} ${m.provider?.name || ''} ${m.provider?.code || ''} ${m.usedBy.join(' ')} ${m.active ? '' : 'inactivo'}`), [catalog, mq]);
  useEffect(() => { setMpage(0); }, [mq]);
  const pm = pageOf(modelos, mpage, MODELOS_POR_PAGINA);

  return (
    <div className="page ai-page" style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('ai.title', 'Modelos y agentes')}</h1>
          <div className="page-sub">{t('ai.subtitle', 'Lo que usa el asistente en todas las empresas. Encenderlo, sus canales y su playbook se configuran en la ficha de cada empresa.')}</div>
        </div>
      </div>

      {error && !catalog && (
        <div className="section-card empty" role="alert">
          <p className="field-error">{error.message}</p>
          <Button variant="ghost" icon="refresh" onClick={cargar}>{t('common.retry', 'Reintentar')}</Button>
        </div>
      )}
      {!catalog && !error && <p className="page-sub">{t('common.loading', 'Cargando…')}</p>}
      {error && catalog && <p className="field-error" role="alert">{error.message}</p>}

      {catalog && identidad && (
        <Section title={t('ai.identity', 'Identidad de Tino')}
          description={t('ai.identityHint', 'Quién es Tino en todas las empresas: personalidad, tono y lo que nunca hace. Va antes del rol de cada tipo y de las instrucciones de cada empresa.')}
          action={<Button variant="ghost" icon="description" onClick={() => setDlg({ identity: true })}>
            {owner ? t('ai.editIdentity', 'Editar identidad') : t('ai.viewIdentity', 'Ver identidad')}</Button>}>
          <div className="section-card" style={{ marginTop: 8 }}>
            {identidad.active ? (
              <>
                <div className="field-hint">v{identidad.active.version} · {fmtDate(identidad.active.createdAt)}{identidad.active.createdBy ? ` · ${identidad.active.createdBy}` : ''}</div>
                <p className="identity-excerpt">{identidad.active.body}</p>
              </>
            ) : (
              <p className="field-hint">{t('ai.identityEmpty', 'Sin identidad: cada agente usa solo el prompt de su tipo y las instrucciones de su empresa.')}</p>
            )}
          </div>
        </Section>
      )}

      {catalog && (
        <Section title={t('ai.providers', 'Proveedores')}
          action={owner && <Button icon="plus" onClick={() => setDlg({ newProvider: true })}>{t('ai.newProvider', 'Nuevo proveedor')}</Button>}
          description={t('ai.providersHint', 'La llave de cada proveedor vive en el servidor (variable de entorno o gestor de secretos). Aquí solo se ve si está puesta: nunca se escribe ni se muestra.')}>
          <div className="section-card" style={{ marginTop: 8 }}>
            <ul className="provider-list">
              {catalog.providers.map((p) => (
                <li key={p.id}>
                  <span className="provider-name">{p.name}</span>
                  <span className="mono muted body-small">{p.credentialRef}</span>
                  <span className={`badge-m3 ${p.credentialSet ? 'success' : 'warning'}`}>
                    {p.credentialSet ? t('ai.keySet', 'Llave configurada') : t('ai.keyMissing', 'Falta la llave')}
                  </span>
                  {!p.active && <span className="badge-m3 neutral">{t('ai.inactive', 'Inactivo')}</span>}
                  {owner && <Button size="sm" variant="ghost" icon="edit" onClick={() => setDlg({ provider: p })}>{t('common.edit', 'Editar')}</Button>}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {catalog && (
        <Section title={t('ai.models', 'Modelos')}
          description={t('ai.modelsHint', 'Precios en US$ por 1 000 tokens; con ellos se calcula el costo de cada llamada.')}
          action={owner && <Button icon="plus" onClick={() => setDlg({ newModel: true })}>{t('ai.newModel', 'Nuevo modelo')}</Button>}>
          {catalog.models.length > MODELOS_POR_PAGINA && (
            <div className="tool-browser-bar" style={{ marginTop: 8 }}>
              <SearchBox value={mq} onChange={setMq} placeholder={t('ai.searchModels', 'Buscar modelo o proveedor…')} />
            </div>
          )}
          <div className="section-card table-card" style={{ marginTop: 8 }}>
            <table className="data-table tbl-stack">
              <thead><tr>
                <th>{t('ai.model', 'Modelo')}</th>
                <th className="hide-laptop" style={{ textAlign: 'right' }}>{t('ai.contextShort', 'Contexto')}</th>
                <th style={{ textAlign: 'right' }}>{t('ai.inputShort', 'Entrada')}</th>
                <th className="hide-laptop" style={{ textAlign: 'right' }}>{t('ai.cachedShort', 'Cacheada')}</th>
                <th style={{ textAlign: 'right' }}>{t('ai.outputShort', 'Salida')}</th>
                <th>{t('ai.usedBy', 'Lo usa')}</th>
                <th>{t('companies.status', 'Estado')}</th>
                {owner && <th />}
              </tr></thead>
              <tbody>
                {modelos.length === 0 && (
                  <tr><td colSpan={8} className="empty">{t('ai.noModels', 'Ningún modelo coincide.')}</td></tr>
                )}
                {pm.items.map((m) => (
                  <tr key={m.id}>
                    <td className="stack-title">
                      <div className="mono">{m.modelName}</div>
                      <div className="muted body-small">{m.provider?.name}{m.supportsTools ? '' : ` · ${t('ai.noTools', 'sin herramientas')}`}</div>
                      {(m.supportsVision || m.generatesImages) && (
                        <div className="chip-list model-caps">
                          {m.supportsVision && <span className="badge-m3 neutral">{t('ai.capVision', 'Lee imágenes')}</span>}
                          {m.generatesImages && <span className="badge-m3 neutral">{t('ai.capImages', 'Edita imágenes · {{cost}} c/u', { cost: precio(m.imageCost) })}</span>}
                        </div>
                      )}
                    </td>
                    <td className="mono hide-laptop" style={{ textAlign: 'right' }}>{fmtInt(m.contextWindow)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{precio(m.inputCost1k)}</td>
                    <td className="mono hide-laptop" style={{ textAlign: 'right' }}>{precio(m.cachedCost1k)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{precio(m.outputCost1k)}</td>
                    <td>
                      {m.usedBy.length || m.companiesCount ? (
                        <div className="chip-list">
                          {m.usedBy.map((c) => <span key={c} className="badge-m3 primary">{agents?.find((a) => a.code === c)?.name || c}</span>)}
                          {m.companiesCount > 0 && <span className="badge-m3 neutral">{t('ai.companiesN', '{{count}} empresas', { count: m.companiesCount })}</span>}
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>{m.active ? <span className="badge-m3 success">{t('ai.available', 'Disponible')}</span> : <span className="badge-m3 neutral">{t('plans.inactive', 'Inactivo')}</span>}</td>
                    {owner && (
                      <td className="stack-actions" style={{ textAlign: 'right' }}>
                        <Button size="sm" variant="ghost" icon="edit" onClick={() => setDlg({ model: m })}>{t('common.edit', 'Editar')}</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager p={pm} size={MODELOS_POR_PAGINA} count={modelos.length} onPage={setMpage} />
        </Section>
      )}

      {catalog && agents && (
        <Section title={t('ai.types', 'Tipos de agente')}
          description={t('ai.typesHint', 'El rol de cada agente: su prompt, las herramientas que puede usar y sus modelos por defecto. Cada empresa crea sus agentes a partir de un tipo y puede quitarles herramientas, cambiar el modelo y darles instrucciones.')}
          action={<div className="head-actions">
            {agents.some((a) => a.archived) && (
              <label className="switch-inline"><input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} /> {t('ai.showArchived', 'Ver archivados')}</label>
            )}
            {owner && <Button icon="plus" onClick={() => setDlg({ newAgent: true })}>{t('ai.newType', 'Nuevo tipo de agente')}</Button>}
          </div>}>
          <div className="plan-grid" style={{ marginTop: 8 }}>
            {visibles.map((a) => (
              <article key={a.id} className={`section-card plan-card ${a.archived ? 'is-archived' : ''}`}>
                <header className="plan-card-head">
                  <div>
                    <h3 className="section-title">{a.name}</h3>
                    <div className="mono muted body-small">{a.code}</div>
                  </div>
                  <span className={`badge-m3 ${a.archived ? 'neutral' : a.kind === 'conversational' ? 'primary' : 'neutral'}`}>
                    {a.archived ? t('ai.archivedBadge', 'Archivado') : a.kind === 'conversational' ? t('ai.kindConversational', 'Conversa') : t('ai.kindInternal', 'Interno')}
                  </span>
                </header>
                <p className="plan-card-desc">{a.description}</p>
                <dl className="kv-list plan-limits">
                  <dt>{t('ai.model', 'Modelo')}</dt><dd className="mono">{nombreModelo(a.modelId)}</dd>
                  <dt>{t('ai.fallback', 'Modelo de respaldo')}</dt><dd className="mono">{a.fallbackModelId ? nombreModelo(a.fallbackModelId) : '—'}</dd>
                  {a.kind === 'conversational' && (<>
                    <dt>{t('ai.imageModel', 'Modelo de imágenes')}</dt><dd className="mono">{a.imageModelId ? nombreModelo(a.imageModelId) : '—'}</dd>
                  </>)}
                  <dt>{t('ai.temperature', 'Temperatura')}</dt><dd className="mono">{a.temperature}</dd>
                  <dt>{t('ai.timeoutShort', 'Tiempo máximo')}</dt><dd className="mono">{Math.round(a.responseTimeoutMs / 1000)} s</dd>
                  {a.kind === 'conversational' && (<>
                    <dt>{t('ai.tools', 'Herramientas')}</dt>
                    <dd>{t('ai.toolsCount', '{{n}} ({{w}} escriben)', { n: a.tools.length, w: toolsWrite(a) })}</dd>
                    <dt>{t('ai.tenantAgents', 'Agentes de empresa')}</dt><dd className="mono">{fmtInt(a.tenantAgentsCount)}</dd>
                  </>)}
                  <dt>{t('ai.prompt', 'Prompt')}</dt>
                  <dd>{a.prompt ? `v${a.prompt.version} · ${fmtDate(a.prompt.createdAt)}` : '—'}</dd>
                </dl>
                <footer className="plan-card-foot">
                  <Button size="sm" variant="ghost" icon="description" onClick={() => setDlg({ prompt: a })}>{t('ai.prompt', 'Prompt')}</Button>
                  {owner && !a.archived && a.kind === 'conversational' && a.tenantAgentsCount === 0 && (
                    <Button size="sm" variant="ghost" icon="archive" onClick={() => archivar(a)}>{t('ai.archive', 'Archivar')}</Button>
                  )}
                  {owner && a.archived && <Button size="sm" variant="ghost" icon="unarchive" onClick={() => restaurar(a)}>{t('ai.restore', 'Restaurar')}</Button>}
                  {owner && !a.archived && <Button size="sm" icon="edit" onClick={() => setDlg({ agent: a })}>{t('common.edit', 'Editar')}</Button>}
                </footer>
              </article>
            ))}
          </div>
        </Section>
      )}

      {(dlg?.model || dlg?.newModel) && (
        <ModelDialog model={dlg.model || null} providers={catalog.providers} onClose={() => setDlg(null)} onSubmit={guardarModelo} />
      )}
      {(dlg?.agent || dlg?.newAgent) && (
        <AgentDialog agent={dlg.agent || null} models={catalog.models} tools={catalog.tools} onClose={() => setDlg(null)} onSubmit={guardarAgente} />
      )}
      {(dlg?.provider || dlg?.newProvider) && (
        <ProviderDialog provider={dlg.provider || null} codes={catalog.providerCodes || []} existing={catalog.providers}
          onClose={() => setDlg(null)} onSubmit={guardarProveedor} />
      )}
      {dlg?.prompt && (
        <VersionsDialog title={t('ai.promptTitle', 'Prompt de {{name}}', { name: dlg.prompt.name })} canEdit={owner && !dlg.prompt.archived}
          hint={t('ai.promptHint', 'Describe cómo se comporta el agente. Las reglas duras (límites, confirmaciones) las aplica el código y el playbook de cada empresa.')}
          load={() => listPrompts(dlg.prompt.id)} create={(body) => createPrompt(dlg.prompt.id, body)} activate={(v) => activatePrompt(dlg.prompt.id, v.id)}
          onClose={() => setDlg(null)} onChanged={cargar} />
      )}
      {dlg?.identity && (
        <VersionsDialog title={t('ai.identity', 'Identidad de Tino')} canEdit={owner}
          hint={t('ai.identityEditHint', 'Personalidad, tono y reglas que comparte Tino en todas las empresas. Lo particular de cada rol o empresa va en su prompt o en sus instrucciones.')}
          emptyText={t('ai.identityEmpty', 'Sin identidad: cada agente usa solo el prompt de su tipo y las instrucciones de su empresa.')}
          load={() => getIdentity().then((i) => i.versions)} create={(body) => createIdentity(body).then((i) => i.versions)}
          activate={(v) => activateIdentity(v.id)} onClose={() => setDlg(null)} onChanged={cargar} />
      )}
    </div>
  );
}

// Planificador por presupuesto: bloque que la empresa inserta en su página.
// El visitante arma opciones con precios reales del ERP contra su presupuesto y
// al final contacta a un asesor por WhatsApp (no se crea cotización en el ERP).
// La llave es pública; lo protegen los dominios permitidos.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Field from './Field.jsx';
import Icon from './Icon.jsx';
import { parseOrigins, MAX_ORIGINS } from '../lib/web.js';
import { DEFAULT_ACCENT, FIT, RETENTION, OPTIONS, LANGS, MAX_TYPES, MAX_CATEGORIES, typeCode, parseTypes, normalizeWhatsapp, categoryTree } from '../lib/planner.js';

const HEX = /^#[0-9a-f]{6}$/i;

export default function PlannerDialog({ planner, agents, categories, onClose, onSubmit }) {
  const { t } = useTranslation();
  const nuevo = !planner;
  const atienden = agents.filter((a) => !a.archived);
  const [f, setF] = useState(() => ({
    name: planner?.name ?? '',
    origins: (planner?.allowedOrigins ?? []).join('\n'),
    title: planner?.title ?? '',
    accentColor: planner?.accentColor ?? DEFAULT_ACCENT,
    lang: planner?.lang ?? 'es',
    fitThresholdPct: String(planner?.fitThresholdPct ?? FIT.def),
    retentionDays: String(planner?.retentionDays ?? RETENTION.def),
    maxOptions: String(planner?.maxOptions ?? OPTIONS.def),
    contactWhatsapp: planner?.contactWhatsapp ?? '',
    tenantAgentId: planner ? (planner.tenantAgentId ?? '') : (atienden[0]?.id ?? ''),
    active: planner?.active ?? true,
  }));
  // Lo que ve el visitante: categorías del ERP y, en los que ya los tenían, tipos fijos.
  const arbol = categoryTree(categories);
  const [catIds, setCatIds] = useState(() => planner?.categoryIds ?? []);
  const toggleCat = (id) => setCatIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  // Un código nuevo sigue al nombre; el de un tipo guardado no cambia (los diseños ya lo usan).
  const [tipos, setTipos] = useState(() => (planner?.projectTypes ?? [])
    .map((x) => ({ label: x.label, code: x.code, productId: String(x.productId), nuevo: false })));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setTipo = (i, k, v) => setTipos((xs) => xs.map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, [k]: v };
    if (k === 'label' && x.nuevo) n.code = typeCode(v);
    return n;
  }));

  const entero = (v, r) => (/^\d+$/.test(String(v).trim()) && Number(v) >= r.min && Number(v) <= r.max ? Number(v) : null);

  const guardar = async () => {
    const e = {};
    if (!f.name.trim()) e.name = t('ai.err.name', 'El nombre es obligatorio');
    const { valid, invalid } = parseOrigins(f.origins);
    if (invalid.length) e.allowedOrigins = t('web.err.origin', 'Dominio inválido: {{d}} (usa https://www.ejemplo.com)', { d: invalid[0] });
    else if (!valid.length) e.allowedOrigins = t('web.err.noOrigins', 'Agrega al menos un dominio');
    else if (valid.length > MAX_ORIGINS) e.allowedOrigins = t('web.err.maxOrigins', 'Máximo {{n}} dominios', { n: MAX_ORIGINS });
    const pt = parseTypes(tipos);
    if (pt.error) {
      const n = pt.index != null ? pt.index + 1 : null;
      e.projectTypes = {
        max: t('pln.err.maxTypes', 'Máximo {{n}} tipos de proyecto', { n: MAX_TYPES }),
        label: t('pln.err.label', 'Tipo {{n}}: nombre de 1 a 40 caracteres', { n }),
        code: t('pln.err.code', 'Tipo {{n}}: código en minúsculas, sin espacios (p. ej. pergola)', { n }),
        dup: t('pln.err.dup', 'El código «{{c}}» está repetido', { c: pt.code }),
        product: t('pln.err.product', 'Tipo {{n}}: falta el ID del producto en el ERP', { n }),
      }[pt.error];
    }
    if (!catIds.length && !(pt.types || []).length && !pt.error) e.categoryIds = t('pln.err.categories', 'Elige al menos una categoría');
    else if (catIds.length > MAX_CATEGORIES) e.categoryIds = t('pln.err.maxCategories', 'Máximo {{n}} categorías', { n: MAX_CATEGORIES });
    if (!HEX.test(f.accentColor)) e.accentColor = t('web.err.color', 'Color en formato #RRGGBB');
    const fit = /^\d{2,3}(\.\d{1,2})?$/.test(f.fitThresholdPct.trim()) && Number(f.fitThresholdPct) >= FIT.min && Number(f.fitThresholdPct) <= FIT.max
      ? Number(f.fitThresholdPct) : null;
    if (fit == null) e.fitThresholdPct = t('pln.err.fit', 'Entre {{a}} y {{b}} (%)', { a: FIT.min, b: FIT.max });
    const retencion = entero(f.retentionDays, RETENTION);
    if (retencion == null) e.retentionDays = t('pln.err.range', 'Entero entre {{a}} y {{b}}', { a: RETENTION.min, b: RETENTION.max });
    const opciones = entero(f.maxOptions, OPTIONS);
    if (opciones == null) e.maxOptions = t('pln.err.range', 'Entero entre {{a}} y {{b}}', { a: OPTIONS.min, b: OPTIONS.max });
    const whatsapp = normalizeWhatsapp(f.contactWhatsapp);
    if (whatsapp == null) e.contactWhatsapp = t('pln.err.whatsapp', 'Número con código de país, solo dígitos (p. ej. 50212345678)');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const datos = {
      name: f.name.trim(),
      allowedOrigins: valid,
      // En el orden del árbol del ERP (así se muestran); las que ya no existen allá se conservan al final.
      categoryIds: [...arbol.map((c) => c.id).filter((id) => catIds.includes(id)), ...catIds.filter((id) => !arbol.some((c) => c.id === id))],
      projectTypes: pt.types,
      title: f.title.trim() || null,
      accentColor: f.accentColor.toUpperCase(),
      lang: f.lang,
      fitThresholdPct: fit,
      retentionDays: retencion,
      maxOptions: opciones,
      // Vacío quita el botón «Contactar a un asesor».
      contactWhatsapp: whatsapp,
      tenantAgentId: f.tenantAgentId === '' ? null : Number(f.tenantAgentId),
    };
    if (!nuevo) datos.active = f.active;
    try {
      await onSubmit(datos);
    } catch (err) { setErrors(err.fields || { _: err.message }); setBusy(false); }
  };

  return (
    <Modal size="modal-lg" title={nuevo ? t('pln.new', 'Nuevo planificador') : t('pln.editTitle', 'Editar {{name}}', { name: planner.name })}
      onClose={onClose} busy={busy}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancelar')}</Button>
        <Button variant="accent" onClick={guardar} disabled={busy}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid" style={{ marginTop: 0 }}>
        <Field label={t('web.name', 'Nombre')} error={errors.name} hint={t('pln.nameHint', 'Solo para la consola, p. ej. «Planificador de pérgolas».')}>
          <input className="field-input" value={f.name} maxLength={80} onChange={set('name')} />
        </Field>
        <Field label={t('web.agent', 'Agente que atiende')} error={errors.tenantAgentId}
          hint={atienden.length ? t('pln.agentHint', 'Conversa con el visitante. Sin agente funciona sin chat ni renders.') : t('web.noAgents', 'Crea primero un agente para la empresa.')}>
          <select className="field-input" value={f.tenantAgentId} onChange={set('tenantAgentId')}>
            <option value="">{t('web.noAgent', 'Sin agente')}</option>
            {atienden.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field span2 label={t('web.origins', 'Dominios permitidos')} error={errors.allowedOrigins}
          hint={t('pln.originsHint', 'Uno por línea, con https://. Desde otro sitio el planificador no carga.')}>
          <textarea className="field-input mono" rows={2} value={f.origins} onChange={set('origins')}
            placeholder={'https://www.ejemplo.com'} />
        </Field>
      </div>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pln.categories', 'Categorías del catálogo')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pln.categoriesHint', 'El visitante elige una categoría y luego un producto de la lista, con su foto y su precio. Cada categoría incluye sus subcategorías.')}</p>
      {categories == null ? (
        <div className="field-error" role="alert">{t('pln.noCatalog', 'No se pudo leer el catálogo del ERP de la empresa. Intenta de nuevo en un momento.')}</div>
      ) : !arbol.length ? (
        <p className="field-hint">{t('pln.emptyCatalog', 'La empresa todavía no tiene categorías en su ERP.')}</p>
      ) : (
        <div className="pln-cats" role="group" aria-label={t('pln.categories', 'Categorías del catálogo')}>
          {/* Cada raíz con sus subcategorías en un bloque: las columnas no los separan. */}
          {arbol.reduce((grupos, c) => { if (c.depth === 0 || !grupos.length) grupos.push([]); grupos[grupos.length - 1].push(c); return grupos; }, [])
            .map((g) => (
              <div key={g[0].id} className="pln-cat-group">
                {g.map((c) => (
                  <label key={c.id} className="switch-inline" style={{ '--d': c.depth }}>
                    <input type="checkbox" checked={catIds.includes(c.id)} onChange={() => toggleCat(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            ))}
        </div>
      )}
      {errors.categoryIds && <div className="field-error" role="alert">{errors.categoryIds}</div>}

      {tipos.length > 0 && (<>
      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pln.legacyTypes', 'Tipos fijos')}</h4>
      <p className="field-hint" style={{ margin: '0 0 8px' }}>{t('pln.legacyTypesHint', 'Chips que apuntan a un producto con plantilla de cálculo (se cotiza a la medida). Puedes quitarlos si ya usas categorías.')}</p>
      <div className="pb-data">
        {tipos.map((x, i) => (
          <div key={i} className="pb-data-row">
            <Field label={t('pln.typeLabel', 'Nombre')}>
              <input className="field-input" value={x.label} maxLength={40} onChange={(e) => setTipo(i, 'label', e.target.value)} />
            </Field>
            <Field label={t('pln.typeCode', 'Código')}>
              <input className="field-input mono" value={x.code} maxLength={40} disabled={!x.nuevo} onChange={(e) => setTipo(i, 'code', e.target.value)} />
            </Field>
            <Field label={t('pln.typeProduct', 'ID del producto en el ERP')}>
              <input className="field-input mono" inputMode="numeric" value={x.productId} onChange={(e) => setTipo(i, 'productId', e.target.value.replace(/[^\d]/g, ''))} />
            </Field>
            <button type="button" className="icon-btn" aria-label={t('pln.removeType', 'Quitar {{t}}', { t: x.label || '' })}
              onClick={() => setTipos((xs) => xs.filter((_, j) => j !== i))}>
              <Icon name="delete" size={20} />
            </button>
          </div>
        ))}
        {tipos.length < MAX_TYPES && (
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setTipos((xs) => [...xs, { label: '', code: '', productId: '', nuevo: true }])}>
            {t('pln.addType', 'Agregar tipo')}
          </Button>
        )}
      </div>
      </>)}
      {errors.projectTypes && <div className="field-error" role="alert">{errors.projectTypes}</div>}

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('pln.rules', 'Presupuesto y opciones')}</h4>
      <div className="form-grid">
        <Field label={t('pln.fit', 'Umbral de «justo» (%)')} error={errors.fitThresholdPct}
          hint={t('pln.fitHint', 'Encaja hasta este % del presupuesto; de ahí al 100 %, «justo»; más, «se pasa».')}>
          <input className="field-input mono" inputMode="decimal" value={f.fitThresholdPct} onChange={set('fitThresholdPct')} />
        </Field>
        <Field label={t('pln.maxOptions', 'Opciones por diseño')} error={errors.maxOptions}>
          <input className="field-input mono" inputMode="numeric" value={f.maxOptions} onChange={set('maxOptions')} />
        </Field>
        <Field label={t('pln.retention', 'Días que se guarda un diseño')} error={errors.retentionDays}
          hint={t('pln.retentionHint', 'Desde la última actividad del visitante.')}>
          <input className="field-input mono" inputMode="numeric" value={f.retentionDays} onChange={set('retentionDays')} />
        </Field>
        <Field label={t('pln.whatsapp', 'WhatsApp del asesor')} error={errors.contactWhatsapp}
          hint={t('pln.whatsappHint', 'Con código de país. El botón «Contactar a un asesor» abre este WhatsApp con el diseño escrito. Vacío: sin botón.')}>
          <input className="field-input mono" inputMode="tel" value={f.contactWhatsapp} placeholder="+502 1234 5678" onChange={set('contactWhatsapp')} />
        </Field>
      </div>
      <p className="field-hint" style={{ margin: '8px 0 0' }}>
        <Icon name="info" size={14} /> {t('pln.rendersHint', 'Los renders salen del playbook del agente (imágenes de ejemplo: activar y cuántas) y de su modelo de imágenes.')}
      </p>

      <h4 className="subsection-title" style={{ margin: '20px 0 4px' }}>{t('web.look', 'Cómo se ve')}</h4>
      <div className="form-grid">
        <Field label={t('web.title', 'Título')} error={errors.title} hint={t('pln.titleHint', 'Encabezado del bloque. Vacío: «Planificador de proyectos».')}>
          <input className="field-input" value={f.title} maxLength={60} onChange={set('title')} />
        </Field>
        <Field label={t('web.color', 'Color')} error={errors.accentColor}>
          <div className="web-color">
            <input type="color" value={HEX.test(f.accentColor) ? f.accentColor : DEFAULT_ACCENT} onChange={set('accentColor')} aria-label={t('web.color', 'Color')} />
            <input className="field-input mono" value={f.accentColor} maxLength={7} onChange={set('accentColor')} />
          </div>
        </Field>
        <Field label={t('pln.lang', 'Idioma')} error={errors.lang}>
          <select className="field-input" value={f.lang} onChange={set('lang')}>
            {LANGS.map((l) => <option key={l} value={l}>{l === 'es' ? t('pln.langEs', 'Español') : t('pln.langEn', 'Inglés')}</option>)}
          </select>
        </Field>
      </div>

      {!nuevo && (
        <label className="switch-row">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>{t('ta.active', 'Encendido')}
            <span className="field-hint">{t('pln.activeHint', 'Apagado, el planificador desaparece de la página.')}</span>
          </span>
        </label>
      )}
      {errors._ && <div className="field-error" role="alert" style={{ marginTop: 12 }}>{errors._}</div>}
    </Modal>
  );
}

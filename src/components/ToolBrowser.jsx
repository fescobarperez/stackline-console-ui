// Lista de herramientas con buscador y páginas, para que el diálogo de un
// agente no se estire con todo el catálogo. La fila la pinta quien la usa.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchBox, Pager } from './ListControls.jsx';
import { filterTools, pageOf } from '../lib/toolFilter.js';

export default function ToolBrowser({ tools, isSelected, renderItem, pageSize = 6, className = 'tool-list' }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [soloElegidas, setSoloElegidas] = useState(false);
  const [page, setPage] = useState(0);

  const filtradas = useMemo(() => {
    const porTexto = filterTools(tools, q);
    return soloElegidas && isSelected ? porTexto.filter(isSelected) : porTexto;
  }, [tools, q, soloElegidas, isSelected]);
  useEffect(() => { setPage(0); }, [q, soloElegidas]);
  const p = pageOf(filtradas, page, pageSize);
  const elegidas = isSelected ? tools.filter(isSelected).length : null;

  return (
    <div className="tool-browser">
      <div className="tool-browser-bar">
        <SearchBox value={q} onChange={setQ} placeholder={t('tools.search', 'Buscar herramienta…')} />
        {isSelected && (
          <label className="switch-inline">
            <input type="checkbox" checked={soloElegidas} onChange={(e) => setSoloElegidas(e.target.checked)} />
            {t('tools.onlySelected', 'Solo las elegidas ({{n}})', { n: elegidas })}
          </label>
        )}
      </div>
      {filtradas.length === 0
        ? <p className="field-hint">{t('tools.none', 'Ninguna herramienta coincide.')}</p>
        : <div className={className}>{p.items.map(renderItem)}</div>}
      <Pager p={p} size={pageSize} count={filtradas.length} onPage={setPage} />
    </div>
  );
}

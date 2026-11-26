// Buscador y paginador compactos para listas largas dentro de una sección o
// un diálogo (herramientas, modelos). El filtrado y las páginas los hace
// lib/toolFilter.js; esto solo pinta.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="tool-search">
      <Icon name="search" size={18} className="icon" />
      <input className="field-input" type="search" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/** `p` = resultado de pageOf; `count` = total filtrado. No se pinta con una sola página. */
export function Pager({ p, size, count, onPage }) {
  const { t } = useTranslation();
  if (p.total <= 1) return null;
  return (
    <div className="tbl-pagination tool-pager">
      <span className="tbl-range">
        {t('tools.range', '{{from}}–{{to}} de {{n}}', { from: p.page * size + 1, to: Math.min((p.page + 1) * size, count), n: count })}
      </span>
      <button type="button" className="icon-btn" disabled={p.page === 0} onClick={() => onPage(p.page - 1)} aria-label={t('tools.prev', 'Página anterior')}>
        <Icon name="chevronLeft" size={20} />
      </button>
      <span className="tbl-page">{p.page + 1} / {p.total}</span>
      <button type="button" className="icon-btn" disabled={p.page >= p.total - 1} onClick={() => onPage(p.page + 1)} aria-label={t('tools.next', 'Página siguiente')}>
        <Icon name="chevronRight" size={20} />
      </button>
    </div>
  );
}

// Uso contra cada límite: barra con su nivel (ok, cerca ≥ 80 %, pasado).
// La usan la sección «Plan y módulos» y la de «Uso» de la ficha.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLimitLabels } from '../hooks/useCatalog.js';

/** rows: [{ key, used, limit, level, own? }] */
export default function LimitBars({ rows }) {
  const { t } = useTranslation();
  const labels = useLimitLabels();
  return (
    <div className="usage-list">
      {rows.map(({ key, used, limit, level, own }) => (
        <div key={key} className={`usage-row ${level}`}>
          <div className="usage-label">
            {labels[key]}
            {own && <span className="module-src override">{t('sub.ownLimit', 'Propio')}</span>}
          </div>
          <div className="usage-value mono">
            {used.toLocaleString()} / {limit == null ? '∞' : limit.toLocaleString()}
          </div>
          {limit != null && (
            <div className="usage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={labels[key]}>
              <span style={{ width: `${Math.min(100, limit === 0 ? 100 : (used / limit) * 100)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Barras por día (mensajes de IA). SVG simple: no hace falta una librería de
// gráficas para una sola serie.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDay, fmtInt } from '../lib/fmt.js';

const ALTO = 120;

export default function DailyBars({ days, label, getValue = (d) => d.turns, format = fmtInt }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...days.map(getValue));
  const ancho = 100 / Math.max(days.length, 1);
  const primero = days[0];
  const ultimo = days[days.length - 1];
  return (
    <figure className="daily-bars">
      <svg viewBox={`0 0 100 ${ALTO}`} preserveAspectRatio="none" role="img" aria-label={label}>
        {days.map((d, i) => {
          const v = getValue(d);
          const h = v === 0 ? 0 : Math.max(2, (v / max) * (ALTO - 4));
          return (
            <rect key={d.date} x={i * ancho + ancho * 0.15} width={ancho * 0.7} y={ALTO - h} height={h} rx={0.6}>
              <title>{`${fmtDay(d.date)}: ${format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      {primero && (
        <figcaption className="daily-bars-axis">
          <span>{fmtDay(primero.date)}</span>
          <span>{t('usage.max', 'máx. {{v}} al día', { v: format(max) })}</span>
          <span>{fmtDay(ultimo.date)}</span>
        </figcaption>
      )}
    </figure>
  );
}

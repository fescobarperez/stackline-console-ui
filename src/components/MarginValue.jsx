// Margen en quetzales con su porcentaje; rojo si pierde, ámbar si es bajo.
import React from 'react';
import { marginLevel } from '../lib/usage.js';
import { fmtGtq, fmtPct } from '../lib/fmt.js';

export default function MarginValue({ gtq, pct }) {
  return (
    <span className={`margin-value ${marginLevel(gtq ?? 0, pct)}`}>
      {fmtGtq(gtq)}
      {pct != null && <span className="margin-pct">{fmtPct(pct)}</span>}
    </span>
  );
}

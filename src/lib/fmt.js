// Formato de fechas para la consola (zona y formato de Guatemala).
import i18n from 'i18next';

const loc = () => (i18n.language === 'en' ? 'en-US' : 'es-GT');

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(loc(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** «hoy», «hace 3 días», «hace 2 meses»… o «Nunca» si no hay fecha. */
export function fmtAgo(iso, now = Date.now()) {
  if (!iso) return i18n.t('common.never', 'Nunca');
  const d = Math.floor((now - new Date(iso).getTime()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
  if (d < 1) return rtf.format(0, 'day');
  if (d < 30) return rtf.format(-d, 'day');
  if (d < 365) return rtf.format(-Math.floor(d / 30), 'month');
  return rtf.format(-Math.floor(d / 365), 'year');
}

/** Quetzales: «Q 1,200.00». */
export function fmtGtq(n) {
  if (n == null) return '—';
  return `Q ${Number(n).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Dólares: con 4 decimales bajo un dólar (los costos de IA son centavos). */
export function fmtUsd(n) {
  if (n == null) return '—';
  const d = Math.abs(n) < 1 && n !== 0 ? 4 : 2;
  return `US$ ${Number(n).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString(loc()));

export const fmtPct = (n) => (n == null ? '—' : `${Number(n).toLocaleString(loc(), { maximumFractionDigits: 1 })} %`);

/** «octubre de 2026» a partir de 'YYYY-MM'. */
export function fmtMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(loc(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** «14 oct» a partir de 'YYYY-MM-DD'. */
export function fmtDay(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(loc(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

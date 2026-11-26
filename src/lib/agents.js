// Ayudas para los agentes de una empresa.

/** Nombre legible de un canal: el del ERP, un número de WhatsApp, un widget web o una cuenta. */
export function channelLabel(c, t) {
  if (c.kind === 'erp') return t('ta.erpChannel', 'Asistente en el ERP');
  // name = «número visible · nombre verificado»; en las etiquetas basta el número.
  if (c.kind === 'whatsapp') return `WhatsApp · ${c.name?.split(' · ')[0] || c.accountRef.replace(/^wa:/, '')}`;
  if (c.kind === 'web') return `${t('web.channel', 'Web')} · ${c.name || c.accountRef.replace(/^web:/, '')}`;
  if (c.kind === 'planner') return `${t('pln.channel', 'Planificador')} · ${c.name || c.accountRef.replace(/^planner:/, '')}`;
  return `${c.kind} · ${c.accountRef}`;
}

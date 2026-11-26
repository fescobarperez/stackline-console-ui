// Catálogo de módulos y lista de planes. Los módulos no cambian en tiempo de
// ejecución: se piden una vez por sesión. Los planes se recargan a pedido.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listModules, listPlans } from '../api/platform.js';

let modulosPromesa = null;

export function useModules() {
  const [modules, setModules] = useState([]);
  useEffect(() => {
    let vivo = true;
    modulosPromesa = modulosPromesa || listModules().catch((e) => { modulosPromesa = null; throw e; });
    modulosPromesa.then((m) => { if (vivo) setModules(m); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return modules;
}

/** Solo para tests: olvida el catálogo cacheado. */
export function _resetModulesCache() { modulosPromesa = null; }

export function usePlans() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => listPlans().then(setPlans).catch(setError), []);
  useEffect(() => { reload(); }, [reload]);
  return { plans, error, reload };
}

/** Etiquetas de los límites. */
export function useLimitLabels() {
  const { t } = useTranslation();
  return {
    maxUsers: t('limits.maxUsers', 'Usuarios activos'),
    maxBranches: t('limits.maxBranches', 'Sucursales'),
    maxFelPerMonth: t('limits.maxFelPerMonth', 'Documentos FEL al mes'),
    maxAiMessagesPerMonth: t('limits.maxAiMessagesPerMonth', 'Mensajes de IA al mes'),
  };
}

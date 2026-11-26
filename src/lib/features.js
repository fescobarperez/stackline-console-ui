// Partes de la consola según el backend que ya existe en stack-line-services.
//
// - IA_MODELOS: «Modelos y agentes» (/api/platform/ai/*, que el ERP reenvía a
//   /v1/admin/ai de agents-services con AGENT_KEY_PLATFORM).
// - IA_EMPRESA: la sección «Agentes de IA» de la ficha de cada empresa
//   (/api/platform/companies/{id}/agents*, reenviado a /v1/admin/tenants/{id}).
// - USO: «Uso y costos» (/api/platform/usage*: el ERP junta FEL, usuarios,
//   ingreso y margen con el consumo de IA de /v1/admin/usage de agents-services).
//
// Lo apagado se ve en el menú como «Próximamente» y no entra en la ficha.
export const IA_MODELOS = true;
export const IA_EMPRESA = true;
export const USO = true;

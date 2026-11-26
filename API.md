# API de plataforma — contrato

La implementa **stack-line-services** bajo `/api/platform/*`. Esta consola es
su único cliente: cualquier cambio aquí se refleja en los dos lados.

Estado del backend: **operadores, empresas, planes/módulos, IA global
(proveedores, modelos, identidad de Tino, tipos de agente) y agentes de cada
empresa implementados**. Uso y costos está definido pero sin implementar; la
consola lo tiene apagado (`src/lib/features.js`).
`usage.aiMessagesThisMonth` llega `null` y el límite de mensajes de IA aún no
se aplica.

## Reglas generales

- JSON en ambos sentidos. Fechas en ISO-8601 (`2026-10-15T04:21:00Z`).
- Autenticación: `Authorization: Bearer <token>` en todo salvo el login.
- El token de operador lleva el atributo `kind=platform` y no lleva `companyId`.
  Un token de empresa (`/api/auth`) o de servicio **no** sirve aquí, y uno de
  operador no sirve en `/api/*` de la app: `403` con `code: WRONG_AUDIENCE`
  (`PlatformAudienceFilter` en stack-line-services).
- Errores: código HTTP + `{ "message": "texto para mostrar", "code": "CODIGO" }`.
  - `400` validación (`code`: `VALIDATION`, con `fields: { campo: "mensaje" }`)
  - `401` sin sesión o token vencido → el front vuelve al login
  - `403` el rol del operador no permite la acción
  - `404` no existe
  - `409` conflicto (`CODE_TAKEN`, `NIT_TAKEN`, `INVALID_TRANSITION`)

## Operadores

Roles: `owner` (todo), `support` (ver y cambiar estado, no crear),
`viewer` (solo lectura).

### `POST /api/platform/auth/login`
```json
{ "email": "operador@stackline.gt", "password": "…" }
```
→ `200`
```json
{ "token": "…", "operator": { "id": 1, "name": "Fernando Escobar", "email": "…", "role": "owner" } }
```
`401` con `code: BAD_CREDENTIALS` si no coincide, si la cuenta está
deshabilitada o bloqueada. El correo se compara sin mayúsculas ni espacios.
Tras 5 contraseñas malas seguidas la cuenta se bloquea 15 minutos. El token
dura `erp.platform.token-expiration` (8 h por defecto).

El primer `owner` se crea al arrancar si no hay operadores, con
`PLATFORM_OWNER_EMAIL`, `PLATFORM_OWNER_NAME` y `PLATFORM_OWNER_PASSWORD`
(12 caracteres o más fuera de `dev`). En `dev` el valor por defecto es el
mismo de la API simulada.

### `GET /api/platform/auth/me`
→ `200` el mismo objeto `operator`, releído de la base: si el operador fue
deshabilitado, `401` aunque el token no haya vencido.

## Empresas

Estados y transiciones permitidas:

| Desde | Hacia |
|---|---|
| `trial` | `active`, `suspended`, `cancelled` |
| `active` | `suspended`, `cancelled` |
| `suspended` | `active`, `cancelled` |
| `cancelled` | — (final) |

`suspended` y `cancelled` bloquean el login de la empresa en la app, cortan
las sesiones abiertas (401 en el siguiente request, con un caché de 30 s por
nodo que se limpia al cambiar el estado) y apagan su agente (el ERP le niega el
token de servicio). `cancelled` no borra datos.

### `GET /api/platform/companies?q=&status=&plan=`
`q` busca en nombre, código y NIT. `status` filtra por estado. `plan` filtra
por código de plan.
→ `200`
```json
{
  "items": [{
    "id": 12, "code": "MADERAVIVA", "name": "Madera Viva", "nit": "1234567-8",
    "status": "active", "plan": { "id": 2, "code": "comercial", "name": "Comercial" },
    "usersCount": 6, "branchesCount": 2,
    "createdAt": "…", "lastActivityAt": "…"
  }],
  "total": 1,
  "counts": { "trial": 1, "active": 4, "suspended": 0, "cancelled": 0 }
}
```
`counts` son los totales por estado sin aplicar `status` (para los chips).

### `GET /api/platform/companies/check-code?code=XYZ`
→ `200 { "available": true }`. El código se normaliza a mayúsculas,
letras, números y guiones; 3 a 20 caracteres.

### `GET /api/platform/companies/{id}`
→ `200`
```json
{
  "id": 12, "code": "MADERAVIVA", "name": "Madera Viva", "nit": "1234567-8",
  "status": "active", "plan": { "id": 2, "code": "comercial", "name": "Comercial" }, "baseCurrency": "GTQ",
  "createdAt": "…", "lastActivityAt": "…",
  "establishments": [{ "id": 3, "satCode": 1, "commercialName": "Madera Viva", "address": "…", "phone": "…" }],
  "branches": [{ "id": 5, "name": "Central", "address": "…", "establishmentId": 3, "status": "active" }],
  "admins": [{ "id": 40, "name": "Ana López", "email": "…", "status": "active", "lastSeenAt": "…" }],
  "statusHistory": [{ "status": "active", "reason": "Alta", "by": "Fernando Escobar", "at": "…" }]
}
```
Un admin con `status: "invited"` todavía no activó su cuenta.

### `POST /api/platform/companies` (solo `owner`)
Aprovisiona todo en una transacción: empresa, establishment, sucursal, roles
base, usuario administrador (invitado), ajustes por defecto y secuencias.
```json
{
  "company":       { "code": "MADERAVIVA", "name": "Madera Viva", "nit": "1234567-8", "baseCurrency": "GTQ", "status": "trial", "planId": 2 },
  "establishment": { "satCode": 1, "commercialName": "Madera Viva", "address": "…", "phone": "…" },
  "branch":        { "name": "Central", "address": "…" },
  "admin":         { "name": "Ana López", "email": "ana@maderaviva.gt" }
}
```
`company.status` solo admite `trial` o `active`. `company.planId` es obligatorio y
debe ser un plan activo.
→ `201` el detalle de la empresa más
```json
{ "invitation": { "email": "ana@maderaviva.gt", "url": "https://…/activar?t=…", "expiresAt": "…" } }
```
La URL de activación se muestra **una sola vez**: la consola la ofrece para
copiar. Con ella el admin define su contraseña. Vence en 72 h; la base guarda
solo el SHA-256 del token. La base es `PLATFORM_ACTIVATION_URL`
(p. ej. `https://<app>/activar`).

El admin queda `invited` (sin contraseña, no puede iniciar sesión) hasta que
activa. Lo hace en la app (maya-ui, `/activar?t=…`), sin sesión:

- `GET /api/auth/activation?t=…` → `{ name, email, companyName, companyCode }`
- `POST /api/auth/activation` `{ token, password }` → lo mismo; deja al usuario
  `active`. Contraseña: 8+ caracteres con letras y números (`400 VALIDATION`).
- Enlace inexistente, vencido, usado o reemplazado → `410 INVITATION_INVALID`
  (un solo mensaje para todos). Empresa suspendida → `410 COMPANY_DISABLED`.

### `PATCH /api/platform/companies/{id}` (solo `owner`)
Cualquier subconjunto de `{ name, nit, baseCurrency }`. El código no cambia.
→ `200` el detalle actualizado.

### `POST /api/platform/companies/{id}/status` (`owner`, `support`)
```json
{ "status": "suspended", "reason": "Falta de pago" }
```
`reason` obligatorio para `suspended` y `cancelled`.
→ `200` el detalle actualizado. `409 INVALID_TRANSITION` si no se permite.

### `POST /api/platform/companies/{id}/admins/{userId}/invitation` (solo `owner`)
Genera una nueva URL de activación (invalida la anterior). Solo para admins
`invited`.
→ `200 { "email": "…", "url": "…", "expiresAt": "…" }`

## Planes y módulos

### Módulos

Catálogo fijo: lo define el backend, la consola solo lo lee. Cada módulo
habilita un grupo de pantallas del ERP y los endpoints que las sirven; el
backend responde `403 MODULE_NOT_ENABLED` a una empresa que llama un
endpoint de un módulo que no tiene.

| Código | Módulo | Pantallas del ERP |
|---|---|---|
| `base` | Base (siempre incluido) | Dashboard, Clientes, Productos y stock, Unidades, Reportería, Mantenimientos, Usuarios y roles, Auditoría, Configuración |
| `pos` | Punto de venta | POS, Caja y cortes, Devoluciones |
| `fel` | Facturación FEL | Facturación, FEL · SAT |
| `inventory_plus` | Inventario avanzado | Variantes, Conteo físico, Transferencias, Materia prima |
| `purchases` | Compras | Compras y OCs, Cuentas por pagar |
| `quotes` | Cotizaciones y proyectos | Cotizaciones, Proyectos |
| `commercial` | Comercial | Promociones, Fidelización, Cuentas por cobrar |
| `accounting` | Contabilidad | Contabilidad, Centros de costo, Presupuestos, Mayor, Estados financieros, Bancos, Conciliación, Activos fijos |
| `payroll` | Planilla | Planilla |
| `ai` | Asistente de IA | Tino en el ERP y en WhatsApp |

#### `GET /api/platform/modules`
→ `200 [{ "code": "pos", "name": "Punto de venta", "description": "…", "alwaysOn": false }]`

### Límites

`maxUsers` (usuarios activos), `maxBranches` (sucursales activas),
`maxFelPerMonth` (documentos FEL emitidos en el mes calendario) y
`maxAiMessagesPerMonth` (mensajes del asistente en el mes). `null` = ilimitado.
El ERP rechaza crear (o reactivar) un usuario o una sucursal, o certificar un
FEL, por encima del límite con `409 LIMIT_REACHED`
(`{ "code": "LIMIT_REACHED", "limit": "maxUsers", "value": 5, "message": "…" }`).
FEL cuenta los certificados desde el día 1 del mes en hora de Guatemala.

**Cumplimiento de módulos.** El login de la app devuelve `enabledModules`; la
app oculta lo demás. Cada request de una empresa (usuario o agente) a una ruta
de un módulo que no tiene responde `403 MODULE_NOT_ENABLED`. El mapa de rutas
vive en `ModuleCatalog.java` (y el de pantallas en `maya-ui/src/lib/modules.js`);
ventas, pagos, proveedores y existencias son de `base` porque los usan varios
módulos. Al guardar un plan o una suscripción se limpia el caché (30 s).

Las empresas que existían antes de los planes quedaron en `completo`; una
empresa sin suscripción (p. ej. la del seed de desarrollo) recibe `completo`
la primera vez que se consulta.

### Planes

```json
{
  "id": 2, "code": "comercial", "name": "Comercial", "description": "…", "price": 1200,
  "modules": ["base", "pos", "fel", "inventory_plus", "purchases", "quotes", "commercial"],
  "limits": { "maxUsers": 15, "maxBranches": 3, "maxFelPerMonth": 3000, "maxAiMessagesPerMonth": null },
  "active": true, "companiesCount": 2
}
```
`modules` siempre incluye `base`. Un plan inactivo no se ofrece para empresas
nuevas, pero las que ya lo tienen lo conservan. `price`: quetzales al mes,
`≥ 0`, hasta 2 decimales (`NUMERIC(12,2)`). Como todo el dinero, solo lo ve
`owner`: a los demás roles les llega `null`.

#### `GET /api/platform/plans`
→ `200` lista de planes (activos e inactivos), ordenados por nombre.

#### `POST /api/platform/plans` (solo `owner`)
`{ code, name, description, price, modules, limits }` → `201` el plan. `price` es obligatorio.
`code`: minúsculas, números y guion bajo; único (`409 CODE_TAKEN`).

#### `PATCH /api/platform/plans/{id}` (solo `owner`)
Cualquier subconjunto de `{ name, description, price, modules, limits, active }`.
El código no cambia. Cambiar módulos o límites afecta en el acto a todas las
empresas del plan (salvo sus excepciones).
→ `200` el plan.

### Plan de una empresa

#### `GET /api/platform/companies/{id}/subscription`
```json
{
  "plan": { "id": 2, "code": "comercial", "name": "Comercial" },
  "overrides": { "enabled": ["ai"], "disabled": ["commercial"] },
  "limitOverrides": { "maxUsers": 20 },
  "priceOverride": 1000,
  "effective": {
    "price": 1000,
    "modules": ["base", "pos", "fel", "inventory_plus", "purchases", "quotes", "ai"],
    "limits": { "maxUsers": 20, "maxBranches": 3, "maxFelPerMonth": 3000, "maxAiMessagesPerMonth": null }
  },
  "usage": { "users": 8, "branches": 2, "felThisMonth": 412, "aiMessagesThisMonth": 96 }
}
```
Reglas (las mismas de `src/lib/plans.js`):
`effective.modules = base ∪ (plan ∪ enabled) − disabled`;
`effective.limits[k] = limitOverrides[k] ?? plan.limits[k]`;
`effective.price = priceOverride ?? plan.price` (precio pactado con la empresa).

#### `PUT /api/platform/companies/{id}/subscription` (solo `owner`)
```json
{ "planId": 2, "overrides": { "enabled": ["ai"], "disabled": [] }, "limitOverrides": { "maxUsers": 20 }, "priceOverride": null }
```
Reemplaza todo. El backend normaliza las excepciones (solo activa lo que el
plan no trae, solo quita lo que sí trae, nunca `base`). Bajar un límite por
debajo del uso actual se permite: lo ya creado se conserva y solo se bloquea lo
nuevo.
→ `200` el mismo objeto que el `GET`.

## Uso y costos

Dinero (`priceGtq`, `revenueGtq`, `costUsd`, `costGtq`, `marginGtq`,
`marginPct`): solo `owner`; para `support` y `viewer` esas llaves vienen en
`null` y el resto (consumo, límites, alertas) igual.

Reglas (las mismas de `src/lib/usage.js`):

- **Mensaje de IA** (lo que cuenta contra `maxAiMessagesPerMonth`): un turno
  del cliente que el agente respondió (`agent_turns` completados). Las llamadas
  internas al modelo (respaldo, resúmenes) cuestan pero no cuentan.
- **Costo de una llamada (USD)**, congelado al registrarla en `agent_runs.cost_usd`
  con los precios vigentes de `ai_models`:
  `((tokens_in − tokens_cached) × input_cost_1k + tokens_cached × cached_cost_1k + tokens_out × output_cost_1k) / 1000`.
  `tokens_in` incluye los cacheados (así lo reporta el proveedor).
- **Límite** (`maxAiMessagesPerMonth`): agents-services lo lee del ERP
  (`GET /api/company/ai-limit`, cacheado 5 min) y, al agotarse, responde un aviso
  fijo sin llamar al modelo («te atiende un asesor»; en el asistente del ERP, el
  motivo). Ese turno queda `escalated` (`AI_LIMIT`): no cuesta ni cuenta. El texto
  al cliente es `mensajes.limite_ia` del playbook. Si el ERP no responde, no se corta.
- **Imágenes de ejemplo (renders)**: cada una cuesta `ai_models.image_cost` del
  modelo de imágenes, congelado en `render_jobs.cost_usd` al terminar (las
  fallidas no se cuentan). No cuentan como mensaje de IA.
- **Lectura de fotos**: una llamada aparte al modelo con la imagen; se registra
  en `agent_runs` con `kind = vision` y su costo por tokens como cualquier llamada.
- **Costo directo** de la empresa en el mes = suma de sus llamadas (respuestas,
  resúmenes y lectura de fotos) + imágenes de ejemplo + plantillas de WhatsApp
  (cuando existan).
- **Ingreso estimado** = `effective.price` si la empresa estaba `active` al cierre
  del mes (o hoy, si está en curso); prueba, suspendida o cancelada = 0. Cuando
  exista facturación (fase 7), se reemplaza por lo facturado.
- **Margen** = ingreso − costo × `fx.usdToGtq` (`PLATFORM_FX_USD_GTQ`);
  `marginPct` es `null` sin ingreso.
- **Mes**: `YYYY-MM` en hora de Guatemala (UTC−6). Por defecto el actual
  (`partial: true`). Mes inválido o futuro → `400 VALIDATION`.
- **Alertas**: límites con `level` `near` (≥ 80 %) u `over` (> 100 %).
  Usuarios y sucursales solo se reportan en el mes en curso (son una foto).

#### `GET /api/platform/usage?month=2026-10`
```json
{
  "month": "2026-10", "partial": true, "fx": { "usdToGtq": 7.75 },
  "totals": { "companies": 5, "aiTurns": 336, "felCount": 1257,
              "revenueGtq": 1000, "costUsd": 4.44, "costGtq": 34.43, "marginGtq": 965.57, "marginPct": 96.6 },
  "items": [{
    "company": { "id": 2, "code": "MADERAVIVA", "name": "Madera Viva", "status": "active" },
    "plan": { "id": 2, "code": "comercial", "name": "Comercial" },
    "priceGtq": 1000, "revenueGtq": 1000, "costUsd": 1.27, "costGtq": 9.82, "marginGtq": 990.18, "marginPct": 99,
    "aiTurns": 96, "felCount": 412,
    "limits": [{ "key": "maxAiMessagesPerMonth", "used": 96, "limit": 120, "level": "near" }]
  }]
}
```
`company.status` es el estado al cierre del mes. Entran las empresas que
existían ese mes, salvo las canceladas sin consumo ni ingreso.

#### `GET /api/platform/companies/{id}/usage?month=2026-10`
```json
{
  "month": "2026-10", "partial": true, "fx": { "usdToGtq": 7.75 }, "status": "active",
  "priceGtq": 1000, "priceSource": "override", "revenueGtq": 1000,
  "costUsd": 1.27, "costGtq": 9.82, "marginGtq": 990.18, "marginPct": 99,
  "ai": {
    "turns": 96, "calls": 114, "tokensIn": 526400, "tokensCached": 249600, "tokensOut": 39760, "costUsd": 1.37,
    "images": { "count": 2, "costUsd": 0.084 },
    "byModel":   [{ "model": "gpt-4o", "provider": "openai", "calls": 97, "tokensIn": 489200, "tokensCached": 241800, "tokensOut": 35980, "costUsd": 1.28 },
                  { "model": "gpt-image-1", "provider": "openai", "calls": 2, "images": 2, "tokensIn": 0, "tokensCached": 0, "tokensOut": 0, "costUsd": 0.084 }],
    "byKind":    [{ "kind": "turn", "calls": 96, "costUsd": 1.26 }, { "kind": "summary", "calls": 12, "costUsd": 0.0048 },
                  { "kind": "vision", "calls": 4, "costUsd": 0.0204 }, { "kind": "image", "calls": 2, "costUsd": 0.084 }],
    "byChannel": [{ "channel": "erp", "turns": 29, "costUsd": 0.38 }, { "channel": "whatsapp", "turns": 67, "costUsd": 0.88 }]
  },
  "whatsapp": { "templates": 0, "costUsd": 0 },
  "fel": { "count": 412 },
  "daily": [{ "date": "2026-10-01", "turns": 6, "costUsd": 0.079 }],
  "limits": [{ "key": "maxUsers", "used": 8, "limit": 20, "level": "ok" }],
  "history": [{ "month": "2026-10", "aiTurns": 96, "felCount": 412, "revenueGtq": 1000, "costUsd": 1.27, "costGtq": 9.82, "marginGtq": 990.18, "marginPct": 99 }]
}
```
`history`: los últimos 6 meses en que la empresa existía, del más reciente al
más antiguo (ingreso con el precio de hoy: aún no hay historial de precios).
`byChannel`: cada llamada e imagen va al canal de su conversación (`erp`,
`whatsapp`, `web`, `api`), resúmenes incluidos. `kind`: `turn` | `summary` | `vision` (lectura de fotos) | `image`
(renders, de `render_jobs`). Una fila de `byModel` con `images` es un modelo de
imágenes: cobra por imagen, no por tokens.

**Dónde sale cada dato.** IA: agents-services (`GET /v1/admin/usage?month=` por
empresa y `GET /v1/admin/usage/tenants/{id}?month=&months=6` con el detalle,
diario e historial), que stack-line-services lee con `AGENT_KEY_PLATFORM`; sobre
`agent_runs` con `tenant_id`, `channel`, `kind` (`turn`/`summary`/`vision`) y
`cost_usd` (changeset 16; el histórico se costeó con los precios de ese día) y
`render_jobs.cost_usd`. Tipo de cambio: `PLATFORM_FX_USD_GTQ` (7.75 por defecto). FEL, usuarios y sucursales: el ERP
(`fel_documents` certificados en el mes, `users` activos sin los de sistema,
`branches` activas).

## IA: modelos, agentes y asistente por empresa

Vive en agents-services (`/v1/admin/ai/*`, llave `AGENT_KEY_PLATFORM` con el
scope `admin`); la consola llega por stack-line-services como
`/api/platform/ai/*` y `/api/platform/companies/{id}/ai*`. stack-line-services
aplica el rol y reenvía; el nombre del operador viaja en `X-Operator-Name`
(URL-encoded) para firmar las versiones de prompt. Sin la llave →
`503 AI_NOT_CONFIGURED`; llave rechazada → `502 AI_AUTH`. Cada escritura invalida el caché de
contexto del agente (`ExecutionContextResolver`) para ese tenant o para todos.

Roles: `owner` cambia todo; `support` solo edita el playbook; `viewer` lee.

**Secretos.** Ni las llaves de los proveedores ni los tokens de WhatsApp
viajan a la consola: solo `credentialRef` (nombre de la variable o del secreto)
y `credentialSet` / `tokenSet` (si está puesto).

Reglas (las mismas de `src/lib/ai.js`):

- Un agente de empresa responde ⇔ la empresa tiene el módulo `ai` ∧ está
  `active` o `trial` ∧ `policy.enabled` ∧ el agente está encendido y no archivado.
- Modelo, respaldo, modelo de imágenes y temperatura efectivos = los del agente
  de la empresa o, si los deja vacíos, los del tipo.
- Herramientas efectivas = las del tipo, o solo las que el agente de la empresa
  conserva (nunca otras).
- El modelo de imágenes del agente (`imageModelId`, opcional) es un modelo
  activo con `generatesImages`; sin él no hay renders aunque el playbook los
  pida. Leer fotos necesita que el modelo efectivo tenga `supportsVision`.
- Un agente con herramientas necesita un modelo con `supportsTools`. El
  respaldo, si hay, es otro modelo activo. `temperature` 0–1, `maxToolLoops`
  0–10, `responseTimeoutMs` 5 000–120 000.
- El `mode` de una herramienta (`read`/`write`) lo dicta el código del agente;
  la consola solo elige cuáles, `autoApprove` y `maxAmount` (Q) de las de escritura.
- Un modelo en uso (por un agente o una empresa) no se desactiva:
  `409 MODEL_IN_USE`. Cambiar precios no recalcula lo registrado.

#### `GET /api/platform/ai/catalog`
```json
{
  "providers": [{ "id": 1, "code": "openai", "name": "OpenAI", "credentialRef": "OPENAI_API_KEY", "credentialSet": true, "active": true }],
  "models": [{ "id": 1, "providerId": 1, "provider": { "id": 1, "code": "openai", "name": "OpenAI", "credentialSet": true },
               "modelName": "gpt-4o", "contextWindow": 128000,
               "inputCost1k": 0.0025, "cachedCost1k": 0.00125, "outputCost1k": 0.01,
               "supportsTools": true, "supportsCache": true, "supportsVision": true,
               "generatesImages": false, "imageCost": 0, "active": true,
               "usedBy": ["ventas"], "companiesCount": 0 }],
  "tools": [{ "name": "cotizaciones.issue", "mode": "write", "group": "cotizacion", "description": "Emite la cotización en el ERP" }]
}
```
`tools` es el catálogo del código (`ToolCatalog`), no de la base.

#### `POST /api/platform/ai/models` (solo `owner`)
`{ providerId, modelName, contextWindow, inputCost1k, cachedCost1k?, outputCost1k, supportsTools, supportsCache, supportsVision, generatesImages, imageCost }`
→ `201`. Nombre repetido en el proveedor → `409 MODEL_TAKEN`. Requiere la
columna nueva `ai_models.cached_cost_1k`. `imageCost` (USD por imagen, ≥ 0) es
obligatorio con `generatesImages`; columnas `ai_models.supports_vision` (07),
`image_cost` (09) y `generates_images` (11) de agents-services.

#### `PATCH /api/platform/ai/models/{id}` (solo `owner`)
Subconjunto de `{ contextWindow, inputCost1k, cachedCost1k, outputCost1k, supportsTools, supportsCache, supportsVision, generatesImages, imageCost, active }`.
Quitar `generatesImages` a un modelo que un agente usa para imágenes → `409 MODEL_IN_USE`.

#### `GET /api/platform/ai/agents`
```json
[{ "id": 1, "code": "ventas", "name": "Ventas (Tino)", "kind": "conversational", "description": "…",
   "modelId": 1, "fallbackModelId": 2, "imageModelId": 3, "temperature": 0.2, "maxToolLoops": 5, "responseTimeoutMs": 30000, "active": true,
   "prompt": { "id": 2, "version": 2, "createdBy": "Fernando Escobar", "createdAt": "…" },
   "tools": [{ "pattern": "cotizaciones.issue", "mode": "write", "autoApprove": false, "maxAmount": 25000 }],
   "companiesCount": 2 }]
```
`kind`: `conversational` (atiende canales) o `internal` (p. ej. el resumen).
Requiere columnas nuevas `ai_agents.name`, `kind`, `description`.

#### `PATCH /api/platform/ai/agents/{id}` (solo `owner`)
Subconjunto de `{ modelId, fallbackModelId, imageModelId, temperature, maxToolLoops, responseTimeoutMs, tools, active }`.
`imageModelId` es `ai_agents.image_model_id` (09); `null` = sin renders.
`tools` reemplaza la lista completa (`ai_agent_tools`).

#### `GET /api/platform/ai/agents/{id}/prompts`
Versiones de la más nueva a la más vieja: `[{ id, version, body, createdBy, createdAt, active }]`.

#### `POST /api/platform/ai/agents/{id}/prompts` (solo `owner`)
`{ body, activate = true }` (mínimo 20 caracteres) → `201` la versión nueva
(`ai_prompt_versions`), activa si `activate`.

#### `POST /api/platform/ai/agents/{id}/prompts/{promptId}/activate` (solo `owner`)
Vuelve a una versión anterior → `200` el agente.

### Tres capas del prompt

Cada turno junta, en este orden: **identidad de Tino** (global) → **rol del tipo
de agente** → **instrucciones del agente de la empresa** (prevalecen). Después
van el playbook del agente, los datos del hilo y los mensajes.

#### Proveedores (solo `owner` escribe)
`POST /api/platform/ai/providers` `{ code, name, baseUrl, authType, credentialRef }` → `201`.
`code` debe estar en `catalog.providerCodes` (los que el código sabe llamar) y no
estar registrado. `authType`: `bearer` | `x-api-key`. `credentialRef` es el
**nombre** de la variable (`^[A-Z][A-Z0-9_]{2,119}$`), nunca la llave.
`PATCH /api/platform/ai/providers/{id}` subconjunto de `{ name, baseUrl, authType, credentialRef, active }`.
Desactivar uno cuyos modelos usa algún agente → `409 PROVIDER_IN_USE`.
`catalog.providers[]` trae además `baseUrl`, `authType` y `modelsCount`.

#### Identidad de Tino
`GET /api/platform/ai/identity` → `{ active: Version | null, versions: [Version] }`
(`Version` = `{ id, version, body, createdBy, createdAt, active }`).
`POST /api/platform/ai/identity` `{ body, activate = true }` (≥ 20 caracteres, `owner`) → `201` el `GET`.
`POST /api/platform/ai/identity/{promptId}/activate` (`owner`) → el `GET`.
Nace vacía: sin identidad el prompt empieza por el rol del tipo.

#### Tipos de agente
`GET /api/platform/ai/agents` trae además `archived` y `tenantAgentsCount`.
`POST /api/platform/ai/agents` (`owner`)
`{ code, name, kind, description?, prompt, modelId, fallbackModelId?, imageModelId?, temperature, maxToolLoops, responseTimeoutMs, tools }`
→ `201`. `code` `^[a-z][a-z0-9_]{1,59}$`, único; `kind` `conversational` | `internal`;
`prompt` es la v1 del rol (≥ 20). Mismas reglas que el `PATCH`.
`PATCH /api/platform/ai/agents/{id}` acepta además `name` y `description`.
`POST /api/platform/ai/agents/{id}/archive` | `/restore` (`owner`). No se archiva uno
con agentes de empresa (`409 TYPE_IN_USE`) ni uno del sistema (`resumen`, `409 TYPE_SYSTEM`).

## Agentes de la empresa

Solo operadores de plataforma (el ERP de la empresa no ve nada de esto). Vive en
agents-services (`/v1/admin/tenants/{id}`); stack-line-services comprueba que la
empresa exista y el rol. Roles: leer, cualquiera; ajustes, alta, edición y
archivo, `owner`; instrucciones y playbook, `owner` o `support`.

Un **agente de empresa** es una instancia de un tipo conversacional. Puede haber
varios, incluso del mismo tipo (p. ej. «Ventas WhatsApp» y «Ventas Web»). Lo nulo
hereda del tipo; las herramientas solo se pueden quitar (el tipo es el techo:
modo, tope y auto-aprobación son los del tipo). Un canal lo atiende un solo
agente a la vez. Archivar cierra sus canales; su historial se conserva.

#### `GET /api/platform/companies/{id}/agents`
```json
{
  "tenantId": 2,
  "policy": { "enabled": true, "quoteLimit": 25000, "escalationUser": "Ana López", "tone": "cercano", "locale": "es-GT" },
  "channels": [
    { "id": 10, "kind": "whatsapp", "accountRef": "wa:50244442020", "tenantAgentId": 5, "name": null },
    { "id": 20, "kind": "web", "accountRef": "web:wk_…", "tenantAgentId": 6, "name": "Tienda en línea" },
    { "id": null, "kind": "erp", "accountRef": "erp:2", "tenantAgentId": null, "name": null }
  ],
  "agents": [{
    "id": 5, "tenantId": 2, "agentId": 1, "agentCode": "ventas", "agentName": "Ventas (Tino)", "kind": "conversational",
    "name": "Ventas WhatsApp", "modelId": null, "fallbackModelId": null, "imageModelId": null, "temperature": null,
    "effective": { "modelId": 1, "fallbackModelId": 2, "imageModelId": 3, "temperature": 0.2,
                   "tools": [{ "pattern": "productos.search", "mode": "read", "autoApprove": true, "maxAmount": null }] },
    "tools": null,
    "instructions": { "id": 1, "version": 2, "body": "…", "createdBy": "…", "createdAt": "…", "active": true },
    "playbook": { "version": 3, "updatedAt": "…", "updatedBy": "…", "config": {} },
    "channelIds": [10], "active": true, "archived": false, "createdAt": "…"
  }],
  "webChannels": [{
    "id": 20, "name": "Tienda en línea", "publicKey": "wk_AbCd…", "allowedOrigins": ["https://www.maderaviva.gt"],
    "title": "Madera Viva", "greeting": "¡Hola! …", "color": "#2F5D3A", "active": true, "tenantAgentId": 6, "createdAt": "…"
  }],
  "widgetScriptUrl": "https://app.stackline.gt/v1/web/widget.js",
  "plannerWidgets": [{
    "id": 30, "name": "Planificador Madera Viva", "publicKey": "pk_AbCd…", "allowedOrigins": ["https://www.maderaviva.gt"],
    "title": null, "accentColor": "#8B6549", "lang": "es",
    "categoryIds": [2, 16],
    "projectTypes": [],
    "fitThresholdPct": 90, "retentionDays": 7, "maxOptions": 10, "contactWhatsapp": "50212345678",
    "active": true, "tenantAgentId": 7, "createdAt": "…"
  }],
  "plannerScriptUrl": "https://app.stackline.gt/v1/planner/embed.js",
  "catalogCategories": [
    { "id": 2, "name": "Pérgolas y Terrazas", "parentId": null },
    { "id": 16, "name": "Jardines", "parentId": null },
    { "id": 17, "name": "Juegos", "parentId": 16 }
  ]
}
```
`policy` es `agent_tenant_policies` (sin fila = apagado). El canal del ERP
(`erp:{id}`) siempre se ofrece; con `id: null` aún no existe y se crea al
asignarlo. `tools: null` = todas las del tipo. Sin playbook propio, `playbook`
trae el general del tipo con `version: 0`.

#### `PUT /api/platform/companies/{id}/agents/policy` (`owner`)
`{ enabled, quoteLimit, escalationUser, tone, locale }` → el `GET`.

#### `POST /api/platform/companies/{id}/agents` (`owner`)
`{ agentId, name, …lo del PATCH }` → `201` el `GET`. El tipo debe ser
conversacional, activo y no archivado; el nombre, único en la empresa.

#### `PATCH /api/platform/companies/{id}/agents/{agentId}` (`owner`)
Subconjunto de `{ name, modelId, fallbackModelId, imageModelId, temperature, tools, active, channelIds, includeErp }` → el `GET`.
`null` en modelos o temperatura = heredar. `tools: null` = todas las del tipo; una
lista = solo esas (fuera del tipo → `400`). `channelIds` reemplaza los canales del
agente (solo canales de la empresa); `includeErp: true` agrega el del ERP (lo crea
si falta). Lo efectivo se valida con las reglas de un agente.

#### `POST /api/platform/companies/{id}/agents/{agentId}/archive` (`owner`)
→ el `GET`.

#### Instrucciones (`owner`, `support`)
`GET …/agents/{agentId}/instructions` → `[Version]` (de la más nueva a la más vieja).
`POST …/agents/{agentId}/instructions` `{ body, activate = true }` (≥ 20) → `201` la lista.
`POST …/agents/{agentId}/instructions/{versionId}/activate` → la lista.
`POST …/agents/{agentId}/instructions/clear` → la lista (sin instrucciones activas).

#### `PUT /api/platform/companies/{id}/agents/{agentId}/playbook` (`owner`, `support`)
`{ config }` → el `GET`. Inserta una versión nueva del playbook de ese agente y
desactiva la anterior. Mismo `config` de siempre (ver reglas abajo).

Reglas del `config` del playbook (las valida la consola):
`limites.monto_maximo` > 0, `limites.lineas_maximas` entero > 0,
`limites.mostrar_precios` ∈ {`unitario`, `total`}, `cotizacion.cierre.inactividad_horas`
entero ≥ 0, claves de `datos_requeridos` únicas (`[a-z0-9_]`, nunca
`cliente`/`lineas`). Lo que la consola no edita (`mensajes`, `audiencias`) se conserva.
Fotos e imágenes (`imagenes`: WhatsApp, chat web y planificador): `aceptar`, `max_por_turno` (1–5),
`generar_renders` (requiere `aceptar`), `renders_max` (1–5; en el planificador, renders por diseño). Productos fuera del
catálogo (`cotizacion.productos_nuevos`): `permitido`, `lineas`, `mensaje_fuera_de_linea`.

#### Canal web (`owner`)
Un widget de chat que la empresa pega en su página. Cada uno es un canal
`web` (`account_ref = web:{publicKey}`) atendido por un agente de la empresa.
- `POST …/agents/web-channels` `{ name, allowedOrigins, title?, greeting?, color?, tenantAgentId? }` → `201` el `GET`.
- `PATCH …/agents/web-channels/{channelId}` subconjunto de lo anterior + `active` → el `GET`.
  `tenantAgentId: null` lo deja sin agente (no responde).

`allowedOrigins`: 1–10 orígenes `https://host[:puerto]`, o `https://*.dominio`
para sus subdominios (`http` solo en `localhost`). `color` `#RRGGBB`; `title`
≤ 60; `greeting` ≤ 300. `publicKey` (`wk_` + 24) no es secreta: va en el HTML.
`widgetScriptUrl` es nulo si falta `AGENT_PUBLIC_URL` en agents-services.

Código para la página: `<script src="{widgetScriptUrl}" data-key="{publicKey}" charset="utf-8" async></script>`
(opcional `data-position="left"`, `data-open="true"`, `data-lang="en"`).

Lo público (agents-services, `/v1/web`, Caddy lo publica): `GET /v1/web/widget.js`,
`GET /v1/web/{key}/config`, `POST /v1/web/{key}/messages`
(`{ session, id, text }` como `text/plain` para evitar el preflight →
`{ messages: [texto], choices: [{ id, label }] }`). Se valida el `Origin`
contra los dominios del widget (`403`) y hay límite por sesión, IP y widget
(`429` con `Retry-After`). Al visitante solo le llegan textos y opciones,
nunca las tarjetas del panel. Es anónimo: el agente pide nombre y teléfono
para cotizar (`cotizacion.cliente_nuevo` con `telefono`).

#### Planificador por presupuesto (`owner`)
Un bloque fijo que la empresa inserta en su página: el visitante indica su
presupuesto y arma opciones valoradas con precios del ERP (semáforo contra el
monto), conversa con un agente, pide renders y al final contacta a un asesor por
WhatsApp con su diseño escrito. **No crea cotización ni prospecto en el ERP.**
Cada uno es un canal `planner` (`account_ref = planner:{publicKey}`) atendido por
un agente de la empresa (o ninguno: entonces funciona sin chat).
- `POST …/agents/planner-widgets` `{ name, allowedOrigins, categoryIds?, projectTypes?, title?, accentColor?, lang?, fitThresholdPct?, retentionDays?, maxOptions?, contactWhatsapp?, tenantAgentId? }` → `201` el `GET`.
- `PATCH …/agents/planner-widgets/{channelId}` subconjunto de lo anterior + `active` → el `GET`.
  `tenantAgentId: null` lo deja sin agente; `contactWhatsapp: ""` quita el botón de contacto.

Reglas (las valida agents-services; la consola avisa antes):
- `categoryIds`: 0–12 ids de categorías del ERP de la empresa, sin repetir. El
  visitante elige una categoría y luego un producto de la lista (con foto y
  precio de referencia); cada categoría incluye sus subcategorías. Solo
  productos vendibles y activos; uno vendido por m² se cotiza por el área de sus
  medidas (largo × fondo). Una categoría que no existe → `400` en `categoryIds`.
- `projectTypes` (tipos fijos, opcional): 0–12 `{ code, label, productId }`. `code` `^[a-z][a-z0-9_]{0,39}$`, único;
  `label` 1–40; `productId` es el producto del ERP de la empresa (con plantilla de
  cálculo si se cotiza a la medida). Un producto que no existe → `400` en `projectTypes`.
- Hace falta al menos una categoría o un tipo (`400` en `categoryIds`). El ERP caído → `502 ERP_UNAVAILABLE`.
- `catalogCategories` (en el `GET`): las categorías del ERP de la empresa para
  elegir, en lista plana con `parentId`; `null` si el ERP no respondió.
- `allowedOrigins` como el canal web; `accentColor` `#RRGGBB`; `lang` `es` | `en`.
- `fitThresholdPct` 50–100 (hasta 2 decimales, por defecto 90): «justo» es pasar de ese % del presupuesto sin pasarse.
- `retentionDays` 1–90 (por defecto 7); `maxOptions` 1–26 (por defecto 10).
- `contactWhatsapp`: el WhatsApp del asesor, 8–15 dígitos con código de país (se aceptan `+`, espacios y guiones; se guardan solo los dígitos).
- Renders: los del **playbook del agente** asignado (`imagenes.generar_renders` y
  `imagenes.renders_max`, por diseño) y su modelo de imágenes; no hay campo propio.
- `publicKey` (`pk_` + 24) no es secreta: va en el HTML.

Código para la página: `<div id="planificador"></div><script src="{plannerScriptUrl}" data-key="{publicKey}" data-target="#planificador" data-lang="es" async></script>`.
`plannerScriptUrl` es nulo si falta `AGENT_PUBLIC_URL` en agents-services.

stack-line-services reenvía `…/agents/planner-widgets*` a agents-services
`/v1/admin/tenants/{id}/planner-widgets*`, igual que `web-channels`.

#### WhatsApp (`owner`)
Números de la cuenta de WhatsApp Business de Stackline (los que ve su token,
`WHATSAPP_ACCESS_TOKEN`), conectados por su `phone_number_id`:
- `GET …/agents/whatsapp/lookup?phoneNumberId=` → `{ phoneNumberId, displayPhoneNumber,
  verifiedName, qualityRating, codeVerificationStatus, status }` consultando a Meta.
  `status`: `available`, `connected` (ya es de esta empresa) o `in_use` (lo atiende otra).
  Meta no lo reconoce → `400` en `phoneNumberId`; sin token → `503 WA_NOT_CONFIGURED`.
- `POST …/agents/whatsapp-channels` `{ phoneNumberId, tenantAgentId? }` → `201` el `GET`.
  Crea (o recupera) el canal `wa:{id}` con `name` = «número · nombre verificado» y lo
  asigna al agente. Si lo atiende otra empresa → `409 WA_IN_USE`.
- `POST …/agents/whatsapp-channels/{channelId}/disconnect` → el `GET`. Deja de
  atenderse; se puede volver a conectar.

Los mensajes de un número nuevo llegan al mismo webhook si está en la misma
cuenta de WhatsApp Business ya suscrita a la app. El registro integrado de Meta
(cada cliente conecta su propio número) requiere que la app sea Tech Provider:
es una fase posterior (`WhatsAppDialog.jsx` queda para eso).

## Bitácora

Toda escritura (`POST`, `PATCH`) queda registrada con operador, empresa,
acción, antes/después y fecha. Se consulta en una fase posterior.

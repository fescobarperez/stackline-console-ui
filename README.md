# stackline-console-ui

Consola de plataforma de Stackline: la usan los operadores de Stackline (no
las empresas cliente) para dar de alta empresas, cambiar su estado y, en las
siguientes fases, configurar planes, módulos, agentes de IA y ver el uso.

- **API:** `stack-line-services`, bajo `/api/platform/*`. Contrato en
  [`API.md`](API.md).
- **Stack:** el mismo de `stack-line-ui` (React 18 + Vite + react-router +
  i18next + Vitest), con sus tokens, componentes base y diseño responsivo.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5174/console/ contra stack-line-services (localhost:8080)
npm test
npm run build
```

## Publicación

Se publica en una ruta del mismo dominio que la app: `https://stackline.com.gt/console`.
Se compila con esa base (`VITE_BASE_PATH`, por defecto `/console/`): los archivos y
las rutas del router cuelgan de ahí, y la API sigue en `/api/platform/*` del mismo
dominio (sin CORS).

En el servidor corre en su propio contenedor (`Dockerfile` + `Caddyfile` de este
repo) y la publica el Caddy de `stack-line-ui`, que reenvía `/console/*` sin quitar
el prefijo. El despliegue lo orquesta `deploy/` de `stack-line-services`
(`deploy.sh console`); los valores de Meta van como argumentos del build
(`CONSOLE_META_APP_ID`, `CONSOLE_META_CONFIG_ID` en `deploy/.env`).

La consola habla siempre con el backend real: en desarrollo Vite reenvía
`/api` a stack-line-services. Se entra con un operador de `platform_operators`.
`VITE_DEV_API_TARGET` cambia el backend del proxy (ver `.env.example`).

Lo que todavía no tiene backend se apaga en `src/lib/features.js`: el menú lo
muestra como «Próximamente» y la ficha de la empresa no lo incluye. Hoy:
Modelos y agentes, Agentes de IA de cada empresa y Uso y costos encendidos.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Operadores, empresas: listado, ficha, alta guiada, estados | Front y backend listos (falta compilar y probar contra la base) |
| 2 | Planes, módulos habilitados y límites | Front y backend listos, con cumplimiento en el ERP y maya-ui (falta compilar y probar contra la base) |
| 3 | IA: identidad de Tino, proveedores, modelos, tipos de agente y agentes de cada empresa (canales, instrucciones, playbook) | Front y backend listos (`/v1/admin/*` en agents-services + proxy en stack-line-services; falta compilar). Canal web (widget de chat) listo, sin compilar. Falta: conectar WhatsApp desde la consola |
| 4 | Uso y costos por empresa (consumo, costo directo, margen, alertas) | Front y backend listos (`/v1/admin/usage` en agents-services + `/api/platform/usage*` en stack-line-services; falta compilar) |
| 5 | Soporte, impersonación, facturación | Pendiente |

## Estructura

```
src/
  api/        client.js (HTTP + sesión), platform.js (contrato)
  components/ base copiada de stack-line-ui + Field, Modal, StatusDialog…
  lib/        companyStatus.js (estados), plans.js (módulos efectivos y límites), breakpoints, fmt
  modules/    Login, Companies, CompanyCreate, CompanyDetail, Plans
  styles/     global.css (tokens y base de stack-line-ui), console.css
```

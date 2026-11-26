# ── Compilación del estático ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /src

# Lo que se fija al compilar (todo público: va al navegador). La ruta debe
# coincidir con la del proxy que la publica (/console en el servidor).
ARG VITE_BASE_PATH=/console/
ARG VITE_META_APP_ID=
ARG VITE_META_CONFIG_ID=
ENV VITE_BASE_PATH=$VITE_BASE_PATH \
    VITE_META_APP_ID=$VITE_META_APP_ID \
    VITE_META_CONFIG_ID=$VITE_META_CONFIG_ID

# npm ci y no npm install: instala exactamente el lock, sin sorpresas de
# versión entre tu máquina y el servidor.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Servidor ──────────────────────────────────────────────────────────
# Caddy sirve el estático bajo /console. En el servidor va detrás del Caddy de
# stack-line-ui (mismo dominio que la app, que ya lleva /api al backend);
# publicada sola, hace también de proxy de /api/platform. En los dos casos el
# navegador ve un solo origen: sin CORS.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
EXPOSE 80 443

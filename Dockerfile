FROM node:22-bookworm-slim AS apibuild
WORKDIR /src
RUN npm init -y >/dev/null 2>&1 && npm install --no-save typescript@5.7.3 @types/node@22 >/dev/null 2>&1
COPY backend/appdeployCompatApi.mts ./backend/appdeployCompatApi.mts
COPY backend/appdeployShim.mjs ./backend/appdeployShim.mjs
RUN ./node_modules/.bin/tsc backend/appdeployCompatApi.mts \
  --target ES2022 \
  --module NodeNext \
  --moduleResolution NodeNext \
  --lib ES2022,DOM \
  --types node \
  --skipLibCheck \
  --outDir /out \
  --rootDir backend

FROM node:22-bookworm-slim AS webbuild
WORKDIR /src/web
COPY web/package.json ./
RUN npm install
COPY web ./
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY backend ./backend
COPY src/services ./src/services
COPY --from=apibuild /out/appdeployCompatApi.mjs ./backend/appdeployCompatApi.mjs
COPY --from=webbuild /src/web/dist ./web-dist

ENV NODE_ENV=production
CMD ["node", "backend/solyGatewayServer.mjs"]

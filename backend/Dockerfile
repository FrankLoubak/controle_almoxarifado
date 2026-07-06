# Dockerfile do backend — build multi-stage (prep de deploy, Sprint 10; finaliza no 11).
# Estágio 1: instala deps e gera o bundle (esbuild). Estágio 2: runtime enxuto.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
# Migrations são aplicadas por um job separado (node dist/db/migrate.js) antes do start.
EXPOSE 3000
CMD ["node", "dist/index.js"]

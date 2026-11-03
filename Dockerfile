# ---------- Build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
RUN npm ci --prefix apps/api && npm ci --prefix apps/web
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build --prefix apps/api && npm run build --prefix apps/web && npm prune --omit=dev --prefix apps/api

# ---------- Runtime ----------
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && useradd -r -u 10001 cim
ENV NODE_ENV=production
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /data/storage && chown -R cim /data
USER cim
WORKDIR /app/apps/api
ENV STORAGE_DIR=/data/storage PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

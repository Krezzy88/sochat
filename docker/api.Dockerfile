FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/parser/package.json packages/parser/package.json
COPY scripts/check-runtime.mjs scripts/check-runtime.mjs
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runtime
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node apps/api apps/api
COPY --chown=node:node packages/parser packages/parser
COPY --chown=node:node db/migrations db/migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node --experimental-strip-types apps/api/src/db/migrate.ts && exec node --experimental-strip-types apps/api/src/server.ts"]

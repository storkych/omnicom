# ---------- base ----------
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=development
# openssl is required by Prisma engines
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests for cached installs
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# ---------- deps ----------
FROM base AS deps
# Allow switching to a mirror on restricted networks, e.g.:
#   --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "$NPM_REGISTRY" \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm install --no-audit --no-fund

# ---------- dev ----------
# Used by docker-compose.dev.yml with source mounted as a volume.
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @omnicom/shared \
  && npx --workspace @omnicom/api prisma generate
EXPOSE 4000
CMD ["npm", "run", "start:dev", "--workspace", "@omnicom/api"]

# ---------- build (prod) ----------
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @omnicom/shared \
  && npx --workspace @omnicom/api prisma generate \
  && npm run build --workspace @omnicom/api

# ---------- prod runtime ----------
FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
# Sync the schema to the database, then start the server.
CMD ["sh", "-c", "npx --workspace @omnicom/api prisma db push --skip-generate --accept-data-loss && node apps/api/dist/main.js"]

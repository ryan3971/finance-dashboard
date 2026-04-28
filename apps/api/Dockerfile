FROM node:20-alpine AS base
# Use corepack so the pnpm version matches the one used in development
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Stage 1: install all dependencies ─────────────────────────────────────────
# Install dev + prod deps here so the content-addressable store is fully
# populated. The store is copied into the runner stage so pnpm can recreate
# production node_modules offline — no network access needed after this stage.
FROM base AS deps
WORKDIR /app
# Pin the store to a known path so it can be referenced by later stages
RUN pnpm config set store-dir /pnpm/store
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
RUN pnpm config set store-dir /pnpm/store
# Restore the store and virtual node_modules from the deps stage so builds
# don't re-download anything. COPY preserves symlinks between stages, and the
# store target paths remain valid because /pnpm/store exists here too.
COPY --from=deps /pnpm/store /pnpm/store
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
# Compile @finance/shared to CommonJS first.
# The API's compiled output contains require('@finance/shared/...') calls. In the
# runner, Node.js resolves these through packages/shared/package.json exports,
# which now point to dist/. Without this step the runner tries to load .ts files
# and crashes immediately.
RUN pnpm --filter @finance/shared build
# Compile the API
RUN pnpm --filter api build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production
RUN pnpm config set store-dir /pnpm/store

# Copy the fully-populated content-addressable store from deps so pnpm can
# install production dependencies without any network access.
COPY --from=deps /pnpm/store /pnpm/store

# Copy manifests and lockfile — pnpm needs these to know what to link
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Recreate node_modules for production only. pnpm reads the store we copied
# above and sets up the correct symlink structure — no symlinks are broken.
RUN pnpm install --prod --frozen-lockfile --offline

# Copy compiled @finance/shared output.
# pnpm symlinks node_modules/@finance/shared → packages/shared. Node.js then
# reads packages/shared/package.json exports (./dist/constants.js etc.) and
# finds the compiled JS files we copy here.
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Copy the compiled API
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Copy migration SQL files — drizzle-kit migrate reads these at deploy time.
# drizzle.config.ts sets out: './src/db/migrations', resolved from WORKDIR below.
COPY --from=build /app/apps/api/src/db/migrations ./apps/api/src/db/migrations

# Copy the drizzle config. drizzle-kit loads .ts config files via its internal
# esbuild bundler, so no pre-compilation of this file is required.
COPY apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts

# Run the API from its own directory so relative paths (drizzle config, dist/)
# resolve correctly, and so node_modules/.bin/drizzle-kit is on the PATH for
# the ECS migration task override.
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]

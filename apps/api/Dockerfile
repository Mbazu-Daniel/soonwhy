# SoonWhy API — monorepo build (context: repository root)
# build: docker build -f apps/api/Dockerfile .
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY apps/api ./apps/api
WORKDIR /app
RUN pnpm --filter @soonwhy/shared build && pnpm --filter @soonwhy/backend build
RUN pnpm --filter @soonwhy/backend deploy --prod /out/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

COPY --from=builder /out/api ./
RUN npm install -g pm2@latest
USER node
CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit push --force && exec pm2 start -s dist/main.js --name soonwhy-api -i 1 --no-daemon"]

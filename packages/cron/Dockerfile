FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY packages/cron ./packages/cron
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @soonwhy/shared build \
 && pnpm --filter @soonwhy/cron build
RUN pnpm --filter @soonwhy/cron deploy --legacy --prod /out/cron

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /out/cron ./
USER node
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY packages/ingest ./packages/ingest
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @soonwhy/shared build \
 && pnpm --filter @soonwhy/ingest build
RUN pnpm --filter @soonwhy/ingest deploy --legacy --prod /out/ingest

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV INGEST_PORT=3002
EXPOSE 3002

COPY --from=builder /out/ingest ./
USER node
CMD ["node", "dist/main.js"]

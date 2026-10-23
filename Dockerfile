FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

FROM base AS build

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY sdks ./sdks
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @soonwhy/shared build \
 && pnpm --filter @soonwhy/backend build \
 && pnpm --filter @soonwhy/ingest build \
 && pnpm --filter @soonwhy/cron build \
 && pnpm --filter @soonwhy/frontend build
RUN pnpm --filter @soonwhy/backend deploy --legacy /out/api \
 && pnpm --filter @soonwhy/ingest deploy --legacy --prod /out/ingest \
 && pnpm --filter @soonwhy/cron deploy --legacy --prod /out/cron \
 && pnpm --filter @soonwhy/frontend deploy --legacy /out/ui

FROM node:22-bookworm-slim AS api
WORKDIR /app
COPY --from=build /out/api ./
EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit push --force && node dist/main.js"]

FROM node:22-bookworm-slim AS ingest
WORKDIR /app
COPY --from=build /out/ingest ./
EXPOSE 3002
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim AS cron
WORKDIR /app
COPY --from=build /out/cron ./
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim AS ui
WORKDIR /app
COPY --from=build /out/ui ./
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["./node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "3000"]

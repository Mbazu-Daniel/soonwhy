FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.json ./tsconfig.json
RUN pnpm install --frozen-lockfile

FROM base AS api
RUN pnpm --filter @soonwhy/shared build && pnpm --filter @soonwhy/backend build
EXPOSE 3001
CMD ["pnpm", "--filter", "@soonwhy/backend", "start:prod"]

FROM base AS ingest
RUN pnpm --filter @soonwhy/shared build && pnpm --filter @soonwhy/ingest build
EXPOSE 3002
CMD ["pnpm", "--filter", "@soonwhy/ingest", "start:prod"]

FROM base AS cron
RUN pnpm --filter @soonwhy/shared build && pnpm --filter @soonwhy/cron build
CMD ["pnpm", "--filter", "@soonwhy/cron", "start:prod"]

FROM base AS ui
RUN pnpm --filter @soonwhy/frontend build
EXPOSE 3000
CMD ["pnpm", "--filter", "@soonwhy/frontend", "start"]

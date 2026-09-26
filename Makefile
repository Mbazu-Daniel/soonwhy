.PHONY: local local-build local-down local-logs local-api-logs \
        observability observability-build observability-down \
        observability-logs observability-api-logs observability-ingest-logs \
        observability-quickwit-logs observability-minio-logs \
        observability-postgres-logs observability-redis-logs \
        observability-api observability-api-build observability-api-down \
        observability-api-stack-logs logs

LOCAL_COMPOSE = docker compose -f docker-compose.local.yml
OBS_COMPOSE = docker compose -f docker-compose.observability.yml

# -------------------------
# Local development
# -------------------------

local:
	$(LOCAL_COMPOSE) up -d

local-build:
	$(LOCAL_COMPOSE) up -d --build

local-down:
	$(LOCAL_COMPOSE) down

local-logs:
	$(LOCAL_COMPOSE) logs -f

local-api-logs:
	$(LOCAL_COMPOSE) logs -f api

# -------------------------
# Full observability stack
# -------------------------

observability:
	$(OBS_COMPOSE) up -d

observability-build:
	$(OBS_COMPOSE) up -d --build

observability-down:
	$(OBS_COMPOSE) down

observability-logs:
	$(OBS_COMPOSE) logs -f

observability-api-logs:
	$(OBS_COMPOSE) logs -f api

observability-ingest-logs:
	$(OBS_COMPOSE) logs -f ingest

observability-quickwit-logs:
	$(OBS_COMPOSE) logs -f quickwit

observability-minio-logs:
	$(OBS_COMPOSE) logs -f minio

observability-postgres-logs:
	$(OBS_COMPOSE) logs -f postgres

observability-redis-logs:
	$(OBS_COMPOSE) logs -f redis

# -------------------------
# Observability API stack
# No UI
# No NATS
# -------------------------

observability-api:
	$(OBS_COMPOSE) up -d postgres redis minio minio-init quickwit api ingest cron

observability-api-build:
	$(OBS_COMPOSE) up -d --build postgres redis minio minio-init quickwit api ingest cron

observability-api-down:
	$(OBS_COMPOSE) stop postgres redis minio minio-init quickwit api ingest cron

observability-api-stack-logs:
	$(OBS_COMPOSE) logs -f postgres redis minio minio-init quickwit api ingest cron

# -------------------------
# Convenience
# -------------------------

logs:
	$(LOCAL_COMPOSE) logs -f api
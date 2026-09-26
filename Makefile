.PHONY: local local-build local-down local-logs local-api-logs \
        observability observability-build observability-down \
        observability-logs observability-api-logs observability-ingest-logs \
        observability-nats-logs observability-quickwit-logs \
        observability-minio-logs observability-postgres-logs \
        observability-redis-logs logs

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

observability-nats-logs:
	$(OBS_COMPOSE) logs -f nats

observability-quickwit-logs:
	$(OBS_COMPOSE) logs -f quickwit

observability-minio-logs:
	$(OBS_COMPOSE) logs -f minio

observability-postgres-logs:
	$(OBS_COMPOSE) logs -f postgres

observability-redis-logs:
	$(OBS_COMPOSE) logs -f redis

# -------------------------
# Convenience
# -------------------------

logs:
	$(LOCAL_COMPOSE) logs -f api
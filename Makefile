.PHONY: eval eval-all eval-overhead eval-replication eval-heldout eval-sweep eval-windows eval-report \
        local local-build local-down local-logs local-api-logs \
        observability observability-build observability-down \
        observability-logs observability-api-logs observability-ingest-logs \
        observability-quickwit-logs \
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
	$(OBS_COMPOSE) up -d postgres redis localstack quickwit api ingest

observability-api-build:
	$(OBS_COMPOSE) up -d --build postgres redis localstack quickwit api ingest

observability-api-down:
	$(OBS_COMPOSE) stop postgres redis localstack quickwit api ingest

observability-api-stack-logs:
	$(OBS_COMPOSE) logs -f postgres redis localstack quickwit api ingest

# -------------------------
# Convenience
# -------------------------

logs:
	$(LOCAL_COMPOSE) logs -f api

# -------------------------
# Evaluation harness (apps/api/eval). Run one at a time; results go to apps/api/eval/results
# -------------------------

EVAL_VITEST = npx vitest run --config eval/vitest.eval.config.ts

eval-overhead:
	@for rps in 20 40 80 160; do \
	  (cd apps/api && EVAL_RPS=$$rps EVAL_SECONDS=20 EVAL_ROUNDS=3 EVAL_OUT=A_overhead_rps$$rps \
	  $(EVAL_VITEST) eval/overhead.eval.ts) || exit 1; \
	done

eval-replication:
	cd apps/api && EVAL_TRACE_MODE=production EVAL_SEED_BASE=20000 EVAL_REPS=10 EVAL_NORMAL_RUNS=40 EVAL_OUT=C_reps10 $(EVAL_VITEST) eval/accuracy.eval.ts

eval-heldout:
	cd apps/api && EVAL_TRACE_MODE=production EVAL_SCENARIO_SET=heldout EVAL_SEED_BASE=5000 EVAL_REPS=5 EVAL_NORMAL_RUNS=0 EVAL_OUT=D_heldout $(EVAL_VITEST) eval/accuracy.eval.ts

eval-sweep:
	cd apps/api && EVAL_TRACE_MODE=production EVAL_SCENARIO_SET=sweep EVAL_SEED_BASE=9000 EVAL_REPS=5 EVAL_NORMAL_RUNS=0 EVAL_OUT=E_sweep $(EVAL_VITEST) eval/accuracy.eval.ts

eval-windows:
	@for cfg in "100 10" "50 10" "200 10" "100 5" "100 20"; do \
	  set -- $$cfg; \
	  (cd apps/api && EVAL_TRACE_MODE=production EVAL_BASELINE_WINDOW=$$1 EVAL_RECENT_WINDOW=$$2 EVAL_SEED_BASE=1000 \
	  EVAL_REPS=3 EVAL_NORMAL_RUNS=12 EVAL_OUT=F_b$$1_r$$2 \
	  $(EVAL_VITEST) eval/accuracy.eval.ts) || exit 1; \
	done

eval-report:
	cd apps/api/eval && python3 analyse.py C_reps10 D_heldout E_sweep F_b50_r10 F_b100_r10 F_b200_r10 F_b100_r5 F_b100_r20

eval-all:
	@$(MAKE) --no-print-directory eval-overhead
	@$(MAKE) --no-print-directory eval-replication
	@$(MAKE) --no-print-directory eval-heldout
	@$(MAKE) --no-print-directory eval-sweep
	@$(MAKE) --no-print-directory eval-windows
	@$(MAKE) --no-print-directory eval-report

eval: eval-all

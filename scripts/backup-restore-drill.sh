#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

dump_file="${BACKUP_DUMP_FILE:-./.tmp/soonwhy-restore-drill.dump}"
mkdir -p "$(dirname "$dump_file")"
cleanup() { rm -f "$dump_file"; }
trap cleanup EXIT

echo "Creating logical backup..."
pg_dump --format=custom --no-owner --no-privileges "$SOURCE_DATABASE_URL" > "$dump_file"
echo "Resetting isolated restore target..."
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SQL
echo "Restoring backup..."
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$dump_file"
echo "Verifying restored core tables..."
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 1 FROM organizations LIMIT 1;
SELECT 1 FROM projects LIMIT 1;
SELECT 1 FROM detection_runs LIMIT 1;
SELECT 1 FROM investigation_cases LIMIT 1;
SELECT 1 FROM usage_events LIMIT 1;
SELECT 1 FROM billing_events LIMIT 1;
SQL
echo "Backup/restore drill completed successfully."

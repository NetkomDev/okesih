#!/usr/bin/env bash
set -euo pipefail
# Deliberately removes guards ONLY in the disposable local test database, then restores them.
[[ "${TEST_DATABASE_URL:-}" == 'postgresql:///okesih_remediation_test' && "${PGHOST:-}" == /tmp/okesih-flow-pg.* ]] || { echo 'Disposable local audit database required' >&2; exit 1; }
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.transaction_items DROP COLUMN warkop_id CASCADE;
DROP FUNCTION public.assign_item_tenant() CASCADE;
DROP FUNCTION public.approve_device_pairing(uuid,uuid,text);
ALTER TABLE public.transactions DROP CONSTRAINT transaction_shift_tenant_fk;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_total_nonnegative;
ALTER TABLE public.menus DROP CONSTRAINT menus_price_nonnegative;
ALTER TABLE public.transaction_items DROP CONSTRAINT items_values_valid;
SQL
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/42_flow_integrity_reconciliation.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/remediation-assertions.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/flow-payment-assertions.sql

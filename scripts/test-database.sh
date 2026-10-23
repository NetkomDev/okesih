#!/usr/bin/env bash
set -euo pipefail
# Only use a disposable database. Never point this runner at production.
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a disposable PostgreSQL database named okesih_remediation_test}"
case "$TEST_DATABASE_URL" in
  */okesih_remediation_test) ;;
  *) echo 'Refusing a database not named okesih_remediation_test' >&2; exit 1 ;;
esac
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/supabase-test.sql
for migration in supabase/migrations/*.sql; do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/remediation-assertions.sql

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/kormit-assertions.sql

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/directory-assertions.sql

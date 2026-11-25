#!/bin/bash
# Roda o schema do Supabase num PostgreSQL local e testa as regras de acesso.
set -e
DB=aulaviva_test
cd "$(dirname "$0")/../.."
su postgres -c "dropdb --if-exists $DB && createdb $DB"
P() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB $*"; }
cat > /tmp/assert.sql <<'S'
create or replace function public.assert_true(ok boolean, msg text) returns text language plpgsql as $$
begin if not ok then raise exception 'FALHA: %', msg; end if; raise notice 'PASS %', msg; return 'ok'; end $$;
S
P -f tests/sql/supabase-stub.sql
P -f /tmp/assert.sql
P -f supabase/schema.sql
P -f supabase/schema.sql   # idempotente: rodar duas vezes não pode falhar
P -f tests/sql/rls-test.sql 2>&1 | grep -E "PASS|FALHA|ERRO|ERROR|resultado|TODOS"

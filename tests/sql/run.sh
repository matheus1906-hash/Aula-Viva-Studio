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
su postgres -c "psql -q -d $DB -c 'create extension if not exists pgcrypto'"
# roda duas vezes como "dono" (sem superusuário, igual ao Supabase): a segunda prova que é idempotente
for i in 1 2; do su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -c 'set role dono' -f supabase/schema.sql" 2>&1 | { grep -v "NOTICE" || true; }; done
# a trava (event trigger) exige privilégio maior num PostgreSQL comum; no Supabase o próprio script a cria
awk '/trava do RLS/{f=1} f' supabase/schema.sql > /tmp/trava.sql
P -f /tmp/trava.sql
su postgres -c "psql -q -d $DB -c 'grant all on all tables in schema public to service_role'"
P -f tests/sql/rls-test.sql 2>&1 | grep -E "PASS|FALHA|ERRO|ERROR|resultado|TODOS"

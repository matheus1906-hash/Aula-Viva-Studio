-- Simulação mínima do Supabase para testar supabase/schema.sql num PostgreSQL comum.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  -- service_role do Supabase tem BYPASSRLS; o dono do banco ("dono", como o postgres do Supabase) NÃO é superusuário
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'dono') then create role dono login createrole; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text);
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;

grant usage on schema auth to dono, service_role;
grant select, references on auth.users to dono;
grant select on auth.mfa_factors to dono;
grant create on schema public to dono;
grant usage on schema public to service_role;

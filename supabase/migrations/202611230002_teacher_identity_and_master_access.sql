-- Dados profissionais e controle de acesso: execução após 202611230001.
-- Privilégios não derivam de e-mail, metadata de cadastro ou valores fornecidos pelo cliente.
create table if not exists public.av_teacher_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 legal_name text not null check (char_length(trim(legal_name)) between 3 and 160),
 institution_name text not null check (char_length(trim(institution_name)) between 3 and 180),
 institution_city text not null check (char_length(trim(institution_city)) between 2 and 100),
 institution_state text not null check (char_length(institution_state)=2),
 institution_type text not null check (institution_type in ('public','private','other')),
 professional_role text not null check (professional_role in ('teacher','coordinator','director','other')),
 institution_identifier text,
 verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
 terms_accepted_at timestamptz,
 privacy_notice_version text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
-- No CPF, personal ID, phone or student data are collected by default.
-- institution_identifier is optional: validate CNPJ or other authoritative registry on server
-- before setting verification_status=verified. Free text alone does not prove affiliation.
create table if not exists public.av_admin_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('master','admin')),
 granted_at timestamptz not null default now(),
 granted_by uuid references auth.users(id),
 reason text not null default 'manual provisioning'
);
create table if not exists public.av_signin_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 happened_at timestamptz not null default now(),
 event_type text not null check(event_type in ('password_login','token_refresh')),
 client_category text not null default 'web',
 event_source text not null default 'vercel'
);
create index if not exists av_signin_events_user_time_idx on public.av_signin_events(user_id,happened_at desc);
alter table public.av_teacher_profiles enable row level security;
alter table public.av_admin_roles enable row level security;
alter table public.av_signin_events enable row level security;
revoke all on public.av_teacher_profiles,public.av_admin_roles,public.av_signin_events from anon,authenticated;
-- Only service_role can read or write these tables. All requests still need server-side
-- verification of the real session and authorization. Supabase service role bypasses RLS.
grant select,insert,update on public.av_teacher_profiles to service_role;
grant select,insert,update,delete on public.av_admin_roles to service_role;
grant select,insert on public.av_signin_events to service_role;
grant usage,select on sequence public.av_signin_events_id_seq to service_role;

-- Access status: role is checked solely in the private authorization table.
create or replace function public.av_access_status(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; t public.av_teacher_profiles%rowtype;
begin
 select role into r from public.av_admin_roles where user_id=p_user_id;
 select * into t from public.av_teacher_profiles where user_id=p_user_id;
 return jsonb_build_object(
 'role',coalesce(r,'teacher'),
 'onboardingCompleted',r is not null or (t.user_id is not null and t.terms_accepted_at is not null),
 'institutionVerification',case when r is not null then null else coalesce(t.verification_status,'missing') end
 );
end; $$;
revoke all on function public.av_access_status(uuid) from public,anon,authenticated;
grant execute on function public.av_access_status(uuid) to service_role;

create or replace function public.av_record_signin(p_user_id uuid,p_event_type text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_event_type not in ('password_login','token_refresh') then
  raise exception 'invalid event type';
 end if;
 insert into public.av_signin_events(user_id,event_type) values(p_user_id,p_event_type);
end; $$;
revoke all on function public.av_record_signin(uuid,text) from public,anon,authenticated;
grant execute on function public.av_record_signin(uuid,text) to service_role;

-- AulaViva Studio: trial individual e franquia semanal. Aplicar no Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.av_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 trial_started_at timestamptz not null default now(),
 trial_ends_at timestamptz not null default (now()+interval '12 months'),
 plan_code text not null default 'free' check(plan_code in ('free')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.av_ai_usage (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 idempotency_key text not null,
 week_start date not null,
 state text not null default 'reserved' check(state in ('reserved','completed','released')),
 reserved_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '15 minutes'),
 completed_at timestamptz,
 unique(user_id,idempotency_key)
);
create index if not exists av_ai_usage_user_week_idx on public.av_ai_usage(user_id,week_start,state);
create or replace function public.av_create_profile()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.av_profiles(user_id,display_name)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''))
 on conflict(user_id) do nothing;
 return new;
end; $$;
drop trigger if exists av_on_auth_user_created on auth.users;
create trigger av_on_auth_user_created after insert on auth.users for each row execute procedure public.av_create_profile();

create or replace function public.av_account_status(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.av_profiles%rowtype; v_week date; v_used integer; v_trial boolean;
begin
 select * into p from public.av_profiles where user_id=p_user_id;
 if not found then
  insert into public.av_profiles(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select * into p from public.av_profiles where user_id=p_user_id;
 end if;
 v_week:=date_trunc('week',now() at time zone 'utc')::date;
 select count(*)::integer into v_used from public.av_ai_usage where user_id=p_user_id and week_start=v_week
 and reserved_at>=p.trial_ends_at and reserved_at>=p.trial_ends_at and (state='completed' or (state='reserved' and expires_at>now()));
 v_trial:=now()<p.trial_ends_at;
 return jsonb_build_object('userId',p_user_id,'plan',case when v_trial then 'welcome' else 'free' end,
 'trialStartedAt',p.trial_started_at,'trialEndsAt',p.trial_ends_at,'trialActive',v_trial,
 'weeklyLimit',case when v_trial then null else 5 end,'weeklyUsed',v_used,
 'weeklyRemaining',case when v_trial then null else greatest(0,5-v_used) end,
 'weekResetsAt',((v_week+7)::timestamp at time zone 'utc'));
end; $$;

create or replace function public.av_reserve_ai_usage(p_user_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.av_profiles%rowtype; v_week date; v_used integer; v_id uuid; v_trial boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into p from public.av_profiles where user_id=p_user_id;
 if not found then
  insert into public.av_profiles(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select * into p from public.av_profiles where user_id=p_user_id;
 end if;
 select id into v_id from public.av_ai_usage where user_id=p_user_id and idempotency_key=p_idempotency_key;
 if v_id is not null then return jsonb_build_object('allowed',true,'reservationId',v_id,'duplicate',true); end if;
 v_week:=date_trunc('week',now() at time zone 'utc')::date;
 v_trial:=now()<p.trial_ends_at;
 update public.av_ai_usage set state='released' where user_id=p_user_id and state='reserved' and expires_at<=now();
 select count(*)::integer into v_used from public.av_ai_usage where user_id=p_user_id and week_start=v_week
 and (state='completed' or (state='reserved' and expires_at>now()));
 if not v_trial and v_used>=5 then
  return jsonb_build_object('allowed',false,'reason','weekly_limit','weeklyLimit',5,'weeklyUsed',v_used,'weeklyRemaining',0);
 end if;
 insert into public.av_ai_usage(user_id,idempotency_key,week_start) values(p_user_id,p_idempotency_key,v_week) returning id into v_id;
 return jsonb_build_object('allowed',true,'reservationId',v_id,'trialActive',v_trial,'weeklyUsed',v_used+1,
 'weeklyLimit',case when v_trial then null else 5 end,'weeklyRemaining',case when v_trial then null else greatest(0,4-v_used) end);
end; $$;

create or replace function public.av_complete_ai_usage(p_user_id uuid,p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 update public.av_ai_usage set state='completed',completed_at=now()
 where id=p_reservation_id and user_id=p_user_id and state='reserved' and expires_at>now();
 get diagnostics n=row_count; return jsonb_build_object('completed',n=1);
end; $$;
create or replace function public.av_release_ai_usage(p_user_id uuid,p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 update public.av_ai_usage set state='released' where id=p_reservation_id and user_id=p_user_id and state='reserved';
 get diagnostics n=row_count; return jsonb_build_object('released',n=1);
end; $$;

revoke all on public.av_profiles,public.av_ai_usage from anon,authenticated;
revoke all on function public.av_account_status(uuid) from public,anon,authenticated;
revoke all on function public.av_reserve_ai_usage(uuid,text) from public,anon,authenticated;
revoke all on function public.av_complete_ai_usage(uuid,uuid) from public,anon,authenticated;
revoke all on function public.av_release_ai_usage(uuid,uuid) from public,anon,authenticated;
grant execute on function public.av_account_status(uuid) to service_role;
grant execute on function public.av_reserve_ai_usage(uuid,text) to service_role;
grant execute on function public.av_complete_ai_usage(uuid,uuid) to service_role;
grant execute on function public.av_release_ai_usage(uuid,uuid) to service_role;

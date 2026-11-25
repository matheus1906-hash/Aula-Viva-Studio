-- =====================================================================
-- AulaViva Studio · banco de dados das contas institucionais (Supabase)
-- Rode este arquivo inteiro em: Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Regras de segurança (aplicadas pelo próprio banco, não só pela tela):
--   * cada professor só vê e altera os PRÓPRIOS dados (Row Level Security);
--   * nenhum dado é liberado só com a senha: a sessão precisa ter sido confirmada
--     com o código enviado ao e-mail (tabela sessoes_verificadas, escrita só pelo servidor);
--   * quem ativou a verificação em 2 etapas precisa da sessão em nível aal2;
--   * CPF validado (dígitos verificadores) e único; e-mail e celular validados.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- validações
create or replace function public.cpf_valido(cpf text) returns boolean
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(cpf, ''), '\D', '', 'g'); s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end $$;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.perfis (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text not null check (char_length(nome) between 3 and 120),
  email            text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone         text not null check (regexp_replace(telefone, '\D', '', 'g') ~ '^\d{10,11}$'),
  cpf              text not null unique check (public.cpf_valido(cpf) and cpf ~ '^\d{11}$'),
  uf               char(2) not null check (uf ~ '^[A-Z]{2}$'),
  municipio        text not null check (char_length(municipio) between 2 and 80),
  municipio_ibge   integer not null,
  escola_inep      integer not null,
  escola_nome      text not null check (char_length(escola_nome) between 2 and 200),
  aceite_termos_em timestamptz not null default now(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create table if not exists public.sessoes_verificadas (
  session_id  uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '30 days',
  ip          text,
  agente      text
);
create index if not exists sessoes_verificadas_user on public.sessoes_verificadas (user_id);

create table if not exists public.eventos_seguranca (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  tipo       text not null,
  detalhe    text,
  ip         text,
  criado_em  timestamptz not null default now()
);
create index if not exists eventos_seguranca_user on public.eventos_seguranca (user_id, criado_em desc);

-- ---------------------------------------------------------------- sessão confirmada
-- verdadeiro só quando a sessão atual foi confirmada pelo código do e-mail e,
-- se o professor ativou a verificação em 2 etapas, quando ela também foi feita (aal2)
create or replace function public.sessao_verificada() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.sessoes_verificadas v
    where v.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and v.user_id = auth.uid()
      and v.expira_em > now()
  )
  and (
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
  );
$$;

revoke all on function public.sessao_verificada() from public;
grant execute on function public.sessao_verificada() to authenticated;

-- CPF já usado? (para avisar no cadastro; não revela de quem é)
-- o parâmetro se chama p_cpf para não se confundir com a coluna perfis.cpf
drop function if exists public.cpf_disponivel(text);
create function public.cpf_disponivel(p_cpf text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.cpf_valido(p_cpf) and not exists (select 1 from public.perfis p where p.cpf = regexp_replace(p_cpf, '\D', '', 'g'));
$$;
revoke all on function public.cpf_disponivel(text) from public;
grant execute on function public.cpf_disponivel(text) to anon, authenticated;

-- mantém o e-mail do perfil igual ao da conta e a data de atualização
create or replace function public.perfis_antes_salvar() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  new.email := (select email from auth.users where id = new.id);
  new.cpf := regexp_replace(new.cpf, '\D', '', 'g');
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then new.cpf := old.cpf; new.criado_em := old.criado_em; new.aceite_termos_em := old.aceite_termos_em; end if; -- CPF não muda
  return new;
end $$;
drop trigger if exists perfis_antes_salvar on public.perfis;
create trigger perfis_antes_salvar before insert or update on public.perfis
  for each row execute function public.perfis_antes_salvar();

-- ---------------------------------------------------------------- Row Level Security
alter table public.perfis enable row level security;
alter table public.sessoes_verificadas enable row level security;
alter table public.eventos_seguranca enable row level security;

drop policy if exists perfis_ler on public.perfis;
drop policy if exists perfis_criar on public.perfis;
drop policy if exists perfis_alterar on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() and public.sessao_verificada());
create policy perfis_criar on public.perfis for insert to authenticated
  with check (id = auth.uid() and public.sessao_verificada());
create policy perfis_alterar on public.perfis for update to authenticated
  using (id = auth.uid() and public.sessao_verificada())
  with check (id = auth.uid() and public.sessao_verificada());
-- sem política de DELETE: excluir a conta apaga o perfil em cascata

drop policy if exists sessoes_ler on public.sessoes_verificadas;
create policy sessoes_ler on public.sessoes_verificadas for select to authenticated
  using (user_id = auth.uid() and public.sessao_verificada());
drop policy if exists sessoes_encerrar on public.sessoes_verificadas;
create policy sessoes_encerrar on public.sessoes_verificadas for delete to authenticated
  using (user_id = auth.uid() and public.sessao_verificada());
-- INSERT só pelo servidor (chave service_role, que ignora RLS)

drop policy if exists eventos_ler on public.eventos_seguranca;
create policy eventos_ler on public.eventos_seguranca for select to authenticated
  using (user_id = auth.uid() and public.sessao_verificada());

revoke all on public.perfis, public.sessoes_verificadas, public.eventos_seguranca from anon;
grant select, insert, update on public.perfis to authenticated;
grant select, delete on public.sessoes_verificadas to authenticated;
grant select on public.eventos_seguranca to authenticated;

-- limpeza de sessões vencidas (rode de vez em quando ou agende com pg_cron)
create or replace function public.limpar_sessoes() returns void language sql security definer set search_path = public as $$
  delete from public.sessoes_verificadas where expira_em < now();
$$;

-- Testes das regras de acesso (rodados como o papel "authenticated", igual ao Supabase).
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'ana@escola.br'), ('22222222-2222-2222-2222-222222222222', 'bia@escola.br');
create or replace function pg_temp.como(uid text, sid text, aal text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', uid, 'session_id', sid, 'aal', aal)::text, false); end $$;

-- 1) CPF
select assert_true(public.cpf_valido('529.982.247-25'), 'CPF válido aceito');
select assert_true(not public.cpf_valido('111.111.111-11'), 'CPF repetido recusado');
select assert_true(not public.cpf_valido('529.982.247-24'), 'CPF com dígito errado recusado');

set role authenticated;
-- 2) sessão NÃO confirmada: não cria nem lê perfil
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
do $$ begin
  insert into public.perfis (id, nome, email, telefone, cpf, uf, municipio, municipio_ibge, escola_inep, escola_nome)
  values ('11111111-1111-1111-1111-111111111111', 'Ana Souza', 'x@x.com', '64999999999', '52998224725', 'GO', 'Rio Verde', 5218805, 52000001, 'Escola A');
  raise exception 'FALHA: perfil criado sem sessão confirmada';
exception when insufficient_privilege then raise notice 'PASS sem código do e-mail o banco recusa criar perfil';
end $$;
reset role;
-- 3) servidor confirma a sessão (como a função /api/conta faz)
insert into public.sessoes_verificadas (session_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
insert into public.perfis (id, nome, email, telefone, cpf, uf, municipio, municipio_ibge, escola_inep, escola_nome)
values ('11111111-1111-1111-1111-111111111111', 'Ana Souza', 'falso@x.com', '(64) 99999-9999', '529.982.247-25', 'GO', 'Rio Verde', 5218805, 52000001, 'Escola A');
select assert_true((select email from public.perfis) = 'ana@escola.br', 'e-mail do perfil vem da conta, não do navegador');
select assert_true((select cpf from public.perfis) = '52998224725', 'CPF guardado só com números');
select assert_true((select plano from public.perfis) = 'teste' and (select teste_ate from public.perfis) between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour', 'cadastro começa com 14 dias grátis');
select assert_true(public.acesso_ativo(), 'dentro do teste gratuito o acesso está ativo');
update public.perfis set teste_ate = now() + interval '10 years', plano = 'anual', assinatura_ate = now() + interval '10 years';
select assert_true((select plano from public.perfis) = 'teste' and (select assinatura_ate from public.perfis) is null and (select teste_ate from public.perfis) < now() + interval '15 days', 'professor não consegue estender o teste nem se dar assinatura');
-- 4) CPF não pode ser trocado
update public.perfis set cpf = '11144477735', nome = 'Ana S. Souza';
select assert_true((select cpf from public.perfis) = '52998224725' and (select nome from public.perfis) = 'Ana S. Souza', 'CPF não muda; nome pode mudar');
-- 5) outra professora não vê o perfil da Ana
select pg_temp.como('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002', 'aal1');
select assert_true((select count(*) from public.perfis) = 0, 'outra conta não vê dados alheios');
-- 6) sessão da Ana em OUTRO aparelho sem código: não vê
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000003', 'aal1');
select assert_true((select count(*) from public.perfis) = 0, 'mesma conta em sessão não confirmada não vê nada');
reset role;
-- 7) com 2 etapas ativada, sessão confirmada mas aal1 não vê; aal2 vê
insert into auth.mfa_factors (user_id, status) values ('11111111-1111-1111-1111-111111111111', 'verified');
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select assert_true((select count(*) from public.perfis) = 0, 'com 2 etapas ativada, sem o código do app não vê');
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
select assert_true((select count(*) from public.perfis) = 1, 'com senha + e-mail + app autenticador vê os próprios dados');
-- 8) professor não consegue confirmar a própria sessão (só o servidor)
do $$ begin
  insert into public.sessoes_verificadas (session_id, user_id) values ('dddddddd-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111');
  raise exception 'FALHA: navegador confirmou a sessão';
exception when insufficient_privilege then raise notice 'PASS só o servidor pode confirmar sessões';
end $$;
-- 9) não registra eventos de segurança falsos
do $$ begin
  insert into public.eventos_seguranca (user_id, tipo) values ('11111111-1111-1111-1111-111111111111', 'login');
  raise exception 'FALHA: evento falso aceito';
exception when insufficient_privilege then raise notice 'PASS eventos de segurança só pelo servidor';
end $$;
reset role;
-- 9b) teste vencido: acesso inativo; servidor grava assinatura e o acesso volta
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.perfis set teste_ate = now() - interval '1 day' where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
select assert_true(not public.acesso_ativo(), 'depois dos 14 dias, sem assinatura, o acesso fica inativo');
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.perfis set plano = 'mensal', assinatura_ate = now() + interval '30 days';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
select assert_true(public.acesso_ativo(), 'com assinatura gravada pelo servidor, o acesso volta');
reset role;
-- 9c) celular repetido não cria outra conta
insert into auth.users values ('33333333-3333-3333-3333-333333333333', 'cai@escola.br');
insert into public.sessoes_verificadas (session_id, user_id) values ('eeeeeeee-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333');
set role authenticated;
select pg_temp.como('33333333-3333-3333-3333-333333333333', 'eeeeeeee-0000-0000-0000-000000000005', 'aal1');
do $$ begin
  insert into public.perfis (id, nome, email, telefone, cpf, uf, municipio, municipio_ibge, escola_inep, escola_nome)
  values ('33333333-3333-3333-3333-333333333333', 'Caio Lima', 'x@x.com', '(64) 99999-9999', '111.444.777-35', 'GO', 'Rio Verde', 5218805, 52000001, 'Escola A');
  raise exception 'FALHA: celular repetido aceito';
exception when unique_violation then raise notice 'PASS celular repetido não cria outra conta';
end $$;
do $$ begin
  insert into public.perfis (id, nome, email, telefone, cpf, uf, municipio, municipio_ibge, escola_inep, escola_nome)
  values ('33333333-3333-3333-3333-333333333333', 'Caio Lima', 'x@x.com', '(64) 98888-7777', '529.982.247-25', 'GO', 'Rio Verde', 5218805, 52000001, 'Escola A');
  raise exception 'FALHA: CPF repetido aceito';
exception when unique_violation then raise notice 'PASS CPF repetido não cria outra conta (nem outro teste grátis)';
end $$;
reset role;
-- 10) CPF duplicado e consulta de disponibilidade
set role anon;
select assert_true(public.cpf_disponivel('111.444.777-35'), 'CPF livre aparece disponível');
select assert_true(not public.cpf_disponivel('529.982.247-25'), 'CPF já cadastrado aparece indisponível');
select assert_true(not public.telefone_disponivel('(64) 99999-9999') and public.telefone_disponivel('(64) 97777-6666'), 'consulta de celular já cadastrado');
do $$ begin perform count(*) from public.perfis; raise exception 'FALHA: visitante leu perfis';
exception when insufficient_privilege then raise notice 'PASS visitante sem login não lê nada'; end $$;
reset role;
-- 11) RLS sempre ligado
select assert_true((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid in ('public.perfis'::regclass, 'public.sessoes_verificadas'::regclass, 'public.eventos_seguranca'::regclass)), 'RLS ligado e forçado nas 3 tabelas');
set role dono;
select set_config('request.jwt.claims', '', false);
select assert_true((select count(*) from public.eventos_seguranca) = 0, 'nem o dono das tabelas lê os eventos sem política (RLS forçado)');
select assert_true(public.cpf_disponivel('000.000.001-91') is not null, 'funções internas continuam funcionando com o RLS forçado');
reset role;
do $$ begin
  alter table public.perfis disable row level security;
  raise exception 'FALHA: RLS foi desligado';
exception when raise_exception then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'PASS desligar o RLS é recusado pela trava';
end $$;
do $$ begin
  alter table public.perfis no force row level security;
  raise exception 'FALHA: RLS deixou de ser forçado';
exception when raise_exception then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'PASS deixar de forçar o RLS também é recusado';
end $$;
set role dono;
create table public.tabela_nova_teste (id int);
reset role;
select assert_true((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.tabela_nova_teste'::regclass), 'tabela nova já nasce com RLS ligado e forçado');
drop table public.tabela_nova_teste;
select 'TODOS OS TESTES DO BANCO PASSARAM' as resultado;

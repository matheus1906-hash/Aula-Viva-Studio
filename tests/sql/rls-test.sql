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
-- 10) CPF duplicado e consulta de disponibilidade
set role anon;
select assert_true(public.cpf_disponivel('111.444.777-35'), 'CPF livre aparece disponível');
select assert_true(not public.cpf_disponivel('529.982.247-25'), 'CPF já cadastrado aparece indisponível');
do $$ begin perform count(*) from public.perfis; raise exception 'FALHA: visitante leu perfis';
exception when insufficient_privilege then raise notice 'PASS visitante sem login não lê nada'; end $$;
reset role;
select 'TODOS OS TESTES DO BANCO PASSARAM' as resultado;

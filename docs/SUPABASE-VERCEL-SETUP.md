# Supabase Auth e Vercel Functions — fundação da migração

Esta etapa cria o backend inicial de identidade e controle de uso. Ela **não substitui nem apaga** o cofre AES-256-GCM do navegador e não migra dados locais automaticamente. O conteúdo já salvo permanece no aparelho; sincronização segura entre dispositivos será uma etapa separada.

## Configurar Supabase

1. Crie um projeto Supabase.
2. Execute `supabase/migrations/202611230001_account_trial_and_usage.sql` no SQL Editor.
3. Em Authentication → URL Configuration, configure a URL pública do app e as URLs de redirecionamento de desenvolvimento/produção.
4. Escolha a política de confirmação de e-mail e o método de recuperação de conta.

O trigger cria o perfil quando uma conta Supabase é criada. O trial de 12 meses começa no servidor nesse momento.

## Configurar Vercel

Em Project → Settings → Environment Variables, adicione:

- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_ANON_KEY`: chave pública/anon.
- `SUPABASE_SERVICE_ROLE_KEY`: segredo server-side. **Nunca** colocar em variável pública, HTML, JavaScript do navegador ou commit.

Faça novo deploy após configurar as variáveis. `GET /api/config` retorna somente URL e anon key; a service role nunca é retornada.

## Endpoints criados

- `GET /api/config`: informa se o Supabase está configurado e fornece a configuração pública.
- `GET /api/account/status`: valida o access token com Supabase Auth e devolve trial/franquia.
- `POST /api/usage/reserve`: reserva uma geração com chave de idempotência.
- `POST /api/usage/complete`: confirma uma reserva após sucesso.
- `POST /api/usage/release`: libera a reserva após erro/cancelamento.

As rotas autenticadas exigem `Authorization: Bearer <access_token>`. O ID do usuário vem do token validado, não do corpo enviado pelo navegador. As operações de franquia são transacionais no Postgres e serializadas por usuário para evitar que abas simultâneas ultrapassem o limite.

## Regras iniciais no banco

- Trial individual de 12 meses corridos.
- Durante o trial, o banco ainda não aplica franquia semanal; o volume comercial do trial está pendente de decisão.
- Após o trial, 5 gerações concluídas por semana, renovadas segunda-feira à 00:00 UTC.
- Reserva expira em 15 minutos.
- Falhas e cancelamentos devem chamar release; somente geração concluída chama complete.
- Conta gratuita e dados locais não são apagados.

## Limites desta entrega

Esta é a fundação server-side, não a migração completa da tela de login nem o proxy de IA. O app ainda usa o fluxo local e os provedores/clientes IA existentes. Enquanto as chamadas BYOK/Claude ocorrerem diretamente no navegador, o controle de consumo não é enforcement de produção. Antes de ativar a cobrança/IA incluída, é necessário:

1. Integrar Supabase Auth à interface, com migração sem apagar o cofre local e opção de exportar/importar os materiais.
2. Centralizar todas as chamadas IA em uma função server-side autenticada, com reserva/complete/release no mesmo ciclo de geração e suporte a streaming.
3. Guardar as credenciais dos provedores exclusivamente na Vercel.
4. Definir franquia do trial, catálogo premium, limites dos planos pagos e provedor IA incluída.
5. Executar testes de integração com projeto Supabase e deploy Vercel reais.

Não configure a service role em ambientes do navegador. Não publique a nova política como ativa antes das etapas acima.

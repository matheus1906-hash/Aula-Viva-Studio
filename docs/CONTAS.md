# Ligar as contas institucionais (Supabase)

Enquanto as contas não estão ligadas, o site funciona como antes (conta local no aparelho).
Depois destes passos, o login passa a exigir **senha + código enviado ao e-mail** (e o **app autenticador**
para quem ativar a verificação em 2 etapas), e o cadastro pede **nome, e-mail, celular, CPF e instituição** (base do INEP).

Tempo estimado: 20 minutos. Tudo é gratuito para começar.

## 1. Criar o projeto

1. Entre em <https://supabase.com> → **New project**.
2. Nome: `aulaviva`. Região: **South America (São Paulo)**. Crie uma senha forte para o banco e guarde.

## 2. Criar as tabelas e as regras de segurança

1. No projeto: **SQL Editor → New query**.
2. Cole todo o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.
   Deve aparecer "Success". Pode rodar de novo sem problema.

## 3. Configurar o login

Em **Authentication**:

| Onde | O que fazer |
|---|---|
| **Sign In / Providers → Email** | Ligado. **Confirm email**: ligado. **Secure email change**: ligado. **Email OTP length**: 6. **Email OTP expiration**: 600 segundos |
| **Sign In / Providers** | Desligue os outros provedores e **Allow anonymous sign-ins** |
| **Policies → Passwords** (ou *Password security*) | Mínimo **10** caracteres, exigir **letras maiúsculas, minúsculas, números e símbolos**; ligue **Prevent use of leaked passwords** se o seu plano permitir |
| **Multi-Factor** | **TOTP (app autenticador)**: ligado |
| **URL Configuration** | **Site URL**: `https://aulavivastudio.vercel.app` |
| **Rate Limits** | Deixe os padrões (já limitam envios e tentativas) |

### Modelos de e-mail (código de 6 números)

Em **Authentication → Emails → Templates**, troque o texto destes três modelos para usar o código (`{{ .Token }}`):

**Confirm signup**: assunto `Seu código de cadastro no AulaViva Studio`

```html
<h2>Bem-vindo(a) ao AulaViva Studio</h2>
<p>Seu código de confirmação é:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Ele vale por 10 minutos. Se você não pediu este cadastro, ignore este e-mail.</p>
```

**Magic Link**: assunto `Seu código de acesso ao AulaViva Studio`

```html
<p>Alguém (provavelmente você) entrou na sua conta do AulaViva Studio com a senha correta.</p>
<p>Para concluir o login, digite o código:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Se não foi você, troque a sua senha imediatamente.</p>
```

**Reset Password**: assunto `Código para criar uma nova senha no AulaViva Studio`

```html
<p>Seu código para criar uma nova senha é:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Se você não pediu, ignore este e-mail: sua senha continua a mesma.</p>
```

### Envio de e-mails (SMTP), obrigatório para professores de fora da equipe

O envio padrão do Supabase **só entrega para os e-mails dos membros da sua equipe** no Supabase e tem limite baixíssimo.
Configure um SMTP em **Authentication → Emails → SMTP Settings**. Opções gratuitas para começar:

- **Resend** (<https://resend.com>, 3.000 e-mails/mês grátis): crie a conta, verifique um domínio e use
  host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a sua API key.
- **Brevo** (300 e-mails/dia grátis): host `smtp-relay.brevo.com`, porta `587`, usuário e senha SMTP do painel.
- **Gmail institucional (Google Workspace)**: host `smtp.gmail.com`, porta `465`, usuário = o e-mail, senha = uma *senha de app*.

Remetente sugerido: `AulaViva Studio <nao-responda@SEU-DOMINIO>`.

## 4. Ligar no Vercel

Em **Supabase → Project Settings → API**, copie a **Project URL**, a chave **anon public** e a chave **service_role**.

No **Vercel → projeto aulavivastudio → Settings → Environment Variables**, adicione (Production):

| Key | Value | Tipo |
|---|---|---|
| `SUPABASE_URL` | a Project URL (`https://xxxx.supabase.co`) | Config |
| `SUPABASE_ANON_KEY` | a chave **anon public** | Config |
| `SUPABASE_SERVICE_ROLE_KEY` | a chave **service_role** | **Secret** (nunca coloque no código) |

Depois: **Deployments → último deploy → Redeploy**.

Opcional:

| Key | Para quê |
|---|---|
| `IA_REQUIRE_LOGIN=0` | deixar a IA usável sem login (por padrão, com contas ligadas, a IA exige login confirmado) |
| `IA_LIMIT_GLOBAL_DAY=3000` | teto diário de pedidos à IA para o site inteiro |

## 5. Conferir

1. Abra o site: a tela de entrada mostra **"Entrar na sua conta"** e **"Criar conta de professor"**.
2. Cadastre-se: escolha estado, cidade e escola; confirme com o código que chegou no e-mail.
3. Ative a verificação em 2 etapas e leia o QR code com o Google Authenticator.
4. Em **Configurações**, veja **Conta institucional e segurança** e o **Escudo de segurança**.

## Teste gratuito de 14 dias e contas únicas

- Todo cadastro começa com **14 dias grátis**, contados pelo relógio do servidor. O professor não consegue alterar a data.
- **E-mail, CPF e celular são únicos**: a mesma pessoa não cria outra conta (nem ganha outro teste grátis).
- Depois dos 14 dias, sem assinatura, a IA responde "Assine um plano" (os materiais continuam salvos).
- Para liberar uma assinatura (até existir o pagamento on-line), no Supabase → **Table Editor → perfis**, edite a linha
  do professor: `plano` = `mensal` ou `anual` e `assinatura_ate` = a data de vencimento. (O Table Editor usa a chave de
  administrador; o professor não consegue fazer isso pelo site.)

## RLS sempre ligado

O `schema.sql` deixa o **RLS (Row Level Security) ligado e forçado** em todas as tabelas e instala uma trava no banco:

- qualquer comando que **desligue** o RLS (ou deixe de forçá-lo) é **recusado**;
- toda **tabela nova** criada no esquema `public` já nasce com o RLS ligado e forçado.

No painel do Supabase, em **Table Editor**, cada tabela deve aparecer como **RLS enabled**. Nunca clique em "Disable RLS":
o próprio banco vai recusar. Para mudar quem pode ver o quê, ajuste as políticas (Policies), nunca desligue o RLS.

## Como a segurança funciona

- A senha nunca passa pelo nosso servidor: o navegador fala direto com o Supabase.
- Depois da senha, o servidor (`api/conta.js`) envia o código ao e-mail **da conta** e só marca a sessão como
  confirmada quando o código certo volta. O banco (Row Level Security) **recusa qualquer leitura ou gravação**
  de sessões não confirmadas; com 2 etapas ativas, exige também o código do app (nível `aal2`).
- CPF validado e único; o CPF não pode ser alterado depois do cadastro.
- Cada professor só vê os próprios dados. A chave `service_role` fica só no Vercel.
- Os materiais continuam criptografados no aparelho (AES-256-GCM), com a mesma senha da conta.

# Habilitar login com Google, Microsoft e gov.br

O login social usa OAuth 2.0 + OpenID Connect para aplicativos nativos (PKCE + redirecionamento em
`http://127.0.0.1:<porta>/callback`). Cada provedor exige que a instituição ou equipe **registre o aplicativo**
e obtenha um `client_id`.

## Onde colocar as credenciais

- **Instaladores gerados pelo GitHub Actions:** em *Settings > Secrets and variables > Actions* do repositório, crie os
  segredos `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. O workflow `build` gera `aulaviva/assets/oauth_providers.json`
  durante a compilação e o embute no instalador; o arquivo nunca entra no Git (`.gitignore`).
- **Rodando pelo código no seu PC:** coloque o arquivo em `aulaviva/assets/oauth_providers.json` (ignorado pelo Git) ou
  na pasta de configuração do usuário (abaixo).

No Google Cloud, o cliente OAuth precisa ser do tipo **App para computador (Desktop)**. Enquanto a tela de consentimento
estiver em modo *Teste*, só os e-mails cadastrados em *Usuários de teste* conseguem entrar; para liberar a todos,
publique o app (*Publicar aplicativo*).

Pasta de configuração do usuário:
- Windows: `%LOCALAPPDATA%\AulaViva\aulaviva-studio\oauth_providers.json`
- Linux: `~/.config/aulaviva-studio/oauth_providers.json`

```json
{
  "google":    {"client_id": "xxxx.apps.googleusercontent.com", "client_secret": "(cliente Desktop do Google)"},
  "microsoft": {"client_id": "00000000-0000-0000-0000-000000000000"},
  "govbr":     {"client_id": "...", "client_secret": "..."}
}
```

Também é possível usar variáveis de ambiente: `AULAVIVA_GOOGLE_CLIENT_ID`, `AULAVIVA_GOOGLE_CLIENT_SECRET` etc.

## Google (Gmail)
1. Google Cloud Console > APIs e serviços > Tela de consentimento OAuth (escopos `openid email profile`).
2. Credenciais > Criar ID do cliente OAuth > **App para computador (Desktop)**.
3. Copie o `client_id` e o `client_secret`. Em apps desktop o Google não trata esse segredo como confidencial; o
   PKCE garante a segurança.

## Microsoft (Outlook, Office 365, contas escolares)
1. Portal do Azure > Microsoft Entra ID > Registros de aplicativo > Novo registro.
2. Tipos de conta: "Contas em qualquer diretório organizacional e contas Microsoft pessoais".
3. Autenticação > Adicionar plataforma > **Aplicativos móveis e da área de trabalho** > URI `http://localhost`.
4. Copie o *ID do aplicativo (cliente)*. Não é necessário segredo.

## gov.br
O acesso ao Login Único gov.br é concedido a órgãos e entidades públicas, mediante solicitação formal ao
Ministério da Gestão e da Inovação (https://www.gov.br/governodigital/pt-br/identidade/integracao-ao-login-unico).
Para redes públicas de ensino, a secretaria de educação pode solicitar a integração. Após aprovação, informe o
`client_id`/`client_secret` e cadastre a URL de retorno `http://127.0.0.1/callback` (solicite suporte a porta
dinâmica para aplicativos nativos). O app usa o CPF retornado pelo gov.br para pré-preencher o cadastro.

Enquanto um provedor não estiver configurado, o botão correspondente explica isso ao professor, que pode usar
e-mail e senha.

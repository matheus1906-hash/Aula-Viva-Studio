# Política de segurança

## Como relatar uma vulnerabilidade

Encontrou uma falha de segurança no AulaViva Studio? Por favor, **não abra uma issue pública**.
Use o relato privado do GitHub: aba **Security → Report a vulnerability** deste repositório.
Respondemos em até 7 dias e avisamos quando a correção for publicada.

## Versões com suporte

| Versão | Suporte |
|---|---|
| 4.x (atual, https://aulavivastudio.vercel.app) | sim |
| anteriores | não |

## Camadas de proteção

**Dados do professor**
- Conta local: materiais, conversas, chaves e perfil ficam cifrados no aparelho com AES-256-GCM; a chave é protegida pela senha com PBKDF2-SHA-256 (600 mil iterações). A senha nunca é guardada nem enviada.
- Código de recuperação, bloqueio progressivo após senhas erradas e bloqueio automático por inatividade.
- Dados pessoais de alunos nunca são enviados às IAs.

**Conta institucional (quando ligada, veja docs/CONTAS.md)**
- Senha + código enviado ao e-mail em todo login; verificação em 2 etapas com app autenticador.
- RLS sempre ligado e forçado em todas as tabelas; uma trava no banco recusa qualquer comando que o desligue e liga o RLS em toda tabela nova.
- O banco recusa leitura e gravação de sessões não confirmadas pelo código (e sem o app, quando ativado); só o servidor confirma sessões.
- Cada professor só vê os próprios dados; CPF validado, único e imutável; limites de tentativas de código e de envio.

**Escudo de segurança (antivírus da página)**
- Vigia o DOM o tempo todo e remove scripts, quadros, objetos, formulários e atributos de evento injetados; neutraliza links perigosos.
- Varre cada arquivo antes de importar (executáveis disfarçados, macros, bombas de compressão, PDFs com código, RTF com objetos OLE, imagens falsas).
- Registra violações da política de segurança e alterações em funções críticas.

**Site**
- Content-Security-Policy restrita: só os endereços necessários podem ser contatados; sem `eval`, sem plugins, sem formulários externos, sem `<base>`.
- Proteção contra clickjacking (`frame-ancestors 'none'`, `X-Frame-Options: DENY`) e verificação na própria página.
- HSTS, `nosniff`, `no-referrer`, COOP e CORP `same-origin`, `Origin-Agent-Cluster`, Permissions-Policy desligando câmera, localização, pagamento, USB e sensores.
- Bibliotecas do CDN carregadas com integridade (SRI sha384): o navegador recusa qualquer arquivo alterado.
- PDFs importados são lidos com a execução de código desligada (correção da CVE-2024-4367).
- A interface monta a página sem `innerHTML` com conteúdo externo: textos da IA e de arquivos importados nunca viram código.

**IA interna (`api/ia.js`)**
- Chaves só nas variáveis de ambiente do Vercel; nunca no código, nunca no navegador.
- Só atende o próprio site (verificação de origem) e só pedidos JSON.
- Tamanho máximo do pedido, mensagens de sistema só do servidor, caracteres de controle removidos.
- Limite por pessoa (10 minutos e diário), limite de pedidos simultâneos e limite diário global opcional (`IA_LIMIT_GLOBAL_DAY`).
- Tempo máximo por motor e total; erros internos dos motores nunca são repassados ao navegador.

**Repositório**
- Testes automáticos de segurança (`tests/api.test.mjs`, `tests/auth.cjs`) em todo envio.
- Dependabot para atualizações de segurança e análise de código com CodeQL.

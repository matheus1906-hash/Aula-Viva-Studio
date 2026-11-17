# Segurança do AulaViva Studio

Princípio adotado: **defesa em profundidade** e **mínimo de dados**. O app funciona offline. Os dados
ficam no computador do professor e só saem dele em duas situações: quando o professor usa a IA (vai apenas
o conteúdo do material) e durante o login com provedores externos.

## Contas e autenticação
- Senhas com **Argon2id** (64 MiB de memória, 3 iterações), com rehash automático quando os parâmetros mudam.
- Política de senha: mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo. Senhas comuns e
  senhas que contêm o nome ou o e-mail do usuário são recusadas. Um medidor mostra a força em tempo real.
- **Bloqueio progressivo** após 5 tentativas erradas: 1 min, depois 2, 4... até 30 min.
- Mensagem genérica ("E-mail ou senha incorretos") e tempo de resposta constante (hash isca), para que
  ninguém descubra quais e-mails têm conta.
- **Códigos de recuperação** de uso único, armazenados como hash Argon2id. Não existe "e-mail de recuperação",
  porque o app não depende de servidor.
- **Bloqueio automático** da sessão por inatividade (configurável, padrão de 15 min). Ao bloquear, o app descarta
  as telas que contêm dados pessoais.
- Reautenticação com senha antes de ações sensíveis: exportar dados, excluir conta, gerar novos códigos.
- Campos de senha não permitem copiar/recortar nem arrastar, e desativam a predição de texto.
- Login social (OAuth 2.0/OpenID Connect para apps nativos, RFC 8252): PKCE S256, `state` e `nonce`,
  redirecionamento só para `127.0.0.1`, assinatura do ID Token verificada pelo JWKS do provedor, além de
  emissor, audiência, expiração e e-mail verificado. Uma conta externa **não** é vinculada automaticamente a uma
  conta local com o mesmo e-mail, o que evita sequestro de conta.

## Dados em repouso
- Banco SQLite local com permissão `0600`, pasta `0700` (Linux), `secure_delete`, `foreign_keys` e
  `trusted_schema=OFF`. Todas as consultas usam parâmetros, sem concatenação de SQL.
- Dados pessoais (nome, CPF, nascimento, telefone, e-mail, instituição, disciplinas, cidade, matrícula) e todo o
  conteúdo dos projetos são criptografados com **AES-256-GCM**. Cada campo tem um contexto (AAD), então um
  valor copiado para outra coluna ou para outro usuário não decifra.
- Buscas por e-mail e CPF usam **índice cego HMAC-SHA256**: o banco não contém esses dados em texto claro.
- Chave-mestra de 256 bits guardada no **cofre do sistema** (Gerenciador de Credenciais do Windows / Secret
  Service no Linux). Fallback: arquivo `0600` (Linux) ou protegido com **DPAPI** (Windows).
- A chave da API de IA também fica no cofre do sistema e nunca volta a ser exibida.
- Logs não registram dados pessoais, senhas, tokens nem códigos OAuth. Bibliotecas HTTP ficam em nível WARNING.

## Conteúdo e arquivos
- Links (blocos, textos e respostas da IA) aceitam apenas `https://`, `http://` e `mailto:`. São bloqueados
  `javascript:`, `file:`, `data:`, credenciais embutidas e caracteres de controle ou bidirecionais.
- Imagens: limite de 12 MB, proteção contra *decompression bomb* e reprocessamento que **remove EXIF/GPS**.
- Anexos Office: lista branca de extensões, verificação de *magic bytes* e **bloqueio de arquivos com
  macros** (`vbaProject.bin`), limite de 15 MB.
- Projetos importados (`.aulaviva`) passam pela mesma sanitização de esquema e tamanho.
- PDFs gerados **não contêm JavaScript**. A fonte embutida é a DejaVu Sans (licença livre, em `aulaviva/assets/fonts`). A proteção opcional usa AES-256 (pypdf).
- Textos são normalizados (NFC) e caracteres de controle e de direção invisíveis são removidos.

## IA
- Provedores: modo demonstração (offline), Ollama (local: nada sai do computador), Google Gemini e Claude. As chaves de
  cada provedor ficam no cofre do sistema; o endereço do Ollama aceita apenas http(s) sem credenciais embutidas, e
  conexões locais não passam por proxy.
- No plano gratuito do Gemini, o Google pode usar os textos enviados para melhorar produtos; o app avisa isso.
- Nenhum dado pessoal do professor ou de alunos é enviado. A interface avisa para não incluir dados de estudantes.
- A resposta da IA é tratada como **dado não confiável**: chega em formato estruturado (*structured outputs*), é
  validada por esquema, saneada e revisada pelo professor. Links inseguros são descartados. O prompt de sistema
  instrui o modelo a ignorar instruções embutidas no conteúdo (mitigação de *prompt injection*).

## LGPD
- Consentimento explícito no cadastro; termos e política acessíveis.
- Direitos do titular em *Configurações > Privacidade*: acesso e correção (perfil), **portabilidade**
  (exportação JSON) e **eliminação** (exclusão da conta, com cascata e `VACUUM`).
- Registro de eventos de segurança (auditoria) sem dados pessoais, visível ao usuário.

## Distribuição
- Dependências com versões fixas e `pip-audit` no CI.
- Uma única instância por usuário (`QLockFile`), o que evita corromper o banco.
- Recomendado: assinar digitalmente os executáveis.

## Limites conhecidos
- Quem tem acesso total à conta do sistema operacional desbloqueada pode, em tese, ler o cofre do sistema. A
  proteção do computador (senha do SO, criptografia de disco como BitLocker/LUKS) continua essencial.
- As restrições de PDF (impressão/cópia) dependem do leitor de PDF respeitá-las.

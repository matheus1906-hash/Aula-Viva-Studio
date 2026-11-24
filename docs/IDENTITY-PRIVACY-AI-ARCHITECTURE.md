# Identidade, proteção de dados e IA incluída — plano de implementação

**Estado:** arquitetura em desenvolvimento, não ativada em produção. Este documento descreve requisitos e as próximas etapas. Não afirmar que os controles descritos estão operacionais antes dos testes.

## Decisões de produto (23/11/2026)

- GitHub é o repositório e registro oficial: código, documentação, testes e decisões seguem juntos em cada commit/PR.
- Conta de fundador com papel `master` persistido em banco, independente dos planos comerciais.
- Professores entram com Supabase Auth e cadastram sua instituição de atuação profissional.
- O professor escolhe motor de IA sem fornecer chave de API. Credenciais de provedores ficam exclusivamente no backend.
- Preservar os materiais cifrados armazenados no cofre local; nenhuma migração destrutiva ou upload silencioso.
- Trial de 12 meses a partir do cadastro; após esse período, plano gratuito com 5 gerações semanais de IA. O volume durante o trial ainda precisa de teto financeiro.

## Conta master — provisionamento seguro

Não existe credencial master universal, senha embutida ou e-mail promovido automaticamente. O master é uma identidade **real** do Supabase Auth, com e-mail verificado, senha forte e MFA obrigatório. A permissão fica na tabela `av_admin_roles` vinculada ao UUID da conta e só pode ser concedida por procedimento administrativo confiável. O administrador não terá acesso às senhas de outros usuários ou às chaves do cofre local.

Depois de criar/verificar a conta no Supabase, obter o UUID em Authentication → Users e executar de forma privada no SQL Editor do Supabase:

```sql
insert into public.av_admin_roles(user_id, role, reason)
values ('UUID_REAL_E_VERIFICADO'::uuid, 'master', 'verified founder provisioning')
on conflict (user_id) do update
set role = 'master', reason = excluded.reason;
```

Esta instrução **não criou** a conta real do fundador. Nunca colocar senha, token ou UUID sensível de terceiros em commits. Acesso ao painel master exige revalidação do token e MFA (AAL2) no servidor. Administrador poderá consultar dados operacionais necessários e auditados, mas não ler materiais privados criptografados de professores.

## Cadastro do professor — mínimo necessário

- Nome profissional.
- E-mail verificado no Supabase Auth.
- Nome da escola/instituição.
- Município e UF.
- Tipo de instituição (pública/privada/outra).
- Função (professor/coordenador/diretor/outra).
- Identificador público da instituição, quando houver e quando relevante para confirmação do vínculo.
- Aceite versionado de termos e ciência da política de privacidade.

Não solicitar CPF, endereço residencial, dados bancários, identificação de aluno ou telefone pessoal como exigência padrão. O preenchimento de escola e cidade não valida automaticamente o vínculo: checar cadastro público institucional e, se necessário, e-mail profissional ou análise manual. Não afirmar verificação sem evidência.

## Proteção de dados

- Usar TLS em todas as conexões externas; nunca expor service role ou API keys no bundle.
- Supabase Auth controla senhas e sessões; não armazenar senha reversível nem sessão completa na tabela profissional.
- Proteger dados em repouso com criptografia do provedor e medidas específicas para informações pessoais no banco; campos mais sensíveis podem usar criptografia por campo (envelope encryption) com chave no KMS externo, não na própria base.
- Separar credenciais de IA, identidade, dados profissionais, dados operacionais e materiais de usuário com políticas de menor privilégio.
- RLS em todas as tabelas e autorização server-side em cada rota; a conta master não deve ter acesso padrão a materiais privados.
- Auditar **eventos de autenticação e ações administrativas** sem registrar senha, prompt completo, token, chave API ou informação pessoal desnecessária. Usar políticas de retenção e expurgo.
- Não prometer criptografia independente por campo até as rotinas de cifra/chaves e rotação estarem de fato implementadas e verificadas.
- Publicar política de privacidade, finalidade, retenção, segurança e atendimento aos direitos dos titulares conforme LGPD.

## IA sem chave do professor

Fluxo de produção: `Supabase Auth → Vercel Function → autorização e franquia atômica → roteador de motores aprovados → API do fornecedor → confirmação/liberação do uso`.

- Selector simples no frontend por **motor disponível** (por exemplo Gemini, Groq ou outros habilitados pelo operador).
- Cada motor exige conta, faturamento/cota e chave válida do **operador do AulaViva**, configurada em variável secreta da Vercel. Disponibilidade gratuita para desenvolvedores não significa serviço ilimitado ou revenda autorizada: conferir contratos, preços, privacidade e limites dos provedores.
- Nunca colocar chaves no HTML, LocalStorage ou GitHub. Desabilitar interface de BYOK somente quando proxy seguro estiver operacional, evitando cortar o acesso antes da substituição.
- Enviar apenas dados necessários no prompt; impedir envio não autorizado de dados de alunos, aplicar filtros de conteúdo, rate limits, limites por usuário e custos totais.
- Cada geração real deve reservar, confirmar no sucesso ou liberar em falha/cancelamento. Implementar idempotência, streaming e recuperação de tarefas travadas.
- Master pode ter exceção de franquia comercial, **não** de limites defensivos de gasto, segurança ou autenticação.

## Auditoria de login

O Supabase já possui registros do Auth. A tabela adicional `av_signin_events` é para um histórico de acessos do produto, caso implementado no fluxo de login verificado. **Ela ainda não recebe eventos automaticamente**, pois o frontend Supabase Auth não está conectado. Tratar tokens refresh como evento separado de login real e evitar excesso de logs. Restringir leitura dos eventos aos usos administrativos legítimos e à política de retenção.

## Implantação e validação pendentes

1. Criar o projeto Supabase e executar migrações em ambiente de teste.
2. Criar a conta do fundador de forma privada, verificar e habilitar MFA, conceder papel master com UUID real.
3. Integrar Supabase Auth (cadastro/login/recuperação) ao frontend mantendo cofre local intacto.
4. Implementar onboarding institucional, validação, autorização de operações e logs efetivos de login.
5. Adicionar roteador seguro de modelos IA e remover do frontend os campos de API keys após migração.
6. Implementar proteção criptográfica individual nos campos necessários com KMS e testes de rotação.
7. Testar políticas RLS, escalada de privilégios, vazamento de secrets, concorrência de franquia, autenticação e backup.
8. Atualizar README e changelog do portfólio conforme cada marco entregue.

Apenas os schemas e consulta de papel administrativo da etapa atual estão com código versionado. Os fluxos e controles de produção listados acima continuam **pendentes**.

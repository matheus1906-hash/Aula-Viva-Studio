# Correção: botão Entrar não acessível na prévia Vercel

## Sintoma
O usuário acessa o ambiente de prévia (`*.vercel.app`) e a aba **Entrar** não responde. O problema é mais evidente em navegador/dispositivo que nunca criou uma conta naquele domínio.

## Causa identificada no código
Na versão anterior de `src/auth.js`, o botão de alternância de aba tinha `disabled: k === "login" && !exists`. `exists` apenas verifica a existência de `av:vaultmeta` no LocalStorage da **origem atual**. Por segurança do navegador, cada domínio possui armazenamento isolado, então uma conta anterior do GitHub Pages, de outro preview ou da produção não aparece automaticamente neste endereço.

Este é o fluxo de autenticação **local** ainda em uso. A infraestrutura inicial Supabase está versionada, mas o frontend ainda não utiliza Supabase Auth.

## Correção
- A aba **Entrar** agora permanece clicável, mesmo sem uma conta local no endereço.
- A tela informa claramente que não há conta local naquela origem e orienta criar uma conta local para testes, usar o modo visitante ou acessar o domínio da conta anterior.
- O envio do formulário sem conta existente retorna uma mensagem específica, antes de tentar desbloquear o cofre.
- A aba **Criar conta** informa que o cadastro é local e não migra contas/materiais entre domínios.
- **Não alteramos cofre, chave, criptografia, senha, materiais, perfis ou dados já armazenados.**

## Testes
Foi adicionado ao teste Playwright `tests/auth.cjs` um cenário para visitante de primeira viagem, incluindo aba Entrar clicável, mensagem de domínio isolado, tentativa de login inexistente e retorno a Criar conta. O teste de login/cofre existente permanece no arquivo. **Execução automatizada ainda precisa ser confirmada em CI ou ambiente local**; um deploy READY atesta compilação/publicação, não execução do teste de navegador.

## Limitação e próxima implementação
A correção melhora a experiência, mas **não cria contas centralizadas nem permite acessar uma conta local por outro domínio**. A solução definitiva é ativar Supabase Auth com migração sem perda do cofre existente. Nunca adicionar uma senha master fixa ao código.

## Entrega
Branch `feature/supabase-auth-usage-limits`; deployment da Vercel deve ser validado pelo commit correspondente, com acesso público apenas quando a proteção do ambiente estiver configurada adequadamente.

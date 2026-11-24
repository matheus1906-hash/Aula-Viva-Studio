# Home 4.0 — reformulação visual do painel inicial

**Situação:** implementado em branch de desenvolvimento, não integrado à `main`. O GitHub Actions e o deployment Preview devem passar por validação antes de aprovação para produção.

## Problema identificado

O design anterior mantinha a vitrine e os vários atalhos genéricos como protagonistas, deixando agenda, horários, mensagem motivacional e ambiente de estudos apenas no rodapé. Em telas menores, os recursos importantes do cotidiano ficavam invisíveis até percorrer boa parte da página.

## Mudança de interface

A nova tela inicial assume um **dashboard de trabalho docente**, pensado para mostrar as ferramentas pedidas logo na chegada:

1. Cabeçalho com data local e saudação personalizada.
2. Hero verde-esmeralda, com chamada de ação para criação com IA e vídeo animado.
3. Campo destacado de criação livre por tema.
4. Seis cards grandes de criação: IA, vídeo, atividades, modelos, ABNT e estudos.
5. Coluna prioritária com **agenda rápida**: criar lembrete sem sair da home, marcar como concluído e abrir agenda completa.
6. **Aulas de hoje**: mostra a grade correspondente ao dia local ou oferece ação para configurar horários.
7. **Frase motivacional do dia**: frases originais e sem atribuição falsa.
8. Painel de estudo e escrita e lista dos materiais recentes.
9. Personalização com acesso direto às Configurações.

## Personalização

Os controles existentes em **Configurações → Personalizar tela inicial** continuam funcionando:
- Agenda e lembretes;
- Horários de aula;
- Mensagem motivacional diária;
- Atalhos para estudos e ABNT.

Ocultar um widget **não apaga dados**. Quando todos os opcionais estão ocultos, o layout preserva a área de criação, os materiais recentes e a personalização, oferecendo uma experiência limpa.

## Arquitetura e privacidade

- Implementação isolada em `src/home-dashboard.js` após `src/teacher-tools.js` no `build.mjs`.
- Estilos responsivos em `src/app.css`, incluindo celular, tablet, desktop, tema escuro e redução de movimentos.
- Lembretes e horários reutilizam `AV.LS` e os mesmos registros do módulo docente, sem criar um segundo banco divergente.
- A conta local/cofre existente permanece inalterada. Nenhuma migração destructiva nem transmissão extra de dados foi adicionada.
- IA e geração de vídeo preservam o fluxo atual e a futura integração de Supabase/Vercel continua pendente.

## Testes a executar e acompanhar

- `npm run check:js` — syntax check, incluindo a nova home.
- `npm run build` — gerar a página standalone.
- `npm run test:home` — visibilidade dos widgets, ação rápida de lembrete, conclusão de tarefa e modo limpo que mantém os dados.
- `npm run test:all` — testes unitários anteriores, novos modelos e autenticação inicial.
- Playwright em CI — regressão de navegação e login. A última execução pode exigir revisão de confiabilidade dos testes.
- Validação visual manual em viewport desktop/mobile e prévia pública da Vercel.

**Não declarar homologação completa somente porque o deployment está READY.** Conferir o commit exato, a execução CI e o comportamento real em navegador.

## Arquivos

- `src/home-dashboard.js` — novo layout e interações da página inicial.
- `src/app.css` — design visual.
- `build.mjs` — inclusão na compilação.
- `tests/home-dashboard.cjs` — regressões automatizadas.
- `package.json` — comandos de teste.

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

## Decisão visual posterior — preservar a área superior original

Em 23/11/2026, após revisão da versão 4.0, foi determinado que **o banner original do AulaViva deve ser preservado**, conforme referência enviada pelo responsável do projeto. A reformulação agora se aplica **somente abaixo desse banner**.

O topo mantém:
- Fundo verde com degradê e textura de grade, cantos arredondados;
- Selo `AulaViva Studio · PT · EN · ES`;
- Saudação dinâmica conforme horário e primeiro nome do professor;
- Texto de apresentação original;
- Campo amplo `O que você quer criar?` e botão coral **Criar**;
- Cinco atalhos: Plano de aula, Atividade para imprimir, Prova, Vídeo animado, Livros e artigos.

Abaixo dele permanecem o novo conjunto de cards, agenda, horários, frase diária, estudos, materiais recentes e preferências. O campo extra de geração por IA foi removido da área inferior para evitar duplicação.

### Proteção contra regressões

`tests/home-dashboard.cjs` verifica o retorno do componente `.hero.home-preserved-hero`, a presença dos cinco atalhos, o campo original e o envio por Enter, além das verificações de agenda e widgets já existentes. Não apagar essa área em futuras reformulações sem solicitação explícita.

## Ajuste de organização visual (23/11/2026)

Solicitação registrada: dar mais destaque às opções de criação, mantendo o banner verde original intocado, posicionar a frase motivacional em um pequeno painel **ao lado do banner**, deixar agenda e plano de aula na coluna do canto e deslocar **Continuar de onde parou** para o final.

Implementação:
- 12 cards de criação, incluindo chat livre, vídeo, atividades, modelos, apostila, prova, lista de exercícios, fontes, ABNT, estudos e biblioteca; destaque aumentado para áreas clicáveis;
- pequena coluna de inspiração alinhada com o hero; em telas estreitas, ela quebra para baixo sem alterar o banner;
- agenda rápida, botão para criar plano de aula e horários na barra lateral;
- preferências e materiais recentes posicionados depois da área principal, com o histórico por último;
- visibilidade de frase/agenda/horários/estudos permanece configurável, sem apagar dados;
- responsividade em desktop, tablet e celular.

Arquivo de interface: `src/home-dashboard.js`. Estilo: `src/app.css`. Regressões: `tests/home-dashboard.cjs` e `tests/auth.cjs`. Não considerar a alteração homologada até confirmação do build e dos testes CI. O merge na branch principal não está autorizado nesta etapa.

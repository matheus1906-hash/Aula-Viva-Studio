# Sistema visual de ilustrações — Home 4.3

**Estado:** desenvolvido na branch de preview; não integrado à `main` até validação.

## Objetivo

Substituir os 12 pictogramas genéricos do painel inicial por **12 mini-ilustrações editoriais específicas**, com identidade visual própria. O banner verde superior, os atalhos, a agenda, o plano de aula lateral e o posicionamento dos materiais recentes permanecem inalterados.

## Componentes implementados

- `src/home-card-art.js`: 12 composições vetoriais SVG originais construídas pelo DOM seguro (`createElementNS`), sem `innerHTML`, CDN, imagens remotas nem bibliotecas adicionais.
- `src/home-dashboard.js`: associação de cada card a uma arte e categoria próprias, selo contextual, ação **Explorar** e links/callbacks existentes preservados.
- `src/app.css`: gradientes discretos por categoria, tipografia hierarquizada, arte ampliada, responsividade, foco visível, sombra e elevação suave, respeitando `prefers-reduced-motion`.
- `build.mjs`: carrega o módulo de ilustrações antes de desenhar a home.
- `tests/home-dashboard.cjs`: verifica que os 12 cards mantêm artes distintas, paletas, badges e ação.
  
## Vocabulário visual

| Card | Mini-ilustração | Selo |
| --- | --- | --- |
| Criar com IA | Página + varinha + brilhos | Rápido |
| Chat livre | Duas caixas de diálogo | Flexível |
| Vídeos animados | Quadro de vídeo + play | Criativo |
| Atividades | Folha + marcação + lápis | Popular |
| Modelos prontos | Páginas/capas sobrepostas | Personalize |
| Nova apostila | Livro aberto + marcador | Completo |
| Avaliações e provas | Folha de conferência | Avaliações |
| Lista de exercícios | Itens numerados + lápis | Prática |
| Estúdio de fontes | Pasta + documento + seta | Importar |
| Editor ABNT | Documento com margens e régua | Acadêmico |
| Ambiente de estudos | Livro de leitura | Apoio |
| Biblioteca | Estante + lupa | Acervo |

Os selos são **identificadores de contexto**, não métricas não comprovadas: por exemplo, `Popular` indica a categoria de atividades e não uma afirmação estatística de ranking.

## Acessibilidade, compatibilidade e privacidade

As ilustrações são decorativas (`aria-hidden=true`) e o título do card continua textual, legível por leitores de tela. Botões e links mantêm navegação por teclado e estados de foco. Não há chamadas externas, coleta de dados, mudanças no cofre ou na autenticação. O código SVG é reutilizável para outros pontos do projeto sem duplicar assets.

Atenção: os badges e artes são desenhados pela aplicação em tempo de execução; testes unitários com ambiente sem DOM utilizam um fallback seguro. Validar visualmente em temas claro/escuro, tamanhos desktop/tablet/celular e diferentes navegadores.

## Qualidade e deploy

`npm run check:js`, `npm run test:home`, `npm run build` e o fluxo completo CI devem executar após o commit. O estado READY da Vercel comprova build/deploy, não aprovação de todo o fluxo Playwright. Registrar falhas e correções adicionais antes de merge.

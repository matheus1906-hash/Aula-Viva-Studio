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

## Controle de qualidade adicional

O comando `npm run check:js` agora verifica explicitamente `src/home-card-art.js` antes de liberar o build na Vercel. O teste de navegador `tests/auth.cjs` valida a presença das doze SVGs, dos doze selos, dos IDs de desenho distintos e da ausência de rolagem horizontal no mobile. O teste unitário `tests/home-dashboard.cjs` valida o mapeamento entre categorias e composição. Um deployment com estado READY não equivale, sozinho, à aprovação dos testes completos de navegador.

## Correção visual — fundo parecido com imagem não carregada

Após a revisão dos cards, foi removido o gradiente muito claro e o círculo decorativo translúcido atrás das ilustrações. O conjunto criava uma área esmaecida que parecia um espaço de imagem vazia.

**Novo padrão:** card com superfície sólida do tema da plataforma, ilustração dentro de um painel menor e colorido com borda suave, selo e texto sem alterações. Os desenhos SVG originais continuam sendo gerados localmente; não são imagens externas. A mudança preserva os 12 atalhos e o banner superior.

Verificações: `npm run check:js`, `npm run build`, `npm run test:home`, inspeção visual dos cards em temas claro/escuro e nos tamanhos desktop/mobile. O status READY da Vercel não substitui os testes manuais e de navegador.

## Reformulação: desenhos verdadeiramente coloridos

A pedido do responsável, os ícones de contorno (“preto e branco”) foram substituídos por **12 pequenas cenas vetoriais coloridas, com objetos preenchidos e sobrepostos**. As artes são originais e auto-hospedadas no bundle; não dependem de fotografias, serviços de imagem nem de conexão externa para carregar.

A implementação usa formas SVG preenchidas, detalhes de papel e objetos, personagens, camadas, sombras, contrastes e cores próprias por função. Exemplos: personagem dentro de um player para vídeos, estante multicolorida para biblioteca, mesa de estudos com livro e luminária, caderno aberto, prancheta de prova e páginas com conteúdo para modelos.

Não alteramos o banner verde, agenda, horários, links, títulos nem preferências. Criado `tests/home-illustrations.cjs` para renderizar os 12 SVGs com DOM simulado e conferir que são cenas distintas, multicamadas, coloridas e com marcação decorativa acessível. `npm run test:home` agora executa esse teste além da regressão da home.

**Limite desta entrega:** ilustrações coloridas em estilo vetorial editorial (não fotografias nem renderizações 3D). A qualidade visual em navegadores e temas deve ser verificada separadamente; estado READY não significa homologação completa.

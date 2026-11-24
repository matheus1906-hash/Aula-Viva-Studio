# Galeria de modelos com prévia visual nos cards

## Problema
Antes, a tela **Modelos prontos** mostrava apenas título, descrição e etiquetas. Para descobrir a aparência de um material, o professor precisava abrir o diálogo **Visualizar** em cada modelo.

## Solução implementada
Cada card da galeria agora mostra, logo na listagem, uma miniatura montada a partir do **conteúdo real do próprio modelo**, reutilizando o renderizador `AV.renderPaper`, já usado nas prévias completas.

- Exibe capa/título e uma amostra inicial dos blocos do material.
- Mantém título, descrição, disciplina, ano, filtros, botão **Visualizar** e ação **Usar modelo**.
- Clique ou ativação por teclado na miniatura abre a prévia completa (aluno/professor).
- Miniatura é somente de leitura; editar continua exigindo **Usar modelo**.
- Os cards são criados pelo renderizador em lotes existente (`AV.renderChunked`); cada miniatura limita a amostra a 4 blocos iniciais dentre os 8 primeiros, para não renderizar o documento completo em dezenas de cards.
- A grade permanece responsiva para celular e desktop.

## Arquivos alterados
- `src/views.js`: adiciona a prévia em miniatura a cada modelo e seu comando acessível.
- `src/app.css`: estilo da área de prévia, tamanho fixo, corte do conteúdo excedente e foco de teclado.

## Validação recomendada
Executar `npm run build`, `npm test` e testes de navegador, verificando: modelos com e sem capa, imagens, questões, tabelas; filtros de idioma/disciplina; navegação por teclado; cards em dispositivos móveis; performance da listagem. Nenhuma dessas verificações de navegador foi afirmada como concluída aqui.

## Estado
Implementado na branch `feature/supabase-auth-usage-limits`; ainda não integrado à `main` e não confirmado em produção.

# Expansão do AulaViva Studio — rotina docente e criação pedagógica

**Status:** desenvolvimento em branch, sem merge na `main`. A verificação do build e os testes automatizados de navegador são condições para aprovação. O preview não equivale à implantação definitiva de identidade Supabase nem de IA incluída.

## Funcionalidades adicionadas

### Vídeos animados
- 15 roteiros pedagógicos originais e editáveis, além dos modelos existentes.
- Botão **Criar livremente por chat**: professor descreve tema, público e personagens; a IA monta um storyboard que pode ser refinado por mensagens e depois aberto no editor.
- O chat utiliza a infraestrutura de IA que o aplicativo já tinha. **A retirada das chaves individuais e a IA centralizada ainda dependem da implementação segura do proxy Vercel e do Supabase Auth.**
- Exportação WebM já existente; adicionadas exportações **SRT** (legendas) e **JSON** (roteiro). A narração sintetizada pelo navegador **não entra no WebM**. MP4 e áudio sincronizado não estão disponíveis nem foram prometidos.

### 50 novos modelos de atividades
- 50 **modelos editáveis** (10 formatos × 5 temas), usando os geradores de atividades existentes. São novos conteúdos configurados, **não 50 novos algoritmos geradores**.
- Temas: animais brasileiros, meio ambiente, alimentação saudável, corpo humano, Sistema Solar.
- Formatos: caça-palavras, palavras cruzadas, palavras embaralhadas, ordem alfabética, completar lacunas, ligar colunas, verdadeiro ou falso, quiz, ordenar frases e operações matemáticas.
- Pesquisa por título/área e botão de personalização que preenche os campos do gerador já existente.
- A atividade pode ser revisada na prévia antes de criar um material; não gerar automaticamente textos não verificados em ambientes escolares.

### Organização docente
- Agenda de lembretes com data, observação, conclusão e exclusão.
- Horário semanal de aulas por dia, horário, disciplina, turma e sala, com exportação CSV.
- Mensagem motivacional diária: conjunto de frases originais, atribuídas a ninguém, sem citação falsa.
- Tela inicial configurável: mostrar/ocultar agenda, horários, frase do dia e atalhos de estudo, sem apagar o conteúdo.
- Agenda, horários e rascunhos ABNT são gravados por `AV.LS`, que no modo autenticado local do projeto utiliza o cofre criptografado. **Não há sincronização Supabase desses registros nesta etapa.**
- Exportação de backup JSON de materiais, agenda, horários, editor ABNT e preferências; restauração com validação básica. **O arquivo JSON exportado é texto legível, não criptografado** — guardá-lo em local protegido. Apagar todos os dados inclui os novos registros.

### Editor acadêmico / ABNT
- Editor com prévia de impressão e cinco modelos iniciais: artigo, projeto de pesquisa, relatório, resenha crítica e plano de aula.
- Formatação-base de A4, margens 3 cm superior/esquerda e 2 cm inferior/direita, fonte 12pt e entrelinhas 1,5.
- Exportar HTML e DOCX, abrir layout de impressão/PDF pelo navegador.
- **Limitação:** ainda não há validador completo de regras ABNT. Elementos como citações, referências, figuras, sumário, paginação, recuos especiais, notas e eventuais diretrizes institucionais precisam de revisão humana. Consulte a versão vigente das normas.

### Ambiente de estudos
- 12 orientações práticas sobre planejamento, escrita, coesão, revisão, fontes, citações, avaliação, inclusão e leitura crítica.
- Busca por assunto e atalho para começar um material relacionado.

## Integração no aplicativo

- Novas seções acessíveis no menu principal (desktop) e no menu “Mais” (mobile).
- Busca rápida inclui agenda, horários, estudos e ABNT.
- Preferências de personalização são acessíveis em Configurações.
- Responsividade para celular e desktop via `src/app.css`.

## Exportações: inventário real

| Conteúdo | Formatos |
|---|---|
| Documentos existentes | PDF, DOCX, PPTX, HTML, Markdown, TXT, JSON |
| Editor de texto ABNT | DOCX, HTML e impressão/PDF pelo navegador |
| Vídeo animado | WebM (sem áudio de narração integrado), SRT (legendas), JSON (roteiro) |
| Horário de aulas | CSV |
| Backup de dados | JSON legível (não cifrado) |

## Testes e qualidade

- `npm run check:js` — análise sintática dos arquivos alterados.
- `npm run build` — compilação do HTML.
- `npm run test:teacher` — 50 modelos geram blocos válidos, 15 roteiros possuem cenas e os módulos estão registrados.
- `npm run test:account` — verificação dos contratos iniciais de backend.
- `npm test` — testes existentes.
- `node tests/auth.cjs` e `node tests/smoke.cjs` — regressões de navegador com Playwright/Chromium, executadas em CI.
- GitHub Actions `.github/workflows/quality.yml` executa os passos; a Vercel agora confere sintaxe antes do build.

**A publicação não deve ser declarada validada até os jobs de CI passarem e o deployment da Vercel atingir READY.** Também verificar manualmente os caminhos de criação, edição e exportação nos navegadores-alvo.

## Referências para o desenho pedagógico e acadêmico

- [Base Nacional Comum Curricular (MEC)](https://basenacionalcomum.mec.gov.br/) — referência de competências e habilidades, não ranking dos modelos mais utilizados.
- [Normas ABNT (catálogo oficial)](https://www.abntcatalogo.com.br/) — confirmar a edição vigente e exigências da instituição. A presença de regras gerais aqui não constitui certificação de conformidade ABNT.

## Arquivos

- `src/teacher-tools.js`, `src/activity-presets.js`, `src/animacao-extras.js`
- `src/views.js`, `src/views2.js`, `src/main.js`, `src/shell.html`, `src/core.js`, `src/app.css`
- `build.mjs`, `vercel.json`, `package.json`, `tests/teacher-features.cjs`, `.github/workflows/quality.yml`.

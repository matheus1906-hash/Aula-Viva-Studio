# Histórico de versões

## 2.2.0
- **Muito mais rápido e sem travamentos:** geração de PDF (prévia, exportação, miniaturas) roda num processo separado,
  sem disputar o processador com a interface; páginas do painel montadas sob demanda; troca de tema claro/escuro de
  ~1,5 s para ~0,2 s; abrir um bloco no editor de ~60 ms para ~15 ms.
- **Importar arquivos do professor:** Word (.docx/.doc), PowerPoint (.pptx/.ppt), PDF (inclusive exportado do Canva),
  LibreOffice (.odt/.odp), texto, Markdown, RTF e imagens. O conteúdo vira blocos editáveis (títulos, textos, listas,
  tabelas, imagens e até questões) ou serve de **base para a IA** criar apostila, lista, prova ou roteiro.
  Leitura segura (defusedxml, proteção contra zip bomb, bloqueio de macros).
- **30 modelos prontos** (24 novos): apostilas, listas, provas e roteiros de várias disciplinas e anos, com ilustrações,
  busca e filtro por disciplina.
- **Novas fontes:** Nunito (títulos) e Nunito Sans (textos), embutidas.
- **Ilustrações e ícones vetoriais** no lugar dos emojis; cartões e menu com animações ao passar o mouse.
- **Boas-vindas e login no estilo vitrine**, com telas e PDFs reais do programa animados.

## 2.1.0
- Nova fonte de interface **Inter** (embutida, licença OFL) e textos com mais contraste e tamanhos maiores.
- **Modo escuro** (Claro / Escuro / Automático) em *Configurações > Preferências*, aplicado na hora sem sair da conta.
- **Login com Google** funcionando: botão no padrão oficial, retorno em `http://127.0.0.1:<porta>/` e credenciais
  fora do Git (arquivo local ignorado ou segredos `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no GitHub Actions).
- Miniaturas dos modelos com fundo de papel correto no modo escuro.

## 2.0.0
- Novo visual claro, inspirado em papel e caderno, mais limpo e legível.
- **Criar com IA** qualquer tipo de material (apostila, lista, prova, roteiro) e editar depois.
- Editor simplificado: blocos como cartões editáveis direto no documento; menu "Adicionar" com explicações.
- **Modelos prontos reais** com ilustrações e prévia da página (6 disciplinas).
- **Ferramentas**: gerador de QR code (PNG/SVG, cores, logo, Wi-Fi) e gerador de links.
- Mais provedores de IA: Groq, OpenRouter, Mistral, ChatGPT, DeepSeek e servidores compatíveis com OpenAI.
- Correções: subseção antes de seção travava a exportação; "(F)" em V/F era lido como alternativa "f)";
  travamento ao fechar a visualização de PDF; testes não tocam mais no cofre de senhas do Windows.

## 1.1.0
- Exportação robusta: formatação inválida, blocos grandes e links vazios não travam mais; versões aluno/professor.
- Fonte DejaVu embutida (símbolos π, ≈, ², ✓ em qualquer computador).
- Assistente "Criar novo material", lista rápida de questões e modelo de prova.
- IA gratuita: modo demonstração, Ollama (local) e Google Gemini.
- Prévia de 6 a 9 vezes mais rápida; histórico de desfazer sem copiar imagens.

## 1.0.0
- Primeira versão: cadastro seguro, editor de blocos, PDF interativo, assistente Claude, empacotamento Windows/Linux.

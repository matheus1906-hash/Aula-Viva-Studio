# Histórico de versões

## 2.4.0
- **Feito para notebook:** a janela não exigia mais altura do que a tela tem (1366x768 com zoom de 125%), abre no
  tamanho certo (maximizada em telas pequenas), a barra lateral recolhe para só os ícones, os cartões do Início ficam
  em 2 colunas, botões e filtros quebram de linha em vez de sair da tela, a barra do editor fica só com ícones e o
  título aparece inteiro, e o cartão de login cabe inteiro.
- **Botão "Importar vídeo"** no Início e no menu Importar de Meus materiais: cria um material com o vídeo anexado ao PDF
  (e a transcrição, se a legenda .srt/.vtt estiver junto).
- **Ícone na barra de tarefas:** o logotipo aparece no lugar do ícone genérico (atalhos com o mesmo identificador do app
  e ícone definido para todas as janelas).
- **IAs:** botão "Testar todas as IAs salvas" mostra o resultado de cada uma com a mensagem exata.
- **Exportação de PDF:** um segundo processo auxiliar evita que a geração de miniaturas atrase a exportação; a pasta
  escolhida é lembrada sem desfazer outros ajustes.
- **Atualização limpa:** o instalador fecha o app aberto e remove os arquivos internos da versão anterior.
- A versão instalada aparece na tela de login.

## 2.3.1
- **Corrigido "Informe sua chave gratuita do Gemini" mesmo depois de colar a chave:**
  - a chave agora é **salva sozinha** ao colar (e também ao apertar Enter ou "Testar conexão");
  - fica guardada em dois lugares (cofre do sistema + arquivo criptografado), então não "some" se o cofre do Windows
    não devolver a chave ao reabrir o app;
  - clicar no cartão de uma IA sem chave só abre o painel dela, sem trocar a IA que já funciona;
  - se a IA escolhida estiver sem chave, o app usa automaticamente outra que tenha chave salva;
  - o teste de conexão mostra qual IA foi testada, e as mensagens dizem exatamente o que fazer.

## 2.3.0
- **Manter conectado:** marque a opção no login e o AulaViva abre direto, sem pedir a senha, por 30 dias neste
  computador. A senha nunca é guardada: o app usa um token aleatório criptografado com a chave do cofre do sistema,
  trocado a cada abertura. "Sair" desconecta na hora; trocar a senha desconecta os outros computadores. Também pode ser
  ligado/desligado em Configurações > Preferências.
- **Chaves e IAs gratuitas corrigidas:** o app agora se identifica corretamente aos serviços (Groq, OpenRouter e outros
  recusavam o acesso com erro 403, que aparecia como "chave inválida") e usa os certificados atualizados no Windows.
  Ao salvar uma chave, o app consulta o serviço e escolhe sozinho um modelo disponível e gratuito; se um modelo for
  aposentado, ele troca automaticamente. Repete sozinho quando o serviço está instável, aceita chave colada com
  "Bearer" ou "NOME=chave" e mostra mensagens claras para cada erro.
- **Novas IAs gratuitas:** Cerebras e Hugging Face. No OpenRouter a lista mostra só modelos gratuitos (inclui
  "openrouter/free", que escolhe um gratuito disponível).
- **Tela de chaves de IA sem sobreposição:** cartões e textos ficavam encavalados; também foi corrigido o botão de
  opção (bolinha) que aparecia quadrado.
- **Importar vídeos:** escolha um vídeo do computador (MP4, MOV, WEBM, MKV, AVI... até 100 MB) e ele vai **anexado
  dentro do PDF**, com um cartão explicando ao aluno como assistir. Também pelo "Criar a partir de um arquivo" e por
  "Trazer conteúdo de um arquivo". Se houver a legenda (.srt/.vtt) com o mesmo nome, a fala do vídeo vira texto e a IA
  cria o material a partir dela. Legendas também podem ser importadas sozinhas. Os vídeos ficam criptografados no
  computador e são apagados quando nenhum material os usa mais.
- **Interface mais suave:** trocas de tela e janelas animadas com imagens pré-renderizadas (cada quadro ficou de 4 a
  10 vezes mais leve), cartões desenhados uma única vez e reaproveitados na rolagem, menos efeitos simultâneos, chaves
  de IA em cache (antes o cofre do sistema era consultado a cada clique) e o editor/PDF carregados em segundo plano
  (o app abre mais rápido).

## 2.2.3
- **Gemini corrigido:** a chave pode ser colada com o botão direito (antes só Ctrl+V), aspas e espaços colados junto
  são ignorados, salvar a chave já passa a usar o Gemini, botão "Buscar modelos disponíveis" escolhe automaticamente o
  melhor modelo da sua conta, troca automática quando um modelo é aposentado pelo Google, mais espaço de resposta para
  modelos que "pensam" e mensagens claras para cada erro (chave inválida, API não ativada, cota do plano gratuito).
- **Cancelar a geração por IA:** a tela "A IA está trabalhando..." tem botão Cancelar (ou tecla Esc); o resultado que
  chegar depois é descartado e nada é alterado.

## 2.2.2
- **Login com Google configurável dentro do app:** ao clicar em "Continuar com o Google" (ou em Configurações >
  Segurança), cole o ID e a chave do cliente OAuth; o app confere com o Google antes de salvar e guarda só no
  computador do usuário. Inclui o passo a passo do Google Cloud.
- **Vincular conta Google** a uma conta já existente (Configurações > Segurança).
- Tela de espera com dicas para os erros do Google ("acesso bloqueado"/usuários de teste, app não verificado) e página
  de retorno no navegador mais clara.

## 2.2.1
- Cadastro: **CPF, celular e data de nascimento com digitação livre** (só números ou com pontos, traços e barras);
  o app formata e valida ao sair do campo. A data aceita 10/04/1985, 10-04-1985, 10.04.1985 ou 10041985.
- Corrigido: no tema claro, **listas suspensas e menus das janelas (ex.: gerar apostila com IA) ficavam pretos no
  Windows**. A causa era uma regra de transparência em cascata; agora a transparência é aplicada sem contaminar
  as cores dos controles (com teste automático para não voltar).
- Capa de "Avaliação / Prova" mais clara.

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

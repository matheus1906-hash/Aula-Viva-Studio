# Histórico de versões

## 4.1.0

**Criação com IA mais confiável**
- O card da tela inicial entende o pedido escrito (tipo, tema, ano, disciplina, quantidade de questões) e já começa a criar, sem segundo clique.
- Servidor de IA encerra a resposta no sinal de fim (antes esperava a conexão fechar e estourava o tempo), troca de motor quando um trava antes de responder e respeita um tempo total.
- Seleção automática: se a resposta vier quebrada ou vazia, o app tenta de novo sozinho com outro motor.
- Groq começa pelo modelo que está respondendo; lacunas sem resposta viram perguntas abertas.

**Segurança**
- Content-Security-Policy completa também como cabeçalho, lista fechada de endereços que a página pode contatar.
- Integridade (SRI) nas bibliotecas do CDN; jsPDF 4.2.1 e mammoth 1.13.0 (correções de segurança); PDFs importados sem execução de código (CVE-2024-4367).
- IA interna: só JSON, mensagens de sistema só do servidor, limite de pedidos simultâneos e limite diário global opcional, erros internos nunca expostos.
- Novos cabeçalhos (CORP, Origin-Agent-Cluster, X-Permitted-Cross-Domain-Policies, Permissions-Policy ampliada), SECURITY.md, Dependabot e CodeQL.

## 4.0.0 · versão estável

Primeira versão estável, pronta para uso público em https://aulavivastudio.vercel.app

- IA sempre disponível: motor reserva gratuito e sem chave entra quando as chaves não estão configuradas ou quando todos os motores falham.
- Publicação oficial pelo Vercel; o GitHub Pages passa a ser opcional (disparo manual).
- Reúne tudo das versões 3.x: criação ao vivo com IA, login com cofre cifrado, 290 modelos com miniatura, 46 vídeos animados, leitor de livros completo, biblioteca com prévias e ícones ilustrados.

## 3.5.0

- IA gratuita interna: o professor não precisa mais criar nem colar chave. A função `api/ia.js` no Vercel fala com Groq, Mistral, OpenRouter e Ollama Cloud usando chaves guardadas só nas variáveis de ambiente, com troca automática de motor, limite de uso por pessoa e restrição ao próprio site.
- Ajustes de IA simplificados: escolha do motor (Automático, Rápida, Equilibrada, Variada, Raciocínio); chave própria só para IAs pagas, numa seção opcional.
- Removidos os campos de chave das IAs gratuitas (as chaves antigas salvas no navegador são apagadas).

## 3.4.0

- 34 vídeos animados novos (46 no total): corpo humano, animais, plantas, reciclagem, saúde, contagem, tabuada do 2, dobro e metade, dinheiro, alfabeto, rimas, sílabas, emoções, trânsito seguro, povos indígenas, cores primárias e inglês básico.
- Ícones ilustrados e coloridos para as opções da tela inicial.
- Biblioteca de conteúdos com prévia da folha em cada tema, no formato do tipo de material escolhido; modelos relacionados com miniatura.
- Leitor de livros com botões grandes de Anterior e Próxima no rodapé.

## 3.3.0

- Modelos prontos mostram uma miniatura real da primeira folha em cada card.
- Leitor de livros em tela cheia: temas claro, amarelado, papel, escuro e noite; fontes, tamanho, espaçamento, largura, alinhamento e escurecer a tela; grifos em 5 cores com anotações; marcadores; sumário por capítulos; busca no livro; leitura em voz alta; tempo restante; exportar anotações; gestos e atalhos de teclado.

## 3.2.0

- 220 modelos novos e originais (total de 290): 50 atividades, 50 apostilas, 50 provas, 30 listas de exercícios, 25 planos de aula com habilidades da BNCC e 15 roteiros com QR codes, da Educação Infantil ao Ensino Médio, em português, inglês e espanhol. Inspirados nos formatos que professores mais usam: avaliação diagnóstica, simulado no estilo SAEB/ENEM, sequência didática, lista de fixação, revisão para prova e roteiro de estudo.

## 3.1.0

- Tela de boas-vindas e login com vitrine de imagens reais do app, em português, inglês e espanhol.
- Cofre local cifrado (AES-256-GCM, PBKDF2 600 mil iterações), código de recuperação, bloqueio progressivo, bloqueio por inatividade, "manter conectado" e modo visitante.
- Seção "Conta e segurança" nas Configurações.
- Content-Security-Policy e cabeçalhos de segurança no Vercel; a página recusa abrir dentro de outros sites.
- Criação ao vivo com IA: a folha se monta em tempo real enquanto a IA escreve.

## 3.0.0
- App web, publicado no GitHub Pages, sem instalação.
- Interface em português, inglês e espanhol; materiais gerados no idioma escolhido.
- Editor em blocos com prévia das versões do aluno e do professor.
- Exportação em PDF interativo, Word, PowerPoint, HTML, Markdown, TXT e JSON.
- 70 modelos prontos e 13 geradores de atividades comuns.
- Estúdio de vídeos animados para crianças, com 12 modelos e roteiro por IA.
- Estúdio de fontes, chat livre e biblioteca de conteúdos por etapa e componente curricular.
- Livros e e-books: 118 livros em domínio público com capa, acervo comentado, busca inteligente e ABNT.
- IA com a chave do professor (Gemini, Groq, Cerebras, OpenRouter, Mistral, Hugging Face, Ollama, Claude, OpenAI, DeepSeek) ou IA incluída no claude.ai.
- Visual novo, acessível (WCAG AA) e otimizado para celular.

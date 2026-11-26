(function (AV) {
  "use strict";
  /**
   * Fichas técnicas de cada tipo de material: o que a IA deve entregar (instruções precisas) e
   * como conferir a resposta (check devolve "" quando está certo ou o motivo do erro, para a IA refazer).
   * Função pura e testável: AV.KindSpecs.check(kind, out, req).
   */
  const Q_TYPES = new Set(["choice_question", "true_false", "open_question", "fill_blank", "match"]);
  const TEXT_TYPES = new Set(["heading", "paragraph", "callout", "bullets", "table"]);

  function stats(out) {
    const blocks = (out && Array.isArray(out.blocks) ? out.blocks : []).filter((b) => b && b.type);
    const count = (fn) => blocks.filter(fn).length;
    const headings = blocks.filter((b) => b.type === "heading").map((b) => String(b.text || "").toLowerCase());
    const q = count((b) => Q_TYPES.has(b.type));
    const firstQ = blocks.findIndex((b) => Q_TYPES.has(b.type));
    return {
      blocks, total: blocks.length, q, headings,
      paragraphs: count((b) => b.type === "paragraph"),
      callouts: count((b) => b.type === "callout"),
      tables: count((b) => b.type === "table"),
      links: count((b) => b.type === "link" || b.type === "video" || b.type === "qrcode"),
      qTypes: new Set(blocks.filter((b) => Q_TYPES.has(b.type)).map((b) => b.type)).size,
      textBlocks: count((b) => TEXT_TYPES.has(b.type)),
      firstQ: firstQ < 0 ? blocks.length : firstQ,
      hasHeading: (re) => headings.some((t) => re.test(t))
    };
  }

  const SPECS = {
    apostila: {
      role: "Você é um professor-autor de apostilas didáticas.",
      guide: `APOSTILA = material de ESTUDO e EXPLICAÇÃO (não é prova nem lista).
Estrutura obrigatória, nesta ordem:
1. heading nível 1 "Introdução" + 1 ou 2 paragraphs que contextualizam o tema com exemplos do cotidiano do aluno.
2. De 3 a 5 seções (heading nível 1) que explicam o conteúdo passo a passo: cada seção com paragraphs explicativos, pelo menos uma callout "definicao" com o conceito-chave, e quando útil uma table ou bullets com exemplos.
3. Pelo menos 1 exemplo resolvido explicado (paragraph começando com "Exemplo:").
4. Uma callout "curiosidade" e uma callout "atencao" (erro comum dos alunos).
5. heading "Resumo" + bullets com 4 a 6 ideias principais.
6. SÓ NO FIM: heading "Para praticar" com no máximo 5 questões curtas.
Proibido: cabeçalho de prova, instruções de prova, valor/nota, numerar como avaliação, começar com questões. Pelo menos 70% dos blocos devem ser texto explicativo.`,
      check(s) {
        if (s.q > 6) return "tem " + s.q + " questões; apostila pode ter no máximo 5, só na seção final 'Para praticar'";
        if (s.textBlocks < 0.65 * s.total) return "tem pouco texto explicativo; pelo menos 70% dos blocos devem explicar o conteúdo";
        if (s.paragraphs < 4) return "precisa de pelo menos 4 parágrafos explicativos";
        if (s.firstQ < 0.6 * s.total) return "as questões aparecem cedo demais; ficam só no fim, depois das explicações";
        if (!s.blocks.some((b) => b.type === "callout" && b.style === "definicao")) return "falta a caixa de definição (callout 'definicao') com o conceito-chave";
        if (!s.hasHeading(/resumo/)) return "falta a seção 'Resumo'";
        return "";
      }
    },
    prova: {
      role: "Você é um professor elaborador de avaliações escolares.",
      guide: `PROVA / AVALIAÇÃO = instrumento de AVALIAÇÃO (não é apostila: não explica o conteúdo).
Estrutura obrigatória:
1. callout "importante" com as instruções: tempo, valor total e como responder.
2. Somente questões, em ordem crescente de dificuldade, misturando choice_question (4 alternativas), true_false, fill_blank, match e open_question (com critério de correção em "answer").
3. Se usar texto-base (interpretação), coloque-o em 1 paragraph logo antes das questões que dependem dele.
Proibido: seções explicativas, callouts de curiosidade/dica/definição, resumos, "Para saber mais". No máximo 3 parágrafos (só texto-base). Toda questão tem gabarito correto.`,
      check(s, req) {
        const min = Math.max(6, (req.count || 8) - 2);
        if (s.q < min) return "tem só " + s.q + " questões; a prova precisa de pelo menos " + min;
        if (s.blocks.some((b) => b.type === "callout" && /curiosidade|dica|definicao/.test(b.style))) return "tem caixas explicativas (curiosidade/dica/definição), que não cabem em prova";
        if (s.paragraphs > 3) return "tem texto explicativo demais; prova só pode ter parágrafos de texto-base";
        if (!s.blocks.some((b) => b.type === "callout" && /importante|atencao/.test(b.style))) return "faltam as instruções da prova em uma callout 'importante'";
        if (s.qTypes < 2) return "use pelo menos 2 tipos diferentes de questão";
        return "";
      }
    },
    lista: {
      role: "Você é um professor que prepara listas de exercícios graduais.",
      guide: `LISTA DE EXERCÍCIOS = PRÁTICA (não explica o conteúdo, não é prova formal).
Estrutura obrigatória:
1. paragraph curto (1 frase) com a orientação ao aluno.
2. heading "Nível 1: aquecimento", heading "Nível 2: prática" e heading "Nível 3: desafio", cada um com exercícios.
3. De 10 a 15 exercícios no total, variados (choice_question, fill_blank, true_false, match, open_question), todos com gabarito.
Proibido: seções teóricas longas, callouts de curiosidade/definição, valor/nota de prova.`,
      check(s, req) {
        const min = Math.max(8, (req.count || 10) - 2);
        if (s.q < min) return "tem só " + s.q + " exercícios; a lista precisa de pelo menos " + min;
        if (s.paragraphs > 3) return "tem texto explicativo demais; lista é só prática";
        if (s.blocks.some((b) => b.type === "callout" && /curiosidade|definicao/.test(b.style))) return "tem caixas teóricas, que não cabem em lista de exercícios";
        if (!s.hasHeading(/n[ií]vel/)) return "organize os exercícios em níveis (Nível 1, Nível 2, Nível 3)";
        return "";
      }
    },
    atividade: {
      role: "Você é um professor que cria atividades lúdicas para imprimir.",
      guide: `ATIVIDADE PARA IMPRIMIR = tarefas PRÁTICAS e LÚDICAS para o aluno fazer na folha.
Estrutura obrigatória:
1. paragraph curto com a instrução geral, em linguagem do aluno.
2. De 4 a 8 atividades variadas (pelo menos 3 tipos: match, fill_blank, true_false, choice_question, open_question com desenho ou escrita), cada uma com enunciado claro e divertido.
3. Pode ter 1 callout "dica" para ajudar.
Proibido: textos teóricos longos, cabeçalho de prova, valor/nota.`,
      check(s) {
        if (s.q < 4) return "tem só " + s.q + " atividades; precisa de pelo menos 4";
        if (s.qTypes < 3) return "use pelo menos 3 tipos diferentes de atividade";
        if (s.paragraphs > 4) return "tem texto demais; atividade é para fazer, não para ler";
        return "";
      }
    },
    plano: {
      role: "Você é um coordenador pedagógico que escreve planos de aula.",
      guide: `PLANO DE AULA = documento do PROFESSOR (não é material do aluno: não tem questões para o aluno responder).
Estrutura obrigatória, com estes títulos (heading nível 1):
"Identificação" (bullets: componente, ano, duração), "Habilidades da BNCC", "Objetivos de aprendizagem" (bullets com verbos observáveis), "Conteúdos", "Desenvolvimento da aula" (table com colunas Etapa | Tempo | O que o professor faz | O que os alunos fazem, de 4 a 6 linhas), "Recursos", "Avaliação" (critérios observáveis), "Adaptações e inclusão", "Referências".
Proibido: choice_question, true_false, fill_blank, match e open_question.`,
      check(s) {
        if (s.q > 0) return "tem questões para o aluno; plano de aula é documento do professor, sem questões";
        if (!s.tables) return "falta a tabela do desenvolvimento da aula (Etapa | Tempo | Professor | Alunos)";
        if (!s.hasHeading(/objetivo/)) return "falta a seção 'Objetivos de aprendizagem'";
        if (!s.hasHeading(/avalia/)) return "falta a seção 'Avaliação'";
        if (!s.hasHeading(/desenvolvimento|metodologia|etapas/)) return "falta a seção 'Desenvolvimento da aula'";
        return "";
      }
    },
    roteiro: {
      role: "Você é um professor que prepara roteiros de estudo guiado.",
      guide: `ROTEIRO = caminho de estudo GUIADO, passo a passo, com recursos digitais.
Estrutura obrigatória:
1. callout "importante" com o objetivo do roteiro.
2. De 3 a 6 passos (heading "Passo 1: ...", "Passo 2: ..."), cada um com paragraph curto do que fazer e, quando fizer sentido, um link ou video de sites oficiais e estáveis.
3. Ao final, heading "Registro" com 2 a 4 open_question para o aluno anotar o que aprendeu.
Proibido: virar apostila (explicações longas) ou prova.`,
      check(s) {
        if (!s.hasHeading(/passo/)) return "organize em passos (Passo 1, Passo 2...)";
        if (s.headings.filter((t) => /passo/.test(t)).length < 3) return "precisa de pelo menos 3 passos";
        if (s.links < 1) return "inclua pelo menos 1 link ou vídeo de site oficial";
        if (s.q > 6) return "tem questões demais; roteiro termina com poucas perguntas de registro";
        return "";
      }
    },
    projeto: {
      role: "Você é um coordenador pedagógico que escreve projetos educacionais.",
      guide: `PROJETO EDUCACIONAL = documento de PLANEJAMENTO de várias aulas (não é material do aluno).
Estrutura obrigatória (heading nível 1): "Apresentação", "Justificativa", "Objetivos" (geral e específicos em bullets), "Habilidades da BNCC", "Público-alvo", "Etapas e cronograma" (table com Etapa | Semana | Atividades | Produto), "Recursos", "Produto final", "Avaliação", "Referências".
Proibido: questões para o aluno responder.`,
      check(s) {
        if (s.q > 2) return "tem questões para o aluno; projeto é documento de planejamento";
        if (!s.tables) return "falta a tabela de etapas e cronograma";
        if (!s.hasHeading(/justificativa/)) return "falta a seção 'Justificativa'";
        if (!s.hasHeading(/objetivo/)) return "falta a seção 'Objetivos'";
        if (!s.hasHeading(/avalia/)) return "falta a seção 'Avaliação'";
        return "";
      }
    }
  };

  AV.KindSpecs = {
    get: (kind) => SPECS[kind] || SPECS.apostila,
    stats,
    /** "" quando o material respeita a ficha do tipo; senão o motivo, em linguagem para a IA corrigir */
    check(kind, out, req) {
      const s = stats(out);
      if (s.total < 4) return "o material veio vazio ou curto demais";
      const spec = SPECS[kind];
      return spec ? spec.check(s, req || {}) : "";
    },
    /** limpeza final: remove o que nunca cabe no tipo (caso a IA insista depois da correção) */
    clean(kind, blocks) {
      if (kind === "prova") return blocks.filter((b) => !(b.type === "callout" && /curiosidade|dica|definicao/.test(b.style)));
      if (kind === "plano" || kind === "projeto") return blocks.filter((b) => !Q_TYPES.has(b.type));
      return blocks;
    }
  };
})(globalThis.AV = globalThis.AV || {});

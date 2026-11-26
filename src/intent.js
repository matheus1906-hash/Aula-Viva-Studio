(function (AV) {
  "use strict";
  /**
   * Entende um pedido escrito livremente ("uma apostila simples sobre o ciclo da água para o 3º ano")
   * e devolve { kind, topic, level, subject, count, extra }. Função pura: não depende da página.
   */
  /* \b do JavaScript não reconhece letras acentuadas (ê, ç, ã): esta fronteira reconhece */
  const UB = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
  const W = (re) => new RegExp(re.source.replace(/\\b/g, UB), re.flags.includes("u") ? re.flags : re.flags + "u");
  const KIND_RULES = [
    ["video", /\bv[ií]deos?\b|\bdesenhos? animados?\b|\banima[cç][aãõo]+e?s?\b|\bcurta animado\b/],
    ["plano", /\bplanos? de aula\b|\bplano\b|\bsequ[eê]ncia did[aá]tica\b/],
    ["prova", /\bprovas?\b|\bavalia[cç][aã]o\b|\bavalia[cç][oõ]es\b|\bsimulados?\b|\btestes?\b/],
    ["lista", /\blistas?\b|\bexerc[ií]cios?\b/],
    ["projeto", /\bprojetos?\b/],
    ["roteiro", /\broteiros?\b|\bqr ?codes?\b/],
    ["apostila", /\bapostilas?\b|\bresumos?\b|\btextos? de apoio\b|\bmaterial de estudo\b/],
    ["atividade", /\batividades?\b|\bca[cç]a-?palavras?\b|\bcruzadinhas?\b|\bfichas?\b|\bfolhas?\b/]
  ].map(([kind, re]) => [kind, W(re)]);
  /* [disciplina, citada pelo nome, pista pelo tema]: o nome tem prioridade sobre a pista */
  const SUBJECTS = [
    ["Língua Inglesa", /\bingl[eê]s\b|\benglish\b/, null],
    ["Língua Espanhola", /\bespanhol\b|\bespa[nñ]ol\b/, null],
    ["Língua Portuguesa", /\bportugu[eê]s\b|\bl[ií]ngua portuguesa\b/, /\bgram[aá]tica\b|\bortografia\b|\binterpreta[cç][aã]o de texto\b|\bprodu[cç][aã]o de texto\b|\bs[ií]labas?\b|\balfabetiza[cç][aã]o\b/],
    ["Matemática", /\bmatem[aá]tica\b/, /\bfra[cç][oõ]es\b|\bfra[cç][aã]o\b|\bmultiplica[cç][aã]o\b|\bdivis[aã]o\b|\btabuada\b|\bgeometria\b|\bporcentagem\b|\bequa[cç][oõ]es\b|\bequa[cç][aã]o\b|\bdecimais\b/],
    ["Educação Física", /\beduca[cç][aã]o f[ií]sica\b/, /\besportes?\b/],
    ["Física", /(?<!educa[cç][aã]o )\bf[ií]sica\b/, null],
    ["Química", /\bqu[ií]mica\b/, null],
    ["Biologia", /\bbiologia\b/, null],
    ["Ciências", /\bci[eê]ncias\b/, /\bciclo da [aá]gua\b|\bsistema solar\b|\bplantas?\b|\banimais\b|\bcorpo humano\b|\becossistemas?\b|\bmeio ambiente\b/],
    ["História", /\bhist[oó]ria\b/, /\bbrasil col[oô]nia\b|\bindepend[eê]ncia\b|\bescravid[aã]o\b|\bidade m[eé]dia\b/],
    ["Geografia", /\bgeografia\b/, /\brelevo\b|\bclima\b|\bmapas?\b|\bregi[oõ]es do brasil\b|\bcartografia\b|\bcerrado\b/],
    ["Arte", /\barte\b|\bartes\b/, /\bpintura\b|\bm[uú]sica\b/],
    ["Filosofia", /\bfilosofia\b/, null],
    ["Sociologia", /\bsociologia\b/, null]
  ].map(([name, named, hint]) => [name, W(named), hint && W(hint)]);
  const EXTRA_HINTS = [
    [/\bsimples\b|\bf[aá]cil\b|\bb[aá]sic[ao]\b/, "Linguagem simples e direta, adequada à turma."],
    [/\bl[uú]dic[ao]\b|\bdivertid[ao]\b|\bbrincadeira\b/, "Tom lúdico e divertido."],
    [/\bcom gabarito\b/, "Inclua gabarito completo."],
    [/\bdesafiador[ao]?\b|\bdif[ií]cil\b|\bavan[cç]ad[ao]\b/, "Questões mais desafiadoras."],
    [/\bcurt[ao]\b|\brápid[ao]\b|\brapid[ao]\b/, "Material curto."],
    [/\binclus[aã]o\b|\btea\b|\bautismo\b|\bdislexia\b|\badaptad[ao]\b/, "Inclua adaptações para alunos com necessidades específicas."],
    [/\bdiagn[oó]stic[ao]\b/, "Avaliação diagnóstica: verifique o que a turma já sabe."]
  ].map(([re, hint]) => [W(re), hint]);

  function detectLevel(t) {
    const ord = "\\s*(?:º|°|o|ª|a)?\\s*";
    let m;
    if ((m = W(new RegExp("\\b([1-3])" + ord + "(?:ano|s[eé]rie)\\s+do\\s+(?:ensino\\s+)?m[eé]dio\\b")).exec(t))) return m[1] + "ª série do Ensino Médio";
    if ((m = W(new RegExp("\\b([1-3])" + ord + "s[eé]rie\\b")).exec(t)) && W(/\bm[eé]dio\b|\bem\b/).test(t)) return m[1] + "ª série do Ensino Médio";
    if ((m = W(new RegExp("\\b(\\d{1,2})" + ord + "ano\\b")).exec(t)) && +m[1] >= 1 && +m[1] <= 9) return m[1] + "º ano do Ensino Fundamental";
    const named = [
      [/\bensino m[eé]dio\b/, "Ensino Médio"],
      [/\beduca[cç][aã]o infantil\b|\bpr[eé]-?escola\b|\bmaternal\b|\binfantil\b/, "Educação Infantil"],
      [/\beja\b/, "EJA"],
      [/\bfundamental (?:i|1)\b|\banos iniciais\b/, "Anos iniciais do Ensino Fundamental"],
      [/\bfundamental (?:ii|2)\b|\banos finais\b/, "Anos finais do Ensino Fundamental"]
    ].find(([re]) => W(re).test(t));
    return named ? named[1] : "";
  }

  /** remove do texto o tipo, a turma e palavras de ligação, sobrando o tema */
  function extractTopic(text) {
    let t = " " + text + " ";
    const cut = [
      /\b(?:crie|criar|fa[cç]a|fazer|gere|gerar|monte|montar|preciso de|quero|me d[eê]|elabore|elaborar|prepare|preparar)\b/gi,
      /\b(?:uma?|umas?|uns|o|a|os|as)\s+(?=(?:apostila|lista|prova|avalia[cç][aã]o|atividade|plano|projeto|roteiro|simulado|resumo|ficha|folha|sequ[eê]ncia|v[ií]deo|desenho|anima[cç][aã]o)s?\b)/gi,
      /\b(?:v[ií]deos?(?: animados?)?|desenhos? animados?|anima[cç](?:[aã]o|[oõ]es)|curta animado)\b/gi,
      /\b(?:apostilas?|listas? de exerc[ií]cios|listas?|exerc[ií]cios|provas?|avalia[cç](?:[aã]o|[oõ]es)|atividades?(?: para imprimir)?|planos? de aula|planos?|projetos?(?: educacionais?)?|roteiros?(?: com qr ?codes?)?|simulados?|resumos?|fichas?|folhas?|sequ[eê]ncias? did[aá]ticas?)\b/gi,
      /\b(?:simples|f[aá]cil|b[aá]sic[ao]|l[uú]dic[ao]|divertid[ao]|curt[ao]|completo|completa|com gabarito|desafiador[ao]?|diagn[oó]stic[ao])\b/gi,
      /\b(?:para|pra|do|da|de|no|na)\s+(?:o|a|os|as)?\s*(?:turma\s+(?:do|da)\s+)?\d{1,2}\s*(?:º|°|o|ª|a)?\s*(?:ano|s[eé]rie)(?:\s+do\s+(?:ensino\s+)?(?:fundamental|m[eé]dio))?/gi,
      /\b(?:para|pra)\s+(?:a\s+)?(?:educa[cç][aã]o infantil|ensino m[eé]dio|ensino fundamental|eja|pr[eé]-?escola)\b/gi,
      /\b(?:com|de)\s+\d{1,2}\s+(?:quest[oõ]es|exerc[ií]cios|perguntas)\b/gi,
      /\b\d{1,2}\s*(?:º|°|o|ª|a)?\s*(?:ano|s[eé]rie)(?:\s+do\s+(?:ensino\s+)?(?:fundamental|m[eé]dio))?\b/gi,
      /\b(?:de|em)\s+(?:matem[aá]tica|portugu[eê]s|l[ií]ngua portuguesa|ci[eê]ncias|hist[oó]ria|geografia|ingl[eê]s|espanhol|arte|educa[cç][aã]o f[ií]sica|f[ií]sica|qu[ií]mica|biologia|filosofia|sociologia)\b(?=\s*(?:sobre|para|$))/gi
    ];
    cut.forEach((re) => { t = t.replace(W(re), " "); });
    t = t.replace(/\s+/g, " ").trim()
      .replace(/^(?:sobre|acerca de|a respeito de|de|do|da|para|com)\s+/i, "")
      .replace(/^(?:sobre|de|do|da)\s+/i, "")
      .replace(/^(?:o|a|os|as)\s+/i, "")
      .replace(/[\s,.;:!?-]+$/, "")
      .replace(/(?:\s+(?:para|pra|com|e|do|da|de|no|na|o|a|os|as))+$/i, "");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  }

  AV.parseRequest = function (input) {
    const text = String(input || "").replace(/\s+/g, " ").trim();
    const t = text.toLowerCase();
    const kindRule = KIND_RULES.find(([, re]) => re.test(t));
    const subject = (SUBJECTS.find(([, named]) => named.test(t)) || SUBJECTS.find(([, , hint]) => hint && hint.test(t)) || [""])[0];
    const countMatch = /\b(\d{1,2})\s+(?:quest[oõ]es|exerc[ií]cios|perguntas|itens)\b/.exec(t);
    const extra = EXTRA_HINTS.filter(([re]) => re.test(t)).map(([, hint]) => hint).join(" ");
    return {
      kind: kindRule ? kindRule[0] : "atividade",
      topic: extractTopic(text) || subject || text,
      level: detectLevel(t),
      subject,
      count: countMatch ? Math.min(40, +countMatch[1]) : 0,
      extra
    };
  };
})(globalThis.AV = globalThis.AV || {});

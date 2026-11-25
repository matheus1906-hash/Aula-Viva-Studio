(function (AV) {
  "use strict";
  /**
   * BNCC oficial (data/bncc.json): consulta por etapa, ano e componente, sugestão de habilidades
   * por tema e higienização de códigos citados pela IA. Linha da base: [codigo, etapa, sigla, anos, texto, objetos].
   */
  const CODE_RE = /\b(?:EI0[1-3][A-Z]{2}\d{2}|EF\d{2}[A-Z]{2}\d{2}|EM13[A-Z]{2,3}\d{2,3})\b/g;
  const STOP = new Set("a o e de da do das dos em no na nos nas um uma para por com sem que se ao aos as os sua seu suas seus como mais entre sobre ou ate até pelo pela pelos pelas sua isso esse essa este esta outro outra".split(" "));
  let data = null, byCode = null, loading = null;

  /* ---------------------------------------------------------------- dados */
  AV.BNCC = {
    async load() {
      if (data) return data;
      if (!loading) loading = (async () => {
        const raw = AV.BNCC_INLINE || (await (await fetch("data/bncc.json", { credentials: "omit" })).json());
        data = raw;
        byCode = new Map(raw.h.map((r) => [r[0], r]));
        return data;
      })().catch((e) => { loading = null; throw e; });
      return loading;
    },
    /** para uso síncrono depois de load() (e nos testes) */
    use(raw) { data = raw; byCode = new Map(raw.h.map((r) => [r[0], r])); return AV.BNCC; },
    ready: () => !!data,
    get: (code) => (byCode && byCode.get(String(code || "").toUpperCase())) || null,
    source: () => (data ? data.fonte : ""),
    componentName: (etapa, sigla) => (data && data.componentes[etapa + "-" + sigla]) || sigla,

    /** componentes disponíveis na etapa: [[sigla, nome]] */
    components(etapa) {
      if (!data) return [];
      return Object.keys(data.componentes).filter((k) => k.startsWith(etapa + "-")).map((k) => [k.slice(etapa.length + 1), data.componentes[k]]);
    },

    /** habilidades da etapa/ano/componente (ano: número; EI usa o grupo etário 1 a 3) */
    filter({ etapa, ano, sigla }) {
      if (!data) return [];
      return data.h.filter((r) => r[1] === etapa && (!sigla || r[2] === sigla) && (!ano || r[3].includes(+ano)));
    },

    /** traduz o texto do nível ("3º ano do Ensino Fundamental") em { etapa, ano } */
    levelInfo(level) {
      const t = String(level || "").toLowerCase();
      let m;
      if (/infantil|pr[eé]-?escola|creche|maternal|beb[eê]s|crian[cç]as/.test(t)) {
        const g = /bem pequenas|1a7m|\b2\b/.test(t) ? 2 : /beb[eê]s|\b1\b/.test(t) ? 1 : 3;
        return { etapa: "EI", ano: g };
      }
      if ((m = /([1-3])\s*[ªaº°o]?\s*(?:s[eé]rie|ano).*m[eé]dio/.exec(t))) return { etapa: "EM", ano: +m[1] };
      if (/m[eé]dio/.test(t)) return { etapa: "EM", ano: 0 };
      if ((m = /([1-9])\s*[ºo°ª]?\s*ano/.exec(t))) return { etapa: "EF", ano: +m[1] };
      return { etapa: "", ano: 0 };
    },

    /** sigla BNCC do componente a partir do nome usado no app */
    siglaFor(subject, etapa) {
      const s = String(subject || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const ef = [[/portugu|alfabetiz/, "LP"], [/matemat/, "MA"], [/ciencia|biolog|fisic(?!a)|quimic/, "CI"], [/histor/, "HI"], [/geograf/, "GE"], [/^arte|artes|musica|teatro|danca/, "AR"], [/educacao fisica/, "EF"], [/ingles|english/, "LI"], [/religios/, "ER"]];
      const em = [[/portugu|literatura|redacao/, "LP"], [/matemat/, "MAT"], [/ciencias da natureza|fisica|quimica|biolog|ciencia/, "CNT"], [/histor|geograf|filosof|sociolog|humanas/, "CHS"], [/arte|educacao fisica|ingles|espanhol|linguagens/, "LGG"]];
      if (etapa === "EF") { if (/educacao fisica/.test(s)) return "EF"; const hit = ef.find(([re]) => re.test(s)); return hit ? hit[1] : ""; }
      if (etapa === "EM") { const hit = em.find(([re]) => re.test(s)); return hit ? hit[1] : ""; }
      return "";
    },

    /** sugere as habilidades mais ligadas ao tema, dentro da lista dada */
    suggest(topic, list, n) {
      const words = tokens(topic);
      if (!words.length) return list.slice(0, n || 3);
      const scored = list.map((r) => {
        const hay = tokens(r[4] + " " + (r[5] || ""));
        let score = 0;
        for (const w of words) { const hits = hay.filter((x) => x === w || (w.length > 4 && (x.startsWith(w.slice(0, -1)) || w.startsWith(x.slice(0, -1)) && x.length > 4))).length; if (hits) score += 1 + Math.log(1 + hits); }
        return [score, r];
      }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
      return scored.slice(0, n || 3).map(([, r]) => r);
    },

    /** remove do texto qualquer código BNCC que não esteja entre os permitidos */
    sanitize(text, allowed) {
      const ok = new Set(allowed || []);
      return String(text == null ? "" : text).replace(CODE_RE, (c) => (ok.has(c) ? c : "")).replace(/\(\s*[,;]?\s*\)/g, "").replace(/\s{2,}/g, " ");
    },
    codesIn: (text) => (String(text || "").match(CODE_RE) || []),

    /** bloco fixo que abre o material com as habilidades oficiais (texto da base, não da IA) */
    block(codes) {
      const rows = (codes || []).map((c) => AV.BNCC.get(c)).filter(Boolean);
      if (!rows.length) return null;
      return { type: "callout", style: "definicao", title: "Habilidades da BNCC", text: rows.map((r) => "**" + r[0] + "**: " + r[4]).join("\n") };
    },
    CODE_RE
  };

  function tokens(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(oes|aes|ais|eis|is|es|s)$/, (m) => (w.length > 5 ? "" : m)));
  }
})(globalThis.AV = globalThis.AV || {});

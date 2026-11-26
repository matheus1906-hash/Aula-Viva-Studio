(function (AV) {
  "use strict";
  /* Idiomas da interface. O texto-fonte é português; AV.DICT.en / AV.DICT.es trazem as traduções.
     A tradução é aplicada no DOM (textos, placeholder, aria-label, title) e nunca toca o conteúdo
     dos materiais: campos de edição, prévia da folha e qualquer elemento com data-notr ficam como estão. */
  AV.DICT = AV.DICT || { en: {}, es: {} };
  AV.LANGS = { pt: ["Português", "pt-BR", "🇧🇷"], en: ["English", "en", "🇺🇸"], es: ["Español", "es", "🇪🇸"] };
  AV.lang = function () {
    const p = (AV.LS && AV.LS.get("profile", {})) || {};
    if (p.lang && AV.LANGS[p.lang]) return p.lang;
    const n = (navigator.language || "pt").slice(0, 2);
    return AV.LANGS[n] ? n : "pt";
  };
  AV.locale = () => AV.LANGS[AV.lang()][1];
  AV.t = function (s) { const l = AV.lang(); if (l === "pt" || s == null) return s; const d = AV.DICT[l] || {}; const k = String(s).trim(); return d[k] != null ? String(s).replace(k, d[k]) : s; };
  /* idioma do conteúdo gerado pela IA */
  AV.contentLangName = (code) => ({ pt: "português do Brasil", en: "inglês (English)", es: "espanhol (español)" }[code || AV.lang()] || "português do Brasil");
  AV.LABELS = {
    pt: { name: "NOME", class: "TURMA", date: "DATA", teacher: "Versão do professor", key: "Gabarito", page: "Página", of: "de", tf: "Marque V (verdadeiro) ou F (falso):", words: "Palavras: ", across: "Horizontais: ", down: "Verticais: ", answer: "Resposta: ", pb: "nova página", T: "V", F: "F" },
    en: { name: "NAME", class: "CLASS", date: "DATE", teacher: "Teacher's version", key: "Answer key", page: "Page", of: "of", tf: "Write T (true) or F (false):", words: "Words: ", across: "Across: ", down: "Down: ", answer: "Answer: ", pb: "new page", T: "T", F: "F" },
    es: { name: "NOMBRE", class: "CURSO", date: "FECHA", teacher: "Versión del profesor", key: "Respuestas", page: "Página", of: "de", tf: "Marca V (verdadero) o F (falso):", words: "Palabras: ", across: "Horizontales: ", down: "Verticales: ", answer: "Respuesta: ", pb: "nueva página", T: "V", F: "F" }
  };
  AV.docLang = (doc) => { const l = String((doc && doc.meta && doc.meta.lang) || "pt").slice(0, 2); return AV.LABELS[l] ? l : "pt"; };
  AV.L = (doc) => AV.LABELS[AV.docLang(doc)];

  const SKIP = new Set(["TEXTAREA", "INPUT", "SCRIPT", "STYLE", "SELECT", "CODE", "PRE"]);
  const ATTRS = ["placeholder", "aria-label", "title"];
  function skipEl(el) { for (let e = el; e && e !== document.body; e = e.parentElement) { if (SKIP.has(e.tagName) || (e.dataset && e.dataset.notr != null) || (e.classList && (e.classList.contains("paper") || e.classList.contains("out") || e.classList.contains("msg")))) return true; } return false; }
  function trText(node, d) {
    if (node.__pt == null) node.__pt = node.nodeValue;
    const src = node.__pt, k = src.trim();
    if (!k) return;
    const v = d ? d[k] : null;
    const next = v != null ? src.replace(k, v) : src;
    node.__tr = next;
    if (node.nodeValue !== next) node.nodeValue = next;
  }
  function trEl(el, d) {
    for (const a of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      const key = "__pt_" + a;
      if (el[key] == null) el[key] = el.getAttribute(a);
      const k = el[key].trim(), v = d ? d[k] : null;
      const next = v != null ? v : el[key];
      if (el.getAttribute(a) !== next) el.setAttribute(a, next);
    }
    if (el.tagName === "OPTION" && !(el.parentElement && el.parentElement.dataset.notr != null)) {
      const t = el.firstChild; if (t && t.nodeType === 3) trText(t, d);
    }
  }
  AV.translateTree = function (root) {
    const l = AV.lang(), d = l === "pt" ? null : AV.DICT[l];
    if (!d && !root.__wasTr) return;
    if (root.nodeType === 3) { if (!skipEl(root.parentElement)) trText(root, d); return; }
    if (root.nodeType !== 1) return;
    if (skipEl(root)) { if ((root.tagName === "INPUT" || root.tagName === "TEXTAREA" || root.tagName === "SELECT") && !(root.dataset && root.dataset.notr != null) && !skipEl(root.parentElement)) { trEl(root, d); root.querySelectorAll("option").forEach((o) => trEl(o, d)); } return; }
    root.__wasTr = true;
    trEl(root, d);
    root.querySelectorAll("[placeholder],[aria-label],[title],option").forEach((e) => { const host = e.tagName === "OPTION" ? e.parentElement : e; if (host && host.dataset && host.dataset.notr != null) return; if (!skipEl(host.parentElement)) trEl(e, d); });
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (skipEl(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = w.nextNode())) trText(n, d);
  };
  let queued = new Set(), sched = false;
  function flush() { sched = false; const q = queued; queued = new Set(); q.forEach((n) => { if (n.isConnected) AV.translateTree(n); }); }
  AV.startI18n = function () {
    document.documentElement.lang = AV.locale();
    if (AV.lang() !== "pt") AV.translateTree(document.body);
    new MutationObserver((ms) => {
      if (AV.lang() === "pt" && !document.body.__wasTr) return;
      for (const m of ms) {
        if (m.type === "characterData") { const n = m.target; if (n.nodeValue === n.__tr) continue; n.__pt = null; queued.add(n); }
        else m.addedNodes.forEach((n) => queued.add(n));
      }
      if (!sched && queued.size) { sched = true; queueMicrotask(flush); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  AV.setLang = function (l) {
    AV.setProfile({ lang: l });
    document.documentElement.lang = AV.locale();
    document.body.__wasTr = true;
    AV.translateTree(document.body);
    AV.route();
  };
})(globalThis.AV = globalThis.AV || {});

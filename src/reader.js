(function (AV) {
  "use strict";
  /* Leitor de livros em tela cheia: temas (claro, amarelado, papel, escuro, noite), tipografia,
     grifos coloridos com anotações, marcadores, sumário, busca, leitura em voz alta e progresso.
     Grifos e notas ficam presos a posições do texto desta edição e são salvos no cofre (ou só na memória no modo visitante). */
  const h = AV.h;
  const memory = new Map();
  const vaultOn = () => !!(AV.Vault && AV.Vault.unlocked() && !AV.Vault.guest);
  const get = (key, fallback) => (vaultOn() || !AV.Vault ? AV.LS.get(key, fallback) : memory.has(key) ? memory.get(key) : fallback);
  const save = (key, value) => { if (vaultOn() || !AV.Vault) AV.LS.set(key, value); else memory.set(key, value); };
  const COLORS = [["yellow", "Amarelo"], ["green", "Verde"], ["blue", "Azul"], ["pink", "Rosa"], ["purple", "Roxo"]];
  const THEMES = [["light", "Claro"], ["sepia", "Amarelado"], ["paper", "Papel"], ["dark", "Escuro"], ["night", "Noite"]];
  const FONTS = [["serif", "Serifada", 'Georgia, "Iowan Old Style", "Times New Roman", serif'], ["sans", "Sem serifa", '"Figtree", system-ui, sans-serif'], ["easy", "Leitura fácil", 'Verdana, Tahoma, "Figtree", sans-serif'], ["classic", "Clássica", '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif']];
  const DEFAULTS = { theme: "sepia", font: "serif", size: 21, line: 1.7, width: 66, align: "left", dim: 0, zoom: "100", rate: 1 };

  function paginate(text) {
    const pages = [];
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + 2200, text.length);
      if (end < text.length) {
        let cut = text.lastIndexOf("\n\n", end);
        if (cut <= start + 700) cut = text.lastIndexOf(" ", end);
        if (cut > start + 700) end = cut + 1;
        else if (text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) end--;
      }
      pages.push(text.slice(start, end));
      start = end;
    }
    return pages;
  }
  async function loadText(book, signal) {
    let response;
    if (AV.TEXTOS_INLINE) {
      const bytes = Uint8Array.from(atob(AV.TEXTOS_INLINE[book.id]), (c) => c.charCodeAt(0));
      response = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")));
    } else {
      response = await fetch("data/textos/" + encodeURIComponent(book.id) + ".txt?v=" + book.bytes, { signal, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error();
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== book.bytes) throw new Error();
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }
  /* capítulos: linhas curtas que parecem títulos (CAPÍTULO X, CHAPTER, PARTE ou só um numeral romano) */
  function chapters(pages) {
    const out = [], re = /^\s*((cap[ií]tulo|chapter|parte|part|livro|book|canto|acto|ato|escena|cena)\b[^\n]{0,60}|[IVXLC]{1,7}\.?)\s*$/i;
    pages.forEach((p, i) => {
      const lines = p.split("\n");
      lines.forEach((line, k) => {
        if (!line.trim() || !re.test(line)) return;
        if (k > 0 && lines[k - 1].trim()) return;
        const next = (lines.slice(k + 1).find((l) => l.trim()) || "").trim();
        const label = line.trim() + (next && next.length < 60 && next === next.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(next) ? " · " + next : "");
        out.push({ page: i, label });
      });
    });
    return out.length >= 2 && out.length <= 400 ? out : [];
  }
  const fmtMin = (m) => (m < 60 ? Math.max(1, Math.round(m)) + " min" : Math.floor(m / 60) + " h " + Math.round(m % 60) + " min");

  AV.readBook = async function (book) {
    const stored = get("reader-preferences", {});
    const prefs = Object.assign({}, DEFAULTS, stored);
    if (stored.paper && !stored.theme) prefs.theme = { ivory: "sepia", white: "light", sepia: "sepia", night: "night" }[stored.paper] || "sepia";
    prefs.size = +prefs.size || DEFAULTS.size;
    const records = () => get("reader-library", {});
    const edition = book.id + "/" + book.bytes;
    const record = Object.assign({ page: 0, scan: 0, bookmarks: [], highlights: [] }, records()[edition] || {});
    record.highlights.forEach((m) => { m.color = m.color || "yellow"; });
    const persist = () => { record.opened = Date.now(); save("reader-library", { ...records(), [edition]: record }); };
    const canScan = !!book.facsimile && location.protocol !== "file:";
    let mode = canScan && record.mode === "scan" ? "scan" : "text";
    let pages = null, toc = [], words = [], pdf, loading, rendering, generation = 0, closed = false, speaking = false;
    if (AV.closeDialogs) AV.closeDialogs();
    const abort = new AbortController();
    const prevFocus = document.activeElement;
    const author = (book.authors || []).join(", ");

    /* ---------- estrutura ---------- */
    const icon = (n) => AV.icon(n);
    const ib = (label, ico, action, extra) => h("button", Object.assign({ type: "button", class: "rd-ib", title: AV.t(label), "aria-label": AV.t(label), onclick: action }, extra || {}), icon(ico));
    const paper = h("article", { class: "rd-text", lang: book.lang || "pt", tabindex: "0", "data-notr": "", "aria-label": book.title });
    const sheet = h("div", { class: "rd-sheet" }, paper);
    const prevZone = h("button", { type: "button", class: "rd-zone prev", "aria-label": AV.t("Página anterior"), onclick: () => go(page() - 1) }, icon("chevron-left"));
    const nextZone = h("button", { type: "button", class: "rd-zone next", "aria-label": AV.t("Próxima página"), onclick: () => go(page() + 1) }, icon("chevron-right"));
    const stage = h("main", { class: "rd-stage" }, prevZone, sheet, nextZone);
    const pageInfo = h("span", { class: "rd-pinfo", role: "status" });
    const leftInfo = h("span", { class: "rd-left", "data-notr": "" });
    const slider = h("input", { type: "range", class: "rd-slider", min: 1, value: 1, "aria-label": AV.t("Ir à página"), oninput: (e) => { pageInfo.textContent = AV.t("Página") + " " + e.target.value + " / " + count(); }, onchange: (e) => go(e.target.valueAsNumber - 1) });
    const foot = h("footer", { class: "rd-foot" }, pageInfo, slider, leftInfo);
    const bmBtn = ib("Marcar página", "bookmark", toggleBookmark, { "aria-pressed": "false" });
    const ttsBtn = ib("Ouvir em voz alta", "volume", toggleSpeech, { "aria-pressed": "false" });
    const edSel = canScan ? h("select", { class: "rd-sel", "aria-label": AV.t("Edição"), onchange: (e) => { mode = e.target.value; record.mode = mode; persist(); draw(); } }, h("option", { value: "text", selected: mode === "text" }, AV.t("Texto")), h("option", { value: "scan", selected: mode === "scan" }, AV.t("Página original"))) : null;
    const head = h("header", { class: "rd-head" },
      h("button", { type: "button", class: "rd-back", onclick: () => close() }, icon("chevron-left"), h("span", null, AV.t("Biblioteca"))),
      h("div", { class: "rd-title" }, book.cover ? h("img", { src: book.cover, alt: "" }) : null, h("div", null, h("b", { "data-notr": "" }, book.title), h("span", { "data-notr": "" }, author + (book.year ? " · " + book.year : "")))),
      h("div", { class: "rd-actions" }, edSel,
        ib("Sumário", "list", () => openPanel("toc")), ib("Buscar no livro", "search", () => openPanel("find")),
        ib("Aparência", "type", () => openPanel("look")), ib("Grifos e anotações", "pen", () => openPanel("marks")), bmBtn, ttsBtn,
        document.fullscreenEnabled ? ib("Tela cheia", "expand", () => (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen().catch(() => {})), { "data-fs": "" }) : null));
    const panel = h("aside", { class: "rd-panel", hidden: true, tabindex: "-1" });
    const pop = h("div", { class: "rd-pop", hidden: true, role: "toolbar", "aria-label": AV.t("Marcar texto") });
    const dimLayer = h("div", { class: "rd-dim", "aria-hidden": "true" });
    const root = h("div", { class: "rd", role: "dialog", "aria-modal": "true", "aria-label": AV.t("Leitor") + ": " + book.title }, head, stage, foot, panel, pop, dimLayer);
    document.body.appendChild(root);
    document.documentElement.classList.add("rd-on");

    const page = () => (mode === "scan" ? record.scan : record.page);
    const count = () => (mode === "scan" ? book.facsimile : pages ? pages.length : 1);
    function go(i) {
      const n = Math.max(0, Math.min(count() - 1, i)), from = page();
      if (n === from) { controls(); return; }
      record[mode === "scan" ? "scan" : "page"] = n; record.mode = mode; persist();
      sheet.classList.remove("turn-l", "turn-r"); void sheet.offsetWidth; sheet.classList.add(n > from ? "turn-r" : "turn-l");
      draw(); if (speaking) speakPage();
    }
    function applyLook() {
      root.dataset.theme = prefs.theme;
      const f = FONTS.find((x) => x[0] === prefs.font) || FONTS[0];
      root.style.setProperty("--rd-font", f[2]);
      root.style.setProperty("--rd-size", prefs.size + "px");
      root.style.setProperty("--rd-line", prefs.line);
      root.style.setProperty("--rd-width", prefs.width + "ch");
      root.style.setProperty("--rd-align", prefs.align);
      root.style.setProperty("--rd-dim", prefs.dim / 100);
      root.style.setProperty("--scan-width", prefs.zoom + "%");
    }
    function setPref(k, v) { prefs[k] = v; save("reader-preferences", prefs); applyLook(); }

    /* ---------- texto e grifos ---------- */
    function draw() {
      const ticket = ++generation; if (rendering && rendering.cancel) rendering.cancel(); sheet.scrollTop = 0; hidePop();
      paper.classList.toggle("scan", mode === "scan"); controls();
      if (mode === "text") {
        const text = (pages && pages[page()]) || "";
        paper.replaceChildren(); let off = 0;
        record.highlights.filter((m) => m.page === page()).sort((a, b) => a.start - b.start).forEach((m) => {
          if (m.start < off) return;
          paper.append(text.slice(off, m.start), h("mark", { class: "c-" + m.color + (m.note ? " has-note" : ""), "data-hl": record.highlights.indexOf(m), title: m.note || "" }, text.slice(m.start, m.end)));
          off = m.end;
        });
        paper.append(text.slice(off));
        markFind();
        return;
      }
      paper.replaceChildren(h("div", { class: "rd-loading" }, h("span", { class: "spin" }), AV.t("Carregando página…")));
      (async () => {
        try {
          if (!loading) {
            const lib = await import("./reader-pdf/pdf.min.mjs");
            if (closed || ticket !== generation) return;
            lib.GlobalWorkerOptions.workerSrc = "./reader-pdf/pdf.worker.min.mjs";
            loading = lib.getDocument({ url: "data/facsimiles/" + encodeURIComponent(book.id) + ".pdf", isEvalSupported: false, enableXfa: false, useSystemFonts: true, wasmUrl: "reader-pdf/wasm/", standardFontDataUrl: "reader-pdf/standard_fonts/", cMapUrl: "reader-pdf/cmaps/", cMapPacked: true });
          }
          pdf = await loading.promise;
          const sh = await pdf.getPage(page() + 1);
          if (closed || ticket !== generation) return;
          const view = sh.getViewport({ scale: 1 });
          const surface = sh.getViewport({ scale: Math.min(2.5, 1600 / Math.max(view.width, view.height)) });
          const canvas = h("canvas", { width: Math.ceil(surface.width), height: Math.ceil(surface.height), role: "img", "aria-label": book.title + " · " + (page() + 1) });
          rendering = sh.render({ canvasContext: canvas.getContext("2d"), viewport: surface, annotationMode: 0 });
          await rendering.promise;
          if (!closed && ticket === generation) paper.replaceChildren(canvas);
        } catch (e) {
          if (!closed && ticket === generation) paper.replaceChildren(h("button", { type: "button", class: "btn", onclick: () => { if (loading) loading.destroy(); loading = null; draw(); } }, AV.t("Tentar novamente")));
        }
      })();
    }
    function controls() {
      const n = page() + 1, total = count();
      slider.max = total; slider.value = n;
      pageInfo.textContent = AV.t("Página") + " " + n + " / " + total + (mode === "text" && pages ? " · " + Math.round((n / total) * 100) + "%" : "");
      if (mode === "text" && words.length) {
        const rest = words.slice(page() + 1).reduce((a, b) => a + b, 0) / 210;
        const ch = toc.filter((c) => c.page <= page()).pop();
        leftInfo.textContent = (ch ? ch.label + " · " : "") + (rest > 0 ? fmtMin(rest) + " " + AV.t("para terminar") : AV.t("Última página"));
      } else leftInfo.textContent = "";
      bmBtn.setAttribute("aria-pressed", String(record.bookmarks.some((m) => m.page === page() && m.mode === mode)));
      prevZone.disabled = n <= 1; nextZone.disabled = n >= total;
      if (!panel.hidden && panel.dataset.kind === "marks") openPanel("marks", true);
    }
    function offsetsOf(range) {
      const before = range.cloneRange(); before.selectNodeContents(paper); before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length; return [start, start + range.toString().length];
    }
    function addHighlight(start, end, color, note) {
      const merged = { page: page(), start, end, color, note: note || "", created: Date.now() };
      record.highlights = record.highlights.filter((m) => {
        if (m.page !== page() || m.end <= start || m.start >= end) return true;
        merged.start = Math.min(merged.start, m.start); merged.end = Math.max(merged.end, m.end);
        if (m.note && !merged.note.includes(m.note)) merged.note = (m.note + (merged.note ? "\n" + merged.note : "")).trim();
        return false;
      });
      record.highlights.push(merged); prefs.lastColor = color; save("reader-preferences", prefs); persist(); draw();
      return record.highlights.indexOf(merged);
    }
    /* barra flutuante ao selecionar texto ou tocar num grifo */
    function showPop(rect, items, src) {
      pop.replaceChildren(...items); pop.hidden = false; pop.dataset.src = src || "mark";
      const w = pop.offsetWidth, ph = pop.offsetHeight;
      let y = rect.top - ph - 10;
      if (y < 64) y = rect.bottom + 10;
      pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)) + "px";
      pop.style.top = Math.max(8, Math.min(innerHeight - ph - 8, y)) + "px";
    }
    function hidePop() { pop.hidden = true; }
    const noBlur = (e) => e.preventDefault();
    const swatches = (pick, current) => COLORS.map(([c, l]) => h("button", { type: "button", class: "rd-sw c-" + c, "aria-label": AV.t(l), "aria-pressed": String(c === current), onmousedown: noBlur, onclick: () => pick(c) }));
    function selectionPop() {
      const sel = getSelection();
      if (closed || mode !== "text" || !sel || sel.isCollapsed || !sel.rangeCount || !paper.contains(sel.anchorNode) || !paper.contains(sel.focusNode)) return;
      const range = sel.getRangeAt(0), [start, end] = offsetsOf(range), txt = range.toString().trim();
      if (!txt) return;
      const done = () => { sel.removeAllRanges(); hidePop(); };
      const dict = (String(book.lang || "pt").startsWith("pt") ? "https://www.dicio.com.br/pesquisa.php?q=" : "https://" + String(book.lang).slice(0, 2) + ".wiktionary.org/wiki/") + encodeURIComponent(txt.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
      showPop(range.getBoundingClientRect(), [
        ...swatches((c) => { addHighlight(start, end, c); done(); }),
        h("span", { class: "rd-sep" }),
        h("button", { type: "button", class: "rd-pb", onmousedown: noBlur, onclick: () => { const i = addHighlight(start, end, prefs.lastColor || "yellow"); done(); editNote(i); } }, icon("pen"), h("span", null, AV.t("Anotar"))),
        h("button", { type: "button", class: "rd-pb", onmousedown: noBlur, onclick: () => { AV.copy(txt + "\n— " + book.title + (author ? ", " + author : "")); done(); } }, icon("copy"), h("span", null, AV.t("Copiar"))),
        h("button", { type: "button", class: "rd-pb", onmousedown: noBlur, onclick: () => { speak(txt); done(); } }, icon("volume"), h("span", null, AV.t("Ouvir"))),
        h("a", { class: "rd-pb", target: "_blank", rel: "noopener noreferrer", href: dict, onclick: done }, icon("book"), h("span", null, AV.t("Dicionário")))
      ], "sel");
    }
    function markPop(i, el) {
      const m = record.highlights[i]; if (!m) return;
      showPop(el.getBoundingClientRect(), [
        ...swatches((c) => { m.color = c; prefs.lastColor = c; save("reader-preferences", prefs); persist(); draw(); }, m.color),
        h("span", { class: "rd-sep" }),
        h("button", { type: "button", class: "rd-pb", onclick: () => { hidePop(); editNote(i); } }, icon("pen"), h("span", null, AV.t(m.note ? "Editar nota" : "Anotar"))),
        h("button", { type: "button", class: "rd-pb", onclick: () => { AV.copy((pages[m.page] || "").slice(m.start, m.end)); hidePop(); } }, icon("copy"), h("span", null, AV.t("Copiar"))),
        h("button", { type: "button", class: "rd-pb danger", onclick: () => { record.highlights.splice(i, 1); persist(); draw(); } }, icon("trash"), h("span", null, AV.t("Remover")))
      ]);
    }
    function editNote(i) {
      const m = record.highlights[i]; if (!m) return;
      const ta = h("textarea", { class: "in", rows: 6, maxlength: 4000, placeholder: AV.t("Sua anotação sobre este trecho…"), "aria-label": AV.t("Anotação") });
      ta.value = m.note || "";
      const quote = (pages[m.page] || "").slice(m.start, m.end);
      const d = AV.dialog(AV.t("Anotação"), h("div", { style: { display: "grid", gap: "12px" } },
        h("blockquote", { class: "rd-quote", "data-notr": "" }, quote.length > 400 ? quote.slice(0, 400) + "…" : quote), ta,
        h("div", { class: "row" }, h("span", { class: "spacer" }), h("button", { class: "btn", onclick: () => d.close() }, AV.t("Cancelar")),
          h("button", { class: "btn pri", onclick: () => { m.note = ta.value.trim(); persist(); d.close(); draw(); if (!panel.hidden) openPanel(panel.dataset.kind, true); AV.toast(AV.t("Anotação salva.")); } }, AV.t("Salvar")))));
      d.el.closest(".ovl") && d.el.closest(".ovl").classList.add("rd-over");
      setTimeout(() => ta.focus(), 30);
    }
    paper.addEventListener("mouseup", () => setTimeout(selectionPop, 10));
    paper.addEventListener("keyup", (e) => { if (e.shiftKey) selectionPop(); });
    let touchSel = null;
    paper.addEventListener("touchend", () => { clearTimeout(touchSel); touchSel = setTimeout(selectionPop, 450); });
    paper.addEventListener("click", (e) => { const mk = e.target.closest("mark[data-hl]"); if (mk && getSelection().isCollapsed) markPop(+mk.dataset.hl, mk); else if (!mk && pop.dataset.src === "mark") hidePop(); });
    const onSel = () => { const s = getSelection(); if (!pop.hidden && pop.dataset.src === "sel" && s && s.isCollapsed && !pop.matches(":hover") && !pop.contains(document.activeElement)) hidePop(); };
    document.addEventListener("selectionchange", onSel);

    /* ---------- marcadores ---------- */
    function toggleBookmark() {
      const i = record.bookmarks.findIndex((m) => m.page === page() && m.mode === mode);
      if (i < 0) { record.bookmarks.push({ page: page(), mode, created: Date.now() }); AV.toast(AV.t("Página marcada.")); } else record.bookmarks.splice(i, 1);
      persist(); controls();
    }

    /* ---------- painéis ---------- */
    function openPanel(kind, refresh) {
      if (!refresh && !panel.hidden && panel.dataset.kind === kind) { panel.hidden = true; return; }
      const scroll = refresh ? (panel.querySelector(".rd-list") || {}).scrollTop : 0;
      panel.dataset.kind = kind; panel.hidden = false; panel.replaceChildren();
      const top = (title) => h("div", { class: "rd-ph" }, h("h2", null, AV.t(title)), ib("Fechar", "x", () => (panel.hidden = true)));
      if (kind === "look") lookPanel(top);
      else if (kind === "marks") marksPanel(top);
      else if (kind === "toc") tocPanel(top);
      else findPanel(top);
      const list = panel.querySelector(".rd-list"); if (list && scroll) list.scrollTop = scroll;
      if (!refresh) setTimeout(() => (panel.querySelector("input[type=search]") || panel).focus(), 30);
    }
    function put(el, ...kids) { el.append(...kids.filter((k) => k != null)); }
    function lookPanel(top) {
      const group = (label, kids) => h("div", { class: "rd-group" }, h("span", { class: "rd-gl" }, AV.t(label)), kids);
      const seg = (key, opts) => h("div", { class: "rd-seg", role: "group", "aria-label": AV.t(key) }, opts.map(([v, l, extra]) => h("button", { type: "button", "aria-pressed": String(prefs[key] === v), style: extra || null, onclick: (e) => { setPref(key, v); e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); } }, AV.t(l))));
      const range = (key, label, min, max, step, fmt) => { const out = h("output", null, fmt(prefs[key])); return h("div", { class: "rd-range" }, h("input", { type: "range", min, max, step, value: prefs[key], "aria-label": AV.t(label), oninput: (e) => { setPref(key, +e.target.value); out.textContent = fmt(+e.target.value); } }), out); };
      put(panel, top("Aparência"),
        group("Tema", h("div", { class: "rd-themes" }, THEMES.map(([v, l]) => h("button", { type: "button", class: "rd-theme t-" + v, "aria-pressed": String(prefs.theme === v), onclick: (e) => { setPref("theme", v); panel.querySelectorAll(".rd-theme").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); } }, h("span", { class: "rd-tprev", "aria-hidden": "true" }, "Aa"), AV.t(l))))),
        group("Fonte", seg("font", FONTS.map(([v, l, f]) => [v, l, { fontFamily: f }]))),
        group("Tamanho da letra", range("size", "Tamanho da letra", 14, 36, 1, (v) => v + " px")),
        group("Espaço entre linhas", seg("line", [[1.45, "Compacto"], [1.7, "Normal"], [2, "Amplo"]])),
        group("Largura do texto", seg("width", [[52, "Estreita"], [66, "Média"], [82, "Larga"]])),
        group("Alinhamento", seg("align", [["left", "À esquerda"], ["justify", "Justificado"]])),
        group("Escurecer a tela", range("dim", "Escurecer a tela", 0, 60, 5, (v) => v + "%")),
        group("Velocidade da voz", seg("rate", [[0.8, "Devagar"], [1, "Normal"], [1.25, "Rápida"]])),
        canScan ? group("Zoom da página original", seg("zoom", [["75", "75%"], ["100", "100%"], ["150", "150%"], ["200", "200%"]])) : null,
        h("button", { type: "button", class: "btn sm", onclick: () => { Object.assign(prefs, DEFAULTS); save("reader-preferences", prefs); applyLook(); openPanel("look", true); } }, AV.t("Restaurar padrão")));
    }
    function marksPanel(top) {
      const tab = panel.dataset.tab || "highlights", color = panel.dataset.color || "";
      const body = h("div", { class: "rd-list" });
      const nOf = (k) => (k === "bookmarks" ? record.bookmarks.length : record.highlights.filter((m) => k === "highlights" || m.note).length);
      const tabs = h("div", { class: "rd-seg", role: "group" }, [["highlights", "Grifos"], ["notes", "Notas"], ["bookmarks", "Marcadores"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": String(tab === k), onclick: () => { panel.dataset.tab = k; openPanel("marks", true); } }, AV.t(l) + " (" + nOf(k) + ")")));
      const filt = tab !== "bookmarks" ? h("div", { class: "rd-filt" }, h("button", { type: "button", class: "rd-chip", "aria-pressed": String(!color), onclick: () => { panel.dataset.color = ""; openPanel("marks", true); } }, AV.t("Todas")), COLORS.map(([c, l]) => h("button", { type: "button", class: "rd-sw c-" + c, "aria-label": AV.t(l), "aria-pressed": String(color === c), onclick: () => { panel.dataset.color = color === c ? "" : c; openPanel("marks", true); } }))) : null;
      if (tab === "bookmarks") {
        [...record.bookmarks].sort((a, b) => a.page - b.page).forEach((m) => {
          if (m.mode === "scan" && !canScan) return;
          const ch = m.mode === "text" ? toc.filter((c) => c.page <= m.page).pop() : null;
          body.append(h("div", { class: "rd-item" }, h("button", { type: "button", class: "rd-go", onclick: () => jumpTo(m.mode, m.page) }, icon("bookmark"), h("span", null, h("b", null, AV.t("Página") + " " + (m.page + 1) + (m.mode === "scan" ? " · " + AV.t("Original") : "")), ch ? h("small", { "data-notr": "" }, ch.label) : null)),
            ib("Remover", "trash", () => { record.bookmarks = record.bookmarks.filter((x) => x !== m); persist(); controls(); openPanel("marks", true); })));
        });
      } else {
        record.highlights.map((m, i) => [m, i]).filter(([m]) => (tab === "highlights" || m.note) && (!color || m.color === color)).sort((a, b) => a[0].page - b[0].page || a[0].start - b[0].start).forEach(([m, i]) => {
          const q = ((pages && pages[m.page]) || "").slice(m.start, m.end);
          body.append(h("div", { class: "rd-item hl" },
            h("button", { type: "button", class: "rd-go", onclick: () => jumpTo("text", m.page) }, h("span", { class: "rd-bar c-" + m.color }), h("span", null, h("q", { "data-notr": "" }, q.length > 180 ? q.slice(0, 180) + "…" : q), m.note ? h("em", { "data-notr": "" }, m.note) : null, h("small", null, AV.t("Página") + " " + (m.page + 1)))),
            h("div", { class: "rd-item-act" }, ib(m.note ? "Editar nota" : "Anotar", "pen", () => editNote(i)), ib("Remover", "trash", () => { record.highlights.splice(i, 1); persist(); draw(); openPanel("marks", true); }))));
        });
      }
      if (!body.childElementCount) body.append(h("p", { class: "rd-empty" }, AV.t(tab === "bookmarks" ? "Nenhum marcador. Use o botão de marcador para guardar uma página." : "Selecione um trecho do texto para grifar com uma cor ou escrever uma anotação.")));
      put(panel, top("Grifos e anotações"), tabs, filt, body,
        record.highlights.length ? h("div", { class: "row" }, h("button", { type: "button", class: "btn sm", onclick: exportNotes }, icon("download"), AV.t("Exportar anotações")),
          h("button", { type: "button", class: "btn sm", onclick: () => AV.copy(notesText()) }, icon("copy"), AV.t("Copiar tudo"))) : null);
    }
    function notesText() {
      const lines = ["# " + book.title, author ? "*" + author + "*" : "", ""];
      [...record.highlights].sort((a, b) => a.page - b.page || a.start - b.start).forEach((m) => {
        lines.push("> " + ((pages && pages[m.page]) || "").slice(m.start, m.end).replace(/\s+/g, " ").trim(), "", "— " + AV.t("Página") + " " + (m.page + 1) + " · " + AV.t((COLORS.find((c) => c[0] === m.color) || COLORS[0])[1]));
        if (m.note) lines.push("", m.note);
        lines.push("", "---", "");
      });
      return lines.join("\n");
    }
    function exportNotes() { AV.saveFile("anotacoes-" + book.title.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + ".md", notesText()); }
    function tocPanel(top) {
      const body = h("div", { class: "rd-list" });
      const cur = mode === "text" ? toc.filter((x) => x.page <= page()).pop() : null;
      if (mode === "text" && toc.length) toc.forEach((c) => body.append(h("button", { type: "button", class: "rd-go toc" + (c === cur ? " cur" : ""), onclick: () => jumpTo("text", c.page) }, h("span", { "data-notr": "" }, c.label), h("small", null, String(c.page + 1)))));
      else {
        const n = count(), step = Math.max(1, Math.round(n / 20));
        for (let i = 0; i < n; i += step) body.append(h("button", { type: "button", class: "rd-go toc" + (page() >= i && page() < i + step ? " cur" : ""), onclick: () => go(i) }, h("span", null, AV.t("Página") + " " + (i + 1)), h("small", null, Math.round((i / n) * 100) + "%")));
      }
      put(panel, top("Sumário"), h("p", { class: "rd-meta" }, h("b", { "data-notr": "" }, book.title), h("br"), h("span", { "data-notr": "" }, author), words.length ? h("span", null, " · " + fmtMin(words.reduce((a, b) => a + b, 0) / 210) + " " + AV.t("de leitura")) : null), body);
      const c = body.querySelector(".cur"); if (c) setTimeout(() => c.scrollIntoView({ block: "center" }), 30);
    }
    let findTerm = "";
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    function findPanel(top) {
      const out = h("div", { class: "rd-list" });
      const input = h("input", { type: "search", class: "in", placeholder: AV.t("Palavra ou frase"), "aria-label": AV.t("Buscar no livro") });
      input.value = findTerm;
      const run = () => {
        findTerm = input.value.trim(); out.replaceChildren(); markFind();
        if (findTerm.length < 2 || !pages) return;
        const t = norm(findTerm); let total = 0;
        for (let i = 0; i < pages.length && total < 200; i++) {
          const raw = pages[i], p = norm(raw); let k = p.indexOf(t);
          while (k >= 0 && total < 200) {
            const a = Math.max(0, k - 50), b = Math.min(p.length, k + t.length + 60);
            out.append(h("button", { type: "button", class: "rd-go find", onclick: () => jumpTo("text", i) }, h("span", { "data-notr": "" }, (a ? "…" : "") + raw.slice(a, k), h("b", null, raw.slice(k, k + t.length)), raw.slice(k + t.length, b) + "…"), h("small", null, AV.t("Página") + " " + (i + 1))));
            total++; k = p.indexOf(t, k + t.length);
          }
        }
        out.prepend(h("p", { class: "rd-meta" }, total ? total + (total >= 200 ? "+" : "") + " " + AV.t("resultados") : AV.t("Nada encontrado.")));
      };
      input.addEventListener("input", AV.debounce(run, 250));
      put(panel, top("Buscar no livro"), input, out);
      if (findTerm) run();
    }
    function markFind() {
      if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
      CSS.highlights.delete("rd-find");
      if (mode !== "text" || findTerm.length < 2) return;
      const t = norm(findTerm), ranges = [];
      const walk = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT); let n;
      while ((n = walk.nextNode())) {
        const v = norm(n.nodeValue); if (v.length !== n.nodeValue.length) continue;
        let k = v.indexOf(t);
        while (k >= 0) { const r = new Range(); r.setStart(n, k); r.setEnd(n, k + t.length); ranges.push(r); k = v.indexOf(t, k + t.length); }
      }
      if (ranges.length) CSS.highlights.set("rd-find", new Highlight(...ranges));
    }
    function jumpTo(m, p) {
      if (m !== mode) { mode = m; record.mode = m; if (edSel) edSel.value = m; record[m === "scan" ? "scan" : "page"] = -1; }
      if (matchMedia("(max-width: 860px)").matches) panel.hidden = true;
      if (p === page()) draw(); else go(p);
    }

    /* ---------- leitura em voz alta ---------- */
    const voiceLang = () => ({ pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", it: "it-IT", de: "de-DE" }[String(book.lang || "pt").slice(0, 2)] || "pt-BR");
    function speak(text, onEnd) {
      if (!window.speechSynthesis) { AV.toast(AV.t("Seu navegador não tem leitura em voz alta.")); return false; }
      speechSynthesis.cancel();
      const chunks = text.replace(/\s+/g, " ").match(/[^.!?;:]{1,220}[.!?;:]*\s*/g) || [text];
      chunks.forEach((c, i) => { const u = new SpeechSynthesisUtterance(c); u.lang = voiceLang(); u.rate = prefs.rate || 1; if (i === chunks.length - 1 && onEnd) u.onend = onEnd; speechSynthesis.speak(u); });
      return true;
    }
    function speakPage() { if (mode !== "text" || !pages) return; const at = page(); speak(pages[at], () => { if (speaking && page() === at && at < count() - 1) go(at + 1); else if (page() === at) stopSpeech(); }); }
    function stopSpeech() { speaking = false; ttsBtn.setAttribute("aria-pressed", "false"); try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} }
    function toggleSpeech() {
      if (speaking) return stopSpeech();
      if (mode !== "text") { AV.toast(AV.t("A leitura em voz alta funciona no modo Texto.")); return; }
      if (!window.speechSynthesis) { AV.toast(AV.t("Seu navegador não tem leitura em voz alta.")); return; }
      speaking = true; ttsBtn.setAttribute("aria-pressed", "true"); speakPage();
    }

    /* ---------- teclado, toque e saída ---------- */
    function onKey(e) {
      if (closed) return;
      if (document.querySelector(".ovl .dlg")) return;
      if (e.key === "Escape") { if (!pop.hidden) hidePop(); else if (!panel.hidden) panel.hidden = true; else close(); return; }
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey || !pages) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(page() + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(page() - 1); }
      else if (e.key === "/") { e.preventDefault(); openPanel("find"); }
    }
    document.addEventListener("keydown", onKey);
    let tx = null;
    sheet.addEventListener("touchstart", (e) => { tx = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY, Date.now()] : null; }, { passive: true });
    sheet.addEventListener("touchend", (e) => {
      if (!tx || !getSelection().isCollapsed) { tx = null; return; }
      const dx = e.changedTouches[0].clientX - tx[0], dy = e.changedTouches[0].clientY - tx[1];
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - tx[2] < 600) go(page() + (dx < 0 ? 1 : -1));
      tx = null;
    }, { passive: true });
    function close() {
      if (closed) return; closed = true; stopSpeech(); abort.abort();
      try { if (rendering && rendering.cancel) rendering.cancel(); if (loading) loading.destroy(); } catch (e) {}
      if (window.CSS && CSS.highlights) CSS.highlights.delete("rd-find");
      document.removeEventListener("keydown", onKey); document.removeEventListener("selectionchange", onSel);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      root.remove(); document.documentElement.classList.remove("rd-on");
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }

    /* ---------- carregar ---------- */
    applyLook(); controls();
    paper.replaceChildren(h("div", { class: "rd-loading" }, book.cover ? h("img", { src: book.cover, alt: "" }) : null, h("span", { class: "spin" }), AV.t("Abrindo o livro…")));
    try {
      const text = await loadText(book, abort.signal);
      if (closed) return { close };
      pages = paginate(text);
      if (!pages.length) throw new Error();
      words = pages.map((p) => (p.match(/\S+/g) || []).length);
      toc = chapters(pages);
      if (record.page >= pages.length) record.page = 0;
      draw(); paper.focus({ preventScroll: true });
      if (!get("reader-tip", false)) { save("reader-tip", true); AV.toast(AV.t("Dica: selecione um trecho para grifar com cores, anotar, copiar ou ouvir."), 6000); }
    } catch (e) {
      if (!closed) paper.replaceChildren(h("div", { class: "rd-loading" }, h("p", null, AV.t("Não foi possível abrir o livro.")), h("button", { type: "button", class: "btn", onclick: () => { close(); AV.readBook(book); } }, AV.t("Tentar novamente"))));
    }
    return { close };
  };
})(window.AV);

(function (AV) {
  "use strict";
  const h = AV.h;
  const memory = new Map();
  function get(key, fallback) {
    return AV.Vault?.unlocked() ? AV.LS.get(key, fallback) : memory.get(key) ?? fallback;
  }
  function save(key, value) {
    if (AV.Vault?.unlocked()) AV.LS.set(key, value);
    else memory.set(key, value);
  }
  function button(label, action) {
    return h("button", { type: "button", class: "btn sm", onclick: action }, AV.t(label));
  }
  function select(label, choices, current, change) {
    const select = h("select", { "aria-label": AV.t(label), onchange: e => change(e.target.value) },
      choices.map(([value, title]) => h("option", { value, selected: value === current }, AV.t(title))));
    return h("label", { class: "reader-option" }, AV.t(label), select);
  }
  // Anchor every selection to offsets in this edition, independent of display settings.
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
      const bytes = Uint8Array.from(atob(AV.TEXTOS_INLINE[book.id]), c => c.charCodeAt(0));
      response = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")));
    } else {
      response = await fetch("data/textos/" + encodeURIComponent(book.id) + ".txt?v=" + book.bytes, { signal, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error();
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== book.bytes) throw new Error();
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }
  AV.readBook = async function (book) {
    const prefs = get("reader-preferences", { paper: "ivory", font: "serif", size: "21" });
    const records = () => get("reader-library", {});
    const edition = book.id + "/" + book.bytes;
    const record = records()[edition] || { page: 0, scan: 0, bookmarks: [], highlights: [] };
    const persist = () => save("reader-library", { ...records(), [edition]: record });
    const canScan = !!book.facsimile && location.protocol !== "file:";
    let mode = canScan && record.mode !== "text" ? "scan" : "text";
    let pages, pdf, loading, rendering, generation = 0, closed = false;
    const abort = new AbortController();
    const root = h("section", { class: "reader" });
    const paper = h("article", { class: "book-text", lang: book.lang, tabindex: "0", "data-notr": "", "aria-label": book.title });
    const viewport = h("div", { class: "reader-viewport" }, paper);
    const tools = h("div", { class: "reader-tools" });
    const nav = h("div", { class: "reader-nav" });
    const status = h("span", { class: "small", role: "status" });
    const marks = h("div", { class: "reader-marks", hidden: true });
    const markList = h("div", { class: "reader-mark-list" });
    marks.append(markList);
    const panel = h("div", { class: "reader-settings", hidden: true });
    root.append(tools, panel, marks, viewport, nav);
    const dialog = AV.dialog(book.title, root, { large: true, onClose() {
      closed = true; abort.abort(); rendering?.cancel(); loading?.destroy();
    } });
    const frame = dialog.el;
    frame.classList.add("reader-frame");
    const page = () => mode === "scan" ? record.scan : record.page;
    const count = () => mode === "scan" ? book.facsimile : pages?.length || 1;
    function go(index) {
      record[mode === "scan" ? "scan" : "page"] = Math.max(0, Math.min(count() - 1, index));
      record.mode = mode; persist(); draw();
    }
    function style() {
      frame.dataset.paper = prefs.paper;
      paper.style.fontFamily = prefs.font === "sans" ? 'system-ui, sans-serif' : 'Georgia, "Times New Roman", serif';
      paper.style.fontSize = prefs.size + "px";
      paper.style.setProperty("--scan-width", (prefs.zoom || "100") + "%");
    }
    function setPref(key, value) { prefs[key] = value; save("reader-preferences", prefs); style(); }
    panel.append(select("Papel", [["ivory","Marfim"],["white","Branco"],["sepia","Sépia"],["night","Noturno"]], prefs.paper, v => setPref("paper", v)),
      select("Fonte", [["serif","Serifada"],["sans","Sem serifa"]], prefs.font, v => setPref("font", v)),
      select("Tamanho", ["16","18","21","24","28","32"].map(s => [s,s+" px"]), prefs.size, v => setPref("size", v)));
    const textOptions = [...panel.children].slice(1);
    const zoom = select("Zoom", ["75","100","125","150","200"].map(s => [s,s+"%"]), prefs.zoom || "100", v => setPref("zoom",v));
    panel.append(zoom);
    const settings = button("Aparência", () => { panel.hidden = !panel.hidden; settings.setAttribute("aria-expanded", String(!panel.hidden)); });
    const bookmark = button("Marcar página", () => {
      const found = record.bookmarks.findIndex(m => m.page === page() && m.mode === mode);
      if (found < 0) record.bookmarks.push({ page: page(), mode });
      else record.bookmarks.splice(found, 1);
      persist(); controls();
    });
    const highlight = button("Grifar trecho", () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed || !paper.contains(selection.anchorNode) || !paper.contains(selection.focusNode)) {
        AV.toast(AV.t("Selecione um trecho do texto para grifar.")); return;
      }
      const range = selection.getRangeAt(0), before = range.cloneRange();
      before.selectNodeContents(paper); before.setEnd(range.startContainer, range.startOffset);
      let start = before.toString().length, end = start + range.toString().length;
      record.highlights = record.highlights.filter(m => {
        if (m.page !== page() || m.end < start || m.start > end) return true;
        start = Math.min(start, m.start); end = Math.max(end, m.end); return false;
      });
      record.highlights.push({ page: page(), start, end });
      selection.removeAllRanges(); persist(); draw();
    });
    highlight.addEventListener("mousedown", e => e.preventDefault());
    const list = button("Marcações", () => { marks.hidden = !marks.hidden; list.setAttribute("aria-expanded", String(!marks.hidden)); controls(); });
    tools.append(settings, bookmark, highlight, list);
    if (canScan) tools.append(select("Edição", [["scan","Página original"],["text","Transcrição"]], mode, value => {
      mode = value; record.mode = value; persist(); draw();
    }));
    const prev = button("Anterior", () => go(page() - 1)), next = button("Próxima", () => go(page() + 1));
    const jump = h("input", { type:"number", min:1, "aria-label":AV.t("Ir à página"), onchange: e => {
      const n = e.target.valueAsNumber;
      if (Number.isInteger(n)) go(n - 1); else controls();
    } });
    nav.append(prev, h("label", { class:"reader-jump" }, AV.t("Página"), jump), status, next);
    function controls() {
      prev.disabled = page() <= 0; next.disabled = page() >= count() - 1;
      jump.value = page() + 1; jump.max = count();
      status.textContent = "/ " + count();
      bookmark.setAttribute("aria-pressed", String(record.bookmarks.some(m => m.page === page() && m.mode === mode)));
      highlight.hidden = mode !== "text";
      textOptions.forEach(option => { option.hidden = mode !== "text"; });
      zoom.hidden = mode !== "scan";
      if (marks.hidden) return;
      markList.replaceChildren();
      function row(m, label, kind) {
        const target = kind === "bookmarks" ? m.mode : "text";
        if (target === "scan" && !canScan) return;
        const link = button(label, () => {
          mode = target;
          const sel = tools.querySelector("select"); if (sel) sel.value = mode;
          marks.hidden = true; list.setAttribute("aria-expanded","false"); go(m.page);
        });
        const del = button("Remover", () => { record[kind] = record[kind].filter(x => x !== m); persist(); draw(); });
        markList.append(h("div", {class:"reader-mark-row"}, link, del));
      }
      record.bookmarks.forEach(m => row(m, AV.t("Página") + " " + (m.page + 1) + (m.mode === "scan" ? " · " + AV.t("Original") : ""), "bookmarks"));
      record.highlights.forEach(m => row(m, (m.page + 1) + " · " + (pages?.[m.page] || "").slice(m.start, Math.min(m.end, m.start + 65)), "highlights"));
      if (!markList.childElementCount) markList.append(AV.t("Nenhuma marcação neste livro."));
    }
    async function draw() {
      const ticket = ++generation; rendering?.cancel(); viewport.scrollTop = 0;
      controls(); paper.classList.toggle("scan", mode === "scan");
      if (mode === "text") {
        const text = pages?.[page()] || "";
        paper.replaceChildren(); let offset = 0;
        for (const m of record.highlights.filter(m => m.page === page()).sort((a,b) => a.start-b.start)) {
          paper.append(text.slice(offset,m.start), h("mark", null, text.slice(m.start,m.end))); offset = m.end;
        }
        paper.append(text.slice(offset)); return;
      }
      paper.textContent = AV.t("Carregando página…");
      try {
        if (!loading) {
          const lib = await import("./reader-pdf/pdf.min.mjs");
          if (closed || ticket !== generation) return;
          lib.GlobalWorkerOptions.workerSrc = "./reader-pdf/pdf.worker.min.mjs";
          loading = lib.getDocument({url:"data/facsimiles/"+encodeURIComponent(book.id)+".pdf",isEvalSupported:false,enableXfa:false,useSystemFonts:true, wasmUrl:"reader-pdf/wasm/", standardFontDataUrl:"reader-pdf/standard_fonts/",cMapUrl:"reader-pdf/cmaps/",cMapPacked:true});
        }
        pdf = await loading.promise;
        const sheet = await pdf.getPage(page() + 1);
        if (closed || ticket !== generation) return;
        const view = sheet.getViewport({ scale: 1 });
        const surface = sheet.getViewport({ scale: Math.min(2.5, 1600 / Math.max(view.width,view.height)) });
        const canvas = h("canvas", { width: Math.ceil(surface.width), height: Math.ceil(surface.height), role:"img","aria-label":book.title+" · "+(page()+1) });
        rendering = sheet.render({ canvasContext:canvas.getContext("2d"),viewport:surface,annotationMode:0 });
        await rendering.promise;
        if (!closed && ticket === generation) paper.replaceChildren(canvas);
      } catch {
        if (!closed && ticket === generation) paper.replaceChildren(button("Tentar novamente", () => { loading?.destroy(); loading = null; draw(); }));
      }
    }
    frame.addEventListener("keydown", e => {
      if (!pages || /INPUT|SELECT|BUTTON/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(page() + (e.key === "ArrowRight" ? 1 : -1)); }
    });
    style(); tools.hidden = nav.hidden = true; paper.textContent = AV.t("Carregando livro…");
    try {
      const text = await loadText(book, abort.signal);
      if (closed) return;
      pages = paginate(text);
      if (!pages.length) throw new Error();
      if (record.page >= pages.length) record.page = 0;
      tools.hidden = nav.hidden = false; draw(); paper.focus();
    } catch {
      if (!closed) paper.replaceChildren(button("Tentar novamente", () => { dialog.close(); AV.readBook(book); }));
    }
  };
})(window.AV);

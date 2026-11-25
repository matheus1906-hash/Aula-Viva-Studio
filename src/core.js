(function (AV) {
  "use strict";
  AV.LIBS = AV.LIBS || {
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
    docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
    pptx: "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
    jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js",
    pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    pdfjsWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
  };
  AV.THEMES = AV.THEMES || { "Azul escolar": "#2F6FED", "Verde caderno": "#1F9D6B", "Laranja giz": "#E2762B", "Roxo ciência": "#7B4FD6", "Vermelho lousa": "#C9433A", "Grafite": "#3B4252" };
  AV.CALLOUTS = AV.CALLOUTS || { dica: ["Dica", "#2E9E6B"], atencao: ["Atenção", "#E0912F"], importante: ["Importante", "#D64545"], curiosidade: ["Curiosidade", "#6C5CE7"], definicao: ["Definição", "#2F80ED"] };

  /* hashes de integridade (SRI) das bibliotecas do CDN, gerados no build a partir das versões verificadas */
  AV.SRI = /*SRI*/{};
  const sriFor = (url) => { const key = Object.keys(AV.LIBS).find((k) => AV.LIBS[k] === url); return key && AV.SRI[key]; };

  /* ---------- utilidades ---------- */
  const loaded = {};
  AV.loadScript = function (url) {
    if (!loaded[url]) loaded[url] = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = url; s.async = true; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
      s.dataset.avTrusted = "1"; /* o Escudo só permite scripts carregados pelo próprio app */
      const integrity = sriFor(url); if (integrity) s.integrity = integrity;
      s.onload = () => ok(); s.onerror = () => { delete loaded[url]; fail(new Error("Não foi possível carregar um recurso. Verifique a internet e tente de novo.")); };
      document.head.appendChild(s);
    });
    return loaded[url];
  };
  AV.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  AV.clone = (o) => JSON.parse(JSON.stringify(o));
  AV.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  AV.safeUrl = function (u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^www\./i.test(u)) u = "https://" + u;
    try { const x = new URL(u); return ["http:", "https:", "mailto:", "tel:"].includes(x.protocol) ? x.href : ""; } catch (e) { return ""; }
  };
  AV.slug = (s) => (String(s || "material").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "material");
  AV.debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(t); return d; };
  AV.fmtDate = (t) => { try { return new Date(t).toLocaleDateString(AV.locale ? AV.locale() : "pt-BR", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return ""; } };

  /* h(): cria elementos sem innerHTML. Atributos on* recebem funções. */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "value") el.value = v;
      else if (k === "checked" || k === "selected" || k === "disabled" || k === "hidden") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) add(el, k);
      else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }
  AV.h = h;
  /* desenha listas longas em partes, sem travar a tela */
  AV.renderChunked = function (box, items, make, first) {
    const token = (box.__chunk = (box.__chunk || 0) + 1); first = first || 18;
    const put = (from, to) => { const f = document.createDocumentFragment(); for (let i = from; i < to && i < items.length; i++) f.appendChild(make(items[i], i)); box.appendChild(f); };
    put(0, first);
    let i = first; const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 16));
    const step = () => { if (box.__chunk !== token || i >= items.length) return; put(i, i + 16); i += 16; idle(step); };
    idle(step);
  };
  /* Ícones: sprite SVG inline */
  const NS = "http://www.w3.org/2000/svg";
  AV.icon = function (name, cls) {
    const s = document.createElementNS(NS, "svg"); s.setAttribute("class", "i " + (cls || "")); s.setAttribute("aria-hidden", "true");
    const u = document.createElementNS(NS, "use"); u.setAttribute("href", "#i-" + name); s.appendChild(u); return s;
  };
  /* ícone ilustrado sobre fundo colorido */
  AV.GRAD = {
    pink: "linear-gradient(135deg,#C04BD9,#E2569B)", blue: "linear-gradient(135deg,#3B82F6,#4F46E5)", sky: "linear-gradient(135deg,#0EA5E9,#2563EB)",
    teal: "linear-gradient(135deg,#0F766E,#14B8A6)", rose: "linear-gradient(135deg,#DB2777,#F472B6)", orange: "linear-gradient(135deg,#F59E0B,#EA580C)",
    slate: "linear-gradient(135deg,#334155,#64748B)", green: "linear-gradient(135deg,#059669,#34D399)", violet: "linear-gradient(135deg,#7C3AED,#A78BFA)",
    cyan: "linear-gradient(135deg,#0E7490,#22D3EE)", gray: "linear-gradient(135deg,#64748B,#94A3B8)", amber: "linear-gradient(135deg,#B45309,#F59E0B)",
    red: "linear-gradient(135deg,#DC2626,#F87171)", indigo: "linear-gradient(135deg,#4338CA,#818CF8)", lime: "linear-gradient(135deg,#4D7C0F,#A3E635)"
  };
  AV.CLR = { pink: "#C2387E", blue: "#2B5CD9", sky: "#0E7FB8", teal: "#0B6E5F", rose: "#D9446E", orange: "#E0592A", slate: "#3F4E5C", green: "#1E8A4C", violet: "#6E56CF", cyan: "#0B7E8C", gray: "#5E6D67", amber: "#C77700", red: "#D13B32", indigo: "#4B4BC9", lime: "#4D8A12", transparent: "#FFFFFF" };
  AV.appIcon = function (name, grad, cls) {
    const s = document.createElementNS(NS, "svg"); s.setAttribute("class", "ai"); s.setAttribute("aria-hidden", "true");
    const u = document.createElementNS(NS, "use"); u.setAttribute("href", "#a-" + name); s.appendChild(u);
    const sp = document.createElement("span"); sp.className = (cls || "mi") + (cls && cls !== "mi" ? " mi" : ""); sp.style.setProperty("--c", AV.CLR[grad] || (/^#/.test(grad || "") ? grad : "#0B6E5F")); sp.appendChild(s); return sp;
  };
  /* selo de arquivo para os formatos de exportação */
  AV.fileBadge = function (ext, color) {
    const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 34 42"); s.setAttribute("class", "fbadge"); s.setAttribute("aria-hidden", "true");
    const add = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; s.appendChild(e); };
    add("path", { d: "M3 1h20l10 10v28a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z", fill: "#fff", stroke: "#CBD5E1" });
    add("path", { d: "M23 1v8a2 2 0 0 0 2 2h8", fill: "#E2E8F0" });
    add("rect", { x: 0, y: 22, width: 30, height: 12, rx: 2.5, fill: color });
    add("text", { x: 15, y: 31, "text-anchor": "middle", "font-size": ext.length > 3 ? 7 : 8, "font-weight": 900, fill: "#fff", "font-family": "Nunito,sans-serif" }, ext.toUpperCase());
    return s;
  };
  /* **negrito** e *itálico* com nós de texto (seguro) */
  AV.md = function (text) {
    const frag = document.createDocumentFragment();
    String(text || "").split("\n").forEach((line, li) => {
      if (li) frag.appendChild(document.createElement("br"));
      const re = /\*\*(.+?)\*\*|\*(.+?)\*/g; let last = 0, m;
      while ((m = re.exec(line))) {
        if (m.index > last) frag.appendChild(document.createTextNode(line.slice(last, m.index)));
        const e = document.createElement(m[1] ? "strong" : "em"); e.textContent = m[1] || m[2]; frag.appendChild(e);
        last = re.lastIndex;
      }
      if (last < line.length) frag.appendChild(document.createTextNode(line.slice(last)));
    });
    return frag;
  };
  /* Texto rico simples para respostas da IA: # títulos, - listas, **negrito** */
  AV.richText = function (text) {
    const box = h("div", { class: "out" });
    String(text || "").split("\n").forEach((ln) => {
      const m = ln.match(/^\s*#{1,4}\s+(.*)$/);
      if (m) { box.appendChild(h("h4", null, AV.md(m[1].replace(/\*\*/g, "")))); return; }
      const div = h("div", null); div.appendChild(AV.md(ln.replace(/^\s*[-*]\s+/, "• "))); box.appendChild(div);
    });
    return box;
  };

  /* ---------- toasts e diálogos ---------- */
  let toastBox;
  AV.toast = function (msg, ms) {
    if (!toastBox) { toastBox = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(toastBox); }
    const t = h("div", { class: "toast" }, msg); toastBox.appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  };
  const DIALOGS = [];
  AV.closeDialogs = () => DIALOGS.slice().reverse().forEach((d) => d.close());
  AV.dialog = function (title, body, opts) {
    opts = opts || {};
    const prev = document.activeElement;
    let closed = false, down = null;
    const api = { close, el: null };
    function close() {
      if (closed) return; closed = true;
      ovl.remove(); document.removeEventListener("keydown", onKey);
      const i = DIALOGS.indexOf(api); if (i >= 0) DIALOGS.splice(i, 1);
      if (!DIALOGS.length) document.querySelectorAll(".app,.bnav,.fab").forEach((e) => (e.inert = false));
      if (prev && prev.focus && prev.isConnected) prev.focus();
      opts.onClose && opts.onClose();
    }
    const onKey = (e) => {
      if (DIALOGS[DIALOGS.length - 1] !== api) return;
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        const f = [...dlg.querySelectorAll("button,input,select,textarea,a[href],[tabindex='0']")].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const dlg = h("div", { class: "dlg" + (opts.large ? " lg" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "dlg-h" }, h("h2", null, title), h("button", { class: "btn ghost icon", "aria-label": "Fechar", onclick: close }, AV.icon("x"))),
      body);
    const ovl = h("div", { class: "ovl", onpointerdown: (e) => { down = e.target; }, onclick: (e) => { if (e.target === ovl && down === ovl) close(); } }, dlg);
    api.el = dlg;
    document.body.appendChild(ovl); document.addEventListener("keydown", onKey); DIALOGS.push(api);
    document.querySelectorAll(".app,.bnav,.fab").forEach((e) => (e.inert = true));
    setTimeout(() => { const f = dlg.querySelector("input,textarea,select,button:not(.ghost)"); f && f.focus(); }, 30);
    return api;
  };
  AV.confirm = function (title, text, okLabel) {
    return new Promise((res) => {
      let done = false;
      const d = AV.dialog(title, h("div", { style: { display: "grid", gap: "14px" } }, h("p", null, text),
        h("div", { class: "row end" }, h("button", { class: "btn", onclick: () => d.close() }, "Cancelar"),
          h("button", { class: "btn pri", onclick: () => { done = true; d.close(); } }, okLabel || "Confirmar"))),
        { onClose: () => res(done) });
    });
  };
  AV.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn.__lbl = [...btn.childNodes]; btn.disabled = true; btn.textContent = ""; btn.append(h("span", { class: "spin" }), " " + (label || "Gerando...")); }
    else { btn.disabled = false; if (btn.__lbl) { btn.replaceChildren(...btn.__lbl); btn.__lbl = null; } }
  };

  /* ---------- plataforma (capacidades do Claude) ---------- */
  const cap = (n) => (window.claude && window.claude.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null));
  AV.cap = { sample: cap("sample"), downloads: cap("downloads"), db: cap("db"), user: cap("user"), tts: cap("tts"), dictation: cap("dictation") };

  /* Salvar arquivo: capacidade downloads; sem ela, explica */
  AV.saveFile = async function (filename, data) {
    const dl = await AV.cap.downloads;
    if (!dl) {
      if (window.claude) { AV.toast("Baixar arquivos não está disponível nesta visualização."); return false; }
      const blob = data instanceof Blob ? data : new Blob([data], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob), a = h("a", { href: url, download: filename, style: { display: "none" } });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      AV.toast("Arquivo salvo: " + filename); return true;
    }
    try { await dl.save({ filename, data }); AV.toast("Arquivo enviado: " + filename); return true; }
    catch (e) {
      const c = e && e.code;
      if (c === "declined") AV.toast("Download cancelado.");
      else if (c === "too_large") AV.toast("Arquivo grande demais. Reduza imagens e tente de novo.");
      else AV.toast("Não foi possível salvar o arquivo (" + (c || "erro") + ").");
      return false;
    }
  };
  AV.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); AV.toast("Copiado."); }
    catch (e) {
      const ta = h("textarea", { class: "in", readonly: true }, text);
      AV.dialog("Copie o texto", h("div", { style: { display: "grid", gap: "8px" } }, h("p", { class: "muted small" }, "Selecione e copie (Ctrl+C)."), ta));
      setTimeout(() => ta.select(), 60);
    }
  };

  /* ---------- armazenamento: db por usuário + cópia local ---------- */
  const baseLS = {
    get(k, d) { try { const v = localStorage.getItem("av:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("av:" + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem("av:" + k); } catch (e) {} }
  };
  AV.LS = baseLS;
  /* sempre passa pelo AV.LS atual (o cofre cifrado o substitui na versão hospedada) */
  const LS = { get: (k, d) => AV.LS.get(k, d), set: (k, v) => AV.LS.set(k, v), del: (k) => AV.LS.del(k) };
  const Store = {
    docs: new Map(), ready: null, remote: null, uid: null, listeners: new Set(),
    async init() {
      (LS.get("index", []) || []).forEach((id) => { const d = LS.get("doc:" + id); if (d && d.id) this.docs.set(id, d); });
      this.emit();
      const [db, user] = await Promise.all([AV.cap.db, AV.cap.user]);
      if (!db || !user) return;
      try {
        this.uid = await user.id();
        if (!this.uid) return;
        this.remote = db.collection("data/users/" + this.uid + "/materiais");
        const timer = setTimeout(() => {}, 10000);
        const snap = await this.remote.get(); clearTimeout(timer);
        snap.docs.forEach((s) => {
          const d = s.data(); if (!d || !d.id) return;
          const local = this.docs.get(d.id);
          if (!local || (d.updated || 0) > (local.updated || 0)) { this.docs.set(d.id, d); LS.set("doc:" + d.id, d); }
        });
        this.saveIndex(); this.emit();
      } catch (e) { this.remote = null; }
    },
    list() { return [...this.docs.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0)); },
    get(id) { return this.docs.get(id); },
    saveIndex() { LS.set("index", [...this.docs.keys()]); },
    put(doc) {
      doc.updated = Date.now(); this.docs.set(doc.id, doc);
      const okLocal = LS.set("doc:" + doc.id, doc); this.saveIndex();
      if (!okLocal && !this.remote) AV.toast("Espaço do navegador cheio: o material não foi salvo. Reduza as imagens ou exporte em JSON.", 6000);
      this.pushRemote(doc, okLocal); this.emit();
    },
    timers: new Map(),
    pushRemote(doc, okLocal) {
      clearTimeout(this.timers.get(doc.id));
      this.timers.set(doc.id, setTimeout(async () => {
        this.timers.delete(doc.id);
        if (!Store.remote || !Store.docs.has(doc.id)) return;
        try {
          const json = JSON.stringify(Store.docs.get(doc.id));
          if (json.length > 250000) { AV.toast(okLocal ? "Material com imagens grandes: salvo só neste navegador." : "Material grande demais e espaço do navegador cheio: não foi salvo. Reduza as imagens.", 6000); return; }
          await Store.remote.doc(doc.id).set(JSON.parse(json));
        } catch (e) { if (!okLocal) AV.toast("Não foi possível salvar o material. Exporte em JSON para não perder.", 6000); }
      }, 900));
    },
    async remove(id) {
      clearTimeout(this.timers.get(id)); this.docs.delete(id); LS.del("doc:" + id); this.saveIndex(); this.emit();
      if (this.remote) try { await this.remote.doc(id).delete(); } catch (e) {}
    },
    async wipe() { for (const id of [...this.docs.keys()]) await this.remove(id); ["profile", "sources", "chat", "lastDoc", "agenda", "anims", "refs", "libState", "studioTopic", "insertInto", "aicfg", "cfgJump"].forEach(LS.del); },
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit() { this.listeners.forEach((f) => { try { f(); } catch (e) {} }); }
  };
  AV.Store = Store;

  /* ---------- documento ---------- */
  AV.KINDS = {
    apostila: ["Apostila", "#2563EB"], lista: ["Lista de exercícios", "#C2410C"], prova: ["Avaliação / Prova", "#334155"],
    roteiro: ["Roteiro com QR codes", "#047857"], plano: ["Plano de aula", "#7C3AED"], atividade: ["Atividade", "#BE185D"],
    projeto: ["Projeto educacional", "#0E7490"], branco: ["Em branco", "#475569"]
  };
  AV.kindFrom = function (s) {
    s = String(s || "").toLowerCase();
    if (s.includes("lista")) return "lista"; if (s.includes("prova") || s.includes("avalia")) return "prova";
    if (s.includes("roteiro")) return "roteiro"; if (s.includes("plano")) return "plano"; if (s.includes("projeto")) return "projeto";
    if (s.includes("ativ")) return "atividade"; if (s.includes("apostila")) return "apostila"; return AV.KINDS[s] ? s : "branco";
  };
  AV.BLOCKS = {
    heading: ["Título de seção", "H", "Organiza o material em partes e entra no sumário.", { text: "Nova seção", level: 1 }],
    paragraph: ["Texto", "¶", "Explicações e textos. Use **negrito** e *itálico*.", { text: "" }],
    bullets: ["Lista", "•", "Itens em tópicos.", { items: ["", ""] }],
    callout: ["Destaque", "!", "Caixa colorida: dica, atenção, curiosidade, definição.", { style: "dica", title: "Dica", text: "" }],
    image: ["Imagem", "▣", "Foto ou ilustração do computador ou celular.", { data: "", caption: "", width: 80 }],
    qrcode: ["QR code", "▦", "Leva o aluno do papel para um vídeo, site ou formulário.", { url: "", caption: "Aponte a câmera do celular", size: 34 }],
    link: ["Link / botão", "↗", "Botão clicável no PDF digital.", { label: "Acesse o material", url: "", description: "" }],
    video: ["Vídeo", "▶", "Link do YouTube, Drive ou Vimeo, com QR code.", { title: "Videoaula", url: "", mode: "link", info: "" }],
    word: ["Documento Office", "W", "Link para um Word, Excel ou PowerPoint compartilhado.", { label: "Documento complementar", url: "", mode: "link", filename: "" }],
    choice_question: ["Múltipla escolha", "◉", "Alternativas para marcar no PDF, com gabarito.", { prompt: "", options: ["", "", "", ""], correct: 0 }],
    true_false: ["Verdadeiro ou falso", "V/F", "Afirmações para marcar V ou F.", { statements: ["", ""], answers: [true, false] }],
    open_question: ["Pergunta aberta", "?", "Linhas para responder; resposta vai ao gabarito.", { prompt: "", lines: 4, answer: "" }],
    fill_blank: ["Completar lacunas", "__", "Escreva a resposta entre [colchetes].", { prompt: "Complete as frases.", text: "" }],
    match: ["Ligar colunas", "⇄", "Pares para o aluno relacionar.", { prompt: "Ligue as colunas.", left: ["", ""], right: ["", ""], answers: [0, 1] }],
    table: ["Tabela", "▤", "Linhas e colunas; a primeira linha é o cabeçalho.", { rows: [["Coluna 1", "Coluna 2"], ["", ""]] }],
    word_search: ["Caça-palavras", "▦", "Gerado pela ferramenta de atividades.", null],
    crossword: ["Cruzadinha", "✚", "Gerada pela ferramenta de atividades.", null],
    divider: ["Separador", "—", "Linha para separar partes.", {}],
    page_break: ["Quebra de página", "⤓", "Começa uma nova página.", {}]
  };
  AV.newBlock = function (type) {
    const d = AV.BLOCKS[type] && AV.BLOCKS[type][3];
    return Object.assign({ id: AV.uid(), type }, AV.clone(d || {}));
  };
  AV.newDoc = function (kind, title) {
    const p = AV.profile();
    kind = AV.KINDS[kind] ? kind : "branco";
    const doc = {
      id: AV.uid(), version: 1, updated: Date.now(),
      meta: {
        title: title || (kind === "branco" ? "Novo material" : AV.KINDS[kind][0]), subtitle: "", author: p.name || "", school: p.school || "",
        subject: p.subject || "", level: "", kind, theme: kind === "lista" ? "Laranja giz" : kind === "roteiro" ? "Verde caderno" : kind === "prova" ? "Grafite" : "Azul escolar",
        cover: kind === "apostila" || kind === "projeto", toc: kind === "apostila" || kind === "projeto", page_numbers: true,
        answer_key: kind === "lista" || kind === "prova", student_fields: ["lista", "prova", "atividade"].includes(kind),
        footer: "", protect: false, owner_password: "", allow_print: true, allow_copy: true, lang: AV.lang ? AV.lang() : "pt"
      },
      blocks: []
    };
    if (kind === "prova") doc.blocks.push(Object.assign(AV.newBlock("callout"), { style: "atencao", title: "Instruções", text: "Leia cada questão com atenção. Responda no espaço indicado." }));
    if (kind === "lista") doc.blocks.push(Object.assign(AV.newBlock("callout"), { style: "atencao", title: "Instruções", text: "Você pode marcar e escrever as respostas diretamente neste PDF." }));
    if (kind === "apostila" || kind === "branco") doc.blocks.push(AV.newBlock("heading"), AV.newBlock("paragraph"));
    if (kind === "roteiro") doc.blocks.push(Object.assign(AV.newBlock("heading"), { text: "Roteiro da aula" }), AV.newBlock("qrcode"));
    return doc;
  };
  AV.normalize = function (doc) {
    if (AV.importers && AV.importers.sanitizeDoc) { try { return AV.importers.sanitizeDoc(doc); } catch (e) {} }
    doc = doc || {}; doc.id = doc.id || AV.uid(); doc.version = 1; doc.meta = Object.assign(AV.newDoc("branco").meta, doc.meta || {});
    doc.blocks = (doc.blocks || []).filter((b) => b && AV.BLOCKS[b.type]).map((b) => Object.assign({ id: AV.uid() }, b));
    return doc;
  };
  AV.openDoc = function (doc) {
    doc = AV.normalize(doc); if (!doc.id || Store.get(doc.id) && Store.get(doc.id) !== doc) doc.id = doc.id || AV.uid();
    Store.put(doc); LS.set("lastDoc", doc.id); AV.go("editor");
  };
  AV.createAndOpen = function (kind, title, blocks, meta) {
    const d = AV.newDoc(kind, title);
    if (blocks) d.blocks = blocks; if (meta) Object.assign(d.meta, meta);
    AV.openDoc(d);
  };
  AV.docText = function (doc, max) {
    const out = [doc.meta.title, doc.meta.subtitle].filter(Boolean);
    (doc.blocks || []).forEach((b) => {
      const t = b.text || b.prompt || b.title || b.label || "";
      if (t) out.push(t);
      if (b.items) out.push(b.items.join("; ")); if (b.options) out.push(b.options.join(" | ")); if (b.statements) out.push(b.statements.join(" | "));
      if (b.rows) out.push(b.rows.map((r) => r.join(" | ")).join("\n"));
    });
    const s = out.join("\n"); return max ? s.slice(0, max) : s;
  };

  /* ---------- perfil e preferências ---------- */
  AV.profile = () => Object.assign({ name: "", school: "", subject: "", phone: "", theme: "system" }, LS.get("profile", {}));
  AV.setProfile = (p) => { LS.set("profile", Object.assign(AV.profile(), p)); AV.applyTheme(); };
  AV.isDark = () => { const a = document.documentElement.getAttribute("data-theme"); return a ? a === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  AV.toggleTheme = function () { AV.setProfile({ theme: AV.isDark() ? "light" : "dark" }); AV.toast(AV.isDark() ? "Tema escuro (lousa)" : "Tema claro (caderno)", 1500); AV.syncThemeBtns(); };
  AV.syncThemeBtns = () => document.querySelectorAll("[data-theme-btn]").forEach((b) => { const d = AV.isDark(); b.setAttribute("aria-label", d ? "Mudar para tema claro" : "Mudar para tema escuro"); b.title = b.getAttribute("aria-label"); const u = b.querySelector("use"); u && u.setAttribute("href", d ? "#i-sun" : "#i-moon"); const t = b.querySelector("[data-lbl]"); if (t) { t.textContent = d ? "Tema claro" : "Tema escuro"; t.__pt = null; } delete b["__pt_aria-label"]; delete b.__pt_title; if (AV.translateTree) AV.translateTree(b); });
  AV.applyTheme = function () {
    const t = AV.profile().theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else if (AV._themeSet) document.documentElement.removeAttribute("data-theme");
    AV._themeSet = t !== "system";
    AV.syncThemeBtns && AV.syncThemeBtns();
  };

  /* ---------- WhatsApp ---------- */
  AV.waLink = function (text, phone) {
    let d = String(phone || "").replace(/\D/g, "");
    if (d && (d.length === 10 || d.length === 11)) d = "55" + d;
    if (d && (d.length < 12 || d.length > 15)) d = "";
    return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(Array.from(String(text)).slice(0, 3500).join("")) : "");
  };
  AV.waText = function (doc, version) {
    const m = doc.meta, lines = ["*" + m.title + "*"];
    if (m.subtitle) lines.push(m.subtitle);
    if (m.subject || m.level) lines.push([m.subject, m.level].filter(Boolean).join(" · "));
    lines.push("");
    let n = 0;
    doc.blocks.forEach((b) => {
      if (b.type === "heading") lines.push("", "*" + b.text + "*");
      else if (b.type === "paragraph" || b.type === "callout") lines.push((b.title ? b.title + ": " : "") + (b.text || ""));
      else if (b.type === "bullets") b.items.forEach((i) => lines.push("• " + i));
      else if (b.type === "choice_question") { n++; lines.push("", n + ") " + b.prompt); b.options.forEach((o, i) => lines.push("   " + "abcdefgh"[i] + ") " + o + (version === "professor" && i === b.correct ? " ✅" : ""))); }
      else if (b.type === "true_false") { n++; lines.push("", n + ") Marque V ou F:"); b.statements.forEach((s, i) => lines.push("   ( " + (version === "professor" ? (b.answers[i] ? "V" : "F") : " ") + " ) " + s)); }
      else if (b.type === "open_question") { n++; lines.push("", n + ") " + b.prompt + (version === "professor" && b.answer ? "\n   Resposta: " + b.answer : "")); }
      else if (b.type === "fill_blank") { n++; lines.push("", n + ") " + b.prompt, "   " + (version === "professor" ? b.text.replace(/\[|\]/g, "") : b.text.replace(/\[[^\]]*\]/g, "______"))); }
      else if ((b.type === "link" || b.type === "video" || b.type === "qrcode" || b.type === "word") && b.url) lines.push((b.label || b.title || b.caption || "Link") + ": " + b.url);
    });
    lines.push("", "_Feito com AulaViva Studio_");
    return lines.join("\n").replace(/\n{3,}/g, "\n\n");
  };
  AV.openWhatsApp = function (text) {
    const a = h("a", { href: AV.waLink(text, AV.profile().phone), target: "_blank", rel: "noopener noreferrer" });
    document.body.appendChild(a); a.click(); a.remove();
  };
  AV.whatsSheet = function (doc) {
    const p = AV.profile();
    const phone = h("input", { class: "in", id: "wa-phone", inputmode: "tel", placeholder: "Opcional: DDD + número", value: p.phone });
    const ver = { v: "aluno" };
    const body = h("div", { style: { display: "grid", gap: "14px" } },
      h("p", { class: "muted" }, "O WhatsApp abre em uma nova aba com a mensagem pronta. Para enviar o arquivo (PDF, Word...), exporte primeiro e anexe na conversa."),
      h("label", { class: "f" }, "Enviar para (deixe vazio para escolher o contato)", phone),
      doc ? h("div", { class: "menu" },
        h("button", { onclick: () => go("aluno") }, AV.icon("send"), h("b", null, "Enviar o material (versão do aluno)"), h("span", null, "Texto do material, sem respostas")),
        h("button", { onclick: () => go("professor") }, AV.icon("check"), h("b", null, "Enviar com gabarito"), h("span", null, "Para colegas ou coordenação")),
        h("button", { onclick: () => AV.exportDialog(doc) }, AV.icon("download"), h("b", null, "Exportar arquivo para anexar"), h("span", null, "PDF, Word, PowerPoint e outros"))
      ) : null,
      h("div", { class: "menu" },
        h("button", { onclick: () => go(null, "") }, AV.icon("chat"), h("b", null, "Abrir o WhatsApp"), h("span", null, "Acesso rápido, sem mensagem")),
        h("button", { onclick: () => go(null, "Olá! Preparei um material no AulaViva Studio.") }, AV.icon("share"), h("b", null, "Mensagem rápida"), h("span", null, "Avisar a turma ou os colegas")))
    );
    const d = AV.dialog("WhatsApp", body);
    function go(version, text) {
      AV.setProfile({ phone: phone.value.trim() });
      AV.openWhatsApp(version ? AV.waText(doc, version) : text);
      d.close();
    }
  };

  /* ---------- roteador ---------- */
  AV.views = {};
  AV.go = function (name) { if (location.hash !== "#" + name) location.hash = name; else AV.route(); };
  AV.route = function () {
    const name = (location.hash || "#inicio").slice(1);
    const v = Object.prototype.hasOwnProperty.call(AV.views, name) ? name : "inicio";
    AV.closeDialogs();
    const main = document.getElementById("main");
    if (AV._cleanup) { try { AV._cleanup(); } catch (e) {} AV._cleanup = null; }
    main.textContent = "";
    document.querySelectorAll("[data-nav]").forEach((a) => a.toggleAttribute("aria-current", false));
    document.querySelectorAll('[data-nav="' + (AV.views[v].nav || v) + '"]').forEach((a) => a.setAttribute("aria-current", "page"));
    document.title = AV.views[v].title ? (AV.t ? AV.t(AV.views[v].title) : AV.views[v].title) + " · AulaViva Studio" : "AulaViva Studio";
    let r;
    try { r = AV.views[v].render(main); }
    catch (e) { console.error(e); main.textContent = ""; main.appendChild(h("div", { class: "wrap" }, h("div", { class: "empty" }, "Não foi possível abrir esta tela. ", h("a", { href: "#inicio" }, "Voltar ao início")))); }
    if (typeof r === "function") AV._cleanup = r;
    main.focus({ preventScroll: true }); window.scrollTo(0, 0);
  };
})(globalThis.AV = globalThis.AV || {});

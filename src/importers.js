(function (AV) {
  "use strict";
  AV.LIBS = AV.LIBS || {
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
    pptx: "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
    jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js",
    pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    pdfjsWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
  };
  const G = globalThis;
  const MAX_BYTES = 25 * 1024 * 1024, MAX_BLOCKS = 500, MAX_PAGES = 300;
  const KINDS = ["apostila", "lista", "prova", "roteiro", "plano", "atividade", "projeto", "branco"];
  const THEMES = ["Azul escolar", "Verde caderno", "Laranja giz", "Roxo ciência", "Vermelho lousa", "Grafite"];
  const CALLOUTS = ["dica", "atencao", "importante", "curiosidade", "definicao"];
  let seq = 0;
  const uid = () => "b" + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  const str = (v, n) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim().slice(0, n);
  const lib = async (k) => { if (AV.loadScript) await AV.loadScript(AV.LIBS[k]); };

  // ---------------------------------------------------------------- quick list
  const NUM = /^\s*(?:quest[ãa]o\s*)?(\d{1,3})\s*[).:\-–]\s*(.*)$/i;
  const OPT = /^\s*(\*|\(x\)|\[x\])?\s*\(?([a-hA-H])\s*[).]\s+(.+?)\s*(\*|✓|\(correta\)|\[correta\])?\s*$/;
  const TF = /^\s*[(\[]?\s*([VvFf])\s*[)\]:\-–]\s*(.+)$/;
  const TFS = /^\s*(?:[(\[]\s*([VvFf])\s*[)\]]|([VvFf])\s*[:\-–])\s+(.+)$/;
  const ANS = /^\s*(?:resposta|gabarito)\s*:\s*(.+)$/i;
  const LIN = /^\s*linhas\s*:\s*(\d{1,2})\s*$/i;

  function chunks(text) {
    const out = []; let cur = [];
    for (const raw of String(text).replace(/\r\n?/g, "\n").split("\n")) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) { if (cur.length) { out.push(cur); cur = []; } continue; }
      const ls = line.trimStart();
      const starts = NUM.test(line) || ls[0] === "#" || ls[0] === ">";
      if (starts && cur.length && !OPT.test(line)) { out.push(cur); cur = []; }
      cur.push(line);
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function parseQuickList(text, max) {
    max = max || 200;
    const blocks = [];
    for (const chunk of chunks(text || "")) {
      if (blocks.length >= max) break;
      const first = chunk[0].trim();
      if (first[0] === "#") {
        blocks.push({ id: uid(), type: "heading", text: first.replace(/^#+/, "").trim().slice(0, 200) || "Seção", level: first.startsWith("##") ? 2 : 1 });
        if (chunk.length > 1) blocks.push(...parseQuickList(chunk.slice(1).join("\n")));
        continue;
      }
      if (first[0] === ">") {
        blocks.push({ id: uid(), type: "callout", style: "atencao", title: "Instruções",
          text: chunk.map((l) => l.trim().replace(/^>+/, "").trim()).join("\n").slice(0, 4000) });
        continue;
      }
      const m = NUM.exec(first);
      const pl = [m ? m[2] : first];
      const options = [], statements = [], answers = [];
      let correct = -1, answer = "", lines = null, mm;
      for (const ln of chunk.slice(1)) {
        if (!options.length && (mm = TFS.exec(ln))) { statements.push(mm[3].trim()); answers.push((mm[1] || mm[2]).toUpperCase() === "V"); }
        else if (!statements.length && (mm = OPT.exec(ln))) { if (mm[1] || mm[4]) correct = options.length; options.push(mm[3].trim()); }
        else if (!options.length && (mm = TF.exec(ln))) { statements.push(mm[2].trim()); answers.push(mm[1].toUpperCase() === "V"); }
        else if ((mm = ANS.exec(ln))) answer = mm[1].trim();
        else if ((mm = LIN.exec(ln))) lines = parseInt(mm[1], 10);
        else if (!options.length && !statements.length) pl.push(ln.trim());
      }
      const prompt = pl.filter(Boolean).join(" ").trim().slice(0, 2000);
      if (options.length >= 2) {
        const b = { id: uid(), type: "choice_question", prompt, options: options.slice(0, 8), correct: correct < 8 ? correct : -1 };
        if (correct < 0 && answer) {
          const L = answer.trim().slice(0, 1).toUpperCase();
          if (L >= "A" && L <= "H" && L.charCodeAt(0) - 65 < options.length) b.correct = L.charCodeAt(0) - 65;
        }
        blocks.push(b);
      } else if (statements.length) {
        blocks.push({ id: uid(), type: "true_false", statements: statements.slice(0, 15), answers: answers.slice(0, 15) });
      } else {
        blocks.push({ id: uid(), type: "open_question", prompt, answer: answer.slice(0, 4000), lines: Math.max(1, Math.min(lines || 4, 12)) });
      }
    }
    return blocks;
  }

  // ---------------------------------------------------------------- text heuristics
  const BUL = /^\s*(?:[-•▪●◦*–]|\d{1,2}[.)])\s+(.+)$/;
  function textToBlocks(text, opts) {
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
    const blocks = []; let para = [], bullets = [];
    const fp = () => { if (para.length) { const t = para.join(" ").trim(); if (t) blocks.push({ id: uid(), type: "paragraph", text: t }); para = []; } };
    const fb = () => { if (bullets.length) { blocks.push({ id: uid(), type: "bullets", items: bullets.slice(0, 40) }); bullets = []; } };
    const n = lines.length;
    // a line is a heading candidate: short, no final punctuation, isolated by blank lines
    const isHead = (i) => {
      const t = lines[i].trim();
      if (!t || t.length > 80 || /[.!?:;,]$/.test(t) || BUL.test(t) || NUM.test(t) || OPT.test(t) || TFS.test(t)) return false;
      return (i === 0 || !lines[i - 1].trim()) && (i === n - 1 || !lines[i + 1].trim()) && t.split(/\s+/).length <= 12;
    };
    let i = 0;
    while (i < n && blocks.length < MAX_BLOCKS) {
      const line = lines[i];
      if (!line.trim()) { fp(); fb(); i++; continue; }
      const ls = line.trimStart();
      if (ls[0] === "#" || ls[0] === ">") {
        fp(); fb();
        let j = i + 1;
        while (j < n && lines[j].trim() && lines[j].trimStart()[0] === ls[0] && ls[0] === ">") j++;
        blocks.push(...parseQuickList(lines.slice(i, ls[0] === ">" ? j : i + 1).join("\n")));
        i = ls[0] === ">" ? j : i + 1; continue;
      }
      if (NUM.test(line)) {
        let j = i + 1;
        while (j < n && lines[j].trim() && !NUM.test(lines[j]) && !(OPT.test(lines[j]) || TFS.test(lines[j]))) j++;
        let k = j, opts = 0;
        while (k < n && lines[k].trim() && (OPT.test(lines[k]) || TFS.test(lines[k]) || /^\s*(resposta|gabarito):/i.test(lines[k]))) { opts++; k++; }
        if (opts >= 2) { fp(); fb(); blocks.push(...parseQuickList(lines.slice(i, k).join("\n"))); i = k; continue; }
      }
      const m = BUL.exec(line);
      if ((m && !NUM.test(line)) || (m && line.length < 140 && bullets.length)) { fp(); bullets.push(m[1].trim().slice(0, 1000)); i++; continue; }
      if (isHead(i)) { fp(); fb(); blocks.push({ id: uid(), type: "heading", text: line.trim(), level: 2 }); i++; continue; }
      fb(); para.push(line.trim());
      if (/[.!?:;]$/.test(line.trim())) fp();
      i++;
    }
    fp(); fb();
    const title = str(opts && opts.title, 200) || "Material importado";
    return { title, blocks };
  }

  // ---------------------------------------------------------------- sanitizeDoc
  const safeUrl = (u) => {
    u = str(u, 2000);
    return /^(https?:\/\/|mailto:|tel:)[^\s<>"']+$/i.test(u) ? u : "";
  };
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d; };
  const strs = (a, n, len) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => str(x, len));
  const txt = (v, n) => (typeof v === "string" ? v : "").slice(0, n).trim();
  const IMG = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

  function sanitizeBlock(b) {
    if (!b || typeof b !== "object" || Array.isArray(b)) return null;
    const id = str(b.id, 64) || uid();
    switch (b.type) {
      case "heading": return { id, type: "heading", text: txt(b.text, 300), level: b.level === 2 ? 2 : 1 };
      case "paragraph": return { id, type: "paragraph", text: txt(b.text, 20000) };
      case "bullets": return { id, type: "bullets", items: strs(b.items, 100, 2000) };
      case "callout": return { id, type: "callout", style: CALLOUTS.includes(b.style) ? b.style : "dica", title: txt(b.title, 100), text: txt(b.text, 4000) };
      case "image": {
        const data = typeof b.data === "string" && IMG.test(b.data) ? b.data : "";
        return { id, type: "image", data, caption: txt(b.caption, 300), width: num(b.width, 20, 100, 70) };
      }
      case "qrcode": return { id, type: "qrcode", url: safeUrl(b.url), caption: txt(b.caption, 200), size: num(b.size, 20, 60, 30) };
      case "link": return { id, type: "link", label: txt(b.label, 200), url: safeUrl(b.url), description: txt(b.description, 500) };
      case "word": return { id, type: "word", label: txt(b.label, 200), url: safeUrl(b.url), mode: "link", filename: txt(b.filename, 200) };
      case "video": return { id, type: "video", title: txt(b.title, 200), url: safeUrl(b.url), mode: "link", info: txt(b.info, 200) };
      case "open_question": return { id, type: "open_question", prompt: txt(b.prompt, 2000), lines: num(b.lines, 1, 12, 4), answer: txt(b.answer, 4000) };
      case "choice_question": {
        const options = strs(b.options, 8, 500);
        const c = Number.isInteger(b.correct) && b.correct >= 0 && b.correct < options.length ? b.correct : -1;
        return { id, type: "choice_question", prompt: txt(b.prompt, 2000), options, correct: c };
      }
      case "true_false": {
        const statements = strs(b.statements, 15, 1000);
        const a = Array.isArray(b.answers) ? b.answers : [];
        return { id, type: "true_false", statements, answers: statements.map((_, i) => a[i] === true) };
      }
      case "table": {
        const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 100).map((r) => strs(r, 12, 1000)).filter((r) => r.length);
        const w = Math.max(0, ...rows.map((r) => r.length));
        return { id, type: "table", rows: rows.map((r) => r.concat(Array(w - r.length).fill(""))) };
      }
      case "divider": case "page_break": return { id, type: b.type };
      case "word_search": {
        const grid = (Array.isArray(b.grid) ? b.grid : []).slice(0, 40).map((r) => (Array.isArray(r) ? r : []).slice(0, 40).map((c) => str(c, 1).toUpperCase()));
        const solution = (Array.isArray(b.solution) ? b.solution : []).slice(0, 100).filter((s) => s && typeof s === "object").map((s) => ({
          word: str(s.word, 60),
          cells: (Array.isArray(s.cells) ? s.cells : []).slice(0, 60).filter((c) => Array.isArray(c) && c.length === 2).map((c) => [num(c[0], 0, 39, 0), num(c[1], 0, 39, 0)])
        }));
        return { id, type: "word_search", title: txt(b.title, 200), words: strs(b.words, 100, 60), grid, solution };
      }
      case "crossword": {
        const grid = (Array.isArray(b.grid) ? b.grid : []).slice(0, 40).map((r) => (Array.isArray(r) ? r : []).slice(0, 40).map((c) => {
          if (!c || typeof c !== "object") return null;
          const o = { letter: str(c.letter, 1).toUpperCase() };
          if (Number.isFinite(c.number)) o.number = num(c.number, 0, 999, 0);
          else if (c.number === null) o.number = null;
          return o;
        }));
        const cl = (a) => (Array.isArray(a) ? a : []).slice(0, 60).filter((x) => x && typeof x === "object")
          .map((x) => ({ n: num(x.n, 0, 999, 0), clue: txt(x.clue, 500), answer: str(x.answer, 60) }));
        const c = b.clues && typeof b.clues === "object" ? b.clues : {};
        return { id, type: "crossword", title: txt(b.title, 200), grid, clues: { across: cl(c.across), down: cl(c.down) } };
      }
      case "match": {
        const left = strs(b.left, 30, 500), right = strs(b.right, 30, 500), a = Array.isArray(b.answers) ? b.answers : [];
        return { id, type: "match", prompt: txt(b.prompt, 2000), left, right,
          answers: left.map((_, i) => (Number.isInteger(a[i]) && a[i] >= 0 && a[i] < right.length ? a[i] : -1)) };
      }
      case "fill_blank": return { id, type: "fill_blank", prompt: txt(b.prompt, 2000), text: txt(b.text, 8000) };
    }
    return null;
  }

  function sanitizeDoc(obj) {
    const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    const m = o.meta && typeof o.meta === "object" ? o.meta : {};
    const bool = (v, d) => (typeof v === "boolean" ? v : d);
    const meta = {
      title: txt(m.title, 200) || "Sem título", subtitle: txt(m.subtitle, 200), author: txt(m.author, 120),
      school: txt(m.school, 160), subject: txt(m.subject, 120), level: txt(m.level, 120),
      kind: KINDS.includes(m.kind) ? m.kind : "apostila", theme: THEMES.includes(m.theme) ? m.theme : THEMES[0],
      cover: bool(m.cover, false), toc: bool(m.toc, false), page_numbers: bool(m.page_numbers, true),
      answer_key: bool(m.answer_key, false), student_fields: bool(m.student_fields, false),
      footer: txt(m.footer, 200), protect: bool(m.protect, false), owner_password: str(m.owner_password, 100),
      allow_print: bool(m.allow_print, true), allow_copy: bool(m.allow_copy, true), lang: ["pt", "en", "es"].includes(String(m.lang || "").slice(0, 2)) ? String(m.lang).slice(0, 2) : "pt"
    };
    const seen = new Set(), blocks = [];
    for (const b of (Array.isArray(o.blocks) ? o.blocks : []).slice(0, 2000)) {
      const s = sanitizeBlock(b);
      if (!s) continue;
      while (seen.has(s.id)) s.id = uid();
      seen.add(s.id); blocks.push(s);
    }
    return { id: str(o.id, 64) || uid(), version: 1, updated: Number.isFinite(o.updated) ? o.updated : Date.now(), meta, blocks };
  }

  // ---------------------------------------------------------------- video links
  function videoLink(url) {
    let u = str(url, 2000);
    if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
    let p; try { p = new URL(u); } catch (e) { return { title: "", url: "", info: "" }; }
    if (!/^https?:$/.test(p.protocol)) return { title: "", url: "", info: "" };
    const h = p.hostname.replace(/^(www|m)\./, "");
    const secs = (t) => {
      if (!t) return 0;
      if (/^\d+$/.test(t)) return +t;
      const r = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
      return r ? (+r[1] || 0) * 3600 + (+r[2] || 0) * 60 + (+r[3] || 0) : 0;
    };
    const fmt = (s) => { const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
      return (hh ? hh + ":" + String(mm).padStart(2, "0") : mm) + ":" + String(ss).padStart(2, "0"); };
    if (h === "youtu.be" || h.endsWith("youtube.com") || h === "youtube-nocookie.com") {
      let id = "";
      const parts = p.pathname.split("/").filter(Boolean);
      if (h === "youtu.be") id = parts[0] || "";
      else if (p.pathname === "/watch") id = p.searchParams.get("v") || "";
      else if (["shorts", "embed", "live", "v"].includes(parts[0])) id = parts[1] || "";
      if (/^[\w-]{6,20}$/.test(id)) {
        const t = secs(p.searchParams.get("t") || p.searchParams.get("start") || (p.hash.match(/t=([\w]+)/) || [])[1]);
        const url2 = "https://www.youtube.com/watch?v=" + id + (t ? "&t=" + t + "s" : "");
        return { title: "Vídeo do YouTube", url: url2, info: "YouTube" + (t ? " · a partir de " + fmt(t) : "") };
      }
      return { title: "Vídeo do YouTube", url: p.href, info: "YouTube" };
    }
    if (h === "vimeo.com" || h === "player.vimeo.com") {
      const id = (p.pathname.match(/\/(\d{4,})/) || [])[1];
      return { title: "Vídeo do Vimeo", url: id ? "https://vimeo.com/" + id : p.href, info: "Vimeo" };
    }
    if (h === "drive.google.com") {
      const id = (p.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || p.searchParams.get("id");
      return { title: "Vídeo do Google Drive", url: id ? "https://drive.google.com/file/d/" + id + "/view" : p.href, info: "Google Drive" };
    }
    return { title: "Vídeo", url: p.href, info: p.hostname };
  }

  // ---------------------------------------------------------------- format helpers
  const cleanLine = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad\u200b]/g, "").replace(/\u00a0/g, " ");

  function decodeText(buf) {
    const u = new Uint8Array(buf);
    if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder("utf-16le").decode(u.subarray(2));
    if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder("utf-16be").decode(u.subarray(2));
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u).replace(/^\uFEFF/, ""); }
    catch (e) { return new TextDecoder("windows-1252").decode(u); }
  }

  function rtfToText(rtf) {
    const dest = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "header", "footer", "object", "themedata",
      "datastore", "latentstyles", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "fldinst"]);
    const out = [], stack = []; let skip = false, i = 0, uc = 1;
    const n = rtf.length, re = /\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\([^a-zA-Z])/y;
    while (i < n) {
      const ch = rtf[i];
      if (ch === "{") { stack.push([skip, uc]); i++; }
      else if (ch === "}") { const s = stack.pop(); if (s) { skip = s[0]; uc = s[1]; } i++; }
      else if (ch === "\\") {
        re.lastIndex = i; const m = re.exec(rtf);
        if (!m) { i++; continue; }
        i = re.lastIndex;
        if (skip) continue;
        if (m[3]) out.push(new TextDecoder("windows-1252").decode(Uint8Array.of(parseInt(m[3], 16))));
        else if (m[4]) {
          if (m[4] === "*") skip = true;
          else if ("\\{}".includes(m[4])) out.push(m[4]);
          else if (m[4] === "~") out.push(" ");
        } else if (dest.has(m[1])) skip = true;
        else if (["par", "line", "sect", "page"].includes(m[1])) out.push("\n");
        else if (m[1] === "tab") out.push("\t");
        else if (m[1] === "endash") out.push("–");
        else if (m[1] === "emdash") out.push("—");
        else if (m[1] === "bullet") out.push("•");
        else if (m[1] === "uc" && m[2]) uc = +m[2];
        else if (m[1] === "u" && m[2]) { out.push(String.fromCharCode((+m[2] + 65536) % 65536)); i += uc; }
      } else { if (!skip && ch !== "\r" && ch !== "\n") out.push(ch); i++; }
    }
    return out.join("");
  }

  const CUE = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/;
  function subtitlesToText(raw) {
    const out = []; let last = "", cur = [];
    const flush = () => { if (cur.length) { out.push(cur.join(" ")); cur = []; } };
    for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
      let t = line.trim();
      if (!t || /^\d+$/.test(t) || /^(WEBVTT|NOTE|STYLE|REGION|KIND:|LANGUAGE:)/i.test(t) || CUE.test(t)) continue;
      t = t.replace(/<[^>]{1,40}>/g, "").replace(/\{\\[^}]{0,40}\}/g, "").trim();
      if (!t || t === last) continue;
      last = t; cur.push(t);
      if (cur.join(" ").length > 600 && /[.!?]$/.test(t)) flush();
    }
    flush();
    return out.join("\n\n");
  }

  function htmlToBlocks(html) {
    const blocks = [];
    const dec = (s) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16))).replace(/&amp;/g, "&");
    const inline = (h) => dec(h.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**").replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<img[^>]*>/gi, "").replace(/<[^>]+>/g, "")).replace(/\*\*\s*\*\*/g, "").trim();
    const imgs = (h) => { const r = []; h.replace(/<img\b[^>]*?src="(data:image\/[^"]+)"[^>]*?(?:alt="([^"]*)")?[^>]*>/gi, (_, s, a) => { r.push({ s, a: a || "" }); return ""; }); return r; };
    let lines = [], bl = [];
    const flushText = () => { if (lines.length) { blocks.push(...textToBlocks(lines.join("\n")).blocks); lines = []; } };
    const flushB = () => { if (bl.length) { blocks.push({ id: uid(), type: "bullets", items: bl }); bl = []; } };
    // sequential scan over top-level-ish elements
    let pos = 0; const s = html;
    const tag = /<(h[1-6]|p|ul|ol|table)\b[^>]*>/gi; let m;
    while ((m = tag.exec(s)) && blocks.length < MAX_BLOCKS) {
      const name = m[1].toLowerCase(), end = s.indexOf("</" + name + ">", tag.lastIndex);
      if (end < 0) continue;
      const inner = s.slice(tag.lastIndex, end); tag.lastIndex = end + name.length + 3;
      if (/^h[1-6]$/.test(name)) {
        flushB(); flushText();
        const t = inline(inner).replace(/\*\*/g, "");
        if (t) blocks.push({ id: uid(), type: "heading", text: t, level: name === "h1" ? 1 : 2 });
        for (const im of imgs(inner)) blocks.push({ id: uid(), type: "image", data: im.s, caption: "", width: 70 });
      } else if (name === "p") {
        for (const im of imgs(inner)) { flushB(); flushText(); blocks.push({ id: uid(), type: "image", data: im.s, caption: im.a, width: 70 }); }
        const t = inline(inner);
        if (t) { flushB(); lines.push(t); } else lines.push("");
      } else if (name === "ul" || name === "ol") {
        flushText();
        const items = []; inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, x) => { items.push(x); return ""; });
        for (const x of items) { for (const im of imgs(x)) blocks.push({ id: uid(), type: "image", data: im.s, caption: "", width: 70 }); }
        const its = items.map(inline).filter(Boolean);
        if (its.length) blocks.push({ id: uid(), type: "bullets", items: its });
      } else if (name === "table") {
        flushB(); flushText();
        const rows = []; inner.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_, r) => {
          const cells = []; r.replace(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi, (__, c) => { cells.push(inline(c)); return ""; });
          if (cells.some(Boolean)) rows.push(cells.slice(0, 12)); return "";
        });
        if (rows.length) blocks.push({ id: uid(), type: "table", rows: rows.slice(0, 100) });
      }
    }
    flushB(); flushText();
    return blocks;
  }

  const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16))).replace(/&amp;/g, "&");
  // text of an ODF fragment: spans flattened, text:s -> space, text:tab -> tab, text:line-break -> newline
  const odfText = (x) => unxml(x.replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, c) => " ".repeat(+c || 1)).replace(/<text:tab\s*\/>/g, "\t")
    .replace(/<text:line-break\s*\/>/g, "\n").replace(/<[^>]+>/g, "")).trim();

  async function zipOf(buf, warnings) {
    await lib("jszip");
    const zip = await G.JSZip.loadAsync(buf);
    if (Object.keys(zip.files).some((n) => /vbaproject\.bin$/i.test(n))) throw new Error("Documentos com macros não são importados por segurança.");
    return zip;
  }

  async function importDocx(buf, res) {
    await zipOf(buf);
    await lib("mammoth");
    const r = await G.mammoth.convertToHtml({ arrayBuffer: buf });
    res.blocks = htmlToBlocks(r.value || "");
    (r.messages || []).slice(0, 3).forEach((m) => m.type === "warning" && res.warnings.push("Word: " + m.message));
    const h = res.blocks.find((b) => b.type === "heading");
    if (h) res.title = h.text;
  }

  async function importOdt(buf, res) {
    const zip = await zipOf(buf);
    const f = zip.file("content.xml");
    if (!f) throw new Error("Arquivo do LibreOffice inválido.");
    const xml = await f.async("string");
    const body = (xml.match(/<office:text\b[^>]*>([\s\S]*)<\/office:text>/) || [, xml])[1];
    const blocks = []; let lines = [];
    const flush = () => { if (lines.length) { blocks.push(...textToBlocks(lines.join("\n")).blocks); lines = []; } };
    const tag = /<(text:h|text:p|text:list|table:table)(?=[\s>\/])([^>]*?)(\/>|>)/g; let m;
    while ((m = tag.exec(body)) && blocks.length < MAX_BLOCKS) {
      if (m[3] === "/>") continue;
      const name = m[1];
      // find the matching close tag (handles nesting of the same tag name)
      const open = new RegExp("<" + name + "(?=[\\s>/])[^>]*?(/?)>|</" + name + ">", "g"); open.lastIndex = tag.lastIndex;
      let depth = 1, e, endIdx = -1;
      while ((e = open.exec(body))) { if (e[0][1] === "/") { if (!--depth) { endIdx = e.index; break; } } else if (!e[1]) depth++; }
      if (endIdx < 0) continue;
      const inner = body.slice(tag.lastIndex, endIdx); tag.lastIndex = endIdx + name.length + 3;
      if (name === "text:h") {
        flush(); const t = odfText(inner);
        const lv = (m[2].match(/text:outline-level="(\d+)"/) || [])[1];
        if (t) blocks.push({ id: uid(), type: "heading", text: t, level: lv && lv !== "1" ? 2 : 1 });
      } else if (name === "text:p") lines.push(odfText(inner));
      else if (name === "text:list") {
        flush(); const items = [];
        inner.replace(/<text:list-item\b[^>]*>([\s\S]*?)<\/text:list-item>/g, (_, x) => { const t = odfText(x); if (t) items.push(t); return ""; });
        if (items.length) blocks.push({ id: uid(), type: "bullets", items });
      } else {
        flush(); const rows = [];
        inner.replace(/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g, (_, r) => {
          const cells = []; r.replace(/<table:table-cell\b[^>]*>([\s\S]*?)<\/table:table-cell>/g, (__, c) => { cells.push(odfText(c)); return ""; });
          if (cells.some(Boolean)) rows.push(cells.slice(0, 12)); return "";
        });
        if (rows.length) blocks.push({ id: uid(), type: "table", rows: rows.slice(0, 100) });
      }
    }
    flush();
    res.blocks = blocks;
  }

  async function importPptx(buf, res) {
    const zip = await zipOf(buf);
    const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/(\d+)\.xml$/)[1], 10) - parseInt(b.match(/(\d+)\.xml$/)[1], 10));
    const blocks = [];
    let k = 0;
    for (const name of names) {
      if (blocks.length >= MAX_BLOCKS) break;
      k++;
      const xml = await zip.file(name).async("string");
      const paras = [];
      xml.replace(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g, (_, p) => {
        let t = ""; p.replace(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>|<a:br\s*\/>/g, (__, x) => { t += x === undefined ? "\n" : unxml(x); return ""; });
        t = t.trim(); if (t) paras.push(t); return "";
      });
      if (!paras.length) continue;
      blocks.push({ id: uid(), type: "heading", text: paras[0].replace(/\s+/g, " ").slice(0, 200), level: 1 });
      if (paras.length > 1) blocks.push({ id: uid(), type: "bullets", items: paras.slice(1, 41) });
    }
    res.blocks = blocks;
    if (blocks[0]) res.title = blocks[0].text;
  }

  async function importPdf(buf, res) {
    await lib("pdfjs");
    const pdfjs = G.pdfjsLib;
    if (!pdfjs) throw new Error("Leitor de PDF indisponível.");
    try { pdfjs.GlobalWorkerOptions.workerSrc = AV.LIBS.pdfjsWorker; } catch (e) { /* ignore */ }
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    if (pdf.numPages > pages) res.warnings.push("Apenas as primeiras " + MAX_PAGES + " páginas foram importadas.");
    const out = [];
    for (let p = 1; p <= pages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      let line = "", y = null; const ls = [];
      for (const it of tc.items) {
        if (typeof it.str !== "string") continue;
        const yy = it.transform ? Math.round(it.transform[5]) : 0;
        if (y !== null && Math.abs(yy - y) > 2) { ls.push(line); line = ""; }
        line += it.str; y = yy;
        if (it.hasEOL) { ls.push(line); line = ""; y = null; }
      }
      ls.push(line);
      // join wrapped lines: a line ending without punctuation continues in the next one
      let para = "";
      for (const l of ls.map((x) => x.trim())) {
        if (!l) { if (para) { out.push(para); para = ""; } out.push(""); continue; }
        if (para && (BUL.test(l) || NUM.test(l) || OPT.test(l) || /[.!?:;]$/.test(para) && /^[A-ZÀ-Ú]/.test(l))) { out.push(para); para = ""; }
        para = para ? (/-$/.test(para) ? para.slice(0, -1) + l : para + " " + l) : l;
        if (para.length > 90 && /[.!?]$/.test(para)) { out.push(para); para = ""; }
      }
      if (para) out.push(para);
      out.push("");
    }
    const text = out.join("\n");
    if (!text.trim()) throw new Error("Este PDF não tem texto selecionável (parece ser imagem escaneada).");
    res.text = text;
    res.blocks = textToBlocks(text).blocks;
  }

  const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  function b64(buf) {
    const u = new Uint8Array(buf);
    if (typeof Buffer !== "undefined") return Buffer.from(u).toString("base64");
    let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function importImage(buf, ext, res) {
    const orig = "data:" + MIME[ext] + ";base64," + b64(buf);
    let data = orig;
    if (typeof document !== "undefined" && typeof Image !== "undefined" && ext !== "gif") {
      try {
        const url = URL.createObjectURL(new Blob([buf], { type: MIME[ext] }));
        const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
        URL.revokeObjectURL(url);
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        if (k < 1 || buf.byteLength > 1.5e6) {
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * (k < 1 ? k : 1))); c.height = Math.max(1, Math.round(img.height * (k < 1 ? k : 1)));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const d = c.toDataURL(ext === "png" ? "image/png" : "image/jpeg", 0.85);
          if (d.length < orig.length || k < 1) data = d;
        }
      } catch (e) { data = orig; }
    }
    res.blocks = [{ id: uid(), type: "image", data, caption: res.title, width: 90 }];
  }

  async function importFile(file) {
    if (!file || typeof file.name !== "string") throw new Error("Arquivo inválido.");
    const name = file.name, m = /\.([A-Za-z0-9]+)$/.exec(name), ext = m ? m[1].toLowerCase() : "";
    const SUP = ["txt", "md", "rtf", "srt", "vtt", "docx", "odt", "pptx", "pdf", "json", "png", "jpg", "jpeg", "webp", "gif"];
    if (!SUP.includes(ext)) {
      if (["doc", "ppt"].includes(ext)) throw new Error("Arquivos ." + ext + " antigos não são suportados: abra no Word/PowerPoint e salve como ." + ext + "x.");
      throw new Error("Tipo de arquivo não suportado. Use Word (.docx), PowerPoint (.pptx), ODT, PDF, TXT, MD, RTF, JSON, imagem ou legenda (.srt/.vtt).");
    }
    if (!(file.size <= MAX_BYTES)) throw new Error("Arquivo muito grande (máx. 25 MB).");
    const buf = await file.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 25 MB).");
    const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Material importado";
    const res = { title: base, text: "", blocks: [], warnings: [] };
    try {
      if (ext === "json") {
        let o; try { o = JSON.parse(decodeText(buf)); } catch (e) { throw new Error("JSON inválido."); }
        if (!o || typeof o !== "object" || !Array.isArray(o.blocks)) throw new Error("Este JSON não é um documento do AulaViva.");
        const doc = sanitizeDoc(o);
        return { title: doc.meta.title, text: "", blocks: doc.blocks, warnings: [], doc };
      }
      if (ext === "txt" || ext === "md") res.text = decodeText(buf);
      else if (ext === "rtf") res.text = rtfToText(new TextDecoder("latin1").decode(new Uint8Array(buf)));
      else if (ext === "srt" || ext === "vtt") {
        res.text = subtitlesToText(decodeText(buf));
        res.blocks = [{ id: uid(), type: "heading", text: "Transcrição do vídeo", level: 1 }]
          .concat(res.text.split("\n\n").filter(Boolean).map((t) => ({ id: uid(), type: "paragraph", text: t })));
      }
      else if (ext === "docx") await importDocx(buf, res);
      else if (ext === "odt") await importOdt(buf, res);
      else if (ext === "pptx") await importPptx(buf, res);
      else if (ext === "pdf") await importPdf(buf, res);
      else await importImage(buf, ext, res);
    } catch (e) {
      throw new Error(e && /[ãçõé]/.test(e.message || "") ? e.message : "Não foi possível ler o arquivo: " + (e && e.message ? e.message : "formato inválido") + ".");
    }
    if (["txt", "md", "rtf"].includes(ext)) res.blocks = textToBlocks(cleanLine(res.text), { title: base }).blocks;
    if (!res.text) res.text = res.blocks.map((b) => b.text || b.prompt || (b.items || []).join("\n") || "").filter(Boolean).join("\n");
    res.blocks = sanitizeDoc({ blocks: res.blocks.slice(0, MAX_BLOCKS) }).blocks;
    if (!res.blocks.length) throw new Error("Não encontrei conteúdo para importar nesse arquivo.");
    return res;
  }

  AV.importers = { parseQuickList, textToBlocks, importFile, sanitizeDoc, videoLink, rtfToText, subtitlesToText,
    QUICKLIST_EXAMPLE: "> Leia cada questão com atenção.\n\n1) Quanto é 7 × 8?\na) 54\n*b) 56\nc) 58\nd) 64\n\n2) Marque V ou F:\n(V) O Sol é uma estrela.\n(F) A Lua tem luz própria.\n\n3) Explique, com suas palavras, o que é fotossíntese.\nResposta: Processo em que as plantas produzem alimento usando luz, água e gás carbônico.\nLinhas: 5" };
})(globalThis.AV = globalThis.AV || {});

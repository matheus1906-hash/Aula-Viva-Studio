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

  // ---------- helpers ----------
  const uid = () => "b" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  const mk = (type, o) => Object.assign({ id: uid(), type }, o);
  function rng(seed) {
    let s = (typeof seed === "number" && isFinite(seed) ? Math.floor(seed) : Math.floor(Math.random() * 4294967296)) >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // shuffle that avoids returning the original order when possible
  function shuffleDiff(r, arr) {
    let a = arr;
    for (let k = 0; k < 8; k++) { a = shuffle(r, arr); if (arr.length < 2 || a.join("\u0001") !== arr.join("\u0001")) break; }
    return a;
  }
  const strip = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const clean = w => strip(w).toUpperCase().replace(/[^A-Z]/g, "");
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const int = (v, d) => { const n = Math.round(Number(v)); return isFinite(n) && v !== "" && v != null ? n : d; };
  const trim = s => String(s == null ? "" : s).trim();
  function strs(x, commas) {
    if (typeof x === "string") x = x.split(commas === false ? /\r?\n/ : /\r?\n|,|;/);
    return Array.isArray(x) ? x.map(trim).filter(Boolean) : [];
  }
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const A = {};

  // ---------- word search ----------
  A.wordSearch = function (o) {
    o = o || {};
    const r = rng(o.seed), seen = new Set(), items = [];
    for (const w of strs(o.words)) {
      const c = clean(w);
      if (c.length >= 2 && !seen.has(c)) { seen.add(c); items.push({ orig: w.toUpperCase(), c }); }
    }
    if (!items.length) return [];
    const dirIn = Array.isArray(o.directions) && o.directions.length ? o.directions : ["h", "v"];
    const base = [];
    if (dirIn.includes("h")) base.push([0, 1]);
    if (dirIn.includes("v")) base.push([1, 0]);
    if (dirIn.includes("d")) base.push([1, 1], [-1, 1]);
    if (!base.length) base.push([0, 1]);
    const dirs = base.slice();
    if (dirIn.includes("reverse")) base.forEach(d => dirs.push([-d[0], -d[1]]));
    const longest = Math.max.apply(null, items.map(i => i.c.length));
    const total = items.reduce((s, i) => s + i.c.length, 0);
    let size = int(o.size, 0);
    if (!(size >= 4)) size = Math.max(longest, clamp(Math.ceil(Math.sqrt(total * 2.5)), 8, 16));
    size = clamp(size, 4, 30);
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const solution = [], skipped = [];
    const sorted = items.slice().sort((a, b) => b.c.length - a.c.length);
    for (const it of sorted) {
      const n = it.c.length, cand = [];
      for (const d of dirs) {
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const ey = y + d[0] * (n - 1), ex = x + d[1] * (n - 1);
          if (ey >= 0 && ey < size && ex >= 0 && ex < size) cand.push([d, y, x]);
        }
      }
      let done = false;
      for (const [d, y, x] of shuffle(r, cand)) {
        let ok = true;
        for (let i = 0; i < n && ok; i++) { const v = grid[y + d[0] * i][x + d[1] * i]; if (v && v !== it.c[i]) ok = false; }
        if (!ok) continue;
        const cells = [];
        for (let i = 0; i < n; i++) { grid[y + d[0] * i][x + d[1] * i] = it.c[i]; cells.push([y + d[0] * i, x + d[1] * i]); }
        solution.push({ word: it.orig, cells });
        done = true; break;
      }
      if (!done) skipped.push(it.orig);
    }
    const ABC = "AAEEIIOOUUBCDFGHJLMNPQRSTVXZ";
    const up = o.uppercase !== false;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let ch = grid[y][x] || ABC[Math.floor(r() * ABC.length)];
      grid[y][x] = up ? ch : ch.toLowerCase();
    }
    const order = items.map(i => i.orig);
    solution.sort((a, b) => order.indexOf(a.word) - order.indexOf(b.word));
    return [mk("word_search", {
      title: trim(o.title) || "Caça-palavras",
      words: order.filter(w => !skipped.includes(w)),
      grid, solution, skipped
    })];
  };

  // ---------- crossword ----------
  A.crossword = function (o) {
    o = o || {};
    const r = rng(o.seed), seen = new Set(), ents = [];
    for (const e of Array.isArray(o.entries) ? o.entries : []) {
      if (!e) continue;
      const ans = clean(e.answer);
      if (ans.length < 2 || seen.has(ans)) continue;
      seen.add(ans);
      ents.push({ ans, clue: trim(e.clue) || "(sem dica)", orig: { answer: trim(e.answer), clue: trim(e.clue) } });
    }
    if (!ents.length) return [];
    const order = shuffle(r, ents).sort((a, b) => b.ans.length - a.ans.length);
    const cells = new Map(), placed = [];
    let minR = 0, maxR = 0, minC = 0, maxC = 0;
    const K = (a, b) => a + "," + b;
    function fit(w, r0, c0, hz) {
      const dr = hz ? 0 : 1, dc = hz ? 1 : 0, n = w.length;
      if (cells.has(K(r0 - dr, c0 - dc)) || cells.has(K(r0 + dr * n, c0 + dc * n))) return -1;
      let x = 0;
      for (let i = 0; i < n; i++) {
        const rr = r0 + dr * i, cc = c0 + dc * i, cell = cells.get(K(rr, cc));
        if (cell) { if (cell.ch !== w[i] || (hz ? cell.h : cell.v)) return -1; x++; }
        else if (cells.has(K(rr + dc, cc + dr)) || cells.has(K(rr - dc, cc - dr))) return -1;
      }
      return x;
    }
    function put(e, r0, c0, hz) {
      const dr = hz ? 0 : 1, dc = hz ? 1 : 0;
      for (let i = 0; i < e.ans.length; i++) {
        const rr = r0 + dr * i, cc = c0 + dc * i;
        let cell = cells.get(K(rr, cc));
        if (!cell) { cell = { ch: e.ans[i], h: false, v: false }; cells.set(K(rr, cc), cell); }
        if (hz) cell.h = true; else cell.v = true;
        minR = Math.min(minR, rr); maxR = Math.max(maxR, rr); minC = Math.min(minC, cc); maxC = Math.max(maxC, cc);
      }
      placed.push({ e, r: r0, c: c0, hz });
    }
    put(order[0], 0, 0, true);
    let rest = order.slice(1), progress = true;
    while (rest.length && progress) {
      progress = false;
      const left = [];
      for (const e of rest) {
        let best = null, bs = -1e9;
        for (const p of placed) {
          const hz = !p.hz;
          for (let i = 0; i < p.e.ans.length; i++) for (let j = 0; j < e.ans.length; j++) {
            if (p.e.ans[i] !== e.ans[j]) continue;
            const r0 = p.hz ? p.r - j : p.r + i, c0 = p.hz ? p.c + i : p.c - j;
            const x = fit(e.ans, r0, c0, hz);
            if (x < 1) continue;
            const er = r0 + (hz ? 0 : e.ans.length - 1), ec = c0 + (hz ? e.ans.length - 1 : 0);
            const h = Math.max(maxR, er) - Math.min(minR, r0) + 1, w = Math.max(maxC, ec) - Math.min(minC, c0) + 1;
            const s = x * 100 - h * w - Math.abs(h - w) * 2 + r() * 3;
            if (s > bs) { bs = s; best = [r0, c0, hz]; }
          }
        }
        if (best) { put(e, best[0], best[1], best[2]); progress = true; } else left.push(e);
      }
      rest = left;
    }
    const H = maxR - minR + 1, W = maxC - minC + 1;
    const grid = Array.from({ length: H }, () => Array(W).fill(null));
    cells.forEach((cell, key) => { const [a, b] = key.split(",").map(Number); grid[a - minR][b - minC] = { letter: cell.ch }; });
    const has = (a, b) => a >= 0 && b >= 0 && a < H && b < W && grid[a][b];
    const num = new Map();
    let n = 0;
    for (let a = 0; a < H; a++) for (let b = 0; b < W; b++) {
      if (!grid[a][b]) continue;
      if ((!has(a, b - 1) && has(a, b + 1)) || (!has(a - 1, b) && has(a + 1, b))) { n++; grid[a][b].number = n; num.set(K(a, b), n); }
    }
    const across = [], down = [];
    for (const p of placed) {
      const nn = num.get(K(p.r - minR, p.c - minC));
      (p.hz ? across : down).push({ n: nn, clue: p.e.clue, answer: p.e.ans });
    }
    across.sort((a, b) => a.n - b.n); down.sort((a, b) => a.n - b.n);
    return [mk("crossword", {
      title: trim(o.title) || "Palavras cruzadas",
      grid, clues: { across, down }, skipped: rest.map(e => e.orig)
    })];
  };

  // ---------- match ----------
  A.match = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const pairs = (Array.isArray(o.pairs) ? o.pairs : []).filter(p => Array.isArray(p) && trim(p[0]) && trim(p[1])).map(p => [trim(p[0]), trim(p[1])]);
    if (!pairs.length) return [];
    const idx = shuffleDiff(r, pairs.map((_, i) => i));
    const right = idx.map(i => pairs[i][1]);
    const answers = pairs.map((_, i) => idx.indexOf(i));
    return [mk("match", { prompt: trim(o.prompt) || "Ligue as colunas.", left: pairs.map(p => p[0]), right, answers })];
  };

  // ---------- fill in the blank ----------
  A.fillBlank = function (o) {
    o = o || {};
    let text = String(o.text == null ? "" : o.text);
    if (!trim(text)) return [];
    for (const w of strs(o.words)) {
      const re = new RegExp("(?<![\\p{L}\\p{N}])" + escRe(w) + "(?![\\p{L}\\p{N}])", "iu");
      let from = 0;
      for (;;) {
        const m = re.exec(text.slice(from));
        if (!m) break;
        const at = from + m.index, before = text.slice(0, at);
        if (before.lastIndexOf("[") > before.lastIndexOf("]")) { from = at + m[0].length; continue; }
        text = before + "[" + m[0] + "]" + text.slice(at + m[0].length);
        break;
      }
    }
    return [mk("fill_blank", { prompt: trim(o.prompt) || "Complete as lacunas.", text })];
  };

  // ---------- scramble ----------
  A.scramble = function (o) {
    o = o || {};
    const r = rng(o.seed), words = strs(o.words);
    if (!words.length) return [];
    const prompt = trim(o.prompt) || "Descubra a palavra escondida e escreva-a corretamente.";
    const sc = words.map(w => shuffleDiff(r, Array.from(w.toUpperCase())).join(" "));
    if (o.format === "perguntas") {
      return words.map((w, i) => mk("open_question", { prompt: (i === 0 ? prompt + "\n" : "") + sc[i], lines: 1, answer: w }));
    }
    return [mk("paragraph", { text: prompt }), mk("table", { rows: [["Embaralhada", "Resposta"]].concat(sc.map(s => [s, ""])) })];
  };

  // ---------- sentence order ----------
  A.sentenceOrder = function (o) {
    o = o || {};
    const r = rng(o.seed), out = [];
    const sents = strs(o.sentences, false);
    if (!sents.length) return [];
    out.push(mk("paragraph", { text: trim(o.prompt) || "Organize as palavras para formar frases." }));
    for (const s of sents) {
      const words = s.split(/\s+/);
      out.push(mk("open_question", { prompt: shuffleDiff(r, words).join(" / "), lines: 2, answer: s }));
    }
    return out;
  };

  // ---------- math ----------
  const SYM = { "+": "+", "-": "-", x: "×", "÷": "÷" };
  function normOp(op) {
    op = trim(op).toLowerCase();
    if (op === "*" || op === "×") return "x";
    if (op === "/" || op === ":") return "÷";
    if (op === "−" || op === "–") return "-";
    return op;
  }
  A.mathOps = function (o) {
    o = o || {};
    const r = rng(o.seed), count = clamp(int(o.count, 10), 1, 60);
    let min = int(o.min, 1), max = int(o.max, 99);
    if (max < min) { const t = min; min = max; max = t; }
    const op = normOp(o.op);
    const pool = SYM[op] ? [op] : ["+", "-", "x", "÷"];
    const rows = [];
    for (let i = 0; i < count; i++) {
      const p = pool[ri(r, 0, pool.length - 1)];
      let a = ri(r, min, max), b = ri(r, min, max), ans;
      if (p === "+") ans = String(a + b);
      else if (p === "-") { if (o.noNegative !== false && a < b) { const t = a; a = b; b = t; } ans = String(a - b); }
      else if (p === "x") ans = String(a * b);
      else if (o.exactDivision !== false) {
        const lo = Math.max(1, min), hi = Math.max(lo, Math.min(Math.max(1, max), Math.round(Math.sqrt(Math.max(1, max)) * 1.5)));
        b = ri(r, lo, hi);
        const q = ri(r, 1, Math.max(1, Math.floor(Math.max(1, max) / b)));
        a = b * q; ans = String(q);
      } else {
        b = ri(r, Math.max(1, min), Math.max(1, max));
        ans = Math.floor(a / b) + (a % b ? " resto " + (a % b) : "");
      }
      rows.push({ q: a + " " + SYM[p] + " " + b, ans });
    }
    const prompt = trim(o.prompt) || "Resolva as operações.";
    if (o.format === "tabela") return [mk("paragraph", { text: prompt }), mk("table", { rows: [["Conta", "Resposta"]].concat(rows.map(x => [x.q + " =", ""])) })];
    if (o.format === "perguntas") return rows.map((x, i) => mk("open_question", { prompt: (i === 0 ? prompt + "\n" : "") + x.q + " =", lines: 1, answer: x.ans }));
    return [mk("fill_blank", { prompt, text: rows.map(x => x.q + " = [" + x.ans + "]").join("\n") })];
  };

  A.tabuada = function (o) {
    o = o || {};
    const n = clamp(int(o.n, 2), 0, 100), up = clamp(int(o.upTo, 10), 1, 20);
    const lines = [];
    for (let i = 1; i <= up; i++) lines.push([n + " × " + i, n * i]);
    if (o.mode === "lista") return [mk("heading", { text: "Tabuada do " + n, level: 2 }), mk("bullets", { items: lines.map(l => l[0] + " = " + l[1]) })];
    return [mk("fill_blank", { prompt: trim(o.prompt) || "Complete a tabuada do " + n + ".", text: lines.map(l => l[0] + " = [" + l[1] + "]").join("\n") })];
  };

  // ---------- syllables ----------
  const VOW = "aeiouáéíóúâêôãõàü", STRONG = "aeoáéóâêôãõà";
  const CLUS = ["br", "cr", "dr", "fr", "gr", "pr", "tr", "vr", "bl", "cl", "fl", "gl", "pl"];
  const EXC = { juiz: "ju-iz", ruim: "ru-im", cruel: "cru-el", bocaiuva: "bo-cai-u-va", feiura: "fei-u-ra", abençoe: "a-ben-ço-e" };
  function splitPair(a, b, nhNext) {
    if (STRONG.includes(a) && STRONG.includes(b)) return !("ãõ".includes(a) && "oe".includes(b));
    if ("íú".includes(b)) return true;
    if ("íú".includes(a)) return true;
    return b === "i" && nhNext && STRONG.includes(a);
  }
  function syl1(w) {
    if (EXC[w]) return EXC[w];
    const toks = [];
    let i = 0;
    while (i < w.length) {
      const ch = w[i], two = w.substr(i, 2);
      if (VOW.includes(ch)) {
        let j = i;
        while (j < w.length && VOW.includes(w[j])) j++;
        const nh = w.startsWith("nh", j);
        let cur = w[i];
        for (let k = i + 1; k < j; k++) {
          if (splitPair(w[k - 1], w[k], nh && k === j - 1)) { toks.push({ v: 1, s: cur }); cur = w[k]; } else cur += w[k];
        }
        toks.push({ v: 1, s: cur });
        i = j;
      } else if (two === "ch" || two === "lh" || two === "nh" || CLUS.includes(two)) { toks.push({ v: 0, s: two }); i += 2; }
      else if (two[0] === "q" && VOW.includes(w[i + 1] || "") && w[i + 1] === "u" && VOW.includes(w[i + 2] || "")) { toks.push({ v: 0, s: "qu" }); i += 2; }
      else if (two[0] === "g" && w[i + 1] === "u" && "eiéíê".includes(w[i + 2] || "#")) { toks.push({ v: 0, s: "gu" }); i += 2; }
      else { toks.push({ v: 0, s: ch }); i++; }
    }
    const nuc = [];
    toks.forEach((t, k) => { if (t.v) nuc.push(k); });
    if (!nuc.length) return w;
    const out = [];
    let cur = toks.slice(0, nuc[0] + 1).map(t => t.s).join("");
    for (let n = 1; n < nuc.length; n++) {
      const cs = toks.slice(nuc[n - 1] + 1, nuc[n]).map(t => t.s);
      if (cs.length) { cur += cs.slice(0, -1).join(""); out.push(cur); cur = cs[cs.length - 1]; } else { out.push(cur); cur = ""; }
      cur += toks[nuc[n]].s;
    }
    cur += toks.slice(nuc[nuc.length - 1] + 1).map(t => t.s).join("");
    out.push(cur);
    return out.join("-");
  }
  function syllabify(word) {
    return trim(word).toLowerCase().split(/[\s-]+/).filter(Boolean).map(p => /^[a-zà-ÿ]+$/.test(p) ? syl1(p) : p).join("-");
  }
  A.syllabify = syllabify;
  A.syllables = function (o) {
    o = o || {};
    const words = strs(o.words);
    if (!words.length) return [];
    const prompt = trim(o.prompt) || "Separe as sílabas das palavras.";
    if (o.format === "tabela") return [mk("paragraph", { text: prompt }), mk("table", { rows: [["Palavra", "Sílabas"]].concat(words.map(w => [w, ""])) })];
    return [mk("fill_blank", { prompt, text: words.map(w => w + " → [" + syllabify(w) + "]").join("\n") })];
  };

  A.alphabetical = function (o) {
    o = o || {};
    const r = rng(o.seed), words = strs(o.words);
    if (!words.length) return [];
    const sorted = words.slice().sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    return [mk("open_question", {
      prompt: (trim(o.prompt) || "Coloque as palavras em ordem alfabética:") + " " + shuffleDiff(r, words).join(" · "),
      lines: clamp(words.length, 1, 12), answer: sorted.join(", ")
    })];
  };

  A.countAndWrite = function (o) {
    o = o || {};
    const items = (Array.isArray(o.items) ? o.items : []).filter(it => it && trim(it.label));
    if (!items.length) return [];
    const out = [mk("paragraph", { text: trim(o.prompt) || "Conte e escreva quantos há." })];
    for (const it of items) {
      const n = clamp(int(it.count, 1), 1, 30), sym = trim(it.emoji) || "●";
      out.push(mk("open_question", { prompt: Array(n).fill(sym).join(" ") + "\nQuantos(as) " + trim(it.label) + "?", lines: 1, answer: String(n) }));
    }
    return out;
  };

  A.trueFalseFromFacts = function (o) {
    o = o || {};
    const facts = (Array.isArray(o.facts) ? o.facts : []).filter(f => f && trim(f.text));
    if (!facts.length) return [];
    const out = [];
    if (trim(o.prompt)) out.push(mk("paragraph", { text: trim(o.prompt) }));
    out.push(mk("true_false", { statements: facts.map(f => trim(f.text)), answers: facts.map(f => f.true === true || f.true === "true") }));
    return out;
  };

  A.quiz = function (o) {
    o = o || {};
    const r = rng(o.seed), out = [];
    for (const q of Array.isArray(o.questions) ? o.questions : []) {
      if (!q || !trim(q.prompt)) continue;
      let opts = strs(q.options, false);
      if (opts.length < 2) continue;
      let correct = clamp(int(q.correct, 0), 0, opts.length - 1);
      if (o.shuffle) {
        const idx = shuffle(r, opts.map((_, i) => i));
        opts = idx.map(i => opts[i]); correct = idx.indexOf(correct);
      }
      out.push(mk("choice_question", { prompt: trim(q.prompt), options: opts, correct }));
    }
    return out;
  };

  // ---------- catalog ----------
  const f = (key, label, type, x) => Object.assign({ key, label, type, placeholder: "" }, x || {});
  const prompt = d => f("prompt", "Enunciado", "text", { default: d, placeholder: d });
  const fmt = (opts, d) => f("format", "Formato", "select", { options: opts, default: d });
  const years = { a: "1º ao 5º ano", b: "1º ao 3º ano", c: "3º ao 9º ano", d: "Todos os anos" };

  const catalog = [
    { id: "wordSearch", name: "Caça-palavras", category: "Jogos de palavras", years: years.a,
      description: "Grade de letras com as palavras escondidas e gabarito destacado.",
      fields: [
        f("title", "Título", "text", { default: "Caça-palavras" }),
        f("words", "Palavras (uma por linha)", "list", { placeholder: "sol\nlua\nestrela", required: true }),
        f("size", "Tamanho da grade (0 = automático)", "number", { default: 0, min: 0, max: 30 }),
        f("dirV", "Palavras na vertical", "checkbox", { default: true }),
        f("dirD", "Palavras na diagonal", "checkbox", { default: false }),
        f("dirR", "Palavras de trás para frente", "checkbox", { default: false })
      ],
      example: { title: "Caça-palavras do Espaço", words: ["sol", "lua", "estrela", "planeta", "cometa", "órbita"], size: 0, dirV: true, dirD: true, dirR: true, seed: 7 } },
    { id: "crossword", name: "Palavras cruzadas", category: "Jogos de palavras", years: years.a,
      description: "Cruzadinha gerada automaticamente a partir de respostas e dicas.",
      fields: [
        f("title", "Título", "text", { default: "Palavras cruzadas" }),
        f("entries", "Respostas e dicas (resposta = dica)", "pairs", { placeholder: "sol = Estrela que ilumina a Terra", required: true })
      ],
      example: { title: "Cruzadinha", entries: [["planeta", "A Terra é um"], ["sol", "Estrela do nosso sistema"], ["lua", "Satélite natural"], ["estrela", "Brilha no céu à noite"], ["orbita", "Caminho ao redor do Sol"]], seed: 3 } },
    { id: "match", name: "Ligar colunas", category: "Português", years: years.d,
      description: "Duas colunas para ligar; a coluna da direita é embaralhada.",
      fields: [prompt("Ligue as colunas."), f("pairs", "Pares (esquerda = direita)", "pairs", { placeholder: "gato = animal", required: true })],
      example: { prompt: "Ligue o animal ao seu som.", pairs: [["cão", "late"], ["gato", "mia"], ["vaca", "muge"], ["pato", "grasna"]], seed: 5 } },
    { id: "fillBlank", name: "Completar lacunas", category: "Português", years: years.d,
      description: "Texto com lacunas; marque as palavras a esconder.",
      fields: [prompt("Complete as lacunas."), f("text", "Texto", "textarea", { placeholder: "O Sol é uma estrela.", required: true }), f("words", "Palavras a esconder (opcional)", "list", { placeholder: "Sol, estrela" })],
      example: { prompt: "Complete as frases.", text: "O Sol é uma estrela. A Lua gira ao redor da Terra.", words: ["Sol", "Lua", "Terra"] } },
    { id: "scramble", name: "Palavras embaralhadas", category: "Alfabetização", years: years.b,
      description: "Letras embaralhadas para o aluno descobrir a palavra.",
      fields: [prompt("Descubra a palavra escondida."), f("words", "Palavras", "list", { placeholder: "casa, bola, gato", required: true }), fmt([{ value: "tabela", label: "Tabela" }, { value: "perguntas", label: "Perguntas com gabarito" }], "tabela")],
      example: { words: ["casa", "bola", "gato", "livro"], format: "tabela", seed: 11 } },
    { id: "sentenceOrder", name: "Ordenar frases", category: "Português", years: years.a,
      description: "Palavras embaralhadas para o aluno reorganizar a frase.",
      fields: [prompt("Organize as palavras para formar frases."), f("sentences", "Frases (uma por linha)", "textarea", { placeholder: "O gato dorme no sofá.", required: true })],
      example: { sentences: "O gato dorme no sofá.\nA menina lê um livro.\nNós vamos à escola.", seed: 2 } },
    { id: "mathOps", name: "Operações matemáticas", category: "Matemática", years: years.a,
      description: "Lista de contas geradas aleatoriamente com respostas.",
      fields: [
        f("op", "Operação", "select", { options: [{ value: "+", label: "Adição" }, { value: "-", label: "Subtração" }, { value: "x", label: "Multiplicação" }, { value: "÷", label: "Divisão" }, { value: "mix", label: "Mista" }], default: "+" }),
        f("count", "Quantidade", "number", { default: 10, min: 1, max: 60 }),
        f("min", "Valor mínimo", "number", { default: 1 }),
        f("max", "Valor máximo", "number", { default: 99 }),
        f("noNegative", "Evitar resultados negativos", "checkbox", { default: true }),
        f("exactDivision", "Divisões exatas", "checkbox", { default: true }),
        fmt([{ value: "lista", label: "Lista com lacunas" }, { value: "tabela", label: "Tabela" }, { value: "perguntas", label: "Perguntas" }], "lista")
      ],
      example: { op: "mix", count: 12, min: 2, max: 50, noNegative: true, exactDivision: true, format: "lista", seed: 9 } },
    { id: "tabuada", name: "Tabuada", category: "Matemática", years: "2º ao 5º ano",
      description: "Tabuada para completar ou como lista de consulta.",
      fields: [f("n", "Tabuada do", "number", { default: 2, min: 0, max: 100 }), f("upTo", "Até", "number", { default: 10, min: 1, max: 20 }), Object.assign(fmt([{ value: "completar", label: "Completar" }, { value: "lista", label: "Lista pronta" }], "completar"), { key: "mode" })],
      example: { n: 7, upTo: 10, mode: "completar" } },
    { id: "syllables", name: "Separação de sílabas", category: "Alfabetização", years: years.b,
      description: "Palavras para separar em sílabas, com gabarito.",
      fields: [prompt("Separe as sílabas das palavras."), f("words", "Palavras", "list", { placeholder: "casa, sapato, escola", required: true }), fmt([{ value: "completar", label: "Lacunas com gabarito" }, { value: "tabela", label: "Tabela" }], "completar")],
      example: { words: ["casa", "sapato", "escola", "passarinho", "queijo"] } },
    { id: "alphabetical", name: "Ordem alfabética", category: "Alfabetização", years: years.b,
      description: "Palavras para colocar em ordem alfabética.",
      fields: [prompt("Coloque as palavras em ordem alfabética:"), f("words", "Palavras", "list", { placeholder: "banana, abacaxi, uva", required: true })],
      example: { words: ["uva", "banana", "abacaxi", "laranja", "maçã"], seed: 4 } },
    { id: "countAndWrite", name: "Conte e escreva", category: "Alfabetização", years: "Educação infantil e 1º ano",
      description: "Atividade de contagem com figuras para a educação infantil.",
      fields: [prompt("Conte e escreva quantos há."), f("items", "Itens (emoji | nome | quantidade)", "textarea", { placeholder: "🍎 | maçãs | 4", required: true })],
      example: { items: "🍎 | maçãs | 4\n⭐ | estrelas | 7\nbolas | 3" } },
    { id: "trueFalseFromFacts", name: "Verdadeiro ou falso", category: "Avaliação", years: years.d,
      description: "Afirmações para marcar V ou F.",
      fields: [prompt("Marque V para verdadeiro e F para falso."), f("facts", "Afirmações (texto | V ou F)", "textarea", { placeholder: "O Sol é uma estrela. | V", required: true })],
      example: { facts: "O Sol é uma estrela. | V\nA Lua produz luz própria. | F\nA Terra gira ao redor do Sol. | V" } },
    { id: "quiz", name: "Quiz de múltipla escolha", category: "Avaliação", years: years.d,
      description: "Questões de múltipla escolha com alternativa correta.",
      fields: [f("questions", "Questões (separe por linha em branco; marque a correta com *)", "textarea", { placeholder: "Qual é a capital do Brasil?\nSão Paulo\n*Brasília\nRio de Janeiro", required: true }), f("shuffle", "Embaralhar alternativas", "checkbox", { default: false })],
      example: { questions: "Quantos planetas há no Sistema Solar?\n7\n*8\n9\n\nQual é a nossa estrela?\n*Sol\nLua\nMarte", shuffle: true, seed: 6 } }
  ];

  // ---------- form values -> generator options ----------
  const SEP = /\s*(?:=>|->|=|\||;|\t)\s*/;
  function pairsOf(v) {
    const out = [];
    for (const it of Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : []) {
      let a, b;
      if (Array.isArray(it)) { a = it[0]; b = it[1]; }
      else if (it && typeof it === "object") { a = it.left != null ? it.left : it.answer; b = it.right != null ? it.right : it.clue; }
      else { const m = String(it).split(SEP); if (m.length < 2) continue; a = m[0]; b = m.slice(1).join(" "); }
      a = trim(a); b = trim(b);
      if (a && b) out.push([a, b]);
    }
    return out;
  }
  const B = {
    wordSearch: v => ({ title: v.title, words: v.words, size: v.size || undefined, seed: v.seed, uppercase: v.uppercase,
      directions: Array.isArray(v.directions) ? v.directions : ["h"].concat(v.dirV ? ["v"] : [], v.dirD ? ["d"] : [], v.dirR ? ["reverse"] : []) }),
    crossword: v => ({ title: v.title, seed: v.seed, entries: pairsOf(v.entries).map(p => ({ answer: p[0], clue: p[1] })) }),
    match: v => ({ prompt: v.prompt, seed: v.seed, pairs: pairsOf(v.pairs) }),
    fillBlank: v => v,
    scramble: v => v,
    sentenceOrder: v => v,
    mathOps: v => v,
    tabuada: v => v,
    syllables: v => v,
    alphabetical: v => v,
    countAndWrite: (v, errs) => {
      const items = [];
      for (const it of Array.isArray(v.items) ? v.items : strs(v.items, false)) {
        if (it && typeof it === "object") { items.push(it); continue; }
        const p = String(it).split("|").map(trim);
        if (p.length >= 3) items.push({ emoji: p[0], label: p[1], count: p[2] });
        else if (p.length === 2) items.push({ label: p[0], count: p[1] });
        else errs.push("Use o formato: emoji | nome | quantidade (linha \"" + it + "\").");
      }
      return { prompt: v.prompt, items };
    },
    trueFalseFromFacts: (v, errs) => {
      const facts = [];
      for (const it of Array.isArray(v.facts) ? v.facts : strs(v.facts, false)) {
        if (it && typeof it === "object") { facts.push(it); continue; }
        const m = /^(.*?)\s*[|;]\s*(v|verdadeiro|true|sim|f|falso|false|n[aã]o)\s*$/i.exec(String(it));
        if (m) facts.push({ text: m[1], true: /^(v|verdadeiro|true|sim)$/i.test(m[2]) });
        else errs.push("Termine a afirmação com | V ou | F (linha \"" + it + "\").");
      }
      return { prompt: v.prompt, facts };
    },
    quiz: v => {
      let qs = v.questions;
      if (typeof qs === "string") {
        qs = qs.split(/\r?\n\s*\r?\n/).map(block => {
          const lines = block.split(/\r?\n/).map(trim).filter(Boolean);
          if (lines.length < 3) return null;
          let correct = 0;
          const options = lines.slice(1).map((l, i) => {
            if (l[0] === "*") { correct = i; l = l.slice(1); }
            return trim(l.replace(/^(?:[a-eA-E][).]|-)\s+/, ""));
          });
          return { prompt: lines[0], options, correct };
        }).filter(Boolean);
      }
      return { questions: qs, shuffle: v.shuffle, seed: v.seed };
    }
  };

  function validate(id, values) {
    const entry = catalog.find(e => e.id === id), errors = [];
    if (!entry) return { values: {}, errors: ["Atividade desconhecida: " + id] };
    values = values && typeof values === "object" ? values : {};
    const out = {};
    for (const fl of entry.fields) {
      let v = values[fl.key];
      if (v === undefined || v === null) v = fl.default;
      switch (fl.type) {
        case "number": {
          let n = Number(v);
          if (v === "" || v == null || !isFinite(n)) n = fl.default == null ? 0 : fl.default;
          if (fl.min != null) n = Math.max(fl.min, n);
          if (fl.max != null) n = Math.min(fl.max, n);
          v = n; break;
        }
        case "checkbox": v = v === true || v === "true" || v === "on" || v === 1; break;
        case "select": {
          const vals = (fl.options || []).map(x => typeof x === "object" ? x.value : x);
          v = vals.includes(v) ? v : fl.default; break;
        }
        case "list": v = strs(v); break;
        case "pairs": v = pairsOf(v); break;
        default: v = v == null ? "" : String(v).trim();
      }
      const empty = Array.isArray(v) ? !v.length : v === "";
      if (fl.required && empty) errors.push("Preencha: " + fl.label + ".");
      out[fl.key] = v;
    }
    for (const k of ["seed", "directions", "uppercase", "words"]) if (out[k] === undefined && values[k] !== undefined) out[k] = values[k];
    if (typeof values.seed === "number") out.seed = values.seed;
    const opts = B[id](out, errors);
    return { values: opts, errors };
  }

  function run(id, values) {
    try {
      const v = validate(id, values);
      if (v.errors.length || !A[id]) return [];
      return A[id](v.values) || [];
    } catch (e) { return []; }
  }

  A.catalog = catalog;
  A.validate = validate;
  A.run = run;
  AV.atividades = A;
})(globalThis.AV = globalThis.AV || {});

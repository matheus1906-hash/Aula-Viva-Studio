/* AulaViva Studio Web: exporters (PDF, DOCX, PPTX, HTML, Markdown, TXT, JSON) + QR encoder. */
(function (AV) {
  "use strict";
  var G = typeof window !== "undefined" ? window : globalThis;
  AV.LIBS = AV.LIBS || {
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
    docx: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",
    pptx: "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js",
    jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js",
    mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js",
    pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    pdfjsWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
  };
  AV.THEMES = AV.THEMES || { "Azul escolar": "#2F6FED", "Verde caderno": "#1F9D6B", "Laranja giz": "#E2762B", "Roxo ciência": "#7B4FD6", "Vermelho lousa": "#C9433A", "Grafite": "#3B4252" };
  AV.CALLOUTS = AV.CALLOUTS || { dica: ["Dica", "#2E9E6B"], atencao: ["Atenção", "#E0912F"], importante: ["Importante", "#D64545"], curiosidade: ["Curiosidade", "#6C5CE7"], definicao: ["Definição", "#2F80ED"] };

  /* ------------------------------------------------------------------ helpers */
  var S = function (x) { return x == null ? "" : String(x); };
  var A = function (x) { return Array.isArray(x) ? x : []; };
  var N = function (x, d, lo, hi) { x = +x; if (!isFinite(x)) x = d; return Math.min(hi, Math.max(lo, x)); };
  var L = function (i) { return String.fromCharCode(65 + (i % 26)); };
  var l = function (i) { return String.fromCharCode(97 + (i % 26)); };
  var esc = function (s) { return S(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var hexRgb = function (h) { h = S(h).replace("#", ""); if (h.length !== 6) h = "2F6FED"; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  var tint = function (c, t) { return c.map(function (v) { return Math.round(v + (255 - v) * t); }); };
  var shade = function (c, t) { return c.map(function (v) { return Math.round(v * (1 - t)); }); };
  var toHex = function (c) { return c.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("").toUpperCase(); };

  function inline(text) {
    var out = [], re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g, last = 0, m;
    text = S(text);
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: text.slice(last, m.index) });
      out.push(m[1] != null ? { t: m[1], b: 1 } : { t: m[2], i: 1 });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  }
  var strip = function (t) { return inline(t).map(function (s) { return s.t; }).join(""); };

  function blanks(text) {
    var parts = [], re = /\[([^\]]*)\]/g, last = 0, m, k = 0;
    text = S(text);
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index) });
      parts.push({ blank: k++, ans: m[1] });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ t: text.slice(last) });
    return parts;
  }
  var fillText = function (b, ans, mark) { return blanks(b.text).map(function (p) { return p.blank != null ? (ans ? p.ans : mark || "______") : p.t; }).join(""); };

  var QT = { choice_question: 1, open_question: 1, true_false: 1, match: 1, fill_blank: 1, word_search: 1, crossword: 1 };

  /* rótulos no idioma do material */
  var CUR = "pt", TLD = {"en": {"Horizontais": "Across", "Verticais": "Down", "Disciplina": "Subject", "Nível / ano": "Grade", "Escola": "School", "Professor(a)": "Teacher", "Versão do professor (com respostas)": "Teacher's version (with answers)", "Versão do professor": "Teacher's version", "Nome:": "Name:", "Turma:": "Class:", "Data:": "Date:", "Nome: ": "Name: ", "Turma: ": "Class: ", "Data: ": "Date: ", "Resposta": "Answer", "Resposta: ": "Answer: ", "Resposta:": "Answer:", "Marque V (verdadeiro) ou F (falso):": "Write T (true) or F (false):", "Marque V (verdadeiro) ou F (falso)": "Write T (true) or F (false)", "Palavras: ": "Words: ", "Palavras:": "Words:", "Gabarito": "Answer key", "GABARITO": "ANSWER KEY", "Sumário": "Contents", "SUMÁRIO": "CONTENTS", "Página ": "Page ", " de ": " of ", "Questão ": "Question ", "Caça-palavras": "Word search", "Cruzadinha": "Crossword", "Versão do professor  |  ": "Teacher's version  |  ", "- Gabarito": "- Answer key", "• Gabarito": "• Answer key", "## Sumário": "## Contents", "## Gabarito": "## Answer key", " · Versão do professor": " · Teacher's version", "Documento": "Document", "Nome: ______________________  Turma: ________  Data: ___/___/_____": "Name: ______________________  Class: ________  Date: ___/___/_____", "Grade da cruzadinha": "Crossword grid", "Resposta da questão ": "Answer to question "}, "es": {"Horizontais": "Horizontales", "Verticais": "Verticales", "Disciplina": "Asignatura", "Nível / ano": "Nivel / curso", "Escola": "Escuela", "Professor(a)": "Profesor(a)", "Versão do professor (com respostas)": "Versión del profesor (con respuestas)", "Versão do professor": "Versión del profesor", "Nome:": "Nombre:", "Turma:": "Curso:", "Data:": "Fecha:", "Nome: ": "Nombre: ", "Turma: ": "Curso: ", "Data: ": "Fecha: ", "Resposta": "Respuesta", "Resposta: ": "Respuesta: ", "Resposta:": "Respuesta:", "Marque V (verdadeiro) ou F (falso):": "Marca V (verdadero) o F (falso):", "Marque V (verdadeiro) ou F (falso)": "Marca V (verdadero) o F (falso)", "Palavras: ": "Palabras: ", "Palavras:": "Palabras:", "Gabarito": "Respuestas", "GABARITO": "RESPUESTAS", "Sumário": "Índice", "SUMÁRIO": "ÍNDICE", "Página ": "Página ", " de ": " de ", "Questão ": "Pregunta ", "Caça-palavras": "Sopa de letras", "Cruzadinha": "Crucigrama", "Versão do professor  |  ": "Versión del profesor  |  ", "- Gabarito": "- Respuestas", "• Gabarito": "• Respuestas", "## Sumário": "## Índice", "## Gabarito": "## Respuestas", " · Versão do professor": " · Versión del profesor", "Documento": "Documento", "Nome: ______________________  Turma: ________  Data: ___/___/_____": "Nombre: ______________________  Curso: ________  Fecha: ___/___/_____", "Grade da cruzadinha": "Cuadrícula del crucigrama", "Resposta da questão ": "Respuesta a la pregunta "}};
  function TL(s) { var d = TLD[CUR]; return d && d[s] != null ? d[s] : s; }
  function setLang(doc) { var l = String((doc && doc.meta && doc.meta.lang) || "pt").slice(0, 2); CUR = TLD[l] ? l : "pt"; }
  var KIND_I18N = { en: { apostila: "Handout", lista: "Worksheet", prova: "Test", roteiro: "Lesson guide", plano: "Lesson plan", atividade: "Activity", projeto: "Project", branco: "Document" }, es: { apostila: "Apostilla", lista: "Ficha de ejercicios", prova: "Examen", roteiro: "Guía de clase", plano: "Plan de clase", atividade: "Actividad", projeto: "Proyecto", branco: "Documento" } };
  var KIND = { apostila: "Apostila", lista: "Lista de exercícios", prova: "Prova", roteiro: "Roteiro de aula", plano: "Plano de aula", atividade: "Atividade", projeto: "Projeto", branco: TL("Documento") };

  function keyText(b) {
    switch (b.type) {
      case "choice_question": var c = N(b.correct, 0, 0, 999); return L(c) + ") " + strip(A(b.options)[c]);
      case "open_question": return strip(b.answer) || "(resposta livre)";
      case "true_false": return A(b.statements).map(function (s, i) { return (i + 1) + "-" + (A(b.answers)[i] ? "V" : "F"); }).join("   ");
      case "match": return A(b.left).map(function (s, i) { return (i + 1) + "-" + l(N(A(b.answers)[i], 0, 0, 999)); }).join("   ");
      case "fill_blank": return blanks(b.text).filter(function (p) { return p.blank != null; }).map(function (p) { return p.ans; }).join("; ");
      case "word_search": return A(b.words).join(", ");
      case "crossword":
        var cl = b.clues || {}, f = function (a) { return A(a).map(function (x) { return S(x && x.n) + " " + S(x && x.answer); }).join(", "); };
        return "Horizontais: " + f(cl.across) + " | Verticais: " + f(cl.down);
    }
    return "";
  }
  function prep(doc, opts) {
    doc = doc && typeof doc === "object" ? doc : {};
    var m = Object.assign({}, doc.meta), n = 0;
    var o = { meta: m, title: S(m.title) || TL("Documento"), teacher: !!(opts && opts.version === "professor"), blocks: A(doc.blocks).filter(function (b) { return b && typeof b === "object"; }), nums: [], key: [] };
    o.color = AV.THEMES[m.theme] || "#2F6FED";
    o.blocks.forEach(function (b, i) { var q = QT[b.type] ? ++n : 0; o.nums.push(q); if (q) o.key.push({ n: q, text: keyText(b) }); });
    o.heads = o.blocks.filter(function (b) { return b.type === "heading"; });
    return o;
  }
  var showKey = function (o) { return !o.teacher && o.meta.answer_key && o.key.length > 0; };

  function lib(key, get) {
    return Promise.resolve().then(function () {
      var v = get(); if (v) return v;
      return Promise.resolve(AV.loadScript && AV.loadScript(AV.LIBS[key])).then(function () {
        v = get(); if (!v) throw new Error("Biblioteca indisponível: " + key); return v;
      });
    });
  }
  var getJsPDF = function () { var j = G.jspdf; return (j && (j.jsPDF || j.default)) || (typeof G.jsPDF === "function" ? G.jsPDF : null); };
  var getDocx = function () { return G.docx || null; };
  var getPptx = function () { var p = G.PptxGenJS; return p ? (typeof p === "function" ? p : p.default) : null; };

  /* ---------------------------------------------------------------- binary utils */
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64(bytes) {
    var s = "", i, a, b, c;
    for (i = 0; i < bytes.length; i += 3) {
      a = bytes[i]; b = bytes[i + 1]; c = bytes[i + 2];
      s += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)] + (i + 1 < bytes.length ? B64[((b & 15) << 2) | ((c || 0) >> 6)] : "=") + (i + 2 < bytes.length ? B64[c & 63] : "=");
    }
    return s;
  }
  function unb64(s) {
    s = s.replace(/[^A-Za-z0-9+/]/g, "");
    var out = new Uint8Array(Math.floor(s.length * 3 / 4)), i, j = 0, v = 0, bits = 0;
    for (i = 0; i < s.length; i++) { v = (v << 6) | B64.indexOf(s[i]); bits += 6; if (bits >= 8) { bits -= 8; out[j++] = (v >> bits) & 255; } }
    return out;
  }
  function dataImg(url) {
    var m = /^data:(image\/(png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(S(url));
    if (!m) return null;
    var ext = m[2].toLowerCase().replace("jpeg", "jpg");
    return { mime: m[1].toLowerCase(), ext: ext, bytes: unb64(m[3]), url: "data:" + m[1].toLowerCase() + ";base64," + m[3].replace(/\s/g, "") };
  }
  function imgSize(p) {
    var b = p.bytes, i, mk;
    try {
      if (p.ext === "png" && b.length > 24) return { w: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, h: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
      if (p.ext === "jpg") {
        i = 2;
        while (i + 9 < b.length && b[i] === 0xFF) {
          mk = b[i + 1];
          if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
          i += 2 + ((b[i + 2] << 8) | b[i + 3]);
        }
      }
      if (p.ext === "gif" && b.length > 10) return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
    } catch (e) { /* ignore */ }
    return null;
  }
  var ratio = function (p) { var s = imgSize(p); return s && s.w > 0 && s.h > 0 ? s.h / s.w : 0.66; };

  var _crc;
  function crc32(b) {
    var c, n, k, i;
    if (!_crc) { _crc = []; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; _crc[n] = c >>> 0; } }
    c = -1; for (i = 0; i < b.length; i++) c = _crc[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  function be32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function cat() { var a = [], i; for (i = 0; i < arguments.length; i++) a = a.concat(Array.prototype.slice.call(arguments[i])); return a; }
  function pngChunk(type, data) {
    var body = cat([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], data);
    return cat(be32(data.length), body, be32(crc32(body)));
  }
  /* 1-bit grayscale PNG of a boolean matrix (stored deflate, no compression needed) */
  function matrixPNG(mx, scale, quiet) {
    var n = mx.length, tot = n + 2 * quiet, px = tot * scale, rb = Math.ceil(px / 8), raw = new Uint8Array(px * (rb + 1)), y, x, r, c, o2, i, a = 1, s = 0, idat = [0x78, 1], off, len;
    for (y = 0; y < px; y++) {
      o2 = y * (rb + 1); raw[o2] = 0;
      for (x = 0; x < rb; x++) raw[o2 + 1 + x] = 255;
      r = Math.floor(y / scale) - quiet;
      if (r < 0 || r >= n) continue;
      for (x = 0; x < px; x++) { c = Math.floor(x / scale) - quiet; if (c >= 0 && c < n && mx[r][c]) raw[o2 + 1 + (x >> 3)] &= ~(0x80 >> (x & 7)); }
    }
    for (off = 0; off < raw.length; off += 65535) {
      len = Math.min(65535, raw.length - off);
      idat = idat.concat([off + len >= raw.length ? 1 : 0, len & 255, len >> 8, (~len) & 255, ((~len) >> 8) & 255], Array.prototype.slice.call(raw.subarray(off, off + len)));
    }
    for (i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; s = (s + a) % 65521; }
    idat = idat.concat(be32(((s << 16) | a) >>> 0));
    return Uint8Array.from(cat([137, 80, 78, 71, 13, 10, 26, 10], pngChunk("IHDR", cat(be32(px), be32(px), [1, 0, 0, 0, 0])), pngChunk("IDAT", idat), pngChunk("IEND", [])));
  }

  /* ------------------------------------------------------------------- QR code */
  /* Byte mode, ECC L/M/Q/H, versions 1-10. Structure follows the ISO/IEC 18004 algorithm. */
  var ECW = [[7, 10, 15, 20, 26, 18, 20, 24, 30, 18], [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], [13, 22, 18, 26, 18, 24, 18, 22, 20, 24], [17, 28, 22, 16, 22, 28, 26, 26, 24, 28]];
  var NBK = [[1, 1, 1, 1, 1, 2, 2, 2, 2, 4], [1, 1, 1, 2, 2, 4, 4, 4, 5, 5], [1, 1, 2, 2, 4, 4, 6, 6, 8, 8], [1, 1, 2, 4, 4, 4, 5, 6, 8, 8]];
  var FMTB = [1, 0, 3, 2];
  function utf8(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.codePointAt(i); if (c > 0xFFFF) i++;
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else if (c < 65536) out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
      else out.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return out;
  }
  function gmul(x, y) { var z = 0, i; for (i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsRem(data, deg) {
    var gen = [], i, j, root = 1, res = [];
    for (i = 0; i < deg - 1; i++) gen.push(0);
    gen.push(1);
    for (i = 0; i < deg; i++) { for (j = 0; j < gen.length; j++) { gen[j] = gmul(gen[j], root); if (j + 1 < gen.length) gen[j] ^= gen[j + 1]; } root = gmul(root, 2); }
    for (i = 0; i < deg; i++) res.push(0);
    data.forEach(function (b) { var f = b ^ res.shift(); res.push(0); gen.forEach(function (c, k) { res[k] ^= gmul(c, f); }); });
    return res;
  }
  var rawMods = function (v) { var r = (16 * v + 128) * v + 64, n; if (v >= 2) { n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };

  function qrMatrix(text, ecc) {
    var ei = { L: 0, M: 1, Q: 2, H: 3 }[S(ecc || "M").toUpperCase()]; if (ei == null) ei = 1;
    var bytes = utf8(S(text)), v, cap, i, j, x, y, bits = [], data = [], pad;
    for (v = 1; v <= 10; v++) {
      cap = (Math.floor(rawMods(v) / 8) - ECW[ei][v - 1] * NBK[ei][v - 1]) * 8;
      if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap) break;
    }
    if (v > 10) return [];
    var put = function (val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    for (i = 0; i < bits.length; i += 8) { x = 0; for (j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
    var nb = NBK[ei][v - 1], eb = ECW[ei][v - 1], rawCw = Math.floor(rawMods(v) / 8), shortN = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb) - eb, blocks = [], k = 0, all = [], d;
    for (i = 0; i < nb; i++) {
      d = data.slice(k, k + shortLen + (i < shortN ? 0 : 1)); k += d.length;
      var e = rsRem(d, eb); if (i < shortN) d.push(0);
      blocks.push(d.concat(e));
    }
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (b, bj) { if (i !== shortLen || bj >= shortN) all.push(b[i]); });

    var size = v * 4 + 17, M = [], F = [];
    for (i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    var set = function (px, py, dk) { if (px >= 0 && px < size && py >= 0 && py < size) { M[py][px] = dk; F[py][px] = true; } };
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var dist = Math.max(Math.abs(dx), Math.abs(dy)); set(c[0] + dx, c[1] + dy, dist !== 2 && dist !== 4); }
    });
    var ap = [];
    if (v > 1) {
      var na = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2;
      ap = [6]; for (var pos = size - 7; ap.length < na; pos -= step) ap.splice(1, 0, pos);
    }
    ap.forEach(function (ax, ai) {
      ap.forEach(function (ay, aj) {
        if ((ai === 0 && aj === 0) || (ai === 0 && aj === ap.length - 1) || (ai === ap.length - 1 && aj === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    var drawFmt = function (mask) {
      var dd = (FMTB[ei] << 3) | mask, rem = dd, q;
      for (q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fb = ((dd << 10) | rem) ^ 0x5412, bit = function (n) { return ((fb >>> n) & 1) !== 0; };
      for (q = 0; q <= 5; q++) set(8, q, bit(q));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
      set(8, size - 8, true);
    };
    drawFmt(0);
    if (v >= 7) {
      var vr = v; for (i = 0; i < 12; i++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
      var vb = (v << 12) | vr;
      for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) !== 0, a1 = size - 11 + i % 3, b1 = Math.floor(i / 3); set(a1, b1, bt); set(b1, a1, bt); }
    }
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        x = right - j; y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!F[y][x] && idx < all.length * 8) { M[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
      }
    }
    var mask = function (m) {
      for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) {
        if (F[yy][xx]) continue;
        var inv;
        switch (m) {
          case 0: inv = (xx + yy) % 2 === 0; break; case 1: inv = yy % 2 === 0; break; case 2: inv = xx % 3 === 0; break; case 3: inv = (xx + yy) % 3 === 0; break;
          case 4: inv = (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0; break; case 5: inv = xx * yy % 2 + xx * yy % 3 === 0; break;
          case 6: inv = (xx * yy % 2 + xx * yy % 3) % 2 === 0; break; default: inv = ((xx + yy) % 2 + xx * yy % 3) % 2 === 0;
        }
        if (inv) M[yy][xx] = !M[yy][xx];
      }
    };
    var penalty = function () {
      var p = 0, lines = [], s, yy, xx, dark = 0, c;
      for (yy = 0; yy < size; yy++) { s = ""; for (xx = 0; xx < size; xx++) { s += M[yy][xx] ? 1 : 0; if (M[yy][xx]) dark++; } lines.push(s); }
      for (xx = 0; xx < size; xx++) { s = ""; for (yy = 0; yy < size; yy++) s += M[yy][xx] ? 1 : 0; lines.push(s); }
      lines.forEach(function (ln) {
        (ln.match(/0+|1+/g) || []).forEach(function (r) { if (r.length >= 5) p += r.length - 2; });
        p += 40 * (("0000" + ln + "0000").match(/(?=00001011101|10111010000)/g) || []).length;
      });
      for (yy = 0; yy < size - 1; yy++) for (xx = 0; xx < size - 1; xx++) { c = M[yy][xx]; if (c === M[yy][xx + 1] && c === M[yy + 1][xx] && c === M[yy + 1][xx + 1]) p += 3; }
      return p + (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
    };
    var best = 0, bestP = Infinity, m2, pe;
    for (m2 = 0; m2 < 8; m2++) { mask(m2); drawFmt(m2); pe = penalty(); if (pe < bestP) { bestP = pe; best = m2; } mask(m2); }
    mask(best); drawFmt(best);
    return M;
  }
  var qrPngBytes = function (text, scale) { var mx = qrMatrix(text); return mx.length ? matrixPNG(mx, scale || 8, 4) : null; };
  function qrSvg(text, label) {
    var mx = qrMatrix(text), n = mx.length, d = "", x, y, s;
    if (!n) return "";
    for (y = 0; y < n; y++) { x = 0; while (x < n) { if (mx[y][x]) { s = x; while (x < n && mx[y][x]) x++; d += "M" + (s + 4) + " " + (y + 4) + "h" + (x - s) + "v1h-" + (x - s) + "z"; } else x++; } }
    return '<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 8) + " " + (n + 8) + '" role="img" aria-label="' + esc(label) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  AV.qr = AV.qr || {};
  AV.qr.matrix = qrMatrix;
  AV.qr.png = qrPngBytes;
  AV.qr.dataUrl = function (text, scale) { var b = qrPngBytes(text, scale); return b ? "data:image/png;base64," + b64(b) : ""; };

  /* ----------------------------------------------------------------------- PDF */
  var WINANSI = /[^\u0000-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu;
  var SUBST = { "→": "->", "←": "<-", "↔": "<->", "✓": "v", "✔": "v", "≤": "<=", "≥": ">=", "≠": "!=", "−": "-", "≈": "~", "★": "*", "☐": "[ ]" };
  var pdfSafe = function (s) { return S(s).replace(/\r/g, "").replace(/\t/g, "    ").replace(WINANSI, function (c) { return SUBST[c] || "?"; }); };
  var DARK = [33, 37, 45], GRAY = [110, 117, 128], LINE = [205, 210, 218], LINK = [0, 82, 204];

  async function toPDF(doc, opts) { setLang(doc);
    var o = prep(doc, opts), m = o.meta, jsPDF = await lib("jspdf", getJsPDF), T = o.teacher, theme = hexRgb(o.color);
    var enc, pdf;
    if (m.protect && S(m.owner_password)) {
      var perms = ["annot-forms"]; if (m.allow_print !== false) perms.push("print"); if (m.allow_copy !== false) perms.push("copy");
      enc = { userPassword: "", ownerPassword: S(m.owner_password), userPermissions: perms };
    }
    try { pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true, encryption: enc }); }
    catch (e) { pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }); }
    try { pdf.setProperties({ title: o.title, subject: S(m.subject), author: S(m.author), creator: "AulaViva Studio" }); } catch (e) { /* ignore */ }

    var AF = jsPDF.AcroForm || (jsPDF.API && jsPDF.API.AcroForm) || pdf.AcroForm || {};
    var jl = G.jspdf || {};
    var TF = AF.TextField || jl.AcroFormTextField, RB = AF.RadioButton || jl.AcroFormRadioButton;
    var P = { W: 210, H: 297, mL: 18, mR: 18, mT: 18, mB: 20, y: 18, heads: [] };
    P.cw = P.W - P.mL - P.mR;
    var fresh = true;

    var fill = function (c) { pdf.setFillColor(c[0], c[1], c[2]); }, stroke = function (c) { pdf.setDrawColor(c[0], c[1], c[2]); }, tcol = function (c) { pdf.setTextColor(c[0], c[1], c[2]); };
    var lh = function (size) { return size * 0.3528 * 1.38; };
    var pages = function () { return pdf.getNumberOfPages(); };
    var usable = P.H - P.mT - P.mB;
    function pg() { if (fresh) fresh = false; else pdf.addPage(); P.y = P.mT; }
    function need(h) { if (P.y + h > P.H - P.mB + 0.01) { pdf.addPage(); P.y = P.mT; } }
    function keep(h) { if (h < usable) need(h); }
    function txt(s, x, y, size, style, col, o2) { pdf.setFont("helvetica", style || "normal"); pdf.setFontSize(size); tcol(col || DARK); pdf.text(pdfSafe(s), x, y, o2); }
    var fstyle = function (b, i) { return b && i ? "bolditalic" : b ? "bold" : i ? "italic" : "normal"; };
    function wid(s, size, st) { pdf.setFont("helvetica", st); pdf.setFontSize(size); return pdf.getTextWidth(s); }

    function layout(segs, maxW, size, base) {
      var lines = [], cur = { s: [], w: 0 };
      base = base || {};
      function push() { while (cur.s.length && cur.s[cur.s.length - 1].sp) cur.w -= cur.s.pop().w; lines.push(cur); cur = { s: [], w: 0 }; }
      function add(t) {
        if (t.sp && !cur.s.length) return;
        if (cur.w + t.w > maxW + 0.01 && cur.s.length && !t.sp) push();
        cur.s.push(t); cur.w += t.w;
      }
      segs.forEach(function (g) {
        if (g.blank != null) { add({ blank: g.blank, ans: g.ans, w: g.w, st: "bold" }); return; }
        var st = fstyle(base.b || g.b, base.i || g.i);
        pdfSafe(g.t).split("\n").forEach(function (pt, k) {
          if (k) push();
          pt.split(/( +)/).forEach(function (w) {
            if (!w) return;
            var sp = w[0] === " ", ww = wid(w, size, st), chunk = "";
            if (!sp && ww > maxW) {
              w.split("").forEach(function (ch) {
                if (chunk && wid(chunk + ch, size, st) > maxW - 0.5) { add({ s: chunk, st: st, w: wid(chunk, size, st) }); push(); chunk = ""; }
                chunk += ch;
              });
              if (chunk) add({ s: chunk, st: st, w: wid(chunk, size, st) });
            } else add({ s: w, st: st, w: ww, sp: sp });
          });
        });
      });
      if (cur.s.length || !lines.length) push();
      return lines;
    }
    var rich = function (text, w, size, base) { return layout(inline(text), w, size, base); };
    function drawLines(lines, x, size, lhh, o2) {
      o2 = o2 || {};
      lines.forEach(function (ln) {
        need(lhh);
        var by = P.y + lhh * 0.5 + size * 0.1235, cx = o2.w ? x + (o2.w - ln.w) / 2 : x;
        ln.s.forEach(function (t) {
          if (t.blank != null) { if (o2.blank) o2.blank(t, cx, P.y, lhh); }
          else if (!t.sp) {
            pdf.setFont("helvetica", t.st); pdf.setFontSize(size); tcol(o2.color || DARK); pdf.text(t.s, cx, by);
            if (o2.url) { stroke(o2.color || LINK); pdf.setLineWidth(0.2); pdf.line(cx, by + 0.7, cx + t.w, by + 0.7); pdf.link(cx, P.y, t.w, lhh, { url: o2.url }); }
          }
          cx += t.w;
        });
        P.y += lhh;
      });
    }
    var hOf = function (lines, size) { return lines.length * lh(size); };

    /* interactive fields (student version only) */
    function textField(name, x, y, w, h, multi, size) {
      if (T || !TF) return;
      try { var f = new TF(); f.fieldName = name; f.Rect = [x, y, w, h]; f.multiline = !!multi; f.fontSize = size || 11; f.value = ""; pdf.addField(f); } catch (e) { P.afError = e; }
    }
    function radioGroup(name, kids) {
      if (T || !RB) return;
      try {
        var g = new RB(); g.fieldName = name;
        kids.forEach(function (k) { var op = g.createOption(k.v); op.Rect = [k.x, k.y, k.s, k.s]; op.AS = "/Off"; });
        try { g.setAppearance(AF.Appearance.RadioButton.Circle); } catch (e) { /* default appearance */ }
        pdf.addField(g);
      } catch (e) { P.afError = e; }
    }
    function radioMark(cx, cy, on) {
      stroke(on ? theme : GRAY); pdf.setLineWidth(0.35);
      if (on) { fill(theme); pdf.circle(cx, cy, 2.1, "FD"); stroke([255, 255, 255]); pdf.setLineWidth(0.45); pdf.line(cx - 1.1, cy, cx - 0.3, cy + 0.9); pdf.line(cx - 0.3, cy + 0.9, cx + 1.2, cy - 1); }
      else { fill([255, 255, 255]); pdf.circle(cx, cy, 2.1, "FD"); }
    }
    function badge(n) {
      fill(theme); pdf.roundedRect(P.mL, P.y + 0.4, 7, 5.4, 1.2, 1.2, "F");
      txt(String(n), P.mL + 3.5, P.y + 4.3, 10, "bold", [255, 255, 255], { align: "center" });
    }
    function qHead(n, prompt, extra) {
      var pl = rich(prompt, P.cw - 9, 11, {});
      keep(hOf(pl, 11) + (extra || 0) + 3);
      badge(n); drawLines(pl, P.mL + 9, 11, lh(11)); P.y += 1.5;
    }

    /* page furniture */
    function cover() {
      var y;
      fill(theme); pdf.rect(0, 0, P.W, 118, "F"); fill(shade(theme, 0.25)); pdf.rect(0, 118, P.W, 3, "F");
      txt((((KIND_I18N[CUR] || {})[m.kind]) || KIND[m.kind] || TL("Documento")).toUpperCase(), P.mL, 32, 11, "bold", tint(theme, 0.75));
      var tl = layout([{ t: o.title, b: 1 }], P.cw, 30, { b: 1 }), sl = m.subtitle ? rich(m.subtitle, P.cw, 16, {}) : [];
      P.y = 42; drawLines(tl, P.mL, 30, lh(30) * 1.05, { color: [255, 255, 255] }); P.y += 3;
      drawLines(sl, P.mL, 16, lh(16), { color: tint(theme, 0.85) });
      y = 140;
      [[TL("Disciplina"), m.subject], [TL("Nível / ano"), m.level], [TL("Escola"), m.school], [TL("Professor(a)"), m.author]].forEach(function (r) {
        if (!S(r[1])) return;
        txt(r[0].toUpperCase(), P.mL, y, 8, "bold", GRAY); txt(S(r[1]), P.mL, y + 6.5, 14, "normal", DARK); y += 18;
      });
      if (T) { fill(tint(theme, 0.85)); pdf.roundedRect(P.mL, 262, 62, 9, 2, 2, "F"); txt("VERSÃO DO PROFESSOR", P.mL + 31, 268, 9, "bold", shade(theme, 0.3), { align: "center" }); }
    }
    function titleHeader() {
      var tl = layout([{ t: o.title, b: 1 }], P.cw, 20, { b: 1 });
      drawLines(tl, P.mL, 20, lh(20), { color: theme });
      if (m.subtitle) drawLines(rich(m.subtitle, P.cw, 12, {}), P.mL, 12, lh(12), { color: GRAY });
      var meta = [m.subject, m.level, m.school, m.author].filter(S).join("  ·  ");
      if (meta) { P.y += 1; txt(meta, P.mL, P.y + 4, 9, "normal", GRAY); P.y += 6; }
      stroke(theme); pdf.setLineWidth(0.7); pdf.line(P.mL, P.y + 1.5, P.mL + P.cw, P.y + 1.5); P.y += 7;
      if (T) { txt(TL("Versão do professor (com respostas)"), P.mL, P.y + 3, 9, "bold", shade(theme, 0.2)); P.y += 8; }
    }
    function studentBox() {
      need(26); var y0 = P.y, x1 = P.mL + 4, xe = P.mL + P.cw - 4;
      stroke(LINE); pdf.setLineWidth(0.3); pdf.roundedRect(P.mL, y0, P.cw, 24, 2, 2, "S");
      var row = function (items, y) {
        items.forEach(function (it) {
          txt(it[0], it[1], y + 5, 10, "bold", GRAY);
          var fx = it[1] + it[2], fw = it[3] - it[2];
          stroke(LINE); pdf.setLineWidth(0.3); pdf.line(fx, y + 6.3, it[1] + it[3], y + 6.3);
          textField(it[4], fx, y, fw, 6.8, false, 11);
        });
      };
      row([[TL("Nome:"), x1, 13, xe - x1, "aluno_nome"]], y0 + 3.5);
      row([[TL("Turma:"), x1, 14, 70, "aluno_turma"], [TL("Data:"), x1 + 82, 12, xe - x1 - 82, "aluno_data"]], y0 + 13);
      P.y = y0 + 29;
    }

    /* block renderers */
    var draw = {
      heading: function (b) {
        var l1 = b.level !== 2, size = l1 ? 17 : 13, lines = layout(inline(b.text), P.cw, size, { b: 1 });
        P.y += l1 ? 5 : 3; need(hOf(lines, size) + 18);
        var t = strip(b.text), pn = pages();
        P.heads.push({ text: t, level: l1 ? 1 : 2, page: pn });
        try { pdf.outline.add(null, pdfSafe(t), { pageNumber: pn }); } catch (e) { /* ignore */ }
        drawLines(lines, P.mL, size, lh(size), { color: l1 ? theme : DARK });
        if (l1) { stroke(theme); pdf.setLineWidth(0.5); pdf.line(P.mL, P.y + 0.3, P.mL + P.cw, P.y + 0.3); P.y += 3; } else P.y += 1.2;
      },
      paragraph: function (b) { drawLines(rich(b.text, P.cw, 11, {}), P.mL, 11, lh(11)); P.y += 2.2; },
      bullets: function (b) {
        A(b.items).forEach(function (it) {
          var lines = rich(it, P.cw - 8, 11, {}); need(lh(11));
          fill(theme); pdf.circle(P.mL + 3, P.y + lh(11) / 2, 0.8, "F");
          drawLines(lines, P.mL + 7, 11, lh(11)); P.y += 0.8;
        });
        P.y += 1.5;
      },
      callout: function (b) {
        var c = AV.CALLOUTS[b.style] || ["Nota", o.color], col = hexRgb(c[1]), pad = 3;
        var tl = layout([{ t: S(b.title) || c[0], b: 1 }], P.cw - 8, 11, { b: 1 }), bl = rich(b.text, P.cw - 8, 10.5, {});
        var h = pad * 2 + hOf(tl, 11) + hOf(bl, 10.5);
        keep(h); var y0 = P.y;
        if (h < usable) { fill(tint(col, 0.9)); pdf.roundedRect(P.mL, y0, P.cw, h, 1.5, 1.5, "F"); fill(col); pdf.rect(P.mL, y0, 1.6, h, "F"); }
        P.y = y0 + pad; drawLines(tl, P.mL + 5, 11, lh(11), { color: shade(col, 0.25) }); drawLines(bl, P.mL + 5, 10.5, lh(10.5));
        P.y = Math.max(P.y, y0 + h) + 3;
      },
      image: function (b) {
        var p = dataImg(b.data), w = P.cw * N(b.width, 70, 20, 100) / 100, h, cap;
        if (!p) return;
        h = w * ratio(p); if (h > 120) { w *= 120 / h; h = 120; }
        cap = b.caption ? rich(b.caption, P.cw, 9, { i: 1 }) : [];
        keep(h + hOf(cap, 9) + 5);
        try { pdf.addImage(p.url, p.ext === "jpg" ? "JPEG" : p.ext.toUpperCase(), P.mL + (P.cw - w) / 2, P.y, w, h); }
        catch (e) { stroke(LINE); pdf.rect(P.mL + (P.cw - w) / 2, P.y, w, h, "S"); txt("[imagem não disponível]", P.mL + P.cw / 2, P.y + h / 2, 9, "italic", GRAY, { align: "center" }); }
        P.y += h + 1.5; drawLines(cap, P.mL, 9, lh(9), { color: GRAY, w: P.cw }); P.y += 3;
      },
      qrcode: function (b) {
        var size = N(b.size, 30, 20, 60), mx = qrMatrix(b.url), n = mx.length, url = S(b.url);
        var cl = b.caption ? layout([{ t: S(b.caption), b: 1 }], P.cw - size - 6, 11, { b: 1 }) : [], ul = layout([{ t: url }], P.cw - size - 6, 8.5, {});
        keep(size + 4); var y0 = P.y;
        if (n) {
          var mod = size / (n + 4), x, y, s;
          fill([255, 255, 255]); stroke(LINE); pdf.setLineWidth(0.2); pdf.rect(P.mL, y0, size, size, "FD"); fill([0, 0, 0]);
          for (y = 0; y < n; y++) { x = 0; while (x < n) { if (mx[y][x]) { s = x; while (x < n && mx[y][x]) x++; pdf.rect(P.mL + (s + 2) * mod, y0 + (y + 2) * mod, (x - s) * mod + 0.02, mod + 0.02, "F"); } else x++; } }
        }
        if (/^https?:\/\//i.test(url)) pdf.link(P.mL, y0, size, size, { url: url });
        P.y = y0 + 2; drawLines(cl, P.mL + size + 6, 11, lh(11));
        drawLines(ul, P.mL + size + 6, 8.5, lh(8.5), { color: LINK, url: /^https?:\/\//i.test(url) ? url : null });
        P.y = y0 + size + 4;
      },
      link: function (b) { card("link", b.label || b.url, b.url, b.description, "www"); },
      word: function (b) { card("word", b.label || b.filename || "Documento Word", b.url, b.filename, "W"); },
      video: function (b) { card("video", b.title || "Vídeo", b.url, b.info, ""); },
      open_question: function (b, n, idx) {
        var pl = rich(b.prompt, P.cw - 9, 11, {}), nl = N(b.lines, 3, 1, 12), fh = nl * 7, al = T ? rich(S(b.answer) || "—", P.cw - 15, 10.5, {}) : null;
        var boxH = T ? 4.5 + lh(9) + hOf(al, 10.5) : fh;
        keep(hOf(pl, 11) + boxH + 4);
        badge(n); drawLines(pl, P.mL + 9, 11, lh(11)); P.y += 1.5;
        var x = P.mL + 9, w = P.cw - 9, y0 = P.y, k;
        if (T) {
          fill(tint(theme, 0.9)); pdf.roundedRect(x, y0, w, boxH, 1.5, 1.5, "F"); P.y = y0 + 2;
          drawLines([{ s: [{ s: TL("Resposta"), st: "bold", w: 20 }], w: 20 }], x + 3, 9, lh(9), { color: shade(theme, 0.2) });
          drawLines(al, x + 3, 10.5, lh(10.5)); P.y = y0 + boxH + 4;
        } else {
          stroke(LINE); pdf.setLineWidth(0.3); pdf.roundedRect(x, y0, w, fh, 1.5, 1.5, "S");
          for (k = 1; k < nl; k++) pdf.line(x + 1.5, y0 + 7 * k, x + w - 1.5, y0 + 7 * k);
          textField("q" + idx + "_resposta", x, y0, w, fh, true, 11);
          P.y = y0 + fh + 4;
        }
      },
      choice_question: function (b, n, idx) {
        var c = N(b.correct, 0, 0, 999), tx = P.mL + 22, tw = P.cw - 22, L11 = lh(11);
        var ol = A(b.options).map(function (t, i) { return rich(t, tw, 11, T && i === c ? { b: 1 } : {}); });
        var pl = rich(b.prompt, P.cw - 9, 11, {});
        keep(hOf(pl, 11) + 2 + ol.reduce(function (s, ln) { return s + Math.max(hOf(ln, 11), 6) + 1.2; }, 0) + 2);
        badge(n); drawLines(pl, P.mL + 9, 11, L11); P.y += 1.5;
        var kids = [];
        ol.forEach(function (lines, i) {
          var h = Math.max(hOf(lines, 11), 6), cy, cx = P.mL + 11.5;
          need(h); cy = P.y + L11 / 2;
          radioMark(cx, cy, T && i === c);
          kids.push({ x: cx - 2.1, y: cy - 2.1, s: 4.2, v: L(i) });
          txt(L(i) + ")", P.mL + 16, cy + 1.3, 11, "bold", GRAY);
          var y0 = P.y; drawLines(lines, tx, 11, L11); P.y = y0 + h + 1.2;
        });
        radioGroup("q" + idx, kids); P.y += 1.5;
      },
      true_false: function (b, n, idx) {
        var st = A(b.statements), sx = P.mL + 9 + 30, sw = P.cw - 9 - 30, L11 = lh(11);
        var rows = st.map(function (t, i) { return rich(t, sw, 11, T ? { b: !!A(b.answers)[i] || false } : {}); });
        keep(L11 + 3 + rows.reduce(function (s, ln) { return s + Math.max(hOf(ln, 11), 6) + 1.5; }, 0));
        badge(n); txt(TL("Marque V (verdadeiro) ou F (falso):"), P.mL + 9, P.y + 4.3, 11, "normal", DARK); P.y += L11 + 2;
        rows.forEach(function (lines, i) {
          var h = Math.max(hOf(lines, 11), 6), ans = !!A(b.answers)[i], cy;
          need(h); cy = P.y + L11 / 2;
          radioMark(P.mL + 11.4, cy, T && ans); txt("V", P.mL + 15, cy + 1.3, 10, "bold", GRAY);
          radioMark(P.mL + 25.4, cy, T && !ans); txt("F", P.mL + 29, cy + 1.3, 10, "bold", GRAY);
          radioGroup("q" + idx + "_" + i, [{ x: P.mL + 9.3, y: cy - 2.1, s: 4.2, v: "V" }, { x: P.mL + 23.3, y: cy - 2.1, s: 4.2, v: "F" }]);
          var y0 = P.y; drawLines(lines, sx - 4, 11, L11); P.y = y0 + h + 1.5;
        });
        P.y += 1.5;
      },
      table: function (b) {
        var rows = A(b.rows).map(function (r) { return A(r).map(S); }), nc = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(1)), cw = P.cw / nc, pad = 1.8, size = 10, L10 = lh(size);
        rows.forEach(function (r, ri) {
          var cells = [], c, h;
          for (c = 0; c < nc; c++) cells.push(rich(r[c] || "", cw - 2 * pad, size, ri === 0 ? { b: 1 } : {}));
          h = Math.max.apply(null, cells.map(function (x) { return x.length; })) * L10 + 2 * pad;
          need(h + (ri === 0 ? L10 + 2 * pad : 0));
          var y0 = P.y; stroke(LINE); pdf.setLineWidth(0.2);
          for (c = 0; c < nc; c++) {
            fill(ri === 0 ? theme : ri % 2 === 0 ? [244, 246, 249] : [255, 255, 255]);
            pdf.rect(P.mL + c * cw, y0, cw, h, "FD");
            P.y = y0 + pad; drawLines(cells[c], P.mL + c * cw + pad, size, L10, { color: ri === 0 ? [255, 255, 255] : DARK });
          }
          P.y = y0 + h;
        });
        P.y += 3;
      },
      divider: function () { P.y += 2; stroke(LINE); pdf.setLineWidth(0.3); pdf.line(P.mL, P.y, P.mL + P.cw, P.y); P.y += 4; },
      page_break: function () { if (P.y > P.mT + 0.5) { pdf.addPage(); P.y = P.mT; } },
      word_search: function (b, n) {
        var grid = A(b.grid).map(A), rows = grid.length, cols = Math.max.apply(null, grid.map(function (r) { return r.length; }).concat(1));
        var cell = Math.min(8, P.cw / cols, (usable - 40) / Math.max(rows, 1)), gw = cell * cols, x0 = P.mL + (P.cw - gw) / 2;
        var words = A(b.words).map(S).join("   ·   "), wl = layout([{ t: TL("Palavras: "), b: 1 }, { t: words }], P.cw, 10, {});
        qHead(n, b.title || TL("Caça-palavras"), cell * rows + hOf(wl, 10) + 4);
        var y0 = P.y, hit = {}, r, c;
        if (T) A(b.solution).forEach(function (s) { A(s && s.cells).forEach(function (rc) { hit[A(rc)[0] + "," + A(rc)[1]] = 1; }); });
        stroke(LINE); pdf.setLineWidth(0.2);
        for (r = 0; r < rows; r++) for (c = 0; c < grid[r].length; c++) {
          if (hit[r + "," + c]) fill(tint(theme, 0.55)); else fill([255, 255, 255]);
          pdf.rect(x0 + c * cell, y0 + r * cell, cell, cell, "FD");
          txt(S(grid[r][c]).slice(0, 1), x0 + c * cell + cell / 2, y0 + r * cell + cell / 2, Math.min(12, cell * 1.6), "bold", DARK, { align: "center", baseline: "middle" });
        }
        P.y = y0 + cell * rows + 3; drawLines(wl, P.mL, 10, lh(10)); P.y += 3;
      },
      crossword: function (b, n) {
        var grid = A(b.grid).map(A), rows = grid.length, cols = Math.max.apply(null, grid.map(function (r) { return r.length; }).concat(1)), cl = b.clues || {};
        var cell = Math.min(9, P.cw / cols, (usable - 40) / Math.max(rows, 1)), gw = cell * cols, x0 = P.mL + (P.cw - gw) / 2;
        qHead(n, b.title || TL("Cruzadinha"), cell * rows + 4);
        var y0 = P.y, r, c, g;
        stroke(DARK); pdf.setLineWidth(0.3);
        for (r = 0; r < rows; r++) for (c = 0; c < grid[r].length; c++) {
          g = grid[r][c]; if (!g) continue;
          fill([255, 255, 255]); pdf.rect(x0 + c * cell, y0 + r * cell, cell, cell, "FD");
          if (g.number != null) txt(String(g.number), x0 + c * cell + 0.7, y0 + r * cell + 2.4, 6.5, "normal", GRAY);
          if (T && g.letter) txt(S(g.letter).slice(0, 1), x0 + c * cell + cell / 2, y0 + r * cell + cell / 2 + 0.6, Math.min(12, cell * 1.5), "bold", shade(theme, 0.2), { align: "center", baseline: "middle" });
        }
        P.y = y0 + cell * rows + 4;
        [[TL("Horizontais"), cl.across], [TL("Verticais"), cl.down]].forEach(function (grp) {
          var items = A(grp[1]); if (!items.length) return;
          need(lh(11) * 2); drawLines(layout([{ t: grp[0], b: 1 }], P.cw, 11, { b: 1 }), P.mL, 11, lh(11), { color: theme });
          items.forEach(function (it) { drawLines(layout([{ t: S(it && it.n) + ". ", b: 1 }, { t: S(it && it.clue) + (T ? "  (" + S(it && it.answer) + ")" : "") }], P.cw - 4, 10.5, {}), P.mL + 4, 10.5, lh(10.5)); });
          P.y += 2;
        });
      },
      match: function (b, n, idx) {
        var left = A(b.left), right = A(b.right), rows = Math.max(left.length, right.length), lw = 60, fx = P.mL + 9 + lw + 3, rx = fx + 10 + 7, rw = P.cw - (rx - P.mL), L11 = lh(11);
        qHead(n, b.prompt, 14);
        for (var i = 0; i < rows; i++) {
          var ll = i < left.length ? layout([{ t: (i + 1) + ". ", b: 1 }].concat(inline(left[i])), lw, 11, {}) : [], rl = i < right.length ? layout([{ t: l(i) + ") ", b: 1 }].concat(inline(right[i])), rw, 11, {}) : [];
          var h = Math.max(hOf(ll, 11), hOf(rl, 11), 7) + 1.2; need(h);
          var y0 = P.y;
          if (i < left.length) {
            if (T) { fill(tint(theme, 0.85)); stroke(theme); pdf.roundedRect(fx, y0, 10, 6.4, 1, 1, "FD"); txt(l(N(A(b.answers)[i], 0, 0, 999)), fx + 5, y0 + 4.5, 11, "bold", shade(theme, 0.3), { align: "center" }); }
            else { stroke(GRAY); pdf.setLineWidth(0.3); pdf.roundedRect(fx, y0, 10, 6.4, 1, 1, "S"); textField("q" + idx + "_" + i, fx, y0, 10, 6.4, false, 11); }
          }
          drawLines(ll, P.mL + 9, 11, L11); var yl = P.y; P.y = y0; drawLines(rl, rx, 11, L11); P.y = Math.max(yl, P.y, y0 + h);
        }
        P.y += 2;
      },
      fill_blank: function (b, n, idx) {
        var L2 = 8.5, bw = 30, segs = [];
        blanks(b.text).forEach(function (p) {
          if (p.blank == null) { inline(p.t).forEach(function (g) { segs.push(g); }); return; }
          segs.push({ blank: p.blank, ans: p.ans, w: T ? wid(pdfSafe(p.ans), 11, "bold") + 4 : bw });
        });
        var lines = layout(segs, P.cw - 9, 11, {});
        qHead(n, b.prompt, 0);
        keep(lines.length * L2 + 3);
        drawLines(lines, P.mL + 9, 11, L2, {
          blank: function (t, cx, y0, lhh) {
            var ly = y0 + lhh - 1.5;
            if (T) { txt(t.ans, cx + 2, y0 + lhh / 2 + 1.4, 11, "bold", shade(theme, 0.2)); stroke(theme); pdf.setLineWidth(0.35); pdf.line(cx, ly, cx + t.w, ly); }
            else { stroke(GRAY); pdf.setLineWidth(0.3); pdf.line(cx, ly, cx + t.w, ly); textField("q" + idx + "_" + t.blank, cx, y0 + 0.8, t.w, lhh - 1.8, false, 11); }
          }
        });
        P.y += 3;
      }
    };
    function card(kind, title, url, sub, icon) {
      var tl = rich(title, P.cw - 16, 11.5, { b: 1 }), ul = layout([{ t: S(url) }], P.cw - 16, 8.5, {}), dl = sub ? rich(sub, P.cw - 16, 9.5, {}) : [];
      var h = hOf(tl, 11.5) + hOf(ul, 8.5) + hOf(dl, 9.5) + 6, safe = /^(https?:\/\/|mailto:)/i.test(S(url)), y0;
      keep(h); y0 = P.y;
      fill(tint(theme, 0.93)); pdf.roundedRect(P.mL, y0, P.cw, h, 1.5, 1.5, "F");
      fill(kind === "word" ? [43, 87, 154] : kind === "video" ? [214, 48, 49] : theme); pdf.roundedRect(P.mL + 2.5, y0 + 2.5, 9, 9, 1.5, 1.5, "F");
      if (kind === "video") { fill([255, 255, 255]); pdf.triangle(P.mL + 5.6, y0 + 4.6, P.mL + 5.6, y0 + 9.4, P.mL + 9.6, y0 + 7, "F"); }
      else txt(icon, P.mL + 7, y0 + 8.4, kind === "word" ? 11 : 7, "bold", [255, 255, 255], { align: "center" });
      P.y = y0 + 2.5;
      drawLines(tl, P.mL + 14, 11.5, lh(11.5), { color: LINK, url: safe ? S(url) : null });
      drawLines(ul, P.mL + 14, 8.5, lh(8.5), { color: GRAY });
      drawLines(dl, P.mL + 14, 9.5, lh(9.5));
      if (safe) pdf.link(P.mL, y0, P.cw, h, { url: S(url) });
      P.y = y0 + h + 3;
    }

    /* ---- document assembly ---- */
    var hasKey = showKey(o), entries = o.heads.length + (hasKey ? 1 : 0), tocPages = [], rowH = 7.2;
    var capAt = function (y0) { var c = 0; for (var y = y0; y + rowH <= P.H - P.mB + 0.01; y += rowH) c++; return c; };
    if (m.cover) { cover(); fresh = false; }
    pg();
    if (!m.cover) titleHeader();
    if (m.toc && entries > 0) {
      var y0 = P.y, left = entries, c1 = capAt(y0 + 13);
      tocPages.push({ page: pages(), y: y0 }); left -= Math.max(c1, 1);
      while (left > 0) { pg(); tocPages.push({ page: pages(), y: P.mT }); left -= capAt(P.mT); }
      pg();
    }
    if (!T && m.student_fields) studentBox();
    o.blocks.forEach(function (b, i) {
      var f = draw[b.type];
      if (!f) return;
      try { f(b, o.nums[i], i); } catch (e) { P.err = e; }
    });
    if (hasKey) {
      pg();
      var kp = pages(); P.heads.push({ text: TL("Gabarito"), level: 1, page: kp });
      try { pdf.outline.add(null, TL("Gabarito"), { pageNumber: kp }); } catch (e) { /* ignore */ }
      drawLines(layout([{ t: TL("Gabarito"), b: 1 }], P.cw, 17, { b: 1 }), P.mL, 17, lh(17), { color: theme });
      stroke(theme); pdf.setLineWidth(0.5); pdf.line(P.mL, P.y + 0.3, P.mL + P.cw, P.y + 0.3); P.y += 4;
      o.key.forEach(function (k) { drawLines(layout([{ t: k.n + ". ", b: 1 }, { t: k.text }], P.cw, 11, {}), P.mL, 11, lh(11)); P.y += 1.2; });
    }
    /* table of contents (reserved pages, internal links) */
    var ti = 0;
    tocPages.forEach(function (tp, pi) {
      pdf.setPage(tp.page);
      var y = tp.y;
      if (pi === 0) { txt(TL("Sumário"), P.mL, y + 8, 17, "bold", theme); stroke(theme); pdf.setLineWidth(0.5); pdf.line(P.mL, y + 10.5, P.mL + P.cw, y + 10.5); y += 13; }
      for (; ti < P.heads.length && y + rowH <= P.H - P.mB + 0.01; ti++, y += rowH) {
        var h = P.heads[ti], x = P.mL + (h.level === 2 ? 6 : 0), st = h.level === 2 ? "normal" : "bold", pn = String(h.page), pw = wid(pn, 11, "normal");
        var label = pdf.splitTextToSize(pdfSafe(h.text), P.cw - (x - P.mL) - pw - 8)[0] || "", lw = wid(label, 11, st);
        txt(label, x, y + 5, 11, st, DARK); txt(pn, P.mL + P.cw, y + 5, 11, "normal", GRAY, { align: "right" });
        var dots = Math.floor((P.cw - (x - P.mL) - lw - pw - 4) / wid(".", 11, "normal") / 1.8);
        if (dots > 0) { var dw = wid(".", 11, "normal") * 1.8, k; for (k = 0; k < dots; k++) txt(".", x + lw + 2 + k * dw, y + 5, 11, "normal", LINE); }
        pdf.link(P.mL, y, P.cw, rowH, { pageNumber: h.page });
      }
    });
    /* footers and page numbers */
    var total = pages(), p, foot = S(m.footer) || o.title, left = (T ? TL("Versão do professor  |  ") : "") + foot;
    for (p = m.cover ? 2 : 1; p <= total; p++) {
      pdf.setPage(p); stroke(LINE); pdf.setLineWidth(0.2); pdf.line(P.mL, P.H - 14, P.mL + P.cw, P.H - 14);
      txt(pdf.splitTextToSize(pdfSafe(left), P.cw - 30)[0] || "", P.mL, P.H - 9.5, 8, "normal", GRAY);
      if (m.page_numbers) txt(TL("Página ") + p + TL(" de ") + total, P.mL + P.cw, P.H - 9.5, 8, "normal", GRAY, { align: "right" });
    }
    pdf.setPage(1);
    return pdf.output("blob");
  }

  /* ---------------------------------------------------------------------- DOCX */
  async function toDOCX(doc, opts) { setLang(doc);
    var o = prep(doc, opts), m = o.meta, D = await lib("docx", getDocx), T = o.teacher, hex = o.color.replace("#", "").toUpperCase(), tintHex = toHex(tint(hexRgb(o.color), 0.88));
    var Pg = D.Paragraph, TR = D.TextRun, ch = [], W = 9638, hk = 0, heads = [];
    function runs(text, x) {
      var out = [];
      inline(text).forEach(function (g) {
        S(g.t).split("\n").forEach(function (pt, k) {
          var op = Object.assign({ text: pt }, x || {}); if (g.b) op.bold = true; if (g.i) op.italics = true; if (k) op.break = 1;
          out.push(new TR(op));
        });
      });
      return out;
    }
    var par = function (children, p) { return new Pg(Object.assign({ children: children }, p || {})); };
    var plain = function (text, x, p) { return par(runs(text, x), p); };
    var gap = function () { return new Pg({ spacing: { after: 100 } }); };
    var cl = function (children, w, p) { return new D.TableCell(Object.assign({ children: children.length ? children : [new Pg({})], width: { size: w, type: D.WidthType.DXA } }, p)); };
    var tbl = function (rows, widths) { return new D.Table({ rows: rows, width: { size: widths.reduce(function (a, b) { return a + b; }, 0), type: D.WidthType.DXA }, columnWidths: widths }); };
    var NONE = { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" };
    var link = function (label, url, x) { return new D.ExternalHyperlink({ link: S(url), children: [new TR(Object.assign({ text: S(label) || S(url), color: "0563C1", underline: {} }, x || {}))] }); };
    function qHead(n, prompt) { ch.push(par([new TR({ text: n + ". ", bold: true, color: hex })].concat(runs(prompt, { bold: true })), { spacing: { before: 200, after: 80 }, keepNext: true })); }
    function labelHead(text, lvl, key) {
      var runs1 = [new TR({ text: text, bold: true, color: lvl === 1 ? hex : "222222", size: lvl === 1 ? 34 : 28 })];
      return new Pg({ heading: lvl === 1 ? D.HeadingLevel.HEADING_1 : D.HeadingLevel.HEADING_2, keepNext: true, spacing: { before: lvl === 1 ? 360 : 240, after: 100 }, children: [new D.Bookmark({ id: key, children: runs1 })] });
    }
    var pageBreak = function () { return new Pg({ children: [new D.PageBreak()] }); };
    var ruled = function (k) { var a = []; for (var i = 0; i < k; i++) a.push(new Pg({ spacing: { before: 280 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } } })); return a; };
    function gridTable(rows, cellFn, cols) {
      var cw = Math.min(440, Math.floor(W / Math.max(cols, 1)));
      return new D.Table({
        alignment: D.AlignmentType.CENTER, width: { size: cw * cols, type: D.WidthType.DXA }, columnWidths: new Array(cols).fill(cw),
        rows: rows.map(function (r, ri) {
          var cells = []; for (var c = 0; c < cols; c++) cells.push(cellFn(r[c], ri, c, cw));
          return new D.TableRow({ height: { value: cw, rule: D.HeightRule.EXACT }, children: cells });
        })
      });
    }

    if (m.cover) {
      ch.push(new Pg({ spacing: { before: 2800, after: 200 }, children: [new TR({ text: (((KIND_I18N[CUR] || {})[m.kind]) || KIND[m.kind] || TL("Documento")).toUpperCase(), bold: true, color: hex, size: 24 })] }));
      ch.push(new Pg({ spacing: { after: 200 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 24, color: hex, space: 8 } }, children: [new TR({ text: o.title, bold: true, size: 72, color: hex })] }));
      if (m.subtitle) ch.push(plain(m.subtitle, { size: 34, color: "555555" }, { spacing: { after: 600 } }));
      [[TL("Disciplina"), m.subject], [TL("Nível / ano"), m.level], [TL("Escola"), m.school], [TL("Professor(a)"), m.author]].forEach(function (r) {
        if (S(r[1])) ch.push(par([new TR({ text: r[0] + ": ", bold: true, color: "666666", size: 26 }), new TR({ text: S(r[1]), size: 26 })], { spacing: { after: 100 } }));
      });
      if (T) ch.push(par([new TR({ text: TL("Versão do professor"), bold: true, color: hex, size: 24 })], { spacing: { before: 400 } }));
      ch.push(pageBreak());
    } else {
      ch.push(par([new TR({ text: o.title, bold: true, size: 44, color: hex })], { spacing: { after: 60 } }));
      if (m.subtitle) ch.push(plain(m.subtitle, { size: 26, color: "555555" }));
      var meta = [m.subject, m.level, m.school, m.author].filter(S).join("  ·  ");
      if (meta) ch.push(plain(meta, { size: 20, color: "777777" }));
      if (T) ch.push(par([new TR({ text: TL("Versão do professor (com respostas)"), bold: true, color: hex })]));
      ch.push(par([], { border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: hex, space: 1 } }, spacing: { after: 160 } }));
    }
    var hasKey = showKey(o), hi = 0;
    if (m.toc && (o.heads.length || hasKey)) {
      ch.push(par([new TR({ text: TL("Sumário"), bold: true, size: 32, color: hex })], { spacing: { after: 120 } }));
      o.heads.forEach(function (h, i) {
        ch.push(par([new D.InternalHyperlink({ anchor: "h" + (i + 1), children: [new TR({ text: strip(h.text), color: "0563C1", underline: {}, bold: h.level !== 2 })] })], { indent: { left: h.level === 2 ? 400 : 0 }, spacing: { after: 60 } }));
      });
      if (hasKey) ch.push(par([new D.InternalHyperlink({ anchor: "hgab", children: [new TR({ text: TL("Gabarito"), color: "0563C1", underline: {}, bold: true })] })], { spacing: { after: 60 } }));
      ch.push(pageBreak());
    }
    if (!T && m.student_fields) {
      var bd = { style: D.BorderStyle.SINGLE, size: 6, color: "999999" };
      ch.push(tbl([new D.TableRow({ children: [cl([par([new TR({ text: TL("Nome: "), bold: true }), new TR({ text: "_".repeat(50) })], { spacing: { before: 60, after: 60 } }), par([new TR({ text: TL("Turma: "), bold: true }), new TR({ text: "_".repeat(18) + "     " }), new TR({ text: TL("Data: "), bold: true }), new TR({ text: "____ / ____ / ________" })], { spacing: { before: 60, after: 60 } })], W, { borders: { top: bd, bottom: bd, left: bd, right: bd }, margins: { top: 80, bottom: 80, left: 160, right: 160 } })] })], [W]), gap());
    }

    var render = {
      heading: function (b) { hi++; ch.push(labelHead(strip(b.text), b.level === 2 ? 2 : 1, "h" + hi)); },
      paragraph: function (b) { ch.push(plain(b.text, {}, { spacing: { after: 120 } })); },
      bullets: function (b) { A(b.items).forEach(function (it) { ch.push(par(runs(it), { bullet: { level: 0 }, spacing: { after: 40 } })); }); ch.push(gap()); },
      callout: function (b) {
        var c = AV.CALLOUTS[b.style] || ["Nota", o.color], col = c[1].replace("#", "").toUpperCase(), fillc = toHex(tint(hexRgb(c[1]), 0.9));
        ch.push(tbl([new D.TableRow({ cantSplit: true, children: [cl([par([new TR({ text: S(b.title) || c[0], bold: true, color: col })], { spacing: { after: 40 } }), plain(b.text)], W, { shading: { type: D.ShadingType.CLEAR, fill: fillc, color: "auto" }, borders: { top: NONE, bottom: NONE, right: NONE, left: { style: D.BorderStyle.SINGLE, size: 24, color: col } }, margins: { top: 100, bottom: 100, left: 160, right: 120 } })] })], [W]), gap());
      },
      image: function (b) {
        var p = dataImg(b.data); if (!p || p.ext === "webp") { ch.push(plain("[imagem: formato não suportado no DOCX]", { italics: true, color: "888888" })); return; }
        var w = Math.round(600 * N(b.width, 70, 20, 100) / 100), h = Math.round(w * ratio(p));
        if (h > 620) { w = Math.round(w * 620 / h); h = 620; }
        ch.push(par([new D.ImageRun({ data: p.bytes, type: p.ext, transformation: { width: w, height: h } })], { alignment: D.AlignmentType.CENTER, keepNext: !!b.caption }));
        if (b.caption) ch.push(plain(b.caption, { italics: true, size: 18, color: "666666" }, { alignment: D.AlignmentType.CENTER, spacing: { after: 160 } }));
      },
      qrcode: function (b) {
        var png = qrPngBytes(b.url, 6), px = Math.round(N(b.size, 30, 20, 60) * 96 / 25.4);
        if (png) ch.push(par([new D.ImageRun({ data: png, type: "png", transformation: { width: px, height: px } })], { keepNext: true }));
        if (b.caption) ch.push(plain(b.caption, { bold: true }));
        ch.push(par([link(b.url, b.url, { size: 18 })], { spacing: { after: 160 } }));
      },
      link: function (b) { ch.push(par([link(b.label, b.url, { bold: true })], { spacing: { before: 80 } })); if (b.description) ch.push(plain(b.description, { size: 20, color: "555555" })); ch.push(par([new TR({ text: S(b.url), size: 18, color: "888888" })], { spacing: { after: 140 } })); },
      word: function (b) { ch.push(par([new TR({ text: "Documento Word: ", bold: true }), link(b.label || b.filename, b.url)], { spacing: { before: 80 } })); if (b.filename) ch.push(plain(b.filename, { size: 18, color: "888888" }, { spacing: { after: 140 } })); },
      video: function (b) { ch.push(par([new TR({ text: "Vídeo: ", bold: true }), link(b.title || b.url, b.url)], { spacing: { before: 80 } })); if (b.info) ch.push(plain(b.info, { size: 20, color: "555555" })); ch.push(par([new TR({ text: S(b.url), size: 18, color: "888888" })], { spacing: { after: 140 } })); },
      open_question: function (b, n) {
        qHead(n, b.prompt);
        if (T) ch.push(par([new TR({ text: TL("Resposta: "), bold: true, color: hex })].concat(runs(S(b.answer) || "—")), { shading: { type: D.ShadingType.CLEAR, fill: tintHex, color: "auto" }, indent: { left: 240 }, spacing: { after: 160 } }));
        else { ruled(N(b.lines, 3, 1, 12)).forEach(function (x) { ch.push(x); }); ch.push(gap()); }
      },
      choice_question: function (b, n) {
        var c = N(b.correct, 0, 0, 999); qHead(n, b.prompt);
        A(b.options).forEach(function (t, i) {
          var ok = T && i === c;
          ch.push(par([new TR({ text: (ok ? "(X) " : "(   ) ") + L(i) + ") ", bold: true, color: ok ? hex : "666666" })].concat(runs(t, ok ? { bold: true } : {})), { indent: { left: 480 }, spacing: { after: 40 }, keepNext: i < A(b.options).length - 1 }));
        });
        ch.push(gap());
      },
      true_false: function (b, n) {
        ch.push(par([new TR({ text: n + ". ", bold: true, color: hex }), new TR({ text: TL("Marque V (verdadeiro) ou F (falso):"), bold: true })], { spacing: { before: 200, after: 80 }, keepNext: true }));
        A(b.statements).forEach(function (t, i) {
          var a = !!A(b.answers)[i], mk = function (on) { return on ? "(X)" : "(   )"; };
          ch.push(par([new TR({ text: (T ? mk(a) : "(   )") + " V   " + (T ? mk(!a) : "(   )") + " F    ", bold: true, color: "666666" })].concat(runs(t)), { indent: { left: 240 }, spacing: { after: 60 } }));
        });
        ch.push(gap());
      },
      table: function (b) {
        var rows = A(b.rows).map(function (r) { return A(r).map(S); }), nc = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(1)), cw = Math.floor(W / nc);
        if (!rows.length) return;
        ch.push(tbl(rows.map(function (r, ri) {
          var cells = []; for (var c = 0; c < nc; c++) cells.push(cl([plain(r[c] || "", ri === 0 ? { bold: true, color: "FFFFFF" } : {})], cw, ri === 0 ? { shading: { type: D.ShadingType.CLEAR, fill: hex, color: "auto" } } : {}));
          return new D.TableRow({ tableHeader: ri === 0, cantSplit: true, children: cells });
        }), new Array(nc).fill(cw)), gap());
      },
      divider: function () { ch.push(par([], { border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 1 } }, spacing: { after: 160 } })); },
      page_break: function () { ch.push(pageBreak()); },
      word_search: function (b, n) {
        qHead(n, b.title || TL("Caça-palavras"));
        var grid = A(b.grid).map(A), cols = Math.max.apply(null, grid.map(function (r) { return r.length; }).concat(1)), hit = {};
        if (T) A(b.solution).forEach(function (s) { A(s && s.cells).forEach(function (rc) { hit[A(rc)[0] + "," + A(rc)[1]] = 1; }); });
        if (grid.length) ch.push(gridTable(grid, function (v, r, c, w) { return cl([par([new TR({ text: S(v).slice(0, 1), bold: true })], { alignment: D.AlignmentType.CENTER })], w, { verticalAlign: D.VerticalAlign.CENTER, shading: hit[r + "," + c] ? { type: D.ShadingType.CLEAR, fill: toHex(tint(hexRgb(o.color), 0.55)), color: "auto" } : undefined }); }, cols), gap());
        ch.push(par([new TR({ text: TL("Palavras: "), bold: true }), new TR({ text: A(b.words).map(S).join("  ·  ") })], { spacing: { after: 160 } }));
      },
      crossword: function (b, n) {
        qHead(n, b.title || TL("Cruzadinha"));
        var grid = A(b.grid).map(A), cols = Math.max.apply(null, grid.map(function (r) { return r.length; }).concat(1)), cw = b.clues || {};
        if (grid.length) ch.push(gridTable(grid, function (g, r, c, w) {
          if (!g) return cl([new Pg({})], w, { borders: { top: NONE, bottom: NONE, left: NONE, right: NONE } });
          var kids = []; if (g.number != null) kids.push(new TR({ text: String(g.number), size: 12, color: "666666" })); if (T && g.letter) kids.push(new TR({ text: S(g.letter).slice(0, 1), bold: true, color: hex }));
          return cl([par(kids, { alignment: D.AlignmentType.CENTER })], w, { verticalAlign: D.VerticalAlign.CENTER });
        }, cols), gap());
        [[TL("Horizontais"), cw.across], [TL("Verticais"), cw.down]].forEach(function (g) {
          if (!A(g[1]).length) return;
          ch.push(par([new TR({ text: g[0], bold: true, color: hex })], { spacing: { before: 100 }, keepNext: true }));
          A(g[1]).forEach(function (it) { ch.push(par([new TR({ text: S(it && it.n) + ". ", bold: true }), new TR({ text: S(it && it.clue) + (T ? "  (" + S(it && it.answer) + ")" : "") })], { indent: { left: 240 }, spacing: { after: 30 } })); });
        });
        ch.push(gap());
      },
      match: function (b, n) {
        qHead(n, b.prompt);
        var left = A(b.left), right = A(b.right), rows = Math.max(left.length, right.length), w1 = Math.floor(W / 2), tr = [];
        for (var i = 0; i < rows; i++) {
          var lt = i < left.length ? [new TR({ text: (i + 1) + ". ", bold: true })].concat(runs(left[i])).concat([new TR({ text: T ? "   ( " + l(N(A(b.answers)[i], 0, 0, 999)) + " )" : "   (     )", bold: true, color: hex })]) : [];
          var rt = i < right.length ? [new TR({ text: l(i) + ") ", bold: true })].concat(runs(right[i])) : [];
          tr.push(new D.TableRow({ cantSplit: true, children: [cl([par(lt, { spacing: { before: 40, after: 40 } })], w1), cl([par(rt, { spacing: { before: 40, after: 40 } })], W - w1)] }));
        }
        if (tr.length) ch.push(tbl(tr, [w1, W - w1]), gap());
      },
      fill_blank: function (b, n) {
        qHead(n, b.prompt);
        var rr = [];
        blanks(b.text).forEach(function (p) {
          if (p.blank == null) { runs(p.t).forEach(function (r) { rr.push(r); }); return; }
          rr.push(new TR(T ? { text: p.ans, bold: true, color: hex, underline: {} } : { text: "__________", color: "666666" }));
        });
        ch.push(par(rr, { indent: { left: 240 }, spacing: { after: 160, line: 360 } }));
      }
    };
    o.blocks.forEach(function (b, i) { if (render[b.type]) { try { render[b.type](b, o.nums[i]); } catch (e) { /* skip block */ } } });
    if (hasKey) {
      ch.push(pageBreak(), labelHead(TL("Gabarito"), 1, "hgab"));
      o.key.forEach(function (k) { ch.push(par([new TR({ text: k.n + ". ", bold: true, color: hex }), new TR({ text: k.text })], { spacing: { after: 80 } })); });
    }
    var foot = S(m.footer), footers;
    if (m.page_numbers || foot) {
      footers = { default: new D.Footer({ children: [new Pg({ alignment: D.AlignmentType.CENTER, children: [new TR({ text: (foot ? foot + "    " : ""), size: 18, color: "777777" })].concat(m.page_numbers ? [new TR({ children: [TL("Página "), D.PageNumber.CURRENT, TL(" de "), D.PageNumber.TOTAL_PAGES], size: 18, color: "777777" })] : []) })] }) };
    }
    var d = new D.Document({
      creator: S(m.author) || "AulaViva Studio", title: o.title, description: S(m.subtitle),
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, footers: footers, children: ch }]
    });
    var MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", out;
    try { out = await D.Packer.toBlob(d); }
    catch (e) { out = await D.Packer.toBuffer(d); }
    return new Blob([out], { type: MIME });
  }

  /* ---------------------------------------------------------------------- PPTX */
  async function toPPTX(doc, opts) { setLang(doc);
    var o = prep(doc, opts), m = o.meta, Pptx = await lib("pptx", getPptx), T = o.teacher, hex = o.color.replace("#", "").toUpperCase(), tintHex = toHex(tint(hexRgb(o.color), 0.88));
    var p = new Pptx(), cur = 0;
    p.layout = "LAYOUT_16x9"; p.title = o.title; p.author = S(m.author); p.subject = S(m.subject);
    var RECT = p.ShapeType ? p.ShapeType.rect : "rect", FONT = "Calibri";
    function slide(title) {
      var s = p.addSlide(); s.background = { color: "FFFFFF" };
      s.addShape(RECT, { x: 0, y: 0, w: 10, h: 0.14, fill: { color: hex }, line: { color: hex, width: 0 } });
      if (title) s.addText(strip(title), { x: 0.5, y: 0.3, w: 9, h: 0.75, fontSize: 26, bold: true, color: hex, fontFace: FONT, valign: "middle", fit: "shrink" });
      if (m.page_numbers) s.slideNumber = { x: 9.2, y: 5.25, fontSize: 10, color: "888888" };
      return s;
    }
    var fs = function (chars) { return chars > 900 ? 13 : chars > 600 ? 15 : chars > 350 ? 17 : 20; };
    function bulletSlides(title, items) { // items: {text, url?, bold?, color?}
      var chunks = [], cur2 = [], cc = 0;
      items.forEach(function (it) { var c2 = it.text.length + 60; if (cur2.length && cc + c2 > 900) { chunks.push(cur2); cur2 = []; cc = 0; } cur2.push(it); cc += c2; });
      if (cur2.length) chunks.push(cur2);
      chunks.forEach(function (chunk, k) {
        var s = slide(k ? title + " (cont.)" : title), size = fs(chunk.reduce(function (a, it) { return a + it.text.length; }, 0));
        s.addText(chunk.map(function (it) {
          var op = { bullet: it.plain ? false : true, breakLine: true, fontSize: size, color: it.color || "333333", bold: !!it.bold, fontFace: FONT, paraSpaceAfter: 8 };
          if (it.url) { op.hyperlink = { url: it.url }; op.color = "0563C1"; }
          return { text: it.text, options: op };
        }), { x: 0.6, y: 1.2, w: 8.8, h: 4, valign: "top", fit: "shrink" });
      });
    }
    function tableSlides(title, rows) {
      if (!rows.length) return;
      var head = rows[0], body = rows.slice(1), per = 7, k;
      for (k = 0; k < Math.max(body.length, 1); k += per) {
        var s = slide(k ? title + " (cont.)" : title), data = [head.map(function (t) { return { text: t, options: { bold: true, color: "FFFFFF", fill: { color: hex } } }; })];
        body.slice(k, k + per).forEach(function (r) { data.push(r.map(function (t) { return { text: t, options: {} }; })); });
        s.addTable(data, { x: 0.5, y: 1.2, w: 9, fontSize: 14, fontFace: FONT, color: "222222", border: { type: "solid", pt: 1, color: "BBBBBB" }, valign: "middle", margin: 0.06 });
      }
    }
    function gridSlide(title, grid, cellFn, extraItems) {
      var rows = grid.length, cols = Math.max.apply(null, grid.map(function (r) { return r.length; }).concat(1)), cs = Math.min(0.5, 3.9 / Math.max(rows, 1), 8.4 / cols);
      var s = slide(title), data = grid.map(function (r, ri) { var row = []; for (var c = 0; c < cols; c++) row.push(cellFn(r[c], ri, c)); return row; });
      if (data.length) s.addTable(data, { x: extraItems ? 0.5 : (10 - cs * cols) / 2, y: 1.2, colW: new Array(cols).fill(cs), rowH: new Array(rows).fill(cs), fontSize: Math.round(cs * 30), fontFace: FONT, align: "center", valign: "middle", border: { type: "solid", pt: 0.75, color: "999999" }, margin: 0 });
      if (extraItems && extraItems.length) s.addText(extraItems.map(function (t) { return { text: t, options: { breakLine: true, fontSize: 13, fontFace: FONT, color: "333333" } }; }), { x: 0.5 + cs * cols + 0.4, y: 1.2, w: 9.5 - (0.5 + cs * cols + 0.4), h: 4, valign: "top", fit: "shrink" });
    }
    var cell = function (txt, fillc, bold, size) { return { text: txt, options: { fill: { color: fillc || "FFFFFF" }, bold: !!bold, color: "222222" } }; };

    /* title slide */
    var s0 = p.addSlide(); s0.background = { color: hex };
    s0.addText(o.title, { x: 0.7, y: 1.3, w: 8.6, h: 1.6, fontSize: 40, bold: true, color: "FFFFFF", fontFace: FONT, valign: "bottom", fit: "shrink" });
    if (m.subtitle) s0.addText(strip(m.subtitle), { x: 0.7, y: 3.0, w: 8.6, h: 0.6, fontSize: 20, color: toHex(tint(hexRgb(o.color), 0.85)), fontFace: FONT, fit: "shrink" });
    var info = [m.subject, m.level, m.school, m.author].filter(S).join("  ·  ");
    if (info) s0.addText(info, { x: 0.7, y: 4.2, w: 8.6, h: 0.5, fontSize: 14, color: "FFFFFF", fontFace: FONT });
    if (T) s0.addText(TL("Versão do professor"), { x: 0.7, y: 4.8, w: 5, h: 0.4, fontSize: 12, bold: true, color: "FFFFFF", fontFace: FONT });
    if (m.toc && o.heads.length) bulletSlides(TL("Sumário"), o.heads.map(function (h) { return { text: strip(h.text), bold: h.level !== 2 }; }));

    /* sections */
    var pend = [], ptitle = o.title;
    function flush() { if (pend.length) bulletSlides(ptitle, pend); pend = []; }
    o.blocks.forEach(function (b, i) {
      var n = o.nums[i];
      try {
        switch (b.type) {
          case "heading": flush(); ptitle = strip(b.text) || o.title; break;
          case "paragraph": S(b.text).split(/\n+/).forEach(function (t) { if (t.trim()) pend.push({ text: strip(t) }); }); break;
          case "bullets": A(b.items).forEach(function (t) { pend.push({ text: strip(t) }); }); break;
          case "callout": pend.push({ text: (S(b.title) || (AV.CALLOUTS[b.style] || ["Nota"])[0]) + ": " + strip(b.text), bold: true, color: toHex(shade(hexRgb((AV.CALLOUTS[b.style] || [0, o.color])[1]), 0.2)) }); break;
          case "link": pend.push({ text: S(b.label || b.url) + (b.description ? " - " + strip(b.description) : ""), url: /^https?:\/\//i.test(S(b.url)) ? S(b.url) : null }); break;
          case "word": pend.push({ text: S(b.label || b.filename) + " (Word)", url: /^https?:\/\//i.test(S(b.url)) ? S(b.url) : null }); break;
          case "video": pend.push({ text: S(b.title || b.url) + (b.info ? " (" + S(b.info) + ")" : ""), url: /^https?:\/\//i.test(S(b.url)) ? S(b.url) : null }); break;
          case "image":
            var im = dataImg(b.data); if (!im) break;
            flush();
            var s = slide(b.caption ? strip(b.caption) : ptitle), r = ratio(im), bw = 8.6, bh = 3.9, w = bw, h = w * r;
            if (h > bh) { h = bh; w = h / r; }
            s.addImage({ data: im.url.replace(/^data:/, ""), x: (10 - w) / 2, y: 1.2 + (bh - h) / 2, w: w, h: h, altText: strip(b.caption) || "Imagem" });
            break;
          case "qrcode":
            flush();
            var qp = AV.qr.dataUrl(b.url, 8), sq = slide(b.caption ? strip(b.caption) : "QR code");
            if (qp) sq.addImage({ data: qp.replace(/^data:/, ""), x: 3.6, y: 1.2, w: 2.8, h: 2.8, altText: "Código QR" });
            sq.addText(S(b.url), { x: 1, y: 4.2, w: 8, h: 0.5, fontSize: 16, align: "center", color: "0563C1", fontFace: FONT, hyperlink: /^https?:\/\//i.test(S(b.url)) ? { url: S(b.url) } : undefined });
            break;
          case "table": flush(); tableSlides(ptitle, A(b.rows).map(function (r) { return A(r).map(function (c) { return strip(c); }); })); break;
          case "choice_question":
            flush();
            var c = N(b.correct, 0, 0, 999), sc = slide(TL("Questão ") + n), os = A(b.options);
            sc.addText(strip(b.prompt), { x: 0.6, y: 1.15, w: 8.8, h: 1.1, fontSize: 22, bold: true, color: "222222", fontFace: FONT, valign: "top", fit: "shrink" });
            sc.addText(os.map(function (t, k) { var ok = T && k === c; return { text: L(k) + ") " + strip(t) + (ok ? "   ✓" : ""), options: { breakLine: true, fontSize: 19, bold: ok, color: ok ? "1F8A4C" : "333333", fontFace: FONT, paraSpaceAfter: 8 } }; }), { x: 0.9, y: 2.4, w: 8.4, h: 2.8, valign: "top", fit: "shrink" });
            break;
          case "open_question":
            flush();
            var so = slide(TL("Questão ") + n);
            so.addText(strip(b.prompt), { x: 0.6, y: 1.15, w: 8.8, h: 1.6, fontSize: 22, bold: true, color: "222222", fontFace: FONT, valign: "top", fit: "shrink" });
            if (T) so.addText(TL("Resposta: ") + (strip(b.answer) || "—"), { x: 0.6, y: 3, w: 8.8, h: 2, fontSize: 18, color: "1F8A4C", fontFace: FONT, valign: "top", fit: "shrink", fill: { color: tintHex } });
            else so.addShape(RECT, { x: 0.6, y: 3, w: 8.8, h: 1.8, fill: { color: "FFFFFF" }, line: { color: "BBBBBB", width: 1 } });
            break;
          case "true_false":
            flush();
            var st = slide(TL("Questão ") + n + ": verdadeiro ou falso?");
            st.addText(A(b.statements).map(function (t, k) { var a = !!A(b.answers)[k]; return { text: (k + 1) + ". " + strip(t) + (T ? "   [" + (a ? "V" : "F") + "]" : "   ( V )  ( F )"), options: { breakLine: true, fontSize: 19, fontFace: FONT, color: T ? (a ? "1F8A4C" : "C0392B") : "333333", bold: T, paraSpaceAfter: 10 } }; }), { x: 0.6, y: 1.2, w: 8.8, h: 4, valign: "top", fit: "shrink" });
            break;
          case "match":
            flush();
            var lf = A(b.left), rt = A(b.right), data = [[cell("Coluna A", hex, true), cell("Coluna B", hex, true)].map(function (x) { x.options.color = "FFFFFF"; return x; })];
            for (var k = 0; k < Math.max(lf.length, rt.length); k++) data.push([cell(k < lf.length ? (k + 1) + ". " + strip(lf[k]) + (T ? "  →  " + l(N(A(b.answers)[k], 0, 0, 999)) : "") : "", "FFFFFF", T), cell(k < rt.length ? l(k) + ") " + strip(rt[k]) : "", "FFFFFF", false)]);
            var sm = p.addSlide(); sm.background = { color: "FFFFFF" };
            sm.addShape(RECT, { x: 0, y: 0, w: 10, h: 0.14, fill: { color: hex }, line: { color: hex, width: 0 } });
            sm.addText(TL("Questão ") + n + ": " + strip(b.prompt), { x: 0.5, y: 0.3, w: 9, h: 0.75, fontSize: 22, bold: true, color: hex, fontFace: FONT, fit: "shrink" });
            if (m.page_numbers) sm.slideNumber = { x: 9.2, y: 5.25, fontSize: 10, color: "888888" };
            sm.addTable(data, { x: 0.5, y: 1.2, w: 9, fontSize: 15, fontFace: FONT, border: { type: "solid", pt: 1, color: "BBBBBB" }, valign: "middle", margin: 0.06 });
            break;
          case "fill_blank":
            flush();
            var sf = slide(TL("Questão ") + n), parts = blanks(b.text);
            sf.addText(strip(b.prompt), { x: 0.6, y: 1.15, w: 8.8, h: 0.8, fontSize: 20, bold: true, color: "222222", fontFace: FONT, valign: "top", fit: "shrink" });
            sf.addText(parts.map(function (q) { return q.blank != null ? { text: T ? q.ans : "________", options: { bold: T, color: T ? "1F8A4C" : "666666", underline: T ? { style: "sng" } : undefined, fontSize: 22, fontFace: FONT } } : { text: strip(q.t), options: { fontSize: 22, color: "333333", fontFace: FONT } }; }), { x: 0.6, y: 2.2, w: 8.8, h: 2.8, valign: "top", fit: "shrink" });
            break;
          case "word_search":
            flush();
            var hit = {}; if (T) A(b.solution).forEach(function (sl) { A(sl && sl.cells).forEach(function (rc) { hit[A(rc)[0] + "," + A(rc)[1]] = 1; }); });
            gridSlide(TL("Questão ") + n + ": " + strip(b.title || TL("Caça-palavras")), A(b.grid).map(A), function (v, r, cc2) { return cell(S(v).slice(0, 1), hit[r + "," + cc2] ? toHex(tint(hexRgb(o.color), 0.5)) : "FFFFFF", true); }, [TL("Palavras:")].concat(A(b.words).map(S)));
            break;
          case "crossword":
            flush();
            var cwc = b.clues || {};
            gridSlide(TL("Questão ") + n + ": " + strip(b.title || TL("Cruzadinha")), A(b.grid).map(A), function (g) {
              if (!g) return { text: "", options: { fill: { color: "FFFFFF" }, border: { type: "none" } } };
              return cell((g.number != null ? String(g.number) : "") + (T && g.letter ? " " + S(g.letter).slice(0, 1) : ""), "FFFFFF", true);
            }, [TL("Horizontais")].concat(A(cwc.across).map(function (it) { return S(it && it.n) + ". " + S(it && it.clue) + (T ? " (" + S(it && it.answer) + ")" : ""); }), [TL("Verticais")], A(cwc.down).map(function (it) { return S(it && it.n) + ". " + S(it && it.clue) + (T ? " (" + S(it && it.answer) + ")" : ""); })));
            break;
        }
      } catch (e) { /* skip block */ }
    });
    flush();
    if (showKey(o)) bulletSlides(TL("Gabarito"), o.key.map(function (k) { return { text: k.n + ". " + k.text, plain: true }; }));
    var MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation", out;
    try { out = await p.write({ outputType: "blob" }); }
    catch (e) { out = await p.write({ outputType: "arraybuffer" }); }
    return new Blob([out], { type: MIME });
  }

  /* ---------------------------------------------------------------------- HTML */
  function toHTML(doc, opts) { setLang(doc);
    var o = prep(doc, opts), m = o.meta, T = o.teacher, theme = hexRgb(o.color), bgt = toHex(tint(theme, 0.92)), n = 0, hk = 0, out = [], dkey = o.color;
    var inl = function (t) { return inline(t).map(function (g) { var e = esc(g.t).replace(/\n/g, "<br>"); return g.b ? "<strong>" + e + "</strong>" : g.i ? "<em>" + e + "</em>" : e; }).join(""); };
    var url = function (u) { u = S(u).trim(); return /^(https?:\/\/|mailto:)/i.test(u) ? esc(u) : ""; };
    var a = function (u, label) { var s = url(u); return s ? '<a href="' + s + '" target="_blank" rel="noopener noreferrer">' + label + "</a>" : label; };
    var css = ":root{--c:" + esc(dkey) + ";--t:#" + bgt + ";--ink:#1f2430;--mut:#5b6472;--line:#d5d9e0}*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:#fff}main{max-width:820px;margin:0 auto;padding:1.5rem 1.25rem 3rem}" +
      "h1{font-size:2rem;line-height:1.2;margin:.2em 0;color:var(--c)}h2{font-size:1.5rem;color:var(--c);border-bottom:3px solid var(--c);padding-bottom:.2em;margin:1.8em 0 .6em}h3{font-size:1.2rem;margin:1.4em 0 .4em}a{color:#0052cc}" +
      ".sub{color:var(--mut);font-size:1.15rem;margin:0}.meta{color:var(--mut);font-size:.9rem}.tag{display:inline-block;background:var(--t);color:var(--ink);border:1px solid var(--c);border-radius:.4rem;padding:.1em .6em;font-weight:600;font-size:.85rem}" +
      ".callout{border-left:6px solid var(--k);background:var(--kb);padding:.7rem 1rem;border-radius:.4rem;margin:1rem 0}.callout b.t{display:block;color:var(--kt)}" +
      "figure{margin:1rem 0;text-align:center}figure img{max-width:100%;height:auto}figcaption{color:var(--mut);font-size:.9rem;font-style:italic}.card{display:block;background:var(--t);border-radius:.5rem;padding:.7rem 1rem;margin:.8rem 0}.card small{display:block;color:var(--mut);word-break:break-all}" +
      "fieldset.q{border:1px solid var(--line);border-radius:.5rem;margin:1.1rem 0;padding:.6rem 1rem;break-inside:avoid}legend{font-weight:700;padding:0 .4rem}legend .n{background:var(--c);color:#fff;border-radius:.3rem;padding:0 .45em;margin-right:.4em}.opt{display:block;padding:.15rem 0}.opt.ok{font-weight:700;color:#14683a}.ans{background:var(--t);border-radius:.4rem;padding:.5rem .8rem;margin-top:.4rem}textarea,input[type=text],select{font:inherit;border:1px solid #8a93a1;border-radius:.3rem;padding:.25rem .4rem}textarea{width:100%}" +
      "table{border-collapse:collapse;margin:1rem 0;max-width:100%}th,td{border:1px solid var(--line);padding:.35rem .6rem;text-align:left;vertical-align:top}th{background:var(--t);border-bottom:2px solid var(--c)}table.grid{margin:1rem auto}table.grid td{width:2.1rem;height:2.1rem;padding:0;text-align:center;font-weight:700;position:relative}table.grid td.hit{background:#" + toHex(tint(theme, 0.55)) + "}table.grid td.empty{border:0}table.grid sup{position:absolute;left:2px;top:0;font-size:.55rem;font-weight:400;color:var(--mut)}" +
      ".fields{border:1px solid var(--line);border-radius:.5rem;padding:.7rem 1rem;margin:1rem 0;display:flex;flex-wrap:wrap;gap:.8rem}.fields label{flex:1 1 12rem}.fields input{width:100%}svg.qr{width:var(--s,8rem);height:auto;border:1px solid var(--line)}hr{border:0;border-top:1px solid var(--line);margin:1.5rem 0}footer{color:var(--mut);font-size:.85rem;border-top:1px solid var(--line);margin-top:2rem;padding-top:.6rem}.sr{position:absolute;left:-9999px}.skip{position:absolute;left:-9999px}.skip:focus{left:1rem;top:1rem;background:#fff;padding:.3rem}" +
      "@media print{.skip{display:none}main{max-width:none;padding:0}.pb{break-after:page}a{color:inherit}textarea,input,select{border-color:#777}}@page{size:A4;margin:16mm}";
    var chk = function (ok) { return ok ? ' class="opt ok"' : ' class="opt"'; };
    out.push('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(o.title) + (T ? " (professor)" : "") + "</title><style>" + css + '</style></head><body><a class="skip" href="#conteudo">Pular para o conteúdo</a><main id="conteudo">');
    out.push("<header><p class=\"tag\">" + esc(((KIND_I18N[CUR] || {})[m.kind]) || KIND[m.kind] || TL("Documento")) + (T ? TL(" · Versão do professor") : "") + "</p><h1>" + esc(o.title) + "</h1>" + (m.subtitle ? '<p class="sub">' + inl(m.subtitle) + "</p>" : "") + '<p class="meta">' + [m.subject, m.level, m.school, m.author].filter(S).map(esc).join(" · ") + "</p></header>");
    var hasKey = showKey(o);
    if (m.toc && (o.heads.length || hasKey)) {
      out.push('<nav aria-label=TL("Sumário")><h2 style="font-size:1.2rem;border:0">Sumário</h2><ol>' + o.heads.map(function (h, i) { return '<li style="margin-left:' + (h.level === 2 ? 1.2 : 0) + 'rem"><a href="#h' + (i + 1) + '" target="_self">' + esc(strip(h.text)) + "</a></li>"; }).join("") + (hasKey ? '<li><a href="#gabarito" target="_self">Gabarito</a></li>' : "") + "</ol></nav>");
    }
    if (!T && m.student_fields) out.push('<div class="fields" role="group" aria-label="Dados do aluno"><label>Nome<input type="text" autocomplete="off"></label><label>Turma<input type="text" autocomplete="off"></label><label>Data<input type="text" autocomplete="off"></label></div>');
    var R = {
      heading: function (b) { hk++; var t = b.level === 2 ? "h3" : "h2"; return "<" + t + ' id="h' + hk + '">' + inl(b.text) + "</" + t + ">"; },
      paragraph: function (b) { return "<p>" + inl(b.text) + "</p>"; },
      bullets: function (b) { return "<ul>" + A(b.items).map(function (i) { return "<li>" + inl(i) + "</li>"; }).join("") + "</ul>"; },
      callout: function (b) { var c = AV.CALLOUTS[b.style] || ["Nota", o.color], k = hexRgb(c[1]); return '<aside class="callout" style="--k:' + esc(c[1]) + ";--kb:#" + toHex(tint(k, 0.9)) + ";--kt:#" + toHex(shade(k, 0.3)) + '"><b class="t">' + esc(S(b.title) || c[0]) + "</b>" + inl(b.text) + "</aside>"; },
      image: function (b) { var p = dataImg(b.data); if (!p) return ""; return '<figure><img src="' + p.url + '" alt="' + esc(strip(b.caption) || "Imagem do documento") + '" style="width:' + N(b.width, 70, 20, 100) + '%">' + (b.caption ? "<figcaption>" + inl(b.caption) + "</figcaption>" : "") + "</figure>"; },
      qrcode: function (b) { var u = S(b.url); return '<figure style="--s:' + N(b.size, 30, 20, 60) * 0.26 + 'rem">' + qrSvg(u, "Código QR para " + u) + "<figcaption>" + (b.caption ? esc(b.caption) + "<br>" : "") + a(u, esc(u)) + "</figcaption></figure>"; },
      link: function (b) { return '<p class="card">' + a(b.url, "<strong>" + esc(b.label || b.url) + "</strong>") + (b.description ? "<br>" + inl(b.description) : "") + "<small>" + esc(b.url) + "</small></p>"; },
      word: function (b) { return '<p class="card">Documento Word: ' + a(b.url, "<strong>" + esc(b.label || b.filename) + "</strong>") + (b.filename ? "<small>" + esc(b.filename) + "</small>" : "") + "</p>"; },
      video: function (b) { return '<p class="card">Vídeo: ' + a(b.url, "<strong>" + esc(b.title || b.url) + "</strong>") + (b.info ? " (" + esc(b.info) + ")" : "") + "<small>" + esc(b.url) + "</small></p>"; },
      open_question: function (b, q, i) { return '<fieldset class="q"><legend><span class="n">' + q + "</span>" + inl(b.prompt) + "</legend>" + (T ? '<div class="ans"><strong>Resposta:</strong> ' + inl(b.answer || "—") + "</div>" : '<textarea rows="' + N(b.lines, 3, 1, 12) + '" aria-label="Resposta da questão ' + q + '"></textarea>') + "</fieldset>"; },
      choice_question: function (b, q, i) {
        var c = N(b.correct, 0, 0, 999);
        return '<fieldset class="q"><legend><span class="n">' + q + "</span>" + inl(b.prompt) + "</legend>" + A(b.options).map(function (t, k) { return "<label" + chk(T && k === c) + '><input type="radio" name="q' + i + '" value="' + k + '"' + (T && k === c ? " checked" : "") + (T ? " disabled" : "") + "> " + L(k) + ") " + inl(t) + (T && k === c ? " <span>(resposta correta)</span>" : "") + "</label>"; }).join("") + "</fieldset>";
      },
      true_false: function (b, q, i) {
        return '<fieldset class="q"><legend><span class="n">' + q + "</span>Marque V (verdadeiro) ou F (falso)</legend>" + A(b.statements).map(function (t, k) {
          var an = !!A(b.answers)[k];
          return '<div class="opt"><label><input type="radio" name="q' + i + "_" + k + '" value="V"' + (T && an ? " checked" : "") + (T ? " disabled" : "") + "> V</label> <label><input type=\"radio\" name=\"q" + i + "_" + k + '" value="F"' + (T && !an ? " checked" : "") + (T ? " disabled" : "") + "> F</label> " + inl(t) + "</div>";
        }).join("") + "</fieldset>";
      },
      table: function (b) {
        var rows = A(b.rows).map(A); if (!rows.length) return "";
        return "<table><thead><tr>" + rows[0].map(function (c) { return '<th scope="col">' + inl(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.slice(1).map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inl(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
      },
      divider: function () { return "<hr>"; },
      page_break: function () { return '<div class="pb" aria-hidden="true"></div>'; },
      word_search: function (b, q) {
        var hit = {}; if (T) A(b.solution).forEach(function (s) { A(s && s.cells).forEach(function (rc) { hit[A(rc)[0] + "," + A(rc)[1]] = 1; }); });
        return '<section aria-label="' + esc(b.title || TL("Caça-palavras")) + '"><h3><span class="n">' + q + "</span> " + esc(b.title || TL("Caça-palavras")) + '</h3><table class="grid"><caption class="sr">Grade do caça-palavras</caption>' + A(b.grid).map(function (r, ri) { return "<tr>" + A(r).map(function (v, ci) { return "<td" + (hit[ri + "," + ci] ? ' class="hit"' : "") + ">" + esc(S(v).slice(0, 1)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table><p><strong>Palavras:</strong> " + A(b.words).map(esc).join(" · ") + "</p></section>";
      },
      crossword: function (b, q) {
        var cl = b.clues || {}, f = function (t, arr) { return A(arr).length ? "<h4>" + t + "</h4><ul>" + A(arr).map(function (it) { return "<li><strong>" + esc(it && it.n) + ".</strong> " + esc(it && it.clue) + (T ? " (" + esc(it && it.answer) + ")" : "") + "</li>"; }).join("") + "</ul>" : ""; };
        return '<section aria-label="' + esc(b.title || TL("Cruzadinha")) + '"><h3><span class="n">' + q + "</span> " + esc(b.title || TL("Cruzadinha")) + '</h3><table class="grid"><caption class="sr">Grade da cruzadinha</caption>' + A(b.grid).map(function (r) { return "<tr>" + A(r).map(function (g) { return g ? "<td>" + (g.number != null ? "<sup>" + esc(g.number) + "</sup>" : "") + (T ? esc(S(g.letter).slice(0, 1)) : "&nbsp;") + "</td>" : '<td class="empty"></td>'; }).join("") + "</tr>"; }).join("") + "</table>" + f(TL("Horizontais"), cl.across) + f(TL("Verticais"), cl.down) + "</section>";
      },
      match: function (b, q, i) {
        var left = A(b.left), right = A(b.right);
        return '<fieldset class="q"><legend><span class="n">' + q + "</span>" + inl(b.prompt) + "</legend><table><tbody>" + left.map(function (t, k) {
          return "<tr><td>" + (k + 1) + ". " + inl(t) + "</td><td>" + (T ? "<strong>" + l(N(A(b.answers)[k], 0, 0, 999)) + ")</strong>" : '<select aria-label="Correspondente do item ' + (k + 1) + '"><option value="">–</option>' + right.map(function (x, j) { return '<option value="' + j + '">' + l(j) + "</option>"; }).join("") + "</select>") + "</td></tr>";
        }).join("") + "</tbody></table><ol type=\"a\">" + right.map(function (t) { return "<li>" + inl(t) + "</li>"; }).join("") + "</ol></fieldset>";
      },
      fill_blank: function (b, q, i) {
        return '<fieldset class="q"><legend><span class="n">' + q + "</span>" + inl(b.prompt) + "</legend><p>" + blanks(b.text).map(function (p) { return p.blank == null ? inl(p.t) : T ? "<u><strong>" + esc(p.ans) + "</strong></u>" : '<input type="text" size="12" aria-label="Lacuna ' + (p.blank + 1) + ' da questão ' + q + '" autocomplete="off">'; }).join("") + "</p></fieldset>";
      }
    };
    o.blocks.forEach(function (b, i) { if (R[b.type]) { try { out.push(R[b.type](b, o.nums[i], i)); } catch (e) { /* skip */ } } });
    if (hasKey) out.push('<section class="pb"><h2 id="gabarito">Gabarito</h2><ol style="list-style:none;padding:0">' + o.key.map(function (k) { return "<li><strong>" + k.n + ".</strong> " + esc(k.text) + "</li>"; }).join("") + "</ol></section>");
    if (m.footer) out.push("<footer>" + esc(m.footer) + "</footer>");
    out.push("</main></body></html>");
    return out.join("\n");
  }

  /* ----------------------------------------------------------- Markdown / TXT */
  function textExport(doc, opts, md) {
    var o = prep(doc, opts), m = o.meta, T = o.teacher, out = [], hk = 0;
    var inl = function (t) { return md ? S(t) : strip(t); }, B = function (t) { return md ? "**" + t + "**" : t; };
    var add = function () { for (var i = 0; i < arguments.length; i++) out.push(arguments[i]); };
    var cellTxt = function (t) { return inl(t).replace(/\|/g, "\\|").replace(/\n/g, " "); };
    var gridTxt = function (rows) { return md ? "```\n" + rows.join("\n") + "\n```" : rows.join("\n"); };
    if (md) add("# " + o.title, ""); else add(o.title.toUpperCase(), "=".repeat(Math.min(o.title.length, 70)), "");
    if (m.subtitle) add(md ? "*" + inl(m.subtitle) + "*" : inl(m.subtitle), "");
    [[TL("Disciplina"), m.subject], [TL("Nível / ano"), m.level], [TL("Escola"), m.school], [TL("Professor(a)"), m.author]].forEach(function (r) { if (S(r[1])) add(md ? "- " + B(r[0] + ":") + " " + S(r[1]) : r[0] + ": " + S(r[1])); });
    if (T) add("", B(TL("Versão do professor (com respostas)")));
    add("");
    var hasKey = showKey(o);
    if (m.toc && o.heads.length) {
      add(md ? TL("## Sumário") : TL("SUMÁRIO"), "");
      o.heads.forEach(function (h, i) { add((h.level === 2 ? "   " : "") + (md ? "- " : (i + 1) + ". ") + strip(h.text)); });
      if (hasKey) add(md ? TL("- Gabarito") : TL("• Gabarito"));
      add("");
    }
    if (!T && m.student_fields) add(TL("Nome: ______________________  Turma: ________  Data: ___/___/_____"), "");
    var yn = function (a) { return a ? (CUR === "en" ? "T" : "V") : "F"; };
    var R = {
      heading: function (b) { add("", md ? (b.level === 2 ? "### " : "## ") + inl(b.text) : (b.level === 2 ? strip(b.text) + "\n" + "-".repeat(Math.min(strip(b.text).length, 70)) : strip(b.text).toUpperCase() + "\n" + "=".repeat(Math.min(strip(b.text).length, 70))), ""); },
      paragraph: function (b) { add(inl(b.text), ""); },
      bullets: function (b) { A(b.items).forEach(function (i) { add((md ? "- " : "• ") + inl(i)); }); add(""); },
      callout: function (b) { var c = AV.CALLOUTS[b.style] || ["Nota"], t = S(b.title) || c[0]; if (md) add("> " + B(t + ":") + " " + inl(b.text).replace(/\n/g, "\n> "), ""); else add("[" + t + "] " + inl(b.text), ""); },
      image: function (b) { var p = dataImg(b.data); if (!p) return; add(md ? "![" + strip(b.caption).replace(/[\[\]]/g, "") + "](" + p.url + ")" : "[Imagem" + (b.caption ? ": " + strip(b.caption) : "") + "]", ""); if (md && b.caption) add("*" + inl(b.caption) + "*", ""); },
      qrcode: function (b) { add(md ? "[QR code" + (b.caption ? ": " + strip(b.caption).replace(/[\[\]]/g, "") : "") + "](" + S(b.url) + ")" : "[QR code" + (b.caption ? ": " + strip(b.caption) : "") + "] " + S(b.url), ""); },
      link: function (b) { add((md ? "[" + S(b.label || b.url).replace(/[\[\]]/g, "") + "](" + S(b.url) + ")" : S(b.label || b.url) + ": " + S(b.url)) + (b.description ? " - " + inl(b.description) : ""), ""); },
      word: function (b) { add((md ? "[" + S(b.label || b.filename).replace(/[\[\]]/g, "") + "](" + S(b.url) + ")" : S(b.label || b.filename) + ": " + S(b.url)) + " (documento Word" + (b.filename ? ", " + S(b.filename) : "") + ")", ""); },
      video: function (b) { add("Vídeo: " + (md ? "[" + S(b.title || b.url).replace(/[\[\]]/g, "") + "](" + S(b.url) + ")" : S(b.title || b.url) + " - " + S(b.url)) + (b.info ? " (" + S(b.info) + ")" : ""), ""); },
      open_question: function (b, q) { add(B(q + ".") + " " + inl(b.prompt)); if (T) add((md ? "> " : "   ") + TL("Resposta: ") + inl(b.answer || "—")); else for (var i = 0; i < N(b.lines, 3, 1, 12); i++) add("   " + "_".repeat(60)); add(""); },
      choice_question: function (b, q) { var c = N(b.correct, 0, 0, 999); add(B(q + ".") + " " + inl(b.prompt), ""); A(b.options).forEach(function (t, k) { var ok = T && k === c; add((md ? "- " : "   ") + (ok ? (md ? "**" + L(k) + ") " + inl(t) + "** ✓" : "[X] " + L(k) + ") " + inl(t)) : (md ? "" : "[ ] ") + L(k) + ") " + inl(t))); }); add(""); },
      true_false: function (b, q) { add(B(q + ".") + " Marque V (verdadeiro) ou F (falso):", ""); A(b.statements).forEach(function (t, k) { add((md ? "- " : "   ") + "(" + (T ? yn(A(b.answers)[k]) : " ") + ") " + inl(t)); }); add(""); },
      table: function (b) {
        var rows = A(b.rows).map(A); if (!rows.length) return;
        if (md) { var nc = rows[0].length || 1; add("| " + rows[0].map(cellTxt).join(" | ") + " |", "|" + " --- |".repeat(nc)); rows.slice(1).forEach(function (r) { add("| " + r.map(cellTxt).join(" | ") + " |"); }); }
        else rows.forEach(function (r) { add(r.map(function (c) { return strip(c); }).join("\t")); });
        add("");
      },
      divider: function () { add(md ? "---" : "-".repeat(40), ""); },
      page_break: function () { add(md ? "---" : "-".repeat(40), ""); },
      word_search: function (b, q) {
        var hit = {}; if (T) A(b.solution).forEach(function (s) { A(s && s.cells).forEach(function (rc) { hit[A(rc)[0] + "," + A(rc)[1]] = 1; }); });
        add(B(q + ".") + " " + inl(b.title || TL("Caça-palavras")), "");
        add(gridTxt(A(b.grid).map(function (r, ri) { return A(r).map(function (v, ci) { return hit[ri + "," + ci] ? "[" + S(v).slice(0, 1) + "]" : " " + S(v).slice(0, 1) + " "; }).join(""); })), "");
        add(TL("Palavras: ") + A(b.words).map(S).join(", "), "");
      },
      crossword: function (b, q) {
        var cl = b.clues || {}, pos = [];
        add(B(q + ".") + " " + inl(b.title || TL("Cruzadinha")), "");
        add(gridTxt(A(b.grid).map(function (r, ri) { return A(r).map(function (g, ci) { if (g && g.number != null) pos.push(g.number + " (linha " + (ri + 1) + ", coluna " + (ci + 1) + ")"); return !g ? "#" : T && g.letter ? S(g.letter).slice(0, 1) : "_"; }).join(" "); })), "");
        if (pos.length) add("Posições: " + pos.join("; "), "");
        [[TL("Horizontais"), cl.across], [TL("Verticais"), cl.down]].forEach(function (g) { if (!A(g[1]).length) return; add(B(g[0] + ":")); A(g[1]).forEach(function (it) { add((md ? "- " : "   ") + S(it && it.n) + ". " + S(it && it.clue) + (T ? " (" + S(it && it.answer) + ")" : "")); }); add(""); });
      },
      match: function (b, q) {
        add(B(q + ".") + " " + inl(b.prompt), "");
        var left = A(b.left), right = A(b.right);
        if (md) add("| Coluna A | Coluna B |", "| --- | --- |");
        for (var k = 0; k < Math.max(left.length, right.length); k++) {
          var lt = k < left.length ? (k + 1) + ". " + inl(left[k]) + (T ? "  →  " + l(N(A(b.answers)[k], 0, 0, 999)) : "  (   )") : "", rt = k < right.length ? l(k) + ") " + inl(right[k]) : "";
          add(md ? "| " + lt.replace(/\|/g, "\\|") + " | " + rt.replace(/\|/g, "\\|") + " |" : "   " + (lt + " ".repeat(Math.max(1, 40 - lt.length))) + rt);
        }
        add("");
      },
      fill_blank: function (b, q) { add(B(q + ".") + " " + inl(b.prompt), "", "   " + (T && md ? blanks(b.text).map(function (p) { return p.blank != null ? "**" + p.ans + "**" : p.t; }).join("") : fillText(b, T, "__________")), ""); }
    };
    o.blocks.forEach(function (b, i) { if (R[b.type]) { try { R[b.type](b, o.nums[i]); } catch (e) { /* skip */ } } });
    if (hasKey) { add("", md ? TL("## Gabarito") : TL("GABARITO"), ""); if (!md) add("========", ""); o.key.forEach(function (k) { add((md ? "- " : "") + B(k.n + ".") + " " + k.text); }); add(""); }
    if (m.footer) add("", md ? "---" : "-".repeat(40), S(m.footer));
    return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") + "\n";
  }
  var toMarkdown = function (doc, opts) { setLang(doc); return textExport(doc, opts, true); };
  var toTXT = function (doc, opts) { setLang(doc); return textExport(doc, opts, false); };

  /* -------------------------------------------------------------------- export */
  var formats = [
    { id: "pdf", label: "PDF interativo", ext: "pdf", mime: "application/pdf" },
    { id: "docx", label: "Word (.docx)", ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { id: "pptx", label: "PowerPoint (.pptx)", ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
    { id: "html", label: "Página web (.html)", ext: "html", mime: "text/html" },
    { id: "md", label: "Markdown (.md)", ext: "md", mime: "text/markdown" },
    { id: "txt", label: "Texto simples (.txt)", ext: "txt", mime: "text/plain" },
    { id: "json", label: "Projeto AulaViva (.json)", ext: "json", mime: "application/json" }
  ];
  function slug(s) {
    s = S(s).normalize ? S(s).normalize("NFD").replace(/[̀-ͯ]/g, "") : S(s);
    s = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
    return s || "documento";
  }
  async function exportDoc(doc, formatId, opts) {
    opts = opts || {};
    var f = formats.filter(function (x) { return x.id === formatId; })[0] || formats[0], blob, version = opts.version === "professor" ? "professor" : "aluno";
    var o2 = { version: version };
    switch (f.id) {
      case "pdf": blob = await toPDF(doc, o2); break;
      case "docx": blob = await toDOCX(doc, o2); break;
      case "pptx": blob = await toPPTX(doc, o2); break;
      case "html": blob = new Blob([toHTML(doc, o2)], { type: "text/html;charset=utf-8" }); break;
      case "md": blob = new Blob([toMarkdown(doc, o2)], { type: "text/markdown;charset=utf-8" }); break;
      case "txt": blob = new Blob([toTXT(doc, o2)], { type: "text/plain;charset=utf-8" }); break;
      default: blob = new Blob([JSON.stringify(doc)], { type: "application/json" });
    }
    var title = doc && doc.meta && doc.meta.title;
    return { filename: slug(title) + (f.id !== "json" && opts.version ? "-" + version : "") + "." + f.ext, blob: blob };
  }

  AV.exporters = { toPDF: toPDF, toDOCX: toDOCX, toPPTX: toPPTX, toHTML: toHTML, toMarkdown: toMarkdown, toTXT: toTXT, formats: formats, export: exportDoc, slug: slug };
})(globalThis.AV = globalThis.AV || {});

/* AulaViva Studio Web: estúdio de animação (AV.anim).
 * Atores e cenários desenhados proceduralmente em canvas 2D, validação de histórias,
 * Player, exportação WebM, miniaturas e modelos prontos em português.
 * Contrato: spec/ANIMACAO.md. Script simples de navegador, sem dependências.
 */
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

  // ------------------------------------------------------------------ constantes
  const W = 1280, H = 720, TAU = Math.PI * 2, INK = "#1F2937", XFADE = 0.4;
  const FONT = '"Baloo 2","Fredoka","Nunito","Trebuchet MS","Comic Sans MS","Segoe UI",system-ui,sans-serif';

  const BACKGROUNDS = {
    sala: "Sala de aula", parque: "Parque", espaco: "Espaço", fazenda: "Fazenda", oceano: "Fundo do mar",
    cidade: "Cidade", floresta: "Floresta", cerrado: "Cerrado", ceu: "Céu", lousa: "Lousa",
    casa: "Casa", escola: "Pátio da escola"
  };
  const ACTORS = {
    menina: "Menina", menino: "Menino", professora: "Professora", professor: "Professor", vovo: "Vovó",
    gato: "Gato", cachorro: "Cachorro", passaro: "Pássaro", coelho: "Coelho", tartaruga: "Tartaruga",
    peixe: "Peixe", abelha: "Abelha", borboleta: "Borboleta", sol: "Sol", lua: "Lua", nuvem: "Nuvem",
    chuva: "Chuva", arvore: "Árvore", flor: "Flor", planeta: "Planeta", estrela: "Estrela", gota: "Gotinha",
    foguete: "Foguete", livro: "Livro", lapis: "Lápis", maca: "Maçã", casa: "Casa", letra: "Letra",
    numero: "Número", forma: "Forma"
  };
  const ANIMS = {
    parado: "Parado", "entrar-esquerda": "Entrar pela esquerda", "entrar-direita": "Entrar pela direita",
    "sair-direita": "Sair pela direita", pular: "Pular", balancar: "Balançar", andar: "Andar", girar: "Girar",
    aparecer: "Aparecer", crescer: "Crescer", flutuar: "Flutuar", falar: "Falar", acenar: "Acenar", chover: "Chover"
  };
  const TEXT_ANIMS = ["aparecer", "pular", "digitar"];
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ------------------------------------------------------------------ utilidades
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function num(v, d, a, b) {
    if (typeof v === "string" && v.trim() !== "") v = Number(v);
    if (typeof v !== "number" || !isFinite(v)) v = d;
    return clamp(v, a, b);
  }
  function clean(v, max) {
    if (typeof v === "number" && isFinite(v)) v = String(v);
    if (typeof v !== "string") return "";
    return v.replace(/\s+/g, " ").trim().slice(0, max).trim();
  }
  function hexColor(v) {
    if (typeof v !== "string") return "";
    v = v.trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : "";
  }
  function norm(s) {
    try {
      return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    } catch (e) { return String(s || "").toLowerCase().trim(); }
  }
  const ease = {
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
    inCubic: (k) => k * k * k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    outBack: (k) => { const c1 = 1.70158, c3 = c1 + 1, m = k - 1; return 1 + c3 * m * m * m + c1 * m * m; }
  };
  const mixMemo = new Map();
  function rgb(h) {
    h = String(h || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (h.length !== 6 || !isFinite(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(r, g, b) {
    return "#" + [r, g, b].map((v) => { v = Math.round(clamp(v, 0, 255)); return (v < 16 ? "0" : "") + v.toString(16); }).join("");
  }
  function mix(a, b, t) {
    const key = a + "|" + b + "|" + t;
    let r = mixMemo.get(key);
    if (r) return r;
    const A = rgb(a), B = rgb(b);
    r = toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    if (mixMemo.size > 3000) mixMemo.clear();
    mixMemo.set(key, r);
    return r;
  }
  const light = (c, t) => mix(c, "#ffffff", t);
  const dark = (c, t) => mix(c, "#000000", t);
  function rgba(h, a) { const c = rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hstr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeCanvas(w, h) {
    try {
      if (typeof document !== "undefined" && document.createElement) {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        return c;
      }
      if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    } catch (e) { /* sem canvas */ }
    return null;
  }

  // ------------------------------------------------------------------ validação
  const VALID = new WeakSet();
  const RAWCACHE = new WeakMap();

  function cleanActor(a) {
    if (!a || typeof a !== "object") return null;
    const type = typeof a.type === "string" ? a.type.trim() : "";
    if (!has(ACTORS, type)) return null;
    const o = { type: type, x: num(a.x, 0.5, 0, 1), y: num(a.y, 0.75, 0, 1), scale: num(a.scale, 1, 0.3, 3) };
    const c = hexColor(a.color);
    if (c) o.color = c;
    const tx = clean(a.text, 300);
    if (tx) o.text = tx;
    o.anim = typeof a.anim === "string" && has(ANIMS, a.anim.trim()) ? a.anim.trim() : "parado";
    const say = clean(a.say, 300);
    if (say) o.say = say;
    o.delay = num(a.delay, 0, 0, 20);
    o.flip = a.flip === true || a.flip === "true";
    return o;
  }
  function cleanText(t) {
    if (!t || typeof t !== "object") return null;
    const text = clean(t.text, 300);
    if (!text) return null;
    return {
      text: text, x: num(t.x, 0.5, 0, 1), y: num(t.y, 0.5, 0, 1), size: num(t.size, 1, 0.3, 3),
      anim: typeof t.anim === "string" && TEXT_ANIMS.indexOf(t.anim.trim()) >= 0 ? t.anim.trim() : "aparecer",
      color: hexColor(t.color) || "#ffffff"
    };
  }
  function cleanScene(s) {
    if (!s || typeof s !== "object") return null;
    const bg = typeof s.bg === "string" && has(BACKGROUNDS, s.bg.trim()) ? s.bg.trim() : "sala";
    const o = { bg: bg, duration: num(s.duration, 6, 2, 20), narration: clean(s.narration, 300), actors: [], texts: [] };
    const acts = Array.isArray(s.actors) ? s.actors : [];
    for (let i = 0; i < acts.length && o.actors.length < 8; i++) {
      const a = cleanActor(acts[i]);
      if (a) o.actors.push(a);
    }
    const txs = Array.isArray(s.texts) ? s.texts : [];
    for (let i = 0; i < txs.length && o.texts.length < 4; i++) {
      const t = cleanText(txs[i]);
      if (t) o.texts.push(t);
    }
    return o;
  }
  function validate(story) {
    const out = { title: "", lang: "pt-BR", scenes: [] };
    try {
      const s = story && typeof story === "object" ? story : {};
      out.title = clean(s.title, 300);
      out.lang = clean(s.lang, 20) || "pt-BR";
      const sc = Array.isArray(s.scenes) ? s.scenes : [];
      for (let i = 0; i < sc.length && out.scenes.length < 30; i++) {
        const r = cleanScene(sc[i]);
        if (r) out.scenes.push(r);
      }
    } catch (e) { /* devolve o que deu para aproveitar */ }
    VALID.add(out);
    return out;
  }
  function prep(story) {
    if (story && typeof story === "object") {
      if (VALID.has(story)) return story;
      let sig = null;
      try { sig = JSON.stringify(story); } catch (e) { sig = null; }
      const hit = RAWCACHE.get(story);
      if (hit && sig !== null && hit.sig === sig) return hit.v;
      const v = validate(story);
      if (sig !== null) RAWCACHE.set(story, { sig: sig, v: v });
      return v;
    }
    return validate(story);
  }
  function timing(vs) {
    const starts = [], durs = [];
    let total = 0;
    for (let i = 0; i < vs.scenes.length; i++) {
      starts.push(total);
      durs.push(vs.scenes[i].duration);
      total += vs.scenes[i].duration;
    }
    return { starts: starts, durs: durs, total: total };
  }
  function duration(story) {
    try { return timing(prep(story)).total; } catch (e) { return 0; }
  }
  function sceneAt(tm, t) {
    let i = 0;
    for (let k = 0; k < tm.starts.length; k++) { if (t >= tm.starts[k]) i = k; else break; }
    return i;
  }

  // ------------------------------------------------------------------ primitivas de desenho
  let C = null; // contexto 2D atual usado pelos auxiliares
  let LW = 4;   // largura do contorno (unidades locais do ator)

  function rrPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    C.beginPath();
    C.moveTo(x + r, y);
    C.arcTo(x + w, y, x + w, y + h, r);
    C.arcTo(x + w, y + h, x, y + h, r);
    C.arcTo(x, y + h, x, y, r);
    C.arcTo(x, y, x + w, y, r);
    C.closePath();
  }
  function paint(fill, sw) {
    if (fill) { C.fillStyle = fill; C.fill(); }
    if (sw === false || sw === 0) return;
    C.lineWidth = typeof sw === "number" ? sw : LW;
    C.strokeStyle = INK; C.lineJoin = "round"; C.lineCap = "round";
    C.stroke();
  }
  function ell(x, y, rx, ry, fill, sw, rot) {
    C.beginPath();
    C.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot || 0, 0, TAU);
    paint(fill, sw);
  }
  function circ(x, y, r, fill, sw) {
    C.beginPath();
    C.arc(x, y, Math.max(0.01, Math.abs(r)), 0, TAU);
    paint(fill, sw);
  }
  function rrect(x, y, w, h, r, fill, sw) { rrPath(x, y, w, h, r); paint(fill, sw); }
  function poly(pts, fill, sw) {
    C.beginPath();
    C.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) C.lineTo(pts[i], pts[i + 1]);
    C.closePath();
    paint(fill, sw);
  }
  function inkStroke(w, fill) {
    C.lineCap = "round"; C.lineJoin = "round";
    C.strokeStyle = INK; C.lineWidth = w + LW * 2; C.stroke();
    C.strokeStyle = fill; C.lineWidth = w; C.stroke();
  }
  function limb(x1, y1, x2, y2, w, fill) {
    C.beginPath(); C.moveTo(x1, y1); C.lineTo(x2, y2); inkStroke(w, fill);
  }
  function curveLimb(x1, y1, cx, cy, x2, y2, w, fill) {
    C.beginPath(); C.moveTo(x1, y1); C.quadraticCurveTo(cx, cy, x2, y2); inkStroke(w, fill);
  }
  function lg(x0, y0, x1, y1, stops) {
    const g = C.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  function rg(x, y, r0, r1, stops) {
    const g = C.createRadialGradient(x, y, r0, x, y, r1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  // preenche uma forma com brilho suave e contorno
  function solid(pathFn, col, y0, y1) {
    pathFn(); C.fillStyle = col; C.fill();
    C.save(); pathFn(); C.clip();
    C.fillStyle = lg(0, y0, 0, y1, [0, "rgba(255,255,255,0.38)", 0.5, "rgba(255,255,255,0)", 1, "rgba(0,0,0,0.14)"]);
    C.fillRect(-300, y0 - 20, 600, y1 - y0 + 40);
    C.restore();
    pathFn(); paint(null);
  }
  // união de círculos com contorno externo só (nuvens, copas, maçã)
  function union(circles, fill) {
    C.beginPath();
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      C.moveTo(c[0] + c[2], c[1]); C.arc(c[0], c[1], c[2], 0, TAU);
    }
    C.lineJoin = "round"; C.strokeStyle = INK; C.lineWidth = LW * 2; C.stroke();
    C.fillStyle = fill; C.fill();
  }
  function starPath(cx, cy, R, r, n, rot) {
    C.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r : R;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) C.moveTo(x, y); else C.lineTo(x, y);
    }
    C.closePath();
  }
  function heartPath(cx, cy, s) {
    C.beginPath();
    C.moveTo(cx, cy + s * 0.95);
    C.bezierCurveTo(cx - s * 1.55, cy + s * 0.1, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.3);
    C.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.55, cy + s * 0.1, cx, cy + s * 0.95);
    C.closePath();
  }

  // ---- rosto
  function eye(x, y, rx, ry, blink, look) {
    const k = 1 - blink * 0.92;
    if (k < 0.2) {
      C.beginPath(); C.moveTo(x - rx, y); C.quadraticCurveTo(x, y + ry * 0.5, x + rx, y);
      C.lineWidth = Math.max(1.5, LW * 0.7); C.strokeStyle = INK; C.lineCap = "round"; C.stroke();
      return;
    }
    const ex = x + look * rx * 0.2;
    C.fillStyle = INK; C.beginPath(); C.ellipse(ex, y, rx, ry * k, 0, 0, TAU); C.fill();
    C.fillStyle = "#fff";
    C.beginPath(); C.arc(ex - rx * 0.32, y - ry * k * 0.36, rx * 0.36, 0, TAU); C.fill();
    C.beginPath(); C.arc(ex + rx * 0.36, y + ry * k * 0.34, rx * 0.17, 0, TAU); C.fill();
  }
  function cheek(x, y, rx, ry) { ell(x, y, rx, ry, "rgba(255,98,130,0.4)", false); }
  function mouthPath(x, y, w, hh) {
    C.beginPath(); C.moveTo(x - w / 2, y); C.quadraticCurveTo(x, y + hh * 2.2, x + w / 2, y); C.closePath();
  }
  function mouth(x, y, w, open) {
    if (open > 0.1) {
      const hh = w * (0.16 + 0.5 * open);
      mouthPath(x, y, w, hh); C.fillStyle = "#7F1D2D"; C.fill();
      C.save(); mouthPath(x, y, w, hh); C.clip();
      ell(x, y + hh * 1.3, w * 0.34, hh * 0.55, "#FB7185", false);
      C.restore();
      mouthPath(x, y, w, hh);
      C.lineWidth = Math.max(1.5, LW * 0.75); C.strokeStyle = INK; C.lineJoin = "round"; C.stroke();
    } else {
      C.beginPath(); C.moveTo(x - w / 2, y); C.quadraticCurveTo(x, y + w * 0.5, x + w / 2, y);
      C.lineWidth = Math.max(1.5, LW * 0.8); C.strokeStyle = INK; C.lineCap = "round"; C.stroke();
    }
  }
  function face(x, y, k, p, look) {
    const lk = look == null ? 0 : look;
    eye(x - 11 * k, y, 4.6 * k, 6.2 * k, p.blink, lk);
    eye(x + 11 * k, y, 4.6 * k, 6.2 * k, p.blink, lk);
    cheek(x - 21 * k, y + 9 * k, 5.6 * k, 3.6 * k);
    cheek(x + 21 * k, y + 9 * k, 5.6 * k, 3.6 * k);
    mouth(x, y + 10 * k, 12 * k, p.talk);
  }
  function whiskers(x, y, s, len) {
    C.lineWidth = Math.max(1.4, LW * 0.5); C.strokeStyle = "rgba(31,41,55,0.8)"; C.lineCap = "round";
    C.beginPath();
    C.moveTo(x + s * 4, y); C.lineTo(x + s * len, y - 5);
    C.moveTo(x + s * 4, y + 3); C.lineTo(x + s * len, y + 4);
    C.stroke();
  }

  // ---- chuva (usada por nuvem, chuva e anim "chover")
  function rainDrops(t, x0, x1, top, bottom, n, ripple) {
    const base = C.globalAlpha;
    for (let i = 0; i < n; i++) {
      const sp = 0.85 + (i % 3) * 0.22;
      const ph = (((t * sp + i * 0.381966) % 1) + 1) % 1;
      const x = x0 + (x1 - x0) * ((i * 0.6180339 + (i % 4) * 0.13) % 1);
      const y = top + (bottom - top) * ph;
      C.globalAlpha = base * (ph < 0.85 ? 1 : (1 - ph) / 0.15);
      C.beginPath(); C.moveTo(x, y - 9); C.quadraticCurveTo(x + 5.5, y + 1, x, y + 5); C.quadraticCurveTo(x - 5.5, y + 1, x, y - 9);
      C.fillStyle = "#5BC0F8"; C.fill(); C.lineWidth = 2; C.strokeStyle = INK; C.stroke();
      if (ripple && ph > 0.86) {
        const rk = (ph - 0.86) / 0.14;
        C.globalAlpha = base * (1 - rk) * 0.7;
        C.beginPath(); C.ellipse(x, bottom + 4, 4 + rk * 12, 1.6 + rk * 4, 0, 0, TAU);
        C.lineWidth = 2; C.strokeStyle = "#2B8FD6"; C.stroke();
      }
    }
    C.globalAlpha = base;
  }

  // ------------------------------------------------------------------ pessoas
  const SKINS = ["#FAD7BD", "#F1BE92", "#D9A06E", "#B87A4B", "#8F5A39", "#6A412A"];
  const HAIRS = ["#2B1B12", "#5A3A22", "#8B5A2B", "#C28A3E", "#E3B95C", "#1F2937", "#7A3E1E", "#A0522D"];
  const SALT = { menina: 1, menino: 3, professora: 0, professor: 4, vovo: 2 };

  function hairCap(col) {
    C.beginPath();
    C.arc(0, -112, 40, Math.PI, TAU);
    C.quadraticCurveTo(38, -130, 22, -128);
    C.quadraticCurveTo(6, -127, -8, -120);
    C.quadraticCurveTo(-22, -118, -30, -102);
    C.quadraticCurveTo(-34, -108, -40, -112);
    C.closePath();
    paint(col);
  }
  function arm(side, ang, sleeve, skin) {
    const sx = side * 25, sy = -76, L = 31;
    const ex = sx + side * Math.sin(ang) * L * 0.5, ey = sy + Math.cos(ang) * L * 0.5;
    const hx = sx + side * Math.sin(ang) * L, hy = sy + Math.cos(ang) * L;
    limb(ex, ey, hx, hy, 10, skin);
    limb(sx, sy, ex, ey, 12, sleeve);
    circ(hx, hy, 6.5, skin);
  }
  function glasses(round) {
    C.lineWidth = Math.max(2, LW * 0.75);
    for (let s = -1; s <= 1; s += 2) {
      if (round) circ(s * 14, -106, 11, "rgba(255,255,255,0.3)", C.lineWidth);
      else rrect(s * 14 - 11, -114, 22, 16, 5, "rgba(255,255,255,0.3)", C.lineWidth);
    }
    C.beginPath();
    C.moveTo(-3, -107); C.lineTo(3, -107);
    C.moveTo(-25, -108); C.lineTo(-37, -111);
    C.moveTo(25, -108); C.lineTo(37, -111);
    C.strokeStyle = INK; C.lineCap = "round"; C.stroke();
  }

  function person(p, kind) {
    const idx = p.idx, t = p.t;
    const skin = SKINS[(idx * 2 + SALT[kind] + (kind === "vovo" ? 1 : 0)) % 6];
    let hair = HAIRS[(idx * 3 + SALT[kind] * 2 + 1) % HAIRS.length];
    if (kind === "vovo") hair = "#D5D9E0";
    const base = { menina: "#EC4899", menino: "#3B82F6", professora: "#8B5CF6", professor: "#0F766E", vovo: "#F59E0B" }[kind];
    const shirt = p.color || base;
    const style = (idx + SALT[kind]) % 3;
    const shoe = { menina: dark(shirt, 0.3), menino: "#F8FAFC", professora: "#7C2D12", professor: "#3B2A20", vovo: "#92400E" }[kind];
    const legCol = kind === "professor" ? "#374151" : skin;
    const ph = p.ph, amp = p.amp, hy = -112;

    // pernas e sapatos
    for (let i = -1; i <= 1; i += 2) {
      const o = i > 0 ? Math.PI : 0;
      const a = Math.sin(ph + o) * amp;
      const lift = Math.max(0, Math.cos(ph + o)) * amp * 9;
      const hx = i * 12, fx = hx + a * 15, fy = -6 - lift;
      limb(hx, -36, fx, fy, 13, legCol);
      ell(fx + 3, fy + 3, 13, 7, shoe);
    }

    // corpo
    if (kind === "menina") {
      C.beginPath();
      C.moveTo(-22, -84); C.lineTo(22, -84);
      C.quadraticCurveTo(26, -52, 40, -28); C.quadraticCurveTo(0, -18, -40, -28); C.quadraticCurveTo(-26, -52, -22, -84);
      C.closePath(); paint(shirt);
      rrect(-23, -64, 46, 9, 4, light(shirt, 0.55));
    } else if (kind === "menino") {
      rrect(-24, -52, 48, 24, 9, "#475569");
      rrPath(-24, -86, 48, 44, 14); C.fillStyle = shirt; C.fill();
      C.save(); C.clip(); C.fillStyle = light(shirt, 0.5); C.fillRect(-30, -70, 60, 8); C.restore();
      rrect(-24, -86, 48, 44, 14, null);
    } else if (kind === "professora") {
      C.beginPath(); C.moveTo(-24, -50); C.lineTo(24, -50); C.lineTo(28, -24); C.quadraticCurveTo(0, -17, -28, -24); C.closePath();
      paint(dark(shirt, 0.4));
      rrect(-24, -86, 48, 44, 14, shirt);
      C.beginPath(); C.arc(0, -84, 11, 0.2, Math.PI - 0.2);
      C.lineWidth = 3; C.strokeStyle = "#FDE68A"; C.lineCap = "round"; C.stroke();
    } else if (kind === "professor") {
      rrect(-24, -52, 48, 26, 7, "#374151");
      rrect(-26, -86, 52, 46, 12, shirt);
      poly([-10, -86, 10, -86, 0, -62], "#F8FAFC", Math.max(2, LW * 0.6));
      poly([-3.5, -78, 3.5, -78, 4.5, -64, 0, -57, -4.5, -64], "#EF4444", Math.max(2, LW * 0.6));
    } else { // vovo
      C.beginPath(); C.moveTo(-24, -52); C.lineTo(24, -52); C.lineTo(32, -16); C.quadraticCurveTo(0, -9, -32, -16); C.closePath();
      paint(mix(shirt, "#6B4E9B", 0.55));
      rrect(-25, -86, 50, 44, 14, shirt);
      for (let i = 0; i < 3; i++) circ(0, -74 + i * 11, 2.4, "#FDE68A", Math.max(1.5, LW * 0.4));
    }

    // cabelo de trás
    if (kind === "menina") {
      if (style === 0) rrect(-45, -148, 90, 78, 36, hair);
      else if (style === 1) { circ(-28, -148, 15, hair); circ(28, -148, 15, hair); }
      else circ(0, -128, 48, hair);
    } else if (kind === "professora") {
      circ(0, -153, 15, hair);
      rrect(-43, -144, 86, 66, 32, hair);
    } else if (kind === "vovo") {
      circ(0, -154, 17, hair);
    } else if (kind === "menino" && style === 2) {
      circ(-18, -146, 16, hair); circ(2, -152, 17, hair); circ(22, -146, 16, hair);
    }
    if (kind === "menina" && style === 0) {
      ell(-47, -88, 12, 20, hair); ell(47, -88, 12, 20, hair);
      circ(-42, -106, 5, "#F472B6"); circ(42, -106, 5, "#F472B6");
    }

    // braços
    let angR = 0.18 + Math.sin(t * 2 + idx) * 0.03 + Math.sin(ph) * 0.45 * amp;
    const angL = 0.18 + Math.sin(t * 2.3 + idx) * 0.03 - Math.sin(ph) * 0.45 * amp;
    if (p.wave) angR = 2.45 + Math.sin(t * 9) * 0.4;
    else if (p.talk > 0.05 || p.anim === "falar") angR = 0.7 + Math.sin(t * 4.5) * 0.28;
    arm(-1, angL, shirt, skin);
    arm(1, angR, shirt, skin);

    // cabeça
    circ(-37, hy + 3, 7, skin); circ(37, hy + 3, 7, skin);
    ell(0, hy, 38, 36, skin);
    ell(0, hy + 10, 2.8, 2.1, dark(skin, 0.15), false);
    if (kind === "professor" || kind === "vovo") {
      C.lineWidth = 3; C.strokeStyle = kind === "vovo" ? "#9CA3AF" : dark(hair, 0.1); C.lineCap = "round";
      C.beginPath(); C.moveTo(-19, -122); C.lineTo(-9, -123); C.moveTo(9, -123); C.lineTo(19, -122); C.stroke();
    }
    eye(-14, hy + 4, 5.4, 7.2, p.blink, p.look);
    eye(14, hy + 4, 5.4, 7.2, p.blink, p.look);
    cheek(-23, hy + 15, 6.4, 4.2); cheek(23, hy + 15, 6.4, 4.2);
    mouth(0, hy + 19, 15, p.talk);

    // cabelo da frente e acessórios
    if (kind === "menina") {
      if (style === 2) { C.beginPath(); C.arc(0, -112, 40, Math.PI * 1.08, Math.PI * 1.92); C.lineWidth = 7; C.strokeStyle = "#F472B6"; C.stroke(); }
      else hairCap(hair);
      if (style !== 2) {
        poly([-34, -146, -22, -140, -34, -134], "#F472B6"); poly([-12, -146, -24, -140, -12, -134], "#F472B6"); circ(-23, -140, 4, "#FB7185");
      }
    } else if (kind === "menino") {
      if (style === 1) {
        poly([-30, -138, -22, -166, -12, -142], hair); poly([-12, -142, 0, -170, 10, -142], hair); poly([8, -142, 22, -166, 30, -136], hair);
      }
      hairCap(hair);
    } else if (kind === "professora") {
      hairCap(hair); glasses(true);
    } else if (kind === "professor") {
      hairCap(hair); glasses(false);
      ell(-6, hy + 14, 7, 3.6, hair, false, 0.25); ell(6, hy + 14, 7, 3.6, hair, false, -0.25);
    } else {
      hairCap(hair); glasses(true);
    }
  }
  const personFn = (kind) => (p) => person(p, kind);

  // ------------------------------------------------------------------ animais
  function gato(p) {
    const c = p.color || "#F59E0B", cl = light(c, 0.6), cd = dark(c, 0.25), t = p.t;
    const onca = norm(p.text) === "onca";
    const sway = Math.sin(t * 2.4) * 0.5;
    curveLimb(-34, -38, -74 + sway * 16, -42, -60 + sway * 24, -96, 11, c);
    for (let i = 0; i < 4; i++) {
      const x = [-26, -10, 12, 28][i], lift = Math.max(0, Math.sin(p.ph + i * 1.6)) * p.amp * 8;
      rrect(x - 7, -22 - lift, 14, 22, 6, i < 2 ? cd : c);
      ell(x + 1, -3 - lift, 10, 5.5, cl);
    }
    ell(0, -42, 41, 27, c);
    ell(3, -32, 27, 14, cl, false);
    C.save(); C.beginPath(); C.ellipse(0, -42, 41, 27, 0, 0, TAU); C.clip();
    if (onca) {
      const sp = [[-26, -56], [-10, -62], [8, -58], [24, -54], [-18, -44], [0, -46], [16, -40], [-30, -36], [30, -32]];
      for (let i = 0; i < sp.length; i++) { ell(sp[i][0], sp[i][1], 6, 5, cd, false); ell(sp[i][0], sp[i][1], 2.6, 2.2, c, false); }
    } else {
      C.strokeStyle = cd; C.lineWidth = 6; C.lineCap = "round";
      C.beginPath();
      for (let x = -24; x <= 18; x += 14) { C.moveTo(x, -72); C.lineTo(x + 3, -54); }
      C.stroke();
    }
    C.restore();
    ell(0, -42, 41, 27, null);
    poly([13, -82, 16, -114, 38, -92], c); poly([55, -82, 52, -114, 30, -92], c);
    poly([19, -90, 19, -106, 31, -94], "#F9A8D4", false); poly([49, -90, 49, -106, 37, -94], "#F9A8D4", false);
    ell(34, -68, 29, 25, c);
    ell(34, -57, 13, 9, cl, false);
    if (onca) { ell(20, -84, 4, 3, cd, false); ell(48, -84, 4, 3, cd, false); ell(34, -88, 4, 3, cd, false); }
    else {
      C.strokeStyle = cd; C.lineWidth = 4; C.lineCap = "round";
      C.beginPath(); C.moveTo(34, -92); C.lineTo(34, -84); C.moveTo(26, -91); C.lineTo(28, -84); C.moveTo(42, -91); C.lineTo(40, -84); C.stroke();
    }
    eye(23, -70, 4.8, 6.4, p.blink, 0.8); eye(45, -70, 4.8, 6.4, p.blink, 0.8);
    cheek(15, -60, 5, 3.4); cheek(53, -60, 5, 3.4);
    poly([31, -63, 37, -63, 34, -59], "#F472B6", Math.max(1.5, LW * 0.5));
    if (p.talk > 0.1) mouth(34, -55, 11, p.talk);
    else {
      C.beginPath(); C.moveTo(34, -59); C.quadraticCurveTo(34, -53, 28, -53); C.moveTo(34, -59); C.quadraticCurveTo(34, -53, 40, -53);
      C.lineWidth = Math.max(1.5, LW * 0.6); C.strokeStyle = INK; C.lineCap = "round"; C.stroke();
    }
    whiskers(34 - 14, -60, -1, 22); whiskers(34 + 14, -60, 1, 22);
  }

  function cachorro(p) {
    const lobo = norm(p.text) === "lobo";
    const c = p.color || (lobo ? "#E07B39" : "#C68642"), cl = light(c, 0.6), cd = lobo ? "#2B2118" : dark(c, 0.3), t = p.t;
    const legH = lobo ? 34 : 22, dy = lobo ? -12 : 0;
    const wag = Math.sin(t * (p.talk > 0.05 || p.amp > 0 ? 12 : 6)) * 10;
    for (let i = 0; i < 4; i++) {
      const x = [-28, -12, 14, 30][i], lift = Math.max(0, Math.sin(p.ph + i * 1.6)) * p.amp * 8;
      rrect(x - 6.5, -legH - 2 - lift, 13, legH + 2, 5, lobo ? cd : (i < 2 ? dark(c, 0.15) : c));
      ell(x + 1, -3 - lift, 9.5, 5.5, lobo ? cd : cl);
    }
    C.save(); C.translate(0, dy);
    curveLimb(-38, -46, -62, -48, -58 + wag, -76, 10, c);
    ell(0, -42, 43, 26, c);
    ell(4, -32, 28, 13, cl, false);
    if (!lobo) { C.save(); C.beginPath(); C.ellipse(0, -42, 43, 26, 0, 0, TAU); C.clip(); ell(-18, -54, 14, 11, cd, false); C.restore(); ell(0, -42, 43, 26, null); }
    ell(34, -44, 17, 7, "#EF4444"); circ(34, -37, 4.5, "#FDE047", Math.max(1.5, LW * 0.5));
    if (lobo) {
      poly([14, -84, 17, -122, 38, -88], cd); poly([54, -84, 51, -122, 30, -88], cd);
      poly([20, -90, 20, -112, 31, -92], "#7C3A1B", false); poly([48, -90, 48, -112, 37, -92], "#7C3A1B", false);
    } else {
      ell(7, -62, 10, 20, cd, true, 0.35); ell(61, -62, 10, 20, cd, true, -0.35);
    }
    ell(34, -64, lobo ? 25 : 26, lobo ? 22 : 24, c);
    if (!lobo) ell(46, -70, 11, 10, cd, false);
    ell(34, -55, 14, 10, lobo ? "#2B2118" : cl, lobo ? undefined : false);
    ell(34, -60, 6, 4.4, INK, false);
    eye(24, -68, 4.6, 6.2, p.blink, 0.8); eye(44, -68, 4.6, 6.2, p.blink, 0.8);
    cheek(16, -58, 4.6, 3.2); cheek(52, -58, 4.6, 3.2);
    if (p.talk > 0.1) mouth(34, -52, 11, p.talk);
    else {
      C.beginPath(); C.moveTo(34, -56); C.lineTo(34, -52); C.moveTo(34, -52); C.quadraticCurveTo(34, -47, 28, -48); C.moveTo(34, -52); C.quadraticCurveTo(34, -47, 40, -48);
      C.lineWidth = Math.max(1.5, LW * 0.6); C.strokeStyle = lobo ? "#fff" : INK; C.lineCap = "round"; C.stroke();
      if (!lobo) ell(34, -46, 4.5, 4, "#FB7185", Math.max(1.5, LW * 0.5));
    }
    C.restore();
  }

  function passaro(p) {
    const c = p.color || "#38BDF8", cl = light(c, 0.6), cd = dark(c, 0.2), t = p.t;
    const flying = p.anim === "flutuar" || p.amp > 0;
    const flap = Math.sin(t * (flying ? 16 : 1.6)) * (flying ? 0.7 : 0.18);
    limb(-6, -18, -6, -2, 4, "#FB923C"); limb(8, -18, 8, -2, 4, "#FB923C");
    ell(-4, -1, 7, 3, "#FB923C", Math.max(1.5, LW * 0.5)); ell(10, -1, 7, 3, "#FB923C", Math.max(1.5, LW * 0.5));
    poly([-26, -44, -62, -60, -56, -44], cd); poly([-26, -38, -62, -34, -54, -24], cd);
    ell(0, -42, 32, 28, c);
    ell(6, -34, 22, 17, cl, false);
    C.save(); C.translate(-6, -48); C.rotate(-0.4 - flap);
    ell(-6, 4, 20, 10, cd, true, 0);
    C.restore();
    poly([14, -82, 18, -100, 26, -84], c);
    circ(22, -66, 20, c);
    poly([38, -70, 58, -62, 38, -55], "#FB923C");
    eye(28, -70, 4.4, 5.8, p.blink, 0.8);
    cheek(22, -57, 4.4, 3);
    if (p.talk > 0.1) { C.beginPath(); C.moveTo(38, -60); C.lineTo(54, -61); C.lineWidth = 3; C.strokeStyle = "#7C2D12"; C.stroke(); }
  }

  function coelho(p) {
    const c = p.color || "#F3F4F6", t = p.t, pink = "#FBA8C0", belly = light(c, 0.7);
    for (let s = -1; s <= 1; s += 2) {
      C.save(); C.translate(s * 13, -104); C.rotate(s * 0.08 + Math.sin(t * 1.7 + s) * 0.05);
      ell(0, -24, 10.5, 27, c); ell(0, -22, 5.5, 18, pink, false);
      C.restore();
    }
    ell(-15, -6, 15, 8, c); ell(15, -6, 15, 8, c);
    circ(-28, -24, 9, "#FFFFFF");
    ell(0, -36, 28, 32, c);
    ell(0, -32, 16, 22, belly, false);
    limb(-21, -52, -13, -32, 8, c); limb(21, -52, 13, -32, 8, c);
    ell(0, -84, 28, 25, c);
    eye(-10, -86, 4.6, 6.2, p.blink, 0); eye(10, -86, 4.6, 6.2, p.blink, 0);
    cheek(-19, -76, 5, 3.4); cheek(19, -76, 5, 3.4);
    ell(0, -78, 3.6, 2.7, "#F472B6", Math.max(1.5, LW * 0.5));
    if (p.talk > 0.1) mouth(0, -73, 10, p.talk);
    else {
      rrect(-3.6, -73, 7.2, 8, 2, "#fff", Math.max(1.5, LW * 0.5));
      C.beginPath(); C.moveTo(0, -75); C.lineTo(0, -73); C.moveTo(0, -73); C.quadraticCurveTo(-1, -69, -7, -71); C.moveTo(0, -73); C.quadraticCurveTo(1, -69, 7, -71);
      C.lineWidth = Math.max(1.5, LW * 0.6); C.strokeStyle = INK; C.lineCap = "round"; C.stroke();
    }
    whiskers(-12, -76, -1, 26); whiskers(12, -76, 1, 26);
  }

  function tartaruga(p) {
    const c = p.color || "#3FAE6A", skin = "#BDE37A", t = p.t, bob = Math.sin(t * 2) * 1.5;
    for (let i = 0; i < 4; i++) {
      const x = [-34, -14, 16, 36][i], lift = Math.max(0, Math.sin(p.ph + i * 1.6)) * p.amp * 6;
      rrect(x - 9, -22 - lift, 18, 22, 8, skin);
    }
    poly([-46, -26, -64, -20, -46, -14], skin);
    rrect(-52, -26, 104, 14, 7, "#F2E2A0");
    limb(40, -34, 56, -46 + bob, 16, skin);
    circ(62, -48 + bob, 17, skin);
    eye(68, -52 + bob, 4.4, 5.8, p.blink, 1);
    cheek(60, -42 + bob, 4.6, 3);
    mouth(68, -41 + bob, 10, p.talk);
    const shell = () => { C.beginPath(); C.moveTo(-48, -22); C.bezierCurveTo(-48, -86, 48, -86, 48, -22); C.closePath(); };
    shell(); C.fillStyle = lg(0, -78, 0, -22, [0, light(c, 0.35), 1, c]); C.fill();
    C.save(); shell(); C.clip();
    C.strokeStyle = dark(c, 0.4); C.lineWidth = 3; C.lineJoin = "round";
    C.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6, vx = Math.cos(a) * 15, vy = -52 + Math.sin(a) * 13;
      if (i === 0) C.moveTo(vx, vy); else C.lineTo(vx, vy);
      C.moveTo(vx, vy); C.lineTo(vx * 2.4, -52 + (vy + 52) * 2.4); C.moveTo(vx, vy);
    }
    C.closePath(); C.stroke();
    C.restore();
    shell(); paint(null);
  }

  function peixe(p) {
    const c = p.color || "#FB923C", t = p.t, cl = light(c, 0.55), cd = dark(c, 0.2);
    C.save(); C.translate(-38, -44); C.rotate(Math.sin(t * 6) * 0.25);
    poly([4, 0, -34, -28, -26, 0, -34, 28], cd);
    C.restore();
    poly([-14, -68, 4, -94, 22, -66], cd); poly([-8, -22, 6, -6, 16, -22], cd);
    ell(0, -44, 46, 30, c);
    C.save(); C.beginPath(); C.ellipse(0, -44, 46, 30, 0, 0, TAU); C.clip();
    ell(8, -30, 40, 14, cl, false);
    C.fillStyle = "rgba(255,255,255,0.55)"; C.fillRect(-20, -80, 9, 70); C.fillRect(-2, -80, 9, 70);
    C.restore();
    ell(0, -44, 46, 30, null);
    ell(-2, -38, 12, 7, cd, true, 0.5);
    eye(27, -52, 5.6, 7.2, p.blink, 1);
    cheek(32, -39, 4.6, 3);
    mouth(42, -41, 7, p.talk);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i / 3) % 1;
      ell(52 + i * 3 + Math.sin(ph * 7 + i) * 3, -46 - ph * 60, 3 + i, 3 + i, "rgba(186,230,253,0.75)", Math.max(1.5, LW * 0.5));
    }
  }

  function abelha(p) {
    const c = p.color || "#FBBF24", t = p.t, fl = Math.sin(t * 38);
    for (let k = 0; k < 2; k++) {
      C.save(); C.translate(-4 + k * 8, -64); C.rotate((k ? 0.15 : -0.45) + fl * (k ? -0.28 : 0.28));
      ell(0, -15, 9.5, 18, "rgba(219,234,254,0.88)", Math.max(2, LW * 0.8));
      C.restore();
    }
    limb(8, -66, 4, -84, 2.5, INK); circ(4, -85, 3.5, INK, false);
    limb(18, -64, 26, -81, 2.5, INK); circ(26, -82, 3.5, INK, false);
    limb(-8, -21, -10, -9, 3, INK); limb(2, -20, 2, -8, 3, INK); limb(12, -21, 14, -9, 3, INK);
    poly([-30, -48, -44, -44, -30, -40], "#374151");
    ell(0, -44, 31, 25, c);
    C.save(); C.beginPath(); C.ellipse(0, -44, 31, 25, 0, 0, TAU); C.clip();
    C.fillStyle = INK; C.fillRect(-19, -76, 9, 60); C.fillRect(-2, -76, 9, 60);
    C.restore();
    ell(0, -44, 31, 25, null);
    eye(13, -50, 4, 5.4, p.blink, 1); eye(25, -50, 4, 5.4, p.blink, 1);
    cheek(11, -39, 4, 2.8); cheek(28, -39, 4, 2.8);
    mouth(19, -38, 8, p.talk);
  }

  function borboleta(p) {
    const c = p.color || "#A78BFA", c2 = mix(c, "#F9A8D4", 0.55), t = p.t;
    const f = 0.42 + 0.58 * Math.abs(Math.cos(t * (p.amp > 0 ? 7 : 4)));
    for (let s = -1; s <= 1; s += 2) ell(s * 15 * f, -30, 15 * f, 13, c2, undefined, s * 0.5);
    for (let s = -1; s <= 1; s += 2) {
      ell(s * 24 * f, -58, 24 * f, 21, c, undefined, -s * 0.5);
      circ(s * 27 * f, -62, 6 * f, "rgba(255,255,255,0.85)", false);
      circ(s * 15 * f, -30, 4 * f, "#FDE68A", false);
    }
    ell(0, -44, 5.5, 24, dark(c, 0.5));
    circ(0, -72, 8, dark(c, 0.5));
    circ(-3, -73, 1.8, "#fff", false); circ(3, -73, 1.8, "#fff", false);
    curveLimb(-3, -78, -8, -92, -15, -94, 2, INK); curveLimb(3, -78, 8, -92, 15, -94, 2, INK);
  }

  // ------------------------------------------------------------------ objetos e natureza
  function sol(p) {
    const c = p.color || "#FCD34D", ray = mix(c, "#F59E0B", 0.6), cy = -66, R = 46, rot = p.t * 0.35;
    for (let i = 0; i < 12; i++) {
      const a = rot + i * TAU / 12, len = i % 2 ? 66 : 78;
      const bx = Math.cos(a), by = Math.sin(a), px = -by, py = bx;
      poly([bx * (R + 2) + px * 9, cy + by * (R + 2) + py * 9, bx * len, cy + by * len, bx * (R + 2) - px * 9, cy + by * (R + 2) - py * 9], ray);
    }
    circ(0, cy, R, rg(-12, cy - 14, 4, R + 6, [0, "#FFF7B0", 1, c]));
    face(0, cy + 2, 1.15, p, 0);
  }

  function moonPath(R, r, d) {
    const xi = (d * d + R * R - r * r) / (2 * d), yi = Math.sqrt(Math.max(0, R * R - xi * xi));
    const phi = Math.atan2(yi, xi), psi = Math.atan2(yi, xi - d);
    C.beginPath();
    C.arc(0, 0, R, -phi, phi, true);
    C.arc(d, 0, r, psi, TAU - psi, false);
    C.closePath();
  }
  function lua(p) {
    const c = p.color || "#FDE68A";
    C.save(); C.translate(0, -66);
    moonPath(50, 44, 26);
    C.fillStyle = rg(-30, -20, 4, 70, [0, light(c, 0.55), 1, dark(c, 0.06)]); C.fill();
    C.save(); moonPath(50, 44, 26); C.clip();
    ell(-36, 22, 6, 4.5, dark(c, 0.12), false); ell(-26, -30, 4, 3, dark(c, 0.12), false);
    C.restore();
    moonPath(50, 44, 26); paint(null);
    eye(-32, -6, 4.2, 5.6, p.blink, 0.5);
    cheek(-38, 8, 4.4, 3);
    mouth(-31, 12, 9, p.talk);
    const s = 1 + Math.sin(p.t * 3) * 0.12;
    starPath(48, -42, 11 * s, 5 * s, 4, 0); paint("#FDE68A", Math.max(1.5, LW * 0.6));
    C.restore();
  }

  function nuvem(p) {
    const c = p.color || "#FFFFFF";
    if (p.rain) rainDrops(p.t, -52, 52, -20, 170, 10, false);
    const cir = [[-44, -40, 24], [-14, -62, 32], [26, -52, 30], [52, -34, 22], [-66, -30, 16], [10, -30, 30]];
    union(cir, lg(0, -96, 0, -8, [0, light(c, 0.5), 1, dark(c, 0.08)]));
    face(0, -38, 1.1, p, 0);
  }

  function chuva(p) {
    ell(0, 3, 62, 8, "rgba(91,192,248,0.35)", false);
    rainDrops(p.t, -70, 70, -150, 0, 14, true);
  }

  function arvore(p) {
    const c = p.color || "#46B05A", t = p.t, bark = "#A06A3B";
    C.save(); C.rotate(Math.sin(t * 1.3 + p.idx) * 0.012);
    C.beginPath(); C.moveTo(-18, 0); C.quadraticCurveTo(-10, -50, -12, -112); C.lineTo(12, -112); C.quadraticCurveTo(10, -50, 18, 0); C.closePath();
    paint(bark);
    C.beginPath(); C.moveTo(-4, -8); C.lineTo(-3, -40); C.moveTo(6, -20); C.lineTo(5, -62);
    C.lineWidth = 3; C.strokeStyle = "rgba(0,0,0,0.2)"; C.lineCap = "round"; C.stroke();
    limb(0, -84, -32, -122, 9, bark); limb(0, -92, 32, -126, 9, bark);
    union([[0, -176, 60], [-52, -142, 42], [52, -142, 42], [-30, -206, 40], [34, -208, 38], [0, -140, 48]], lg(0, -250, 0, -96, [0, light(c, 0.35), 1, c]));
    circ(-28, -198, 16, "rgba(255,255,255,0.16)", false); circ(-60, -148, 11, "rgba(255,255,255,0.14)", false);
    if (norm(p.text) === "frutos") {
      const fr = [[-30, -168], [24, -190], [44, -146], [-52, -138], [6, -142], [-6, -214]];
      for (let i = 0; i < fr.length; i++) circ(fr[i][0], fr[i][1], 7, "#EF4444", Math.max(2, LW * 0.6));
    }
    C.restore();
  }

  function flor(p) {
    const c = p.color || "#F472B6";
    C.save(); C.rotate(Math.sin(p.t * 1.6 + p.idx) * 0.05);
    curveLimb(0, 0, -6, -46, 0, -84, 7, "#3FAE5A");
    C.save(); C.translate(-3, -34); C.rotate(-0.7); ell(-14, 0, 15, 7, "#4CC067"); C.restore();
    C.save(); C.translate(3, -50); C.rotate(0.7); ell(14, 0, 15, 7, "#4CC067"); C.restore();
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 - Math.PI / 2;
      circ(Math.cos(a) * 19, -98 + Math.sin(a) * 19, 12.5, c);
    }
    circ(0, -98, 15, "#FBBF24");
    face(0, -99, 0.62, p, 0);
    C.restore();
  }

  function planeta(p) {
    const V = {
      mercurio: ["#A8A29E", 40, "craters"], venus: ["#F2B45A", 48, "swirl"], terra: ["#3B82F6", 50, "earth"],
      marte: ["#E4572E", 44, "mars"], jupiter: ["#D9A066", 62, "bands"], saturno: ["#E9C46A", 48, "ring"],
      urano: ["#7DD3FC", 50, "ringv"], netuno: ["#4F6BED", 50, "bands2"]
    };
    const key = norm(p.text);
    const v = has(V, key) ? V[key] : [p.color || "#A78BFA", 48, key === "anel" ? "ring" : "spots"];
    const col = p.color || v[0], R = v[1], kind = v[2], cy = -R - 8;
    const hasRing = kind === "ring" || kind === "ringv";
    const ringCol = kind === "ringv" ? "#BAE6FD" : "#F5D78E", tilt = kind === "ringv" ? 1.15 : -0.28;
    const ring = (front) => {
      C.save(); C.translate(0, cy); C.rotate(tilt);
      C.beginPath(); C.ellipse(0, 0, R * 1.75, R * 0.46, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      inkStroke(R * 0.15, ringCol);
      C.restore();
    };
    if (hasRing) ring(false);
    C.beginPath(); C.arc(0, cy, R, 0, TAU);
    C.fillStyle = rg(-R * 0.35, cy - R * 0.4, R * 0.1, R * 1.3, [0, light(col, 0.5), 0.5, col, 1, dark(col, 0.3)]); C.fill();
    C.save(); C.beginPath(); C.arc(0, cy, R, 0, TAU); C.clip();
    if (kind === "craters" || kind === "mars" || kind === "spots") {
      const cr = [[-0.4, -0.35, 0.16], [0.35, -0.5, 0.12], [0.45, 0.2, 0.18], [-0.25, 0.5, 0.14], [0.0, 0.1, 0.09]];
      for (let i = 0; i < cr.length; i++) ell(cr[i][0] * R, cy + cr[i][1] * R, cr[i][2] * R, cr[i][2] * R * 0.8, dark(col, 0.2), false);
      if (kind === "mars") ell(0, cy - R * 0.98, R * 0.55, R * 0.26, "#FFFFFF", false);
    } else if (kind === "earth") {
      ell(-R * 0.3, cy - R * 0.25, R * 0.36, R * 0.22, "#4ADE80", false, 0.5);
      ell(R * 0.38, cy + R * 0.2, R * 0.32, R * 0.2, "#4ADE80", false, -0.4);
      ell(-R * 0.15, cy + R * 0.55, R * 0.24, R * 0.14, "#4ADE80", false, 0.2);
      ell(R * 0.15, cy - R * 0.6, R * 0.28, R * 0.08, "rgba(255,255,255,0.85)", false);
    } else if (kind === "bands" || kind === "bands2") {
      const ys = [-0.62, -0.32, 0.05, 0.38, 0.68], hs = [0.1, 0.15, 0.12, 0.15, 0.1];
      for (let i = 0; i < ys.length; i++) {
        C.fillStyle = i % 2 ? "rgba(255,244,214,0.5)" : rgba(dark(col, 0.3), 0.5);
        C.fillRect(-R, cy + ys[i] * R - hs[i] * R / 2, R * 2, hs[i] * R);
      }
      if (kind === "bands") ell(R * 0.32, cy + R * 0.28, R * 0.2, R * 0.12, "#C2410C", false);
    } else if (kind === "swirl") {
      C.strokeStyle = "rgba(255,255,255,0.45)"; C.lineWidth = 5; C.lineCap = "round";
      C.beginPath(); C.moveTo(-R, cy - R * 0.3); C.quadraticCurveTo(0, cy - R * 0.7, R, cy - R * 0.2);
      C.moveTo(-R, cy + R * 0.35); C.quadraticCurveTo(0, cy, R, cy + R * 0.5); C.stroke();
    } else if (hasRing) {
      C.fillStyle = "rgba(255,255,255,0.22)"; C.fillRect(-R, cy - R * 0.5, R * 2, R * 0.16); C.fillRect(-R, cy + R * 0.3, R * 2, R * 0.2);
    }
    C.restore();
    C.beginPath(); C.arc(0, cy, R, 0, TAU); paint(null);
    if (hasRing) ring(true);
    face(0, cy + R * 0.06, R / 56, p, 0);
  }

  function estrela(p) {
    const c = p.color || "#FBBF24", pulse = 1 + Math.sin(p.t * 3 + p.idx) * 0.04;
    C.save(); C.translate(0, -54); C.scale(pulse, pulse); C.rotate(Math.sin(p.t * 1.5) * 0.08); C.translate(0, 54);
    solid(() => starPath(0, -54, 56, 26, 5, 0), c, -112, -2);
    face(0, -50, 0.95, p, 0);
    C.restore();
  }

  function gota(p) {
    const c = p.color || "#38BDF8";
    const path = () => {
      C.beginPath(); C.moveTo(0, -98); C.bezierCurveTo(10, -76, 34, -60, 34, -38);
      C.arc(0, -38, 34, 0, Math.PI, false); C.bezierCurveTo(-34, -60, -10, -76, 0, -98); C.closePath();
    };
    solid(path, c, -98, -4);
    ell(-18, -52, 5, 11, "rgba(255,255,255,0.7)", false, 0.45);
    face(0, -36, 1.15, p, 0);
  }

  function foguete(p) {
    const col = p.color || "#EF4444", fl = 26 + Math.sin(p.t * 38) * 5 + Math.sin(p.t * 23) * 4;
    C.save(); C.translate(0, -22);
    C.beginPath(); C.moveTo(-12, -36); C.quadraticCurveTo(-17, -36 + fl * 0.6, 0, -36 + fl); C.quadraticCurveTo(17, -36 + fl * 0.6, 12, -36); C.closePath();
    paint("#FB923C");
    C.beginPath(); C.moveTo(-6, -36); C.quadraticCurveTo(-8, -36 + fl * 0.45, 0, -36 + fl * 0.7); C.quadraticCurveTo(8, -36 + fl * 0.45, 6, -36); C.closePath();
    C.fillStyle = "#FDE047"; C.fill();
    poly([-26, -80, -58, -32, -26, -48], col); poly([26, -80, 58, -32, 26, -48], col);
    rrect(-15, -46, 30, 12, 4, "#64748B");
    const body = () => {
      C.beginPath(); C.moveTo(0, -176); C.bezierCurveTo(36, -150, 34, -100, 29, -42); C.lineTo(-29, -42); C.bezierCurveTo(-34, -100, -36, -150, 0, -176); C.closePath();
    };
    body(); C.fillStyle = "#F8FAFC"; C.fill();
    C.save(); body(); C.clip();
    C.fillStyle = col; C.fillRect(-40, -180, 80, 46); C.fillRect(-40, -68, 80, 12);
    C.fillStyle = "rgba(0,0,0,0.08)"; C.fillRect(14, -180, 30, 150);
    C.restore();
    body(); paint(null);
    circ(0, -106, 19.5, "#CBD5E1");
    circ(0, -106, 14, "#60A5FA");
    ell(-5, -111, 4, 6, "rgba(255,255,255,0.8)", false, 0.5);
    C.restore();
  }

  function livro(p) {
    const c = p.color || "#EF4444";
    rrect(-36, -106, 84, 104, 5, "#FFF8E7");
    rrect(-42, -110, 84, 104, 8, c);
    rrect(-42, -110, 16, 104, 6, dark(c, 0.22));
    rrect(-14, -98, 46, 7, 3, "rgba(255,255,255,0.85)", false);
    face(8, -66, 0.85, p, 0);
    starPath(8, -30, 13, 6, 5, 0); paint("#FDE047", Math.max(2, LW * 0.6));
  }

  function lapis(p) {
    const c = p.color || "#FBBF24";
    rrect(-17, -22, 34, 22, 7, "#F9A8D4");
    rrect(-18, -40, 36, 20, 3, "#CBD5E1");
    rrect(-17, -132, 34, 94, 2, c);
    C.save(); rrPath(-17, -132, 34, 94, 2); C.clip();
    C.fillStyle = dark(c, 0.14); C.fillRect(-17, -132, 11, 94);
    C.fillStyle = light(c, 0.4); C.fillRect(8, -132, 4, 94);
    C.restore();
    rrect(-17, -132, 34, 94, 2, null);
    poly([-17, -132, 17, -132, 5, -156, -5, -156], "#F3D9A4");
    poly([-5, -156, 5, -156, 0, -166], INK);
    face(0, -92, 0.62, p, 0);
  }

  function maca(p) {
    const c = p.color || "#EF4444";
    limb(0, -62, 5, -86, 6, "#8B5A2B");
    C.save(); C.translate(8, -80); C.rotate(-0.5); ell(12, 0, 13, 6.5, "#4CC067"); C.restore();
    union([[-14, -38, 26], [14, -38, 26], [0, -30, 26]], lg(0, -66, 0, -6, [0, light(c, 0.3), 1, dark(c, 0.12)]));
    ell(0, -62, 6, 3, dark(c, 0.35), false);
    ell(-20, -48, 5, 10, "rgba(255,255,255,0.55)", false, 0.5);
  }

  function casa(p) {
    const c = p.color || "#FDE68A", t = p.t;
    rrect(46, -178, 22, 46, 3, "#B45309");
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.4 + i / 3) % 1;
      circ(57 + Math.sin(ph * 6 + i) * 6, -182 - ph * 54, 6 + ph * 9, "rgba(255,255,255," + (0.85 * (1 - ph)).toFixed(3) + ")", false);
    }
    rrect(-80, -112, 160, 112, 6, c);
    poly([-100, -108, 0, -184, 100, -108], "#EF4444");
    rrect(-20, -66, 40, 66, 12, "#A0643A");
    circ(10, -34, 3.5, "#FDE047", Math.max(1.5, LW * 0.5));
    for (let s = 0; s < 2; s++) {
      const x = s ? 32 : -66;
      rrect(x, -92, 34, 34, 5, "#BAE6FD");
      C.beginPath(); C.moveTo(x + 17, -92); C.lineTo(x + 17, -58); C.moveTo(x, -75); C.lineTo(x + 34, -75);
      C.lineWidth = Math.max(2, LW * 0.6); C.strokeStyle = INK; C.stroke();
    }
  }

  const BLOCKS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
  function glyph(g, fs, y) {
    C.font = "bold " + fs + "px " + FONT; C.textAlign = "center"; C.textBaseline = "middle";
    C.lineJoin = "round"; C.lineWidth = 7; C.strokeStyle = INK; C.strokeText(g, 0, y);
    C.fillStyle = "#fff"; C.fillText(g, 0, y);
  }
  function letra(p) {
    const g = (p.text || "A").slice(0, 3);
    const c = p.color || BLOCKS[hstr(g) % BLOCKS.length];
    solid(() => rrPath(-52, -106, 104, 104, 24), c, -106, -2);
    glyph(g, g.length === 1 ? 84 : g.length === 2 ? 62 : 44, -50);
  }
  function numero(p) {
    const g = (p.text || "1").slice(0, 3);
    const c = p.color || BLOCKS[(hstr(g) + 3) % BLOCKS.length];
    solid(() => { C.beginPath(); C.arc(0, -54, 52, 0, TAU); }, c, -106, -2);
    glyph(g, g.length === 1 ? 80 : g.length === 2 ? 62 : 44, -51);
  }

  function forma(p) {
    const defs = { circulo: "#3B82F6", quadrado: "#EF4444", triangulo: "#10B981", estrela: "#FBBF24", coracao: "#EC4899", retangulo: "#8B5CF6", losango: "#F97316" };
    const s = norm(p.text), kind = has(defs, s) ? s : "circulo", c = p.color || defs[kind];
    let path, fy = -54, k = 1;
    if (kind === "quadrado") path = () => rrPath(-50, -104, 100, 100, 16);
    else if (kind === "retangulo") { path = () => rrPath(-68, -94, 136, 84, 14); fy = -56; }
    else if (kind === "triangulo") { path = () => { C.beginPath(); C.moveTo(0, -112); C.lineTo(60, -6); C.lineTo(-60, -6); C.closePath(); }; fy = -42; k = 0.95; }
    else if (kind === "estrela") { path = () => starPath(0, -56, 58, 26, 5, 0); fy = -52; k = 0.9; }
    else if (kind === "coracao") { path = () => heartPath(0, -54, 46); fy = -56; }
    else if (kind === "losango") { path = () => { C.beginPath(); C.moveTo(0, -112); C.lineTo(56, -56); C.lineTo(0, 0); C.lineTo(-56, -56); C.closePath(); }; fy = -58; k = 0.95; }
    else path = () => { C.beginPath(); C.arc(0, -54, 52, 0, TAU); };
    solid(path, c, -112, -2);
    face(0, fy, k, p, 0);
  }

  // ------------------------------------------------------------------ registro de atores
  // h: altura (escala 1) | sw: meia largura da sombra (0 = sem sombra) | k: tipo | nf: não espelhar
  const META = {
    menina: { h: 166, sw: 34, k: "person", f: personFn("menina") },
    menino: { h: 166, sw: 34, k: "person", f: personFn("menino") },
    professora: { h: 170, sw: 34, k: "person", f: personFn("professora") },
    professor: { h: 160, sw: 34, k: "person", f: personFn("professor") },
    vovo: { h: 170, sw: 34, k: "person", f: personFn("vovo") },
    gato: { h: 116, sw: 46, k: "animal", f: gato },
    cachorro: { h: 124, sw: 48, k: "animal", f: cachorro },
    passaro: { h: 102, sw: 30, k: "animal", f: passaro },
    coelho: { h: 160, sw: 34, k: "animal", f: coelho },
    tartaruga: { h: 90, sw: 54, k: "animal", f: tartaruga },
    peixe: { h: 96, sw: 0, k: "animal", hover: true, f: peixe },
    abelha: { h: 90, sw: 0, k: "animal", hover: true, f: abelha },
    borboleta: { h: 98, sw: 0, k: "animal", hover: true, f: borboleta },
    sol: { h: 144, sw: 0, k: "obj", hover: true, f: sol },
    lua: { h: 120, sw: 0, k: "obj", hover: true, f: lua },
    nuvem: { h: 100, sw: 0, k: "obj", hover: true, f: nuvem },
    chuva: { h: 150, sw: 0, k: "obj", f: chuva },
    arvore: { h: 250, sw: 62, k: "obj", f: arvore },
    flor: { h: 125, sw: 20, k: "obj", f: flor },
    planeta: { h: 130, sw: 0, k: "obj", hover: true, f: planeta },
    estrela: { h: 114, sw: 0, k: "obj", hover: true, f: estrela },
    gota: { h: 100, sw: 28, k: "obj", f: gota },
    foguete: { h: 200, sw: 40, k: "obj", f: foguete },
    livro: { h: 112, sw: 44, k: "obj", f: livro },
    lapis: { h: 168, sw: 20, k: "obj", f: lapis },
    maca: { h: 90, sw: 30, k: "obj", f: maca },
    casa: { h: 186, sw: 96, k: "obj", f: casa },
    letra: { h: 106, sw: 46, k: "obj", nf: true, f: letra },
    numero: { h: 106, sw: 46, k: "obj", nf: true, f: numero },
    forma: { h: 114, sw: 46, k: "obj", f: forma }
  };

  // ------------------------------------------------------------------ cenários
  const BG = {};
  const BGDYN = {};
  const NO_GROUND = { espaco: 1, ceu: 1, oceano: 1 };

  function fr(x, y, w, h, f) { C.fillStyle = f; C.fillRect(x, y, w, h); }
  function dot(x, y, r, f) { C.fillStyle = f; C.beginPath(); C.arc(x, y, r, 0, TAU); C.fill(); }
  function eli(x, y, rx, ry, f, rot) { C.fillStyle = f; C.beginPath(); C.ellipse(x, y, rx, ry, rot || 0, 0, TAU); C.fill(); }
  function bgRR(x, y, w, h, r, f) { rrPath(x, y, w, h, r); C.fillStyle = f; C.fill(); }
  function bgPoly(pts, f) {
    C.beginPath(); C.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) C.lineTo(pts[i][0], pts[i][1]);
    C.closePath(); C.fillStyle = f; C.fill();
  }
  function line(x1, y1, x2, y2, w, col) {
    C.beginPath(); C.moveTo(x1, y1); C.lineTo(x2, y2); C.lineWidth = w; C.strokeStyle = col; C.lineCap = "round"; C.stroke();
  }
  function puff(x, y, s, col) {
    const cs = [[0, 0, 28], [30, -12, 34], [66, -2, 28], [-28, 8, 20], [92, 8, 20]];
    C.fillStyle = col; C.beginPath();
    for (let i = 0; i < cs.length; i++) {
      C.moveTo(x + (cs[i][0] + cs[i][2]) * s, y + cs[i][1] * s);
      C.arc(x + cs[i][0] * s, y + cs[i][1] * s, cs[i][2] * s, 0, TAU);
    }
    C.fill();
    bgRR(x - 34 * s, y + 2 * s, 148 * s, 26 * s, 13 * s, col);
  }
  function hills(baseY, amp, f, seed, freq) {
    const r = rng(seed), p1 = r() * TAU, p2 = r() * TAU;
    C.fillStyle = f; C.beginPath(); C.moveTo(0, H);
    for (let x = 0; x <= W + 16; x += 16) {
      C.lineTo(x, baseY - amp * (0.5 + 0.5 * Math.sin(x * freq + p1)) - amp * 0.35 * Math.sin(x * freq * 2.3 + p2));
    }
    C.lineTo(W, H); C.closePath(); C.fill();
  }
  function sunDisc(x, y, r, col) {
    col = col || "#FFE066";
    C.fillStyle = rg(x, y, r * 0.5, r * 3.2, [0, "rgba(255,244,170,0.7)", 1, "rgba(255,244,170,0)"]);
    C.beginPath(); C.arc(x, y, r * 3.2, 0, TAU); C.fill();
    dot(x, y, r, col); dot(x, y, r * 0.8, light(col, 0.55));
  }
  function roundTree(x, base, s, crown) {
    bgRR(x - 9 * s, base - 92 * s, 18 * s, 92 * s, 4 * s, "#8B5A2B");
    dot(x, base - 124 * s, 54 * s, crown); dot(x - 42 * s, base - 98 * s, 38 * s, crown); dot(x + 42 * s, base - 98 * s, 38 * s, crown);
    dot(x - 14 * s, base - 140 * s, 28 * s, light(crown, 0.18));
  }
  function tufts(seed, n, y0, y1, cols, hmin, hmax) {
    const r = rng(seed);
    C.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = y0 + r() * (y1 - y0), h = hmin + r() * (hmax - hmin);
      C.strokeStyle = cols[Math.floor(r() * cols.length)]; C.lineWidth = 2.5;
      C.beginPath(); C.moveTo(x, y); C.lineTo(x - 4, y - h); C.moveTo(x, y); C.lineTo(x + 1, y - h * 1.15); C.moveTo(x, y); C.lineTo(x + 5, y - h * 0.9); C.stroke();
    }
  }

  BG.sala = function () {
    fr(0, 0, W, 470, lg(0, 0, 0, 470, [0, "#FFF3CF", 1, "#FFE0A0"]));
    fr(0, 340, W, 130, "#BFE8DC"); fr(0, 336, W, 8, "#FFFFFF"); fr(0, 344, W, 4, "rgba(0,0,0,0.06)");
    fr(0, 470, W, 250, lg(0, 470, 0, 720, [0, "#E8B982", 1, "#C98F57"]));
    C.strokeStyle = "rgba(90,50,10,0.16)"; C.lineWidth = 2;
    const ys = [470, 500, 534, 574, 620, 674, 720];
    for (let i = 0; i < ys.length - 1; i++) {
      C.beginPath(); C.moveTo(0, ys[i]); C.lineTo(W, ys[i]);
      const step = 150 + i * 30, off = (i % 2) * step / 2;
      for (let x = -off; x < W; x += step) { C.moveTo(x, ys[i]); C.lineTo(x, ys[i + 1]); }
      C.stroke();
    }
    fr(0, 460, W, 14, "#FBF8F1"); fr(0, 474, W, 5, "rgba(0,0,0,0.1)");
    eli(640, 620, 430, 70, "rgba(124,92,214,0.28)"); eli(640, 620, 380, 56, "rgba(255,255,255,0.18)");
    // bandeirinhas
    const fc = ["#F87171", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA", "#F472B6"];
    C.beginPath(); C.moveTo(0, 22);
    C.quadraticCurveTo(640, 92, W, 22); C.lineWidth = 3; C.strokeStyle = "#8B6B4A"; C.stroke();
    for (let i = 0; i < 24; i++) {
      const u = (i + 0.5) / 24, x = 2 * u * (1 - u) * 640 + u * u * W, y = (1 - u) * (1 - u) * 22 + 2 * u * (1 - u) * 92 + u * u * 22 + 2;
      bgPoly([[x - 17, y], [x + 17, y], [x, y + 38]], fc[i % fc.length]);
    }
    // lousa
    bgRR(296, 70, 568, 292, 16, "#B9814A");
    bgRR(310, 84, 540, 264, 10, lg(0, 84, 0, 348, [0, "#34705E", 1, "#2A5E4E"]));
    eli(560, 300, 150, 26, "rgba(255,255,255,0.05)"); eli(720, 160, 120, 18, "rgba(255,255,255,0.04)");
    C.font = "bold 58px " + FONT; C.textAlign = "left"; C.textBaseline = "middle"; C.fillStyle = "rgba(255,255,255,0.88)";
    C.fillText("A B C  1 2 3", 340, 146);
    C.strokeStyle = "rgba(255,255,255,0.8)"; C.lineWidth = 4; C.lineCap = "round";
    C.beginPath(); C.moveTo(340, 198); C.bezierCurveTo(420, 178, 480, 218, 560, 198); C.stroke();
    C.beginPath(); C.arc(770, 150, 26, 0, TAU);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; C.moveTo(770 + Math.cos(a) * 36, 150 + Math.sin(a) * 36); C.lineTo(770 + Math.cos(a) * 48, 150 + Math.sin(a) * 48); }
    C.stroke();
    starPath(380, 280, 20, 9, 5, 0); C.stroke();
    starPath(470, 300, 14, 6, 5, 0); C.stroke();
    bgRR(290, 358, 580, 16, 6, "#A56E3A");
    bgRR(330, 352, 30, 8, 3, "#FFFFFF"); bgRR(372, 353, 24, 7, 3, "#FBCFE8"); bgRR(406, 353, 26, 7, 3, "#FDE68A");
    bgRR(760, 346, 52, 18, 5, "#4B5563"); bgRR(760, 346, 52, 7, 3, "#F59E0B");
    // janela
    bgRR(944, 84, 256, 238, 12, "#FFFFFF");
    C.save(); rrPath(956, 96, 232, 214, 6); C.clip();
    fr(956, 96, 232, 214, lg(0, 96, 0, 310, [0, "#7CD0F8", 1, "#DDF4FF"]));
    puff(990, 150, 0.6, "#FFFFFF"); puff(1110, 200, 0.5, "#FFFFFF");
    dot(1020, 330, 120, "#8ED77C"); dot(1150, 340, 110, "#6FC46A");
    bgRR(1100, 214, 8, 50, 2, "#8B5A2B"); dot(1104, 206, 28, "#46B05A");
    C.restore();
    fr(1068, 96, 8, 214, "#FFFFFF"); fr(956, 196, 232, 8, "#FFFFFF");
    bgRR(920, 60, 304, 10, 5, "#8B5A2B");
    bgRR(930, 70, 62, 264, 16, "#F59E9E"); bgRR(1152, 70, 62, 264, 16, "#F59E9E");
    bgRR(930, 190, 62, 12, 6, "#EF7F86"); bgRR(1152, 190, 62, 12, 6, "#EF7F86");
    bgRR(930, 322, 284, 16, 6, "#FFFFFF");
    // estante
    bgRR(34, 120, 214, 344, 8, "#B9814A"); bgRR(46, 132, 190, 320, 4, "#8A5A2C");
    const r = rng(404), bc = ["#EF4444", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899", "#14B8A6"];
    for (let row = 0; row < 3; row++) {
      const by = 132 + (row + 1) * 106 - 6;
      let x = 52;
      while (x < 226) {
        const w = 14 + Math.floor(r() * 12), h = 56 + Math.floor(r() * 30);
        if (x + w > 232) break;
        bgRR(x, by - h, w, h, 2, bc[Math.floor(r() * bc.length)]);
        x += w + 2;
      }
      bgRR(40, by, 202, 10, 3, "#B9814A");
    }
  };

  BG.parque = function () {
    fr(0, 0, W, 490, lg(0, 0, 0, 490, [0, "#6FCBF6", 1, "#E2F6FF"]));
    sunDisc(1090, 120, 54, "#FFE066");
    puff(110, 120, 1.1, "#FFFFFF"); puff(500, 70, 0.9, "#FFFFFF"); puff(760, 190, 0.7, "#FFFFFF");
    hills(480, 64, "#A6E08F", 11, 0.006); hills(512, 46, "#7FCB74", 23, 0.009);
    fr(0, 500, W, 220, lg(0, 500, 0, 720, [0, "#7ED36B", 1, "#4AA84B"]));
    C.beginPath(); C.moveTo(560, 500); C.lineTo(724, 500); C.bezierCurveTo(770, 570, 990, 630, 1110, 720); C.lineTo(210, 720); C.bezierCurveTo(430, 630, 520, 570, 560, 500);
    C.closePath(); C.fillStyle = "#F3DDA3"; C.fill();
    roundTree(110, 530, 1.5, "#3FAE5A"); roundTree(1180, 520, 1.3, "#4CBB63");
    roundTree(330, 500, 0.7, "#58C46B");
    // banco
    bgRR(880, 480, 130, 12, 5, "#A0643A"); bgRR(880, 452, 130, 24, 5, "#B9784A"); bgRR(892, 490, 10, 32, 3, "#6B4423"); bgRR(988, 490, 10, 32, 3, "#6B4423");
    tufts(3, 70, 510, 716, ["#3E9A45", "#5DBE5F", "#2F8A3C"], 8, 18);
    const r = rng(8), fc = ["#F472B6", "#FBBF24", "#FFFFFF", "#A78BFA", "#FB7185"];
    for (let i = 0; i < 60; i++) {
      const x = r() * W, y = 510 + r() * 205, c = fc[Math.floor(r() * fc.length)];
      line(x, y, x, y + 9, 2, "#3E9A45"); dot(x, y, 4.5, c); dot(x, y, 1.8, "#FDE047");
    }
  };
  BGDYN.parque = function (t) {
    C.strokeStyle = "rgba(55,65,81,0.7)"; C.lineWidth = 3; C.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const x = ((t * (22 + i * 7) + i * 420) % (W + 200)) - 100, y = 90 + i * 46 + Math.sin(t * 2 + i) * 6, f = Math.sin(t * 8 + i * 2) * 5;
      C.beginPath(); C.moveTo(x - 14, y - 4 - f); C.quadraticCurveTo(x - 6, y - 10, x, y); C.quadraticCurveTo(x + 6, y - 10, x + 14, y - 4 - f); C.stroke();
    }
  };

  BG.espaco = function () {
    fr(0, 0, W, H, lg(0, 0, 0, H, [0, "#080B20", 0.55, "#17154A", 1, "#2D2470"]));
    fr(0, 0, W, H, rg(300, 200, 10, 520, [0, "rgba(168,85,247,0.30)", 1, "rgba(168,85,247,0)"]));
    fr(0, 0, W, H, rg(980, 420, 10, 480, [0, "rgba(56,189,248,0.22)", 1, "rgba(56,189,248,0)"]));
    fr(0, 0, W, H, rg(700, 640, 10, 360, [0, "rgba(244,114,182,0.20)", 1, "rgba(244,114,182,0)"]));
    const r = rng(2024), sc = ["#FFFFFF", "#FFF4C2", "#CFE8FF"];
    for (let i = 0; i < 170; i++) dot(r() * W, r() * H, 0.6 + r() * 1.5, sc[Math.floor(r() * 3)]);
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = r() * H * 0.9, s = 5 + r() * 7;
      C.fillStyle = "#FFF9D6"; C.beginPath(); C.moveTo(x, y - s); C.quadraticCurveTo(x, y, x + s, y); C.quadraticCurveTo(x, y, x, y + s); C.quadraticCurveTo(x, y, x - s, y); C.quadraticCurveTo(x, y, x, y - s); C.fill();
    }
    // planeta grande
    C.save(); C.beginPath(); C.arc(110, 790, 300, 0, TAU); C.clip();
    fr(-200, 480, 700, 400, lg(0, 480, 0, 800, [0, "#8B5CF6", 1, "#4C1D95"]));
    for (let i = 0; i < 5; i++) fr(-200, 500 + i * 46, 700, 14, "rgba(255,255,255,0.10)");
    C.restore();
    C.beginPath(); C.arc(110, 790, 300, Math.PI * 1.1, Math.PI * 1.9); C.lineWidth = 6; C.strokeStyle = "rgba(255,255,255,0.18)"; C.stroke();
    // lua cinza
    dot(1130, 120, 38, rg(1118, 108, 4, 44, [0, "#F3F4F6", 1, "#9CA3AF"]));
    dot(1118, 128, 7, "rgba(0,0,0,0.12)"); dot(1142, 104, 5, "rgba(0,0,0,0.12)");
  };
  BGDYN.espaco = function (t) {
    const r = rng(5150);
    for (let i = 0; i < 36; i++) {
      const x = r() * W, y = r() * H * 0.95, ph = r() * TAU, s = 1.4 + r() * 1.6, sp = 1.5 + r() * 2;
      const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * sp + ph));
      dot(x, y, s, "rgba(255,255,255," + a.toFixed(3) + ")");
    }
    const cyc = (t % 9) / 9;
    if (cyc < 0.1) {
      const k = cyc / 0.1, x = 300 + k * 500, y = 80 + k * 200, al = Math.sin(k * Math.PI);
      C.lineCap = "round"; C.lineWidth = 3; C.strokeStyle = "rgba(255,255,255," + (al * 0.9).toFixed(3) + ")";
      C.beginPath(); C.moveTo(x, y); C.lineTo(x - 90, y - 36); C.stroke();
      dot(x, y, 3.5, "rgba(255,255,255," + al.toFixed(3) + ")");
    }
  };

  BG.fazenda = function () {
    fr(0, 0, W, 500, lg(0, 0, 0, 500, [0, "#78C8F2", 1, "#E5F7FF"]));
    sunDisc(190, 110, 46, "#FFE066");
    puff(520, 90, 1, "#FFFFFF"); puff(900, 60, 0.7, "#FFFFFF"); puff(1100, 170, 0.8, "#FFFFFF");
    hills(470, 70, "#B4E39A", 31, 0.005); hills(500, 48, "#86CF6E", 17, 0.008);
    // celeiro e silo
    bgRR(880, 290, 280, 214, 6, "#D9453D");
    bgPoly([[856, 304], [1020, 206], [1184, 304]], "#8C2B2B");
    bgPoly([[884, 300], [1020, 222], [1156, 300]], "#B23A3A");
    bgRR(990, 296, 60, 46, 4, "#F4F1EA"); bgRR(998, 304, 44, 30, 3, "#6B1F1F");
    bgRR(950, 362, 140, 142, 4, "#F4F1EA");
    C.beginPath(); C.moveTo(960, 372); C.lineTo(1080, 494); C.moveTo(1080, 372); C.lineTo(960, 494); C.moveTo(1020, 362); C.lineTo(1020, 504);
    C.lineWidth = 8; C.strokeStyle = "#D9453D"; C.stroke();
    bgRR(790, 262, 82, 242, 4, "#CBD5E1"); eli(831, 262, 41, 28, "#94A3B8");
    for (let y = 300; y < 500; y += 44) fr(790, y, 82, 5, "rgba(0,0,0,0.12)");
    fr(0, 492, W, 228, lg(0, 492, 0, 720, [0, "#8ED565", 1, "#58AE48"]));
    C.beginPath(); C.moveTo(0, 640); C.bezierCurveTo(300, 590, 700, 700, 1280, 620); C.lineTo(1280, 720); C.lineTo(0, 720); C.closePath();
    C.fillStyle = "rgba(196,150,86,0.45)"; C.fill();
    // cerca
    for (let x = 6; x < 780; x += 66) bgRR(x, 462, 14, 74, 4, "#EBD7A6");
    bgRR(0, 480, 790, 10, 4, "#F4E6C2"); bgRR(0, 508, 790, 10, 4, "#F4E6C2");
    // fardos
    eli(1040, 560, 62, 44, "#E8C45E"); eli(1160, 574, 54, 38, "#DDB44D");
    for (let i = -2; i <= 2; i++) line(1040 + i * 20, 530, 1040 + i * 17, 590, 2, "rgba(150,100,10,0.4)");
    roundTree(660, 500, 0.9, "#4FB863");
    tufts(21, 60, 520, 716, ["#4C9F3D", "#6BC15A"], 8, 17);
  };

  BG.oceano = function () {
    fr(0, 0, W, H, lg(0, 0, 0, H, [0, "#82D6F8", 0.45, "#2D8FD0", 1, "#0B4474"]));
    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 230;
      bgPoly([[x, 0], [x + 70, 0], [x + 230, 700], [x + 80, 700]], "rgba(255,255,255,0.07)");
    }
    // areia
    C.beginPath(); C.moveTo(0, 720); C.lineTo(0, 650);
    for (let x = 0; x <= W; x += 40) C.lineTo(x, 648 + Math.sin(x * 0.012) * 14 + Math.sin(x * 0.031) * 6);
    C.lineTo(W, 720); C.closePath(); C.fillStyle = lg(0, 640, 0, 720, [0, "#F3DCA4", 1, "#D4B26E"]); C.fill();
    // pedras
    eli(150, 690, 90, 40, "#7488A6"); eli(190, 676, 60, 30, "#8CA0BC"); eli(1090, 694, 110, 42, "#6C809E"); eli(1010, 684, 54, 26, "#8094B2");
    // corais
    const r = rng(909), cc = ["#FB7185", "#FB923C", "#F472B6", "#FBBF24"];
    for (let k = 0; k < 7; k++) {
      const bx = 330 + k * 110 + r() * 40, col = cc[k % cc.length];
      for (let b = 0; b < 3; b++) {
        const a = -Math.PI / 2 + (b - 1) * 0.5 + (r() - 0.5) * 0.2, len = 40 + r() * 40;
        line(bx, 690, bx + Math.cos(a) * len, 690 + Math.sin(a) * len, 12, col);
        dot(bx + Math.cos(a) * len, 690 + Math.sin(a) * len, 8, light(col, 0.3));
      }
    }
    // conchas e estrelas-do-mar
    eli(560, 700, 18, 12, "#FDE2E4"); eli(780, 706, 14, 9, "#FFE8CC");
    starPath(960, 700, 16, 7, 5, 0.3); C.fillStyle = "#FB923C"; C.fill();
    // peixes distantes
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 300, y = 130 + (i % 2) * 90;
      eli(x, y, 20, 10, "rgba(255,255,255,0.18)"); bgPoly([[x - 16, y], [x - 32, y - 10], [x - 32, y + 10]], "rgba(255,255,255,0.18)");
    }
  };
  BGDYN.oceano = function (t) {
    const r = rng(77);
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 195 + r() * 40, h = 110 + r() * 80, ph = r() * TAU;
      const sw = Math.sin(t * 1.4 + ph) * 18;
      C.beginPath(); C.moveTo(x, 700); C.quadraticCurveTo(x - sw, 700 - h * 0.5, x + sw, 700 - h);
      C.lineWidth = 12; C.strokeStyle = i % 2 ? "#2FA36B" : "#3CBF7E"; C.lineCap = "round"; C.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = r() * W, sp = 18 + r() * 30, rad = 3 + r() * 6, y = 720 - ((t * sp + r() * 720) % 740);
      C.beginPath(); C.arc(x + Math.sin(t + i) * 6, y, rad, 0, TAU); C.fillStyle = "rgba(255,255,255,0.16)"; C.fill();
      C.lineWidth = 1.5; C.strokeStyle = "rgba(255,255,255,0.6)"; C.stroke();
    }
  };

  BG.cidade = function () {
    fr(0, 0, W, 480, lg(0, 0, 0, 480, [0, "#79C8F6", 1, "#E2F4FF"]));
    sunDisc(1100, 100, 44, "#FFE066");
    puff(150, 100, 1, "#FFFFFF"); puff(640, 60, 0.8, "#FFFFFF");
    const r = rng(1234), pal = ["#F4A261", "#E76F51", "#2A9D8F", "#E9C46A", "#8AB17D", "#9D8DF1", "#F28DB2"];
    for (let x = -20; x < W; x += 70) { const h = 120 + r() * 140; bgRR(x, 470 - h, 66, h, 3, "#B9D3E8"); }
    let x = -30;
    while (x < W) {
      const w = 100 + Math.floor(r() * 50), h = 170 + Math.floor(r() * 160), col = pal[Math.floor(r() * pal.length)];
      bgRR(x, 470 - h, w, h, 4, col);
      fr(x, 470 - h, w, 12, "rgba(0,0,0,0.12)");
      for (let wy = 470 - h + 30; wy < 440; wy += 38) {
        for (let wx = x + 14; wx < x + w - 24; wx += 30) bgRR(wx, wy, 18, 24, 3, r() < 0.3 ? "#FFE9A8" : "#CDEBFF");
      }
      x += w + 6;
    }
    fr(0, 470, W, 72, "#DADFE6"); fr(0, 536, W, 8, "#B3BCC8");
    fr(0, 544, W, 176, "#4B5563");
    for (let dx = 10; dx < W; dx += 130) bgRR(dx, 632, 70, 8, 3, "#F3F4F6");
    for (let i = 0; i < 7; i++) bgRR(540, 556 + i * 22, 200, 11, 3, "#E5E7EB");
    roundTree(90, 540, 0.55, "#4CBB63"); roundTree(1190, 540, 0.55, "#58C46B");
    bgRR(1010, 400, 8, 140, 3, "#6B7280"); bgRR(1000, 392, 28, 10, 4, "#6B7280"); dot(1014, 412, 5, "#FDE047");
  };
  BGDYN.cidade = function (t) {
    const x = ((t * 70) % (W + 500)) - 250, y = 596;
    eli(x, y + 40, 80, 9, "rgba(0,0,0,0.18)");
    bgRR(x - 70, y - 4, 140, 40, 14, "#EF4444");
    bgRR(x - 40, y - 34, 84, 36, 14, "#EF4444");
    bgRR(x - 32, y - 28, 30, 24, 6, "#CDEBFF"); bgRR(x + 4, y - 28, 30, 24, 6, "#CDEBFF");
    dot(x + 66, y + 10, 5, "#FDE047");
    dot(x - 40, y + 36, 14, "#1F2937"); dot(x + 40, y + 36, 14, "#1F2937"); dot(x - 40, y + 36, 6, "#9CA3AF"); dot(x + 40, y + 36, 6, "#9CA3AF");
  };

  BG.floresta = function () {
    fr(0, 0, W, 490, lg(0, 0, 0, 490, [0, "#CDEBB2", 1, "#8CCB92"]));
    const r = rng(60);
    for (let x = -20; x < W + 40; x += 56) {
      const h = 120 + r() * 100;
      bgPoly([[x, 480], [x + 28, 480 - h], [x + 56, 480]], "#8CC79A");
    }
    hills(500, 40, "#5FA86B", 77, 0.007);
    for (let x = 40; x < W; x += 150 + r() * 60) {
      const s = 0.6 + r() * 0.3;
      bgRR(x - 7 * s, 400, 14 * s, 100, 3, "#6B4A2E"); dot(x, 380, 50 * s, "#4E9F5B"); dot(x - 30 * s, 405, 34 * s, "#4E9F5B"); dot(x + 30 * s, 405, 34 * s, "#58AC63");
    }
    fr(0, 490, W, 230, lg(0, 490, 0, 720, [0, "#62AB4C", 1, "#2F6B34"]));
    for (let k = 0; k < 2; k++) {
      const x = k ? 1200 : 70;
      bgRR(x - 48, 0, 96, 720, 8, "#7A4E2D"); fr(x - 30, 0, 14, 720, "rgba(255,255,255,0.10)"); fr(x + 16, 0, 20, 720, "rgba(0,0,0,0.12)");
    }
    for (let i = 0; i < 26; i++) {
      const x = i * 52 + r() * 20, y = r() * 60;
      dot(x, y, 40 + r() * 30, r() < 0.5 ? "#2E7D4F" : "#2A6F45");
    }
    for (let k = 0; k < 4; k++) {
      const x = 180 + k * 260 + r() * 60;
      bgPoly([[x, 0], [x + 60, 0], [x + 230, 720], [x + 60, 720]], "rgba(255,255,190,0.10)");
    }
    // cogumelos
    for (let k = 0; k < 3; k++) {
      const mx = [190, 1090, 640][k], my = [680, 664, 706][k], s = [1, 0.8, 0.6][k];
      bgRR(mx - 9 * s, my - 26 * s, 18 * s, 28 * s, 6 * s, "#F8F1E0");
      C.beginPath(); C.ellipse(mx, my - 26 * s, 32 * s, 24 * s, 0, Math.PI, TAU); C.closePath(); C.fillStyle = "#EF4444"; C.fill();
      dot(mx - 12 * s, my - 36 * s, 5 * s, "#FFFFFF"); dot(mx + 10 * s, my - 42 * s, 4 * s, "#FFFFFF"); dot(mx + 18 * s, my - 32 * s, 3.5 * s, "#FFFFFF");
    }
    tufts(9, 90, 500, 716, ["#2F7D3A", "#4EA34F", "#6BBF5E"], 10, 22);
    const fc = ["#FDE047", "#F9A8D4", "#FFFFFF"];
    for (let i = 0; i < 30; i++) dot(r() * W, 520 + r() * 190, 3.5, fc[Math.floor(r() * 3)]);
  };
  BGDYN.floresta = function (t) {
    const r = rng(300);
    for (let i = 0; i < 16; i++) {
      const x = (r() * W + Math.sin(t * 0.6 + i) * 30), y = 100 + ((r() * 600 + t * (8 + r() * 10)) % 560);
      dot(x, y, 2 + r() * 2, "rgba(255,255,200," + (0.35 + 0.35 * Math.sin(t * 2 + i)).toFixed(3) + ")");
    }
    const lc = ["#F59E0B", "#FBBF24", "#EA580C"];
    for (let i = 0; i < 6; i++) {
      const x = ((r() * W + t * 18 + Math.sin(t + i) * 40) % W), y = ((r() * 720 + t * 40) % 740) - 10;
      eli(x, y, 9, 4.5, lc[i % 3], t * 2 + i);
    }
  };

  function cerradoTree(x, y, s, canopy, flowers) {
    C.lineCap = "round";
    C.beginPath(); C.moveTo(x, y); C.bezierCurveTo(x - 24 * s, y - 40 * s, x + 26 * s, y - 70 * s, x - 6 * s, y - 112 * s);
    C.lineWidth = 15 * s; C.strokeStyle = "#6B4423"; C.stroke();
    line(x - 4 * s, y - 80 * s, x + 44 * s, y - 112 * s, 9 * s, "#6B4423");
    eli(x - 8 * s, y - 128 * s, 62 * s, 24 * s, canopy); eli(x + 44 * s, y - 122 * s, 36 * s, 17 * s, canopy);
    eli(x - 30 * s, y - 138 * s, 34 * s, 15 * s, light(canopy, 0.15));
    if (flowers) { const r = rng(Math.floor(x)); for (let i = 0; i < 14; i++) dot(x - 50 * s + r() * 100 * s, y - 138 * s + r() * 24 * s, 3.5 * s, "#FFF3A0"); }
  }
  function palma(x, y, s) {
    C.beginPath(); C.moveTo(x, y); C.quadraticCurveTo(x + 6 * s, y - 100 * s, x - 4 * s, y - 200 * s);
    C.lineWidth = 9 * s; C.strokeStyle = "#8A6A3D"; C.lineCap = "round"; C.stroke();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.34;
      C.beginPath(); C.moveTo(x - 4 * s, y - 200 * s);
      C.quadraticCurveTo(x - 4 * s + Math.cos(a) * 40 * s, y - 200 * s + Math.sin(a) * 50 * s - 20 * s, x - 4 * s + Math.cos(a) * 80 * s, y - 200 * s + Math.sin(a) * 70 * s + 24 * s);
      C.lineWidth = 7 * s; C.strokeStyle = "#4F9A3C"; C.stroke();
    }
  }
  BG.cerrado = function () {
    fr(0, 0, W, 450, lg(0, 0, 0, 450, [0, "#3E9BE6", 0.6, "#A9DBF7", 1, "#FFE9B8"]));
    sunDisc(980, 170, 60, "#FFE08A");
    puff(160, 120, 0.9, "#FFFFFF"); puff(560, 70, 0.7, "#FFFFFF");
    bgPoly([[0, 450], [0, 402], [60, 394], [110, 332], [330, 328], [390, 394], [470, 402], [520, 450]], "#D98F5F");
    bgPoly([[740, 450], [790, 404], [850, 396], [900, 348], [1120, 344], [1180, 396], [1280, 402], [1280, 450]], "#D98F5F");
    fr(110, 328, 220, 8, "#EBB083"); fr(900, 344, 220, 8, "#EBB083");
    for (let x = 130; x < 330; x += 34) fr(x, 336, 6, 60, "rgba(120,60,30,0.18)");
    for (let x = 920; x < 1120; x += 34) fr(x, 352, 6, 50, "rgba(120,60,30,0.18)");
    hills(450, 36, "#C9B27A", 5, 0.005);
    fr(0, 458, W, 262, lg(0, 458, 0, 720, [0, "#E9C871", 1, "#C99A3F"]));
    C.beginPath(); C.moveTo(540, 466); C.lineTo(700, 466); C.bezierCurveTo(740, 560, 1000, 640, 1120, 720); C.lineTo(240, 720); C.bezierCurveTo(430, 640, 500, 560, 540, 466); C.closePath();
    C.fillStyle = "#C4693D"; C.fill();
    tufts(14, 220, 470, 716, ["#B8860B", "#E3B54D", "#9A7B1E", "#F0D27A"], 10, 26);
    for (let k = 0; k < 4; k++) cerradoTree(300 + k * 190, 458 + (k % 2) * 6, 0.45, "#7A9A45", false);
    palma(720, 470, 0.5); palma(790, 466, 0.42);
    cerradoTree(170, 530, 1.3, "#FFD23F", true);
    cerradoTree(1130, 520, 1.2, "#6E8B3D", false);
    bgPoly([[950, 520], [968, 478], [986, 520]], "#B5651D"); bgPoly([[400, 500], [414, 466], [428, 500]], "#B5651D");
  };

  BG.ceu = function () {
    fr(0, 0, W, H, lg(0, 0, 0, H, [0, "#3FA9F5", 1, "#C5E9FF"]));
    fr(0, 0, W, H, rg(160, 90, 10, 560, [0, "rgba(255,245,190,0.75)", 1, "rgba(255,245,190,0)"]));
    dot(160, 90, 48, "#FFE680");
    const cols = ["#FF6B6B", "#FFA94D", "#FFE066", "#8CE99A", "#74C0FC", "#9775FA"];
    for (let i = 0; i < cols.length; i++) {
      C.beginPath(); C.arc(900, 900, 560 - i * 16, Math.PI * 1.12, Math.PI * 1.88);
      C.lineWidth = 16; C.strokeStyle = rgba(cols[i], 0.28); C.lineCap = "butt"; C.stroke();
    }
    puff(980, 560, 1.6, "rgba(255,255,255,0.0)");
    puff(80, 620, 1.5, "#FFFFFF"); puff(380, 680, 1.2, "#F4FAFF"); puff(1060, 650, 1.4, "#FFFFFF");
  };
  BGDYN.ceu = function (t) {
    const cl = [[0, 140, 1.3, 14], [330, 300, 0.9, 9], [700, 90, 1.1, 11], [980, 330, 1.5, 7], [520, 480, 0.8, 12]];
    for (let i = 0; i < cl.length; i++) {
      const x = (((cl[i][0] + t * cl[i][3]) % (W + 440)) + W + 440) % (W + 440) - 260;
      puff(x, cl[i][1], cl[i][2], "#FFFFFF");
    }
  };

  BG.lousa = function () {
    fr(0, 0, W, H, "#B9814A");
    fr(0, 0, W, H, lg(0, 0, W, 0, [0, "rgba(255,255,255,0.08)", 0.5, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.12)"]));
    bgRR(22, 22, 1236, 626, 12, lg(0, 22, 0, 648, [0, "#35705F", 1, "#264C41"]));
    const r = rng(4321);
    for (let i = 0; i < 16; i++) eli(60 + r() * 1160, 50 + r() * 560, 60 + r() * 140, 14 + r() * 26, "rgba(255,255,255," + (0.02 + r() * 0.035).toFixed(3) + ")", r() * 0.6 - 0.3);
    C.strokeStyle = "rgba(255,255,255,0.75)"; C.lineWidth = 4; C.lineCap = "round"; C.lineJoin = "round";
    starPath(96, 100, 26, 11, 5, 0); C.stroke(); starPath(1190, 92, 20, 9, 5, 0.2); C.stroke();
    heartPath(1186, 580, 16); C.stroke();
    C.beginPath(); C.arc(98, 574, 20, 0, TAU);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; C.moveTo(98 + Math.cos(a) * 28, 574 + Math.sin(a) * 28); C.lineTo(98 + Math.cos(a) * 38, 574 + Math.sin(a) * 38); }
    C.stroke();
    C.setLineDash([14, 12]); C.lineWidth = 3; C.strokeStyle = "rgba(255,255,255,0.4)";
    C.beginPath(); C.moveTo(150, 52); C.lineTo(1130, 52); C.stroke(); C.setLineDash([]);
    bgRR(40, 646, 1200, 28, 9, "#A56E3A"); fr(40, 660, 1200, 14, "rgba(0,0,0,0.12)");
    bgRR(120, 636, 38, 11, 4, "#FFFFFF"); bgRR(170, 637, 30, 10, 4, "#FBCFE8"); bgRR(212, 637, 32, 10, 4, "#FDE68A"); bgRR(1000, 628, 70, 20, 6, "#4B5563"); bgRR(1000, 628, 70, 8, 4, "#F59E0B");
    fr(0, 674, W, 46, "#8A5A2C");
  };

  BG.casa = function () {
    fr(0, 0, W, 480, lg(0, 0, 0, 480, [0, "#FFE8D4", 1, "#FFD9BC"]));
    for (let y = 30; y < 440; y += 64) for (let x = (y / 64 % 2) * 32 + 20; x < W; x += 64) dot(x, y, 4, "rgba(255,255,255,0.45)");
    fr(0, 466, W, 14, "#FFFFFF"); fr(0, 480, W, 240, lg(0, 480, 0, 720, [0, "#E0B07A", 1, "#C58F5A"]));
    C.strokeStyle = "rgba(90,50,10,0.14)"; C.lineWidth = 2;
    C.beginPath();
    for (let i = 0; i < 9; i++) { const x = i * 160 - 40; C.moveTo(x + 60, 480); C.lineTo(x - 90 - i * 0, 720); }
    C.stroke();
    eli(640, 640, 440, 66, "rgba(236,114,128,0.55)"); eli(640, 640, 390, 50, "rgba(255,255,255,0.22)");
    // janela
    bgRR(60, 70, 250, 250, 12, "#FFFFFF");
    C.save(); rrPath(74, 84, 222, 222, 6); C.clip();
    fr(74, 84, 222, 222, lg(0, 84, 0, 306, [0, "#7CD0F8", 1, "#DDF4FF"]));
    puff(110, 140, 0.6, "#FFFFFF"); dot(150, 330, 120, "#8ED77C"); dot(280, 340, 100, "#6FC46A");
    C.restore();
    fr(181, 84, 8, 222, "#FFFFFF"); fr(74, 191, 222, 8, "#FFFFFF");
    bgRR(40, 56, 290, 10, 5, "#8B5A2B"); bgRR(40, 66, 60, 270, 16, "#7DD3C0"); bgRR(270, 66, 60, 270, 16, "#7DD3C0");
    // quadros
    bgRR(470, 90, 120, 90, 8, "#B9784A"); bgRR(480, 100, 100, 70, 4, "#FDE68A"); dot(530, 135, 18, "#F59E0B");
    bgRR(620, 70, 90, 120, 8, "#B9784A"); bgRR(630, 80, 70, 100, 4, "#BFDBFE"); bgPoly([[630, 180], [665, 130], [700, 180]], "#34D399");
    bgRR(740, 100, 110, 80, 8, "#B9784A"); bgRR(750, 110, 90, 60, 4, "#FBCFE8"); heartPath(795, 142, 14); C.fillStyle = "#EC4899"; C.fill();
    // sofá
    bgRR(420, 290, 440, 120, 30, "#5BA8E0"); bgRR(380, 340, 80, 130, 24, "#4A94CC"); bgRR(820, 340, 80, 130, 24, "#4A94CC");
    bgRR(450, 350, 190, 90, 18, "#74BBEE"); bgRR(650, 350, 190, 90, 18, "#74BBEE");
    bgRR(400, 440, 480, 30, 12, "#3F86BD");
    bgRR(440, 316, 56, 56, 12, "#FDE68A"); bgRR(780, 316, 56, 56, 12, "#F9A8D4");
    // luminária
    bgRR(980, 380, 90, 90, 8, "#B9784A"); bgRR(1018, 300, 14, 84, 4, "#6B4423");
    C.beginPath(); C.moveTo(990, 304); C.lineTo(1060, 304); C.lineTo(1080, 250); C.lineTo(970, 250); C.closePath(); C.fillStyle = "#FDE68A"; C.fill();
    fr(900, 200, 250, 200, rg(1025, 290, 10, 150, [0, "rgba(255,240,170,0.35)", 1, "rgba(255,240,170,0)"]));
    // planta
    bgRR(1120, 400, 70, 70, 10, "#D97757");
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42; eli(1155 + Math.cos(a) * 36, 396 + Math.sin(a) * 54, 14, 40, "#3FAE5A", a + Math.PI / 2); }
  };

  BG.escola = function () {
    fr(0, 0, W, 480, lg(0, 0, 0, 480, [0, "#74C7F5", 1, "#E2F6FF"]));
    sunDisc(1120, 110, 44, "#FFE066");
    puff(110, 100, 1, "#FFFFFF"); puff(930, 70, 0.7, "#FFFFFF");
    hills(480, 46, "#A6E08F", 41, 0.006);
    fr(0, 486, W, 234, lg(0, 486, 0, 720, [0, "#7ED36B", 1, "#4AA84B"]));
    fr(0, 580, W, 140, "#C8CED8"); fr(0, 576, W, 8, "#E5E7EB");
    fr(0, 650, W, 5, "rgba(255,255,255,0.7)"); fr(640, 584, 5, 136, "rgba(255,255,255,0.7)");
    // prédio
    bgRR(300, 240, 680, 250, 8, "#FFE4A3"); fr(300, 466, 680, 24, "rgba(0,0,0,0.08)");
    bgPoly([[280, 250], [640, 170], [1000, 250]], "#D9534F");
    bgPoly([[320, 246], [640, 186], [960, 246]], "#E4655F");
    bgRR(530, 270, 220, 66, 10, "#FFFFFF"); bgRR(536, 276, 208, 54, 8, "#3B82F6");
    C.font = "bold 40px " + FONT; C.textAlign = "center"; C.textBaseline = "middle"; C.fillStyle = "#FFFFFF"; C.fillText("ESCOLA", 640, 305);
    for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) {
      if (k === 2 || k === 3) { if (row === 1) continue; }
      const x = k < 3 ? 340 + k * 66 : 770 + (k - 3) * 66;
      bgRR(x, 360 + row * 66 - (row ? 0 : 0), 46, 46, 6, "#BEE7FF"); fr(x + 21, 360 + row * 66, 4, 46, "#FFFFFF"); fr(x, 381 + row * 66, 46, 4, "#FFFFFF");
    }
    bgRR(590, 390, 100, 100, 8, "#8B5A2B"); fr(638, 390, 4, 100, "#5B3A1B"); bgRR(580, 372, 120, 14, 6, "#D9534F");
    dot(630, 440, 4, "#FDE047"); dot(650, 440, 4, "#FDE047");
    // bandeira e árvores
    bgRR(1052, 190, 7, 300, 3, "#9CA3AF"); bgPoly([[1059, 196], [1130, 212], [1059, 240]], "#34D399");
    roundTree(150, 540, 1.3, "#3FAE5A"); roundTree(1190, 540, 0.9, "#4CBB63");
    tufts(52, 50, 500, 570, ["#3E9A45", "#5DBE5F"], 8, 16);
  };

  // cache das camadas estáticas de cenário (por cenário e tamanho em pixels)
  const bgCache = new Map();
  function bgLayer(bg, pw, ph) {
    const key = bg + "|" + pw + "x" + ph;
    let cv = bgCache.get(key);
    if (cv) return cv;
    cv = makeCanvas(pw, ph);
    const g = cv && cv.getContext && cv.getContext("2d");
    if (!g) return null;
    const prev = C;
    C = g;
    g.save(); g.scale(pw / W, ph / H);
    try { (BG[bg] || BG.sala)(); } catch (e) { /* cenário parcial */ }
    g.restore();
    C = prev;
    if (bgCache.size >= 16) bgCache.delete(bgCache.keys().next().value);
    bgCache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------------ animação dos atores
  function actorState(a, idx, lt) {
    const m = META[a.type], an = a.anim, px = a.x * W;
    const at = lt - a.delay;
    const st = {
      ox: 0, oy: 0, sx: 1, sy: 1, rot: 0, pivot: 0, alpha: 1, ph: 0, amp: 0, wave: false, jump: 0,
      dir: a.flip ? -1 : 1, sayStart: a.delay + 0.3, sayOn: true, rain: false
    };
    const spin = m.k !== "obj";
    if (an === "sair-direita") {
      st.dir = 1; st.sayStart = 0.3;
      if (at >= 0) {
        const k = at / 1.6;
        if (k >= 1) return null;
        st.ox = ease.inCubic(k) * (W + 260 - px); st.ph = at * 10; st.amp = 1; st.sayOn = false;
        st.oy = -Math.abs(Math.sin(at * 10)) * 4;
      }
    } else if (at < 0) {
      return null;
    } else {
      st.alpha = clamp(at / 0.25, 0, 1);
    }
    switch (an) {
      case "entrar-esquerda":
      case "entrar-direita": {
        const left = an === "entrar-esquerda", k = clamp(at / 1.5, 0, 1), e = ease.outCubic(k);
        const startX = left ? -(160 + 80 * a.scale) : W + 160 + 80 * a.scale;
        st.ox = (startX - px) * (1 - e);
        st.dir = left ? 1 : -1;
        st.amp = k < 1 ? 1 - clamp((k - 0.85) / 0.15, 0, 1) : 0;
        st.ph = at * 10;
        st.oy = -Math.abs(Math.sin(at * 10)) * 4 * st.amp;
        st.rot = Math.sin(at * 10) * 0.05 * st.amp * (m.k === "obj" ? 1 : 0);
        st.sayStart = a.delay + 1.7;
        break;
      }
      case "pular": {
        const ph = (at / 1.1) % 1, up = Math.sin(ph * Math.PI);
        st.oy = -up * 70; st.jump = up;
        const sq = ph < 0.1 ? (0.1 - ph) / 0.1 : ph > 0.9 ? (ph - 0.9) / 0.1 : 0;
        st.sx = 1 + sq * 0.14 - up * 0.04; st.sy = 1 - sq * 0.14 + up * 0.06;
        break;
      }
      case "balancar":
        st.rot = Math.sin(at * 3.2) * 0.14;
        break;
      case "andar": {
        const vx = Math.cos(at * 0.9);
        st.ox = Math.sin(at * 0.9) * 0.07 * W; st.amp = 1; st.ph = at * 9;
        st.dir = (vx >= 0 ? 1 : -1) * (a.flip ? -1 : 1);
        st.oy = -Math.abs(Math.sin(at * 9)) * 3;
        break;
      }
      case "girar":
        if (spin) {
          const c = Math.cos(at * 5);
          st.sx = (c < 0 ? -1 : 1) * Math.max(0.05, Math.abs(c));
          st.oy = -Math.abs(Math.sin(at * 5)) * 12;
        } else {
          st.rot = at * 2.6; st.pivot = m.h / 2;
        }
        break;
      case "aparecer": {
        const k = clamp(at / 0.7, 0, 1), e = Math.max(0.001, ease.outBack(k));
        st.sx = e; st.sy = e; st.alpha = clamp(at / 0.2, 0, 1); st.sayStart = a.delay + 0.9;
        break;
      }
      case "crescer": {
        const k = clamp(at / 2.2, 0, 1), s = 0.12 + 0.88 * ease.outCubic(k);
        st.sx = s; st.sy = s * (1 + (1 - k) * 0.08); st.alpha = clamp(at / 0.2, 0, 1); st.sayStart = a.delay + 2.3;
        break;
      }
      case "flutuar":
        st.oy = -14 - Math.sin(at * 1.7) * 12; st.rot = Math.sin(at * 1.1) * 0.04; st.jump = 0.6;
        break;
      case "falar":
        st.oy = -Math.abs(Math.sin(at * 7)) * 1.6;
        break;
      case "acenar":
        st.wave = true;
        if (m.k !== "person") st.rot = Math.sin(at * 7) * 0.12;
        break;
      case "chover":
        st.rain = true;
        break;
      default:
        break;
    }
    if (m.nf) st.dir = 1;
    // vida própria: respiração suave
    const bp = lt * 2.2 + idx * 1.3;
    st.sy *= 1 + Math.sin(bp) * 0.012; st.sx *= 1 - Math.sin(bp) * 0.006;
    st.oy += Math.sin(bp) * (m.hover ? 5 : 1);
    return st;
  }

  function drawActor(a, idx, st, lt, noGround) {
    const m = META[a.type], px = a.x * W + st.ox, py = a.y * H, sc = a.scale;
    const per = 3 + ((idx * 7 + 3) % 5) * 0.4, bph = (lt + idx * 0.9) % per;
    const blink = bph < 0.16 ? Math.sin(bph / 0.16 * Math.PI) : 0;
    let talk = 0;
    if (a.anim === "falar") talk = 1;
    else if (a.say && st.sayOn && lt >= st.sayStart && lt - st.sayStart < Math.min(8, 1 + a.say.length * 0.07)) talk = 1;
    if (talk) talk = 0.25 + 0.75 * Math.abs(Math.sin(lt * 11 + Math.sin(lt * 3) * 2));
    const p = {
      t: lt, at: lt - a.delay, idx: idx, color: a.color || "", text: a.text || "", ph: st.ph, amp: st.amp, talk: talk,
      wave: st.wave, blink: blink, look: 0.5, anim: a.anim, rain: st.rain && a.type === "nuvem"
    };
    C.save();
    C.globalAlpha = C.globalAlpha * st.alpha;
    if (!noGround && m.sw > 0) {
      const rx = m.sw * sc * Math.abs(st.sx) * (1 - st.jump * 0.4);
      eli(px, py + 2, rx, rx * 0.22, "rgba(0,0,0," + (0.2 * (1 - st.jump * 0.5)).toFixed(3) + ")");
    }
    C.translate(px, py + st.oy);
    if (st.rot) { C.translate(0, -st.pivot * sc); C.rotate(st.rot); C.translate(0, st.pivot * sc); }
    C.scale(st.dir * sc * st.sx, sc * st.sy);
    LW = clamp(4 / Math.sqrt(sc), 1.6, 8);
    try { m.f(p); } catch (e) { /* um ator com defeito não derruba o quadro */ }
    C.restore();
    if (st.rain && a.type !== "nuvem" && a.type !== "chuva") {
      C.save(); C.translate(px, py); LW = 4;
      rainDrops(lt, -60, 60, -m.h * sc - 110, 0, 12, true);
      C.restore();
    }
  }

  // ------------------------------------------------------------------ texto, balões e legendas
  function wrapText(txt, maxW, maxLines) {
    const words = txt.split(" "), lines = [];
    let cur = "";
    for (let wi = 0; wi < words.length; wi++) {
      let wd = words[wi];
      const test = cur ? cur + " " + wd : wd;
      if (C.measureText(test).width <= maxW) { cur = test; continue; }
      if (cur) { lines.push(cur); cur = ""; }
      while (wd.length > 1 && C.measureText(wd).width > maxW) {
        let n = wd.length - 1;
        while (n > 1 && C.measureText(wd.slice(0, n)).width > maxW) n--;
        lines.push(wd.slice(0, n)); wd = wd.slice(n);
      }
      cur = wd;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let l = lines[maxLines - 1];
      while (l.length > 1 && C.measureText(l + "…").width > maxW) l = l.slice(0, -1);
      lines[maxLines - 1] = l.replace(/\s+$/, "") + "…";
    }
    return lines;
  }

  function drawBubble(text, ax, topY, k) {
    const e = ease.outBack(clamp(k, 0, 1));
    if (e < 0.03) return;
    C.save();
    C.font = "bold 28px " + FONT; C.textAlign = "center"; C.textBaseline = "middle";
    const lines = wrapText(text, 380, 4), lh = 34;
    let tw = 0;
    for (let i = 0; i < lines.length; i++) tw = Math.max(tw, C.measureText(lines[i]).width);
    const bw = tw + 44, bh = lines.length * lh + 22;
    const bx = clamp(ax - bw / 2, 16, W - 16 - bw);
    let by = topY - 26 - bh;
    if (by < 14) by = 14;
    const tipY = Math.max(topY - 4, by + bh + 10), tx = clamp(ax, bx + 34, bx + bw - 34);
    C.translate(tx, tipY); C.scale(e, e); C.translate(-tx, -tipY);
    rrPath(bx + 3, by + 5, bw, bh, 22); C.fillStyle = "rgba(0,0,0,0.14)"; C.fill();
    rrPath(bx, by, bw, bh, 22); C.fillStyle = "#FFFFFF"; C.fill();
    C.lineWidth = 3.5; C.strokeStyle = INK; C.lineJoin = "round"; C.stroke();
    C.beginPath(); C.moveTo(tx - 16, by + bh - 1); C.lineTo(clamp(ax, bx + 8, bx + bw - 8), tipY); C.lineTo(tx + 8, by + bh - 1);
    C.fillStyle = "#FFFFFF"; C.fill(); C.stroke();
    C.fillStyle = "#FFFFFF"; C.fillRect(tx - 15, by + bh - 4, 22, 5.5);
    C.fillStyle = INK;
    for (let i = 0; i < lines.length; i++) C.fillText(lines[i], bx + bw / 2, by + 11 + lh * (i + 0.5));
    C.restore();
  }

  function drawTexts(scene, lt) {
    for (let i = 0; i < scene.texts.length; i++) {
      const tx = scene.texts[i], at = lt - Math.min(0.3 + i * 0.6, Math.max(0, scene.duration - 0.6));
      if (at < 0) continue;
      let fs = 64 * tx.size, shown = tx.text, scl = 1, dy = 0, alpha = 1;
      C.save();
      C.font = "bold " + fs + "px " + FONT;
      const mw = C.measureText(tx.text).width;
      if (mw > W * 0.92) { fs = fs * W * 0.92 / mw; C.font = "bold " + fs + "px " + FONT; }
      if (tx.anim === "digitar") {
        shown = tx.text.slice(0, Math.floor(at * 16));
        if (!shown && at < 0.05) { C.restore(); continue; }
      } else if (tx.anim === "pular") {
        alpha = clamp(at / 0.25, 0, 1);
        const ph = (at / 0.9) % 1;
        dy = -Math.abs(Math.sin(ph * Math.PI)) * fs * 0.35;
        scl = 1 + (Math.sin(ph * Math.PI) < 0.15 ? 0.06 : 0);
      } else {
        alpha = clamp(at / 0.3, 0, 1); scl = Math.max(0.001, ease.outBack(clamp(at / 0.6, 0, 1)));
      }
      C.globalAlpha = alpha;
      C.textAlign = "center"; C.textBaseline = "middle"; C.lineJoin = "round";
      const x = tx.x * W, y = tx.y * H + dy;
      C.translate(x, y); C.scale(scl, scl);
      if (tx.anim === "digitar") {
        const full = C.measureText(tx.text).width;
        C.textAlign = "left"; C.translate(-full / 2, 0);
      }
      C.lineWidth = Math.max(4, fs * 0.16); C.strokeStyle = "rgba(0,0,0,0.25)"; C.strokeText(shown, 0, 5);
      C.strokeStyle = INK; C.strokeText(shown, 0, 0);
      C.fillStyle = tx.color; C.fillText(shown, 0, 0);
      if (tx.anim === "digitar" && shown.length < tx.text.length && Math.floor(at * 3) % 2 === 0) {
        const cw = C.measureText(shown).width;
        C.fillStyle = tx.color; C.fillRect(cw + 4, -fs * 0.4, Math.max(3, fs * 0.07), fs * 0.8);
      }
      C.restore();
    }
  }

  function drawCaption(text, lt) {
    const a = clamp(lt / 0.3, 0, 1);
    if (a <= 0) return;
    const sizes = [36, 32, 28, 26];
    let fs = 36, lines = [];
    C.save();
    C.textAlign = "center"; C.textBaseline = "middle";
    for (let i = 0; i < sizes.length; i++) {
      fs = sizes[i]; C.font = "bold " + fs + "px " + FONT;
      lines = wrapText(text, 1130, 99);
      if (lines.length <= 2) break;
    }
    if (lines.length > 2) lines = wrapText(text, 1130, 2);
    let tw = 0;
    for (let i = 0; i < lines.length; i++) tw = Math.max(tw, C.measureText(lines[i]).width);
    const lh = fs * 1.25, bw = Math.min(W - 40, tw + 64), bh = lines.length * lh + 22;
    const bx = (W - bw) / 2, by = H - 26 - bh;
    C.globalAlpha = a;
    rrPath(bx, by, bw, bh, 22); C.fillStyle = "rgba(17,24,39,0.86)"; C.fill();
    C.fillStyle = "#FFFFFF";
    for (let i = 0; i < lines.length; i++) C.fillText(lines[i], W / 2, by + 11 + lh * (i + 0.5));
    C.restore();
  }

  // ------------------------------------------------------------------ quadro completo
  function drawScene(ctx, scene, lt, pw, ph) {
    C = ctx;
    const cv = bgLayer(scene.bg, pw, ph);
    C = ctx;
    if (cv) C.drawImage(cv, 0, 0, W, H);
    else { C.save(); try { (BG[scene.bg] || BG.sala)(); } catch (e) { /* ignora */ } C.restore(); }
    const dyn = BGDYN[scene.bg];
    if (dyn) { C.save(); try { dyn(lt); } catch (e) { /* ignora */ } C.restore(); }
    const noGround = !!NO_GROUND[scene.bg], sts = [], order = [];
    for (let i = 0; i < scene.actors.length; i++) {
      const st = actorState(scene.actors[i], i, lt);
      sts.push(st);
      if (st) order.push(i);
    }
    order.sort((x, y) => (scene.actors[x].y - scene.actors[y].y) || (x - y));
    for (let k = 0; k < order.length; k++) drawActor(scene.actors[order[k]], order[k], sts[order[k]], lt, noGround);
    drawTexts(scene, lt);
    for (let k = 0; k < order.length; k++) {
      const i = order[k], a = scene.actors[i], st = sts[i];
      if (!a.say || !st.sayOn || lt < st.sayStart) continue;
      const m = META[a.type];
      const topY = a.y * H + st.oy - m.h * a.scale * st.sy;
      drawBubble(a.say, a.x * W + st.ox, topY, (lt - st.sayStart) / 0.3);
    }
  }

  let scratch = null;
  function getScratch(pw, ph) {
    if (!scratch || scratch.width !== pw || scratch.height !== ph) scratch = makeCanvas(pw, ph);
    return scratch;
  }

  function renderFrame(ctx, story, t, opts) {
    const vs = prep(story), tm = timing(vs);
    const w = num(opts.width, (ctx.canvas && ctx.canvas.width) || W, 16, 8192);
    const h = num(opts.height, (ctx.canvas && ctx.canvas.height) || Math.round(w * 9 / 16), 16, 8192);
    const sc = Math.min(w / W, h / H), ox = (w - W * sc) / 2, oy = (h - H * sc) / 2;
    let dev = 1;
    try { if (ctx.getTransform) dev = Math.max(0.1, ctx.getTransform().a || 1); } catch (e) { dev = 1; }
    const pw = Math.max(16, Math.round(W * sc * dev)), ph = Math.max(16, Math.round(H * sc * dev));
    ctx.save();
    if (ox > 0.5 || oy > 0.5) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); }
    ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    if (!tm.total) {
      ctx.fillStyle = "#1F2937"; ctx.fillRect(0, 0, W, H);
    } else {
      t = clamp(num(t, 0, 0, 1e9), 0, tm.total);
      const i = sceneAt(tm, t), lt = t - tm.starts[i], cur = vs.scenes[i];
      if (i > 0 && lt < XFADE) {
        const k = ease.inOut(clamp(lt / XFADE, 0, 1));
        drawScene(ctx, vs.scenes[i - 1], tm.durs[i - 1] + lt, pw, ph);
        const layer = getScratch(pw, ph), lc = layer && layer.getContext("2d");
        if (lc) {
          lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 1; lc.clearRect(0, 0, pw, ph);
          lc.save(); lc.scale(pw / W, ph / H);
          drawScene(lc, cur, lt, pw, ph);
          lc.restore();
          C = ctx;
          ctx.save(); ctx.globalAlpha = k; ctx.drawImage(layer, 0, 0, W, H); ctx.restore();
        } else {
          ctx.save(); ctx.globalAlpha = k; drawScene(ctx, cur, lt, pw, ph); ctx.restore();
        }
      } else {
        drawScene(ctx, cur, lt, pw, ph);
      }
      C = ctx;
      if (opts.captions !== false && cur.narration) drawCaption(cur.narration, lt);
    }
    ctx.restore();
  }

  function drawFrame(ctx, story, t, opts) {
    if (!ctx) return;
    try {
      renderFrame(ctx, story, t, opts && typeof opts === "object" ? opts : {});
    } catch (e) {
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; } catch (e2) { /* nada */ }
    }
  }

  // ------------------------------------------------------------------ player
  class Player {
    constructor(canvas, story, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.story = validate(story);
      this.captions = opts.captions !== false;
      this.onScene = typeof opts.onScene === "function" ? opts.onScene : null;
      this.onEnd = typeof opts.onEnd === "function" ? opts.onEnd : null;
      this.onTime = typeof opts.onTime === "function" ? opts.onTime : null;
      this.playing = false;
      this.time = 0;
      this._scene = -1;
      this._last = null;
      this._raf = 0;
      this._dead = false;
      this._tick = this._tick.bind(this);
      this._vis = () => { if (typeof document !== "undefined" && document.hidden) this.pause(); };
      try { if (canvas && canvas.style && !canvas.style.aspectRatio) canvas.style.aspectRatio = "16 / 9"; } catch (e) { /* ignora */ }
      if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", this._vis);
      if (typeof ResizeObserver !== "undefined" && canvas) {
        try { this._ro = new ResizeObserver(() => { if (!this.playing) this.render(); }); this._ro.observe(canvas); } catch (e) { this._ro = null; }
      }
      this.render();
    }
    get duration() { return timing(this.story).total; }
    setStory(story) {
      this.story = validate(story);
      this._scene = -1;
      this.time = clamp(this.time, 0, this.duration);
      this.render();
    }
    _fit() {
      const c = this.canvas;
      let pw = W;
      const cw = c.clientWidth || 0;
      if (cw > 0) {
        const dpr = Math.min(2, (typeof globalThis.devicePixelRatio === "number" && globalThis.devicePixelRatio) || 1);
        pw = clamp(Math.round(cw * dpr), 320, 2560);
      }
      const ph = Math.round(pw * 9 / 16);
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    }
    render() {
      if (this._dead || !this.canvas) return;
      try {
        this._fit();
        const ctx = this.canvas.getContext("2d");
        drawFrame(ctx, this.story, this.time, { captions: this.captions, width: this.canvas.width, height: this.canvas.height });
        const tm = timing(this.story);
        if (tm.total) {
          const i = sceneAt(tm, this.time);
          if (i !== this._scene) {
            this._scene = i;
            if (this.onScene) { try { this.onScene(i, this.story.scenes[i]); } catch (e) { /* ignora */ } }
          }
        }
      } catch (e) { /* nunca quebra a página */ }
    }
    _emitTime() { if (this.onTime) { try { this.onTime(this.time); } catch (e) { /* ignora */ } } }
    _tick(ts) {
      if (!this.playing || this._dead) return;
      if (this._last == null) this._last = ts;
      const dt = clamp((ts - this._last) / 1000, 0, 0.1);
      this._last = ts;
      this.time += dt;
      const total = this.duration;
      if (this.time >= total) {
        this.time = total; this.playing = false; this._raf = 0;
        this.render(); this._emitTime();
        if (this.onEnd) { try { this.onEnd(); } catch (e) { /* ignora */ } }
        return;
      }
      this.render(); this._emitTime();
      this._raf = requestAnimationFrame(this._tick);
    }
    play() {
      if (this._dead) return;
      const total = this.duration;
      if (!total) return;
      if (this.time >= total - 0.001) this.time = 0;
      this.playing = true; this._last = null;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(this._tick);
    }
    pause() {
      this.playing = false;
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
      this._last = null;
    }
    toggle() { if (this.playing) this.pause(); else this.play(); return this.playing; }
    seek(seconds) {
      this.time = clamp(num(seconds, 0, 0, 1e9), 0, this.duration);
      this._last = null;
      this.render(); this._emitTime();
    }
    seekScene(i) {
      const tm = timing(this.story);
      if (!tm.total) return;
      i = clamp(Math.floor(num(i, 0, 0, 1e6)), 0, tm.starts.length - 1);
      this.seek(tm.starts[i]);
    }
    destroy() {
      this.pause();
      this._dead = true;
      if (typeof document !== "undefined" && document.removeEventListener) document.removeEventListener("visibilitychange", this._vis);
      if (this._ro) { try { this._ro.disconnect(); } catch (e) { /* ignora */ } this._ro = null; }
    }
  }

  // ------------------------------------------------------------------ exportação e miniaturas
  function exportWebM(story, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      let rec = null, stream = null, timer = 0, finished = false;
      const fail = (msg) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        try { if (stream) stream.getTracks().forEach((tr) => tr.stop()); } catch (e) { /* ignora */ }
        reject(new Error(msg));
      };
      try {
        if (typeof MediaRecorder === "undefined") {
          throw new Error("Seu navegador não permite gravar vídeo (MediaRecorder). Use uma versão recente do Chrome, Edge ou Firefox.");
        }
        const vs = validate(story), total = timing(vs).total;
        if (!total) throw new Error("A história não tem cenas para exportar.");
        const fps = Math.round(num(opts.fps, 30, 10, 60)), captions = opts.captions !== false;
        const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
        const cv = makeCanvas(W, H);
        if (!cv || !cv.captureStream) throw new Error("Seu navegador não permite capturar o quadro para gravação. Tente o Chrome ou o Edge.");
        const ctx = cv.getContext("2d");
        stream = cv.captureStream(fps);
        const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
        let mime = "";
        for (let i = 0; i < types.length; i++) {
          try { if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; } } catch (e) { /* tenta o próximo */ }
        }
        const ro = { videoBitsPerSecond: 6000000 };
        if (mime) ro.mimeType = mime;
        rec = new MediaRecorder(stream, ro);
        const chunks = [];
        rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        rec.onerror = () => fail("Não foi possível gravar o vídeo. Tente novamente.");
        rec.onstop = () => {
          if (finished) return;
          finished = true;
          try { stream.getTracks().forEach((tr) => tr.stop()); } catch (e) { /* ignora */ }
          const blob = new Blob(chunks, { type: "video/webm" });
          if (!blob.size) { reject(new Error("O vídeo ficou vazio. Mantenha esta aba visível durante a exportação e tente de novo.")); return; }
          resolve(blob);
        };
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        const draw = (t) => drawFrame(ctx, vs, t, { captions: captions, width: W, height: H });
        draw(0);
        rec.start(250);
        const step = () => {
          if (finished) return;
          try {
            const el = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0) / 1000;
            draw(Math.min(el, total));
            if (onProgress) { try { onProgress(Math.min(1, el / total)); } catch (e) { /* ignora */ } }
            if (el >= total + 0.4) { if (rec.state !== "inactive") rec.stop(); return; }
            timer = setTimeout(step, Math.max(4, 1000 / fps));
          } catch (e) { fail("Falha ao renderizar o vídeo."); }
        };
        step();
      } catch (e) {
        fail(e && e.message ? e.message : "Não foi possível exportar o vídeo.");
      }
    });
  }

  // miniatura: meio da cena (adiado até os atores terminarem de entrar, se necessário)
  function thumbnail(story, sceneIndex, w) {
    try {
      const vs = prep(story), tm = timing(vs);
      if (!tm.total) return "";
      w = Math.round(num(w, 320, 32, 1920));
      const h = Math.round(w * 9 / 16);
      const i = clamp(Math.floor(num(sceneIndex, 0, 0, 1e6)), 0, vs.scenes.length - 1);
      const sc = vs.scenes[i];
      let tl = sc.duration / 2;
      for (let k = 0; k < sc.actors.length; k++) {
        const a = sc.actors[k];
        if (a.anim !== "sair-direita") tl = Math.max(tl, Math.min(sc.duration - 0.1, a.delay + 1.8));
      }
      const cv = makeCanvas(w, h);
      const ctx = cv && cv.getContext("2d");
      if (!ctx) return "";
      drawFrame(ctx, vs, tm.starts[i] + tl, { captions: false, width: w, height: h });
      return cv.toDataURL ? cv.toDataURL("image/jpeg", 0.82) : "";
    } catch (e) {
      return "";
    }
  }

  AV.anim = { BACKGROUNDS, ACTORS, ANIMS, validate, duration, drawFrame, Player, exportWebM, thumbnail, TEMPLATES: (AV.anim && AV.anim.TEMPLATES) || [] };
})(globalThis.AV = globalThis.AV || {});

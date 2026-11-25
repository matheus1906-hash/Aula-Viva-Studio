(function (AV) {
  "use strict";
  /**
   * Escudo AulaViva: proteção ativa da página e varredura de arquivos.
   *  - Vigia o DOM o tempo todo: remove <script>, <iframe>, <object>, <embed>, <base>, meta refresh e
   *    atributos on* inseridos por código de fora do app; neutraliza links javascript:/vbscript:/data:text/html.
   *  - Registra violações da CSP e tentativas de trocar funções críticas (fetch, Vault).
   *  - Varre arquivos antes de importar: executáveis disfarçados, macros, PDFs com JavaScript/Launch/arquivos
   *    embutidos, RTF com objetos OLE, modelos externos em Word, bombas de compressão e extensão falsa.
   * A varredura (AV.Shield.scanBuffer) é pura e também roda nos testes em Node.
   */
  const MAX_FILE = 25 * 1024 * 1024;
  const MAX_UNZIPPED = 300 * 1024 * 1024;
  const FRAME_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "archive.org"];
  const BAD_URL = /^\s*(?:javascript|vbscript|data:text\/html|data:application\/(?:x-)?javascript)/i;
  const log = [];
  const listeners = new Set();

  function record(kind, detail) {
    const e = { at: new Date().toISOString(), kind, detail: String(detail || "").slice(0, 200) };
    log.unshift(e); if (log.length > 100) log.pop();
    listeners.forEach((fn) => { try { fn(e); } catch (x) {} });
    return e;
  }

  /* ------------------------------------------------------------ varredura de arquivos */
  const bytesOf = (buf) => (buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const startsWith = (u8, sig) => sig.every((b, i) => u8[i] === b);
  const ascii = (u8, from, len) => { let s = ""; for (let i = from; i < Math.min(u8.length, from + len); i++) s += String.fromCharCode(u8[i]); return s; };

  /** lê o diretório central de um ZIP (docx, pptx, odt) sem descompactar */
  function zipEntries(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return null;
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let n = 0; n < count && p + 46 <= u8.length; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) return null;
      const comp = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
      out.push({ name: ascii(u8, p + 46, nameLen), comp, size });
      p += 46 + nameLen + extra + comment;
    }
    return out;
  }

  const EXECUTABLES = [
    [[0x4d, 0x5a], "programa do Windows (.exe)"], [[0x7f, 0x45, 0x4c, 0x46], "programa do Linux"],
    [[0xcf, 0xfa, 0xed, 0xfe], "programa do macOS"], [[0xfe, 0xed, 0xfa, 0xce], "programa do macOS"], [[0xca, 0xfe, 0xba, 0xbe], "programa Java/macOS"],
    [[0x23, 0x21], "script executável"], [[0xd0, 0xcf, 0x11, 0xe0], "documento Office antigo (pode conter macros)"]
  ];

  /** devolve { ok, reason } — reason em linguagem simples para o professor */
  function scanBuffer(buf, ext, name) {
    const u8 = bytesOf(buf);
    ext = String(ext || "").toLowerCase();
    if (u8.length > MAX_FILE) return { ok: false, reason: "arquivo maior que 25 MB" };
    if (/\.(exe|scr|bat|cmd|com|ps1|vbs|js|jse|wsf|hta|msi|jar|apk|dll|lnk|sh)(\.|$)/i.test(String(name || "").replace(/\.[^.]+$/, ""))) return { ok: false, reason: "nome com extensão dupla de programa (" + name + ")" };
    const exe = EXECUTABLES.find(([sig]) => startsWith(u8, sig));
    if (exe) return { ok: false, reason: "o conteúdo é um " + exe[1] + ", não um ." + ext };
    const head = ascii(u8, 0, 4096).toLowerCase();

    if (["docx", "pptx", "odt"].includes(ext)) {
      if (!startsWith(u8, [0x50, 0x4b, 0x03, 0x04])) return { ok: false, reason: "não é um ." + ext + " de verdade" };
      const entries = zipEntries(u8);
      if (!entries) return { ok: false, reason: "arquivo compactado corrompido" };
      if (entries.length > 5000) return { ok: false, reason: "arquivo com partes demais (possível ataque)" };
      const total = entries.reduce((n, e) => n + e.size, 0);
      if (total > MAX_UNZIPPED || entries.some((e) => e.comp > 0 && e.size / e.comp > 200)) return { ok: false, reason: "bomba de compressão (arquivo que explode ao abrir)" };
      if (entries.some((e) => /vbaproject\.bin$|vbadata\.xml$|\.bin$/i.test(e.name) && !/printerSettings/i.test(e.name))) return { ok: false, reason: "documento com macros" };
      if (entries.some((e) => /activeX|oleObject|embeddings\/.*\.(exe|bat|js|vbs|ps1)/i.test(e.name))) return { ok: false, reason: "documento com objetos ativos embutidos" };
      if (entries.some((e) => /\.\.\/|^\/|\\/.test(e.name))) return { ok: false, reason: "caminhos maliciosos dentro do arquivo" };
      return { ok: true };
    }
    if (ext === "pdf") {
      if (!head.startsWith("%pdf")) return { ok: false, reason: "não é um PDF de verdade" };
      const all = ascii(u8, 0, Math.min(u8.length, 8 * 1024 * 1024));
      if (/\/(?:JavaScript|JS)\b/.test(all)) return { ok: false, reason: "PDF com código JavaScript" };
      if (/\/Launch\b/.test(all)) return { ok: false, reason: "PDF que tenta abrir programas" };
      if (/\/EmbeddedFile\b/.test(all)) return { ok: false, reason: "PDF com arquivos escondidos dentro" };
      if (/\/(?:XFA|RichMedia)\b/.test(all)) return { ok: false, reason: "PDF com conteúdo ativo (XFA/RichMedia)" };
      return { ok: true };
    }
    if (ext === "rtf") {
      if (!head.startsWith("{\\rtf")) return { ok: false, reason: "não é um RTF de verdade" };
      if (/\\objdata|\\objupdate|\\objemb|\\objlink|\\objautlink/i.test(ascii(u8, 0, u8.length))) return { ok: false, reason: "RTF com objeto embutido (técnica comum de ataque)" };
      return { ok: true };
    }
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      const okImg = (ext === "png" && startsWith(u8, [0x89, 0x50, 0x4e, 0x47])) || ((ext === "jpg" || ext === "jpeg") && startsWith(u8, [0xff, 0xd8, 0xff])) ||
        (ext === "gif" && head.startsWith("gif8")) || (ext === "webp" && head.startsWith("riff") && ascii(u8, 8, 4) === "WEBP");
      return okImg ? { ok: true } : { ok: false, reason: "a imagem não é do tipo que diz ser" };
    }
    if (["txt", "md", "srt", "vtt", "json"].includes(ext)) {
      if (/<script[\s>]|<iframe[\s>]|javascript:/i.test(ascii(u8, 0, Math.min(u8.length, 2 * 1024 * 1024)))) return { ok: false, reason: "texto com código de página web embutido" };
      return { ok: true };
    }
    return { ok: false, reason: "tipo de arquivo não permitido" };
  }

  /* ------------------------------------------------------------ vigia da página */
  function isTrustedScript(node) { return node.dataset && node.dataset.avTrusted === "1"; }
  function frameAllowed(node) { try { const u = new URL(node.getAttribute("src") || "", location.href); return u.protocol === "https:" && FRAME_HOSTS.includes(u.hostname); } catch (e) { return false; } }

  function inspect(node) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === "SCRIPT" && !isTrustedScript(node)) { node.remove(); record("bloqueio", "script injetado removido"); return; }
    if ((tag === "IFRAME" || tag === "FRAME") && !frameAllowed(node)) { node.remove(); record("bloqueio", "quadro externo não autorizado removido: " + (node.getAttribute("src") || "")); return; }
    if (tag === "OBJECT" || tag === "EMBED" || tag === "APPLET" || tag === "BASE" || (tag === "META" && /refresh/i.test(node.getAttribute("http-equiv") || ""))) { node.remove(); record("bloqueio", "elemento perigoso removido: " + tag.toLowerCase()); return; }
    if (tag === "FORM" && node.getAttribute("action") && !/^\s*#?$/.test(node.getAttribute("action"))) { node.remove(); record("bloqueio", "formulário externo removido"); return; }
    for (const a of Array.from(node.attributes || [])) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on")) { node.removeAttribute(a.name); record("bloqueio", "atributo de evento injetado removido: " + n); }
      else if ((n === "href" || n === "src" || n === "action" || n === "formaction" || n === "xlink:href") && BAD_URL.test(a.value)) { node.removeAttribute(a.name); record("bloqueio", "link perigoso neutralizado (" + n + ")"); }
      else if (n === "srcdoc") { node.removeAttribute(a.name); record("bloqueio", "conteúdo embutido em quadro removido"); }
    }
    if (node.children && node.children.length) for (const c of Array.from(node.children)) inspect(c);
  }

  function startGuard() {
    if (typeof document === "undefined" || startGuard.on) return;
    startGuard.on = true;
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "childList") m.addedNodes.forEach(inspect);
        else if (m.type === "attributes") inspect(m.target);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "src", "action", "formaction", "srcdoc", "onclick", "onerror", "onload", "onmouseover", "onfocus", "onanimationstart"] });
    document.addEventListener("securitypolicyviolation", (e) => record("csp", "bloqueado pela política de segurança: " + (e.blockedURI || e.violatedDirective)));
    const nativeFetch = window.fetch;
    setInterval(() => {
      if (window.fetch !== nativeFetch && !/native code/.test(Function.prototype.toString.call(window.fetch))) record("alerta", "a função de rede foi alterada por outro código");
      if (top !== self) record("alerta", "a página foi aberta dentro de outro site");
    }, 15000);
    record("info", "Escudo ativo");
  }

  /* ------------------------------------------------------------ verificação geral */
  function selfCheck() {
    const items = [];
    const push = (ok, label) => items.push({ ok, label });
    if (typeof document !== "undefined") {
      push(location.protocol === "https:" || location.protocol === "file:", "Conexão segura (HTTPS)");
      push(!!document.querySelector('meta[http-equiv="Content-Security-Policy"]') || location.protocol === "https:", "Política de segurança de conteúdo (CSP) ativa");
      push(top === self, "Página não está dentro de outro site");
      push(!!(window.crypto && crypto.subtle), "Criptografia do navegador disponível");
      push(!AV.Vault || AV.Vault.unlocked(), "Dados guardados no cofre criptografado");
    }
    push(startGuard.on === true, "Vigia da página em funcionamento");
    return items;
  }

  AV.Shield = {
    scanBuffer,
    zipEntries,
    start: startGuard,
    selfCheck,
    events: () => log.slice(),
    blockedCount: () => log.filter((e) => e.kind === "bloqueio" || e.kind === "csp").length,
    onEvent: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    record
  };
  if (typeof document !== "undefined") startGuard();
})(globalThis.AV = globalThis.AV || {});

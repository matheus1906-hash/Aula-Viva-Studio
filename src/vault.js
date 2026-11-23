(function (AV) {
  "use strict";
  /* Cofre local: tudo o que o app guarda (materiais, conversas, fontes, chaves de IA, perfil)
     fica cifrado com AES-256-GCM. A chave de dados (DK) é aleatória e só é aberta com a senha
     (PBKDF2-SHA-256, 600 mil iterações) ou com o código de recuperação. Nada é enviado a servidores. */
  if (!AV.STANDALONE || !window.crypto || !crypto.subtle) return;
  const C = crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
  const ITER = 600000, PLAIN = new Set(["ui", "vaultmeta", "lockout"]);
  const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
  const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const raw = { get: (k) => { try { return localStorage.getItem("av:" + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem("av:" + k, v); return true; } catch (e) { return false; } }, del: (k) => { try { localStorage.removeItem("av:" + k); } catch (e) {} } };
  const rjson = (k, d) => { try { const v = raw.get(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };

  async function kek(secret, salt) {
    const base = await C.importKey("raw", enc.encode(secret.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
    return C.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function seal(key, bytes) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await C.encrypt({ name: "AES-GCM", iv }, key, bytes); return b64(iv) + "." + b64(ct); }
  async function open(key, s) { const [iv, ct] = s.split("."); return new Uint8Array(await C.decrypt({ name: "AES-GCM", iv: ub64(iv) }, key, ub64(ct))); }
  const newRecovery = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(24)); return [...r].map((x) => a[x % a.length]).join("").match(/.{4}/g).join("-"); };

  const V = { dk: null, dkRaw: null, cache: new Map(), guest: false, pending: new Map(), timer: null };
  AV.Vault = V;
  V.exists = () => !!rjson("vaultmeta", null);
  V.unlocked = () => !!V.dk || V.guest;
  /* --- LS transparente: lê/escreve no cofre em memória e grava cifrado em segundo plano --- */
  const plainLS = AV.LS;
  AV.LS = {
    get(k, d) {
      if (PLAIN.has(k)) return plainLS.get(k, d);
      if (k === "profile") { const p = V.cache.has("profile") ? V.cache.get("profile") : {}; const legacy = rjson("profile", {}) || {}; return Object.assign({}, d || {}, JSON.parse(JSON.stringify({ lang: legacy.lang, theme: legacy.theme })), p, rjson("ui", {})); }
      return V.cache.has(k) ? JSON.parse(JSON.stringify(V.cache.get(k))) : d;
    },
    set(k, v) {
      if (PLAIN.has(k)) return plainLS.set(k, v);
      if (k === "profile") { const ui = Object.assign(rjson("ui", {}), { lang: v.lang, theme: v.theme }); raw.set("ui", JSON.stringify(ui)); }
      V.cache.set(k, JSON.parse(JSON.stringify(v)));
      if (V.dk) { V.pending.set(k, true); clearTimeout(V.timer); V.timer = setTimeout(V.flush, 250); }
      return true;
    },
    del(k) { if (PLAIN.has(k)) return plainLS.del(k); V.cache.delete(k); raw.del("v:" + k); V.pending.delete(k); }
  };
  V.flush = async function () {
    if (!V.dk) return;
    const keys = [...V.pending.keys()]; V.pending.clear();
    for (const k of keys) {
      if (!V.cache.has(k)) { raw.del("v:" + k); continue; }
      const s = await seal(V.dk, enc.encode(JSON.stringify(V.cache.get(k))));
      if (!raw.set("v:" + k, s)) AV.toast && AV.toast("Espaço do navegador cheio: exporte um backup e apague materiais antigos.", 6000);
    }
  };
  addEventListener("pagehide", () => { V.flush(); });

  async function loadAll() {
    V.cache.clear();
    const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("av:v:")) ks.push(k.slice(5)); }
    for (const k of ks) { try { V.cache.set(k, JSON.parse(dec.decode(await open(V.dk, raw.get("v:" + k))))); } catch (e) { /* entrada corrompida: ignora */ } }
  }
  async function useDK(dkRaw) { V.dkRaw = dkRaw; V.dk = await C.importKey("raw", dkRaw, "AES-GCM", false, ["encrypt", "decrypt"]); await loadAll(); }

  /* --- conta --- */
  V.create = async function (password, name) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), rsalt = crypto.getRandomValues(new Uint8Array(16));
    const dkRaw = crypto.getRandomValues(new Uint8Array(32)), rec = newRecovery();
    const meta = { v: 1, iter: ITER, salt: b64(salt), rsalt: b64(rsalt), wrapPw: await seal(await kek(password, salt), dkRaw), wrapRec: await seal(await kek(rec, rsalt), dkRaw), created: Date.now() };
    await useDK(dkRaw);
    // migra dados antigos em texto puro para dentro do cofre
    const old = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("av:") && !k.startsWith("av:v:")) old.push(k.slice(3)); }
    old.filter((k) => !PLAIN.has(k)).forEach((k) => { const v = rjson(k, null); if (v != null) { AV.LS.set(k, v); } raw.del(k); });
    AV.LS.set("profile", Object.assign({}, AV.LS.get("profile", {}), { name: name || "" }));
    raw.set("vaultmeta", JSON.stringify(meta)); await V.flush();
    return rec;
  };
  function lockout() { const l = rjson("lockout", { fails: 0, until: 0 }); return l; }
  V.waitMs = () => Math.max(0, lockout().until - Date.now());
  function fail() { const l = lockout(); l.fails++; if (l.fails >= 5) l.until = Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (l.fails - 5)); raw.set("lockout", JSON.stringify(l)); }
  V.unlock = async function (password) {
    if (V.waitMs()) throw Object.assign(new Error("wait"), { code: "wait" });
    const m = rjson("vaultmeta", null); if (!m) throw new Error("noaccount");
    try { await useDK(await open(await kek(password, ub64(m.salt)), m.wrapPw)); }
    catch (e) { fail(); throw Object.assign(new Error("bad"), { code: "bad" }); }
    raw.set("lockout", JSON.stringify({ fails: 0, until: 0 }));
  };
  V.recover = async function (code, newPassword) {
    if (V.waitMs()) throw Object.assign(new Error("wait"), { code: "wait" });
    const m = rjson("vaultmeta", null);
    let dkRaw; try { dkRaw = await open(await kek(code.trim().toUpperCase(), ub64(m.rsalt)), m.wrapRec); } catch (e) { fail(); throw Object.assign(new Error("bad"), { code: "bad" }); }
    const salt = crypto.getRandomValues(new Uint8Array(16)); m.salt = b64(salt); m.wrapPw = await seal(await kek(newPassword, salt), dkRaw);
    raw.set("vaultmeta", JSON.stringify(m)); raw.set("lockout", JSON.stringify({ fails: 0, until: 0 })); await useDK(dkRaw);
  };
  V.changePassword = async function (current, next) {
    const m = rjson("vaultmeta", null);
    const dkRaw = await open(await kek(current, ub64(m.salt)), m.wrapPw).catch(() => { throw Object.assign(new Error("bad"), { code: "bad" }); });
    const salt = crypto.getRandomValues(new Uint8Array(16)); m.salt = b64(salt); m.wrapPw = await seal(await kek(next, salt), dkRaw);
    raw.set("vaultmeta", JSON.stringify(m)); await V.forget();
  };
  V.newRecoveryCode = async function () {
    const m = rjson("vaultmeta", null), rec = newRecovery(), rsalt = crypto.getRandomValues(new Uint8Array(16));
    m.rsalt = b64(rsalt); m.wrapRec = await seal(await kek(rec, rsalt), V.dkRaw); raw.set("vaultmeta", JSON.stringify(m)); return rec;
  };
  /* visitante: só memória. Dados antigos em texto puro (de antes do cofre) aparecem, mas nada novo é gravado. */
  V.guestMode = () => { V.guest = true; V.cache.clear(); for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("av:") && !k.startsWith("av:v:") && !PLAIN.has(k.slice(3))) { const v = rjson(k.slice(3), null); if (v != null) V.cache.set(k.slice(3), v); } } };
  V.lock = async function () { await V.flush(); V.dk = null; V.dkRaw = null; V.cache.clear(); location.reload(); };
  V.destroy = async function () { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("av:")) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); await V.forget(); location.reload(); };

  /* --- "manter conectado neste aparelho": guarda uma cópia NÃO exportável da chave no IndexedDB --- */
  const idb = () => new Promise((ok, no) => { const r = indexedDB.open("aulaviva", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const tx = (mode, fn) => idb().then((db) => new Promise((ok, no) => { const t = db.transaction("k", mode), s = t.objectStore("k"), q = fn(s); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }));
  V.remember = async function (days) {
    const wrapKey = await C.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const blob = await seal(wrapKey, V.dkRaw);
    await tx("readwrite", (s) => s.put({ wrapKey, blob, until: Date.now() + days * 864e5 }, "session"));
  };
  V.resume = async function () {
    try {
      const rec = await tx("readonly", (s) => s.get("session"));
      if (!rec || rec.until < Date.now() || !V.exists()) { await V.forget(); return false; }
      await useDK(await open(rec.wrapKey, rec.blob)); return true;
    } catch (e) { return false; }
  };
  V.forget = async function () { try { await tx("readwrite", (s) => s.delete("session")); } catch (e) {} };
  V.remembered = async function () { try { const r = await tx("readonly", (s) => s.get("session")); return !!(r && r.until > Date.now()); } catch (e) { return false; } };

  /* força da senha: 0 a 4 */
  const COMMON = /^(123456|12345678|123456789|password|senha|senha123|qwerty|abc123|111111|000000|iloveyou|admin|aulaviva|professor|brasil)/i;
  V.strength = function (p) {
    if (!p) return 0; let s = 0;
    if (p.length >= 8) s++; if (p.length >= 12) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    if (COMMON.test(p) || /^(.)\1+$/.test(p)) s = 0;
    return Math.min(4, s);
  };
})(globalThis.AV = globalThis.AV || {});

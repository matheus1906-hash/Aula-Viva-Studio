/**
 * Proteções compartilhadas pelas funções do Vercel (arquivos com "_" não viram rota).
 * Origem permitida, cabeçalhos de segurança, respostas JSON, IP do cliente e limites de uso.
 */
"use strict";

const DEFAULT_ORIGINS = ["https://aulavivastudio.vercel.app", "https://matheus1906-hash.github.io"];

function isOriginAllowed(origin, host) {
  if (!origin || origin === "null") return true; // mesma origem, arquivo aberto do computador ou servidor (todos sob limite)
  const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (DEFAULT_ORIGINS.concat(extra).includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return false;
    if (host && u.host === host) return true;
    return /^aulavivastudio[a-z0-9-]*\.vercel\.app$/.test(u.host);
  } catch (e) {
    return false;
  }
}

function setSecurityHeaders(res, origin, allowed) {
  if (allowed && origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

const clientIp = (req) => String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "?").split(",")[0].trim();
const bearer = (req) => { const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(String(req.headers.authorization || "")); return m ? m[1] : ""; };

/** limitador por chave com várias janelas: [[ms, max], ...] */
function rateLimiter(windows) {
  const hits = new Map();
  const longest = Math.max(...windows.map(([ms]) => ms));
  return function take(key) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < longest);
    if (windows.some(([ms, max]) => recent.filter((t) => now - t < ms).length >= max)) { hits.set(key, recent); return false; }
    recent.push(now); hits.set(key, recent);
    if (hits.size > 10000) hits.delete(hits.keys().next().value);
    return true;
  };
}

/** prepara a resposta: cabeçalhos, OPTIONS e origem; devolve false se já respondeu */
function guard(req, res) {
  const origin = req.headers.origin || "";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const allowed = isOriginAllowed(origin, host);
  setSecurityHeaders(res, origin, allowed);
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return false; }
  if (!allowed) { sendJson(res, 403, { error: "forbidden", message: "Origem não permitida." }); return false; }
  return true;
}

function readJsonBody(req, maxChars) {
  let body = req.body;
  if (typeof body === "string") {
    if (body.length > maxChars) throw Object.assign(new Error("Pedido grande demais."), { status: 413 });
    try { body = JSON.parse(body); } catch (e) { throw Object.assign(new Error("Pedido inválido."), { status: 400 }); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw Object.assign(new Error("Pedido inválido."), { status: 400 });
  if (JSON.stringify(body).length > maxChars) throw Object.assign(new Error("Pedido grande demais."), { status: 413 });
  return body;
}

module.exports = { isOriginAllowed, setSecurityHeaders, sendJson, clientIp, bearer, rateLimiter, guard, readJsonBody };

/**
 * IA interna do AulaViva Studio (função serverless do Vercel).
 *
 * As chaves das IAs gratuitas ficam SÓ nas variáveis de ambiente do Vercel:
 *   GROQ_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, OLLAMA_API_KEY
 * Nunca coloque chaves no código: o repositório e o site são públicos.
 * Sem nenhuma chave, o motor "reserva" (gratuito, sem chave) mantém a IA funcionando.
 *
 * POST /api/ia  { engine, messages:[{role,content}], system?, json?, stream?, exclude?:[engine] }
 *   stream=true  -> text/event-stream no formato da OpenAI: data: {"choices":[{"delta":{"content":"..."}}]}
 *   stream=false -> { text, engine, model }
 * GET  /api/ia  -> { ok, engines:[...] }  (quais motores estão ligados, sem revelar chaves)
 *
 * Camadas de proteção: origem permitida, só JSON, tamanho máximo do pedido, limite por pessoa
 * (janela de 10 min e diária), limite de pedidos simultâneos, limite diário global opcional,
 * tempo máximo por motor e total, cabeçalhos de segurança e nenhuma chave ou erro interno devolvido.
 */
"use strict";

/* ------------------------------------------------------------------ configuração */

const ENGINES = {
  groq: { key: "GROQ_API_KEY", url: "https://api.groq.com/openai/v1/chat/completions", models: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"], jsonMode: true },
  mistral: { key: "MISTRAL_API_KEY", url: "https://api.mistral.ai/v1/chat/completions", models: ["mistral-small-latest", "open-mistral-nemo"], jsonMode: true },
  openrouter: { key: "OPENROUTER_API_KEY", url: "https://openrouter.ai/api/v1/chat/completions", models: ["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free", "mistralai/mistral-small-3.2-24b-instruct:free"], jsonMode: false },
  ollama: { key: "OLLAMA_API_KEY", url: "https://ollama.com/api/chat", models: ["gpt-oss:120b", "gpt-oss:20b"], jsonMode: true, native: true },
  reserva: { keyless: true, url: "https://text.pollinations.ai/openai", models: ["openai", "mistral"], jsonMode: false }
};
const AUTO_ORDER = ["groq", "mistral", "openrouter", "ollama", "reserva"];

const LIMITS = {
  maxBodyChars: 200000,
  maxMessages: 40,
  maxMessageChars: 60000,
  maxTotalChars: 120000,
  maxSystemChars: 12000,
  maxOutputTokens: 8000,
  perIp10Min: +process.env.IA_LIMIT_10MIN || 40,
  perIpDay: +process.env.IA_LIMIT_DAY || 400,
  globalDay: +process.env.IA_LIMIT_GLOBAL_DAY || 0, // 0 = sem limite global
  concurrentPerIp: 4,
  firstTokenMs: +process.env.IA_FIRST_TOKEN_MS || 25000, // motor que não começa a responder: tenta o próximo
  idleMs: 30000, // motor que para no meio: encerra
  totalMs: +process.env.IA_TOTAL_MS || 280000 // abaixo do maxDuration do vercel.json
};

const DEFAULT_ORIGINS = ["https://aulavivastudio.vercel.app", "https://matheus1906-hash.github.io"];

/* ------------------------------------------------------------------ utilidades */

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

function isOriginAllowed(origin, host) {
  if (!origin || origin === "null") return true; // mesma origem, arquivo aberto do computador ou servidor (todos sob o limite de uso)
  const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (DEFAULT_ORIGINS.concat(extra).includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return false;
    if (host && u.host === host) return true; // o próprio domínio do deploy
    return /^aulavivastudio[a-z0-9-]*\.vercel\.app$/.test(u.host); // prévias do Vercel deste projeto
  } catch (e) {
    return false;
  }
}

const enabledEngines = () => Object.keys(ENGINES).filter((id) => ENGINES[id].keyless || !!process.env[ENGINES[id].key]);
const stripControl = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

/* ------------------------------------------------------------------ limites de uso */

const hitsByIp = new Map();
const activeByIp = new Map();
const globalDay = { day: "", count: 0 };

function takeQuota(ip) {
  const now = Date.now();
  const recent = (hitsByIp.get(ip) || []).filter((t) => now - t < 864e5);
  if (recent.filter((t) => now - t < 6e5).length >= LIMITS.perIp10Min || recent.length >= LIMITS.perIpDay) {
    hitsByIp.set(ip, recent);
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (globalDay.day !== today) Object.assign(globalDay, { day: today, count: 0 });
  if (LIMITS.globalDay && globalDay.count >= LIMITS.globalDay) return false;
  globalDay.count++;
  recent.push(now);
  hitsByIp.set(ip, recent);
  if (hitsByIp.size > 5000) hitsByIp.delete(hitsByIp.keys().next().value);
  return true;
}
function enter(ip) {
  const n = activeByIp.get(ip) || 0;
  if (n >= LIMITS.concurrentPerIp) return false;
  activeByIp.set(ip, n + 1);
  return true;
}
function leave(ip) {
  const n = (activeByIp.get(ip) || 1) - 1;
  if (n <= 0) activeByIp.delete(ip); else activeByIp.set(ip, n);
}

/* ------------------------------------------------------------------ pedido */

function parseRequest(raw) {
  let body = raw;
  if (typeof body === "string") {
    if (body.length > LIMITS.maxBodyChars) throw fail(413, "Pedido grande demais.");
    try { body = JSON.parse(body); } catch (e) { throw fail(400, "Pedido inválido."); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail(400, "Pedido inválido.");
  if (JSON.stringify(body).length > LIMITS.maxBodyChars) throw fail(413, "Pedido grande demais.");
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-LIMITS.maxMessages)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: stripControl(m.content).slice(0, LIMITS.maxMessageChars) }));
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (!messages.length || total > LIMITS.maxTotalChars) throw fail(400, "Pedido inválido.");
  return {
    engine: ENGINES[body.engine] || body.engine === "auto" ? String(body.engine) : "auto",
    exclude: Array.isArray(body.exclude) ? body.exclude.filter((x) => ENGINES[x]) : [],
    messages,
    system: typeof body.system === "string" ? stripControl(body.system).slice(0, LIMITS.maxSystemChars) : "",
    json: body.json === true,
    stream: body.stream !== false
  };
}

/** ordem de tentativa: o motor escolhido primeiro, depois os demais; os excluídos vão para o fim */
function engineOrder(req) {
  const on = enabledEngines();
  const first = req.engine !== "auto" ? [req.engine] : [];
  const order = [...new Set(first.concat(AUTO_ORDER))].filter((id) => on.includes(id));
  return order.filter((id) => !req.exclude.includes(id)).concat(order.filter((id) => req.exclude.includes(id)));
}

/* ------------------------------------------------------------------ motores */

function upstreamRequest(id, model, req) {
  const e = ENGINES[id];
  const messages = (req.system ? [{ role: "system", content: req.system }] : []).concat(req.messages);
  const headers = { "content-type": "application/json" };
  if (!e.keyless) headers.authorization = "Bearer " + process.env[e.key];
  if (id === "openrouter") Object.assign(headers, { "X-Title": "AulaViva Studio", "HTTP-Referer": "https://aulavivastudio.vercel.app" });
  let payload;
  if (e.native) {
    payload = { model, messages, stream: true, options: { temperature: 0.7, num_predict: LIMITS.maxOutputTokens } };
    if (req.json) payload.format = "json";
  } else {
    payload = { model, messages, temperature: 0.7, stream: true };
    if (!e.keyless) payload.max_tokens = LIMITS.maxOutputTokens;
    if (req.json && e.jsonMode) payload.response_format = { type: "json_object" };
    if (e.keyless) payload.referrer = "aulavivastudio";
  }
  return { url: e.url, headers, payload };
}

/** abre o stream de um motor, tentando os modelos dele em ordem; lança erro com status se nenhum servir */
async function openEngine(id, req, signal) {
  let last = fail(502, "falhou");
  for (const model of ENGINES[id].models) {
    const r = upstreamRequest(id, model, req);
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await fetch(r.url, { method: "POST", headers: r.headers, body: JSON.stringify(r.payload), signal });
      } catch (e) {
        if (signal.aborted) throw e;
        last = fail(502, "rede");
        break;
      }
      if (res.ok && res.body) return { res, id, model, native: !!ENGINES[id].native };
      last = fail(res.status, "motor respondeu " + res.status);
      await res.body?.cancel().catch(() => {});
      if (res.status === 400 && r.payload.response_format && attempt === 0) { delete r.payload.response_format; continue; } // modelo sem modo JSON
      break;
    }
    if (![400, 404, 413, 422].includes(last.status)) break; // limite, chave ou servidor fora: próximo motor
  }
  throw last;
}

/** extrai o texto de uma linha do stream; devolve { text, done } */
function parseLine(line, native) {
  if (native) {
    const j = JSON.parse(line);
    return { text: (j.message && j.message.content) || "", done: !!j.done };
  }
  if (!line.startsWith("data:")) return { text: "", done: false };
  const data = line.slice(5).trim();
  if (data === "[DONE]") return { text: "", done: true };
  const j = JSON.parse(data);
  const choice = (j.choices || [])[0] || {};
  return { text: (choice.delta && choice.delta.content) || "", done: !!choice.finish_reason && choice.finish_reason !== null };
}

/**
 * lê o stream do motor chamando onText(delta).
 * Para ao ver o sinal de fim (sem esperar a conexão fechar), se o motor não começar a responder
 * em firstTokenMs, se parar por idleMs ou se o tempo total acabar. Devolve quantos caracteres saíram.
 */
async function pump(opened, onText, deadline) {
  const reader = opened.res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", sent = 0, finished = false;
  const startedAt = Date.now();
  try {
    while (!finished) {
      const limit = sent ? LIMITS.idleMs : LIMITS.firstTokenMs - (Date.now() - startedAt);
      const wait = Math.max(1, Math.min(limit, deadline - Date.now()));
      let timer;
      const chunk = await Promise.race([reader.read(), new Promise((ok) => { timer = setTimeout(() => ok({ timeout: true }), wait); })]);
      clearTimeout(timer);
      if (chunk.timeout || chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const { text, done } = parseLine(line, opened.native);
          if (text) { sent += text.length; onText(text); }
          if (done) { finished = true; break; }
        } catch (e) { /* linha parcial ou comentário */ }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return sent;
}

/** tenta os motores em ordem até um deles produzir texto */
async function generate(req, onStart, onText, signal) {
  const deadline = Date.now() + LIMITS.totalMs;
  let lastError = fail(502, "upstream");
  for (const id of engineOrder(req)) {
    if (Date.now() > deadline - 3000 || signal.aborted) break;
    const engineAbort = new AbortController();
    const relay = () => engineAbort.abort();
    signal.addEventListener("abort", relay, { once: true });
    try {
      const opened = await openEngine(id, req, engineAbort.signal);
      onStart(opened);
      const sent = await pump(opened, onText, deadline);
      if (sent > 0) return opened;
      lastError = fail(504, "motor sem resposta");
    } catch (e) {
      if (signal.aborted) throw e;
      lastError = e;
    } finally {
      engineAbort.abort();
      signal.removeEventListener("abort", relay);
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ resposta HTTP */

function setSecurityHeaders(res, origin, allowed) {
  if (allowed && origin) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
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
const friendly = (status) =>
  status === 429 ? { error: "rate_limited", message: "As IAs gratuitas estão no limite agora. Tente de novo em alguns minutos." }
    : status === 503 ? { error: "no_engine", message: "A IA está em manutenção. Tente de novo em instantes." }
      : { error: "upstream", message: "Não foi possível falar com a IA agora. Tente de novo." };

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const allowed = isOriginAllowed(origin, host);
  setSecurityHeaders(res, origin, allowed);

  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (!allowed) return sendJson(res, 403, { error: "forbidden", message: "Origem não permitida." });
  if (req.method === "GET") { const on = enabledEngines(); return sendJson(res, 200, { ok: on.length > 0, engines: on }); }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST, OPTIONS"); return sendJson(res, 405, { error: "method" }); }
  if (!/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) return sendJson(res, 415, { error: "content_type", message: "Envie JSON." });

  const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "?").split(",")[0].trim();
  let parsed;
  try { parsed = parseRequest(req.body); } catch (e) { return sendJson(res, e.status || 400, { error: "bad_request", message: e.message }); }
  if (!takeQuota(ip)) return sendJson(res, 429, { error: "rate_limited", message: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo." });
  if (!enter(ip)) return sendJson(res, 429, { error: "rate_limited", message: "Aguarde o pedido anterior terminar." });

  const abort = new AbortController();
  if (req.on) req.on("close", () => { if (!res.writableEnded) abort.abort(); });
  try {
    if (!enabledEngines().length) return sendJson(res, 503, friendly(503));
    if (parsed.stream) return await streamResponse(res, parsed, abort.signal);
    let text = "";
    const used = await generate(parsed, () => {}, (t) => { text += t; }, abort.signal);
    return sendJson(res, 200, { text, engine: used.id, model: used.model });
  } catch (e) {
    if (res.headersSent) return res.end();
    return sendJson(res, e.status === 429 ? 429 : 502, friendly(e.status === 429 ? 429 : 502));
  } finally {
    leave(ip);
  }
};

async function streamResponse(res, req, signal) {
  const write = (obj) => res.write("data: " + JSON.stringify(obj) + "\n\n");
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
  };
  try {
    await generate(req, (opened) => { start(); write({ engine: opened.id, model: opened.model, choices: [{ delta: { content: "" } }] }); }, (t) => write({ choices: [{ delta: { content: t } }] }), signal);
  } catch (e) {
    if (!started) throw e;
    write({ error: friendly(e.status === 429 ? 429 : 502) });
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

/* exportados para os testes */
module.exports.ENGINES = ENGINES;
module.exports.LIMITS = LIMITS;
module.exports.isOriginAllowed = isOriginAllowed;
module.exports.parseRequest = parseRequest;
module.exports.engineOrder = engineOrder;

/* IA interna do AulaViva Studio (função do Vercel).
   As chaves das IAs gratuitas ficam SÓ nas variáveis de ambiente do Vercel:
     GROQ_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, OLLAMA_API_KEY
   Nunca coloque chaves no código: o repositório e o site são públicos.
   Sem nenhuma chave, o motor "reserva" (gratuito, sem chave) mantém a IA funcionando.
   POST /api/ia  { engine, messages:[{role,content}], system?, json?, stream? }
     stream=true  -> text/event-stream no formato da OpenAI (data: {"choices":[{"delta":{"content":"..."}}]})
     stream=false -> { text, engine }
   GET /api/ia    -> { ok, engines:[...] } (quais motores estão ligados, sem revelar chaves) */
"use strict";

const ENGINES = {
  groq: { name: "Groq", key: "GROQ_API_KEY", base: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"], json: true },
  mistral: { name: "Mistral", key: "MISTRAL_API_KEY", base: "https://api.mistral.ai/v1", models: ["mistral-small-latest", "open-mistral-nemo"], json: true },
  openrouter: { name: "OpenRouter", key: "OPENROUTER_API_KEY", base: "https://openrouter.ai/api/v1", models: ["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free", "mistralai/mistral-small-3.2-24b-instruct:free"], json: false },
  ollama: { name: "Ollama Cloud", key: "OLLAMA_API_KEY", native: "https://ollama.com/api/chat", models: ["gpt-oss:120b", "gpt-oss:20b"], json: true },
  /* reserva sem chave: garante que a IA funcione mesmo antes de as chaves serem configuradas ou se todos os motores falharem */
  reserva: { name: "Reserva", keyless: true, url: "https://text.pollinations.ai/openai", models: ["openai", "mistral"], json: false }
};
const AUTO = ["groq", "mistral", "openrouter", "ollama", "reserva"];

const DEFAULT_ORIGINS = ["https://aulavivastudio.vercel.app", "https://matheus1906-hash.github.io"];
function originAllowed(origin, host) {
  if (!origin || origin === "null") return true; // mesma origem, arquivo aberto do computador ou servidor (protegidos pelo limite)
  const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (DEFAULT_ORIGINS.concat(extra).includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (host && u.host === host) return true;                                  // o próprio domínio do deploy
    if (/^aulavivastudio[a-z0-9-]*\.vercel\.app$/.test(u.host)) return true;  // prévias do Vercel deste projeto
  } catch (e) {}
  return false;
}

/* limite de uso por IP (por instância): protege a cota gratuita contra abuso */
const HITS = new Map();
const LIMITS = [[10 * 60e3, +process.env.IA_LIMIT_10MIN || 40], [24 * 3600e3, +process.env.IA_LIMIT_DAY || 400]];
function limited(ip) {
  const now = Date.now(), list = (HITS.get(ip) || []).filter((t) => now - t < LIMITS[1][0]);
  for (const [win, max] of LIMITS) if (list.filter((t) => now - t < win).length >= max) { HITS.set(ip, list); return true; }
  list.push(now); HITS.set(ip, list);
  if (HITS.size > 5000) for (const k of HITS.keys()) { HITS.delete(k); if (HITS.size < 4000) break; }
  return false;
}

function clean(body) {
  const b = body && typeof body === "object" ? body : {};
  const msgs = Array.isArray(b.messages) ? b.messages.slice(-40) : [];
  const messages = msgs.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content.slice(0, 60000) }));
  const total = messages.reduce((a, m) => a + m.content.length, 0);
  if (!messages.length || total > 120000) return null;
  return { engine: typeof b.engine === "string" ? b.engine : "auto", messages, system: typeof b.system === "string" ? b.system.slice(0, 12000) : "", json: !!b.json, stream: b.stream !== false };
}

const available = () => Object.keys(ENGINES).filter((id) => ENGINES[id].keyless || !!process.env[ENGINES[id].key]);

/* abre a resposta de um motor; devolve { reader(), engine } ou lança erro com status */
async function open(id, req, signal) {
  const e = ENGINES[id], key = e.keyless ? "" : process.env[e.key];
  if (!key && !e.keyless) throw Object.assign(new Error("motor desligado"), { status: 503 });
  let last;
  for (const model of e.models) {
    const msgs = (req.system ? [{ role: "system", content: req.system }] : []).concat(req.messages);
    let url, payload;
    if (e.native) { url = e.native; payload = { model, messages: msgs, stream: true, options: { temperature: 0.7 } }; if (req.json) payload.format = "json"; }
    else { url = e.url || e.base + "/chat/completions"; payload = { model, messages: msgs, temperature: 0.7, max_tokens: 8000, stream: true }; if (req.json && e.json) payload.response_format = { type: "json_object" }; }
    const headers = { "content-type": "application/json" };
    if (key) headers.authorization = "Bearer " + key;
    if (e.keyless) { delete payload.max_tokens; payload.referrer = "aulavivastudio"; }
    if (id === "openrouter") { headers["X-Title"] = "AulaViva Studio"; headers["HTTP-Referer"] = "https://aulavivastudio.vercel.app"; }
    let r;
    try { r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal }); }
    catch (err) { last = Object.assign(new Error("rede"), { status: 502 }); continue; }
    if (r.ok && r.body) return { res: r, native: !!e.native, engine: id, model };
    const text = await r.text().catch(() => "");
    last = Object.assign(new Error(text.slice(0, 200)), { status: r.status });
    if (r.status === 400 && payload.response_format) { // alguns modelos não aceitam modo JSON: tenta sem
      delete payload.response_format;
      try { r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal }); if (r.ok && r.body) return { res: r, native: !!e.native, engine: id, model }; } catch (err) {}
    }
    if (![400, 404, 422].includes(r.status)) break; // modelo indisponível: tenta o próximo modelo; outros erros: próximo motor
  }
  throw last || Object.assign(new Error("falhou"), { status: 502 });
}

/* lê o stream do motor e chama onText(delta) */
async function pump(opened, onText) {
  const rd = opened.res.body.getReader(), dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        if (opened.native) { const j = JSON.parse(line); const t = (j.message && j.message.content) || ""; if (t) onText(t); }
        else if (line.startsWith("data:")) { const d = line.slice(5).trim(); if (d === "[DONE]") continue; const j = JSON.parse(d); const t = ((((j.choices || [])[0] || {}).delta) || {}).content || ""; if (t) onText(t); }
      } catch (e) { /* linha parcial */ }
    }
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  if (originAllowed(origin, host) && origin) { res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "null" : origin); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (!originAllowed(origin, host)) { res.statusCode = 403; return res.end(JSON.stringify({ error: "origem não permitida" })); }
  if (req.method === "GET") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ok: available().length > 0, engines: available() })); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (limited(ip)) { res.statusCode = 429; res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ error: "rate_limited", message: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo." })); }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const q = clean(body);
  if (!q) { res.statusCode = 400; res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ error: "pedido inválido" })); }

  const on = available();
  if (!on.length) { res.statusCode = 503; res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ error: "no_engine", message: "A IA interna ainda não foi configurada." })); }
  const order = q.engine !== "auto" && ENGINES[q.engine] ? [q.engine].concat(AUTO.filter((x) => x !== q.engine)) : AUTO;
  const abort = new AbortController();
  req.on && req.on("close", () => { if (!res.writableEnded) abort.abort(); });

  let opened = null, lastErr = null;
  for (const id of order.filter((x) => on.includes(x))) {
    try { opened = await open(id, q, abort.signal); break; } catch (e) { lastErr = e; }
  }
  if (!opened) {
    const st = lastErr && lastErr.status === 429 ? 429 : 502;
    res.statusCode = st; res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: st === 429 ? "rate_limited" : "upstream", message: st === 429 ? "As IAs gratuitas estão no limite agora. Tente de novo em alguns minutos." : "Não foi possível falar com a IA agora. Tente de novo." }));
  }

  if (q.stream) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
    res.write("data: " + JSON.stringify({ engine: opened.engine, model: opened.model, choices: [{ delta: { content: "" } }] }) + "\n\n");
    try { await pump(opened, (t) => res.write("data: " + JSON.stringify({ choices: [{ delta: { content: t } }] }) + "\n\n")); }
    catch (e) { /* conexão interrompida */ }
    res.write("data: [DONE]\n\n");
    return res.end();
  }
  let text = "";
  try { await pump(opened, (t) => { text += t; }); } catch (e) {}
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ text, engine: opened.engine, model: opened.model }));
};
module.exports.ENGINES = ENGINES;
module.exports.originAllowed = originAllowed;

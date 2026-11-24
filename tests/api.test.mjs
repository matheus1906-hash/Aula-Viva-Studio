// Testes da IA interna (api/ia.js) com as IAs simuladas: nenhuma chave real é usada.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const enc = new TextEncoder();
const streamOf = (chunks) => new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
const sse = (parts) => streamOf(parts.map((t) => "data: " + JSON.stringify({ choices: [{ delta: { content: t } }] }) + "\n\n").concat(["data: [DONE]\n\n"]));
let calls = [], plan = {};
globalThis.fetch = async (url, opts) => {
  const host = new URL(url).host; calls.push({ host, body: JSON.parse(opts.body), auth: opts.headers.authorization });
  const p = plan[host] || { status: 500 };
  if (p.status !== 200) return new Response(p.text || "erro", { status: p.status });
  return new Response(p.body(), { status: 200 });
};
function run(handler, { method = "POST", origin = "https://aulavivastudio.vercel.app", body, ip = "1.1.1.1" } = {}) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, out: "", writableEnded: false,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, write(s) { this.out += s; },
      end(s) { if (s) this.out += s; this.writableEnded = true; resolve(this); } };
    handler({ method, headers: { origin, host: "aulavivastudio.vercel.app", "x-forwarded-for": ip }, body, on() {} }, res);
  });
}
const fresh = (env) => { for (const k of ["GROQ_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "OLLAMA_API_KEY", "IA_LIMIT_10MIN"]) delete process.env[k]; Object.assign(process.env, env); delete require.cache[require.resolve("../api/ia.js")]; return require("../api/ia.js"); };
const msg = { messages: [{ role: "user", content: "Olá" }], system: "seja breve" };
const text = (out) => out.split("\n").filter((l) => l.startsWith("data: {")).map((l) => JSON.parse(l.slice(6)).choices[0].delta.content).join("");

let h = fresh({});
let r = await run(h, { method: "GET" });
ok(JSON.parse(r.out).engines.length === 0, "sem chaves configuradas: nenhum motor ligado");
r = await run(h, { body: msg });
ok(r.statusCode === 503, "sem chaves: responde 503 com aviso amigável");

h = fresh({ GROQ_API_KEY: "test-groq", MISTRAL_API_KEY: "test-mistral", OPENROUTER_API_KEY: "test-or", OLLAMA_API_KEY: "test-ollama" });
r = await run(h, { method: "GET" });
ok(JSON.parse(r.out).engines.length === 4 && !r.out.includes("test-"), "GET lista os 4 motores sem revelar chaves");

plan = { "api.groq.com": { status: 200, body: () => sse(["Bom ", "dia!"]) } }; calls = [];
r = await run(h, { body: { ...msg, engine: "auto" } });
ok(r.headers["content-type"].startsWith("text/event-stream") && text(r.out) === "Bom dia!", "automático usa o Groq e repassa o texto em tempo real");
ok(calls[0].auth === "Bearer test-groq" && calls[0].body.messages[0].role === "system", "chave vai só do servidor para o Groq, com a instrução de sistema");

plan = { "api.groq.com": { status: 429 }, "api.mistral.ai": { status: 200, body: () => sse(["Olá da Mistral"]) } }; calls = [];
r = await run(h, { body: { ...msg, engine: "groq" } });
ok(text(r.out) === "Olá da Mistral" && calls.map((c) => c.host).join(",") === "api.groq.com,api.mistral.ai", "se o Groq estiver no limite, passa sozinho para a Mistral");

plan = { "ollama.com": { status: 200, body: () => streamOf([JSON.stringify({ message: { content: "Pen" } }) + "\n", JSON.stringify({ message: { content: "sando" }, done: true }) + "\n"]) } };
r = await run(h, { body: { ...msg, engine: "ollama", json: true } });
ok(text(r.out) === "Pensando", "Ollama Cloud (formato próprio) convertido para o mesmo formato");

plan = { "openrouter.ai": { status: 404 } }; plan["api.groq.com"] = { status: 200, body: () => sse(["ok"]) };
calls = []; r = await run(h, { body: { ...msg, engine: "openrouter" } });
ok(calls.filter((c) => c.host === "openrouter.ai").length === 3 && text(r.out) === "ok", "OpenRouter tenta os 3 modelos gratuitos e depois outro motor");

plan = { "api.groq.com": { status: 200, body: () => sse(["{\"a\":1}"]) } };
r = await run(h, { body: { ...msg, stream: false, json: true } });
ok(JSON.parse(r.out).text === "{\"a\":1}" && JSON.parse(r.out).engine === "groq", "modo sem streaming devolve o texto completo");

plan = { "api.groq.com": { status: 500 }, "api.mistral.ai": { status: 500 }, "openrouter.ai": { status: 500 }, "ollama.com": { status: 500 } };
r = await run(h, { body: msg });
ok(r.statusCode === 502 && /Tente de novo/.test(r.out), "todos os motores fora: erro amigável");

r = await run(h, { origin: "https://site-estranho.com", body: msg });
ok(r.statusCode === 403, "outros sites não podem usar a IA");
r = await run(h, { origin: "null", method: "GET" });
ok(r.statusCode === 200, "arquivo aberto do computador (origem null) pode usar");
r = await run(h, { body: { messages: [] } });
ok(r.statusCode === 400, "pedido vazio é recusado");
plan = { "api.groq.com": { status: 200, body: () => sse(["ok"]) } }; calls = [];
r = await run(h, { body: { messages: [{ role: "user", content: "x".repeat(130000) }, { role: "user", content: "x".repeat(10) }] } });
ok(r.statusCode === 200 && calls[0].body.messages[0].content.length === 60000, "texto enorme é cortado no limite antes de ir para a IA");

h = fresh({ GROQ_API_KEY: "k", IA_LIMIT_10MIN: "3" }); plan = { "api.groq.com": { status: 200, body: () => sse(["x"]) } };
for (let i = 0; i < 3; i++) await run(h, { body: msg, ip: "9.9.9.9" });
r = await run(h, { body: msg, ip: "9.9.9.9" });
ok(r.statusCode === 429, "limite por pessoa protege a cota gratuita contra abuso");
r = await run(h, { body: msg, ip: "8.8.8.8" });
ok(r.statusCode === 200, "outra pessoa continua usando normalmente");
process.exit(fails ? 1 : 0);

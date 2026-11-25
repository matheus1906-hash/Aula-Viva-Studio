// Testes do servidor de contas (api/conta.js) e da IA com login, com o Supabase simulado.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
Object.assign(process.env, { SUPABASE_URL: "https://teste123.supabase.co", SUPABASE_ANON_KEY: "anon-key", SUPABASE_SERVICE_ROLE_KEY: "service-key", GROQ_API_KEY: "g" });

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims) => "h." + b64u(claims) + ".s";
const now = () => Math.floor(Date.now() / 1000);
const USER = { id: "u-1", email: "ana@escola.br", factors: [] };
const PASSWORD_TOKEN = jwt({ sub: "u-1", session_id: "sess-A", aal: "aal1", amr: [{ method: "password", timestamp: now() }] });
const OTP_TOKEN = jwt({ sub: "u-1", session_id: "sess-B", aal: "aal1", amr: [{ method: "otp", timestamp: now() }] });
let calls = [], verified = new Set(), otpOk = true;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), auth = (opts.headers || {}).authorization || "", body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ path: u.pathname + u.search, method: opts.method || "GET", apikey: (opts.headers || {}).apikey, body });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (u.pathname === "/auth/v1/user") return [PASSWORD_TOKEN, OTP_TOKEN].some((t) => auth.endsWith(t)) ? json(USER) : json({ msg: "invalid" }, 401);
  if (u.pathname === "/auth/v1/otp") return json({});
  if (u.pathname === "/auth/v1/verify") return otpOk && body.token === "123456" ? json({ access_token: "temp-token" }) : json({ msg: "Token has expired or is invalid" }, 403);
  if (u.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
  if (u.pathname === "/rest/v1/sessoes_verificadas" && opts.method === "POST") { verified.add(body.session_id); return new Response(null, { status: 201 }); }
  if (u.pathname === "/rest/v1/sessoes_verificadas" && opts.method === "DELETE") { verified.clear(); return new Response(null, { status: 204 }); }
  if (u.pathname === "/rest/v1/sessoes_verificadas") { const sid = u.searchParams.get("session_id").replace("eq.", ""); return json(verified.has(sid) ? [{ session_id: sid }] : []); }
  if (u.pathname === "/rest/v1/eventos_seguranca") return new Response(null, { status: 201 });
  if (u.hostname === "api.groq.com") return new Response("data: " + JSON.stringify({ choices: [{ delta: { content: "oi" } }] }) + "\n\ndata: [DONE]\n\n", { status: 200 });
  return json({}, 404);
};
function run(handler, { method = "POST", body, token, origin = "https://aulavivastudio.vercel.app", ip = "1.2.3.4" } = {}) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, out: "", headersSent: false, writableEnded: false, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, write(s) { this.out += s; this.headersSent = true; }, end(s) { if (s) this.out += s; this.writableEnded = true; resolve(this); } };
    handler({ method, body, on() {}, headers: { origin, host: "aulavivastudio.vercel.app", "content-type": "application/json", "x-forwarded-for": ip, "user-agent": "teste", authorization: token ? "Bearer " + token : undefined } }, res);
  });
}
const conta = require("../api/conta.js");
const J = (r) => JSON.parse(r.out);

let r = await run(conta, { method: "GET" });
ok(J(r).ativo === true && J(r).anon === "anon-key" && !r.out.includes("service-key"), "GET entrega só os dados públicos (nunca a chave secreta)");
r = await run(conta, { body: { acao: "enviar-codigo" } });
ok(r.statusCode === 401, "sem sessão não envia código");
calls = []; r = await run(conta, { body: { acao: "enviar-codigo", email: "outra@pessoa.com" }, token: PASSWORD_TOKEN });
const otp = calls.find((c) => c.path === "/auth/v1/otp");
ok(r.statusCode === 200 && otp && otp.body.email === "ana@escola.br" && otp.body.create_user === false, "código vai para o e-mail da conta (o e-mail do navegador é ignorado)");
ok(/^an\*+@escola\.br$/.test(J(r).email), "e-mail aparece mascarado na resposta");
r = await run(conta, { body: { acao: "enviar-codigo" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 429, "no máximo 1 código por minuto");
r = await run(conta, { body: { acao: "verificar-codigo", codigo: "999999" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 400 && !verified.has("sess-A"), "código errado não confirma a sessão");
r = await run(conta, { body: { acao: "verificar-codigo", codigo: "12a" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 400, "código fora do formato é recusado");
calls = []; r = await run(conta, { body: { acao: "verificar-codigo", codigo: "123456" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 200 && verified.has("sess-A"), "código certo confirma a sessão de senha no servidor");
ok(calls.some((c) => c.path.startsWith("/auth/v1/logout") ), "a sessão temporária do código é descartada");
ok(calls.filter((c) => c.path.startsWith("/rest/v1/sessoes_verificadas")).every((c) => c.apikey === "service-key"), "só o servidor (chave secreta) grava sessões confirmadas");
for (let i = 0; i < 6; i++) await run(conta, { body: { acao: "verificar-codigo", codigo: "000000" }, token: PASSWORD_TOKEN });
r = await run(conta, { body: { acao: "verificar-codigo", codigo: "123456" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 429, "tentativas de adivinhar o código são bloqueadas por 15 minutos");
r = await run(conta, { body: { acao: "confirmar-sessao" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 403, "sessão só de senha não se confirma sozinha");
r = await run(conta, { body: { acao: "confirmar-sessao" }, token: OTP_TOKEN });
ok(r.statusCode === 200 && verified.has("sess-B"), "sessão nascida do código do cadastro é confirmada");
r = await run(conta, { body: { acao: "apagar-tudo" }, token: OTP_TOKEN });
ok(r.statusCode === 400, "ações desconhecidas são recusadas");
r = await run(conta, { body: { acao: "__proto__" }, token: OTP_TOKEN });
ok(r.statusCode === 400, "tentativa de injetar ação interna é recusada");
r = await run(conta, { body: { acao: "evento", tipo: "qualquer-coisa" }, token: OTP_TOKEN });
ok(r.statusCode === 400, "só tipos de evento conhecidos são registrados");
r = await run(conta, { origin: "https://golpe.com", body: { acao: "enviar-codigo" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 403, "outros sites não usam o servidor de contas");

/* IA com login obrigatório */
const ia = require("../api/ia.js");
r = await run(ia, { body: { messages: [{ role: "user", content: "oi" }] }, ip: "5.5.5.5" });
ok(r.statusCode === 401, "com contas ligadas, a IA recusa quem não entrou");
r = await run(ia, { body: { messages: [{ role: "user", content: "oi" }] }, token: jwt({ sub: "u-1", session_id: "sess-Z" }) });
ok(r.statusCode === 401, "a IA recusa sessão não confirmada pelo código");
r = await run(ia, { body: { messages: [{ role: "user", content: "oi" }] }, token: PASSWORD_TOKEN, ip: "6.6.6.6" });
ok(r.statusCode === 200 && /oi/.test(r.out), "a IA atende sessão confirmada (senha + código)");
r = await run(conta, { body: { acao: "sair-de-todos" }, token: PASSWORD_TOKEN });
ok(r.statusCode === 200 && verified.size === 0, "sair de todos os aparelhos derruba todas as sessões confirmadas");

/* validações do cadastro (navegador) */
import fs from "node:fs"; import vm from "node:vm";
globalThis.AV = { h: () => null }; vm.runInThisContext(fs.readFileSync(new URL("../src/conta.js", import.meta.url), "utf8"));
const C = globalThis.AV.Conta;
ok(C.cpfValido("529.982.247-25") && !C.cpfValido("111.111.111-11") && !C.cpfValido("529.982.247-24"), "CPF: dígitos verificadores conferidos no navegador");
ok(C.telefoneValido("(64) 99999-9999") && !C.telefoneValido("9999") && !C.telefoneValido("(00) 99999-9999"), "celular com DDD válido");
ok(C.emailValido("ana@escola.go.gov.br") && !C.emailValido("ana@") && !C.emailValido("a b@c.com"), "e-mail válido");
ok(C.maskCpf("52998224725") === "529.982.247-25" && C.maskPhone("64999999999") === "(64) 99999-9999", "máscaras de CPF e celular");
process.exit(fails ? 1 : 0);

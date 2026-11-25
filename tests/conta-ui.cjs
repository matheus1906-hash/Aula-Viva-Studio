// Cadastro e login institucional no navegador, com o Supabase e o /api/conta simulados.
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "dist/site");
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const types = { ".html": "text/html", ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript" };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (f.endsWith("/")) f += "index.html"; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(d); }); }).listen(8851);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
  const SB = "https://teste123.supabase.co";
  const st = { users: {}, verified: new Set(), profile: null, factor: null, codeSent: 0 };
  const json = (route, o, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
  const tok = (sid, aal = "aal1") => "h." + Buffer.from(JSON.stringify({ sub: "u-1", session_id: sid, aal })).toString("base64url") + ".s";
  let current = null;
  await ctx.route("https://aulavivastudio.vercel.app/api/conta", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization" } });
    if (route.request().method() === "GET") return json(route, { ativo: true, url: SB, anon: "anon-key" });
    const body = JSON.parse(route.request().postData());
    if (body.acao === "enviar-codigo") { st.codeSent++; return json(route, { enviado: true, email: "an***@escola.br" }); }
    if (body.acao === "verificar-codigo") { if (body.codigo !== "246810") return json(route, { message: "Código incorreto ou vencido." }, 400); st.verified.add(current); return json(route, { verificada: true }); }
    if (body.acao === "confirmar-sessao") { st.verified.add(current); return json(route, { verificada: true }); }
    return json(route, {});
  });
  await ctx.route(SB + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url()), body = req.postData() ? JSON.parse(req.postData()) : {};
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const p = u.pathname;
    if (p === "/rest/v1/rpc/cpf_disponivel") return json(route, body.p_cpf === "52998224725");
    if (p === "/auth/v1/signup") { st.users[body.email] = body.password; return json(route, { id: "u-1" }); }
    if (p === "/auth/v1/verify") { current = "sess-signup"; return json(route, { access_token: tok(current), refresh_token: "r1", expires_in: 3600, user: { id: "u-1", email: "ana@escola.br" } }); }
    if (p === "/auth/v1/token" && u.searchParams.get("grant_type") === "password") { if (st.users[body.email] !== body.password) return json(route, { msg: "Invalid login credentials" }, 400); current = "sess-login"; return json(route, { access_token: tok(current), refresh_token: "r2", expires_in: 3600, user: { id: "u-1", email: body.email } }); }
    if (p === "/auth/v1/user") return json(route, { id: "u-1", email: "ana@escola.br", user_metadata: { nome: "Ana Souza" }, factors: st.factor && st.factor.verified ? [{ id: "f1", factor_type: "totp", status: "verified" }] : [] });
    if (p === "/rest/v1/perfis" && req.method() === "POST") { if (!st.verified.has(current)) return json(route, { message: "new row violates row-level security" }, 403); st.profile = body; return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" } }); }
    if (p === "/auth/v1/factors" && req.method() === "POST") { st.factor = { verified: false }; return json(route, { id: "f1", totp: { qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>", secret: "JBSWY3DPEHPK3PXP" } }); }
    if (p === "/auth/v1/factors/f1/challenge") return json(route, { id: "c1" });
    if (p === "/auth/v1/factors/f1/verify") { if (body.code !== "135791") return json(route, { msg: "invalid totp" }, 400); st.factor.verified = true; return json(route, { access_token: tok(current, "aal2"), refresh_token: "r3", expires_in: 3600 }); }
    if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    return json(route, {});
  });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8851/"); await p.waitForSelector("#cd-email");
  ok(await p.locator("text=Entrar na sua conta").isVisible(), "modo institucional: tela de entrada com e-mail e senha");
  await p.click("text=Criar conta de professor");
  await p.fill("#cd-nome", "Ana Souza"); await p.fill("#cd-email", "ana@escola.br"); await p.fill("#cd-tel", "64999998888");
  await p.fill("#cd-cpf", "11111111111"); await p.fill("#cd-pw", "Lousa-Verde#2026x"); await p.fill("#cd-pw2", "Lousa-Verde#2026x");
  await p.click(".auth-go"); await p.waitForTimeout(200);
  ok(/CPF inválido/.test(await p.textContent(".auth-msg")), "CPF inválido é recusado no cadastro");
  ok((await p.inputValue("#cd-tel")) === "(64) 99999-8888", "celular formatado automaticamente");
  await p.fill("#cd-cpf", "52998224725");
  await p.click(".auth-go"); await p.waitForTimeout(200);
  ok(/instituição/.test(await p.textContent(".auth-msg")), "instituição é obrigatória");
  await p.selectOption("#cd-uf", "GO"); await p.waitForFunction(() => document.querySelector("#cd-mun").options.length > 100);
  const rv = await p.evaluate(() => [...document.querySelector("#cd-mun").options].find((o) => o.textContent === "Rio Verde").value);
  await p.selectOption("#cd-mun", rv); await p.fill("#cd-escola", "colegio"); await p.waitForTimeout(300);
  const nEsc = await p.locator(".cd-opt").count();
  ok(nEsc > 0, "busca de escolas de Rio Verde/GO na base do INEP (" + nEsc + " resultados)");
  const escolaNome = await p.locator(".cd-opt b").first().innerText();
  await p.locator(".cd-opt").first().click();
  await p.click(".auth-go"); await p.waitForTimeout(200);
  ok(/aceite/.test(await p.textContent(".auth-msg")), "aceite da política de privacidade (LGPD) é obrigatório");
  await p.check("#cd-aceite"); await p.click(".auth-go");
  await p.waitForSelector("#cd-code");
  ok(await p.locator("text=Confirme que é você").isVisible(), "cadastro pede o código enviado ao e-mail");
  await p.fill("#cd-code", "123456");
  await p.waitForSelector("text=Proteja ainda mais a sua conta", { timeout: 10000 });
  ok(st.profile && st.profile.cpf === "52998224725" && st.profile.escola_nome === escolaNome && st.profile.uf === "GO" && st.profile.telefone === "64999998888", "perfil salvo com CPF, celular e escola do INEP depois do código");
  await p.click("text=Ativar agora (recomendado)"); await p.waitForSelector(".cd-qr");
  ok(await p.locator(".cd-qr").isVisible(), "ativação das 2 etapas mostra o QR code do app autenticador");
  await p.fill(".auth-form input[inputmode=numeric]", "000000"); await p.click(".auth-form button:has-text('Ativar')"); await p.waitForTimeout(200);
  ok(/incorreto/.test(await p.textContent(".auth-form .auth-msg")), "código errado do app não ativa as 2 etapas");
  await p.fill(".auth-form input[inputmode=numeric]", "135791"); await p.click(".auth-form button:has-text('Ativar')");
  await p.waitForSelector(".auth", { state: "detached", timeout: 15000 });
  ok(st.factor.verified, "2 etapas ativadas e app liberado");
  ok(await p.evaluate(() => AV.Vault.owner() === "u-1"), "cofre dos materiais vinculado à conta");
  // sair e entrar de novo: senha + código do e-mail + app
  await p.evaluate(() => { sessionStorage.clear(); }); await p.reload(); await p.waitForSelector("#cd-email");
  await p.fill("#cd-email", "ana@escola.br"); await p.fill("#cd-pw", "senha-errada"); await p.click(".auth-go"); await p.waitForTimeout(300);
  ok(/incorretos/.test(await p.textContent(".auth-msg")), "senha errada é recusada");
  await p.fill("#cd-pw", "Lousa-Verde#2026x"); await p.click(".auth-go"); await p.waitForSelector("#cd-code");
  ok(st.codeSent === 1, "login com senha certa envia o código ao e-mail");
  await p.fill("#cd-code", "111111"); await p.waitForTimeout(400);
  ok(/incorreto/i.test(await p.textContent(".auth-msg")) && !st.verified.has("sess-login"), "código errado não libera o login");
  await p.fill("#cd-code", "246810"); await p.waitForSelector("#cd-totp");
  ok(await p.locator("h2:has-text(\"Verificação em 2 etapas\")").isVisible(), "depois do código do e-mail, pede o app autenticador");
  await p.fill("#cd-totp", "135791"); await p.waitForSelector(".auth", { state: "detached", timeout: 15000 });
  ok(await p.evaluate(() => AV.Vault.unlocked() && AV.Conta.active()), "login completo: senha + e-mail + app, cofre aberto");
  await p.evaluate(() => (location.hash = "config")); await p.waitForSelector("text=Escudo de segurança");
  ok(await p.locator("text=Proteção ativa").first().isVisible(), "painel do Escudo de segurança nas configurações");
  ok(!errs.length, "sem erros de página " + errs.join(" | "));
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

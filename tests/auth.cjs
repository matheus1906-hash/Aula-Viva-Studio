const { chromium } = require("playwright"); const path = require("path");
const root = path.join(__dirname, "..");
const url = "file://" + path.join(root, "dist/aulaviva-studio-standalone.html");
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: "pt-BR" });
  await ctx.route("https://fonts.**", (r) => r.abort());
  await ctx.route("https://cdn.jsdelivr.net/**", (r) => r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url); await p.waitForSelector(".auth");
  ok(await p.locator(".auth h1").isVisible(), "tela de boas-vindas aparece");
  // Primeira visita / domínio novo: botão Entrar não pode parecer quebrado.
  const loginTab = p.locator('.auth-tabs button').filter({ hasText: 'Entrar' });
  ok(await loginTab.isEnabled(), "aba Entrar clicável mesmo sem conta local");
  await loginTab.click();
  ok(/Nenhuma conta local foi encontrada neste endereço/.test(await p.locator('.auth-form').innerText()), "mensagem explica domínio e conta local");
  await p.fill('#au-pw', 'Senha-de-outra-origem');
  await p.click('.auth-go');
  ok(/Não existe conta local neste endereço/.test(await p.locator('.auth-msg').innerText()), "login sem conta não tenta autenticar em cofre inexistente");
  await p.locator('.auth-tabs button').filter({ hasText: 'Criar conta' }).click();

  ok((await p.locator(".auth-frame img").count()) === 6, "6 imagens reais na vitrine");
  ok(!(await p.locator("#main, main.main").first().isVisible().catch(() => false)), "app escondido antes de entrar");
  await p.screenshot({ path: path.join(root, "tests/auth-login.png") });
  // senha fraca é recusada
  await p.fill("#au-name", "Profa. Teste"); await p.fill("#au-pw", "senha123"); await p.fill("#au-pw2", "senha123");
  await p.click(".auth-go"); await p.waitForTimeout(200);
  ok(/fraca|caracteres/i.test(await p.textContent(".auth-msg")), "senha fraca recusada");
  const PW = "Lousa-Verde#2026";
  await p.fill("#au-pw", PW); await p.fill("#au-pw2", PW); await p.click(".auth-go");
  await p.waitForSelector(".auth-code", { timeout: 20000 });
  const code = (await p.textContent(".auth-code")).trim();
  ok(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/.test(code), "código de recuperação gerado");
  ok(await p.locator(".auth-card button.pri").isDisabled(), "continuar exige confirmar que guardou");
  await p.check("#au-saved"); await p.click(".auth-card button.pri");
  await p.waitForSelector(".auth", { state: "detached" });
  // Home 4.0: verificações reais de navegador após desbloquear o cofre.
  await p.waitForSelector(".home-welcome h1", { timeout: 15000 });
  ok(await p.locator(".home-welcome h1").isVisible(), "nova tela inicial é visível após entrar");
  ok(await p.locator(".home-action").count() === 12, "doze cards de criação são exibidos");
  ok(await p.locator(".home-hero-area > .home-quote-panel").isVisible(), "frase junto ao banner");
  ok(await p.locator(".home-plan-card").isVisible(), "plano de aula no canto da página");
  ok(await p.locator(".home-recent-bottom").isVisible(), "materiais recentes na parte inferior");
  ok(await p.locator(".home-panel h2", { hasText: "Minha agenda" }).isVisible(), "agenda destacada na tela inicial");
  ok(await p.locator(".home-panel h2", { hasText: "Aulas de hoje" }).isVisible(), "horário de aula destacado na tela inicial");
  await p.fill('.home-quick-add input', 'Lembrete de teste');
  await p.locator('.home-quick-add button').click();
  ok((await p.locator('.home-task-copy').innerText()).includes("Lembrete de teste"), "novo lembrete aparece imediatamente na home");
  ok((await p.evaluate(() => AV.LS.get("teacherAgenda", []).length)) === 1, "agenda foi salva no cofre");
  await p.evaluate(() => { AV.LS.set("homeWidgets", { agenda: false, schedule: false, quote: false, quickStudy: false }); AV.route(); });
  ok(await p.locator(".home-panel h2", { hasText: "Minha agenda" }).count() === 0, "modo limpo oculta widgets");
  ok((await p.evaluate(() => AV.LS.get("teacherAgenda", []).length)) === 1, "modo limpo não apaga lembretes");
  await p.evaluate(() => { AV.LS.set("homeWidgets", { agenda: true, schedule: true, quote: true, quickStudy: true }); AV.route(); });
  await p.setViewportSize({ width: 390, height: 844 });
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 402, "dashboard não provoca rolagem horizontal no celular");
  await p.setViewportSize({ width: 1280, height: 860 });
  // cria um material e confere que o localStorage só tem dados cifrados
  await p.evaluate(() => { const d = AV.newDoc ? AV.newDoc("apostila") : null; if (d) { d.meta.title = "SEGREDO-MATERIAL"; AV.Store.put(d); } AV.LS.set("ai", { keys: { groq: "gsk_SEGREDO" } }); });
  await p.evaluate(() => AV.Vault.flush()); await p.waitForTimeout(300);
  const dump = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  ok(!/SEGREDO|Profa\. Teste|Lousa-Verde/.test(dump), "nada legível no localStorage (material, chave, nome, senha)");
  ok(/av:v:/.test(dump) && /av:vaultmeta/.test(dump), "entradas cifradas presentes");
  // bloquear e entrar de novo
  await p.reload(); await p.waitForSelector(".auth");
  await p.fill("#au-pw", "errada-1"); await p.click(".auth-go"); await p.waitForTimeout(1500);
  ok(/incorreta/i.test(await p.textContent(".auth-msg")), "senha errada recusada");
  await p.fill("#au-pw", PW); await p.click(".auth-go"); await p.waitForSelector(".auth", { state: "detached", timeout: 20000 });
  const back = await p.evaluate(() => [AV.LS.get("ai", {}).keys && AV.LS.get("ai", {}).keys.groq, AV.LS.get("profile", {}).name]);
  ok(back[0] === "gsk_SEGREDO" && back[1] === "Profa. Teste", "dados voltam após desbloquear");
  // bloqueio progressivo
  await p.reload(); await p.waitForSelector(".auth");
  for (let i = 0; i < 5; i++) { await p.fill("#au-pw", "x" + i); await p.click(".auth-go"); await p.waitForFunction(() => !document.querySelector(".auth-go").disabled, null, { timeout: 20000 }); }
  ok(/Aguarde/.test(await p.textContent(".auth-msg")), "bloqueio após 5 tentativas");
  // recuperação com o código
  await p.evaluate(() => localStorage.setItem("av:lockout", JSON.stringify({ fails: 0, until: 0 })));
  await p.click("text=Esqueci minha senha");
  const PW2 = "Giz&Quadro-77x";
  await p.fill("#au-rec", code.toLowerCase()); await p.fill("#au-pw", PW2); await p.fill("#au-pw2", PW2); await p.click(".auth-go");
  await p.waitForSelector(".auth", { state: "detached", timeout: 20000 });
  ok((await p.evaluate(() => AV.LS.get("profile", {}).name)) === "Profa. Teste", "recuperação com código mantém os dados");
  // configurações: painel de segurança
  await p.evaluate(() => (location.hash = "config")); await p.waitForTimeout(400);
  ok(await p.locator("text=Conta e segurança").isVisible(), "painel Conta e segurança nas configurações");
  // modo visitante
  const p2 = await (await b.newContext({ locale: "pt-BR" })).newPage();
  await p2.goto(url); await p2.waitForSelector(".auth");
  await p2.click("text=Explorar sem criar conta"); await p2.waitForSelector(".auth", { state: "detached" });
  await p2.evaluate(() => AV.LS.set("chat", [{ role: "user", text: "oi" }]));
  ok((await p2.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("av:v:")).length)) === 0, "visitante não grava nada");
  // CSP
  const csp = await p.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
  ok(/object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp), "CSP presente");
  ok(!errs.length, "sem erros de página " + errs.join(" | "));
  await b.close(); process.exit(fails ? 1 : 0);
})();

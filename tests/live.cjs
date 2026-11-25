// Testa a criação ao vivo: node tests/live.cjs
const { chromium } = require("playwright"); const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, ".."); const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const DOC = JSON.stringify({ title: "O ciclo da água", subtitle: "Apostila do 5º ano", blocks: [
  { type: "heading", text: "1. Para onde vai a água?", level: 1 }, { type: "paragraph", text: "A água da Terra está sempre em movimento: ela **evapora**, forma nuvens e volta como chuva." },
  { type: "callout", style: "curiosidade", title: "Você sabia?", text: "A mesma água que os dinossauros beberam ainda circula no planeta." },
  { type: "choice_question", prompt: "O que acontece na evaporação?", options: ["A água congela", "A água vira vapor", "A água some", "A água vira sal"], correct: 1 },
  { type: "true_false", statements: ["As nuvens são feitas de gotas de água.", "A chuva não faz parte do ciclo."], answers: [true, false] },
  { type: "open_question", prompt: "Por que devemos economizar água?", lines: 4, answer: "Porque a água potável é limitada." } ] });
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8801);
(async () => {
  const b = await chromium.launch(); const errs = [];
  // 1) IA incluída (claude.ai) escrevendo em partes
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.route("https://**", (r) => r.abort());
  await ctx.addInitScript((doc) => {
    localStorage.setItem("av:profile", JSON.stringify({ lang: "pt" }));
    const sample = async (inp, o) => { let t = ""; for (let i = 0; i < doc.length; i += 12) { if (o && o.signal && o.signal.aborted) { const e = new Error("abort"); e.name = "AbortError"; throw e; } t = doc.slice(0, i + 12); o && o.onText && o.onText({ text: t, delta: "" }); await new Promise((r) => setTimeout(r, 45)); } return { text: doc }; };
    sample.json = async () => JSON.parse(doc);
    window.claude = { use: async (n) => (n === "sample" ? sample : null) };
  }, DOC);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8801/aulaviva-studio.html"); await p.waitForTimeout(400);
  await p.click("text=Criar com IA"); await p.fill("#ai-topic", "Ciclo da água"); await p.waitForSelector("#bncc-level option[value='EF-5']", { state: "attached" }); await p.selectOption("#bncc-level", "EF-5"); await p.selectOption("#bncc-comp", "CI"); await p.waitForSelector(".bncc-item.on"); await p.click("text=Gerar material");
  await p.waitForTimeout(1300);
  const mid = await p.evaluate(() => ({ blocks: +document.querySelector(".live-stat b").textContent, paper: !!document.querySelector(".live-paper .paper"), stage: (document.querySelector(".live-steps li.on") || {}).dataset?.k, title: document.querySelector(".live-title").textContent }));
  ok(mid.paper && mid.blocks >= 1 && mid.stage === "write", "folha aparece durante a escrita (" + JSON.stringify(mid) + ")");
  await p.screenshot({ path: path.join(root, "tests", "live-meio.png") });
  await p.waitForSelector("text=Abrir no editor", { timeout: 15000 });
  const end = await p.evaluate(() => ({ blocks: +document.querySelector(".live-stat b").textContent, qs: +document.querySelectorAll(".live-stat b")[1].textContent, stage: (document.querySelector(".live-steps li.on") || {}).dataset?.k }));
  ok(end.blocks >= 6 && end.qs === 3 && end.stage === "done", "termina com todos os blocos e questões (" + JSON.stringify(end) + ")");
  await p.screenshot({ path: path.join(root, "tests", "live-fim.png") });
  await p.click("text=Abrir no editor"); await p.waitForSelector(".ed-title");
  ok((await p.inputValue(".ed-title")) === "O ciclo da água", "abre no editor com o material");
  // cancelar no meio
  await p.evaluate(() => (location.hash = "inicio")); await p.waitForTimeout(300);
  await p.click("text=Criar com IA"); await p.fill("#ai-topic", "Teste"); await p.waitForSelector("#bncc-level option[value='EF-5']", { state: "attached" }); await p.selectOption("#bncc-level", "EF-5"); await p.selectOption("#bncc-comp", "CI"); await p.waitForSelector(".bncc-item.on"); await p.click("text=Gerar material"); await p.waitForTimeout(500);
  await p.click(".live button:has-text('Cancelar')"); await p.waitForTimeout(400);
  const cTxt = await p.locator(".live-side p.muted").innerText(); ok(/cancelada/i.test(cTxt), "cancelar interrompe a geração (" + cTxt + ")");
  await ctx.close();
  // 2) versão para hospedar com Groq em SSE
  const c2 = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await c2.route("https://fonts.**", (r) => r.abort());
  let streamed = false, sentKey = false;
  await c2.route("https://aulavivastudio.vercel.app/api/ia", async (r) => {
    const body = JSON.parse(r.request().postData() || "{}"); sentKey = /gsk_|sk-|key/i.test(JSON.stringify(r.request().headers()));
    if (body.stream && body.engine === "groq") { streamed = true; const chunks = ["data: " + JSON.stringify({ engine: "groq", choices: [{ delta: { content: "" } }] }) + "\n\n"]; for (let i = 0; i < DOC.length; i += 40) chunks.push("data: " + JSON.stringify({ choices: [{ delta: { content: DOC.slice(i, i + 40) } }] }) + "\n\n"); chunks.push("data: [DONE]\n\n"); return r.fulfill({ contentType: "text/event-stream", headers: { "access-control-allow-origin": "null" }, body: chunks.join("") }); }
    r.fulfill({ json: { text: DOC, engine: "groq" }, headers: { "access-control-allow-origin": "null" } });
  });
  await c2.addInitScript(() => { localStorage.setItem("av:profile", JSON.stringify({ lang: "pt" })); localStorage.setItem("av:aicfg", JSON.stringify({ active: "groq", keys: {}, models: {}, base: {} })); });
  const p2 = await c2.newPage(); p2.on("pageerror", (e) => errs.push(e.message));
  await p2.goto("file://" + path.join(root, "dist/aulaviva-studio-standalone.html")); await p2.click("text=Explorar sem criar conta"); await p2.waitForTimeout(400);
  await p2.click("text=Criar com IA"); await p2.fill("#ai-topic", "Ciclo da água"); await p2.waitForSelector("#bncc-level option[value='EF-5']", { state: "attached" }); await p2.selectOption("#bncc-level", "EF-5"); await p2.selectOption("#bncc-comp", "CI"); await p2.waitForSelector(".bncc-item.on"); await p2.click("text=Gerar material");
  await p2.waitForSelector("text=Abrir no editor", { timeout: 15000 });
  /* card da tela inicial: entende o pedido e já cria, sem segundo clique; resposta quebrada troca de motor */
  let calls = [];
  await c2.unroute("https://aulavivastudio.vercel.app/api/ia");
  await c2.route("https://aulavivastudio.vercel.app/api/ia", async (r) => {
    const body = JSON.parse(r.request().postData() || "{}"); calls.push(body);
    const first = calls.length === 1;
    const content = first ? "isto não é JSON" : DOC;
    r.fulfill({ contentType: "text/event-stream", headers: { "access-control-allow-origin": "null" }, body: "data: " + JSON.stringify({ engine: first ? "reserva" : "groq", choices: [{ delta: { content: "" } }] }) + "\n\ndata: " + JSON.stringify({ choices: [{ delta: { content } }] }) + "\n\ndata: [DONE]\n\n" });
  });
  const p3 = await c2.newPage(); p3.on("pageerror", (e) => errs.push(e.message));
  await p3.goto("file://" + path.join(root, "dist/aulaviva-studio-standalone.html")); await p3.click("text=Explorar sem criar conta"); await p3.waitForTimeout(300);
  await p3.fill("#hero-q", "Uma apostila simples sobre o ciclo da água para o 3º ano");
  await p3.keyboard.press("Enter");
  await p3.waitForSelector("text=Abrir no editor", { timeout: 15000 });
  const sentPrompt = calls[0].messages[0].content;
  ok(/"Apostila"/.test(sentPrompt) && /Tema: Ciclo da água/.test(sentPrompt) && /3º ano/.test(sentPrompt), "card da tela inicial entende tipo, tema e ano e cria direto");
  ok(calls.length === 2 && JSON.stringify(calls[1].exclude) === '["reserva"]', "resposta quebrada: tenta de novo sozinho evitando o motor que falhou");
  ok(streamed && !sentKey, "IA interna (motor Rápida/Groq) em tempo real, sem chave no navegador");
  ok(+(await p2.locator(".live-stat b").first().innerText()) >= 6, "blocos montados a partir do streaming da IA interna");
  await c2.close();
  ok(!errs.length, "sem erros de página " + JSON.stringify(errs));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });

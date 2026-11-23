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
  await p.click("text=Criar com IA"); await p.fill("#ai-topic", "Ciclo da água"); await p.click("text=Gerar material");
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
  await p.click("text=Criar com IA"); await p.fill("#ai-topic", "Teste"); await p.click("text=Gerar material"); await p.waitForTimeout(500);
  await p.click(".live button:has-text('Cancelar')"); await p.waitForTimeout(400);
  const cTxt = await p.locator(".live-side p.muted").innerText(); ok(/cancelada/i.test(cTxt), "cancelar interrompe a geração (" + cTxt + ")");
  await ctx.close();
  // 2) versão para hospedar com Groq em SSE
  const c2 = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await c2.route("https://fonts.**", (r) => r.abort());
  let streamed = false;
  await c2.route("https://api.groq.com/**", async (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    if (body.stream) { streamed = true; const chunks = []; for (let i = 0; i < DOC.length; i += 40) chunks.push("data: " + JSON.stringify({ choices: [{ delta: { content: DOC.slice(i, i + 40) } }] }) + "\n\n"); chunks.push("data: [DONE]\n\n"); return r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: chunks.join("") }); }
    r.fulfill({ json: { choices: [{ message: { content: DOC } }] } });
  });
  await c2.addInitScript(() => { localStorage.setItem("av:profile", JSON.stringify({ lang: "pt" })); localStorage.setItem("av:aicfg", JSON.stringify({ active: "groq", keys: { groq: "gsk_x" }, models: { groq: "llama-3.3-70b-versatile" }, base: {} })); });
  const p2 = await c2.newPage(); p2.on("pageerror", (e) => errs.push(e.message));
  await p2.goto("file://" + path.join(root, "dist/aulaviva-studio-standalone.html")); await p2.click("text=Explorar sem criar conta"); await p2.waitForTimeout(400);
  await p2.click("text=Criar com IA"); await p2.fill("#ai-topic", "Ciclo da água"); await p2.click("text=Gerar material");
  await p2.waitForSelector("text=Abrir no editor", { timeout: 15000 });
  ok(streamed, "Groq usado em modo de streaming (SSE)");
  ok(+(await p2.locator(".live-stat b").first().innerText()) >= 6, "blocos montados a partir do streaming do Groq");
  await c2.close();
  ok(!errs.length, "sem erros de página " + JSON.stringify(errs));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });

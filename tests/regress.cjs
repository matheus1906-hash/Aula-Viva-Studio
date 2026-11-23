const { chromium } = require("playwright"); const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, ".."); const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8783);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); await p.route("https://**", (r) => r.abort());
  await p.addInitScript(() => { if (!localStorage.getItem("av:profile")) localStorage.setItem("av:profile", JSON.stringify({ lang: "pt" })); });
  const U = "http://localhost:8783/aulaviva-studio.html";
  await p.goto(U); await p.waitForTimeout(300);
  // 1. editor sobrevive ao recarregar
  await p.evaluate(() => AV.createAndOpen("lista", "Teste reload")); await p.waitForSelector(".ed-title");
  await p.reload(); await p.waitForTimeout(500);
  ok((await p.locator(".ed-title").count()) && (await p.inputValue(".ed-title")) === "Teste reload", "editor abre o material após recarregar");
  // 2. remover alternativa mantém a correta
  await p.evaluate(() => { const d = AV.newDoc("lista", "Q"); d.blocks = [{ id: "q1", type: "choice_question", prompt: "?", options: ["A", "B", "C", "D"], correct: 2 }]; AV.openDoc(d); });
  await p.waitForSelector(".blk"); await p.locator('.blk button[aria-label="Remover"]').first().click(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => { const d = AV.Store.get(AV.LS.get("lastDoc")); const q = d.blocks[0]; return q.options[q.correct] === "C"; }), "remover alternativa anterior preserva a resposta certa");
  // 3. editor de animação mantém edições e id
  await p.evaluate(() => (location.hash = "animacao")); await p.waitForTimeout(400); await p.locator("text=Usar modelo").first().click(); await p.waitForTimeout(500);
  const nar = p.locator(".anim-studio textarea").first(); await nar.fill(""); await nar.type("abc"); await p.waitForTimeout(900);
  ok(await nar.inputValue() === "abc" && await p.evaluate(() => (AV.LS.get("anims", [])[0] || {}).scenes[0].narration === "abc"), "narração editada é salva por inteiro");
  await p.click('.anim-studio button[aria-label="Voltar"]'); await p.waitForTimeout(300);
  const anims = await p.evaluate(() => AV.LS.get("anims", []));
  ok(anims.length === 1 && anims[0].id, "vídeo salvo uma vez, com id (" + anims.length + ")");
  await p.locator(".anim-card button.thumb").first().click(); await p.waitForTimeout(400); await p.click('.anim-studio button[aria-label="Voltar"]'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => AV.LS.get("anims", []).length)) === 1, "abrir e voltar não duplica o vídeo");
  // 4. QR longo avisa
  await p.evaluate(() => (location.hash = "ferramentas")); await p.waitForTimeout(300); await p.fill("#qr-url", "https://example.org/" + "x".repeat(400)); await p.waitForTimeout(200);
  ok(/longo demais/.test(await p.locator(".studio p.small").first().innerText()), "QR com texto longo mostra aviso");
  // 5. Esc fecha só o diálogo de cima
  await p.evaluate(() => { AV.dialog("Pai", AV.h("div", null, "x")); AV.confirm("Filho", "y"); }); await p.waitForTimeout(100); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  ok((await p.locator(".dlg").count()) === 1, "Esc fecha só o diálogo de cima");
  await p.keyboard.press("Escape");
  // 6. hash estranho não quebra
  await p.evaluate(() => (location.hash = "constructor")); await p.waitForTimeout(300); ok((await p.locator(".hero").count()) === 1, "hash desconhecido volta ao início");
  ok(!errs.length, "sem erros de página " + JSON.stringify(errs));
  await b.close(); srv.close();
})();

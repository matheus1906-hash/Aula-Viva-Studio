const { chromium } = require("playwright");
const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, "..");
const map = {
  "jspdf@4.2.1/dist/jspdf.umd.min.js": "node_modules/jspdf/dist/jspdf.umd.min.js",
  "docx@8.5.0/build/index.umd.js": "node_modules/docx/build/index.umd.js",
  "pptxgenjs@3.12.0/dist/pptxgen.bundle.js": "node_modules/pptxgenjs/dist/pptxgen.bundle.js",
  "jszip@3.10.1/dist/jszip.min.js": "node_modules/jszip/dist/jszip.min.js",
  "mammoth@1.13.0/mammoth.browser.min.js": "node_modules/mammoth/mammoth.browser.min.js",
  "pdfjs-dist@3.11.174/build/pdf.min.js": "node_modules/pdfjs-dist/build/pdf.min.js",
  "pdfjs-dist@3.11.174/build/pdf.worker.min.js": "node_modules/pdfjs-dist/build/pdf.worker.min.js"
};
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8765);
(async () => {
  const b = await chromium.launch(); const errs = []; const saved = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route("https://cdn.jsdelivr.net/npm/**", (rt) => { const k = Object.keys(map).find((k) => rt.request().url().endsWith(k)); k ? rt.fulfill({ path: path.join(root, map[k]), contentType: "application/javascript" }) : rt.abort(); });
  await ctx.route("https://fonts.**", (rt) => rt.abort());
  // capacidades simuladas: downloads e sample
  await ctx.addInitScript(() => {
    window.__saved = []; try { localStorage.setItem("av:profile", JSON.stringify({ lang: "pt" })); } catch (e) {}
    const caps = {
      downloads: { save: async ({ filename, data }) => { const size = data instanceof Blob ? data.size : (data.length || data.byteLength); window.__saved.push([filename, size]); return { status: "saved" }; } },
      sample: Object.assign(async (inp, o) => { const t = /"blocks"|blocks/.test(JSON.stringify(inp)) ? JSON.stringify(await caps.sample.json()) : "# Projeto\n- item 1\n- item 2"; o && o.onText && o.onText({ text: t, delta: t }); return { text: t }; },
        { json: async (p) => ({ title: "Ciclo da água", subtitle: "Teste", blocks: [{ type: "heading", text: "Introdução", level: 1 }, { type: "paragraph", text: "A **água** circula." }, { type: "choice_question", prompt: "O que é evaporação?", options: ["a", "b", "c", "d"], correct: 1 }, { type: "match", prompt: "Ligue", left: ["x", "y"], right: ["1", "2"] }], questions: [{ prompt: "Q1", options: ["a", "b"], correct: 0, explanation: "porque" }], cards: [{ front: "f", back: "b" }], center: "Água", branches: [{ label: "Estados", children: ["sólido", "líquido"] }], lines: [{ speaker: "Ana", text: "Oi" }, { speaker: "Léo", text: "Olá" }], words: ["sol", "lua", "mar"] }) })
    };
    window.claude = { use: async (n) => caps[n] || null };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message)); p.on("console", (m) => m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text()) && errs.push("console: " + m.text()));
  await p.goto("http://localhost:8765/aulaviva-studio.html"); await p.waitForTimeout(500); console.log("BOOT ERRORS:", JSON.stringify(errs));
  const shot = (n) => p.screenshot({ path: path.join(root, "tests", "shot-" + n + ".png") });
  await shot("inicio");
  const assert = require("node:assert/strict");
  await p.getByRole("button", { name: "Organizar" }).click();
  await p.getByLabel("Novo lembrete").fill("Preparar aula de frações");
  await p.getByLabel("Data", { exact: true }).fill("2027-02-01");
  await p.getByRole("button", { name: "Adicionar", exact: true }).click();
  await p.keyboard.press("Escape");
  await p.reload();
  await p.waitForSelector(".planner-preview time");
  assert.match(await p.locator(".planner-preview").innerText(), /Preparar aula de frações/);
  for (const width of [390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    for (const card of await p.locator(".planner-card").all()) {
      const box = await card.boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= 844, "Painel diário visível ao entrar");
    }
  }
  await p.getByRole("button", { name: "Organizar" }).click();
  await p.getByRole("button", { name: "Concluir · Preparar aula de frações" }).click();
  await p.keyboard.press("Escape");
  assert.match(await p.locator(".planner-preview").innerText(), /Nenhum lembrete/);

  // criar com IA
  await p.click("text=Criar com IA"); await p.fill("#ai-topic", "Ciclo da água"); await p.click("text=Gerar material"); await p.click("text=Abrir no editor", { timeout: 30000 }); await p.waitForSelector(".ed-title");
  console.log("editor title:", await p.inputValue(".ed-title"), "blocks:", await p.locator(".blk").count());
  await p.waitForTimeout(500); await shot("editor");
  // exportar todos os formatos
  await p.click("text=Exportar"); await p.click("text=As duas");
  for (const f of ["PDF", "Word", "PowerPoint", "HTML", "Markdown", "Texto simples", "Projeto"]) { const btn = p.locator(".dlg .menu button", { hasText: f }).first(); if (await btn.count()) { await btn.click(); await p.waitForFunction(() => !document.querySelector(".dlg .spin"), null, { timeout: 30000 }); } }
  console.log("saved:", JSON.stringify(await p.evaluate(() => window.__saved)));
  await p.keyboard.press("Escape");
  for (const v of ["materiais", "modelos", "biblioteca", "atividades", "chat", "estudio", "ferramentas", "config"]) { await p.evaluate((v) => (location.hash = v), v); await p.waitForTimeout(400); await shot(v); }
  // modelos: usar um
  await p.evaluate(() => (location.hash = "modelos")); await p.waitForSelector("text=Usar modelo"); console.log("modelos:", await p.locator("text=Usar modelo").count()); await p.locator("text=Usar modelo").first().click(); await p.waitForSelector(".ed-title"); console.log("modelo aberto:", await p.inputValue(".ed-title"));
  // atividades: todas
  await p.evaluate(() => (location.hash = "atividades")); await p.waitForTimeout(300);
  const n = await p.locator(".studio .menu button").count(); let okA = 0;
  for (let i = 0; i < n; i++) { await p.locator(".studio .menu button").nth(i).click(); await p.waitForTimeout(120); if (await p.locator(".studio .paper").count()) okA++; }
  console.log("atividades com prévia:", okA, "/", n);
  // ferramentas: QR
  await p.evaluate(() => (location.hash = "ferramentas")); await p.fill("#qr-url", "https://www.ibge.gov.br"); await p.waitForTimeout(200); await shot("qr");
  // estudio: colar texto + quiz + mapa
  await p.evaluate(() => (location.hash = "estudio")); await p.click("text=Colar texto"); await p.fill(".dlg textarea", "A água evapora, condensa e precipita."); await p.click("text=Adicionar fonte");
  for (const o of ["Resumo", "Quiz interativo", "Flashcards", "Mapa mental", "Resumo em áudio"]) { await p.locator(".menu button", { hasText: o }).first().click(); await p.waitForTimeout(300); }
  console.log("estudio cards:", await p.locator("#main section.card").count()); await shot("estudio2");
  // mobile
  await p.setViewportSize({ width: 390, height: 844 });
  for (const v of ["inicio", "editor", "atividades"]) { await p.evaluate((v) => (location.hash = v), v); await p.waitForTimeout(400); const sw = await p.evaluate(() => document.documentElement.scrollWidth); console.log("mobile", v, "scrollWidth", sw); await shot("m-" + v); }
  console.log("ERRORS:", JSON.stringify(errs, null, 1));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });

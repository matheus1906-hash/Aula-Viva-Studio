// Gera as imagens do README: node tests/screenshots.cjs
const { chromium } = require("playwright"); const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, ".."), out = path.join(root, "docs", "screenshots");
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8799);
const U = "http://localhost:8799/aulaviva-studio.html";
(async () => {
  const b = await chromium.launch();
  const page = async (o) => { const ctx = await b.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, o)); await ctx.route("https://**", (r) => r.abort()); await ctx.addInitScript((lang) => localStorage.setItem("av:profile", JSON.stringify({ lang, name: "Ana Souza", school: "E.M. Rio Verde" })), (o && o.lang) || "pt"); return ctx.newPage(); };
  const shot = async (p, name, hash, prep) => { if (hash) { await p.evaluate((h) => (location.hash = h), hash); } await p.waitForTimeout(900); if (prep) await prep(p); const png = await p.screenshot();
    const encoded = await p.evaluate(async data => {
      const image = new Image();
      image.src = "data:image/png;base64," + data;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", 0.88).split(",")[1];
    }, png.toString("base64"));
    fs.writeFileSync(path.join(out, name + ".webp"), Buffer.from(encoded, "base64")); console.log(name); };
  let p = await page({ colorScheme: "light" }); await p.goto(U); await p.waitForTimeout(600);
  await shot(p, "inicio", "inicio");
  await shot(p, "livros", "acervo");
  await shot(p, "livro-detalhe", null, async (q) => { await q.locator(".bk").nth(2).click(); await q.waitForTimeout(500); });
  await shot(p, "leitor", null, async q => {
    await q.getByRole("button", { name: "Ler na plataforma" }).click();
    await q.waitForFunction(() => !document.querySelector(".rd-text .rd-loading") && (document.querySelector(".rd-text")?.textContent.length || 0) > 200);
    await q.evaluate(() => { const t = document.querySelector(".rd-text").firstChild; const r = new Range(); const i = Math.max(0, t.nodeValue.search(/[A-ZÁÉ][a-zà-ú]{3,}/)); r.setStart(t, i); r.setEnd(t, Math.min(t.nodeValue.length, i + 70)); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await q.dispatchEvent(".rd-text", "mouseup"); await q.waitForTimeout(200); await q.click(".rd-pop .rd-sw.c-yellow");
    await q.getByRole("button", { name: "Aparência" }).click(); await q.click(".rd-theme.t-paper"); await q.waitForTimeout(400);
  });
  await p.setViewportSize({width:390,height:844});
  await shot(p, "leitor-celular");
  await p.setViewportSize({width:1440,height:900});
  await q_close(p);
  await q_close(p);
  await q_close(p);
  await shot(p, "modelos", "modelos", async (q) => { await q.waitForTimeout(400); });
  await shot(p, "atividades", "atividades");
  await shot(p, "videos", "animacao", async (q) => { await q.waitForTimeout(1200); });
  await shot(p, "video-editor", null, async (q) => { await q.locator(".anim-card button.thumb").first().click(); await q.waitForTimeout(900); await q.click("text=Assistir"); await q.waitForTimeout(2600); await q.click("text=Pausar"); await q.evaluate(() => scrollTo(0, 0)); });
  await shot(p, "editor", "modelos", async (q) => { await q.locator("text=Usar modelo").nth(1).click(); await q.waitForTimeout(3800); });
  await shot(p, "estudio", "estudio");
  await shot(p, "busca-rapida", "inicio", async (q) => { await q.keyboard.press("Control+K"); await q.waitForTimeout(300); await q.keyboard.type("plano"); await q.waitForTimeout(300); });
  await p.context().close();
  p = await page({ colorScheme: "dark" }); await p.goto(U); await shot(p, "inicio-escuro", "inicio"); await shot(p, "livros-escuro", "acervo"); await p.context().close();
  p = await page({ colorScheme: "light", lang: "en" }); await p.goto(U); await shot(p, "inicio-ingles", "inicio"); await p.context().close();
  p = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: "light", isMobile: true, hasTouch: true }); await p.goto(U); await shot(p, "celular-inicio", "inicio"); await shot(p, "celular-livros", "acervo"); await p.context().close();
  p = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: "dark", isMobile: true, hasTouch: true }); await p.goto(U); await shot(p, "celular-videos", "animacao"); await p.context().close();
  await b.close(); srv.close();
  async function q_close(q) { await q.keyboard.press("Escape"); await q.waitForTimeout(200); }
})().catch((e) => { console.error(e); process.exit(1); });

const { chromium } = require("playwright"); const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, "..");
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8780);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("https://**", (r) => r.abort());
  await ctx.addInitScript((lang) => { localStorage.setItem("av:profile", JSON.stringify({ lang })); window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true }); }, process.argv[2] || "pt");
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now(); await p.goto("http://localhost:8780/aulaviva-studio.html"); await p.waitForSelector(".hero"); const tFirst = Date.now() - t0;
  const nav = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; const fcp = performance.getEntriesByName("first-contentful-paint")[0]; return { domInteractive: Math.round(n.domInteractive), fcp: fcp ? Math.round(fcp.startTime) : null }; });
  const out = { firstScreenMs: tFirst, ...nav, routes: {} };
  for (const v of ["materiais", "modelos", "biblioteca", "atividades", "animacao", "acervo", "estudio", "chat", "ferramentas", "config", "inicio"]) {
    const t = await p.evaluate(async (v) => { const s = performance.now(); location.hash = v; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - s); }, v);
    out.routes[v] = t;
  }
  // digitação no editor (custo por tecla)
  await p.evaluate(() => (location.hash = "modelos")); await p.waitForSelector("text=Usar modelo"); await p.locator("text=Usar modelo").first().click(); await p.waitForSelector(".blk textarea");
  const ta = p.locator(".blk textarea").first(); await ta.click(); const k0 = Date.now(); await ta.type("abcdefghijklmnopqrst", { delay: 0 }); out.typing20charsMs = Date.now() - k0;
  out.longTasks = await p.evaluate(() => window.__lt.sort((a, b) => b - a).slice(0, 8));
  out.heapMB = await p.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null);
  console.log(JSON.stringify(out, null, 1)); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });

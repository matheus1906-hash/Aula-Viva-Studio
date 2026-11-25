const { chromium } = require("playwright"); const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, ".."); const axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8781);
(async () => {
  const b = await chromium.launch(); const agg = {};
  for (const scheme of ["light", "dark"]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    await p.route("https://**", (r) => r.abort()); await p.addInitScript(() => localStorage.setItem("av:profile", JSON.stringify({ lang: "pt" })));
    await p.goto("http://localhost:8781/aulaviva-studio.html"); await p.waitForTimeout(300); await p.evaluate(axe);
    for (const v of ["inicio", "materiais", "modelos", "biblioteca", "atividades", "animacao", "acervo", "estudio", "chat", "ferramentas", "config"]) {
      await p.evaluate((v) => (location.hash = v), v); await p.waitForTimeout(500);
      const res = await p.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"], resultTypes: ["violations"] })).violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, ex: x.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 2).join("")) })));
      res.forEach((x) => { const k = scheme + " " + x.id; agg[k] = agg[k] || { impact: x.impact, views: [], n: 0, ex: x.ex }; agg[k].views.push(v); agg[k].n += x.n; });
    }
    await p.close();
  }
  for (const [k, v] of Object.entries(agg)) console.log(k, v.impact, "n=" + v.n, v.views.join(","), "\n   " + v.ex.join("\n   "));
  if (Object.keys(agg).length) process.exitCode = 1;
  await b.close(); srv.close();
})();

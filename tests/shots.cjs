const { chromium } = require("playwright"); const path = require("path"), fs = require("fs"), http = require("http");
const root = path.join(__dirname, ".."); const views = (process.argv[2] || "inicio").split(","); const theme = process.argv[3] || "light"; const lang = process.argv[4] || "pt"; const w = +(process.argv[5] || 1280);
const srv = http.createServer((q, r) => { const f = path.join(root, "dist", decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); r.end(d); } }); }).listen(8770);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: w, height: 860 }, colorScheme: theme });
  await p.route("https://**", (r) => r.abort());
  await p.addInitScript((l) => { localStorage.setItem("av:profile", JSON.stringify({ lang: l, name: "Ana Souza" })); }, lang);
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8770/aulaviva-studio.html"); await p.waitForTimeout(500);
  for (const v of views) { await p.evaluate((v) => (location.hash = v), v); await p.waitForTimeout(700); await p.screenshot({ path: path.join(root, "tests", "v-" + v + "-" + theme + "-" + lang + (w < 600 ? "-m" : "") + ".png") }); }
  console.log("errors", JSON.stringify(errs)); await b.close(); srv.close();
})();

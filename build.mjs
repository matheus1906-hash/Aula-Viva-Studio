import fs from "node:fs";
const order = ["core.js", "i18n.js", "i18n-dict.js", "i18n-extra.js", "importers.js", "exporters.js", "atividades.js", "biblioteca-data.js", "providers.js", "ai.js", "ai-settings.js", "preview.js", "editor.js", "views.js", "chat-studio.js", "animacao.js", "animacao-modelos.js", "views2.js", "main.js"];
const js = order.filter((f) => fs.existsSync("src/" + f)).map((f) => "/* " + f + " */\n" + fs.readFileSync("src/" + f, "utf8")).join("\n;\n");
const css = fs.readFileSync("src/app.css", "utf8") + "\n" + fs.readFileSync("src/theme-v4.css", "utf8");
const v4 = fs.existsSync("src/icons-v4.html") ? fs.readFileSync("src/icons-v4.html", "utf8") : "";
const v4ids = new Set([...v4.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
const strip = (t) => t.replace(/<symbol id="([^"]+)"[\s\S]*?<\/symbol>\s*/g, (m, id) => (v4ids.has(id) ? "" : m));
const icons = v4 + strip(fs.readFileSync("src/icons-app.html", "utf8"));
const shellSrc = strip(fs.readFileSync("src/shell.html", "utf8"));
let html = shellSrc.replace("<!--ICONS-->", () => icons);
if (js.includes("</script")) throw new Error("JS contains </script");
html = html.replace("/*CSS*/", () => css).replace("/*JS*/", () => js);
fs.mkdirSync("dist/data", { recursive: true });
fs.writeFileSync("dist/aulaviva-studio.html", html);
// modelos: originais + extras (placeholders de caça-palavras/cruzadinha viram atividades geradas)
globalThis.AV = {}; const vm = await import("node:vm");
vm.runInThisContext(fs.readFileSync("src/atividades.js", "utf8"));
let modelos = JSON.parse(fs.readFileSync("data/modelos.json", "utf8"));
if (fs.existsSync("data/modelos-extra.json")) {
  const extra = JSON.parse(fs.readFileSync("data/modelos-extra.json", "utf8")); let seed = 7;
  for (const x of extra) {
    x.doc.blocks = x.doc.blocks.flatMap((b) => {
      if (b.type === "gen_wordsearch") return AV.atividades.wordSearch({ title: b.title, words: b.words, seed: seed++ });
      if (b.type === "gen_crossword") return AV.atividades.crossword({ title: b.title, entries: (b.entries || []).map((e) => ({ answer: e[0], clue: e[1] })), seed: seed++ });
      return [b];
    });
  }
  const ids = new Set(modelos.map((m) => m.id)); modelos = modelos.concat(extra.filter((x) => !ids.has(x.id)));
}
fs.writeFileSync("dist/data/modelos.json", JSON.stringify(modelos));
const repos = JSON.parse(fs.readFileSync("data/acervo-repos.json", "utf8"));
const obras = fs.existsSync("data/acervo-obras.json") ? JSON.parse(fs.readFileSync("data/acervo-obras.json", "utf8")) : [];
const acervo = { repositorios: repos, obras };
const livros = fs.existsSync("data/livros.json") ? JSON.parse(fs.readFileSync("data/livros.json", "utf8")) : [];
fs.writeFileSync("dist/data/livros.json", JSON.stringify(livros));
fs.writeFileSync("dist/data/acervo.json", JSON.stringify(acervo));
// versão para hospedar: arquivo único, modelos embutidos
const inline = "globalThis.AV=globalThis.AV||{};AV.MODELOS_INLINE=" + JSON.stringify(modelos).replace(/<\//g, "<\\/") + ";AV.ACERVO_INLINE=" + JSON.stringify(acervo).replace(/<\//g, "<\\/") + ";AV.LIVROS_INLINE=" + JSON.stringify(livros).replace(/<\//g, "<\\/") + ";\n";
const solo = shellSrc.replace("<!--ICONS-->", () => icons).replace("/*CSS*/", () => css).replace("/*JS*/", () => inline + js)
  .replace("<title>", '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>').replace("<style>", "<style>body{margin:0}") + "</body></html>";
fs.writeFileSync("dist/aulaviva-studio-standalone.html", solo.replace('<svg width="0"', '</head><body><svg width="0"'));
// site pronto para hospedar (GitHub Pages, Vercel, Netlify): dist/site/index.html
fs.mkdirSync("dist/site", { recursive: true });
fs.copyFileSync("dist/aulaviva-studio-standalone.html", "dist/site/index.html");
fs.writeFileSync("dist/site/.nojekyll", "");
console.log("modelos", modelos.length, "obras", obras.length, "livros", livros.length);
console.log("dist/aulaviva-studio.html", (html.length / 1024).toFixed(0) + " KB", "missing:", order.filter((f) => !fs.existsSync("src/" + f)));

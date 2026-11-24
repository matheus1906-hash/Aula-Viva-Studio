import fs from "node:fs";
import { createHash } from "node:crypto";
import { readingText } from "./reading-text.mjs";
import { gunzipSync, gzipSync } from "node:zlib";
const order = ["core.js", "vault.js", "i18n.js", "i18n-dict.js", "i18n-extra.js", "importers.js", "exporters.js", "atividades.js", "biblioteca-data.js", "providers.js", "ai.js", "ai-live.js", "ai-settings.js", "preview.js", "editor.js", "home-planner.js", "views.js", "chat-studio.js", "animacao.js", "animacao-modelos.js", "reader.js", "views2.js", "auth.js", "main.js"];
const js = order.filter((f) => fs.existsSync("src/" + f)).map((f) => "/* " + f + " */\n" + fs.readFileSync("src/" + f, "utf8")).join("\n;\n");
const fonts = [["Figtree","figtree"],["Bricolage Grotesque","bricolagegrotesque"]].map(([family, file]) => {
  const encoded = fs.readFileSync("data/fonts/" + file + ".ttf").toString("base64");
  return "@font-face{font-family:'" + family + "';font-style:normal;font-weight:300 900;font-display:swap;src:url(data:font/ttf;base64," + encoded + ") format('truetype')}";
}).join("\n");
const css = fonts + "\n" + fs.readFileSync("src/app.css", "utf8") + "\n" + fs.readFileSync("src/theme-v4.css", "utf8");
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
let seed = 7;
for (const extraFile of ["data/modelos-extra.json", "data/modelos-novos.json"]) {
  if (!fs.existsSync(extraFile)) continue;
  const extra = JSON.parse(fs.readFileSync(extraFile, "utf8"));
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
const { extras, edicoes } = JSON.parse(fs.readFileSync("data/edicoes.json", "utf8"));
const livros = JSON.parse(fs.readFileSync("data/livros.json", "utf8")).concat(extras);
const textosInline = {};
for (const dir of ["dist/data/textos", "dist/site/data/textos"]) fs.mkdirSync(dir, { recursive: true });
for (const livro of livros) {
  const edicao = edicoes[livro.id];
  Object.assign(livro, edicao);
  const compressed = fs.readFileSync("data/textos/" + livro.id + ".txt.gz");
  const texto = gunzipSync(compressed);
  if (texto.length !== edicao.bytes) throw new Error("Texto incompleto: " + livro.title);
  const formatted = Buffer.from(readingText(texto.toString("utf8"), livro));
  livro.bytes = formatted.length;
  livro.local = "data/textos/" + livro.id + ".txt";
  fs.writeFileSync("dist/" + livro.local, formatted);
  fs.writeFileSync("dist/site/" + livro.local, formatted);
  textosInline[livro.id] = gzipSync(formatted).toString("base64");
}
fs.writeFileSync("dist/data/livros.json", JSON.stringify(livros));
fs.writeFileSync("dist/data/acervo.json", JSON.stringify(acervo));
// versão para hospedar: arquivo único, modelos embutidos
const shots = fs.existsSync("data/login-shots.json") ? fs.readFileSync("data/login-shots.json", "utf8") : "[]";
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https: data: blob: http://localhost:11434 http://127.0.0.1:11434; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://archive.org; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests";
fs.writeFileSync("dist/csp.txt", CSP);
const inline = "globalThis.AV=globalThis.AV||{};AV.STANDALONE=true;AV.LOGIN_SHOTS=" + shots + ";AV.MODELOS_INLINE=" + JSON.stringify(modelos).replace(/<\//g, "<\\/") + ";AV.ACERVO_INLINE=" + JSON.stringify(acervo).replace(/<\//g, "<\\/") + ";AV.LIVROS_INLINE=" + JSON.stringify(livros).replace(/<\//g, "<\\/") + ";\n";
const solo = shellSrc.replace("<!--ICONS-->", () => icons).replace("/*CSS*/", () => css).replace("/*JS*/", () => inline + js)
  .replace("<title>", '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="' + CSP + '"><meta name="referrer" content="no-referrer"><title>').replace("<style>", "<style>body{margin:0}") + "</body></html>";
fs.writeFileSync("dist/aulaviva-studio-standalone.html", solo.replace('<svg width="0"', '</head><body><svg width="0"'));
// site pronto para hospedar (GitHub Pages, Vercel, Netlify): dist/site/index.html
fs.mkdirSync("dist/site", { recursive: true });
fs.copyFileSync("dist/aulaviva-studio-standalone.html", "dist/site/index.html");
// Apenas a distribuição offline transporta o acervo inteiro no HTML.
const offline = fs.readFileSync("dist/site/index.html", "utf8").replace("AV.STANDALONE=true;", () =>
  "AV.STANDALONE=true;AV.TEXTOS_INLINE=" + JSON.stringify(textosInline) + ";");
fs.writeFileSync("dist/aulaviva-studio-standalone.html", offline);
for (const dir of ["dist", "dist/site"]) {
  const scanDir = dir + "/data/facsimiles";
  fs.mkdirSync(scanDir, { recursive: true });
  const files = fs.readdirSync("data/facsimiles").sort();
  for (const book of livros.filter(b => b.facsimile)) {
    const file = book.id + ".pdf";
    const parts = files.filter(name => name === file || name.startsWith(file + "."));
    if (!parts.length) throw new Error("Digitalização ausente: " + book.title);
    fs.writeFileSync(scanDir + "/" + file, "");
    const hash = createHash("sha256");
    for (const part of parts) {
      const data = fs.readFileSync("data/facsimiles/" + part);
      hash.update(data);
      fs.appendFileSync(scanDir + "/" + file, data);
    }
    if (hash.digest("hex") !== book.facsimileSha256) throw new Error("Digitalização incompleta: " + book.title);
  }
  fs.mkdirSync(dir + "/reader-pdf", { recursive: true });
  for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"]) fs.copyFileSync("node_modules/reader-pdf/build/" + file, dir + "/reader-pdf/" + file);
  for (const path of ["standard_fonts","cmaps","wasm","LICENSE"]) fs.cpSync("node_modules/reader-pdf/" + path, dir + "/reader-pdf/" + path, {recursive:true});
}
fs.copyFileSync("src/planos.html", "dist/site/planos.html");
fs.copyFileSync("src/planos.html", "dist/planos.html");
fs.writeFileSync("dist/site/.nojekyll", "");
console.log("modelos", modelos.length, "obras", obras.length, "livros", livros.length);
console.log("dist/aulaviva-studio.html", (html.length / 1024).toFixed(0) + " KB", "missing:", order.filter((f) => !fs.existsSync("src/" + f)));

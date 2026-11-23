// node tests/exporters.test.mjs  (exit code 0 on success)
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const reqs = [createRequire(path.join(root, "package.json")), createRequire("/home/user/aulaviva-web/package.json")];
const need = (name) => {
  let last;
  for (const r of reqs) { try { return r(name); } catch (e) { last = e; } }
  throw last;
};

// Load src/exporters.js with vm; the sandbox "window" carries the libraries (as the browser would).
const win = { jspdf: need("jspdf"), docx: need("docx"), PptxGenJS: need("pptxgenjs"), JSZip: need("jszip") };
globalThis.AV = { loadScript: async () => {} };
const code = fs.readFileSync(path.join(root, "src", "exporters.js"), "utf8");
vm.runInThisContext("(function(window){" + code + "\n})", { filename: "src/exporters.js" })(win);
const AV = globalThis.AV;
const JSZip = win.JSZip;

const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixture-doc.json"), "utf8"));
let passed = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log("ok -", name); }, (e) => { console.error("FAIL -", name); throw e; });
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());

// ---------------------------------------------------------------- QR
await ok("qr matrix: square, finder patterns, timing, valid format info", () => {
  const m = AV.qr.matrix("https://www.ibge.gov.br");
  const n = m.length;
  assert.ok(n >= 21 && (n - 17) % 4 === 0, "size = 4v+17");
  m.forEach((r) => { assert.equal(r.length, n); r.forEach((c) => assert.equal(typeof c, "boolean")); });
  const finder = (x0, y0) => {
    for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      assert.equal(m[y0 + dy][x0 + dx], d !== 2, `finder at ${x0},${y0} cell ${dx},${dy}`);
    }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  for (let i = 8; i < n - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
  assert.equal(m[n - 8][8], true, "dark module");
  // the two copies of the 15 format bits agree and form a valid BCH codeword for ECC level M
  const a = [], b = [];
  for (let i = 0; i < 15; i++) {
    a.push(i < 6 ? m[i][8] : i === 6 ? m[7][8] : i === 7 ? m[8][8] : i === 8 ? m[8][7] : m[8][14 - i]);
    b.push(i < 8 ? m[8][n - 1 - i] : m[n - 15 + i][8]);
  }
  assert.deepEqual(a, b);
  let v = 0; a.forEach((bit, i) => { if (bit) v |= 1 << i; });
  v ^= 0x5412;
  let rem = v; for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  assert.equal(rem, 0, "BCH remainder");
  assert.equal((v >>> 13) & 3, 0, "ECC level M indicator");
});
await ok("qr matrix: versions grow, long text is handled without throwing", () => {
  assert.equal(AV.qr.matrix("A").length, 21);
  assert.ok(AV.qr.matrix("x".repeat(150), "M").length > 41);
  assert.equal(AV.qr.matrix("x".repeat(5000)).length, 0);
  assert.ok(AV.qr.matrix("Atenção ção", "H").length >= 21);
});

// ------------------------------------------------------------ formats
await ok("formats list", () => {
  assert.deepEqual(AV.exporters.formats.map((f) => f.id), ["pdf", "docx", "pptx", "html", "md", "txt", "json"]);
  assert.equal(AV.exporters.formats[0].label, "PDF interativo");
});

const out = {};
for (const f of AV.exporters.formats) {
  for (const version of ["aluno", "professor"]) {
    await ok(`export ${f.id} (${version})`, async () => {
      const r = await AV.exporters.export(fixture, f.id, { version });
      assert.ok(r.blob.size > 0, "non-empty blob");
      const expect = "fracoes-no-dia-a-dia" + (f.id === "json" ? "" : "-" + version) + "." + f.ext;
      assert.equal(r.filename, expect);
      out[f.id + ":" + version] = r;
    });
  }
}

await ok("docx and pptx are valid zips", async () => {
  for (const v of ["aluno", "professor"]) {
    const dz = await JSZip.loadAsync(await bytes(out["docx:" + v].blob));
    assert.ok(dz.file("word/document.xml"), "word/document.xml");
    const xml = await dz.file("word/document.xml").async("string");
    assert.ok(xml.includes("Frações no dia a dia") || xml.includes("Fra"), "title text in docx");
    const pz = await JSZip.loadAsync(await bytes(out["pptx:" + v].blob));
    assert.ok(pz.file("ppt/slides/slide1.xml"), "ppt/slides/slide1.xml");
    const slides = Object.keys(pz.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k));
    assert.ok(slides.length >= 8, "several slides, got " + slides.length);
  }
  const t = await (await JSZip.loadAsync(await bytes(out["docx:professor"].blob))).file("word/document.xml").async("string");
  assert.ok(t.includes("(X)"), "teacher docx marks the correct option");
  const s = await (await JSZip.loadAsync(await bytes(out["docx:aluno"].blob))).file("word/document.xml").async("string");
  assert.ok(!s.includes("(X)") && s.includes("Gabarito"), "student docx hides answers, has answer key");
});

await ok("pdf: header, interactive fields (student), links", async () => {
  const stu = (await bytes(out["pdf:aluno"].blob)).toString("latin1");
  const tea = (await bytes(out["pdf:professor"].blob)).toString("latin1");
  assert.ok(stu.startsWith("%PDF"), "student starts with %PDF");
  assert.ok(tea.startsWith("%PDF"), "teacher starts with %PDF");
  assert.ok(stu.includes("/AcroForm"), "student has /AcroForm");
  assert.ok(!tea.includes("/AcroForm"), "teacher has no form");
  assert.ok(stu.includes("/URI"), "link annotations");
  assert.ok(stu.includes("/Widget"), "form widgets");
});

await ok("pdf: protection with owner password", async () => {
  const d = JSON.parse(JSON.stringify(fixture));
  Object.assign(d.meta, { protect: true, owner_password: "segredo", allow_print: true, allow_copy: false });
  const r = await AV.exporters.export(d, "pdf", { version: "aluno" });
  const s = (await bytes(r.blob)).toString("latin1");
  assert.ok(s.startsWith("%PDF") && s.includes("/Encrypt"), "encrypted");
});

await ok("pdf: minimal documents (no cover/toc, empty, odd input)", async () => {
  const mini = { meta: { title: "Mini", cover: false, toc: false }, blocks: [{ id: "a", type: "paragraph", text: "Olá → mundo ✓ 😀" }] };
  for (const d of [mini, { meta: {}, blocks: [] }, null, {}, { blocks: [null, 5, { type: "nope" }] }]) {
    const b = await AV.exporters.toPDF(d, { version: "aluno" });
    assert.ok((await bytes(b)).toString("latin1").startsWith("%PDF"));
  }
});

await ok("html: standalone, escaped, accessible", () => {
  const h = out["html:aluno"].blob;
  return h.text().then((s) => {
    assert.ok(/^<!doctype html>/i.test(s) && s.includes('lang="pt-BR"') && s.includes("</html>"));
    assert.ok(s.includes('type="radio"') && s.includes("<textarea"), "student fields");
    assert.ok(!s.includes("<script"), "no script");
    assert.ok(s.includes("Gabarito"));
    assert.ok(s.includes("<svg"), "qr svg");
    const evil = { meta: { title: '<img src=x onerror=alert(1)>' }, blocks: [
      { id: "1", type: "paragraph", text: "<script>alert(1)</script> **b**" },
      { id: "2", type: "link", label: "x", url: "javascript:alert(1)" },
      { id: "3", type: "image", data: 'data:image/png;base64,AAAA" onerror="alert(1)', caption: "c" } ] };
    const e = AV.exporters.toHTML(evil, { version: "aluno" });
    assert.ok(!e.includes("<img src=x") && !e.includes("<script>alert") && !e.includes('href="javascript:') && !e.includes("onerror=\"alert"), "escaped");
    assert.ok(e.includes("&lt;script&gt;"));
    const t = AV.exporters.toHTML(fixture, { version: "professor" });
    assert.ok(t.includes("resposta correta") && !t.includes("<textarea"));
  });
});

await ok("markdown and txt", async () => {
  const mdS = await out["md:aluno"].blob.text(), mdT = await out["md:professor"].blob.text();
  const txS = await out["txt:aluno"].blob.text(), txT = await out["txt:professor"].blob.text();
  assert.ok(mdS.startsWith("# Frações no dia a dia") && mdS.includes("## Parte 1: conceitos") && mdS.includes("## Gabarito"));
  assert.ok(mdS.includes("| Fração | Desenho |") && mdS.includes("![Figura 1](data:image/png"));
  assert.ok(mdT.includes("**B) 4/8**") && !mdT.includes("## Gabarito"));
  assert.ok(txS.includes("FRAÇÕES NO DIA A DIA") && !txS.includes("**") && txS.includes("GABARITO"));
  assert.ok(txT.includes("[X] B) 4/8") && txT.includes("Em 3/8, o número 8 é o denominador"));
  assert.ok(txS.includes("______") && !txS.includes("Em 3/8, o número 8"));
  assert.ok(AV.exporters.toTXT(null).length > 0 && AV.exporters.toMarkdown({}).length > 0);
});

await ok("json export and slug", async () => {
  assert.equal(await out["json:aluno"].blob.text(), JSON.stringify(fixture));
  assert.equal(AV.exporters.slug("  Avaliação: Ciências!! 5º ano "), "avaliacao-ciencias-5-ano");
  assert.equal(AV.exporters.slug(""), "documento");
});

console.log(`\n${passed} checks passed`);

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
// node_modules may be a symlink in the checkout; fall back to the main checkout
let req = createRequire(path.join(root, "package.json"));
try { req.resolve("jszip"); } catch (e) { req = createRequire("/home/user/aulaviva-web/package.json"); }

const JSZip = req("jszip");
const mammoth = req("mammoth");
const docx = req("docx");
const PptxGenJS = req("pptxgenjs");
globalThis.JSZip = JSZip;
globalThis.mammoth = { convertToHtml: (o) => mammoth.convertToHtml(o.arrayBuffer ? { buffer: Buffer.from(o.arrayBuffer) } : o) };
globalThis.AV = { loadScript: async () => {} };
req(path.join(root, "src/importers.js"));
const I = globalThis.AV.importers;

const mkFile = (name, data) => {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return { name, size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
};
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

// ---- parseQuickList
await t("parseQuickList docstring example", () => {
  const b = I.parseQuickList(I.QUICKLIST_EXAMPLE);
  assert.deepEqual(b.map((x) => x.type), ["callout", "choice_question", "true_false", "open_question"]);
  assert.equal(b[0].text, "Leia cada questão com atenção.");
  assert.equal(b[0].style, "atencao");
  assert.equal(b[1].prompt, "Quanto é 7 × 8?");
  assert.deepEqual(b[1].options, ["54", "56", "58", "64"]);
  assert.equal(b[1].correct, 1);
  assert.deepEqual(b[2].statements, ["O Sol é uma estrela.", "A Lua tem luz própria."]);
  assert.deepEqual(b[2].answers, [true, false]);
  assert.equal(b[3].lines, 5);
  assert.match(b[3].answer, /^Processo em que/);
  assert.ok(b.every((x) => typeof x.id === "string" && x.id));
});
await t("parseQuickList headings, markers and edge cases", () => {
  const b = I.parseQuickList("# Seção A\n## Sub\n\n1. Capital?\n(x) a) Brasília\nb) Rio\n\n2) Cor?\na) Azul ✓\nb) Verde\n\n3) Outra\na) x\nb) y\nResposta: B\n\n4) Aberta sem resposta");
  assert.deepEqual(b.map((x) => x.type), ["heading", "heading", "choice_question", "choice_question", "choice_question", "open_question"]);
  assert.equal(b[0].level, 1); assert.equal(b[1].level, 2);
  assert.equal(b[2].correct, 0); assert.equal(b[3].correct, 0); assert.equal(b[4].correct, 1);
  assert.equal(b[5].lines, 4); assert.equal(b[5].answer, "");
  assert.deepEqual(I.parseQuickList(""), []);
  assert.deepEqual(I.parseQuickList(null), []);
  const c = I.parseQuickList("1) Q\na) um (correta)\nb) dois");
  assert.equal(c[0].correct, 0); assert.equal(c[0].options[0], "um");
  const l = I.parseQuickList("1) Q\nLinhas: 99");
  assert.equal(l[0].lines, 12);
});

// ---- textToBlocks
await t("textToBlocks heuristics", () => {
  const r = I.textToBlocks("Introdução\n\nEste é um parágrafo completo.\n\n- um\n• dois\n\n1) Quanto é 1+1?\na) 1\n*b) 2\n\nTexto final.", { title: "T" });
  assert.equal(r.title, "T");
  assert.deepEqual(r.blocks.map((x) => x.type), ["heading", "paragraph", "bullets", "choice_question", "paragraph"]);
  assert.deepEqual(r.blocks[2].items, ["um", "dois"]);
  assert.equal(r.blocks[3].correct, 1);
  assert.equal(I.textToBlocks("").blocks.length, 0);
});

// ---- txt / rtf / srt / vtt
await t("importFile txt and md", async () => {
  const r = await I.importFile(mkFile("minha_aula.txt", "Título curto\n\nUm parágrafo com acentuação: ção.\n"));
  assert.equal(r.title, "minha aula");
  assert.equal(r.blocks[0].type, "heading");
  assert.match(r.text, /ção/);
  const m = await I.importFile(mkFile("a.md", "# Olá\n\ntexto aqui."));
  assert.equal(m.blocks[0].text, "Olá");
});
await t("importFile rtf", async () => {
  const rtf = "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Aprender \\'e9 bom.\\par Segunda linha com \\u231?\\'e3o.\\par}";
  const r = await I.importFile(mkFile("x.rtf", rtf));
  assert.match(r.blocks.map((b) => b.text).join(" "), /Aprender é bom\./);
  assert.match(r.blocks.map((b) => b.text).join(" "), /çã/);
  assert.ok(!/fonttbl|Arial/.test(r.text));
});
await t("importFile srt and vtt", async () => {
  const srt = "1\n00:00:01,000 --> 00:00:03,000\nOlá, <i>turma</i>.\n\n2\n00:00:03,500 --> 00:00:05,000\nHoje vamos aprender.\n";
  const r = await I.importFile(mkFile("v.srt", srt));
  assert.equal(r.blocks.length, 2);
  assert.equal(r.blocks[1].text, "Olá, turma. Hoje vamos aprender.");
  assert.ok(!/-->|00:00/.test(r.text));
  const vtt = "WEBVTT\n\n00:01.000 --> 00:03.000 align:start\nLinha um.\n\n00:03.000 --> 00:04.000\nLinha um.\n\n00:04.000 --> 00:06.000\nLinha dois.\n";
  const v = await I.importFile(mkFile("v.vtt", vtt));
  assert.equal(v.blocks[1].text, "Linha um. Linha dois.");
});

// ---- docx
await t("importFile docx (built with docx lib)", async () => {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell } = docx;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
  const d = new Document({ sections: [{ children: [
    new Paragraph({ text: "Título Principal", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: "Subtítulo", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ children: [new TextRun("Texto com "), new TextRun({ text: "negrito", bold: true }), new TextRun(".")] }),
    new Paragraph({ text: "item um", bullet: { level: 0 } }),
    new Paragraph({ text: "item dois", bullet: { level: 0 } }),
    new Table({ rows: [new TableRow({ children: ["A", "B"].map((x) => new TableCell({ children: [new Paragraph(x)] })) }),
      new TableRow({ children: ["1", "2"].map((x) => new TableCell({ children: [new Paragraph(x)] })) })] }),
    new Paragraph({ children: [new docx.ImageRun({ data: png, transformation: { width: 20, height: 20 } })] }),
  ] }] });
  const buf = await Packer.toBuffer(d);
  const r = await I.importFile(mkFile("aula.docx", buf));
  const types = r.blocks.map((b) => b.type);
  assert.deepEqual(types.slice(0, 2), ["heading", "heading"]);
  assert.equal(r.blocks[0].level, 1); assert.equal(r.blocks[1].level, 2);
  assert.equal(r.title, "Título Principal");
  assert.ok(types.includes("paragraph")); assert.ok(types.includes("bullets")); assert.ok(types.includes("table")); assert.ok(types.includes("image"));
  assert.match(r.blocks.find((b) => b.type === "paragraph").text, /\*\*negrito\*\*/);
  assert.deepEqual(r.blocks.find((b) => b.type === "bullets").items, ["item um", "item dois"]);
  assert.deepEqual(r.blocks.find((b) => b.type === "table").rows, [["A", "B"], ["1", "2"]]);
  assert.match(r.blocks.find((b) => b.type === "image").data, /^data:image\/png;base64,/);
});

// ---- pptx
await t("importFile pptx (built with pptxgenjs)", async () => {
  const p = new PptxGenJS();
  let s = p.addSlide(); s.addText("Primeiro Slide", { x: 1, y: 0.5, w: 8, h: 1 }); s.addText("Ponto A\nPonto B", { x: 1, y: 2, w: 8, h: 1 });
  s = p.addSlide(); s.addText("Segundo & Último", { x: 1, y: 0.5, w: 8, h: 1 }); s.addText("Só um ponto", { x: 1, y: 2, w: 8, h: 1 });
  const buf = await p.write({ outputType: "nodebuffer" });
  const r = await I.importFile(mkFile("slides.pptx", buf));
  const h = r.blocks.filter((b) => b.type === "heading").map((b) => b.text);
  assert.deepEqual(h, ["Primeiro Slide", "Segundo & Último"]);
  const bl = r.blocks.filter((b) => b.type === "bullets");
  assert.deepEqual(bl[0].items, ["Ponto A", "Ponto B"]);
  assert.deepEqual(bl[1].items, ["Só um ponto"]);
  assert.equal(r.title, "Primeiro Slide");
});

// ---- odt
await t("importFile odt (zip built with JSZip)", async () => {
  const z = new JSZip();
  z.file("mimetype", "application/vnd.oasis.opendocument.text");
  z.file("content.xml", `<?xml version="1.0"?><office:document-content xmlns:office="o" xmlns:text="t" xmlns:table="tb"><office:body><office:text>
<text:h text:outline-level="1">Cabeçalho</text:h><text:p>Parágrafo com <text:span>estilo</text:span> e&amp;mais.</text:p>
<text:list><text:list-item><text:p>um</text:p></text:list-item><text:list-item><text:p>dois</text:p></text:list-item></text:list>
<table:table><table:table-row><table:table-cell><text:p>X</text:p></table:table-cell><table:table-cell><text:p>Y</text:p></table:table-cell></table:table-row></table:table>
</office:text></office:body></office:document-content>`);
  const buf = await z.generateAsync({ type: "nodebuffer" });
  const r = await I.importFile(mkFile("a.odt", buf));
  assert.deepEqual(r.blocks.map((b) => b.type), ["heading", "paragraph", "bullets", "table"]);
  assert.equal(r.blocks[1].text, "Parágrafo com estilo e&mais.");
  assert.deepEqual(r.blocks[2].items, ["um", "dois"]);
  assert.deepEqual(r.blocks[3].rows, [["X", "Y"]]);
});

// ---- json, images, errors
await t("importFile json, image, limits, macros, bad extension", async () => {
  const fx = readFileSync(path.join(here, "fixture-doc.json"), "utf8");
  const j = await I.importFile(mkFile("doc.json", fx));
  assert.equal(j.doc.blocks.length, 19);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
  const im = await I.importFile(mkFile("foto.png", png));
  assert.equal(im.blocks[0].type, "image");
  assert.match(im.blocks[0].data, /^data:image\/png;base64,/);
  await assert.rejects(() => I.importFile(mkFile("a.exe", "x")), /não suportado/);
  await assert.rejects(() => I.importFile({ name: "a.txt", size: 26 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(1) }), /25 MB/);
  const z = new JSZip(); z.file("word/document.xml", "<x/>"); z.file("word/vbaProject.bin", "x");
  const macroZip = await z.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => I.importFile(mkFile("m.docx", macroZip)), /macros/);
  await assert.rejects(() => I.importFile(mkFile("bad.json", "{nope")), /JSON/);
  await assert.rejects(() => I.importFile(mkFile("vazio.txt", "   \n")), /conteúdo/);
});

// ---- sanitizeDoc
await t("sanitizeDoc round-trips the fixture", () => {
  const fx = JSON.parse(readFileSync(path.join(here, "fixture-doc.json"), "utf8"));
  const out = I.sanitizeDoc(fx);
  assert.equal(out.blocks.length, fx.blocks.length);
  assert.deepEqual(out.blocks, fx.blocks);
  assert.deepEqual(out.meta, fx.meta);
  assert.equal(out.id, "fx1");
  assert.deepEqual(I.sanitizeDoc(out), out);
});
await t("sanitizeDoc on garbage", () => {
  for (const g of [null, undefined, 5, "x", [], {}, { blocks: "no", meta: 3 }]) {
    const d = I.sanitizeDoc(g);
    assert.deepEqual(d.blocks, []); assert.ok(d.id); assert.equal(d.version, 1);
    assert.equal(d.meta.kind, "apostila"); assert.equal(d.meta.theme, "Azul escolar"); assert.equal(d.meta.allow_print, true);
  }
  const d = I.sanitizeDoc({ meta: { kind: "x", theme: "y", title: 5 }, blocks: [null, 3, { type: "evil" }, { type: "script", text: "x" },
    { type: "link", label: "  a  ", url: "javascript:alert(1)" }, { type: "link", url: "mailto:a@b.c" }, { type: "qrcode", url: "data:text/html,x", size: 999 },
    { type: "heading", text: "x".repeat(1000), level: 7 }, { type: "image", data: "http://x/y.png", width: 5 },
    { id: "d", type: "divider" }, { id: "d", type: "divider" }, { type: "choice_question", options: ["a", "b"], correct: 9 }] });
  assert.equal(d.meta.kind, "apostila"); assert.equal(d.meta.title, "Sem título");
  assert.deepEqual(d.blocks.map((b) => b.type), ["link", "link", "qrcode", "heading", "image", "divider", "divider", "choice_question"]);
  assert.equal(d.blocks[0].label, "a"); assert.equal(d.blocks[0].url === "", true);
  assert.equal(d.blocks[1].url, "mailto:a@b.c");
  assert.equal(d.blocks[2].url, ""); assert.equal(d.blocks[2].size, 60);
  assert.ok(d.blocks[3].text.length <= 300); assert.equal(d.blocks[3].level, 1);
  assert.equal(d.blocks[4].data, ""); assert.equal(d.blocks[4].width, 20);
  assert.notEqual(d.blocks[5].id, d.blocks[6].id);
  assert.equal(d.blocks[7].correct, -1);
  assert.ok(new Set(d.blocks.map((b) => b.id)).size === d.blocks.length);
});

// ---- videoLink
await t("videoLink", () => {
  assert.equal(I.videoLink("https://youtu.be/dQw4w9WgXcQ?t=90").url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s");
  assert.equal(I.videoLink("https://www.youtube.com/shorts/dQw4w9WgXcQ").url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(I.videoLink("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s&feature=x").url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s");
  assert.match(I.videoLink("youtu.be/dQw4w9WgXcQ?t=90").info, /1:30/);
  assert.equal(I.videoLink("https://vimeo.com/123456789?x=1").url, "https://vimeo.com/123456789");
  assert.equal(I.videoLink("https://drive.google.com/open?id=ABC_def-1").url, "https://drive.google.com/file/d/ABC_def-1/view");
  assert.equal(I.videoLink("https://drive.google.com/file/d/XYZ123/view?usp=sharing").url, "https://drive.google.com/file/d/XYZ123/view");
  assert.equal(I.videoLink("javascript:alert(1)").url, "");
  assert.equal(I.videoLink("").url, "");
});

console.log(`\n${n} tests passed (pdf import not covered: needs pdfjs + browser)`);

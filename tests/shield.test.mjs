// Testes do Escudo (varredura de arquivos) com arquivos maliciosos simulados.
import fs from "node:fs"; import vm from "node:vm"; import zlib from "node:zlib";
globalThis.AV = {}; vm.runInThisContext(fs.readFileSync(new URL("../src/shield.js", import.meta.url), "utf8"));
let fails = 0;
const expect = (name, verdict, wantOk) => { const pass = verdict.ok === wantOk; console.log((pass ? "PASS " : "FAIL ") + name + (verdict.reason ? " → " + verdict.reason : "")); if (!pass) fails++; };
const enc = (s) => new TextEncoder().encode(s);
/* monta um ZIP mínimo (sem compressão) com as entradas dadas: [[nome, conteúdo, tamanhoDeclarado?]] */
function zip(entries) {
  const parts = [], central = []; let off = 0;
  for (const [name, data, fakeSize] of entries) {
    const n = enc(name), d = enc(data), size = fakeSize || d.length;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(n.length, 26);
    parts.push(lh, n, d);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, n); off += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}
const S = AV.Shield.scanBuffer;
expect("docx normal é aceito", S(zip([["[Content_Types].xml", "<x/>"], ["word/document.xml", "<w:document/>"]]), "docx", "aula.docx"), true);
expect("docx com macro é bloqueado", S(zip([["word/document.xml", "<x/>"], ["word/vbaProject.bin", "MACRO"]]), "docx", "aula.docx"), false);
expect("bomba de compressão é bloqueada", S(zip([["word/document.xml", "x".repeat(100), 900 * 1024 * 1024]]), "docx", "aula.docx"), false);
expect("caminho malicioso no zip é bloqueado", S(zip([["../../etc/passwd", "x"]]), "pptx", "slides.pptx"), false);
expect("programa .exe disfarçado de .pdf é bloqueado", S(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3]), "pdf", "prova.pdf"), false);
expect("extensão dupla (prova.exe.pdf) é bloqueada", S(enc("%PDF-1.7 ok"), "pdf", "prova.exe.pdf"), false);
expect("PDF normal é aceito", S(enc("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj"), "pdf", "texto.pdf"), true);
expect("PDF com JavaScript é bloqueado", S(enc("%PDF-1.7\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>"), "pdf", "x.pdf"), false);
expect("PDF que abre programas é bloqueado", S(enc("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>"), "pdf", "x.pdf"), false);
expect("PDF com arquivo escondido é bloqueado", S(enc("%PDF-1.4\n<< /Type /EmbeddedFile >>"), "pdf", "x.pdf"), false);
expect("RTF com objeto OLE é bloqueado", S(enc("{\\rtf1 {\\object\\objemb{\\*\\objdata 0105}}}"), "rtf", "x.rtf"), false);
expect("RTF normal é aceito", S(enc("{\\rtf1\\ansi Ola mundo}"), "rtf", "x.rtf"), true);
expect("imagem PNG verdadeira é aceita", S(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), "png", "foto.png"), true);
expect("arquivo que finge ser imagem é bloqueado", S(enc("<svg onload=alert(1)>"), "png", "foto.png"), false);
expect("texto com <script> é bloqueado", S(enc("ola <script>alert(1)</script>"), "txt", "a.txt"), false);
expect("texto comum é aceito", S(enc("Resumo da aula sobre frações."), "txt", "a.txt"), true);
expect("documento Office antigo (OLE) é bloqueado", S(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1]), "docx", "velho.docx"), false);
expect("tipo não permitido é bloqueado", S(enc("x"), "html", "pagina.html"), false);
process.exit(fails ? 1 : 0);

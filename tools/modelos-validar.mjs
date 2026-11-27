// Valida modelos no formato compacto (um arquivo JSON com uma lista de modelos).
// Uso: node tools/modelos-validar.mjs <arquivo.json> [--ids-existentes]
// Confere: campos obrigatórios, respostas corretas e coerentes, ligações como permutação,
// habilidades da BNCC que existem na base oficial e batem com o ano e o componente,
// e a estrutura de cada tipo de material (mesma ficha técnica usada pela IA: src/kinds.js).
import fs from "node:fs"; import vm from "node:vm";
const root = new URL("..", import.meta.url);
globalThis.AV = {};
vm.runInThisContext(fs.readFileSync(new URL("src/kinds.js", root), "utf8"));
vm.runInThisContext(fs.readFileSync(new URL("src/bncc.js", root), "utf8"));
const base = JSON.parse(fs.readFileSync(new URL("data/bncc.json", root), "utf8"));
AV.BNCC.use(base);
const byCode = new Map(base.h.map((r) => [r[0], r]));

const KINDS = ["apostila", "lista", "prova", "roteiro", "plano", "atividade", "projeto"];
const THEMES = ["Verde caderno", "Azul escolar", "Laranja giz", "Roxo ciência", "Vermelho lousa", "Grafite"];
const CALLOUTS = ["dica", "importante", "atencao", "curiosidade", "definicao", "exemplo"];
const str = (v) => typeof v === "string" && v.trim().length > 0;
const strs = (v, n) => Array.isArray(v) && v.length >= (n || 1) && v.every(str);

function checkBlock(b, i) {
  const at = "bloco " + (i + 1) + " (" + (b && b.type) + "): ";
  if (!b || typeof b !== "object") return at + "inválido";
  switch (b.type) {
    case "heading": return str(b.text) && [1, 2, 3].includes(b.level || 1) ? "" : at + "precisa de text e level 1-3";
    case "paragraph": return str(b.text) ? "" : at + "sem texto";
    case "callout": return str(b.text) && CALLOUTS.includes(b.style) ? "" : at + "precisa de text e style em " + CALLOUTS.join("/");
    case "bullets": return strs(b.items, 2) ? "" : at + "precisa de 2+ itens";
    case "table": return Array.isArray(b.rows) && b.rows.length >= 2 && b.rows.every((r) => Array.isArray(r) && r.length === b.rows[0].length && r.every((c) => typeof c === "string")) ? "" : at + "linhas com o mesmo número de colunas (2+ linhas)";
    case "choice_question":
      if (!str(b.prompt) || !strs(b.options, 3)) return at + "precisa de prompt e 3+ alternativas";
      if (!Number.isInteger(b.correct) || b.correct < 0 || b.correct >= b.options.length) return at + "correct fora das alternativas";
      if (new Set(b.options.map((o) => o.trim().toLowerCase())).size !== b.options.length) return at + "alternativas repetidas";
      return "";
    case "true_false":
      if (!strs(b.statements, 2)) return at + "precisa de 2+ afirmações";
      if (!Array.isArray(b.answers) || b.answers.length !== b.statements.length || !b.answers.every((a) => typeof a === "boolean")) return at + "answers deve ter um true/false por afirmação";
      if (b.answers.every((a) => a) || b.answers.every((a) => !a)) return at + "misture verdadeiras e falsas";
      return "";
    case "fill_blank": {
      if (!str(b.text)) return at + "sem texto";
      const gaps = (b.text.match(/\[[^\]\n]+\]/g) || []).length;
      return gaps >= 1 ? "" : at + "marque as lacunas com [resposta]";
    }
    case "match": {
      if (!strs(b.left, 3) || !strs(b.right, 3) || b.left.length !== b.right.length) return at + "left e right com o mesmo tamanho (3+)";
      const a = b.answers;
      const perm = Array.isArray(a) && a.length === b.left.length && a.every((x) => Number.isInteger(x) && x >= 0 && x < b.right.length) && new Set(a).size === a.length;
      if (!perm) return at + "answers deve ser uma permutação (índice em right para cada item de left)";
      if (a.every((x, k) => x === k)) return at + "embaralhe a coluna da direita (answers não pode ser 0,1,2...)";
      return "";
    }
    case "open_question": return str(b.prompt) && str(b.answer) ? "" : at + "precisa de prompt e answer (resposta esperada ou critério)";
    case "gen_wordsearch": return strs(b.words, 5) && b.words.every((w) => /^[A-Z]{3,12}$/.test(w)) ? "" : at + "5+ palavras em MAIÚSCULAS, sem acento nem espaço, 3 a 12 letras";
    case "gen_crossword": return Array.isArray(b.entries) && b.entries.length >= 5 && b.entries.every((e) => Array.isArray(e) && /^[A-Z]{3,12}$/.test(e[0]) && str(e[1])) ? "" : at + "5+ entradas [PALAVRA, dica], palavra em MAIÚSCULAS sem acento";
    case "link": return str(b.label) && /^https:\/\//.test(b.url || "") ? "" : at + "precisa de label e url https";
    case "qrcode": return /^https:\/\//.test(b.url || "") ? "" : at + "precisa de url https";
    default: return at + "tipo de bloco não permitido";
  }
}

function checkBncc(m) {
  const codes = m.bncc;
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 3) return "bncc: escolha de 1 a 3 habilidades";
  const info = AV.BNCC.levelInfo(m.level);
  if (!info.etapa) return "level não reconhecido: " + m.level;
  const sigla = AV.BNCC.siglaFor(m.subject, info.etapa);
  for (const c of codes) {
    const r = byCode.get(c);
    if (!r) return "bncc: " + c + " não existe na base oficial";
    if (r[1] !== info.etapa) return "bncc: " + c + " é de outra etapa (" + r[1] + ")";
    if (info.ano && info.etapa !== "EM" && !r[3].includes(info.ano)) return "bncc: " + c + " não é do ano/grupo de " + m.level;
    if (sigla && r[2] !== sigla && !/interdisciplinar/i.test(m.subject)) return "bncc: " + c + " é de outro componente (" + r[2] + "), esperado " + sigla;
  }
  if (new Set(codes).size !== codes.length) return "bncc: códigos repetidos";
  return "";
}

export function validate(list, existingIds) {
  const errors = []; const seen = new Set(existingIds || []);
  if (!Array.isArray(list)) return [{ id: "(arquivo)", errors: ["o arquivo deve ser uma lista JSON de modelos"] }];
  for (const m of list) {
    const e = [];
    const id = m && m.id;
    if (!/^v5-[a-z0-9-]{3,60}$/.test(id || "")) e.push("id deve começar com v5- e ter só letras minúsculas, números e hífen");
    if (seen.has(id)) e.push("id repetido"); seen.add(id);
    for (const f of ["title", "subtitle", "description", "subject", "level"]) if (!str(m[f])) e.push("falta " + f);
    if (!KINDS.includes(m.kind)) e.push("kind deve ser um de " + KINDS.join(", "));
    if (m.lang !== "pt-BR") e.push("lang deve ser pt-BR");
    if (!THEMES.includes(m.theme)) e.push("theme deve ser um de " + THEMES.join(", "));
    const b = checkBncc(m); if (b) e.push(b);
    if (!Array.isArray(m.blocks) || m.blocks.length < 5) e.push("precisa de pelo menos 5 blocos");
    else {
      m.blocks.forEach((bl, i) => { const x = checkBlock(bl, i); if (x) e.push(x); });
      if (KINDS.includes(m.kind)) {
        const issue = AV.KindSpecs.check(m.kind, { blocks: m.blocks }, {});
        if (issue) e.push("estrutura de " + m.kind + ": " + issue);
      }
    }
    if (e.length) errors.push({ id: id || "(sem id)", errors: e });
  }
  return errors;
}

if (process.argv[1] && process.argv[1].endsWith("modelos-validar.mjs")) {
  const file = process.argv[2];
  if (!file) { console.error("uso: node tools/modelos-validar.mjs <arquivo.json>"); process.exit(2); }
  let list;
  try { list = JSON.parse(fs.readFileSync(file, "utf8")); } catch (err) { console.log("JSON inválido: " + err.message); process.exit(1); }
  const existing = JSON.parse(fs.readFileSync(new URL("data/modelos-novos.json", root), "utf8")).map((m) => m.id)
    .concat(JSON.parse(fs.readFileSync(new URL("data/modelos.json", root), "utf8")).map((m) => m.id));
  const errs = validate(list, existing);
  for (const x of errs) console.log("ERRO " + x.id + ": " + x.errors.join(" | "));
  console.log((Array.isArray(list) ? list.length : 0) - errs.length + " de " + (Array.isArray(list) ? list.length : 0) + " modelos aprovados");
  process.exit(errs.length ? 1 : 0);
}

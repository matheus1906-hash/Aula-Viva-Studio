import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.AV = globalThis.AV || {};
AV.loadScript = async () => {};
vm.runInThisContext(readFileSync(new URL("../src/atividades.js", import.meta.url), "utf8"));
const T = AV.atividades;

const TYPES = ["word_search", "crossword", "match", "fill_blank", "paragraph", "table", "heading", "bullets",
  "open_question", "choice_question", "true_false"];
const strip = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const isStr = s => typeof s === "string";
const noIds = bs => JSON.parse(JSON.stringify(bs, (k, v) => (k === "id" ? undefined : v)));

function checkBlock(b) {
  assert.ok(isStr(b.id) && b.id.length > 3, "id");
  assert.ok(TYPES.includes(b.type), "type " + b.type);
  switch (b.type) {
    case "word_search": {
      assert.ok(isStr(b.title) && Array.isArray(b.words) && Array.isArray(b.skipped));
      const n = b.grid.length;
      assert.ok(n >= 4);
      for (const row of b.grid) { assert.equal(row.length, n); for (const c of row) assert.match(c, /^[A-Z]$/); }
      assert.equal(b.solution.length, b.words.length);
      for (const s of b.solution) {
        const letters = s.cells.map(([r, c]) => b.grid[r][c]).join("");
        assert.equal(letters, strip(s.word).toUpperCase().replace(/[^A-Z]/g, ""));
        for (let i = 1; i < s.cells.length; i++) {
          const dr = s.cells[i][0] - s.cells[i - 1][0], dc = s.cells[i][1] - s.cells[i - 1][1];
          assert.ok(Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr || dc));
          if (i > 1) assert.deepEqual([dr, dc], [s.cells[1][0] - s.cells[0][0], s.cells[1][1] - s.cells[0][1]]);
        }
      }
      break;
    }
    case "crossword": {
      const { grid, clues } = b;
      const H = grid.length, W = grid[0].length;
      const cell = (r, c) => (r >= 0 && c >= 0 && r < H && c < W ? grid[r][c] : null);
      const starts = {};
      let n = 0;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const x = cell(r, c);
        if (!x) continue;
        assert.match(x.letter, /^[A-Z]$/);
        const ac = !cell(r, c - 1) && cell(r, c + 1), dn = !cell(r - 1, c) && cell(r + 1, c);
        if (ac || dn) { n++; assert.equal(x.number, n); starts[n] = [r, c]; } else assert.equal(x.number, undefined);
      }
      let count = 0;
      for (const [dir, list] of [["across", clues.across], ["down", clues.down]]) {
        for (const cl of list) {
          count++;
          const [r, c] = starts[cl.n];
          let w = "";
          for (let i = 0; ; i++) {
            const x = dir === "across" ? cell(r, c + i) : cell(r + i, c);
            if (!x) break;
            w += x.letter;
          }
          assert.equal(w, cl.answer, "crossword word " + cl.n + dir);
          assert.ok(isStr(cl.clue));
        }
      }
      assert.ok(count >= 1);
      // every run of 2+ letters is a listed clue (no accidental words)
      let runs = 0;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (!cell(r, c)) continue;
        if (!cell(r, c - 1) && cell(r, c + 1)) runs++;
        if (!cell(r - 1, c) && cell(r + 1, c)) runs++;
      }
      assert.equal(runs, count);
      break;
    }
    case "match":
      assert.ok(isStr(b.prompt));
      assert.equal(b.left.length, b.right.length);
      assert.equal(b.answers.length, b.left.length);
      assert.deepEqual([...b.answers].sort((a, c) => a - c), b.left.map((_, i) => i));
      break;
    case "fill_blank": {
      assert.ok(isStr(b.prompt) && isStr(b.text));
      let d = 0;
      for (const ch of b.text) { if (ch === "[") d++; else if (ch === "]") d--; assert.ok(d === 0 || d === 1); }
      assert.equal(d, 0);
      assert.ok(/\[[^\]]+\]/.test(b.text), "has a blank");
      break;
    }
    case "paragraph": assert.ok(isStr(b.text)); break;
    case "heading": assert.ok(isStr(b.text) && (b.level === 1 || b.level === 2)); break;
    case "bullets": assert.ok(b.items.length && b.items.every(isStr)); break;
    case "table": assert.ok(b.rows.length > 1 && b.rows.every(r => r.length === b.rows[0].length && r.every(isStr))); break;
    case "open_question": assert.ok(isStr(b.prompt) && b.lines >= 1 && b.lines <= 12 && isStr(b.answer)); break;
    case "choice_question":
      assert.ok(b.options.length >= 2 && Number.isInteger(b.correct) && b.correct >= 0 && b.correct < b.options.length);
      break;
    case "true_false":
      assert.equal(b.statements.length, b.answers.length);
      assert.ok(b.answers.every(x => typeof x === "boolean"));
      break;
  }
}

// ---- catalog: every entry with its example ----
assert.ok(T.catalog.length >= 13);
const FT = ["text", "textarea", "number", "select", "checkbox", "list", "pairs"];
const CATS = ["Alfabetização", "Português", "Matemática", "Jogos de palavras", "Avaliação"];
for (const e of T.catalog) {
  assert.ok(e.id && e.name && e.description && e.years && CATS.includes(e.category), e.id);
  assert.ok(e.fields.length && e.fields.every(f => f.key && f.label && FT.includes(f.type)), e.id + " fields");
  assert.ok(e.fields.filter(f => f.type === "select").every(f => f.options && f.options.length), e.id + " options");
  assert.equal(typeof T[e.id], "function", e.id + " generator");
  const blocks = T.run(e.id, e.example);
  assert.ok(Array.isArray(blocks) && blocks.length, e.id + " produced blocks");
  blocks.forEach(checkBlock);
  assert.equal(new Set(blocks.map(b => b.id)).size, blocks.length, "unique ids");
  // determinism
  const s1 = noIds(T.run(e.id, Object.assign({}, e.example, { seed: 123 })));
  const s2 = noIds(T.run(e.id, Object.assign({}, e.example, { seed: 123 })));
  assert.deepEqual(s1, s2, e.id + " deterministic");
  // robustness
  assert.ok(Array.isArray(T.run(e.id, {})), e.id + " empty");
  assert.ok(Array.isArray(T.run(e.id, null)));
}
assert.deepEqual(T.run("nope", {}), []);
assert.ok(T.validate("wordSearch", {}).errors.length > 0);

// ---- word search details ----
{
  const words = ["sol", "lua", "estrela", "maçã", "coração", "ônibus", "pé"];
  const [b] = T.wordSearch({ words, seed: 1, directions: ["h", "v", "d", "reverse"] });
  checkBlock(b);
  assert.equal(b.skipped.length, 0);
  assert.equal(b.solution.length, words.length);
  const [c] = T.wordSearch({ words: ["abcdefghij", "xy"], size: 5, seed: 1 });
  assert.deepEqual(c.skipped, ["ABCDEFGHIJ"]);
  assert.equal(c.grid.length, 5);
  const a = T.wordSearch({ words, seed: 5 })[0], d = T.wordSearch({ words, seed: 6 })[0];
  assert.notDeepEqual(a.grid, d.grid);
}

// ---- crossword ----
{
  const entries = ["elefante", "girafa", "leão", "macaco", "zebra", "tigre", "urso", "cobra", "arara", "pato"].map(a => ({ answer: a, clue: "Dica de " + a }));
  const [b] = T.crossword({ entries, seed: 8 });
  checkBlock(b);
  const placed = b.clues.across.length + b.clues.down.length;
  assert.equal(placed + b.skipped.length, entries.length);
  assert.ok(placed >= 6, "placed " + placed);
  assert.deepEqual(noIds(T.crossword({ entries, seed: 8 })), noIds(T.crossword({ entries, seed: 8 })));
}

// ---- match ----
{
  const pairs = [["a", "1"], ["b", "2"], ["c", "3"], ["d", "4"]];
  const [m] = T.match({ pairs, seed: 3 });
  m.left.forEach((l, i) => assert.equal(m.right[m.answers[i]], pairs.find(p => p[0] === l)[1]));
}

// ---- fill blank ----
{
  const [f] = T.fillBlank({ text: "O Sol é uma estrela. O sol brilha. [Lua] já marcada.", words: ["sol", "estrela", "Lua"] });
  assert.equal(f.text, "O [Sol] é uma estrela. O sol brilha. [Lua] já marcada.".replace("uma estrela", "uma [estrela]"));
  checkBlock(f);
  assert.equal(T.fillBlank({ text: "Ela saiu.", words: ["sai"] })[0].text, "Ela saiu.");
}

// ---- scramble / sentenceOrder / alphabetical ----
{
  const tb = T.scramble({ words: ["casa", "bola"], seed: 1 });
  const rows = tb[1].rows;
  assert.deepEqual(rows[0], ["Embaralhada", "Resposta"]);
  assert.deepEqual(rows[1][0].split(" ").sort(), ["A", "A", "C", "S"]);
  const q = T.scramble({ words: ["casa"], format: "perguntas", seed: 1 })[0];
  assert.equal(q.answer, "casa");
  const so = T.sentenceOrder({ sentences: ["O gato dorme.", "Eu leio"], seed: 2 });
  assert.equal(so.length, 3);
  assert.deepEqual(so[1].prompt.split(" / ").sort(), ["O", "dorme.", "gato"].sort());
  assert.equal(so[1].answer, "O gato dorme.");
  const al = T.alphabetical({ words: ["uva", "Ágata", "banana", "abacaxi", "érica"], seed: 1 })[0];
  assert.equal(al.answer, "abacaxi, Ágata, banana, érica, uva");
}

// ---- math ----
{
  const apply = (a, op, b) => ({ "+": a + b, "-": a - b, "×": a * b, "÷": a / b })[op];
  for (const op of ["+", "-", "x", "÷", "mix"]) {
    for (const format of ["lista", "perguntas"]) {
      const bl = T.mathOps({ op, count: 40, min: 1, max: 30, format, seed: 77 });
      const lines = format === "lista"
        ? bl[0].text.split("\n")
        : bl.map(b => b.prompt.replace(/^.*\n/, "") + " [" + b.answer + "]");
      assert.equal(lines.length, 40);
      for (const l of lines) {
        const m = /^(\d+) ([+\-×÷]) (\d+) = \[(-?\d+)\]$/.exec(l.trim());
        assert.ok(m, "line " + l);
        const [a, o, b] = [Number(m[1]), m[2], Number(m[3])];
        assert.equal(apply(a, o, b), Number(m[4]), l);
        assert.ok(Number(m[4]) >= 0 && Number.isInteger(Number(m[4])));
        if (op !== "mix") assert.equal(o, { "+": "+", "-": "-", x: "×", "÷": "÷" }[op]);
      }
    }
  }
  assert.equal(T.mathOps({ op: "÷", exactDivision: false, count: 5, seed: 1 })[0].text.split("\n").length, 5);
  const t = T.mathOps({ format: "tabela", count: 3, seed: 1 });
  assert.equal(t[1].rows.length, 4);
  const tab = T.tabuada({ n: 6, upTo: 10 })[0].text.split("\n");
  assert.equal(tab.length, 10);
  tab.forEach((l, i) => assert.equal(l, `6 × ${i + 1} = [${6 * (i + 1)}]`));
  const tl = T.tabuada({ n: 4, upTo: 3, mode: "lista" });
  assert.deepEqual(tl[1].items, ["4 × 1 = 4", "4 × 2 = 8", "4 × 3 = 12"]);
}

// ---- syllables ----
{
  const cases = { casa: "ca-sa", sapato: "sa-pa-to", livro: "li-vro", escola: "es-co-la", carro: "car-ro",
    passarinho: "pas-sa-ri-nho", queijo: "quei-jo", "saída": "sa-í-da", "pão": "pão", coelho: "co-e-lho",
    chuva: "chu-va", "palhaço": "pa-lha-ço", rainha: "ra-i-nha", "lápis": "lá-pis", "água": "á-gua",
    "guarda-chuva": "guar-da-chu-va", "borboleta": "bor-bo-le-ta", "bola": "bo-la", "cadeira": "ca-dei-ra" };
  for (const [w, s] of Object.entries(cases)) assert.equal(T.syllabify(w), s, w);
  const [f] = T.syllables({ words: ["gato", "janela"] });
  assert.equal(f.text, "gato → [ga-to]\njanela → [ja-ne-la]");
  checkBlock(f);
}

// ---- other ----
{
  const [co, ...rest] = T.countAndWrite({ items: [{ emoji: "🍎", label: "maçãs", count: 3 }, { label: "bolas", count: 2 }] });
  assert.equal(co.type, "paragraph");
  assert.equal(rest[0].answer, "3");
  assert.equal(rest[0].prompt.split("\n")[0], "🍎 🍎 🍎");
  assert.equal(rest[1].prompt.split("\n")[0], "● ●");
  const tf = T.trueFalseFromFacts({ facts: [{ text: "A", true: true }, { text: "B", true: false }] })[0];
  assert.deepEqual(tf.answers, [true, false]);
  const qs = [{ prompt: "Q?", options: ["a", "b", "c", "d"], correct: 2 }];
  assert.equal(T.quiz({ questions: qs })[0].correct, 2);
  for (let s = 0; s < 20; s++) {
    const z = T.quiz({ questions: qs, shuffle: true, seed: s })[0];
    assert.equal(z.options[z.correct], "c");
  }
  const parsed = T.run("quiz", { questions: "P1\nx\n*y\n\nP2\n*a) um\nb) dois" });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].options[0], "um");
  assert.equal(parsed[0].correct, 1);
  assert.deepEqual(T.run("trueFalseFromFacts", { facts: "sem marcador" }), []);
  assert.deepEqual(T.run("trueFalseFromFacts", { facts: "X | F\nY | V" }).find((b) => b.type === "true_false").answers, [false, true]);
}

console.log("atividades: ok");

# AulaViva Studio Web: shared contract

The web app is ONE HTML page. Every module in `src/` is a **plain browser script** (no ES modules, no
`import`/`export`, no bundler) that attaches to a global namespace:

```js
(function (AV) {
  "use strict";
  // ...
  AV.something = { ... };
})(globalThis.AV = globalThis.AV || {});
```

The build concatenates the scripts inline into the page, so a module must not rely on its own URL.
User-facing strings are Brazilian Portuguese. No `eval`, no `new Function`, no `innerHTML` with
unescaped data. Never throw on odd input: validate and fall back.

## Loading third-party libraries

The app provides `AV.loadScript(url) -> Promise<void>` (loads a `<script>` once, memoized). Modules
call it lazily, only when a feature is used. Use exactly these URLs (already verified to exist):

| Global | URL |
|---|---|
| `window.jspdf.jsPDF` | `https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js` |
| `window.docx` | `https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js` |
| `window.PptxGenJS` | `https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js` |
| `window.JSZip` | `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` |
| `window.mammoth` | `https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js` |
| `window.pdfjsLib` | `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js` (set `GlobalWorkerOptions.workerSrc` to `.../build/pdf.worker.min.js`) |

A module that needs a library writes `await AV.loadScript(AV.LIBS.jspdf)` etc. Define the URL table
as `AV.LIBS = AV.LIBS || {...}` at the top of your module with the keys
`jspdf, docx, pptx, jszip, mammoth, pdfjs, pdfjsWorker` (same values in every module).
In Node tests, set the globals yourself from `node_modules` (installed: jspdf, docx, pptxgenjs,
jszip, mammoth) and stub `AV.loadScript = async () => {}`.

## Document model

```js
doc = {
  id: "string", version: 1, updated: 1732150000000,
  meta: {
    title, subtitle, author, school, subject, level,           // strings
    kind: "apostila" | "lista" | "prova" | "roteiro" | "plano" | "atividade" | "projeto" | "branco",
    theme: "Azul escolar" | "Verde caderno" | "Laranja giz" | "Roxo ciência" | "Vermelho lousa" | "Grafite",
    cover, toc, page_numbers, answer_key, student_fields,      // booleans
    footer: "string", protect: false, owner_password: "", allow_print: true, allow_copy: true
  },
  blocks: [ block, ... ]
}
AV.THEMES = { "Azul escolar":"#2F6FED", "Verde caderno":"#1F9D6B", "Laranja giz":"#E2762B",
              "Roxo ciência":"#7B4FD6", "Vermelho lousa":"#C9433A", "Grafite":"#3B4252" }
AV.CALLOUTS = { dica:["Dica","#2E9E6B"], atencao:["Atenção","#E0912F"], importante:["Importante","#D64545"],
                curiosidade:["Curiosidade","#6C5CE7"], definicao:["Definição","#2F80ED"] }
```

Every block has `id` (string) and `type`. Text fields may contain `**bold**` and `*italic*`.

| type | fields |
|---|---|
| `heading` | `text`, `level` (1 or 2) |
| `paragraph` | `text` (may contain `\n`) |
| `bullets` | `items: string[]` |
| `callout` | `style` (key of CALLOUTS), `title`, `text` |
| `image` | `data` (data: URL, jpeg/png/webp), `caption`, `width` (percent 20..100) |
| `qrcode` | `url`, `caption`, `size` (mm, 20..60) |
| `link` | `label`, `url`, `description` |
| `word` | `label`, `url`, `mode: "link"`, `filename` (Office document shared by link) |
| `video` | `title`, `url`, `mode: "link"`, `info` |
| `open_question` | `prompt`, `lines` (1..12), `answer` (goes to the answer key) |
| `choice_question` | `prompt`, `options: string[]`, `correct` (index) |
| `true_false` | `statements: string[]`, `answers: boolean[]` |
| `table` | `rows: string[][]` (first row is the header) |
| `divider` | – |
| `page_break` | – |
| `word_search` | `title`, `words: string[]`, `grid: string[][]` (one uppercase letter per cell), `solution: [{word, cells:[[r,c],...]}]` |
| `crossword` | `title`, `grid: (null | {letter, number?})[][]`, `clues: {across:[{n, clue, answer}], down:[{n, clue, answer}]}` |
| `match` | `prompt`, `left: string[]`, `right: string[]` (shown in this order), `answers: number[]` (answers[i] = index in `right` that matches `left[i]`) |
| `fill_blank` | `prompt`, `text` – answers in square brackets: `"O [Sol] é uma estrela."`; students see `______` |

"Student version" hides every answer; "teacher version" shows answers (correct option marked,
V/F keys, open-question answer, filled blanks, word-search solution highlighted, crossword
letters, match pairs). When `meta.answer_key` is true, the student version gets a final
"Gabarito" page listing the answers (teacher can remove it before printing).

Questions are numbered automatically across the document (choice, open, true_false, match,
fill_blank, word_search, crossword all count as questions).

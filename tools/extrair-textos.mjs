// Ferramenta de manutenção: extrai os textos da interface para i18n/strings.json. Rode na raiz: node tools/extrair-textos.mjs
import fs from "node:fs";
const files = ["views2.js","i18n.js","animacao.js","ai.js","ai-settings.js","preview.js","editor.js","views.js","chat-studio.js","main.js","biblioteca-data.js","atividades.js","providers.js"];
const out = new Set();
const skip = /^(#|https?:|data:|[a-z0-9_\-.:\/]+$|[A-Z_]+$|var\(|linear-gradient|[a-z-]+:|\.|\s*$)/;
for (const f of files) {
  const src = fs.readFileSync("src/" + f, "utf8");
  const re = /"((?:[^"\\\n]|\\.)*)"/g; let m;
  while ((m = re.exec(src))) {
    let s = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    if (s.length < 2 || skip.test(s)) continue;
    if (!/[A-Za-zÀ-ú]{2}/.test(s)) continue;
    if (/^[a-z][a-zA-Z0-9]*$/.test(s)) continue;            // ids
    if (/[{}<>;=]|=>|\bfunction\b|\$\{/.test(s) && !/[À-ú]/.test(s)) continue;
    if (/^(application|text|image|video)\//.test(s)) continue;
    if (/^(sans-serif|Nunito|bold|center|middle|start|end|nowrap|none|auto|hidden)$/.test(s)) continue;
    out.add(s.trim());
  }
}
const sh = fs.readFileSync("src/shell.html", "utf8");
for (const m of sh.matchAll(/>([^<>{}]*[A-Za-zÀ-ú]{2}[^<>{}]*)</g)) out.add(m[1].trim());
for (const m of sh.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/g)) out.add(m[1].trim());
const arr = [...out].filter((s) => s && !/^(AulaViva|AulaViva Studio|Studio|Claude|Gemini|Groq|Cerebras|OpenRouter|Mistral|Hugging Face|DeepSeek|WhatsApp|PDF|JSON|YouTube)$/.test(s)).sort();
fs.writeFileSync("i18n/strings.json", JSON.stringify(arr, null, 0).replace(/","/g, '",\n"'));
console.log(arr.length, "strings");

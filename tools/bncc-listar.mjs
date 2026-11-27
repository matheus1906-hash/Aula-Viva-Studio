// Lista habilidades oficiais da BNCC para escolher códigos de um material.
// Uso: node tools/bncc-listar.mjs <etapa EI|EF|EM> <ano ou grupo (EI: 1-3; EM: 0)> [sigla: LP MA CI GE HI AR EF LI ER | EI: EO CG TS EF ET] [palavra]
import fs from "node:fs";
const [etapa, ano, sigla, palavra] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(new URL("../data/bncc.json", import.meta.url), "utf8"));
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const rows = base.h.filter((r) => r[1] === etapa && (!+ano || r[3].includes(+ano)) && (!sigla || r[2] === sigla) && (!palavra || norm(r[0] + " " + r[4] + " " + r[5]).includes(norm(palavra))));
for (const r of rows) console.log(r[0] + " | " + r[4].slice(0, 170) + (r[5] ? " | " + r[5].slice(0, 60) : ""));
console.log(rows.length + " habilidades");

// Junta modelos aprovados (formato compacto) a data/modelos-novos.json, no formato completo.
// Uso: node tools/modelos-juntar.mjs lote1.json [lote2.json ...]
// Só entram os modelos que passam no validador; os reprovados são listados e ficam de fora.
import fs from "node:fs";
import { validate } from "./modelos-validar.mjs";
const root = new URL("..", import.meta.url);
const target = new URL("data/modelos-novos.json", root);
const LABEL = { apostila: "Apostila", lista: "Lista de exercícios", prova: "Avaliação / Prova", roteiro: "Roteiro com QR codes", plano: "Plano de aula", atividade: "Atividade", projeto: "Projeto educacional" };
const current = JSON.parse(fs.readFileSync(target, "utf8"));
const existing = current.map((m) => m.id).concat(JSON.parse(fs.readFileSync(new URL("data/modelos.json", root), "utf8")).map((m) => m.id));
const updated = Date.UTC(2026, 10, 27);
let added = 0, rejected = 0;
for (const file of process.argv.slice(2)) {
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  const bad = new Map(validate(list, existing).map((x) => [x.id, x.errors]));
  for (const m of list) {
    if (bad.has(m.id) || existing.includes(m.id)) { rejected++; console.log("fora: " + m.id + " " + (bad.get(m.id) || ["id repetido"]).join(" | ")); continue; }
    existing.push(m.id);
    current.push({
      id: m.id, title: m.title, kind: LABEL[m.kind], subject: m.subject, level: m.level, lang: "pt-BR",
      description: m.description, bncc: m.bncc,
      doc: {
        id: m.id, version: 1, updated,
        meta: { title: m.title, subtitle: m.subtitle, author: "", school: "", subject: m.subject, level: m.level, lang: "pt-BR", kind: m.kind, theme: m.theme, bncc: m.bncc,
          cover: false, toc: false, page_numbers: true, answer_key: true, student_fields: !["plano", "projeto"].includes(m.kind), footer: "", protect: false, owner_password: "", allow_print: true, allow_copy: true },
        blocks: m.blocks.map((b, i) => Object.assign({}, b, { id: "b" + (i + 1) }))
      }
    });
    added++;
  }
}
fs.writeFileSync(target, JSON.stringify(current));
console.log("entraram " + added + " modelos; ficaram de fora " + rejected + "; total em modelos-novos.json: " + current.length);

// Testes de mesa do entendimento de pedidos do card da tela inicial (src/intent.js).
import fs from "node:fs"; import vm from "node:vm";
globalThis.AV = {}; vm.runInThisContext(fs.readFileSync(new URL("../src/intent.js", import.meta.url), "utf8"));
let fails = 0;
const cases = [
  ["Uma apostila simples sobre o ciclo da água para o 3º ano", { kind: "apostila", topic: "Ciclo da água", level: "3º ano do Ensino Fundamental", subject: "Ciências" }],
  ["crie uma prova de matemática sobre frações para o 5 ano com 10 questões", { kind: "prova", topic: "Frações", level: "5º ano do Ensino Fundamental", subject: "Matemática", count: 10 }],
  ["atividade sobre frações para o 4º ano", { kind: "atividade", topic: "Frações", level: "4º ano do Ensino Fundamental", subject: "Matemática" }],
  ["plano de aula sobre o Brasil Colônia para o 7º ano", { kind: "plano", topic: "Brasil Colônia", level: "7º ano do Ensino Fundamental", subject: "História" }],
  ["lista de exercícios de equações do 1º grau para o 8º ano", { kind: "lista", level: "8º ano do Ensino Fundamental", subject: "Matemática" }],
  ["Sistema Solar", { kind: "atividade", topic: "Sistema Solar", level: "", subject: "Ciências" }],
  ["projeto sobre reciclagem na escola para a educação infantil", { kind: "projeto", topic: "Reciclagem na escola", level: "Educação Infantil" }],
  ["simulado de química para a 2ª série do ensino médio", { kind: "prova", level: "2ª série do Ensino Médio", subject: "Química" }],
  ["roteiro com QR codes sobre o Cerrado", { kind: "roteiro", topic: "Cerrado" }],
  ["quero uma atividade lúdica de inglês sobre animais para o 2º ano", { kind: "atividade", topic: "Animais", subject: "Língua Inglesa", level: "2º ano do Ensino Fundamental" }],
  ["Faça uma atividade de educação física sobre esportes coletivos", { topic: "Esportes coletivos", subject: "Educação Física" }],
  ["apostila de física sobre movimento para o 1º ano do ensino médio", { kind: "apostila", topic: "Movimento", subject: "Física", level: "1ª série do Ensino Médio" }],
  ["me dê uma avaliação diagnóstica de português 6º ano", { kind: "prova", subject: "Língua Portuguesa", level: "6º ano do Ensino Fundamental" }],
  ["simulado de química para a 2ª série do ensino médio", { kind: "prova", topic: "Química", level: "2ª série do Ensino Médio", subject: "Química" }],
  ["faça um vídeo animado sobre o ciclo da água para o 2º ano", { kind: "video", topic: "Ciclo da água", level: "2º ano do Ensino Fundamental" }],
  ["desenho animado sobre higiene das mãos para a educação infantil", { kind: "video", topic: "Higiene das mãos", level: "Educação Infantil" }],
  ["apostila sobre animais vertebrados", { kind: "apostila", topic: "Animais vertebrados" }],
  ["apostila para ministrar a aula, sem exercícios nem prova", { kind: "apostila" }],
  ["prova baseada na apostila", { kind: "prova" }],
  ["", { kind: "atividade", topic: "" }]
];
for (const [input, want] of cases) {
  const got = AV.parseRequest(input);
  const bad = Object.keys(want).filter((k) => got[k] !== want[k]);
  console.log((bad.length ? "FAIL " : "PASS ") + JSON.stringify(input) + (bad.length ? " → " + bad.map((k) => k + "=" + JSON.stringify(got[k]) + " (esperado " + JSON.stringify(want[k]) + ")").join(", ") : ""));
  if (bad.length) fails++;
}
const simple = AV.parseRequest("apostila simples sobre plantas");
if (!/simples/.test(simple.extra)) { console.log("FAIL extra simples"); fails++; } else console.log("PASS pedido 'simples' vira orientação de linguagem");
process.exit(fails ? 1 : 0);

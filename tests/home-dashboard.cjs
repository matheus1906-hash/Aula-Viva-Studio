"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const data = {};
const h = (tag, props, ...children) => {
  const node = { tag, props: props || {}, children: children.flat(Infinity).filter(x => x !== undefined && x !== null && x !== false), textContent: "", value: props && props.value || "" };
  node.append = (...xs) => { node.children.push(...xs.flat(Infinity)); };
  node.addEventListener = (name, cb) => { node.events = node.events || {}; node.events[name] = cb; };
  return node;
};
const calls = [];
const AV = globalThis.AV = {
  h, views: { inicio: { render: () => { throw Error("legacy page must be replaced"); } } },
  LS: { get: (k, fallback) => Object.hasOwn(data, k) ? data[k] : fallback, set: (k, value) => { data[k] = value; return true; } },
  appIcon: (name) => h("icon", { name }),
  profile: () => ({ name: "Professora Exemplo" }),
  Store: { list: () => [], on: fn => { calls.push(fn); return () => {}; } },
  toast: () => {},
  uid: () => "new-id",
  go: name => calls.push(name),
  aiCreateDialog: args => calls.push(args)
};
const source = fs.readFileSync(path.join(__dirname, "../src/home-dashboard.js"), "utf8");
vm.runInThisContext(source, { filename: "home-dashboard.js" });
const flatten = root => {
  if (!root || typeof root !== "object") return [];
  return [root, ...(root.children || []).flatMap(flatten)];
};
function rendered() {
  const main = h("main");
  const cleanup = AV.views.inicio.render(main);
  assert.equal(typeof cleanup, "function", "unsubscribe returned for store listener");
  return flatten(main);
}
let nodes = rendered();
const allText = () => nodes.flatMap(n => n.children || []).filter(x => typeof x === "string").join(" | ");
const sectionTitles = () => nodes.filter(n => n.tag === "h2").map(n => n.children.join(""));
assert.ok(nodes.some(n => n.tag === "h1" && n.children.join("").includes("Professora Exemplo".split(" ")[0])));
for (const title of ["Minha agenda", "Aulas de hoje", "Crie do seu jeito", "Continuar de onde parou", "Sua tela, suas escolhas"]) {
  assert.ok(sectionTitles().includes(title), "homepage shows " + title);
}
assert.ok(nodes.some(n => n.tag === "section" && n.props.class === "home-quote-panel"), "quote visible by default");
assert.ok(nodes.some(n => n.props && n.props.href === "#abnt"), "ABNT shortcut visible");
assert.ok(nodes.some(n => n.props && n.props.href === "#animacao"), "video shortcut visible");
console.log("PASS new workspace visible and teacher links above/below the fold");
// Quick agenda: add from home and then mark completed.
const input = nodes.find(n => n.props && n.props["aria-label"] === "Novo lembrete");
assert.ok(input && input.events && input.events.keydown);
input.value = "Conselho de classe";
input.events.keydown({ key: "Enter" });
assert.equal(data.teacherAgenda.length, 1);
assert.equal(data.teacherAgenda[0].title, "Conselho de classe");
nodes = rendered();
const complete = nodes.find(n => n.tag === "button" && n.props.class === "home-done");
assert.ok(complete);
complete.props.onclick();
assert.equal(data.teacherAgenda[0].done, true);
console.log("PASS create and complete reminders via homepage");
// Clean layout must remove widgets without deleting their data.
data.homeWidgets = { agenda: false, schedule: false, quote: false, quickStudy: false };
nodes = rendered();
assert.equal(nodes.some(n => n.tag === "section" && n.props.class === "home-quote-panel"), false);
assert.equal(sectionTitles().includes("Minha agenda"), false);
assert.equal(sectionTitles().includes("Aulas de hoje"), false);
assert.equal(data.teacherAgenda.length, 1, "hiding widgets keeps reminders");
assert.ok(sectionTitles().includes("Crie do seu jeito"), "core workspace remains");
console.log("PASS clean-home preferences preserve user records");

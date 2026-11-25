/**
 * SEO e otimização para buscadores de IA (AEO/GEO).
 * Gera páginas estáticas leves (sem JavaScript) para cada modelo pronto e cada habilidade da BNCC,
 * páginas-índice, sitemap.xml, robots.txt, llms.txt e manifest. Chamado pelo build.mjs.
 */
import fs from "node:fs";
import path from "node:path";

const SITE = "https://aulavivastudio.vercel.app";
const BRAND = "AulaViva Studio";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const strip = (s) => String(s || "").replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\[([^\]]*)\]/g, "____").replace(/\s+/g, " ").trim();
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const jsonLd = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, "\\u003c") + "</script>";

const CSS = `*{box-sizing:border-box}body{margin:0;background:#f4f6f3;color:#13261f;font:1rem/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#0B6E5F}header,main,footer{max-width:900px;margin:auto;padding:16px}header{display:flex;justify-content:space-between;align-items:center;gap:12px}
header a{font-weight:800;text-decoration:none}main{padding-top:4px}h1{font:800 clamp(1.7rem,5vw,2.5rem)/1.15 Georgia,serif;margin:.3em 0}
.meta{color:#4b5d55}.chips span{display:inline-block;margin:2px 4px 2px 0;padding:2px 10px;border-radius:99px;background:#e2ece7;font-size:.85rem}
.card{background:#fff;border:1px solid #d9dfd6;border-radius:14px;padding:16px 18px;margin:14px 0}.card h2{margin:.2em 0 .5em;font-size:1.15rem}
.bncc b{color:#0B6E5F}.cta{display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border-radius:12px;background:#0B6E5F;color:#fff;font-weight:800;text-decoration:none}
.cta.alt{background:transparent;color:#0B6E5F;border:2px solid #0B6E5F}ul.grid{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
ul.grid li{background:#fff;border:1px solid #d9dfd6;border-radius:12px;padding:12px}ul.grid small{display:block;color:#4b5d55}
footer{color:#4b5d55;font-size:.9rem;border-top:1px solid #d9dfd6;margin-top:24px}nav.crumbs{font-size:.9rem;color:#4b5d55}
@media (prefers-color-scheme:dark){body{background:#0d1513;color:#e8efe9}.card,ul.grid li{background:#15201d;border-color:#24332f}.chips span{background:#1f2e2a}a,.bncc b{color:#3fc5ad}.cta{background:#0B6E5F}.meta,ul.grid small,footer,nav.crumbs{color:#a9b8b1}}`;

function page({ url, title, description, body, ld, crumbs }) {
  const full = title.includes(BRAND) ? title : title + " | " + BRAND;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title><meta name="description" content="${esc(cut(description, 158))}"><link rel="canonical" href="${SITE + url}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large"><meta name="theme-color" content="#0B6E5F">
<meta property="og:type" content="article"><meta property="og:site_name" content="${BRAND}"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(cut(description, 200))}"><meta property="og:url" content="${SITE + url}">
<meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>${(ld || []).map(jsonLd).join("")}</head><body>
<header><a href="/">📘 ${BRAND}</a><a href="/planos.html">Planos · 14 dias grátis</a></header>
<main>${crumbs ? `<nav class="crumbs" aria-label="Caminho">${crumbs.map(([u, t], i) => (i < crumbs.length - 1 ? `<a href="${u}">${esc(t)}</a> › ` : esc(t))).join("")}</nav>` : ""}${body}</main>
<footer><p>${BRAND}: crie atividades, provas, apostilas e planos de aula alinhados à BNCC com IA, em minutos. Habilidades: Base Nacional Comum Curricular (MEC). Dados estruturados da BNCC: projeto bncc-dados (CC BY 4.0).</p>
<p><a href="/modelos/">Modelos prontos</a> · <a href="/bncc/">Habilidades da BNCC</a> · <a href="/planos.html">Planos</a> · <a href="/">Abrir a plataforma</a></p></footer></body></html>`;
}
const crumbsLd = (crumbs) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map(([u, t], i) => ({ "@type": "ListItem", position: i + 1, name: t, item: SITE + u })) });

/** resumo legível de um modelo: títulos e enunciados (o conteúdo é original do AulaViva) */
function outline(doc) {
  const items = [];
  for (const b of (doc && doc.blocks) || []) {
    if (b.type === "heading" && b.text) items.push(["h", strip(b.text)]);
    else if (/question|true_false|fill_blank|match/.test(b.type) && (b.prompt || b.text)) items.push(["q", strip(b.prompt || b.text)]);
    else if (b.type === "paragraph" && b.text && items.filter((x) => x[0] === "p").length < 2) items.push(["p", strip(b.text)]);
    if (items.length >= 18) break;
  }
  return items;
}

export function buildSeo({ outDir, modelos, bncc }) {
  const byCode = new Map(bncc.h.map((r) => [r[0], r]));
  const compName = (r) => bncc.componentes[r[1] + "-" + r[2]] || r[2];
  const anoLabel = (r) => (r[1] === "EI" ? bncc.grupos_ei[String(r[3][0])] : r[1] === "EM" ? "Ensino Médio" : r[3].map((a) => a + "º").join(", ") + " ano" + (r[3].length > 1 ? "s" : "") + " do Ensino Fundamental");
  const write = (rel, html) => { const f = path.join(outDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
  const urls = [["/", "1.0"], ["/planos.html", "0.8"], ["/modelos/", "0.9"], ["/bncc/", "0.9"]];
  const modelosPorCodigo = new Map();

  /* ---------- modelos ---------- */
  const usados = new Set();
  const mPages = modelos.map((m) => {
    let s = slug(m.title) || slug(m.id); while (usados.has(s)) s += "-2"; usados.add(s);
    (m.bncc || []).forEach((c) => { if (!modelosPorCodigo.has(c)) modelosPorCodigo.set(c, []); modelosPorCodigo.get(c).push({ s, m }); });
    return { s, m };
  });
  for (const { s, m } of mPages) {
    const url = "/modelos/" + s + "/";
    const habs = (m.bncc || []).map((c) => byCode.get(c)).filter(Boolean);
    const out = outline(m.doc);
    const desc = `${m.kind} de ${m.subject} para ${m.level}: ${strip(m.description || "")} Modelo pronto, editável e alinhado à BNCC${habs.length ? " (" + habs.map((r) => r[0]).join(", ") + ")" : ""}.`;
    const crumbs = [["/", "Início"], ["/modelos/", "Modelos prontos"], [url, m.title]];
    const body = `<h1>${esc(m.title)}</h1><p class="meta">${esc(strip(m.description || ""))}</p>
<p class="chips"><span>${esc(m.kind)}</span><span>${esc(m.subject)}</span><span>${esc(m.level)}</span>${habs.map((r) => `<span>${r[0]}</span>`).join("")}</p>
<p><a class="cta" href="/#modelos">Usar este modelo grátis</a><a class="cta alt" href="/planos.html">Ver planos</a></p>
${habs.length ? `<section class="card bncc"><h2>Habilidades da BNCC</h2><ul>${habs.map((r) => `<li><a href="/bncc/${r[0].toLowerCase()}/"><b>${r[0]}</b></a>: ${esc(r[4])}</li>`).join("")}</ul></section>` : ""}
${out.length ? `<section class="card"><h2>O que tem neste material</h2><ul>${out.map(([t, x]) => (t === "h" ? `<li><b>${esc(cut(x, 140))}</b></li>` : `<li>${esc(cut(x, 200))}</li>`)).join("")}</ul></section>` : ""}
<section class="card"><h2>Como usar</h2><p>Abra o modelo no ${BRAND}, ajuste o texto e as questões no editor e baixe em PDF interativo, Word ou PowerPoint, com versão do aluno e gabarito do professor.</p></section>`;
    const ld = [crumbsLd(crumbs), {
      "@context": "https://schema.org", "@type": "LearningResource", name: m.title, description: desc, url: SITE + url, inLanguage: m.lang || "pt-BR",
      learningResourceType: m.kind, educationalLevel: m.level, about: m.subject, isAccessibleForFree: true, provider: { "@type": "Organization", name: BRAND, url: SITE },
      educationalAlignment: habs.map((r) => ({ "@type": "AlignmentObject", alignmentType: "teaches", educationalFramework: "BNCC", targetName: r[0], targetDescription: r[4] }))
    }];
    write(url.slice(1) + "index.html", page({ url, title: `${m.title}: ${m.kind} de ${m.subject} (${m.level})`, description: desc, body, ld, crumbs }));
    urls.push([url, "0.7"]);
  }
  // índice de modelos agrupado por tipo
  const porTipo = {};
  mPages.forEach((x) => (porTipo[x.m.kind] = porTipo[x.m.kind] || []).push(x));
  write("modelos/index.html", page({
    url: "/modelos/", title: `${modelos.length} modelos prontos de atividades, provas, apostilas e planos de aula (BNCC)`,
    description: `Modelos prontos e editáveis alinhados à BNCC: ${Object.keys(porTipo).join(", ")}. Da Educação Infantil ao Ensino Médio, em PDF, Word e PowerPoint.`,
    crumbs: [["/", "Início"], ["/modelos/", "Modelos prontos"]],
    body: `<h1>Modelos prontos alinhados à BNCC</h1><p class="meta">${modelos.length} modelos originais e editáveis, da Educação Infantil ao Ensino Médio.</p><p><a class="cta" href="/#modelos">Abrir os modelos na plataforma</a></p>` +
      Object.entries(porTipo).map(([k, list]) => `<h2>${esc(k)} (${list.length})</h2><ul class="grid">${list.map(({ s, m }) => `<li><a href="/modelos/${s}/">${esc(m.title)}</a><small>${esc(m.subject)} · ${esc(m.level)}${m.bncc && m.bncc.length ? " · " + m.bncc.join(", ") : ""}</small></li>`).join("")}</ul>`).join(""),
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Modelos prontos alinhados à BNCC", url: SITE + "/modelos/", isPartOf: { "@type": "WebSite", name: BRAND, url: SITE } }]
  }));

  /* ---------- habilidades da BNCC ---------- */
  const porGrupo = {};
  for (const r of bncc.h) {
    const code = r[0], url = "/bncc/" + code.toLowerCase() + "/";
    const rel = modelosPorCodigo.get(code) || [];
    const comp = compName(r), ano = anoLabel(r);
    const vizinhos = bncc.h.filter((x) => x !== r && x[1] === r[1] && x[2] === r[2] && x[3].some((a) => r[3].includes(a))).slice(0, 8);
    const desc = `${code} (BNCC, ${comp}, ${ano}): ${r[4]} Crie atividades, provas e planos de aula para esta habilidade com IA.`;
    const crumbs = [["/", "Início"], ["/bncc/", "Habilidades da BNCC"], [url, code]];
    const criar = `/#criar?bncc=${code}`;
    const body = `<h1>${code}: atividades e plano de aula (BNCC)</h1>
<p class="chips"><span>${esc(r[1] === "EI" ? "Educação Infantil" : r[1] === "EM" ? "Ensino Médio" : "Ensino Fundamental")}</span><span>${esc(comp)}</span><span>${esc(ano)}</span></p>
<section class="card bncc"><h2>Texto oficial da habilidade</h2><p><b>${code}</b>: ${esc(r[4])}</p>${r[5] ? `<p class="meta">Objeto de conhecimento: ${esc(r[5])}</p>` : ""}</section>
<p><a class="cta" href="${criar}">Criar atividade para ${code} com IA</a><a class="cta alt" href="/planos.html">14 dias grátis</a></p>
${rel.length ? `<section class="card"><h2>Modelos prontos para ${code}</h2><ul>${rel.map(({ s, m }) => `<li><a href="/modelos/${s}/">${esc(m.title)}</a> (${esc(m.kind)})</li>`).join("")}</ul></section>` : ""}
<section class="card"><h2>Como trabalhar ${code} em sala</h2><p>No ${BRAND}, escolha o ano, o componente ${esc(comp)} e a habilidade ${code}. A IA cria a apostila, a lista de exercícios, a prova ou o plano de aula somente dentro desta habilidade, com gabarito e versão para imprimir.</p></section>
${vizinhos.length ? `<section class="card"><h2>Habilidades relacionadas</h2><ul>${vizinhos.map((v) => `<li><a href="/bncc/${v[0].toLowerCase()}/">${v[0]}</a>: ${esc(cut(v[4], 120))}</li>`).join("")}</ul></section>` : ""}`;
    const ld = [crumbsLd(crumbs), { "@context": "https://schema.org", "@type": "DefinedTerm", name: code, description: r[4], termCode: code, url: SITE + url, inDefinedTermSet: { "@type": "DefinedTermSet", name: "Base Nacional Comum Curricular (BNCC)" } }];
    write(url.slice(1) + "index.html", page({ url, title: `${code} BNCC: ${cut(r[4], 60)}`, description: desc, body, ld, crumbs }));
    urls.push([url, rel.length ? "0.6" : "0.5"]);
    const g = r[1] + " · " + comp; (porGrupo[g] = porGrupo[g] || []).push(r);
  }
  write("bncc/index.html", page({
    url: "/bncc/", title: "Habilidades da BNCC: todas as 1.580 com atividades e planos de aula", crumbs: [["/", "Início"], ["/bncc/", "Habilidades da BNCC"]],
    description: "Consulte todas as habilidades da BNCC (Educação Infantil, Ensino Fundamental e Ensino Médio) com o texto oficial e crie atividades e planos de aula alinhados com IA.",
    body: `<h1>Habilidades da BNCC</h1><p class="meta">${bncc.h.length} aprendizagens com o texto oficial. Toque em um código para ver a habilidade e criar materiais.</p>` +
      Object.entries(porGrupo).map(([g, list]) => `<h2>${esc(g.replace(/^EI/, "Educação Infantil").replace(/^EF/, "Ensino Fundamental").replace(/^EM/, "Ensino Médio"))} (${list.length})</h2><p>${list.map((r) => `<a href="/bncc/${r[0].toLowerCase()}/">${r[0]}</a>`).join(" · ")}</p>`).join(""),
    ld: [{ "@context": "https://schema.org", "@type": "DefinedTermSet", name: "Base Nacional Comum Curricular (BNCC)", url: SITE + "/bncc/" }]
  }));

  /* ---------- sitemap, robots, llms.txt, manifest ---------- */
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(([u, p]) => `<url><loc>${SITE + u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join("\n") + "\n</urlset>\n");
  fs.writeFileSync(path.join(outDir, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  fs.writeFileSync(path.join(outDir, "llms.txt"), `# ${BRAND}

> Plataforma brasileira para professores criarem atividades, provas, apostilas, listas de exercícios, planos de aula, projetos e vídeos animados com IA, sempre alinhados às habilidades da BNCC. Exporta PDF interativo, Word e PowerPoint. 14 dias grátis; plano mensal R$ 49,90 ou anual R$ 479,04.

## Principais páginas
- [Abrir a plataforma](${SITE}/): criação com IA ao vivo, editor de materiais, biblioteca, vídeos animados
- [Modelos prontos (${modelos.length})](${SITE}/modelos/): atividades, provas, apostilas, listas, planos e roteiros, da Educação Infantil ao Ensino Médio, com habilidades da BNCC
- [Habilidades da BNCC (${bncc.h.length})](${SITE}/bncc/): texto oficial de cada habilidade, com modelos relacionados e criação de materiais com IA
- [Planos e preços](${SITE}/planos.html)

## Fatos
- Todo material criado com IA segue estritamente as habilidades da BNCC escolhidas pelo professor (ano, componente e de 1 a 4 habilidades).
- Base da BNCC: 1.304 habilidades do Ensino Fundamental, 183 do Ensino Médio e 93 objetivos da Educação Infantil (fonte: MEC; dados estruturados do projeto bncc-dados, CC BY 4.0).
- Idiomas da interface: português, inglês e espanhol.
- Segurança: dados do professor criptografados no aparelho (AES-256-GCM), login com código no e-mail e verificação em 2 etapas nas contas institucionais.
`);
  fs.writeFileSync(path.join(outDir, "manifest.webmanifest"), JSON.stringify({ name: BRAND, short_name: "AulaViva", lang: "pt-BR", start_url: "/", display: "standalone", background_color: "#F1F4F1", theme_color: "#0B6E5F", description: "Atividades, provas e planos de aula com IA alinhados à BNCC.", icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] }));
  fs.writeFileSync(path.join(outDir, "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0B6E5F"/><path d="M14 22c6-3 12-3 18 1v24c-6-4-12-4-18-1zM50 22c-6-3-12-3-18 1v24c6-4 12-4 18-1z" fill="#fff"/><path d="M32 23c-4-3-4.5-7 0-11 4.5 4 4 8 0 11z" fill="#F59E0B"/></svg>`);
  return { pages: urls.length };
}

/** cabeçalho de SEO da página principal (app) */
export function homeHead() {
  const title = "AulaViva Studio | Atividades, provas e planos de aula com IA alinhados à BNCC";
  const desc = "Crie atividades, provas, apostilas, listas e planos de aula com IA, sempre alinhados à BNCC. 290 modelos prontos, PDF interativo, Word e PowerPoint. 14 dias grátis.";
  const ld = [
    { "@context": "https://schema.org", "@type": "WebApplication", name: BRAND, url: SITE + "/", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["pt-BR", "en", "es"], description: desc,
      offers: [{ "@type": "Offer", name: "Teste gratuito", price: "0", priceCurrency: "BRL", description: "14 dias grátis" }, { "@type": "Offer", name: "Plano mensal", price: "49.90", priceCurrency: "BRL" }, { "@type": "Offer", name: "Plano anual", price: "479.04", priceCurrency: "BRL", description: "20% de desconto sobre 12 meses" }] },
    { "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: SITE + "/", logo: SITE + "/favicon.svg" },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      ["O AulaViva Studio segue a BNCC?", "Sim. Para criar com IA, o professor escolhe o ano, o componente e as habilidades da BNCC, e o material é feito somente dentro delas, com o texto oficial da habilidade no início."],
      ["Quanto custa?", "14 dias grátis. Depois, plano mensal de R$ 49,90 ou anual de R$ 479,04 (20% de desconto sobre 12 meses)."],
      ["Em quais formatos posso baixar?", "PDF interativo, Word (.docx), PowerPoint (.pptx), HTML e texto, com versão do aluno e gabarito do professor."],
      ["Preciso de chave de IA?", "Não. A IA já vem incluída. Quem tem uma IA paga pode usar a própria chave, se quiser."]
    ].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
  ];
  return `<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}/"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/"><meta property="og:image" content="${SITE}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0B6E5F"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">
${ld.map(jsonLd).join("")}`;
}
export const HOME_TITLE = "AulaViva Studio | Atividades, provas e planos de aula com IA alinhados à BNCC";
export const NOSCRIPT = `<noscript><h1>AulaViva Studio: atividades, provas e planos de aula com IA alinhados à BNCC</h1><p>Plataforma para professores criarem materiais didáticos alinhados à BNCC. Ative o JavaScript para usar. Veja os <a href="/modelos/">modelos prontos</a> e as <a href="/bncc/">habilidades da BNCC</a>.</p></noscript>`;

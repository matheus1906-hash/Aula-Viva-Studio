(function (AV) {
  "use strict";
  const media = /imag(?:em|ens|en|es)|image|foto|ilustr|illustr|figura|diagrama|diagram|esquema|fluxo(?:grama)?|flowchart|flujo|fluxograma|fluxogram|infogr/i;
  const search = /links?\b|fontes?\b|refer[eê]ncia|pesquis|busc|internet|online|sites?\b|sources?\b|research|search|fuentes?\b/i;
  const block = (type, fields) => Object.assign(AV.newBlock(type), fields);
  const plain = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
  async function pages(host, params, signal) {
    const u = new URL("https://" + host + "/w/api.php");
    u.search = new URLSearchParams({ action: "query", generator: "search", format: "json", formatversion: "2", origin: "*", ...params });
    const response = await fetch(u, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) throw Error("Busca indisponível");
    const data = await response.json();
    return (data.query?.pages || []).sort((a, b) => a.index - b.index);
  }

  async function articles(query, lang, signal) {
    const host = (["pt", "es", "en"].includes(lang) ? lang : "pt") + ".wikipedia.org";
    const hits = await pages(host, { gsrsearch: query, gsrlimit: 3, prop: "extracts", exintro: 1, explaintext: 1, exchars: 650 }, signal);
    return hits.filter((p) => p.pageid > 0).map((p) => ({
      title: p.title, url: "https://" + host + "/?curid=" + p.pageid, excerpt: plain(p.extract).slice(0,650)
    }));
  }

  async function publications(query, signal) {
    const url = new URL("https://api.crossref.org/works");
    url.search = new URLSearchParams({ "query.bibliographic": query, rows: 3, select: "DOI,title,publisher" });
    const response = await fetch(url, { signal, credentials: "omit" });
    if (!response.ok) throw Error("Catálogo indisponível");
    const records = (await response.json()).message?.items || [];
    return records.filter((item) => item.title?.[0] && /^10\.\d{4,9}\/\S+$/i.test(item.DOI)).map((item) => ({
      title: plain(item.title[0]), url: "https://doi.org/" + item.DOI.split("/").map(encodeURIComponent).join("/"),
      excerpt: "Registro bibliográfico · " + plain(item.publisher)
    }));
  }

  async function references(query, language, academic, signal) {
    const hits = await articles(query, language, signal).catch(() => []);
    if (hits.length && !academic) return hits;
    const papers = await publications(query, signal).catch(() => []);
    return [...hits, ...papers];
  }

  async function photo(query, signal) {
    const hits = await pages("commons.wikimedia.org", { gsrsearch: query + " filetype:bitmap", gsrnamespace: 6, gsrlimit: 5, prop: "imageinfo", iiprop: "url|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist", iiurlwidth: 640 }, signal);
    for (const hit of hits) {
      const info = hit.imageinfo?.[0], meta = info?.extmetadata;
      const license = plain(meta?.LicenseShortName?.value), author = plain(meta?.Artist?.value);
      if (!/^https:\/\/upload\.wikimedia\.org\//.test(info?.thumburl || "") || !/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(info?.descriptionurl || "")) continue;
      if (!/^(public domain|CC0|CC BY(?:-SA)? [\d.]+)$/i.test(license) || (!author && /^CC BY/i.test(license))) continue;
      try {
        const response = await fetch(info.thumburl, { signal, credentials: "omit", redirect: "error" });
        if (!response.ok) continue;
        const blob = await response.blob();
        if (blob.size > 1200000 || !/^image\/(png|jpeg|webp)$/.test(blob.type)) continue;
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
        });
        const title = hit.title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
        return [block("image", { data, width: 78, caption: title.slice(0,140) + " · " + author.slice(0,85) + " · " + license }),
          block("link", { label: "Crédito e licença da imagem", url: info.descriptionurl, description: title })];
      } catch (e) { if (signal.aborted) throw e; }
    }
    return [];
  }

  function flow(labels) {
    if (!Array.isArray(labels) || labels.length < 2 || labels.length > 8 || labels.some((s) => typeof s !== "string" || !s.trim() || s.length > 75)) return [];
    const canvas = document.createElement("canvas");
    canvas.width = 940; canvas.height = labels.length * 112;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 26px sans-serif";
    labels.forEach((label, i) => {
      const y = i * 112 + 8;
      ctx.fillStyle = "#e4f3f0"; ctx.fillRect(30, y, 880, 70);
      ctx.fillStyle = "#173c36"; ctx.fillText(label, 470, y + 35, 840);
      if (i < labels.length - 1) { ctx.fillRect(467, y + 70, 6, 22); ctx.beginPath(); ctx.moveTo(459, y+91); ctx.lineTo(481,y+91); ctx.lineTo(470,y+104); ctx.fill(); }
    });
    return [block("image", { data: canvas.toDataURL("image/png"), width: 85, caption: "Fluxograma · " + labels.join(" → ").slice(0,280) })];
  }

  AV.research = async function (request, topic, language, signal) {
    const empty = { blocks: [], sources: [], notes: [], anchor: "", onlyResources: false };
    if (!media.test(request) && !search.test(request)) return empty;
    const plan = await AV.AI.json("Interprete o pedido de recursos didáticos considerando negações. Tema: " + topic + "\nPedido: " + request +
      '\nResponda {"photo":boolean,"diagram":boolean,"links":boolean,"research":boolean,"academic":boolean,"onlyResources":boolean,"query":"tema preciso no idioma do material","imageQuery":"termos do assunto em inglês para Wikimedia Commons","anchor":"palavra do título da seção apropriada","steps":["etapas concretas e curtas do processo"]}. Marque só recursos pedidos. Diferencie uma imagem fotográfica de um fluxograma. Para busca na internet marque research; para inclusão de fontes marque links. Para artigos científicos ou bibliografia acadêmica marque academic e research. onlyResources indica ausência de outra alteração textual solicitada. Não inclua dados pessoais em consultas. Para diagramas produza de 2 a 8 etapas conectadas e específicas do tema.', { signal, lang: language, tier: "complex" });
    if (!plan || typeof plan !== "object") throw Error("Não foi possível interpretar o pedido de recursos.");
    const out = { ...empty, onlyResources: plan.onlyResources === true && [plan.photo,plan.diagram,plan.links,plan.research].includes(true), anchor: String(plan.anchor || "").slice(0,100) };
    const timed = new AbortController(), abort = () => timed.abort();
    if (signal?.aborted) signal.throwIfAborted();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 18000);
    try {
      const query = String(plan.query || topic).trim().slice(0,180);
      const [refs, photos] = await Promise.allSettled([
        plan.links === true || plan.research === true ? references(query, language, plan.academic === true, timed.signal) : [],
        plan.photo === true ? photo(String(plan.imageQuery || query).slice(0,180), timed.signal) : []
      ]);
      if (signal?.aborted) signal.throwIfAborted();
      out.sources = refs.status === "fulfilled" ? refs.value : [];
      const images = photos.status === "fulfilled" ? photos.value : [];
      out.blocks.push(...images);
      if (plan.photo === true && !images.length) out.notes.push("Imagem: nenhuma miniatura com crédito e licença pôde ser incorporada.");
      if (plan.diagram === true) {
        const diagram = flow(plan.steps); out.blocks.push(...diagram);
        if (!diagram.length) out.notes.push("Fluxograma: a sequência de etapas ficou incompleta.");
      }
      for (const s of out.sources) out.blocks.push(block("link", { label: s.title, url: s.url, description: s.excerpt.slice(0,260) }));
      if ((plan.links === true || plan.research === true) && !out.sources.length) out.notes.push("Busca de referências sem resultados disponíveis.");
      return out;
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  };
  AV.placeResources = (blocks, pack) => {
    const seen = new Set(blocks.flatMap((b) => [b.url, b.data]).filter(Boolean));
    const extra = pack.blocks.filter((b) => { const key = b.url || b.data; if (seen.has(key)) return false; seen.add(key); return true; });
    const start = pack.anchor ? blocks.findIndex((b) => b.type === "heading" && String(b.text).toLowerCase().includes(pack.anchor.toLowerCase())) : -1;
    const next = start < 0 ? -1 : blocks.findIndex((b, i) => i > start && b.type === "heading");
    const at = next < 0 ? blocks.length : next;
    return [...blocks.slice(0, at), ...extra, ...blocks.slice(at)];
  };
})(globalThis.AV = globalThis.AV || {});

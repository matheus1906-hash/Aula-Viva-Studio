(function (AV) {
  "use strict";
  const h = AV.h, V = AV.views;

  /* ============ Vídeos animados (desenho para crianças) ============ */
  const AnimStore = {
    list() { return AV.LS.get("anims", []); },
    save(st) { if (!st.id) st.id = AV.uid(); const l = AnimStore.list().filter((x) => x.id !== st.id); st.updated = Date.now(); l.unshift(st); if (l.length > 40) AV.toast("Limite de 40 vídeos: o mais antigo saiu da lista. Exclua os que não usa mais."); if (!AV.LS.set("anims", l.slice(0, 40))) AV.toast("Espaço do navegador cheio: exclua vídeos antigos."); },
    remove(id) { AV.LS.set("anims", AnimStore.list().filter((x) => x.id !== id)); }
  };
  AV.AnimStore = AnimStore;
  /* narração: capacidade tts (claude.ai) ou voz do navegador (versão hospedada) */
  const Narrator = {
    async say(text, lang) {
      if (!text) return;
      const t = await AV.cap.tts;
      if (t) { try { await t.stop(); } catch (e) {} try { await t.speak(text.slice(0, 1900), { voice: "airy", language: lang || "pt-BR", rate: 0.95 }); } catch (e) {} return; }
      if (window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang || "pt-BR"; u.rate = 0.95; speechSynthesis.speak(u); }
    },
    async stop() { const t = await AV.cap.tts; if (t) { try { await t.stop(); } catch (e) {} } if (window.speechSynthesis) speechSynthesis.cancel(); }
  };

  const THUMBS = new Map();
  let thumbIO = null, thumbQ = [], thumbBusy = false;
  function pumpThumbs() {
    if (thumbBusy || !thumbQ.length) return; thumbBusy = true;
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16));
    idle(() => {
      const job = thumbQ.shift(); thumbBusy = false;
      if (job && job.img.isConnected) { let u = ""; try { u = AV.anim.thumbnail(AV.anim.validate(job.s), 0, 360); } catch (e) {} if (u) { THUMBS.set(job.key, u); job.img.src = u; job.img.hidden = false; } }
      pumpThumbs();
    });
  }
  function queueThumb(img, s, key) {
    if (!("IntersectionObserver" in window)) { thumbQ.push({ img, s, key }); pumpThumbs(); return; }
    if (!thumbIO) thumbIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { thumbIO.unobserve(e.target); thumbQ.push(e.target.__job); pumpThumbs(); } }), { rootMargin: "200px" });
    const job = { img, s, key };
    requestAnimationFrame(() => { const btn = img.parentElement; if (!btn || !img.isConnected) return; btn.__job = job; thumbIO.observe(btn); });
  }
  V.animacao = {
    title: "Vídeos animados",
    render(main) {
      if (!AV.anim) { main.appendChild(h("div", { class: "wrap" }, h("div", { class: "empty" }, "O estúdio de animação não carregou."))); return; }
      const A = AV.anim;
      let story = null, cur = 0, player = null, narrate = true, captions = true;
      const canvas = h("canvas", { width: 1280, height: 720, class: "anim-canvas", "aria-label": "Vídeo animado", role: "img" });
      const sceneBar = h("div", { class: "scene-bar", "aria-label": "Cenas" });
      const editor = h("div", { class: "card", style: { display: "grid", gap: "12px" } });
      const playBtn = h("button", { class: "btn pri", onclick: () => toggle() }, AV.icon("play"), "Assistir");
      const timeLbl = h("span", { class: "muted small", style: { fontVariantNumeric: "tabular-nums" } }, "0:00");
      const seek = h("input", { type: "range", min: 0, max: 100, step: 0.1, value: 0, class: "seek", "aria-label": "Posição do vídeo", oninput: (e) => { if (player) player.seek(+e.target.value); } });
      const title = h("input", { class: "ed-title", "aria-label": "Título do vídeo", oninput: (e) => { story.title = e.target.value; saveSoon(); } });
      const studio = h("div", { class: "anim-studio", hidden: true },
        h("div", { class: "ed-bar" }, h("button", { class: "btn ghost icon", "aria-label": "Voltar", onclick: () => { saveSoon.cancel(); if (story) AnimStore.save(story); story = null; stop(); gallery.hidden = false; studio.hidden = true; drawGallery(); } }, AV.icon("back")), title,
          h("button", { class: "btn sm", onclick: () => { story.scenes.splice(cur + 1, 0, AV.clone(story.scenes[cur] || blankScene())); cur++; refresh(); } }, AV.icon("plus"), "Cena"),
          h("button", { class: "btn sm", onclick: support }, AV.icon("doc"), "Atividade sobre o vídeo"),
          h("button", { class: "btn sm pri", onclick: (e) => exportVideo(e.currentTarget) }, AV.icon("download"), "Baixar vídeo")),
        h("div", { class: "anim-grid" },
          h("div", { style: { display: "grid", gap: "10px", minWidth: 0 } },
            h("div", { class: "anim-stage" }, canvas),
            h("div", { class: "row" }, playBtn, seek, timeLbl,
              h("label", { class: "check" }, h("input", { type: "checkbox", checked: true, onchange: (e) => { captions = e.target.checked; rebuild(); } }), "Legendas"),
              h("label", { class: "check" }, h("input", { type: "checkbox", checked: true, onchange: (e) => { narrate = e.target.checked; if (!narrate) Narrator.stop(); } }), "Narração"),
              h("button", { class: "btn sm icon", "aria-label": "Tela cheia", onclick: () => { const s = canvas.parentElement; (s.requestFullscreen ? s.requestFullscreen() : Promise.reject()).catch(() => AV.toast("Tela cheia indisponível aqui.")); } }, AV.icon("expand"))),
            sceneBar),
          editor));
      const gallery = h("div", { style: { display: "grid", gap: "18px" } });
      main.appendChild(h("div", { class: "wrap", style: { maxWidth: "1300px" } }, AV.pageHead("Vídeos animados", "Crie desenhos animados curtos para as crianças: escolha um modelo ou peça para a IA escrever a história. Personagens, cenários, falas, legendas e narração.", "film", "rose"), gallery, studio));
      drawGallery();

      function blankScene() { return { bg: "parque", duration: 6, narration: "", actors: [{ type: "menina", x: 0.35, y: 0.82, scale: 1, anim: "acenar", say: "Oi!" }], texts: [] }; }
      function drawGallery() {
        gallery.textContent = "";
        const topic = h("input", { class: "in", id: "anim-topic", placeholder: "Ex.: por que a lua muda de forma?" });
        const age = h("select", { class: "in", id: "anim-age" }, ["Educação Infantil (3 a 5 anos)", "1º e 2º ano", "3º ao 5º ano"].map((x) => h("option", null, x)));
        const nsc = h("select", { class: "in", id: "anim-n" }, [4, 6, 8, 10].map((n) => h("option", { value: n, selected: n === 6 }, n + " cenas")));
        const lang = h("select", { class: "in", "data-notr": "" }, Object.keys(AV.LANGS).map((k) => h("option", { value: k, selected: k === AV.lang() }, AV.LANGS[k][2] + " " + AV.LANGS[k][0])));
        const go = h("button", { class: "btn pri", onclick: () => aiStory(topic.value.trim(), age.value, +nsc.value, lang.value, go) }, AV.icon("sparkle"), "Criar vídeo com IA");
        gallery.append(h("section", { class: "feature-card" },
          h("div", { style: { display: "grid", gap: "12px", minWidth: 0 } }, h("h2", null, "Criar com IA"), h("p", { class: "muted" }, "Descreva o tema. A IA escreve o roteiro, escolhe cenários e personagens e monta as cenas. Você ajusta tudo depois."),
            h("div", { class: "form" }, h("label", { class: "f full" }, "Tema do vídeo", topic), h("label", { class: "f" }, "Idade", age), h("label", { class: "f" }, "Tamanho", nsc), h("label", { class: "f" }, "Idioma", lang)),
            h("div", { class: "row" }, go, h("button", { class: "btn", onclick: () => open({ id: AV.uid(), title: "Meu vídeo", lang: AV.locale(), scenes: [blankScene()] }) }, AV.icon("plus"), "Começar do zero")))));
        const mine = AnimStore.list();
        if (mine.length) gallery.append(h("h2", null, "Meus vídeos"), h("div", { class: "grid wide" }, mine.map((s) => card(s, true))));
        gallery.append(h("h2", null, "Modelos prontos"), h("div", { class: "grid wide" }, (A.TEMPLATES || []).map((t) => card(Object.assign({ id: "tpl-" + t.id, title: t.title, level: t.level, description: t.description }, t.story), false))));
      }
      function card(s, mine) {
        const img = h("img", { alt: "", hidden: true });
        const key = (mine ? "m:" + s.id + ":" + (s.updated || 0) : "t:" + s.id);
        if (THUMBS.has(key)) { img.src = THUMBS.get(key); img.hidden = false; } else queueThumb(img, s, key);
        return h("article", { class: "tile anim-card", style: { cursor: "default" } },
          h("button", { class: "thumb", "aria-label": "Abrir " + s.title, onclick: () => open(s, !mine) }, img, h("span", { class: "play-badge" }, AV.icon("play"))),
          h("h3", null, s.title), h("p", null, [s.level, (s.scenes || []).length + " cenas", Math.round(A.duration(A.validate(s))) + " s"].filter(Boolean).join(" · ")),
          s.description ? h("p", null, s.description) : null,
          h("div", { class: "row" }, h("button", { class: "btn sm pri", onclick: () => open(s, !mine) }, mine ? "Abrir" : "Usar modelo"),
            mine ? h("button", { class: "btn sm ghost danger", "aria-label": "Excluir vídeo", onclick: async () => { if (await AV.confirm("Excluir vídeo?", "\"" + s.title + "\" será apagado.", "Excluir")) { AnimStore.remove(s.id); drawGallery(); } } }, AV.icon("trash")) : null));
      }
      let snap = null, building = false;
      function open(s, copy) {
        story = A.validate(AV.clone(s)); story.id = copy || !s.id ? AV.uid() : s.id; story.title = s.title || "Meu vídeo";
        if (copy) AnimStore.save(story);
        cur = 0; gallery.hidden = true; studio.hidden = false; title.value = story.title; refresh(); window.scrollTo(0, 0);
      }
      const saveSoon = AV.debounce(() => story && AnimStore.save(story), 600);
      function setPlayLabel() { playBtn.textContent = ""; if (player && player.playing) playBtn.append(AV.icon("pause"), AV.t("Pausar")); else playBtn.append(AV.icon("play"), AV.t(player && player.time > 0.05 ? "Continuar" : "Assistir")); }
      function rebuild() {
        const t = player ? player.time : 0; if (player) player.destroy();
        snap = A.validate(story);   /* cópia validada só para tocar; "story" segue editável */
        building = true;
        player = new A.Player(canvas, snap, { captions,
          onScene: (i, sc) => { if (building) return; cur = i; markScene(); if (narrate && player && player.playing) Narrator.say(sc.narration, story && story.lang); },
          onEnd: () => { playBtn.textContent = ""; playBtn.append(AV.icon("play"), AV.t("Assistir de novo")); Narrator.stop(); },
          onTime: (tt) => { seek.value = tt; timeLbl.textContent = fmt(tt) + " / " + fmt(A.duration(snap)); } });
        seek.max = A.duration(snap); player.seek(Math.min(t, A.duration(snap)));
        building = false; setPlayLabel();
      }
      const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
      function toggle() {
        if (!player) return;
        if (player.playing) { player.pause(); Narrator.stop(); playBtn.textContent = ""; playBtn.append(AV.icon("play"), AV.t("Continuar")); }
        else { if (player.time >= A.duration(snap) - 0.05) player.seek(0); player.play(); const sc = story.scenes[cur]; if (narrate && sc) Narrator.say(sc.narration, story.lang); playBtn.textContent = ""; playBtn.append(AV.icon("pause"), AV.t("Pausar")); }
      }
      function stop() { if (player) { player.destroy(); player = null; } Narrator.stop(); }
      function sceneStart(i) { let t = 0; const sc = (snap || story).scenes; for (let k = 0; k < i && k < sc.length; k++) t += sc[k].duration; return t; }
      function markScene() { [...sceneBar.children].forEach((c, i) => c.setAttribute("aria-current", i === cur ? "true" : "false")); }
      function refresh() { cur = Math.max(0, Math.min(cur, story.scenes.length - 1)); rebuild(); player.seek(sceneStart(cur) + 0.5); markScene(); drawScenes(); drawEditor(); saveSoon(); }
      function drawScenes() {
        sceneBar.textContent = "";
        story.scenes.forEach((sc, i) => { let th = ""; try { th = A.thumbnail(story, i, 200); } catch (e) {}
          sceneBar.appendChild(h("button", { class: "scene-chip", "aria-current": i === cur ? "true" : "false", onclick: () => { cur = i; player.seek(sceneStart(i) + 0.5); markScene(); drawEditor(); } }, th ? h("img", { src: th, alt: "" }) : null, h("span", null, (i + 1) + ". " + (A.BACKGROUNDS[sc.bg] || sc.bg)))); });
      }
      function drawEditor() {
        editor.textContent = "";
        const sc = story.scenes[cur]; if (!sc) return;
        const upd = () => { rebuild(); player.seek(sceneStart(cur) + 0.5); saveSoon(); };
        const updThumb = AV.debounce(drawScenes, 500);
        const ch = () => { upd(); updThumb(); };
        const sel = (obj, key, map, label) => h("label", { class: "f" }, label, h("select", { class: "in", onchange: (e) => { obj[key] = e.target.value; ch(); } }, Object.keys(map).map((k) => h("option", { value: k, selected: obj[key] === k }, map[k]))));
        const num = (obj, key, label, min, max, step) => h("label", { class: "f" }, label, h("input", { class: "in", type: "range", min, max, step, value: obj[key] == null ? (min + max) / 2 : obj[key], oninput: (e) => { obj[key] = +e.target.value; ch(); } }));
        editor.append(h("div", { class: "row" }, h("h2", null, "Cena " + (cur + 1)), h("span", { class: "spacer" }),
          h("button", { class: "btn sm icon ghost", "aria-label": "Mover cena para a esquerda", disabled: cur === 0, onclick: () => { [story.scenes[cur - 1], story.scenes[cur]] = [story.scenes[cur], story.scenes[cur - 1]]; cur--; refresh(); } }, AV.icon("back")),
          h("button", { class: "btn sm icon ghost danger", "aria-label": "Excluir cena", disabled: story.scenes.length < 2, onclick: () => { story.scenes.splice(cur, 1); cur = Math.max(0, cur - 1); refresh(); } }, AV.icon("trash"))),
          h("div", { class: "form" }, sel(sc, "bg", A.BACKGROUNDS, "Cenário"), h("label", { class: "f" }, "Duração (s)", h("input", { class: "in", type: "number", min: 2, max: 20, value: sc.duration, onchange: (e) => { sc.duration = Math.max(2, Math.min(20, +e.target.value || 6)); e.target.value = sc.duration; ch(); } }))),
          h("label", { class: "f" }, "Narração (lida em voz alta e mostrada na legenda)", h("textarea", { class: "in", rows: 3, oninput: (e) => { sc.narration = e.target.value; upd(); } }, sc.narration || "")),
          h("h3", null, "Personagens e objetos"));
        (sc.actors || []).forEach((a, i) => editor.append(h("details", { class: "actor", open: i === 0 },
          h("summary", null, (A.ACTORS[a.type] || a.type) + (a.say ? " · “" + a.say.slice(0, 24) + "”" : "")),
          h("div", { class: "form" }, sel(a, "type", A.ACTORS, "Tipo"), sel(a, "anim", A.ANIMS, "Movimento"),
            h("label", { class: "f full" }, "Fala (balão)", h("input", { class: "in", value: a.say || "", oninput: (e) => { a.say = e.target.value; upd(); } })),
            ["letra", "numero", "forma"].includes(a.type) ? h("label", { class: "f" }, a.type === "forma" ? "Forma" : "Texto", h("input", { class: "in", value: a.text || "", oninput: (e) => { a.text = e.target.value; ch(); } })) : null,
            h("label", { class: "f" }, "Cor", h("input", { class: "in", type: "color", value: /^#[0-9a-f]{6}$/i.test(a.color || "") ? a.color : "#F59E0B", oninput: (e) => { a.color = e.target.value; ch(); } })),
            num(a, "x", "Posição horizontal", 0, 1, 0.01), num(a, "y", "Posição vertical", 0.1, 1, 0.01), num(a, "scale", "Tamanho", 0.3, 3, 0.05), num(a, "delay", "Entra após (s)", 0, 10, 0.5),
            h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!a.flip, onchange: (e) => { a.flip = e.target.checked; ch(); } }), "Virar para a esquerda"),
            h("button", { class: "btn sm ghost danger", onclick: () => { sc.actors.splice(i, 1); ch(); drawEditor(); } }, AV.icon("trash"), "Remover")))));
        editor.append(h("div", { class: "row" },
          h("button", { class: "btn sm", disabled: (sc.actors || []).length >= 8, onclick: () => { sc.actors = sc.actors || []; sc.actors.push({ type: "gato", x: 0.65, y: 0.82, scale: 0.8, anim: "pular" }); ch(); drawEditor(); } }, AV.icon("plus"), "Personagem"),
          h("button", { class: "btn sm", disabled: (sc.texts || []).length >= 4, onclick: () => { sc.texts = sc.texts || []; sc.texts.push({ text: "Título", x: 0.5, y: 0.15, size: 1, anim: "aparecer", color: "#FFFFFF" }); ch(); drawEditor(); } }, AV.icon("plus"), "Texto na tela")));
        (sc.texts || []).forEach((t, i) => editor.append(h("div", { class: "form actor" },
          h("label", { class: "f full" }, "Texto na tela " + (i + 1), h("input", { class: "in", value: t.text, oninput: (e) => { t.text = e.target.value; upd(); } })),
          num(t, "y", "Altura", 0.05, 0.9, 0.01), num(t, "size", "Tamanho", 0.5, 2.5, 0.1),
          h("button", { class: "btn sm ghost danger", onclick: () => { sc.texts.splice(i, 1); ch(); drawEditor(); } }, AV.icon("trash"), "Remover"))));
      }
      async function aiStory(topic, age, n, lang, btn) {
        if (!topic) { document.getElementById("anim-topic").focus(); return; }
        AV.busy(btn, true, "Escrevendo o roteiro...");
        try {
          const spec = "Formato: {\"title\":string,\"scenes\":[{\"bg\":um de [" + Object.keys(A.BACKGROUNDS).join(",") + "],\"duration\":5-9,\"narration\":frase curta para ler em voz alta,\"actors\":[{\"type\":um de [" + Object.keys(A.ACTORS).join(",") + "],\"x\":0.1-0.9,\"y\":0.6-0.9 (pés no chão; sol/lua/nuvem/estrela/planeta/passaro ficam em 0.2-0.4),\"scale\":0.6-1.4,\"color\":\"#hex\",\"text\":só para letra/numero/forma,\"anim\":um de [" + Object.keys(A.ANIMS).join(",") + "],\"say\":fala curta opcional,\"delay\":0-3,\"flip\":bool}],\"texts\":[{\"text\":palavra-chave curta,\"x\":0.5,\"y\":0.12,\"size\":1,\"anim\":\"aparecer\"}]}]}";
          const out = await AV.AI.json("Crie o roteiro de um desenho animado educativo curto para crianças (" + age + ") sobre: " + topic + ". Use exatamente " + n + " cenas, com começo, meio e fim, um ou dois personagens fixos com nome, linguagem simples e afetiva, conteúdo correto. Até 3 atores por cena; distribua os atores em posições x diferentes. " + spec, { tier: "complex", lang });
          const st = A.validate(Object.assign({ lang: AV.LANGS[lang][1] }, out));
          if (!st.scenes.length) throw { code: "empty", message: "A IA não montou as cenas. Tente de novo." };
          const made = Object.assign(st, { id: AV.uid(), title: out.title || topic });
          if (!main.isConnected) { AnimStore.save(made); AV.toast("Vídeo criado: está em Vídeos animados."); return; }
          open(made, true);
          AV.toast("Vídeo criado. Clique em Assistir.");
        } catch (e) { AV.toast(AV.AI.explain(e)); }
        AV.busy(btn, false);
      }
      async function exportVideo(btn) {
        if (player && player.playing) toggle();
        AV.busy(btn, true, "Gravando 0%");
        try {
          const blob = await A.exportWebM(story, { captions, fps: 30, onProgress: (f) => { btn.lastChild.textContent = " " + AV.t("Gravando") + " " + Math.round(f * 100) + "%"; } });
          await AV.saveFile(AV.slug(story.title) + ".webm", blob);
          AV.toast("Vídeo pronto. A narração não vai no arquivo: as legendas sim.", 5000);
        } catch (e) { AV.toast((e && e.message) || "Não foi possível gravar o vídeo."); }
        AV.busy(btn, false);
      }
      function support() {
        const txt = story.scenes.map((s) => s.narration).filter(Boolean).join(" ");
        AV.aiCreateDialog({ kind: "atividade", topic: story.title, level: "Educação Infantil / anos iniciais", lang: AV.docLang({ meta: { lang: story.lang } }), extra: "Atividade para depois de assistir ao vídeo animado. Roteiro do vídeo: " + txt.slice(0, 3000) });
      }
      return () => { saveSoon.cancel(); if (story && !studio.hidden) AnimStore.save(story); stop(); };
    }
  };

  /* ============ Livros, e-books e artigos ============ */
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const SYN = [["educacao", "ensino", "pedagogia", "escola", "education", "educacion", "aprendizagem", "learning"], ["crianca", "infantil", "infancia", "child", "children", "nino"], ["alfabetizacao", "letramento", "leitura", "escrita", "literacy", "reading"],
    ["matematica", "math", "mathematics", "numeros", "aritmetica"], ["ciencias", "science", "biologia", "fisica", "quimica"], ["historia", "history"], ["geografia", "geography", "territorio", "espaco", "lugar"],
    ["inclusao", "inclusiva", "deficiencia", "especial", "tea", "autismo", "inclusion"], ["avaliacao", "assessment", "evaluacion"], ["curriculo", "bncc", "base nacional", "curriculum"], ["tecnologia", "digital", "tecnologias"],
    ["ingles", "english", "lingua inglesa"], ["espanhol", "spanish", "espanol"], ["migracao", "migrante", "migration"], ["didatica", "metodologia", "metodo", "pratica"], ["aprendizagem significativa", "ausubel", "moreira"]];
  function expand(q) { let toks = norm(q).split(/[^a-z0-9]+/).filter((t) => t.length > 2); const add = []; SYN.forEach((g) => { if (g.some((w) => toks.includes(w) || norm(q).includes(w))) add.push(...g); }); return [...new Set(toks.concat(add))]; }
  function score(o, toks) {
    if (!toks.length) return 1;
    const T = norm(o.title), Au = norm((o.authors || []).join(" ")), K = norm((o.keywords || []).join(" ") + " " + (o.area || []).join(" ")), S = norm(o.summary);
    let sc = 0; toks.forEach((t) => { if (T.includes(t)) sc += 3; if (Au.includes(t)) sc += 2.5; if (K.includes(t)) sc += 2; if (S.includes(t)) sc += 1; }); return sc;
  }
  AV.abnt = function (o) {
    const au = (o.authors || []).slice(0, 3).join("; ") + ((o.authors || []).length > 3 ? " et al" : "");
    if (o.type === "artigo") return (au ? au + ". " : "") + o.title + ". " + (o.publisher ? o.publisher + ", " : "") + (o.year || "s.d.") + "." + (o.doi ? " DOI: " + o.doi + "." : "");
    if (o.type === "tese" || o.type === "dissertacao") return (au ? au + ". " : "") + o.title + ". " + (o.year || "s.d.") + ". " + (o.type === "tese" ? "Tese (Doutorado)" : "Dissertação (Mestrado)") + (o.publisher ? " – " + o.publisher : "") + ", " + (o.city ? o.city + ", " : "") + (o.year || "s.d.") + ".";
    return (au ? au + ". " : "") + o.title + ". " + (o.city ? o.city + ": " : "") + (o.publisher ? o.publisher + ", " : "") + (o.year || "s.d.") + "." + (o.url ? " Disponível em: " + o.url + "." : "");
  };
  const RefStore = { list: () => AV.LS.get("refs", []), add(o) { const l = RefStore.list(); if (l.some((x) => x.title === o.title)) return AV.toast("Já está nas suas referências."); l.unshift(o); AV.LS.set("refs", l.slice(0, 300)); AV.toast("Salvo em Minhas referências."); }, remove(t) { AV.LS.set("refs", RefStore.list().filter((x) => x.title !== t)); } };
  let acervo = null;
  let livros = null;
  async function loadLivros() { if (livros) return livros; if (AV.LIVROS_INLINE) return (livros = AV.LIVROS_INLINE); const r = await fetch("data/livros.json"); if (!r.ok) throw new Error("Não foi possível carregar os livros."); return (livros = await r.json()); }
  AV.loadLivros = loadLivros;
  const LANG_NAME = { pt: "Português", en: "English", es: "Español" };
  function bookCard(b, onOpen) {
    return h("button", { class: "bk", type: "button", "aria-label": b.title + ", " + (b.authors || []).join(", "), onclick: () => onOpen(b) },
      h("div", { class: "bk-cover" }, h("img", { src: b.cover, alt: "", loading: "lazy", decoding: "async" }), h("span", { class: "free" }, AV.t("Grátis"))),
      h("b", { "data-notr": "" }, b.title), h("span", { "data-notr": "" }, (b.authors || [])[0] || ""));
  }
  function bookDetail(b) {
    const ref = { title: b.title, authors: (b.authors || []).map((a) => { const p = a.trim().split(" "); return p.length > 1 ? p.pop().toUpperCase() + ", " + p.join(" ") : a; }), year: b.year, type: "ebook", open: true, url: b.read };
    AV.dialog(b.title, h("div", { class: "book-detail" },
      h("div", { class: "bk-cover" }, h("img", { src: b.cover, alt: AV.t("Capa de") + " " + b.title })),
      h("div", { style: { display: "grid", gap: "12px", minWidth: 0 } },
        h("p", { class: "muted", "data-notr": "" }, (b.authors || []).join(", ")),
        h("div", { class: "chips" }, h("span", { class: "chip pri" }, "Domínio público"), b.year ? h("span", { class: "chip", "data-notr": "" }, String(b.year)) : null, h("span", { class: "chip", "data-notr": "" }, LANG_NAME[b.lang] || b.lang), h("span", { class: "chip" }, AV.t(b.group)), b.pages ? h("span", { class: "chip" }, b.pages + " " + AV.t("páginas")) : null),
        h("p", { class: "small muted" }, "Leitura gratuita e legal: a obra está em domínio público e é disponibilizada pelo Internet Archive e pelo Open Library."),
        h("div", { class: "row" },
          h("a", { class: "btn pri", href: b.read, target: "_blank", rel: "noopener noreferrer" }, AV.icon("book"), "Ler grátis"),
          h("a", { class: "btn", href: b.ol, target: "_blank", rel: "noopener noreferrer" }, AV.icon("link"), "Ver no Open Library")),
        h("div", { class: "row" },
          h("button", { class: "btn sm", onclick: () => AV.copy(AV.abnt(ref)) }, AV.icon("copy"), "Copiar referência ABNT"),
          h("button", { class: "btn sm", onclick: () => RefStore.add(ref) }, AV.icon("plus"), "Salvar"),
          h("button", { class: "btn sm", onclick: () => AV.aiCreateDialog({ kind: "atividade", topic: AV.t("Leitura de") + " \u201c" + b.title + "\u201d, " + (b.authors || [])[0], extra: "Atividade de leitura e interpretação sobre a obra, com contexto do autor e da época." }) }, AV.icon("sparkle"), "Atividade sobre o livro")))), { large: true });
  }
  async function loadAcervo() { if (acervo) return acervo; if (AV.ACERVO_INLINE) return (acervo = AV.ACERVO_INLINE); const r = await fetch("data/acervo.json"); if (!r.ok) throw new Error("Não foi possível carregar o acervo."); return (acervo = await r.json()); }
  AV.loadAcervo = loadAcervo;
  /* busca ao vivo em catálogos abertos (funciona fora do claude.ai) */
  async function live(q, signal) {
    const tm = (p) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("tempo")), 7000))]);
    const jobs = [
      tm(fetch("https://openlibrary.org/search.json?limit=8&fields=title,author_name,first_publish_year,key,ebook_access,publisher,language&q=" + encodeURIComponent(q), { signal }).then((r) => r.json())).then((j) => (j.docs || []).map((d) => ({ title: d.title, authors: (d.author_name || []).slice(0, 3), year: d.first_publish_year, type: d.ebook_access === "public" ? "ebook" : "livro", publisher: (d.publisher || [])[0], open: d.ebook_access === "public", url: "https://openlibrary.org" + d.key, source: "Open Library" }))),
      tm(fetch("https://api.crossref.org/works?rows=8&select=title,author,issued,DOI,container-title,type&query=" + encodeURIComponent(q), { signal }).then((r) => r.json())).then((j) => ((j.message || {}).items || []).map((d) => ({ title: (d.title || [""])[0], authors: (d.author || []).slice(0, 3).map((a) => ((a.family || "") + (a.given ? ", " + a.given : "")).toUpperCase().replace(/, (.*)$/, (m) => m.charAt(0) + m.slice(1).toLowerCase())), year: ((d.issued || {})["date-parts"] || [[]])[0][0], type: "artigo", publisher: (d["container-title"] || [])[0], doi: d.DOI, url: d.DOI ? "https://doi.org/" + d.DOI : "", source: "Crossref" }))),
      tm(fetch("https://www.googleapis.com/books/v1/volumes?maxResults=8&q=" + encodeURIComponent(q), { signal }).then((r) => r.json())).then((j) => (j.items || []).map((d) => { const v = d.volumeInfo || {}; return { title: v.title + (v.subtitle ? ": " + v.subtitle : ""), authors: (v.authors || []).slice(0, 3), year: (v.publishedDate || "").slice(0, 4), type: "livro", publisher: v.publisher, open: (d.accessInfo || {}).viewability === "ALL_PAGES", url: v.infoLink, summary: (v.description || "").slice(0, 220), source: "Google Livros" }; }))
    ];
    const res = await Promise.allSettled(jobs);
    return { items: res.filter((r) => r.status === "fulfilled").flatMap((r) => r.value).filter((x) => x.title), ok: res.some((r) => r.status === "fulfilled") };
  }
  const TYPES = { "": "Todos os tipos", livro: "Livros", ebook: "E-books gratuitos", artigo: "Artigos", tese: "Teses", dissertacao: "Dissertações", documento: "Documentos oficiais" };
  V.acervo = {
    title: "Livros e e-books",
    render(main) {
      let q = "", type = "", area = "", open = false, ctrl = null;
      const results = h("div", { class: "list" }), liveBox = h("div", { class: "list" }), aiBox = h("div"), repoBox = h("div", { class: "grid" });
      const input = h("input", { class: "in search-xl", type: "search", id: "ac-q", placeholder: "Busque por tema, autor ou título (ex.: alfabetização, Paulo Freire, migração)", onkeydown: (e) => { if (e.key === "Enter") run(); } });
      const typeSel = h("select", { class: "in", "aria-label": "Tipo", onchange: (e) => { type = e.target.value; run(true); } }, Object.keys(TYPES).map((k) => h("option", { value: k }, TYPES[k])));
      const areaSel = h("select", { class: "in", "aria-label": "Área", onchange: (e) => { area = e.target.value; run(true); } }, h("option", { value: "" }, "Todas as áreas"));
      const openChk = h("label", { class: "check" }, h("input", { type: "checkbox", onchange: (e) => { open = e.target.checked; run(true); } }), "Só acesso aberto");
      const tabs = h("div", { class: "tabs", role: "tablist" }); let tab = "livros"; const body = h("div", { style: { display: "grid", gap: "14px", gridTemplateColumns: "minmax(0,1fr)" } });
      [["livros", "Livros grátis com capa"], ["busca", "Acervo acadêmico"], ["repos", "Repositórios e bibliotecas digitais"], ["refs", "Minhas referências"]].forEach(([k, l]) => tabs.appendChild(h("button", { role: "tab", "aria-selected": k === tab ? "true" : "false", onclick: (e) => { tab = k; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b === e.currentTarget)); draw(); } }, l)));
      main.appendChild(h("div", { class: "wrap" }, AV.pageHead("Livros e e-books", "Acervo comentado de obras de educação, e-books gratuitos, artigos, teses e documentos oficiais, com busca inteligente, referências em ABNT e atalhos para as principais bibliotecas digitais.", "shelf", "amber"), tabs, body));
      loadAcervo().then((a) => { [...new Set((a.obras || []).flatMap((o) => o.area || []))].sort().forEach((x) => areaSel.appendChild(h("option", { value: x }, x))); draw(); }).catch((e) => { body.textContent = ""; body.appendChild(h("div", { class: "empty" }, e.message)); });
      draw();
      return () => { if (ctrl) ctrl.abort(); };
      function draw() {
        body.textContent = "";
        if (tab === "livros") { drawLivros(); return; }
        if (tab === "busca") {
          body.append(h("div", { class: "search-row" }, input, h("button", { class: "btn pri", onclick: () => run() }, AV.icon("search"), "Buscar"), h("button", { class: "btn", onclick: smart }, AV.icon("sparkle"), "Busca inteligente")),
            h("div", { class: "row" }, typeSel, areaSel, openChk), aiBox, results, liveBox);
          run(true);
        } else if (tab === "repos") { drawRepos(); body.append(h("p", { class: "muted" }, "Digite um termo e abra a busca direto em cada biblioteca."), h("div", { class: "search-row" }, input, h("button", { class: "btn pri", onclick: drawRepos }, AV.icon("search"), "Atualizar links")), repoBox); }
        else drawRefs();
      }
      function item(o, saved) {
        o = Object.assign({}, o, { url: AV.safeUrl(o.url) });
        const tags = [TYPES[o.type] ? TYPES[o.type].replace(/s$/, "").replace("E-book gratuito", "E-book") : o.type, o.year, (o.area || [])[0], o.lang && o.lang !== "pt" ? o.lang.toUpperCase() : null, o.source].filter(Boolean);
        return h("article", { class: "book" },
          h("div", { class: "book-cover", style: { background: AV.GRAD[["blue", "teal", "violet", "amber", "rose", "green", "indigo", "orange"][Math.abs(hash(o.title)) % 8]] }, "aria-hidden": "true" }, h("b", null, initials(o.title))),
          h("div", { style: { minWidth: 0, display: "grid", gap: "4px" } },
            h("h3", null, o.title), h("p", { class: "muted small" }, (o.authors || []).join("; ") || "Autor não informado"),
            h("div", { class: "chips" }, tags.map((t) => h("span", { class: "chip" }, String(t))), o.open ? h("span", { class: "chip pri" }, "Acesso aberto") : null),
            o.summary ? h("p", { class: "small" }, o.summary) : null,
            h("div", { class: "row" },
              o.url ? h("a", { class: "btn sm", href: o.url, target: "_blank", rel: "noopener noreferrer" }, AV.icon("link"), o.open ? "Ler / baixar" : "Ver") : h("a", { class: "btn sm", href: "https://scholar.google.com/scholar?q=" + encodeURIComponent('"' + o.title + '" ' + ((o.authors || [])[0] || "").split(",")[0]), target: "_blank", rel: "noopener noreferrer" }, AV.icon("search"), "Encontrar"),
              h("button", { class: "btn sm", onclick: () => AV.copy(AV.abnt(o)) }, AV.icon("copy"), "ABNT"),
              saved ? h("button", { class: "btn sm ghost danger", onclick: () => { RefStore.remove(o.title); draw(); } }, AV.icon("trash"), "Remover") : h("button", { class: "btn sm", onclick: () => RefStore.add(o) }, AV.icon("plus"), "Salvar"),
              h("button", { class: "btn sm", onclick: () => { const l = AV.LS.get("sources", []); l.push({ id: AV.uid(), title: o.title, text: AV.abnt(o) + "\n\n" + (o.summary || "") + "\nPalavras-chave: " + (o.keywords || []).join(", "), on: true }); AV.LS.set("sources", l); AV.toast("Adicionado ao Estúdio de fontes."); } }, AV.icon("book"), "Estúdio"))));
      }
      function hash(s) { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return x; }
      function initials(t) { return String(t).replace(/[^A-Za-zÀ-ú ]/g, "").split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "Li"; }
      function run(silent) {
        if (!acervo) return; q = input.value.trim();
        const toks = expand(q);
        const l = (acervo.obras || []).map((o) => [o, score(o, toks)]).filter(([o, s]) => s > 0 && (!type || o.type === type) && (!area || (o.area || []).includes(area)) && (!open || o.open)).sort((a, b) => b[1] - a[1] || (b[0].year || 0) - (a[0].year || 0));
        results.textContent = "";
        results.appendChild(h("div", { class: "head" }, h("h2", null, q ? l.length + " " + AV.t("resultados no acervo") : AV.t("Destaques do acervo")), h("span", { class: "muted small" }, (acervo.obras || []).length + " " + AV.t("obras catalogadas"))));
        const frag = document.createDocumentFragment(); l.slice(0, q ? 40 : 12).forEach(([o]) => frag.appendChild(item(o))); results.appendChild(frag);
        if (q && !l.length) results.appendChild(h("div", { class: "empty" }, "Nada no acervo com esses termos. Tente a busca inteligente ou os repositórios."));
        liveBox.textContent = "";
        if (q && !silent) {
          if (ctrl) ctrl.abort(); const my = (ctrl = new AbortController());
          const spin = h("div", { class: "muted small" }, h("span", { class: "spin" }), " " + AV.t("Buscando..."));
          liveBox.append(h("h2", null, "Catálogos abertos (Open Library, Crossref, Google Livros)"), spin);
          live(q, my.signal).then((r) => {
            if (my !== ctrl || !liveBox.isConnected) return;
            spin.remove();
            if (!r.ok) { liveBox.append(h("p", { class: "note info" }, "A busca ao vivo nos catálogos funciona na versão para hospedar. Aqui, use o acervo acima ou os repositórios."), h("button", { class: "btn sm", style: { width: "fit-content" }, onclick: () => { tab = "repos"; tabs.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-selected", i === 1)); draw(); } }, "Abrir repositórios")); return; }
            r.items.slice(0, 18).forEach((o) => liveBox.appendChild(item(o)));
            if (!r.items.length) liveBox.appendChild(h("div", { class: "empty" }, "Nenhum resultado nos catálogos."));
          });
        }
      }
      async function smart(e) {
        const qq = input.value.trim(); if (!qq) { input.focus(); return; }
        const btn = e.currentTarget; AV.busy(btn, true, "Pensando...");
        try {
          const out = await AV.AI.json("Um professor procura bibliografia sobre: \"" + qq + "\". Ajude a pesquisar. Formato: {\"palavras\":[8 a 12 termos de busca em português, inglês e espanhol],\"estrategia\":\"string de busca booleana para Google Acadêmico\",\"dicas\":[3 dicas curtas],\"obras\":[{\"title\":\"\",\"authors\":[\"SOBRENOME, Nome\"],\"year\":0,\"type\":\"livro|artigo|documento\",\"publisher\":\"\",\"summary\":\"uma frase\"}]} com 4 a 8 obras REAIS e conhecidas (não invente; prefira clássicos e documentos oficiais).", { tier: "complex" });
          aiBox.textContent = "";
          aiBox.append(h("section", { class: "card", style: { display: "grid", gap: "10px" } }, h("div", { class: "row" }, AV.appIcon("wand", "pink"), h("h2", null, "Busca inteligente")),
            h("div", { class: "chips" }, (Array.isArray(out.palavras) ? out.palavras : []).map((w) => h("button", { class: "chip", onclick: () => { input.value = w; run(); } }, w))),
            out.estrategia ? h("p", { class: "small" }, h("b", null, "Estratégia: "), h("code", { "data-notr": "" }, out.estrategia), " ", h("a", { href: "https://scholar.google.com/scholar?q=" + encodeURIComponent(out.estrategia), target: "_blank", rel: "noopener noreferrer" }, "Abrir no Google Acadêmico")) : null,
            (Array.isArray(out.dicas) && out.dicas.length) ? h("ul", { class: "small", style: { margin: 0, paddingLeft: "18px" } }, out.dicas.map((d) => h("li", null, d))) : null,
            (Array.isArray(out.obras) && out.obras.length) ? h("p", { class: "note" }, "Sugestões da IA: confira cada obra antes de citar.") : null,
            h("div", { class: "list" }, (Array.isArray(out.obras) ? out.obras : []).filter((o) => o && o.title).map((o) => item(Object.assign({ source: "Sugestão da IA" }, o))))));
          const old = input.value; input.value = qq + " " + (out.palavras || []).slice(0, 6).join(" "); run(true); input.value = old;
        } catch (er) { AV.toast(AV.AI.explain(er)); }
        AV.busy(btn, false);
      }
      function drawLivros() {
        const st = Object.assign({ q: "", g: "", l: "" }, AV.LS.get("livrosState", {}));
        const shelf = h("div"), count = h("span", { class: "muted small" });
        const qi = h("input", { class: "in search-xl", type: "search", id: "lv-q", placeholder: "Busque por título ou autor (ex.: Dom Casmurro, Alice, Dewey)", value: st.q, oninput: AV.debounce((e) => { st.q = e.target.value; save(); render(); }, 160) });
        const save = () => AV.LS.set("livrosState", st);
        const gsel = h("select", { class: "in", "aria-label": "Coleção", onchange: (e) => { st.g = e.target.value; save(); render(); } }, h("option", { value: "" }, "Todas as coleções"));
        const lsel = h("select", { class: "in", "aria-label": "Idioma", "data-notr": "", onchange: (e) => { st.l = e.target.value; save(); render(); } }, h("option", { value: "" }, AV.t("Todos os idiomas")), Object.keys(LANG_NAME).map((k) => h("option", { value: k, selected: st.l === k }, LANG_NAME[k])));
        body.append(h("p", { class: "note info" }, "Livros reais em domínio público, com a capa original, para ler grátis e legalmente na internet (Internet Archive / Open Library)."),
          h("div", { class: "search-row" }, qi), h("div", { class: "row" }, gsel, lsel, h("span", { class: "spacer" }), count), shelf);
        shelf.appendChild(h("div", { class: "empty" }, h("span", { class: "spin" }), " " + AV.t("Carregando livros...")));
        let all = [];
        loadLivros().then((l) => { all = l; [...new Set(l.map((b) => b.group))].forEach((g) => gsel.appendChild(h("option", { value: g, selected: st.g === g }, g))); render(); })
          .catch((e) => { shelf.textContent = ""; shelf.appendChild(h("div", { class: "empty" }, e.message)); });
        function render() {
          const t = norm(st.q);
          const l = all.filter((b) => (!st.g || b.group === st.g) && (!st.l || b.lang === st.l) && (!t || norm(b.title + " " + (b.authors || []).join(" ")).includes(t)));
          count.textContent = l.length + " " + AV.t("livros");
          shelf.textContent = "";
          if (!l.length) { shelf.appendChild(h("div", { class: "empty" }, "Nenhum livro encontrado.")); return; }
          if (!t && !st.g) {
            [...new Set(l.map((b) => b.group))].forEach((g) => {
              const row = h("div", { class: "shelf-row" });
              shelf.append(h("div", { class: "sec-t" }, h("h2", null, g), h("button", { class: "btn sm ghost", onclick: () => { st.g = g; gsel.value = g; save(); render(); } }, AV.t("Ver todos"))), row);
              AV.renderChunked(row, l.filter((b) => b.group === g), (b) => bookCard(b, bookDetail), 8);
            });
          } else { const grid = h("div", { class: "shelf" }); shelf.appendChild(grid); AV.renderChunked(grid, l, (b) => bookCard(b, bookDetail), 24); }
        }
      }
      function drawRepos() {
        repoBox.textContent = ""; const qq = input.value.trim() || "educação";
        ((acervo && acervo.repositorios) || []).forEach((r) => repoBox.appendChild(h("article", { class: "tile", style: { cursor: "default" } },
          h("div", { class: "row" }, h("span", { class: "repo-dot", style: { background: r.color || "#2563EB" } }, (r.short || r.name).slice(0, 2)), h("h3", { style: { flex: 1 } }, r.name)),
          h("p", null, r.desc), h("div", { class: "chips" }, (r.tags || []).map((t) => h("span", { class: "chip" }, t))),
          h("a", { class: "btn sm pri", style: { width: "fit-content" }, href: r.search ? r.search.replace("{q}", encodeURIComponent(qq)) : r.home, target: "_blank", rel: "noopener noreferrer" }, AV.icon("search"), r.search ? "Buscar “" + qq.slice(0, 24) + "”" : "Abrir"))));
      }
      function drawRefs() {
        const l = RefStore.list();
        body.append(h("div", { class: "row" }, h("h2", { style: { flex: 1 } }, l.length + " " + AV.t("referências salvas")),
          h("button", { class: "btn", disabled: !l.length, onclick: () => AV.copy(l.map(AV.abnt).sort().join("\n\n")) }, AV.icon("copy"), "Copiar todas (ABNT)"),
          h("button", { class: "btn pri", disabled: !l.length, onclick: () => AV.createAndOpen("projeto", "Referências", [{ type: "heading", text: "Referências", level: 1 }].concat(l.map(AV.abnt).sort().map((t) => ({ type: "paragraph", text: t })))) }, AV.icon("doc"), "Criar documento")));
        if (!l.length) body.append(h("div", { class: "empty" }, "Salve obras pela busca para montar sua bibliografia."));
        l.forEach((o) => body.append(item(o, true)));
      }
    }
  };
})(globalThis.AV = globalThis.AV || {});

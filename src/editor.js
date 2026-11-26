(function (AV) {
  "use strict";
  const h = AV.h;

  AV.readImage = function (file, max) {
    return new Promise((ok, fail) => {
      if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type)) return fail(new Error("Use uma imagem PNG, JPG, WEBP ou GIF."));
      if (file.size > 15e6) return fail(new Error("Imagem muito grande (máx. 15 MB)."));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, (max || 1000) / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("Não foi possível ler a imagem.")); };
      img.src = url;
    });
  };
  AV.pickFile = function (accept, multiple) {
    return new Promise((ok) => {
      const i = h("input", { type: "file", accept, multiple: !!multiple, style: { display: "none" } });
      i.addEventListener("change", () => { ok([...i.files]); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  };
  AV.IMPORT_ACCEPT = ".docx,.odt,.pptx,.pdf,.txt,.md,.rtf,.srt,.vtt,.json,.png,.jpg,.jpeg,.webp,.gif";

  AV.views.editor = {
    title: "Editor", nav: "materiais",
    render(main) {
      let doc = AV.Store.get(AV.LS.get("lastDoc"));
      if (!doc) { main.appendChild(h("div", { class: "wrap" }, h("div", { class: "empty" }, "Nenhum material aberto. ", h("a", { href: "#inicio" }, "Comece pelo Início.")))); return; }
      doc = AV.clone(doc);
      let version = "aluno";
      let dirty = false, alive = true; const aiCtrls = new Set();
      const flush = () => { if (dirty && AV.Store.get(doc.id)) { dirty = false; AV.Store.put(AV.clone(doc)); } };
      const save = AV.debounce(flush, 600);
      const onHide = () => { if (document.visibilityState === "hidden") flush(); };
      document.addEventListener("visibilitychange", onHide); addEventListener("pagehide", flush);
      const refresh = AV.debounce(() => { if (ed.dataset.show !== "edit" || innerWidth > 1000) { pv.textContent = ""; pv.appendChild(AV.renderPaper(doc, version)); } }, 350);
      const changed = () => { dirty = true; save(); refresh(); };

      const title = h("input", { class: "ed-title", id: "ed-title", value: doc.meta.title, "aria-label": "Título do material", oninput: (e) => { doc.meta.title = e.target.value; changed(); } });
      const bar = h("div", { class: "ed-bar" }, h("a", { class: "btn ghost icon", href: "#materiais", "aria-label": "Voltar para Meus materiais" }, AV.icon("back")), title,
        h("button", { class: "btn sm", onclick: () => addMenu(doc.blocks.length) }, AV.icon("plus"), "Adicionar"),
        h("button", { class: "btn sm", onclick: aiMenu }, AV.icon("sparkle"), "Editar com IA"),
        h("button", { class: "btn sm", onclick: moreMenu }, AV.icon("more"), "Mais"),
        h("button", { class: "btn sm icon", "aria-label": "Configurações do documento", title: "Configurações do documento", onclick: settings }, AV.icon("gear")),
        h("button", { class: "btn sm wa icon", "aria-label": "WhatsApp", title: "WhatsApp", onclick: () => AV.whatsSheet(doc) }, AV.icon("chat")),
        h("button", { class: "btn sm pri", onclick: () => AV.exportDialog(doc) }, AV.icon("download"), "Exportar"));
      const list = h("div", { class: "blocks" });
      const pv = h("div", { "aria-label": "Prévia do material" });
      const vseg = h("div", { class: "seg", role: "group", "aria-label": "Versão da prévia" }, ["aluno", "professor"].map((v) => h("button", { type: "button", "aria-pressed": v === version ? "true" : "false", onclick: (e) => { version = v; vseg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === e.currentTarget)); refresh(); } }, v === "aluno" ? "Aluno" : "Professor")));
      const mtabs = h("div", { class: "ed-mobile-tabs seg", role: "group" }, ["edit", "preview"].map((v) => h("button", { type: "button", "aria-pressed": v === "edit" ? "true" : "false", onclick: (e) => { ed.dataset.show = v; mtabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === e.currentTarget)); refresh(); } }, v === "edit" ? "Editar" : "Prévia")));
      const ed = h("div", { class: "ed", "data-show": "edit" },
        h("div", { class: "blocks-col", style: { display: "grid", gap: "10px" } }, list, h("div", { class: "addbar" }, h("button", { class: "btn", onclick: () => addMenu(doc.blocks.length) }, AV.icon("plus"), "Adicionar bloco"))),
        h("div", { class: "preview" }, h("div", { class: "row", style: { marginBottom: "10px" } }, h("b", null, "Prévia"), h("span", { class: "spacer" }), vseg), pv));
      main.appendChild(h("div", { class: "wrap", style: { maxWidth: "1300px" } }, bar, mtabs, ed));
      renderList(); refresh();

      function renderList() {
        list.textContent = "";
        if (!doc.blocks.length) list.appendChild(h("div", { class: "empty" }, "Material vazio. Adicione blocos, cole questões na Lista rápida ou peça ajuda à IA."));
        doc.blocks.forEach((b, i) => { let c; try { c = card(b, i); } catch (e) { c = h("section", { class: "blk" }, h("div", { class: "blk-h" }, h("span", { class: "t" }, "Bloco inválido"), h("button", { class: "btn ghost sm icon danger", "aria-label": "Excluir bloco", onclick: () => { doc.blocks.splice(i, 1); renderList(); changed(); } }, AV.icon("trash")))); } list.appendChild(c); });
      }
      function move(i, d) { const j = i + d; if (j < 0 || j >= doc.blocks.length) return; [doc.blocks[i], doc.blocks[j]] = [doc.blocks[j], doc.blocks[i]]; renderList(); changed(); list.children[j] && list.children[j].querySelector("button").focus(); }
      function card(b, i) {
        const meta = AV.BLOCKS[b.type] || [b.type, "?"];
        return h("section", { class: "blk", "aria-label": meta[0] },
          h("div", { class: "blk-h" }, h("span", { class: "t" }, h("i", null, meta[1]), meta[0]),
            h("button", { class: "btn ghost sm icon", "aria-label": "Mover para cima", onclick: () => move(i, -1), disabled: i === 0 }, AV.icon("up")),
            h("button", { class: "btn ghost sm icon", "aria-label": "Mover para baixo", onclick: () => move(i, 1), disabled: i === doc.blocks.length - 1 }, AV.icon("down")),
            h("button", { class: "btn ghost sm icon", "aria-label": "Inserir bloco abaixo", onclick: () => addMenu(i + 1) }, AV.icon("plus")),
            h("button", { class: "btn ghost sm icon", "aria-label": "Duplicar", onclick: () => { doc.blocks.splice(i + 1, 0, Object.assign(AV.clone(b), { id: AV.uid() })); renderList(); changed(); } }, AV.icon("copy")),
            h("button", { class: "btn ghost sm icon danger", "aria-label": "Excluir bloco", onclick: () => { const removed = doc.blocks.splice(i, 1)[0]; renderList(); changed(); AV.toast(h("span", null, AV.t("Bloco excluído."), " ", h("button", { class: "btn sm", style: { minHeight: "28px", marginLeft: "6px" }, onclick: (e) => { e.currentTarget.disabled = true; doc.blocks.splice(Math.min(i, doc.blocks.length), 0, removed); renderList(); changed(); } }, AV.t("Desfazer"))), 6000); } }, AV.icon("trash"))),
          fields(b));
      }
      /* campos de edição por tipo */
      function inp(b, k, ph, type) { return h("input", { class: "in", type: type || "text", value: b[k] == null ? "" : b[k], placeholder: ph || "", oninput: (e) => { b[k] = type === "number" ? +e.target.value : e.target.value; changed(); } }); }
      function area(b, k, ph, rows) { return h("textarea", { class: "in", rows: rows || 3, placeholder: ph || "", oninput: (e) => { b[k] = e.target.value; changed(); } }, b[k] || ""); }
      function lab(t, el) { return h("label", { class: "f" }, t, el); }
      function strList(b, k, ph, extra) {
        const box = h("div", { class: "opts" });
        const draw = () => {
          box.textContent = "";
          (b[k] || []).forEach((v, j) => box.appendChild(h("div", { class: "opt-row" }, extra ? extra(j) : h("span", { class: "muted small" }, (j + 1) + "."),
            h("input", { class: "in", value: v, placeholder: ph + " " + (j + 1), "aria-label": ph + " " + (j + 1), oninput: (e) => { b[k][j] = e.target.value; changed(); } }),
            h("button", { class: "btn ghost sm icon", "aria-label": "Remover", onclick: () => { b[k].splice(j, 1); if (b.answers && k === "statements") b.answers.splice(j, 1); if (k === "options") { if (j < b.correct) b.correct--; else if (j === b.correct) b.correct = 0; if (b.correct >= b[k].length) b.correct = 0; } draw(); changed(); } }, AV.icon("x")))));
          box.appendChild(h("button", { class: "btn sm", style: { width: "fit-content" }, onclick: () => { b[k].push(""); if (k === "statements") b.answers.push(true); draw(); changed(); } }, AV.icon("plus"), "Adicionar"));
        };
        draw(); return box;
      }
      function fields(b) {
        switch (b.type) {
          case "heading": return h("div", { class: "form" }, h("label", { class: "f full" }, "Título", inp(b, "text")), lab("Nível", h("select", { class: "in", onchange: (e) => { b.level = +e.target.value; changed(); } }, h("option", { value: 1, selected: b.level !== 2 }, "Seção"), h("option", { value: 2, selected: b.level === 2 }, "Subseção"))));
          case "paragraph": return area(b, "text", "Escreva aqui. Use **negrito** e *itálico*.", 4);
          case "bullets": return strList(b, "items", "Item");
          case "callout": return h("div", { class: "form" }, lab("Estilo", h("select", { class: "in", onchange: (e) => { b.style = e.target.value; if (!b.title || Object.values(AV.CALLOUTS).some((c) => c[0] === b.title)) b.title = AV.CALLOUTS[b.style][0]; changed(); } }, Object.keys(AV.CALLOUTS).map((k) => h("option", { value: k, selected: k === b.style }, AV.CALLOUTS[k][0])))), lab("Título", inp(b, "title")), h("label", { class: "f full" }, "Texto", area(b, "text")));
          case "image": {
            const img = h("img", { src: b.data || "", alt: "", style: { maxHeight: "160px", width: "auto", borderRadius: "8px", display: b.data ? "block" : "none" } });
            return h("div", { class: "form" }, h("div", { class: "full row" }, img, h("button", { class: "btn sm", onclick: async () => { const [f] = await AV.pickFile("image/*"); if (!f) return; try { b.data = await AV.readImage(f); img.src = b.data; img.style.display = "block"; changed(); } catch (e) { AV.toast(e.message); } } }, AV.icon("image"), b.data ? "Trocar imagem" : "Escolher imagem")),
              lab("Legenda", inp(b, "caption")), lab("Largura (%)", inp(b, "width", "80", "number")));
          }
          case "qrcode": return h("div", { class: "form" }, h("label", { class: "f full" }, "Link do QR code", inp(b, "url", "https://...")), lab("Legenda", inp(b, "caption")), lab("Tamanho (mm)", inp(b, "size", "34", "number")));
          case "link": return h("div", { class: "form" }, lab("Texto do botão", inp(b, "label")), lab("Link", inp(b, "url", "https://...")), h("label", { class: "f full" }, "Descrição", inp(b, "description")));
          case "word": return h("div", { class: "form" }, lab("Nome", inp(b, "label")), lab("Link do documento", inp(b, "url", "https://drive.google.com/...")));
          case "video": return h("div", { class: "form" }, lab("Título", inp(b, "title")), lab("Link do vídeo", inp(b, "url", "YouTube, Drive ou Vimeo")), h("label", { class: "f full" }, "Informação", inp(b, "info", "Ex.: 5 minutos")));
          case "choice_question": {
            const name = "c" + b.id;
            return h("div", { style: { display: "grid", gap: "8px" } }, lab("Enunciado", area(b, "prompt", "Qual alternativa...?", 2)), h("span", { class: "small muted" }, "Marque a alternativa correta:"),
              strList(b, "options", "Alternativa", (j) => h("input", { type: "radio", name, checked: b.correct === j, "aria-label": "Correta", onchange: () => { b.correct = j; changed(); } })));
          }
          case "true_false": return strList(b, "statements", "Afirmação", (j) => h("select", { class: "in", style: { width: "64px" }, "aria-label": "Resposta", onchange: (e) => { b.answers[j] = e.target.value === "V"; changed(); } }, h("option", { selected: b.answers[j] !== false }, "V"), h("option", { selected: b.answers[j] === false }, "F")));
          case "open_question": return h("div", { class: "form" }, h("label", { class: "f full" }, "Pergunta", area(b, "prompt", "Explique...", 2)), lab("Linhas", inp(b, "lines", "4", "number")), lab("Resposta esperada (gabarito)", inp(b, "answer")));
          case "fill_blank": return h("div", { class: "form" }, h("label", { class: "f full" }, "Instrução", inp(b, "prompt")), h("label", { class: "f full" }, "Texto (respostas entre [colchetes])", area(b, "text", "O [Sol] é uma estrela.", 3)));
          case "match": {
            const box = h("div", { class: "opts" });
            const pairs = () => (b.left || []).map((l, i) => [l, b.right[(b.answers || [])[i]] || ""]);
            const set = (ps) => { const idx = ps.map((_, i) => i).sort(() => Math.random() - .5); b.left = ps.map((p) => p[0]); b.right = idx.map((i) => ps[i][1]); b.answers = ps.map((_, i) => idx.indexOf(i)); changed(); };
            const draw = () => {
              box.textContent = ""; const ps = pairs();
              ps.forEach((p, j) => box.appendChild(h("div", { class: "opt-row", style: { gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto" } },
                h("input", { class: "in", value: p[0], "aria-label": "Coluna A " + (j + 1), onchange: (e) => { const q = pairs(); q[j][0] = e.target.value; set(q); } }),
                h("input", { class: "in", value: p[1], "aria-label": "Coluna B " + (j + 1), onchange: (e) => { const q = pairs(); q[j][1] = e.target.value; set(q); } }),
                h("button", { class: "btn ghost sm icon", "aria-label": "Remover par", onclick: () => { const q = pairs(); q.splice(j, 1); set(q); draw(); } }, AV.icon("x")))));
              box.appendChild(h("button", { class: "btn sm", style: { width: "fit-content" }, onclick: () => { const q = pairs(); q.push(["", ""]); set(q); draw(); } }, AV.icon("plus"), "Adicionar par"));
            };
            draw(); return h("div", { style: { display: "grid", gap: "8px" } }, lab("Instrução", inp(b, "prompt")), h("span", { class: "small muted" }, "Escreva os pares certos; a coluna B é embaralhada no material."), box);
          }
          case "table": {
            if (!Array.isArray(b.rows) || !b.rows.length || !Array.isArray(b.rows[0]) || !b.rows[0].length) b.rows = [["", ""], ["", ""]];
            const box = h("div", { style: { overflowX: "auto" } });
            const draw = () => {
              box.textContent = "";
              const t = h("table", { style: { borderCollapse: "collapse" } }, b.rows.map((r, ri) => h("tr", null, r.map((c, ci) => h("td", { style: { padding: "2px" } }, h("input", { class: "in", style: { minWidth: "110px", fontWeight: ri ? 400 : 800 }, value: c, "aria-label": "Linha " + (ri + 1) + " coluna " + (ci + 1), oninput: (e) => { b.rows[ri][ci] = e.target.value; changed(); } }))))));
              box.append(t, h("div", { class: "row", style: { marginTop: "6px" } },
                h("button", { class: "btn sm", onclick: () => { b.rows.push(b.rows[0].map(() => "")); draw(); changed(); } }, "+ Linha"),
                h("button", { class: "btn sm", onclick: () => { b.rows.forEach((r) => r.push("")); draw(); changed(); } }, "+ Coluna"),
                h("button", { class: "btn sm", disabled: b.rows.length < 3, onclick: () => { b.rows.pop(); draw(); changed(); } }, "− Linha"),
                h("button", { class: "btn sm", disabled: b.rows[0].length < 2, onclick: () => { b.rows.forEach((r) => r.pop()); draw(); changed(); } }, "− Coluna")));
            };
            draw(); return box;
          }
          case "word_search": return h("div", { class: "form" }, h("label", { class: "f full" }, "Título", inp(b, "title")), h("p", { class: "muted small full" }, "Palavras: " + (b.words || []).join(", ") + ". Para mudar a grade, gere de novo em Atividades."));
          case "crossword": return h("div", { class: "form" }, h("label", { class: "f full" }, "Título", inp(b, "title")), h("p", { class: "muted small full" }, ((b.clues.across || []).length + (b.clues.down || []).length) + " dicas. Para mudar, gere de novo em Atividades."));
          default: return h("p", { class: "muted small" }, b.type === "page_break" ? "O conteúdo a seguir começa em uma nova página." : "Linha separadora.");
        }
      }
      function insert(i, blocks) { doc.blocks.splice(i, 0, ...blocks.map((b) => Object.assign({}, b, { id: b.id || AV.uid() }))); renderList(); changed(); }
      function addMenu(at) {
        const types = Object.keys(AV.BLOCKS).filter((t) => AV.BLOCKS[t][3]);
        const d = AV.dialog("Adicionar bloco", h("div", { class: "menu cols" }, types.map((t) => h("button", { onclick: () => { d.close(); insert(at, [AV.newBlock(t)]); setTimeout(() => { const c = list.children[at]; c && c.scrollIntoView({ block: "center" }); const f = c && c.querySelector("input,textarea"); f && f.focus(); }, 30); } },
          h("span", { style: { gridRow: "span 2", width: "28px", height: "28px", borderRadius: "8px", background: "var(--pri-soft)", color: "var(--pri)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: ".75rem" } }, AV.BLOCKS[t][1]), h("b", null, AV.BLOCKS[t][0]), h("span", null, AV.BLOCKS[t][2])))), { large: true });
      }
      function quickList() {
        const ta = h("textarea", { class: "in", rows: 12, id: "ql-text", style: { fontFamily: "var(--f-m)" }, placeholder: "# Título\n> Instruções\n\n1) Quanto é 7 × 8?\na) 54\n*b) 56\n\n2) Marque V ou F:\n(V) O Sol é uma estrela.\n(F) A Lua tem luz própria.\n\n3) Explique a fotossíntese.\nResposta: ..." });
        const d = AV.dialog("Lista rápida", h("div", { style: { display: "grid", gap: "12px" } }, h("p", { class: "muted small" }, "Cole ou digite as questões em texto comum. *b) marca a correta; (V)/(F) para verdadeiro ou falso; Resposta: vai para o gabarito."), ta,
          h("div", { class: "row end" }, h("button", { class: "btn pri", onclick: () => { const bl = AV.importers ? AV.importers.parseQuickList(ta.value) : []; if (!bl.length) { AV.toast("Não encontrei questões no texto."); return; } insert(doc.blocks.length, bl); d.close(); AV.toast(bl.length + " blocos adicionados."); } }, "Transformar em questões"))), { large: true });
      }
      async function fromFile() {
        const [f] = await AV.pickFile(AV.IMPORT_ACCEPT); if (!f) return;
        AV.toast("Lendo " + f.name + "...");
        try { const r = await AV.importers.importFile(f); const bl = r.doc ? r.doc.blocks : r.blocks; insert(doc.blocks.length, bl || []); AV.toast((bl || []).length + " blocos trazidos de " + f.name + "."); }
        catch (e) { AV.toast((e && e.message) || "Não foi possível ler o arquivo."); }
      }
      function moreMenu() {
        const d = AV.dialog("Mais opções", h("div", { class: "menu" },
          h("button", { onclick: () => { d.close(); quickList(); } }, AV.icon("list"), h("b", null, "Lista rápida"), h("span", null, "Cole questões em texto e elas viram questões interativas")),
          h("button", { onclick: () => { d.close(); fromFile(); } }, AV.icon("upload"), h("b", null, "Trazer conteúdo de um arquivo"), h("span", null, "Word, PowerPoint, PDF, ODT, TXT, RTF, legendas")),
          h("button", { onclick: () => { d.close(); AV.go("atividades"); AV.LS.set("insertInto", doc.id); } }, AV.icon("puzzle"), h("b", null, "Inserir atividade pronta"), h("span", null, "Caça-palavras, cruzadinha, ligar, contas...")),
          h("button", { onclick: () => { d.close(); AV.go("ferramentas"); } }, AV.icon("qr"), h("b", null, "Gerador de QR code e links"), h("span", null, "WhatsApp, YouTube no minuto, Drive, Docs...")),
          h("button", { onclick: () => { const c = AV.clone(doc); c.id = AV.uid(); c.meta.title += " (cópia)"; d.close(); AV.openDoc(c); } }, AV.icon("copy"), h("b", null, "Duplicar material"), h("span", null, "Cria uma cópia para outra turma"))));
      }
      function editWithAI() {
        const instruction = h("textarea", { class: "in", rows: 3, maxLength: 4000, placeholder: "Ex.: desenvolva a segunda etapa com um exemplo comentado ou simplifique a leitura para o 6º ano." });
        const feedback = h("p", { class: "muted small", role: "status" });
        const preview = h("div");
        const generate = h("button", { class: "btn pri", onclick: propose }, "Gerar proposta");
        const apply = h("button", { class: "btn pri", hidden: true, onclick: accept }, "Aplicar alterações");
        const ctrl = new AbortController();
        aiCtrls.add(ctrl);
        let proposal, baseline;
        const d = AV.dialog("Editar com IA", h("div", { style: { display: "grid", gap: "12px" } },
          lab("O que você quer modificar neste material?", instruction), feedback, preview,
          h("div", { class: "row end" }, generate, apply)), { large: true, onClose: () => { ctrl.abort(); aiCtrls.delete(ctrl); } });
        instruction.oninput = () => { proposal = null; apply.hidden = true; preview.textContent = ""; feedback.textContent = ""; };
        instruction.focus();

        async function propose() {
          const request = instruction.value.trim();
          if (!request) { feedback.textContent = "Descreva a alteração desejada."; instruction.focus(); return; }
          baseline = JSON.stringify(doc.blocks);
          instruction.disabled = true; generate.disabled = true; apply.hidden = true;
          preview.textContent = ""; feedback.textContent = "Preparando a proposta…";
          try {
            proposal = await AV.AI.revise(doc, request, ctrl.signal);
            if (!alive || ctrl.signal.aborted) return;
            preview.appendChild(AV.renderPaper(Object.assign({}, doc, { blocks: proposal }), version));
            feedback.textContent = "Confira o material revisado antes de aplicar.";
            apply.hidden = false;
          } catch (e) { if (!ctrl.signal.aborted) feedback.textContent = AV.AI.explain(e); }
          finally { instruction.disabled = false; generate.disabled = false; }
        }

        function accept() {
          if (!alive || !proposal || ctrl.signal.aborted) return;
          if (JSON.stringify(doc.blocks) !== baseline) { apply.hidden = true; feedback.textContent = "O material mudou. Gere uma nova proposta."; return; }
          doc.blocks = proposal; renderList(); changed(); flush(); d.close(); AV.toast("Alterações aplicadas.");
        }
      }

      function aiMenu() {
        const acts = [
          ["Gerar mais questões", "Cria questões variadas sobre o conteúdo atual", "questions"],
          ["Revisar e melhorar textos", "Corrige e deixa a linguagem mais clara", "improve"],
          ["Adaptar para inclusão", "Versão com linguagem simplificada e apoio visual", "inclusive"],
          ["Criar resumo para o aluno", "Um destaque com os pontos principais", "summary"],
          ["Sugerir vídeos e links", "Recursos para enriquecer a aula", "links"]
        ];
        const status = h("p", { class: "muted small", "aria-live": "polite" });
        const d = AV.dialog("Assistente de IA", h("div", { style: { display: "grid", gap: "10px" } }, h("div", { class: "menu" }, h("button", { onclick: () => { d.close(); editWithAI(); } }, AV.icon("sparkle"), h("b", null, "Modificar com um pedido"), h("span", null, "Descreva a mudança e revise a proposta.")), acts.map((a) => h("button", { onclick: (e) => run(a[2], e.currentTarget) }, AV.icon("sparkle"), h("b", null, a[0]), h("span", null, a[1])))), status), { onClose: () => aiCtrls.forEach((c) => c.abort()) });
        async function run(kind, btn) {
          d.el.querySelectorAll(".menu button").forEach((x) => (x.disabled = true));
          AV.busy(btn, true, "Pensando...");
          const ctrl = new AbortController(); aiCtrls.add(ctrl);
          const opt = (o) => Object.assign({ signal: ctrl.signal, lang: AV.docLang(doc), tier: "complex" }, o || {});
          const ctx = "Material atual (" + doc.meta.title + ", " + [doc.meta.subject, doc.meta.level].filter(Boolean).join(", ") + "):\n" + AV.docText(doc, 12000);
          try {
            if (kind === "improve" || kind === "inclusive") {
              const out = await AV.AI.json(ctx + "\n\n" + (kind === "improve" ? "Revise ortografia, clareza e precisão de cada texto." : "Adapte para alunos com dificuldades de aprendizagem: frases curtas, vocabulário simples, instruções passo a passo.") +
                "\nDevolva {\"blocks\": [...]} com OS MESMOS blocos (mesmos type e id, mesma ordem), alterando só os textos. Blocos atuais:\n" + JSON.stringify(doc.blocks.filter((b) => b.type !== "image").map((b) => { const c = Object.assign({}, b); delete c.data; return c; })).slice(0, 30000), opt({ tier: "complex" }));
              if (!alive) return;
              const byId = new Map((Array.isArray(out.blocks) ? out.blocks : []).map((b) => [b && b.id, b]));
              const keep = ["id", "type", "data", "correct", "answers", "url", "width", "size", "lines", "level", "style", "solution", "grid"];
              const merged = doc.blocks.map((b) => { const n = byId.get(b.id); if (!n || n.type !== b.type) return b; const m = Object.assign({}, b, n); keep.forEach((k) => { if (k in b) m[k] = b[k]; }); if (Array.isArray(b.options) && (!Array.isArray(n.options) || n.options.length !== b.options.length)) m.options = b.options; if (Array.isArray(b.statements) && (!Array.isArray(n.statements) || n.statements.length !== b.statements.length)) m.statements = b.statements; return m; });
              doc.blocks = AV.importers && AV.importers.sanitizeDoc ? AV.importers.sanitizeDoc({ meta: doc.meta, blocks: merged }).blocks : merged;
              renderList(); changed(); d.close(); AV.toast(kind === "improve" ? "Textos revisados." : "Material adaptado.");
              return;
            }
            const req = { questions: "Crie de 5 a 8 novas questões variadas (choice_question, true_false, open_question, fill_blank, match) sobre o conteúdo, sem repetir as existentes.", summary: "Crie um bloco callout (style dica, title 'Resumo') com os pontos principais em tópicos curtos.", links: "Sugira 3 a 5 blocos do tipo link ou video com recursos confiáveis (sites oficiais ou buscas do YouTube) e um paragraph explicando como usar." }[kind];
            const out = await AV.AI.json(ctx + "\n\n" + req + "\nDevolva {\"blocks\": [...]} usando o mesmo formato de blocos do AulaViva: heading, paragraph, bullets, callout, choice_question{prompt,options,correct}, true_false{statements,answers}, open_question{prompt,lines,answer}, fill_blank{prompt,text com [respostas]}, match{prompt,left,right na ordem dos pares}, link{label,url,description}, video{title,url,info}.", opt());
            if (!alive) return;
            const nd = AV.AI.toDoc(out, { kind: doc.meta.kind });
            insert(doc.blocks.length, nd.blocks.filter((b) => b.type !== "callout" || kind === "summary"));
            d.close(); AV.toast(nd.blocks.length + " blocos adicionados ao final.");
          } catch (e) { if (!alive) return; status.textContent = AV.AI.explain(e); AV.busy(btn, false); d.el.querySelectorAll(".menu button").forEach((x) => (x.disabled = false)); }
          finally { aiCtrls.delete(ctrl); }
        }
      }
      function settings() {
        const m = doc.meta;
        const t = (k, l, ph) => h("label", { class: "f" }, l, h("input", { class: "in", value: m[k] || "", placeholder: ph || "", oninput: (e) => { m[k] = e.target.value; if (k === "title") title.value = m.title; changed(); } }));
        const c = (k, l) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!m[k], onchange: (e) => { m[k] = e.target.checked; changed(); } }), l);
        const pw = h("input", { class: "in", type: "password", autocomplete: "new-password", value: m.owner_password || "", placeholder: "Senha do professor", oninput: (e) => { m.owner_password = e.target.value; changed(); } });
        AV.dialog("Configurações do documento", h("div", { style: { display: "grid", gap: "16px" } },
          h("div", { class: "form" }, t("title", "Título"), t("subtitle", "Subtítulo"), t("subject", "Componente curricular"), t("level", "Ano / turma"), t("school", "Escola"), t("author", "Professor(a)"),
            h("label", { class: "f" }, "Tipo", h("select", { class: "in", onchange: (e) => { m.kind = e.target.value; changed(); } }, Object.keys(AV.KINDS).map((k) => h("option", { value: k, selected: k === m.kind }, AV.KINDS[k][0])))),
            h("label", { class: "f" }, "Cor do tema", h("select", { class: "in", onchange: (e) => { m.theme = e.target.value; changed(); } }, Object.keys(AV.THEMES).map((k) => h("option", { value: k, selected: k === m.theme }, k)))),
            t("footer", "Rodapé", "Ex.: E.M. Rio Verde · 2026"),
            h("label", { class: "f" }, "Idioma do material", h("select", { class: "in", "data-notr": "", onchange: (e) => { m.lang = e.target.value; changed(); } }, Object.keys(AV.LANGS).map((k) => h("option", { value: k, selected: k === AV.docLang(doc) }, AV.LANGS[k][2] + " " + AV.LANGS[k][0]))))),
          h("div", { class: "form" }, c("cover", "Capa"), c("toc", "Sumário clicável"), c("page_numbers", "Números de página"), c("student_fields", "Campos Nome / Turma / Data"), c("answer_key", "Gabarito ao final (versão do aluno)")),
          h("div", { class: "card", style: { display: "grid", gap: "10px" } }, h("b", null, "Proteção do PDF"), c("protect", "Proteger com senha (impede alterações; os alunos continuam respondendo)"), pw, h("div", { class: "row" }, c("allow_print", "Permitir imprimir"), c("allow_copy", "Permitir copiar texto")))), { large: true });
      }
      return () => { alive = false; aiCtrls.forEach((c) => c.abort()); save.cancel(); refresh.cancel(); flush(); document.removeEventListener("visibilitychange", onHide); removeEventListener("pagehide", flush); };
    }
  };
})(globalThis.AV = globalThis.AV || {});

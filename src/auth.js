(function (AV) {
  "use strict";
  const h = AV.h;
  const SHOTS = [
    ["Crie com IA e acompanhe ao vivo", "A IA escreve apostilas, provas e planos alinhados à BNCC, bloco a bloco, enquanto você assiste."],
    ["Vídeos animados para crianças", "Personagens, cenários, falas, legendas e narração, prontos em minutos."],
    ["Livros reais, grátis, com capa", "Clássicos em domínio público para ler online, com referência ABNT."],
    ["Editor com prévia do aluno e do professor", "PDF interativo, Word e PowerPoint, com gabarito automático."],
    ["Atividades prontas para imprimir", "Caça-palavras, cruzadinha, contas, sílabas e mais 9 tipos."],
    ["Estúdio de fontes", "Resumos, quizzes, mapas mentais e áudio a partir dos seus textos."]
  ];
  const AUTOLOCK_MIN = () => +(AV.LS.get("ui", {}).autolock || 15);

  AV.Auth = {
    /* Mostra a tela de entrada e só resolve quando o cofre estiver aberto (ou no modo visitante). */
    async gate() {
      if (!AV.Vault) return;
      if (top !== self) { document.body.textContent = "O AulaViva Studio não pode ser aberto dentro de outra página por segurança."; throw new Error("framed"); }
      const institutional = AV.Conta ? await AV.Conta.loadConfig() : false;
      if (institutional) {
        /* conta institucional: sessão confirmada no servidor + cofre local da mesma conta */
        if ((await AV.Conta.restore()) && AV.Vault.exists() && (await AV.Vault.resume())) { startIdle(); return; }
        await new Promise((resolve) => screen(resolve, true));
        startIdle(); return;
      }
      if (AV.Vault.exists() && (await AV.Vault.resume())) { startIdle(); return; }
      await new Promise((resolve) => screen(resolve, false));
      startIdle();
    },
    lockNow() { if (AV.Vault) { AV.Vault.forget(); AV.Vault.lock(); } }
  };

  function screen(done, institutional) {
    const exists = AV.Vault.exists();
    let mode = exists ? "login" : "signup";
    const root = h("div", { class: "auth", role: "main", "aria-label": "Entrar no AulaViva Studio" });
    /* vitrine */
    const imgs = (AV.LOGIN_SHOTS || []).map((src, i) => h("img", { src, alt: AV.t(SHOTS[i] ? SHOTS[i][0] : "AulaViva Studio"), class: i ? "" : "on", decoding: "async" }));
    const cap = h("div", { class: "auth-cap", "aria-live": "polite" }, h("b", null, AV.t(SHOTS[0][0])), h("span", null, AV.t(SHOTS[0][1])));
    const dots = h("div", { class: "auth-dots", role: "tablist", "aria-label": "Amostras" });
    let cur = 0, timer = null;
    const show = (i) => { cur = (i + imgs.length) % imgs.length; imgs.forEach((im, k) => im.classList.toggle("on", k === cur)); [...dots.children].forEach((d, k) => d.setAttribute("aria-selected", k === cur ? "true" : "false")); const s = SHOTS[cur] || SHOTS[0]; cap.textContent = ""; cap.append(h("b", null, AV.t(s[0])), h("span", null, AV.t(s[1]))); };
    imgs.forEach((_, i) => dots.appendChild(h("button", { type: "button", role: "tab", "aria-label": AV.t("Amostra") + " " + (i + 1), "aria-selected": i ? "false" : "true", onclick: () => { show(i); restart(); } })));
    const restart = () => { clearInterval(timer); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => show(cur + 1), 4800); };
    restart();
    const showcase = h("section", { class: "auth-show" },
      h("div", { class: "auth-brand" }, h("span", { class: "auth-logo" }, AV.icon("logo")), h("b", null, "AulaViva"), h("span", null, "Studio")),
      h("h1", null, AV.t("Bem-vindo(a) ao AulaViva Studio")),
      h("p", { class: "auth-lead" }, AV.t("A plataforma que prepara suas aulas com você: crie materiais completos com IA, transforme-os em PDF interativo, Word ou PowerPoint e leve para a sala em minutos.")),
      h("ul", { class: "auth-feats" },
        [["wand", "Materiais alinhados à BNCC em português, inglês e espanhol"], ["film", "Vídeos animados, atividades e 490 modelos prontos"], ["shelf", "Biblioteca com livros reais em domínio público"], ["exam", "Provas e listas com gabarito e versão do aluno"]].map(([i, t]) => h("li", null, AV.appIcon(i, "transparent"), AV.t(t)))),
      imgs.length ? h("div", { class: "auth-gallery" }, h("div", { class: "auth-frame" }, imgs), cap, dots) : null);
    /* formulário */
    const msg = h("p", { class: "auth-msg", role: "alert" });
    const name = h("input", { class: "in", id: "au-name", autocomplete: "name", placeholder: "Profa. Ana Souza", maxlength: 80 });
    const pw = h("input", { class: "in", id: "au-pw", type: "password", autocomplete: exists ? "current-password" : "new-password", required: true, minlength: 8, maxlength: 128 });
    const pw2 = h("input", { class: "in", id: "au-pw2", type: "password", autocomplete: "new-password", maxlength: 128 });
    const rec = h("input", { class: "in", id: "au-rec", autocomplete: "off", spellcheck: "false", placeholder: "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX", "data-notr": "" });
    const eye = h("button", { class: "btn ghost sm icon", type: "button", "aria-label": "Mostrar senha", onclick: () => { const t = pw.type === "password" ? "text" : "password"; pw.type = t; pw2.type = t; } }, AV.icon("eye"));
    const meter = h("div", { class: "auth-meter", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i"));
    const meterTxt = h("span", { class: "small muted", "aria-live": "polite" });
    const remember = h("input", { type: "checkbox", id: "au-remember" });
    pw.addEventListener("input", () => { const s = AV.Vault.strength(pw.value); [...meter.children].forEach((b, i) => (b.className = i < s ? "s" + s : "")); meterTxt.textContent = mode === "login" ? "" : AV.t(["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][s]); });
    const submit = h("button", { class: "btn pri auth-go", type: "submit" });
    const form = h("form", { class: "auth-form", novalidate: true, onsubmit: (e) => { e.preventDefault(); go(); } });
    const tabs = h("div", { class: "seg auth-tabs", role: "group", "aria-label": "Acesso" });
    const altLinks = h("div", { class: "auth-links" });
    const card = h("section", { class: "auth-card", "aria-label": "Acesso" },
      h("div", { class: "row" }, h("div", { class: "lang-sel", "data-notr": "" }, Object.keys(AV.LANGS).map((k) => h("button", { type: "button", "aria-pressed": k === AV.lang() ? "true" : "false", onclick: () => { AV.setProfile({ lang: k }); location.reload(); } }, k.toUpperCase()))), h("span", { class: "spacer" }),
        h("button", { class: "tb-btn", type: "button", "aria-label": "Trocar tema", onclick: () => AV.toggleTheme() }, AV.icon(AV.isDark() ? "sun" : "moon"))),
      tabs, form, altLinks,
      h("p", { class: "auth-sec" }, AV.icon("key"), h("span", null, AV.t("Seus dados ficam só neste aparelho, criptografados com AES-256. Ninguém além de você, nem nós, consegue lê-los. A senha nunca é guardada nem enviada."))));
    add(root, showcase, card);
    document.body.appendChild(root);
    document.documentElement.classList.add("auth-on");
    if (institutional) mountInstitutional(); else draw();

    /* cadastro e login institucional (Supabase): substitui o formulário local no mesmo cartão */
    function mountInstitutional() {
      tabs.remove(); form.remove(); altLinks.remove();
      const slot = h("div");
      card.insertBefore(slot, card.lastChild);
      card.lastChild.lastChild.textContent = AV.t("Conta institucional protegida por senha, código enviado ao e-mail e verificação em 2 etapas. Seus materiais ficam criptografados neste aparelho.");
      AV.Conta.mount(slot, async ({ password, user }) => {
        try { await openVault(password, user); finish(); }
        catch (e) { AV.toast(AV.t("Não foi possível abrir os materiais deste aparelho.")); }
      });
      card.insertBefore(h("div", { class: "auth-links" }, h("button", { type: "button", class: "btn ghost sm", onclick: () => { AV.Vault.guestMode(); finish(); AV.toast(AV.t("Modo visitante: nada é salvo e a IA exige entrar na conta.")); } }, AV.t("Explorar sem entrar"))), card.lastChild);
    }

    function add(el, ...kids) { el.append(...kids.filter(Boolean)); }
  function field(label, el, extra) { return h("label", { class: "f" }, AV.t(label), extra ? h("div", { class: "row", style: { flexWrap: "nowrap", gap: "6px" } }, el, extra) : el); }
    function draw() {
      msg.textContent = ""; form.textContent = ""; tabs.textContent = ""; altLinks.textContent = "";
      if (mode !== "recover") [["login", "Entrar"], ["signup", "Criar conta"]].forEach(([k, l]) => tabs.appendChild(h("button", { type: "button", "aria-pressed": k === mode ? "true" : "false", disabled: k === "login" && !exists, onclick: () => { mode = k; draw(); } }, AV.t(l))));
      if (mode === "login") {
        add(form, h("h2", null, AV.t("Que bom ter você de volta")), field("Senha", pw, eye),
          h("label", { class: "check" }, remember, AV.t("Manter conectado neste aparelho por 7 dias")), msg, submit);
        submit.textContent = AV.t("Entrar");
        altLinks.append(h("button", { type: "button", class: "btn ghost sm", onclick: () => { mode = "recover"; draw(); } }, AV.t("Esqueci minha senha")));
      } else if (mode === "signup") {
        add(form, h("h2", null, AV.t(exists ? "Criar uma nova conta" : "Crie sua conta segura")),
          exists ? h("p", { class: "note" }, AV.t("Já existe uma conta neste aparelho. Criar outra apaga a conta atual e todos os dados dela.")) : null,
          h("a", { href: "planos.html", class: "note info" }, AV.t("14 dias gratuitos · Planos mensal e anual")),
          field("Seu nome", name), field("Crie uma senha (mínimo 8 caracteres)", pw, eye), h("div", { class: "row", style: { gap: "10px" } }, meter, meterTxt), field("Repita a senha", pw2),
          h("label", { class: "check" }, remember, AV.t("Manter conectado neste aparelho por 7 dias")), msg, submit);
        submit.textContent = AV.t("Criar conta e entrar");
      } else {
        add(form, h("h2", null, AV.t("Recuperar o acesso")), h("p", { class: "small muted" }, AV.t("Use o código de recuperação que você guardou ao criar a conta. Ele permite definir uma nova senha sem perder seus materiais.")),
          field("Código de recuperação", rec), field("Nova senha (mínimo 8 caracteres)", pw, eye), h("div", { class: "row", style: { gap: "10px" } }, meter, meterTxt), field("Repita a nova senha", pw2), msg, submit);
        submit.textContent = AV.t("Redefinir senha e entrar");
        altLinks.append(h("button", { type: "button", class: "btn ghost sm", onclick: () => { mode = "login"; draw(); } }, AV.t("Voltar para o login")),
          h("button", { type: "button", class: "btn ghost sm danger", onclick: wipe }, AV.t("Perdi o código: apagar tudo e recomeçar")));
      }
      if (mode !== "recover") altLinks.append(h("button", { type: "button", class: "btn ghost sm", onclick: () => { AV.Vault.guestMode(); finish(); AV.toast("Modo visitante: nada é salvo. Crie uma conta para guardar seus materiais.", 6000); } }, AV.t("Explorar sem criar conta")));
      setTimeout(() => (mode === "signup" ? name : mode === "recover" ? rec : pw).focus(), 30);
    }
    const err = (t, extra) => { msg.textContent = AV.t(t) + (extra || ""); submit.disabled = false; };
    async function go() {
      const wait = AV.Vault.waitMs(); if (wait && mode !== "signup") return err("Muitas tentativas. Aguarde para tentar de novo:", " " + Math.ceil(wait / 1000) + " s");
      if (mode !== "login") {
        if (pw.value.length < 8) return err("A senha precisa ter pelo menos 8 caracteres.");
        if (AV.Vault.strength(pw.value) < 2) return err("Senha fraca. Misture letras maiúsculas e minúsculas, números e símbolos.");
        if (pw.value !== pw2.value) return err("As senhas não conferem.");
      } else if (!pw.value) return err("Digite a sua senha.");
      submit.disabled = true; const label = submit.textContent; submit.textContent = AV.t("Protegendo seus dados...");
      try {
        if (mode === "login") await AV.Vault.unlock(pw.value);
        else if (mode === "recover") await AV.Vault.recover(rec.value, pw.value);
        else {
          if (exists) { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("av:v:")) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); localStorage.removeItem("av:vaultmeta"); await AV.Vault.forget(); }
          const code = await AV.Vault.create(pw.value, name.value.trim());
          if (remember.checked) await AV.Vault.remember(7);
          pw.value = pw2.value = "";
          return showRecovery(code);
        }
        if (remember.checked) await AV.Vault.remember(7);
        pw.value = pw2.value = ""; finish();
      } catch (e) {
        submit.textContent = label;
        if (e.code === "wait" || AV.Vault.waitMs()) return err("Muitas tentativas. Aguarde para tentar de novo:", " " + Math.ceil(AV.Vault.waitMs() / 1000) + " s");
        err(mode === "recover" ? "Código de recuperação incorreto." : "Senha incorreta.");
      }
    }
    function showRecovery(code) {
      form.textContent = ""; tabs.textContent = ""; altLinks.textContent = "";
      const ok = h("input", { type: "checkbox", id: "au-saved" });
      const cont = h("button", { class: "btn pri auth-go", type: "button", disabled: true, onclick: finish }, AV.t("Continuar"));
      ok.addEventListener("change", () => (cont.disabled = !ok.checked));
      add(form, h("h2", null, AV.t("Guarde seu código de recuperação")),
        h("p", { class: "small muted" }, AV.t("É a única forma de recuperar o acesso se você esquecer a senha. Anote em papel ou salve em um lugar seguro. Ele não será mostrado de novo.")),
        h("code", { class: "auth-code", "data-notr": "" }, code),
        h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onclick: () => AV.copy(code) }, AV.icon("copy"), AV.t("Copiar")),
          h("button", { class: "btn sm", type: "button", onclick: () => AV.saveFile("aulaviva-codigo-de-recuperacao.txt", "AulaViva Studio\nCódigo de recuperação: " + code + "\nCriado em: " + new Date().toLocaleString() + "\n") }, AV.icon("download"), AV.t("Baixar"))),
        h("label", { class: "check" }, ok, AV.t("Guardei o código em um lugar seguro")), cont);
    }
    async function wipe() {
      if (await AV.confirm(AV.t("Apagar tudo?"), AV.t("Sem a senha e sem o código, os dados cifrados não podem ser abertos por ninguém. Isso apaga a conta e todos os materiais deste aparelho."), AV.t("Apagar e recomeçar"))) AV.Vault.destroy();
    }
    function finish() { clearInterval(timer); root.remove(); document.documentElement.classList.remove("auth-on"); done(); }
  }

  /* cofre local dos materiais na conta institucional: mesma senha, vinculado ao id da conta */
  async function openVault(password, user) {
    if (AV.Vault.exists() && AV.Vault.owner() && AV.Vault.owner() !== user.id) await AV.Vault.reset(); // materiais de outra pessoa neste aparelho
    if (AV.Vault.exists()) {
      try { await AV.Vault.unlock(password); return; } catch (e) { return askVaultRecovery(password, user); }
    }
    const code = await AV.Vault.create(password, (user.user_metadata && user.user_metadata.nome) || "", user.id);
    showDeviceCode(code);
  }
  /* a senha da conta mudou (recuperação por e-mail): traz os materiais com a senha antiga ou o código do aparelho */
  function askVaultRecovery(password, user) {
    return new Promise((resolve) => {
      const old = h("input", { class: "in", type: "password", autocomplete: "off", placeholder: AV.t("Senha anterior ou código de recuperação do aparelho") });
      const st = h("p", { class: "small", role: "alert" });
      const d = AV.dialog(AV.t("Trazer seus materiais deste aparelho"), h("div", { style: { display: "grid", gap: "10px" } },
        h("p", { class: "small muted" }, AV.t("Os materiais salvos aqui estão protegidos com a sua senha anterior. Digite a senha anterior ou o código de recuperação do aparelho para trazê-los.")),
        old, st,
        h("div", { class: "row" },
          h("button", { class: "btn pri", onclick: async () => {
            const v = old.value.trim();
            try {
              if (/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/i.test(v)) await AV.Vault.recover(v, password);
              else { await AV.Vault.unlock(v); await AV.Vault.changePassword(v, password); }
              d.close(); resolve();
            } catch (e) { st.textContent = AV.t("Não confere. Tente de novo."); }
          } }, AV.t("Trazer materiais")),
          h("button", { class: "btn ghost danger", onclick: async () => {
            if (!(await AV.confirm(AV.t("Começar do zero?"), AV.t("Os materiais antigos deste aparelho serão apagados."), AV.t("Começar do zero")))) return;
            await AV.Vault.reset(); const code = await AV.Vault.create(password, "", user.id); d.close(); showDeviceCode(code); resolve();
          } }, AV.t("Começar do zero")))));
    });
  }
  function showDeviceCode(code) {
    setTimeout(() => AV.dialog(AV.t("Código de recuperação dos materiais deste aparelho"), h("div", { style: { display: "grid", gap: "10px" } },
      h("p", { class: "small muted" }, AV.t("Guarde este código: ele recupera os materiais salvos neste aparelho se a senha da conta for trocada pela opção \"Esqueci minha senha\".")),
      h("code", { class: "auth-code", "data-notr": "" }, code),
      h("button", { class: "btn sm", onclick: () => AV.copy(code) }, AV.icon("copy"), AV.t("Copiar")))), 400);
  }

  /* bloqueio por inatividade */
  function startIdle() {
    if (!AV.Vault || AV.Vault.guest) return;
    let last = Date.now();
    const bump = () => (last = Date.now());
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => addEventListener(e, bump, { passive: true }));
    setInterval(() => { if (Date.now() - last > AUTOLOCK_MIN() * 60e3) AV.Vault.remembered().then((r) => { if (!r) AV.Vault.lock(); }); }, 30e3);
  }

  /* seção de segurança nas Configurações */
  AV.securityPanel = function () {
    if (!AV.Vault) return null;
    if (AV.Conta && AV.Conta.active()) return h("div", { style: { display: "grid", gap: "16px" } }, AV.Conta.panel(), shieldPanel());
    const box = h("section", { class: "card", style: { display: "grid", gap: "12px" } }, h("h2", null, "Conta e segurança"));
    if (AV.Vault.guest) { box.append(h("p", { class: "note" }, "Você está no modo visitante: nada é salvo. Recarregue a página e crie uma conta para guardar seus materiais.")); return box; }
    const ui = AV.LS.get("ui", {});
    const al = h("select", { class: "in", style: { width: "auto" }, onchange: (e) => { const u = AV.LS.get("ui", {}); u.autolock = +e.target.value; AV.LS.set("ui", u); AV.toast("Salvo."); } }, [5, 15, 30, 60].map((m) => h("option", { value: m, selected: m === (ui.autolock || 15) }, m + " min")));
    const cur = h("input", { class: "in", type: "password", autocomplete: "current-password", placeholder: "Senha atual" });
    const nw = h("input", { class: "in", type: "password", autocomplete: "new-password", placeholder: "Nova senha (mín. 8)" });
    const st = h("p", { class: "small", "aria-live": "polite" });
    box.append(
      h("ul", { class: "muted small", style: { margin: 0, paddingLeft: "18px" } },
        h("li", null, "Dados criptografados neste aparelho com AES-256-GCM; chave protegida por PBKDF2 (600 mil iterações)."),
        h("li", null, "Senha nunca guardada nem enviada; bloqueio progressivo após tentativas erradas."),
        h("li", null, "Sem rastreadores, sem anúncios; a página recusa ser aberta dentro de outros sites.")),
      h("div", { class: "row" }, h("b", null, "Bloquear após inatividade:"), al,
        h("button", { class: "btn", onclick: () => AV.Auth.lockNow() }, AV.icon("key"), "Bloquear agora")),
      h("div", { class: "form" }, h("label", { class: "f" }, "Senha atual", cur), h("label", { class: "f" }, "Nova senha", nw)),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: async () => { if (nw.value.length < 8 || AV.Vault.strength(nw.value) < 2) { st.textContent = "Use uma senha mais forte (8+ caracteres, misture tipos)."; return; } try { await AV.Vault.changePassword(cur.value, nw.value); cur.value = nw.value = ""; st.textContent = "Senha alterada. Outros aparelhos lembrados foram desconectados."; } catch (e) { st.textContent = "Senha atual incorreta."; } } }, "Alterar senha"),
        h("button", { class: "btn", onclick: async () => { const c = await AV.Vault.newRecoveryCode(); AV.dialog("Novo código de recuperação", h("div", { style: { display: "grid", gap: "10px" } }, h("p", { class: "small muted" }, "O código anterior deixou de valer. Guarde este em um lugar seguro."), h("code", { class: "auth-code", "data-notr": "" }, c), h("button", { class: "btn sm", onclick: () => AV.copy(c) }, AV.icon("copy"), "Copiar"))); } }, "Gerar novo código de recuperação"),
        h("button", { class: "btn", onclick: async () => { await AV.Vault.forget(); AV.toast("Este aparelho não vai mais manter você conectado."); } }, "Esquecer este aparelho")),
      st);
    return h("div", { style: { display: "grid", gap: "16px" } }, box, shieldPanel());
  };

  /* Escudo: estado da proteção e eventos bloqueados */
  /* eventos do Escudo vão para o registro de segurança da conta institucional */
  if (AV.Shield) AV.Shield.onEvent((e) => { if (e.kind !== "info" && AV.Conta) AV.Conta.report(e.kind === "arquivo" ? "arquivo-bloqueado" : e.kind === "csp" ? "csp" : "escudo", e.detail); });
  function shieldPanel() {
    if (!AV.Shield) return null;
    const list = h("ul", { class: "small cd-events" });
    const checks = h("ul", { class: "small shield-checks" });
    const draw = () => {
      checks.textContent = "";
      AV.Shield.selfCheck().forEach((c) => checks.appendChild(h("li", { class: c.ok ? "ok" : "bad" }, (c.ok ? "✓ " : "✗ ") + AV.t(c.label))));
      list.textContent = "";
      const ev = AV.Shield.events().filter((e) => e.kind !== "info").slice(0, 15);
      if (!ev.length) list.appendChild(h("li", { class: "muted" }, AV.t("Nenhuma ameaça bloqueada nesta sessão.")));
      ev.forEach((e) => list.appendChild(h("li", null, new Date(e.at).toLocaleTimeString() + " · " + AV.t(e.detail))));
    };
    draw();
    return h("section", { class: "card", style: { display: "grid", gap: "10px" } },
      h("div", { class: "row" }, h("h2", { style: { margin: 0 } }, AV.t("Escudo de segurança")), h("span", { class: "chip pri" }, AV.t("Proteção ativa")), h("span", { class: "spacer" }),
        h("button", { class: "btn sm", onclick: () => { draw(); AV.toast(AV.t("Verificação concluída.")); } }, AV.icon("check"), AV.t("Verificar agora"))),
      h("p", { class: "small muted" }, AV.t("O Escudo vigia a página o tempo todo e bloqueia códigos injetados, quadros e links perigosos, além de examinar cada arquivo antes de abrir (programas disfarçados, macros, PDFs com código, bombas de compressão).")),
      checks, h("h3", null, AV.t("Ameaças bloqueadas")), list);
  }
})(globalThis.AV = globalThis.AV || {});

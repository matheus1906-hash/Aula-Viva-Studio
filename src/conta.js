(function (AV) {
  "use strict";
  /**
   * Contas institucionais (Supabase): cadastro com nome, e-mail, celular, CPF e instituição (base do INEP),
   * código enviado ao e-mail no cadastro e em todo login, verificação em 2 etapas (app autenticador),
   * recuperação de senha por código e encerramento de sessões. Fala com o Supabase pela API REST
   * (sem bibliotecas) e com /api/conta para confirmar a sessão no servidor.
   */
  const h = AV.h;
  const SESSION_KEY = "av:sb";
  let config = null, session = null, refreshTimer = null;

  /* ------------------------------------------------------------ validações (puras, testáveis) */
  const digits = (s) => String(s || "").replace(/\D/g, "");
  function cpfValido(cpf) {
    const d = digits(cpf);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const dv = (len) => { let s = 0; for (let i = 0; i < len; i++) s += +d[i] * (len + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +d[9] && dv(10) === +d[10];
  }
  const emailValido = (e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(e || "").trim()) && String(e).length <= 254;
  const telefoneValido = (t) => /^[1-9]{2}9?\d{8}$/.test(digits(t));
  const maskCpf = (v) => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  const maskPhone = (v) => { const d = digits(v).slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, ""); };

  /* ------------------------------------------------------------ comunicação */
  const contaUrl = () => (/\.vercel\.app$/.test(location.hostname) ? "/api/conta" : AV.IA_HOME.replace(/\/ia$/, "/conta"));
  async function loadConfig() {
    if (config !== null) return config;
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(contaUrl(), { credentials: "omit", cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      const j = await r.json();
      config = j && j.ativo && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(j.url) ? j : false;
    } catch (e) { config = false; }
    return config;
  }
  async function sb(path, { method = "GET", body, token, prefer } = {}) {
    const headers = { apikey: config.anon, "content-type": "application/json" };
    headers.authorization = "Bearer " + (token || (session && session.access_token) || config.anon);
    if (prefer) headers.prefer = prefer;
    const r = await fetch(config.url + path, { method, headers, body: body == null ? undefined : JSON.stringify(body), credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw Object.assign(new Error(friendly(data, r.status)), { status: r.status, data });
    return data;
  }
  async function conta(acao, extra) {
    const r = await fetch(contaUrl(), { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token }, body: JSON.stringify(Object.assign({ acao }, extra || {})), credentials: "omit", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.message || "Não foi possível concluir agora."), { status: r.status });
    return j;
  }
  function friendly(data, status) {
    const m = String((data && (data.msg || data.message || data.error_description || data.error)) || "").toLowerCase();
    if (/invalid login|invalid credentials/.test(m)) return "E-mail ou senha incorretos.";
    if (/already registered|already exists/.test(m)) return "Este e-mail já tem cadastro. Entre ou recupere a senha.";
    if (/expired|invalid.*token|otp/.test(m)) return "Código incorreto ou vencido.";
    if (/password.*(short|weak|least)|weak password|pwned|leaked/.test(m)) return "Senha fraca ou já vazada em outros sites. Escolha outra.";
    if (/email not confirmed/.test(m)) return "Confirme o e-mail com o código enviado.";
    if (/rate|too many|seconds/.test(m) || status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    if (/duplicate key.*cpf|perfis_cpf_key/.test(m)) return "Este CPF já está cadastrado.";
    if (/perfis_telefone_unico|duplicate key.*telefone/.test(m)) return "Este celular já está cadastrado.";
    return status >= 500 ? "Serviço indisponível no momento. Tente de novo." : "Não foi possível concluir. Confira os dados.";
  }

  /* ------------------------------------------------------------ sessão */
  function setSession(s) {
    session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user || (session && session.user) } : null;
    try { if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); else sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    clearTimeout(refreshTimer);
    if (session) refreshTimer = setTimeout(refresh, Math.max(30, session.expires_at - Date.now() / 1000 - 120) * 1000);
  }
  async function refresh() {
    if (!session) return;
    try { setSession(await sb("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token }, token: config.anon })); }
    catch (e) { setSession(null); AV.toast(AV.t("Sua sessão terminou. Entre de novo.")); setTimeout(() => location.reload(), 1500); }
  }
  async function restore() {
    let s = null; try { s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}
    if (!s) return false;
    session = s;
    try { await refresh(); return !!session && (await sb("/rest/v1/rpc/sessao_verificada", { method: "POST", body: {} })) === true; }
    catch (e) { setSession(null); return false; }
  }

  /* ------------------------------------------------------------ escolas (Censo Escolar INEP) */
  const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
  const REDE = { 1: "Federal", 2: "Estadual", 3: "Municipal", 4: "Privada" };
  const cacheUf = new Map();
  async function escolasDa(uf) {
    if (!cacheUf.has(uf)) cacheUf.set(uf, fetch("data/escolas/" + uf + ".json", { credentials: "omit" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch((e) => { cacheUf.delete(uf); throw e; }));
    return cacheUf.get(uf);
  }
  function schoolPicker() {
    const state = { uf: "", municipio: 0, municipioNome: "", escola: null };
    const ufSel = h("select", { class: "in", id: "cd-uf", "aria-label": AV.t("Estado") }, h("option", { value: "" }, AV.t("Estado")), UFS.map((u) => h("option", { value: u }, u)));
    const munSel = h("select", { class: "in", id: "cd-mun", disabled: true, "aria-label": AV.t("Cidade") }, h("option", { value: "" }, AV.t("Cidade")));
    const q = h("input", { class: "in", id: "cd-escola", type: "search", disabled: true, autocomplete: "off", placeholder: AV.t("Digite o nome da escola"), "aria-label": AV.t("Instituição") });
    const results = h("div", { class: "cd-results", role: "listbox" });
    const chosen = h("p", { class: "small", "aria-live": "polite" });
    let data = null;
    ufSel.addEventListener("change", async () => {
      Object.assign(state, { uf: ufSel.value, municipio: 0, escola: null }); munSel.textContent = ""; munSel.disabled = true; q.disabled = true; results.textContent = ""; chosen.textContent = "";
      if (!state.uf) return;
      munSel.appendChild(h("option", { value: "" }, AV.t("Carregando cidades…")));
      try {
        data = await escolasDa(state.uf);
        munSel.textContent = ""; munSel.appendChild(h("option", { value: "" }, AV.t("Cidade")));
        Object.entries(data.municipios).sort((a, b) => a[1].localeCompare(b[1], "pt")).forEach(([c, n]) => munSel.appendChild(h("option", { value: c }, n)));
        munSel.disabled = false;
      } catch (e) { munSel.textContent = ""; munSel.appendChild(h("option", { value: "" }, AV.t("Não foi possível carregar"))); }
    });
    munSel.addEventListener("change", () => { state.municipio = +munSel.value || 0; state.municipioNome = data && data.municipios[munSel.value] || ""; state.escola = null; chosen.textContent = ""; q.disabled = !state.municipio; q.value = ""; draw(); if (state.municipio) q.focus(); });
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    function draw() {
      results.textContent = "";
      if (!data || !state.municipio) return;
      const t = norm(q.value.trim());
      const list = data.escolas.filter((e) => e[2] === state.municipio && (!t || norm(e[1] + " " + e[4]).includes(t))).slice(0, 40);
      list.forEach((e) => results.appendChild(h("button", { type: "button", role: "option", class: "cd-opt", onclick: () => pick(e) }, h("b", { "data-notr": "" }, e[1]), h("small", { "data-notr": "" }, REDE[e[3]] + (e[4] ? " · " + e[4] : "") + " · INEP " + e[0]))));
      if (!list.length) results.appendChild(h("p", { class: "small muted" }, AV.t("Nenhuma escola encontrada nesta cidade com esse nome.")));
    }
    function pick(e) { state.escola = { inep: e[0], nome: e[1] }; q.value = e[1]; results.textContent = ""; chosen.textContent = "✓ " + e[1] + " (INEP " + e[0] + ")"; }
    q.addEventListener("input", () => { state.escola = null; chosen.textContent = ""; draw(); });
    return {
      el: h("div", { class: "cd-school" }, h("div", { class: "row", style: { flexWrap: "nowrap", gap: "8px" } }, ufSel, munSel), q, results, chosen),
      value: () => (state.escola ? { uf: state.uf, municipio: state.municipioNome, municipio_ibge: state.municipio, escola_inep: state.escola.inep, escola_nome: state.escola.nome } : null)
    };
  }

  /* ------------------------------------------------------------ telas */
  /**
   * Monta o cadastro/login dentro do cartão da tela de entrada.
   * onDone({ password, user }) é chamado quando a sessão está confirmada no servidor.
   */
  function mount(card, onDone) {
    const box = h("div", { class: "cd" });
    card.appendChild(box);
    const msg = h("p", { class: "auth-msg", role: "alert" });
    const err = (t) => { msg.textContent = AV.t(t); };
    let password = "";

    const input = (id, label, attrs) => { const el = h("input", Object.assign({ class: "in", id }, attrs)); return [el, h("label", { class: "f" }, AV.t(label), el)]; };
    const busy = (btn, on, text) => { btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = AV.t(text || "Aguarde…"); } else if (btn.dataset.t) btn.textContent = btn.dataset.t; };
    const screen = (...kids) => { box.textContent = ""; msg.textContent = ""; box.append(...kids.filter(Boolean)); const f = box.querySelector("input,select"); if (f) setTimeout(() => f.focus(), 30); };

    /* ---- entrar ---- */
    function login() {
      const [email, emailF] = input("cd-email", "E-mail", { type: "email", autocomplete: "username", maxlength: 254 });
      const [pw, pwF] = input("cd-pw", "Senha", { type: "password", autocomplete: "current-password", maxlength: 128 });
      const go = h("button", { class: "btn pri auth-go", type: "submit" }, AV.t("Entrar"));
      const form = h("form", { class: "auth-form", novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (!emailValido(email.value)) return err("Digite um e-mail válido.");
        if (!pw.value) return err("Digite a sua senha.");
        busy(go, true, "Conferindo…");
        try {
          setSession(await sb("/auth/v1/token?grant_type=password", { method: "POST", body: { email: email.value.trim().toLowerCase(), password: pw.value }, token: config.anon }));
          password = pw.value; pw.value = "";
          const sent = await conta("enviar-codigo");
          code("login", sent.email);
        } catch (x) { busy(go, false); err(x.message); }
      } }, h("h2", null, AV.t("Entrar na sua conta")), emailF, pwF, msg, go);
      screen(form, links([["Criar conta de professor", signup], ["Esqueci minha senha", recover]]));
    }

    /* ---- código do e-mail (login e cadastro) ---- */
    function code(kind, maskedEmail, email) {
      const [c, cF] = input("cd-code", "Código de 6 números", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, pattern: "[0-9]{6}", "data-notr": "" });
      c.addEventListener("input", () => { c.value = digits(c.value).slice(0, 6); if (c.value.length === 6) form.requestSubmit(); });
      const go = h("button", { class: "btn pri auth-go", type: "submit" }, AV.t("Confirmar"));
      const again = h("button", { type: "button", class: "btn ghost sm", onclick: async () => {
        again.disabled = true;
        try { kind === "login" ? await conta("enviar-codigo") : await sb("/auth/v1/resend", { method: "POST", body: { type: "signup", email }, token: config.anon }); AV.toast(AV.t("Enviamos um novo código.")); }
        catch (x) { err(x.message); }
        setTimeout(() => (again.disabled = false), 60000);
      } }, AV.t("Reenviar código"));
      const form = h("form", { class: "auth-form", novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (c.value.length !== 6) return err("Digite os 6 números do código.");
        busy(go, true, "Confirmando…");
        try {
          if (kind === "login") await conta("verificar-codigo", { codigo: c.value });
          else { setSession(await sb("/auth/v1/verify", { method: "POST", body: { type: "signup", email, token: c.value }, token: config.anon })); await conta("confirmar-sessao"); }
          await afterVerified(kind);
        } catch (x) { busy(go, false); err(x.message); c.select(); }
      } }, h("h2", null, AV.t("Confirme que é você")),
        h("p", { class: "small muted" }, AV.t("Enviamos um código para") + " ", h("b", { "data-notr": "" }, maskedEmail || email), AV.t(". Ele vale por alguns minutos. Confira também a caixa de spam.")),
        cF, msg, go);
      screen(form, links([["Voltar", login]]), again);
    }

    /* ---- depois do código: 2 etapas (se ativada), perfil (no cadastro) e cofre ---- */
    let pendingProfile = null;
    async function afterVerified(kind) {
      const user = await sb("/auth/v1/user");
      session.user = user; setSession(session);
      const factor = (user.factors || []).find((f) => f.factor_type === "totp" && f.status === "verified");
      if (factor) return totp(factor, () => finishLogin(kind));
      return finishLogin(kind);
    }
    async function finishLogin(kind) {
      if (kind === "signup" && pendingProfile) {
        await sb("/rest/v1/perfis", { method: "POST", body: Object.assign({ id: session.user.id, email: session.user.email }, pendingProfile), prefer: "return=minimal" });
        pendingProfile = null;
        return offer2fa();
      }
      onDone({ password, user: session.user });
      trialNotice();
    }

    /* ---- verificação em 2 etapas no login ---- */
    function totp(factor, next) {
      const [c, cF] = input("cd-totp", "Código do app autenticador", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, "data-notr": "" });
      c.addEventListener("input", () => { c.value = digits(c.value).slice(0, 6); if (c.value.length === 6) form.requestSubmit(); });
      const go = h("button", { class: "btn pri auth-go", type: "submit" }, AV.t("Confirmar"));
      const form = h("form", { class: "auth-form", novalidate: true, onsubmit: async (e) => {
        e.preventDefault(); busy(go, true, "Confirmando…");
        try {
          const ch = await sb("/auth/v1/factors/" + factor.id + "/challenge", { method: "POST", body: {} });
          setSession(await sb("/auth/v1/factors/" + factor.id + "/verify", { method: "POST", body: { challenge_id: ch.id, code: c.value } }));
          next();
        } catch (x) { busy(go, false); err("Código do app incorreto. Confira o horário do celular e tente de novo."); c.select(); }
      } }, h("h2", null, AV.t("Verificação em 2 etapas")), h("p", { class: "small muted" }, AV.t("Abra o app autenticador (Google Authenticator, Microsoft Authenticator ou similar) e digite o código do AulaViva.")), cF, msg, go);
      screen(form);
    }

    /* ---- cadastro ---- */
    function signup() {
      const [nome, nomeF] = input("cd-nome", "Nome completo *", { autocomplete: "name", maxlength: 120 });
      const [email, emailF] = input("cd-email", "E-mail *", { type: "email", autocomplete: "email", maxlength: 254 });
      const [tel, telF] = input("cd-tel", "Celular com DDD *", { type: "tel", autocomplete: "tel", inputmode: "numeric", placeholder: "(64) 99999-9999" });
      const [cpf, cpfF] = input("cd-cpf", "CPF *", { inputmode: "numeric", autocomplete: "off", placeholder: "000.000.000-00", "data-notr": "" });
      const [pw, pwF] = input("cd-pw", "Senha * (mínimo 10 caracteres)", { type: "password", autocomplete: "new-password", maxlength: 128 });
      const [pw2, pw2F] = input("cd-pw2", "Repita a senha *", { type: "password", autocomplete: "new-password", maxlength: 128 });
      tel.addEventListener("input", () => (tel.value = maskPhone(tel.value)));
      cpf.addEventListener("input", () => (cpf.value = maskCpf(cpf.value)));
      const school = schoolPicker();
      const aceite = h("input", { type: "checkbox", id: "cd-aceite" });
      const go = h("button", { class: "btn pri auth-go", type: "submit" }, AV.t("Criar conta"));
      const form = h("form", { class: "auth-form", novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        const escola = school.value();
        const problem = nome.value.trim().split(/\s+/).length < 2 ? "Digite o nome completo." : !emailValido(email.value) ? "Digite um e-mail válido." : !telefoneValido(tel.value) ? "Digite um celular válido com DDD." :
          !cpfValido(cpf.value) ? "CPF inválido. Confira os números." : !escola ? "Escolha o estado, a cidade e a sua instituição na lista." :
            pw.value.length < 10 || AV.Vault && AV.Vault.strength(pw.value) < 3 ? "Use uma senha forte: 10 ou mais caracteres, com letras maiúsculas e minúsculas, números e símbolos." :
              pw.value !== pw2.value ? "As senhas não conferem." : !aceite.checked ? "Para continuar, aceite os termos de uso e a política de privacidade." : "";
        if (problem) return err(problem);
        busy(go, true, "Criando conta…");
        try {
          if ((await sb("/rest/v1/rpc/cpf_disponivel", { method: "POST", body: { p_cpf: digits(cpf.value) }, token: config.anon })) !== true) throw new Error(AV.t("Este CPF já está cadastrado. Use \"Entrar\" ou \"Esqueci minha senha\"."));
          if ((await sb("/rest/v1/rpc/telefone_disponivel", { method: "POST", body: { p_telefone: digits(tel.value) }, token: config.anon })) !== true) throw new Error(AV.t("Este celular já está cadastrado. Use \"Entrar\" ou \"Esqueci minha senha\"."));
          await sb("/auth/v1/signup", { method: "POST", body: { email: email.value.trim().toLowerCase(), password: pw.value, data: { nome: nome.value.trim() } }, token: config.anon });
          password = pw.value; pw.value = pw2.value = "";
          pendingProfile = Object.assign({ nome: nome.value.trim(), telefone: digits(tel.value), cpf: digits(cpf.value) }, escola);
          code("signup", null, email.value.trim().toLowerCase());
        } catch (x) { busy(go, false); err(x.message); }
      } },
        h("h2", null, AV.t("Cadastro do professor")),
        nomeF, emailF, h("div", { class: "row cd-two" }, telF, cpfF),
        h("label", { class: "f" }, AV.t("Instituição onde trabalha *"), school.el),
        pwF, pw2F,
        h("label", { class: "check" }, aceite, h("span", null, AV.t("Li e aceito os termos de uso e a política de privacidade (LGPD). Meus dados são usados só para identificar minha conta."))),
        msg, go);
      screen(form, links([["Já tenho conta", login]]));
    }

    /* ---- oferecer 2 etapas logo após o cadastro ---- */
    function offer2fa() {
      screen(h("div", { class: "auth-form" }, h("h2", null, AV.t("Proteja ainda mais a sua conta")),
        h("p", { class: "small muted" }, AV.t("Ative a verificação em 2 etapas: além da senha e do código do e-mail, será pedido um código do app autenticador do seu celular.")),
        h("button", { class: "btn pri auth-go", type: "button", onclick: () => enroll2fa(box, () => onDone({ password, user: session.user })) }, AV.t("Ativar agora (recomendado)")),
        h("button", { class: "btn ghost", type: "button", onclick: () => onDone({ password, user: session.user }) }, AV.t("Fazer depois"))));
    }

    /* ---- recuperar a senha ---- */
    function recover() {
      const [email, emailF] = input("cd-email", "E-mail da conta", { type: "email", autocomplete: "username" });
      const go = h("button", { class: "btn pri auth-go", type: "submit" }, AV.t("Enviar código"));
      const form = h("form", { class: "auth-form", novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (!emailValido(email.value)) return err("Digite um e-mail válido.");
        busy(go, true, "Enviando…");
        try { await sb("/auth/v1/recover", { method: "POST", body: { email: email.value.trim().toLowerCase() }, token: config.anon }); } catch (x) { /* não revela se o e-mail existe */ }
        recoverCode(email.value.trim().toLowerCase());
      } }, h("h2", null, AV.t("Recuperar o acesso")), h("p", { class: "small muted" }, AV.t("Se o e-mail tiver cadastro, enviaremos um código para criar uma nova senha.")), emailF, msg, go);
      screen(form, links([["Voltar", login]]));
    }
    function recoverCode(email) {
      const [c, cF] = input("cd-code", "Código de 6 números", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, "data-notr": "" });
      const [pw, pwF] = input("cd-pw", "Nova senha (mínimo 10 caracteres)", { type: "password", autocomplete: "new-password" });
      const [pw2, pw2F] = input("cd-pw2", "Repita a nova senha", { type: "password", autocomplete: "new-password" });
      const go = h("button", { class: "btn pri auth-go", type: "submit" }, AV.t("Salvar nova senha"));
      const form = h("form", { class: "auth-form", novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (digits(c.value).length !== 6) return err("Digite os 6 números do código.");
        if (pw.value.length < 10 || (AV.Vault && AV.Vault.strength(pw.value) < 3)) return err("Use uma senha forte: 10 ou mais caracteres, com letras maiúsculas e minúsculas, números e símbolos.");
        if (pw.value !== pw2.value) return err("As senhas não conferem.");
        busy(go, true, "Salvando…");
        try {
          setSession(await sb("/auth/v1/verify", { method: "POST", body: { type: "recovery", email, token: digits(c.value) }, token: config.anon }));
          await sb("/auth/v1/user", { method: "PUT", body: { password: pw.value } });
          password = pw.value; pw.value = pw2.value = "";
          await conta("confirmar-sessao");
          AV.toast(AV.t("Senha alterada. Por segurança, as outras sessões foram encerradas."));
          await afterVerified("recover");
        } catch (x) { busy(go, false); err(x.message); }
      } }, h("h2", null, AV.t("Criar nova senha")), cF, pwF, pw2F, msg, go);
      screen(form, links([["Voltar", login]]));
    }

    function links(items) { return h("div", { class: "auth-links" }, items.map(([label, fn]) => h("button", { type: "button", class: "btn ghost sm", onclick: fn }, AV.t(label)))); }
    login();
  }

  /* ------------------------------------------------------------ teste gratuito (14 dias) */
  async function accessInfo() {
    const [p] = await sb("/rest/v1/perfis?select=plano,teste_ate,assinatura_ate&id=eq." + session.user.id);
    if (!p) return null;
    const until = Math.max(Date.parse(p.teste_ate) || 0, Date.parse(p.assinatura_ate) || 0);
    return { plano: p.plano, until, days: Math.max(0, Math.ceil((until - Date.now()) / 864e5)), active: Date.now() < until };
  }
  async function trialNotice() {
    try {
      const a = await accessInfo();
      if (!a) return;
      if (!a.active) AV.dialog(AV.t("Seu teste gratuito terminou"), h("div", { style: { display: "grid", gap: "10px" } },
        h("p", null, AV.t("Os seus materiais continuam salvos. Para voltar a criar com a IA, assine o plano mensal ou anual.")),
        h("ul", { class: "small" }, h("li", null, AV.t("Mensal: R$ 49,90 por mês")), h("li", null, AV.t("Anual: R$ 479,04 por ano (20% de desconto, R$ 39,92 por mês)"))),
        h("a", { class: "btn pri", href: "planos.html", target: "_blank", rel: "noopener" }, AV.t("Ver planos"))));
      else if (a.plano === "teste") AV.toast(AV.t("Teste gratuito: faltam") + " " + a.days + " " + AV.t(a.days === 1 ? "dia" : "dias") + ".", 6000);
    } catch (e) {}
  }

  /* ------------------------------------------------------------ 2 etapas: ativar */
  async function enroll2fa(container, done) {
    const area = h("div", { class: "auth-form" });
    container.textContent = ""; container.appendChild(area);
    const msg = h("p", { class: "auth-msg", role: "alert" });
    try {
      const f = await sb("/auth/v1/factors", { method: "POST", body: { factor_type: "totp", friendly_name: "AulaViva " + new Date().toLocaleDateString() } });
      const c = h("input", { class: "in", inputmode: "numeric", maxlength: 6, autocomplete: "one-time-code", "aria-label": AV.t("Código do app"), "data-notr": "" });
      const go = h("button", { class: "btn pri", type: "button", onclick: async () => {
        try {
          const ch = await sb("/auth/v1/factors/" + f.id + "/challenge", { method: "POST", body: {} });
          setSession(await sb("/auth/v1/factors/" + f.id + "/verify", { method: "POST", body: { challenge_id: ch.id, code: digits(c.value) } }));
          conta("evento", { tipo: "2fa-ativada" }).catch(() => {});
          AV.toast(AV.t("Verificação em 2 etapas ativada."));
          done && done(true);
        } catch (x) { msg.textContent = AV.t("Código incorreto. Confira o horário do celular e tente de novo."); }
      } }, AV.t("Ativar"));
      area.append(h("h2", null, AV.t("Ativar a verificação em 2 etapas")),
        h("ol", { class: "small" }, h("li", null, AV.t("Instale um app autenticador no celular (Google Authenticator, Microsoft Authenticator, Authy).")), h("li", null, AV.t("Leia o QR code abaixo com o app.")), h("li", null, AV.t("Digite o código de 6 números que aparece no app."))),
        h("img", { class: "cd-qr", src: f.totp.qr_code, alt: AV.t("QR code para o app autenticador"), width: 200, height: 200 }),
        h("details", null, h("summary", null, AV.t("Não consegue ler o QR code?")), h("code", { "data-notr": "", class: "auth-code" }, f.totp.secret)),
        c, msg, h("div", { class: "row" }, go, h("button", { class: "btn ghost", type: "button", onclick: () => { sb("/auth/v1/factors/" + f.id, { method: "DELETE" }).catch(() => {}); done && done(false); } }, AV.t("Cancelar"))));
    } catch (x) { area.append(h("p", null, AV.t("Não foi possível iniciar a ativação agora.")), msg); done && setTimeout(() => done(false), 2500); }
  }

  /* ------------------------------------------------------------ painel "Conta e segurança" (institucional) */
  function panel() {
    if (!session) return null;
    const box = h("section", { class: "card", style: { display: "grid", gap: "12px" } }, h("h2", null, AV.t("Conta institucional e segurança")));
    const info = h("div", { class: "small" }, AV.t("Carregando…"));
    const events = h("ul", { class: "small cd-events" });
    const twofa = h("div", { class: "row" });
    box.append(info, h("h3", null, AV.t("Verificação em 2 etapas")), twofa,
      h("h3", null, AV.t("Sessões")),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: async () => { if (!(await AV.confirm(AV.t("Sair de todos os aparelhos?"), AV.t("Todas as sessões, inclusive esta, serão encerradas."), AV.t("Sair de todos")))) return; await conta("sair-de-todos").catch(() => {}); setSession(null); location.reload(); } }, AV.t("Sair de todos os aparelhos")),
        h("button", { class: "btn", onclick: () => { sb("/auth/v1/logout?scope=local", { method: "POST" }).catch(() => {}); setSession(null); location.reload(); } }, AV.t("Sair desta conta"))),
      h("h3", null, AV.t("Atividade recente da conta")), events);
    (async () => {
      try {
        const [p] = await sb("/rest/v1/perfis?select=nome,email,telefone,cpf,uf,municipio,escola_nome,escola_inep&id=eq." + session.user.id);
        info.textContent = "";
        if (p) info.append(h("p", null, h("b", { "data-notr": "" }, p.nome), " · ", h("span", { "data-notr": "" }, p.email)), h("p", { class: "muted" }, h("span", { "data-notr": "" }, p.escola_nome + " (INEP " + p.escola_inep + ") · " + p.municipio + "/" + p.uf), " · CPF ***." + p.cpf.slice(3, 6) + ".***-" + p.cpf.slice(9)));
        const a = await accessInfo().catch(() => null);
        if (a) info.append(h("p", null, h("span", { class: "chip " + (a.active ? "pri" : "acc") }, a.plano === "teste" ? AV.t("Teste gratuito") : AV.t(a.plano === "anual" ? "Plano anual" : "Plano mensal")), " ",
          a.active ? AV.t("válido até") + " " + new Date(a.until).toLocaleDateString() + " (" + a.days + " " + AV.t(a.days === 1 ? "dia" : "dias") + ")" : h("a", { href: "planos.html", target: "_blank", rel: "noopener" }, AV.t("Teste encerrado: ver planos"))));
        const user = await sb("/auth/v1/user");
        const f = (user.factors || []).find((x) => x.factor_type === "totp" && x.status === "verified");
        twofa.textContent = "";
        twofa.append(h("span", { class: "chip " + (f ? "pri" : "acc") }, AV.t(f ? "Ativada" : "Desativada")),
          f ? h("button", { class: "btn sm", onclick: async () => { try { await sb("/auth/v1/factors/" + f.id, { method: "DELETE" }); conta("evento", { tipo: "2fa-desativada" }).catch(() => {}); AV.toast(AV.t("Verificação em 2 etapas desativada.")); AV.route(); } catch (x) { AV.toast(x.message); } } }, AV.t("Desativar"))
            : h("button", { class: "btn sm pri", onclick: () => { const d = AV.dialog(AV.t("Verificação em 2 etapas"), h("div")); enroll2fa(d.el.lastChild, () => { d.close(); AV.route(); }); } }, AV.t("Ativar")));
      } catch (x) { info.textContent = AV.t("Não foi possível carregar os dados da conta."); }
      try {
        const ev = await sb("/rest/v1/eventos_seguranca?select=tipo,detalhe,ip,criado_em&order=criado_em.desc&limit=12");
        events.textContent = "";
        (Array.isArray(ev) ? ev : []).forEach((e) => events.appendChild(h("li", null, new Date(e.criado_em).toLocaleString() + " · " + e.tipo + (e.detalhe ? " (" + e.detalhe + ")" : ""))));
        if (!events.childElementCount) events.appendChild(h("li", { class: "muted" }, AV.t("Nenhuma atividade registrada ainda.")));
      } catch (x) { events.textContent = AV.t("Não foi possível carregar a atividade da conta."); }
    })();
    return box;
  }

  AV.Conta = {
    loadConfig, restore, mount, panel, enroll2fa,
    token: () => (session ? session.access_token : ""),
    active: () => !!session,
    report: (tipo, detalhe) => { if (session) conta("evento", { tipo, detalhe }).catch(() => {}); },
    /* utilidades puras (também usadas nos testes) */
    cpfValido, emailValido, telefoneValido, maskCpf, maskPhone
  };
})(globalThis.AV = globalThis.AV || {});

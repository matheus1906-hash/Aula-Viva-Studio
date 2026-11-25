(function (AV) {
  "use strict";
  /* Provedores de IA. "claude" = IA incluída no claude.ai (sem chave). Os demais usam a chave do próprio professor,
     guardada só neste navegador. Nenhuma chave vem embutida no app. */
  /* "aulaviva*" = IA interna do site (as chaves gratuitas ficam no servidor, nunca no navegador).
     "claude" = IA incluída quando o app roda dentro do claude.ai. Pagas: chave do próprio professor. */
  const P = {
    aulaviva:    { name: "AulaViva IA · Automático", short: "Automático", desc: "Escolhe sozinho o motor mais rápido e disponível. Recomendado.", cost: "Grátis, já incluída", tag: "internal", internal: true, engine: "auto" },
    groq:        { name: "AulaViva IA · Rápida", short: "Rápida", engineName: "Groq · Llama 3.3 70B", desc: "Respostas em segundos. Ótima para atividades, listas e provas.", cost: "Grátis, já incluída", tag: "internal", internal: true, engine: "groq" },
    mistral:     { name: "AulaViva IA · Equilibrada", short: "Equilibrada", engineName: "Mistral", desc: "Texto caprichado em português. Boa para apostilas e planos.", cost: "Grátis, já incluída", tag: "internal", internal: true, engine: "mistral" },
    openrouter:  { name: "AulaViva IA · Variada", short: "Variada", engineName: "OpenRouter · modelos abertos", desc: "Alterna entre vários modelos abertos gratuitos.", cost: "Grátis, já incluída", tag: "internal", internal: true, engine: "openrouter" },
    ollama:      { name: "AulaViva IA · Raciocínio", short: "Raciocínio", engineName: "Ollama Cloud · GPT-OSS", desc: "Pensa mais antes de responder. Boa para projetos e sequências didáticas.", cost: "Grátis, já incluída", tag: "internal", internal: true, engine: "ollama" },
    claude:      { name: "Claude (incluída)", cost: "Grátis, já vem pronta", tag: "builtin", nokey: true, builtin: true, note: "Funciona dentro do claude.ai, sem chave." },
    anthropic:   { name: "Claude API (Anthropic)", cost: "Pago", tag: "paid", keyUrl: "https://console.anthropic.com/settings/keys", models: ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"], kind: "anthropic" },
    openai:      { name: "ChatGPT (OpenAI)", cost: "Pago", tag: "paid", keyUrl: "https://platform.openai.com/api-keys", base: "https://api.openai.com/v1", models: ["gpt-4.1-mini", "gpt-5-mini", "gpt-4o-mini", "gpt-4.1"] },
    deepseek:    { name: "DeepSeek", cost: "Pago (barato)", tag: "paid", keyUrl: "https://platform.deepseek.com/api_keys", base: "https://api.deepseek.com/v1", models: ["deepseek-chat"] },
    custom:      { name: "Outra IA compatível (OpenAI)", cost: "Variável", tag: "paid", custom: true, models: [], note: "Servidor local compatível com a API da OpenAI (LM Studio, Ollama no computador). Use um endereço http://localhost." }
  };
  const NOT_CHAT = /whisper|tts|embed|guard|moderation|audio|image|dall-e|transcri|realtime|search|ocr|playai|distil|rerank/i;
  AV.PROVIDERS = P;

  /* configurações: { active, keys:{id:key}, models:{id:model}, base:{custom:url} } (só neste navegador) */
  AV.aiCfg = () => {
    const c = Object.assign({ active: "auto", keys: {}, models: {}, base: {} }, AV.LS.get("aicfg", {}));
    /* chaves de IAs gratuitas não são mais usadas: a IA gratuita agora é interna */
    ["gemini", "groq", "cerebras", "openrouter", "mistral", "huggingface", "ollama"].forEach((id) => { delete c.keys[id]; });
    if (c.active && !P[c.active] && c.active !== "auto") c.active = "auto";
    return c;
  };
  /* endereço da IA interna: o próprio site no Vercel; de outros lugares (GitHub Pages, arquivo local) usa o endereço público */
  AV.IA_HOME = "https://aulavivastudio.vercel.app/api/ia";
  AV.iaEndpoint = () => AV.IA_URL || (/\.vercel\.app$/.test(location.hostname) || location.hostname === "localhost" && location.port === "3000" ? "/api/ia" : AV.IA_HOME);
  AV.setAiCfg = (c) => AV.LS.set("aicfg", c);
  AV.cleanKey = (k) => String(k || "").trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").replace(/^[A-Z_]+=/, "").trim();
  AV.hasKey = (id) => { const p = P[id]; if (!p) return false; if (p.internal) return !window.claude; if (p.builtin) return !!window.claude; if (p.custom) return !!AV.aiCfg().base.custom; return !!AV.aiCfg().keys[id]; };

  function err(code, message) { const e = new Error(message); e.code = code; return e; }
  async function http(url, opts, id) {
    let r;
    try { r = await fetch(url, opts); }
    catch (e) {
      if (e && e.name === "AbortError") throw e;
      if (window.claude) throw err("blocked", "Dentro do claude.ai a página não pode falar com outras IAs. Use a IA incluída aqui ou a versão para hospedar (Configurações).");
      throw err("network", id === "ollama" ? "Não encontrei o Ollama neste computador. Ele está aberto e com OLLAMA_ORIGINS liberado?" : "Sem conexão com " + P[id].name + ". Verifique a internet.");
    }
    if (!r.ok) {
      let body = ""; try { body = await r.text(); } catch (e) {}
      const b = body.toLowerCase();
      if (r.status === 401 || r.status === 403 || /api key|invalid.*key|unauthorized/.test(b)) throw err("bad_key", "Chave inválida ou sem permissão em " + P[id].name + ". Confira se copiou a chave inteira.");
      if (r.status === 404 || /model/.test(b) && /not (found|supported|exist)|does not exist|no such|unknown/.test(b)) throw err("model", "O modelo escolhido não está disponível em " + P[id].name + ". Clique em \"Buscar modelos\".");
      if (r.status === 429 || /rate.?limit|quota|resource.?exhausted|too many requests/.test(b)) throw err("rate_limited", "Limite do plano de " + P[id].name + " atingido. Aguarde um pouco ou use outra IA.");
      if (r.status === 402) throw err("payment", P[id].name + " pede créditos para este modelo. Escolha um modelo gratuito.");
      const e2 = err("http", P[id].name + " respondeu com erro " + r.status + "."); e2.status = r.status; throw e2;
    }
    return r.json();
  }
  /* streaming SSE: lê "data: ..." linha a linha e chama onEvent(json) */
  async function sse(url, opts, id, onEvent) {
    let r;
    try { r = await fetch(url, opts); }
    catch (e) { if (e && e.name === "AbortError") throw e; throw err(window.claude ? "blocked" : "network", window.claude ? "Dentro do claude.ai a página não pode falar com outras IAs." : "Sem conexão com " + P[id].name + "."); }
    if (!r.ok) {
      let body = ""; try { body = (await r.text()).toLowerCase(); } catch (e) {}
      if (r.status === 401 || r.status === 403 || /api key|invalid.*key|unauthorized/.test(body)) throw err("bad_key", "Chave inválida ou sem permissão em " + P[id].name + ". Confira se copiou a chave inteira.");
      if (r.status === 429 || /rate.?limit|quota|resource.?exhausted|too many requests/.test(body)) throw err("rate_limited", "Limite do plano de " + P[id].name + " atingido. Aguarde um pouco ou use outra IA.");
      const e2 = err("http", P[id].name + " respondeu com erro " + r.status + "."); e2.status = r.status; e2.stream = true; throw e2;
    }
    if (!r.body || !r.body.getReader) { const e3 = err("nostream", "sem streaming"); e3.stream = true; throw e3; }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
        try { onEvent(JSON.parse(data)); } catch (e) { /* linha parcial ou comentário */ }
      }
    }
  }
  /* versão em tempo real de callProvider; devolve null se o serviço não aceitar streaming */
  async function streamProvider(id, messages, opts, key, model, sys) {
    let text = "";
    const push = (t) => { if (!t) return; text += t; opts.onText({ text, delta: t }); };
    try {
      if (P[id].kind === "gemini") {
        const body = { contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), generationConfig: { temperature: 0.7, maxOutputTokens: 16384 } };
        if (sys) body.systemInstruction = { parts: [{ text: sys }] };
        if (opts.json) body.generationConfig.responseMimeType = "application/json";
        await sse("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse&key=" + encodeURIComponent(key), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: opts.signal }, id,
          (j) => (((j.candidates || [])[0] || {}).content || { parts: [] }).parts && push((((j.candidates || [])[0] || {}).content.parts || []).map((x) => x.text || "").join("")));
      } else if (P[id].kind === "anthropic") {
        await sse("https://api.anthropic.com/v1/messages", { method: "POST", signal: opts.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model, max_tokens: 8000, system: sys || undefined, messages, stream: true }) }, id,
          (j) => { if (j.type === "content_block_delta" && j.delta) push(j.delta.text || ""); });
      } else {
        const body = { model, messages: (sys ? [{ role: "system", content: sys }] : []).concat(messages), temperature: 0.7, stream: true };
        if (opts.json && id !== "ollama" && id !== "huggingface") body.response_format = { type: "json_object" };
        const go = () => sse(baseOf(id) + "/chat/completions", { method: "POST", signal: opts.signal, headers: headersFor(id, key), body: JSON.stringify(body) }, id,
          (j) => push(((((j.choices || [])[0] || {}).delta) || {}).content || ""));
        try { await go(); } catch (e) { if (body.response_format && e.status === 400 && !text) { delete body.response_format; await go(); } else throw e; }
      }
    } catch (e) { if (e && e.stream && !text) return null; throw e; }
    return text;
  }
  function headersFor(id, key) {
    const hd = { "content-type": "application/json" };
    if (key) hd.authorization = "Bearer " + key;
    if (id === "openrouter") hd["X-Title"] = "AulaViva Studio";
    return hd;
  }
  const baseOf = (id) => (P[id].custom ? String(AV.aiCfg().base.custom || "").replace(/\/+$/, "") : P[id].base);

  /* lista modelos disponíveis na conta e escolhe o melhor */
  AV.listModels = async function (id) {
    const c = AV.aiCfg(), key = c.keys[id] || "";
    if (P[id].kind === "gemini") {
      const j = await http("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=" + encodeURIComponent(key), {}, id);
      return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace(/^models\//, "")).filter((n) => /flash|gemini-2|gemini-3/.test(n) && !/image|tts|audio|embed|live/.test(n));
    }
    if (P[id].kind === "anthropic") {
      const j = await http("https://api.anthropic.com/v1/models", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } }, id);
      return (j.data || []).map((m) => m.id);
    }
    const j = await http(baseOf(id) + "/models", { headers: headersFor(id, key) }, id);
    let names = (j.data || j.models || []).map((m) => m.id || m.name).filter((n) => n && !NOT_CHAT.test(n));
    if (P[id].freeOnly) { const free = (j.data || []).filter((m) => /:free$/.test(m.id) || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0)).map((m) => m.id); names = (free.length ? ["openrouter/free"] : []).concat(free.sort()); }
    return names;
  };
  AV.pickModel = function (id, names) {
    for (const pref of P[id].models) { const hit = names.find((n) => n === pref) || names.find((n) => n.startsWith(pref)); if (hit) return hit; }
    return names[0] || P[id].models[0] || "";
  };

  /* IA interna: o servidor do site fala com o motor gratuito usando as chaves guardadas lá.
     opts.exclude: motores a evitar (usado ao tentar de novo depois de uma resposta ruim). */
  const INTERNAL_ERRORS = {
    401: ["login", "Entre na sua conta para usar a IA."],
    402: ["trial", "Seu teste gratuito de 14 dias terminou. Assine um plano para continuar criando com a IA."],
    429: ["rate_limited", "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo."],
    503: ["internal_off", "A IA está em manutenção. Tente de novo em instantes."]
  };
  async function postInternal(body, opts) {
    let r;
    try {
      const headers = { "content-type": "application/json" };
      if (AV.Conta && AV.Conta.token()) headers.authorization = "Bearer " + AV.Conta.token(); /* conta institucional: a IA exige sessão confirmada */
      r = await fetch(AV.iaEndpoint(), { method: "POST", headers, body: JSON.stringify(body), signal: opts.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      throw err(window.claude ? "blocked" : "network", "Sem conexão com a IA do AulaViva. Verifique a internet.");
    }
    if (r.ok) return r;
    let j = {}; try { j = await r.json(); } catch (e) {}
    const [code, msg] = INTERNAL_ERRORS[r.status] || ["upstream", "Não foi possível falar com a IA agora. Tente de novo."];
    throw err(code, j.message || msg);
  }
  async function readInternalStream(r, opts) {
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.error) throw err("upstream", j.error.message || "A IA parou no meio da resposta. Tente de novo.");
        if (j.engine) AV.lastEngine = j.engine;
        const t = ((((j.choices || [])[0] || {}).delta) || {}).content || "";
        if (t) { text += t; opts.onText({ text, delta: t }); }
      }
    }
    return text;
  }
  async function internal(id, messages, opts) {
    const stream = !!opts.onText && opts.stream !== false;
    const body = { engine: P[id].engine, messages, system: opts.system || "", json: !!opts.json, stream, exclude: opts.exclude || [] };
    const r = await postInternal(body, opts);
    let text;
    if (stream) text = await readInternalStream(r, opts);
    else { const j = await r.json(); text = j.text || ""; AV.lastEngine = j.engine; }
    text = String(text).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) throw err("empty", "A IA devolveu uma resposta vazia. Tente de novo.");
    return text;
  }

  /* chamada principal: messages = [{role, content}] */
  AV.callProvider = async function (id, messages, opts) {
    opts = opts || {};
    if (P[id] && P[id].internal) return internal(id, messages, opts);
    const c = AV.aiCfg(), key = c.keys[id] || "", model = c.models[id] || P[id].models[0];
    const sys = opts.system || "";
    if (!P[id].nokey && !P[id].custom && !key) throw err("no_key", "Cole a sua chave de " + P[id].name + " em Configurações.");
    if (!model) throw err("model", "Escolha um modelo para " + P[id].name + ".");
    let text = "";
    if (opts.onText && opts.stream !== false) {
      const st = await streamProvider(id, messages, opts, key, model, sys);
      if (st != null) { text = String(st).replace(/<think>[\s\S]*?<\/think>/g, "").trim(); if (!text) throw err("empty", P[id].name + " devolveu uma resposta vazia. Tente de novo."); return text; }
    }
    if (P[id].kind === "gemini") {
      const body = { contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), generationConfig: { temperature: 0.7, maxOutputTokens: 16384 } };
      if (sys) body.systemInstruction = { parts: [{ text: sys }] };
      if (opts.json) body.generationConfig.responseMimeType = "application/json";
      const j = await http("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: opts.signal }, id);
      const cand = (j.candidates || [])[0] || {};
      text = ((cand.content || {}).parts || []).map((p) => p.text || "").join("");
      if (!text && cand.finishReason === "MAX_TOKENS") throw err("truncated", "A resposta ficou grande demais para o Gemini. Peça menos questões ou escolha outro modelo.");
      if (!text && j.promptFeedback) throw err("blocked_content", "O Gemini recusou o pedido. Reformule o tema.");
    } else if (P[id].kind === "anthropic") {
      const j = await http("https://api.anthropic.com/v1/messages", { method: "POST", signal: opts.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model, max_tokens: 8000, system: sys || undefined, messages }) }, id);
      text = (j.content || []).map((b) => b.text || "").join("");
    } else {
      const body = { model, messages: (sys ? [{ role: "system", content: sys }] : []).concat(messages), temperature: 0.7 };
      if (opts.json && id !== "ollama" && id !== "huggingface") body.response_format = { type: "json_object" };
      const call = () => http(baseOf(id) + "/chat/completions", { method: "POST", signal: opts.signal, headers: headersFor(id, key), body: JSON.stringify(body) }, id);
      let j;
      try { j = await call(); }
      catch (e) { if (body.response_format && e.code === "http" && e.status === 400) { delete body.response_format; j = await call(); } else throw e; }
      text = ((((j.choices || [])[0] || {}).message) || {}).content || "";
    }
    text = String(text).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) throw err("empty", P[id].name + " devolveu uma resposta vazia. Tente de novo.");
    if (opts.onText) opts.onText({ text, delta: text });
    return text;
  };
  AV.parseJSON = function (t) {
    t = String(t).replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try { return JSON.parse(t); } catch (e) {}
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw err("bad_json", "A IA respondeu fora do formato esperado. Tente de novo.");
  };
  /* testa uma IA com um pedido curtinho */
  AV.testProvider = async function (id) {
    if (id === "claude") { const s = await AV.cap.sample; if (!s) throw err("unavailable", "Disponível só dentro do claude.ai."); const r = await s("Responda só: OK", { modelTier: "quick", cache: false }); return "Funcionando (" + (r.modelApplied || "Claude") + ")"; }
    const t = await AV.callProvider(id, [{ role: "user", content: "Responda apenas: OK" }], {});
    if (P[id].internal) return "Funcionando" + (AV.lastEngine && P[AV.lastEngine] ? " (" + P[AV.lastEngine].short + ")" : "") + ".";
    return "Funcionando (" + (AV.aiCfg().models[id] || P[id].models[0]) + "): " + t.slice(0, 40);
  };
})(globalThis.AV = globalThis.AV || {});

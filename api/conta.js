/**
 * Contas institucionais do AulaViva Studio (função do Vercel).
 *
 * GET  /api/conta                       -> { ativo, url, anon }   (dados públicos para o navegador falar com o Supabase)
 * POST /api/conta { acao: "enviar-codigo" }              Bearer: sessão de senha -> envia código de 6 dígitos ao e-mail
 * POST /api/conta { acao: "verificar-codigo", codigo }   Bearer: sessão de senha -> confirma a sessão
 * POST /api/conta { acao: "confirmar-sessao" }           Bearer: sessão criada por código (cadastro/recuperação) -> confirma
 * POST /api/conta { acao: "evento", tipo, detalhe }      Bearer: sessão confirmada -> registra evento de segurança
 * POST /api/conta { acao: "sair-de-todos" }              Bearer: sessão confirmada -> encerra todas as sessões
 *
 * Nenhum dado é liberado só com a senha: o banco (RLS) exige a sessão confirmada por aqui.
 */
"use strict";

const S = require("./_seguranca");
const SB = require("./_supabase");

const MAX_BODY = 4000;
const sendLimit = S.rateLimiter([[60e3, 1], [3600e3, 6]]);        // código por usuário: 1 por minuto, 6 por hora
const verifyLimit = S.rateLimiter([[15 * 60e3, 6]]);              // tentativas de código por usuário
const ipLimit = S.rateLimiter([[60e3, 30], [3600e3, 300]]);        // pedidos por IP
const eventLimit = S.rateLimiter([[60e3, 20]]);
const CODE_RE = /^\d{6}$/;
const EVENTOS = new Set(["escudo", "arquivo-bloqueado", "2fa-ativada", "2fa-desativada", "senha-alterada", "login-falhou", "csp"]);

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

async function requireUser(req) {
  const auth = await SB.userFromToken(S.bearer(req));
  if (!auth) throw fail(401, "Sessão inválida ou expirada. Entre de novo.", "unauthorized");
  return auth;
}

const actions = {
  /** login: depois da senha, envia o código ao e-mail da conta (o e-mail vem do servidor, nunca do navegador) */
  async "enviar-codigo"(req, body, ip) {
    const auth = await requireUser(req);
    if (!sendLimit(auth.user.id)) throw fail(429, "Aguarde um minuto para pedir outro código.", "rate_limited");
    const r = await SB.call("/auth/v1/otp", { method: "POST", body: { email: auth.user.email, create_user: false } });
    if (!r.ok) throw fail(r.status === 429 ? 429 : 502, r.status === 429 ? "Muitos códigos pedidos. Aguarde alguns minutos." : "Não foi possível enviar o código agora.", "send_failed");
    await SB.logEvent(auth.user.id, "codigo-enviado", "login", ip);
    return { enviado: true, email: mask(auth.user.email) };
  },

  /** login: confere o código; se certo, a sessão de senha passa a valer (cria e descarta uma sessão temporária) */
  async "verificar-codigo"(req, body, ip) {
    const auth = await requireUser(req);
    const code = String(body.codigo || "").replace(/\D/g, "");
    if (!CODE_RE.test(code)) throw fail(400, "Digite os 6 números do código.", "bad_code");
    if (!verifyLimit(auth.user.id)) throw fail(429, "Muitas tentativas. Aguarde 15 minutos e peça um novo código.", "rate_limited");
    const r = await SB.call("/auth/v1/verify", { method: "POST", body: { type: "email", email: auth.user.email, token: code } });
    if (!r.ok || !r.data || !r.data.access_token) {
      await SB.logEvent(auth.user.id, "codigo-incorreto", "login", ip);
      throw fail(400, "Código incorreto ou vencido.", "bad_code");
    }
    await SB.call("/auth/v1/logout?scope=local", { method: "POST", token: r.data.access_token }); // descarta a sessão temporária
    const saved = await SB.markVerified(auth, ip, req.headers["user-agent"]);
    if (!saved.ok) throw fail(502, "Não foi possível confirmar a sessão. Tente de novo.", "store_failed");
    await SB.logEvent(auth.user.id, "login", "senha + código do e-mail", ip);
    return { verificada: true };
  },

  /** cadastro e recuperação: a própria sessão nasceu de um código do e-mail há pouco tempo */
  async "confirmar-sessao"(req, body, ip) {
    const auth = await requireUser(req);
    const amr = Array.isArray(auth.claims.amr) ? auth.claims.amr : [];
    const recentOtp = amr.some((m) => ["otp", "recovery", "email/signup", "magiclink"].includes(m.method) && Date.now() / 1000 - (m.timestamp || 0) < 600);
    if (!recentOtp) throw fail(403, "Esta sessão não foi confirmada por código.", "not_otp");
    const saved = await SB.markVerified(auth, ip, req.headers["user-agent"]);
    if (!saved.ok) throw fail(502, "Não foi possível confirmar a sessão. Tente de novo.", "store_failed");
    await SB.logEvent(auth.user.id, "sessao-confirmada", amr.map((m) => m.method).join(","), ip);
    return { verificada: true };
  },

  async evento(req, body, ip) {
    const auth = await requireUser(req);
    if (!(await SB.isVerified(auth))) throw fail(403, "Sessão não confirmada.", "unverified");
    const tipo = String(body.tipo || "");
    if (!EVENTOS.has(tipo)) throw fail(400, "Evento inválido.", "bad_event");
    if (!eventLimit(auth.user.id)) return { registrado: false };
    await SB.logEvent(auth.user.id, tipo, String(body.detalhe || "").slice(0, 300), ip);
    return { registrado: true };
  },

  async "sair-de-todos"(req, body, ip) {
    const auth = await requireUser(req);
    await SB.call("/auth/v1/logout?scope=global", { method: "POST", token: S.bearer(req) });
    await SB.call("/rest/v1/sessoes_verificadas?user_id=eq." + encodeURIComponent(auth.user.id), { method: "DELETE", key: "service" });
    await SB.logEvent(auth.user.id, "sair-de-todos", "", ip);
    return { encerradas: true };
  }
};

function mask(email) {
  const [u, d] = String(email).split("@");
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "*".repeat(Math.min(6, u.length - 2))) + "@" + d;
}

module.exports = async function handler(req, res) {
  if (!S.guard(req, res)) return;
  if (req.method === "GET") {
    const c = SB.cfg();
    return S.sendJson(res, 200, SB.enabled() ? { ativo: true, url: c.url, anon: c.anon } : { ativo: false });
  }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST, OPTIONS"); return S.sendJson(res, 405, { error: "method" }); }
  if (!/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) return S.sendJson(res, 415, { error: "content_type", message: "Envie JSON." });
  if (!SB.enabled()) return S.sendJson(res, 503, { error: "off", message: "As contas institucionais ainda não foram configuradas." });
  const ip = S.clientIp(req);
  if (!ipLimit(ip)) return S.sendJson(res, 429, { error: "rate_limited", message: "Muitos pedidos. Aguarde um pouco." });
  try {
    const body = S.readJsonBody(req, MAX_BODY);
    const action = actions[body.acao];
    if (!Object.prototype.hasOwnProperty.call(actions, body.acao) || typeof action !== "function") throw fail(400, "Ação inválida.", "bad_action");
    return S.sendJson(res, 200, await action(req, body, ip));
  } catch (e) {
    const status = e.status || 500;
    return S.sendJson(res, status, { error: e.code || "error", message: status === 500 ? "Erro interno. Tente de novo." : e.message });
  }
};
module.exports.mask = mask;

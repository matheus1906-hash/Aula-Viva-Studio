/**
 * Acesso do servidor ao Supabase pela API REST (sem bibliotecas).
 * Variáveis de ambiente no Vercel: SUPABASE_URL, SUPABASE_ANON_KEY (pública) e SUPABASE_SERVICE_ROLE_KEY (secreta).
 */
"use strict";

const cfg = () => ({
  url: String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  anon: process.env.SUPABASE_ANON_KEY || "",
  service: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
});
const enabled = () => { const c = cfg(); return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url) && !!c.anon && !!c.service; };

async function call(path, { method = "GET", token, key = "anon", body, headers } = {}) {
  const c = cfg();
  const apikey = key === "service" ? c.service : c.anon;
  const res = await fetch(c.url + path, {
    method,
    headers: Object.assign({ apikey, authorization: "Bearer " + (token || apikey), "content-type": "application/json" }, headers || {}),
    body: body == null ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

/** decodifica o JWT (só use depois de validar o token no Supabase) */
function claims(token) {
  try { return JSON.parse(Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); }
  catch (e) { return null; }
}

/** valida o token no Supabase; devolve { user, claims } ou null */
async function userFromToken(token) {
  if (!token) return null;
  const r = await call("/auth/v1/user", { token });
  if (!r.ok || !r.data || !r.data.id) return null;
  const c = claims(token);
  if (!c || c.sub !== r.data.id || !c.session_id) return null;
  return { user: r.data, claims: c };
}

/** a sessão foi confirmada pelo código do e-mail? (e aal2 se a pessoa ativou 2 etapas) */
async function isVerified(auth) {
  const q = "/rest/v1/sessoes_verificadas?select=session_id&session_id=eq." + encodeURIComponent(auth.claims.session_id) + "&user_id=eq." + encodeURIComponent(auth.user.id) + "&expira_em=gt." + encodeURIComponent(new Date().toISOString());
  const r = await call(q, { key: "service" });
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return false;
  const hasMfa = (auth.user.factors || []).some((f) => f.status === "verified");
  return !hasMfa || auth.claims.aal === "aal2";
}

async function markVerified(auth, ip, agent) {
  return call("/rest/v1/sessoes_verificadas", {
    method: "POST", key: "service",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: { session_id: auth.claims.session_id, user_id: auth.user.id, ip: String(ip).slice(0, 64), agente: String(agent || "").slice(0, 200) }
  });
}

async function logEvent(userId, tipo, detalhe, ip) {
  return call("/rest/v1/eventos_seguranca", {
    method: "POST", key: "service", headers: { prefer: "return=minimal" },
    body: { user_id: userId || null, tipo: String(tipo).slice(0, 40), detalhe: String(detalhe || "").slice(0, 300), ip: String(ip || "").slice(0, 64) }
  }).catch(() => {});
}

module.exports = { cfg, enabled, call, claims, userFromToken, isVerified, markVerified, logEvent };

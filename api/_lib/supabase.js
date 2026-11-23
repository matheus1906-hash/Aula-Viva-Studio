"use strict";
function send(res,status,body){res.status(status).setHeader("Cache-Control","no-store").json(body);}
function env(n){return String(process.env[n]||"").trim();}
function config(){const url=env("SUPABASE_URL").replace(/\/$/,""),anon=env("SUPABASE_ANON_KEY"),service=env("SUPABASE_SERVICE_ROLE_KEY");if(!url||!anon||!service){const e=new Error("Supabase não configurado no ambiente da Vercel.");e.status=503;throw e;}return{url,anon,service};}
function bearer(req){const m=String(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i);if(!m){const e=new Error("Sessão ausente. Entre novamente.");e.status=401;throw e;}return m[1];}
async function userFromRequest(req){const c=config(),token=bearer(req),r=await fetch(c.url+"/auth/v1/user",{headers:{apikey:c.anon,Authorization:"Bearer "+token}});if(!r.ok){const e=new Error("Sessão inválida ou expirada.");e.status=401;throw e;}const user=await r.json();if(!user||!user.id||!user.email){const e=new Error("Não foi possível validar a conta.");e.status=401;throw e;}return{user,config:c};}
async function rpc(c,name,body){const r=await fetch(c.url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:c.service,Authorization:"Bearer "+c.service,"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json().catch(()=>null);if(!r.ok){const e=new Error(data&&(data.message||data.hint)||"Falha ao consultar o controle de conta.");e.status=r.status>=500?502:400;throw e;}return data;}
function handleError(res,e){const status=Number(e&&e.status)||500;send(res,status,{error:status>=500&&status!==503?"Erro interno. Tente novamente.":e.message});}
module.exports={send,config,userFromRequest,rpc,handleError};

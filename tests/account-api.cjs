"use strict";
const fs=require("fs"),path=require("path"),cp=require("child_process");
const root=path.join(__dirname,"..");
const files=["api/_lib/supabase.js","api/config.js","api/account/status.js","api/usage/reserve.js","api/usage/complete.js","api/usage/release.js"];
let failed=0;
for(const file of files){try{cp.execFileSync(process.execPath,["--check",path.join(root,file)],{stdio:"pipe"});console.log("PASS syntax "+file);}catch(e){failed++;console.error("FAIL syntax "+file+"\n"+e.stderr);}}
const sql=fs.readFileSync(path.join(root,"supabase/migrations/202611230001_account_trial_and_usage.sql"),"utf8");
for(const [name,ok] of [
 ["trial individual de 12 meses",/interval '12 months'/.test(sql)],
 ["franquia semanal de cinco",/v_used>=5/.test(sql)],
 ["uso semanal não consome trial",/reserved_at>=p\.trial_ends_at/.test(sql)],
 ["reservas serializadas",/pg_advisory_xact_lock/.test(sql)],
 ["RPC protegida para service_role",/grant execute on function public\.av_reserve_ai_usage\(uuid,text\) to service_role/.test(sql)]
]){console.log((ok?"PASS ":"FAIL ")+name);if(!ok)failed++;}
process.exit(failed?1:0);

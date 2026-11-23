"use strict";
const {send,config,handleError}=require("./_lib/supabase");
module.exports=function(req,res){if(req.method!=="GET")return send(res,405,{error:"Método não permitido."});try{const c=config();return send(res,200,{enabled:true,supabaseUrl:c.url,supabaseAnonKey:c.anon});}catch(e){if(e.status===503)return send(res,200,{enabled:false});return handleError(res,e);}};

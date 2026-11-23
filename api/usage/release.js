"use strict";
const {send,userFromRequest,rpc,handleError}=require("../_lib/supabase");
module.exports=async function(req,res){if(req.method!=="POST")return send(res,405,{error:"Método não permitido."});try{const {user,config}=await userFromRequest(req),id=String(req.body&&req.body.reservationId||"");if(!/^[0-9a-f-]{36}$/i.test(id))return send(res,400,{error:"Reserva inválida."});return send(res,200,await rpc(config,"av_release_ai_usage",{p_user_id:user.id,p_reservation_id:id}));}catch(e){return handleError(res,e);}};

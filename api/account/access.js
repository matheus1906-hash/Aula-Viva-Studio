"use strict";
const {send,userFromRequest,rpc,handleError}=require("../_lib/supabase");
module.exports=async function handler(req,res){
 if(req.method!=="GET")return send(res,405,{error:"Método não permitido."});
 try{
  const {user,config}=await userFromRequest(req);
  return send(res,200,await rpc(config,"av_access_status",{p_user_id:user.id}));
 }catch(e){return handleError(res,e);}
};

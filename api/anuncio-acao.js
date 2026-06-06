import { verificarStatus } from '../lib/verificar-status.js';
export const config = { maxDuration: 30 };
const GRAPH = "v25.0";
export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({error:"Método não permitido."});
    const st = await verificarStatus(req);
    if (!st.permitido) return res.status(403).json({ error: st.motivo, status: st.status });
    console.log('[verificar-status] fonte:', st.fonte, 'status:', st.status);
    const token=process.env.META_ACCESS_TOKEN;
    if(!token) return res.status(500).json({error:"Falta META_ACCESS_TOKEN."});
    let body=req.body; if(typeof body==="string"){try{body=JSON.parse(body)}catch{body={}}} body=body||{};
    const adId=(body.ad_id||"").trim();
    if(!adId) return res.status(400).json({error:"ad_id é obrigatório."});
    const qs=new URLSearchParams({ access_token: token });
    const r=await fetch(`https://graph.facebook.com/${GRAPH}/${adId}?${qs}`,{ method:"DELETE" });
    const data=await r.json();
    if(!r.ok||data.error) return res.status(r.status||500).json({error:data.error?.message||"Falha ao excluir o anúncio.",details:data.error||null});
    return res.status(200).json({ sucesso:true });
  }catch(err){ return res.status(500).json({error:err.message||"Falha inesperada."}); }
}

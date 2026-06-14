import { getMetaConfig } from '../lib/meta-config.js';
import { verificarOwnership } from '../lib/verificar-ownership.js';
export const config = { maxDuration: 30 };
const GRAPH = "v25.0";
const DEFAULT_PRESET = "last_14d";
const ALLOWED_PRESETS = new Set(["today","yesterday","last_7d","last_14d","last_30d","this_month","last_month","maximum"]);
function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
function actionValue(a,t){ if(!Array.isArray(a))return 0; const h=a.find(x=>x.action_type===t); return h?num(h.value):0; }
// Detecta pelo resultado: messaging_conversation_started → WhatsApp; caso contrário → site (landing_page_view).
// Limitação conhecida: campanha de WhatsApp com 0 conversas ainda retorna tipo:"site" até a primeira conversa.
function detectarConversao(actions, actionValues){
  if(Array.isArray(actions)){
    const conv=actions.find(a=>/messaging_conversation_started/i.test(a.action_type||""));
    if(conv&&num(conv.value)>0) return {tipo:"whatsapp", valor:num(conv.value), rotuloSub:"conversas no WhatsApp", compras:0, receita:0};
  }
  const compras=actionValue(actions,"purchase");
  const receita=Array.isArray(actionValues)
    ?(actionValues.find(a=>a.action_type==="purchase")?num(actionValues.find(a=>a.action_type==="purchase").value):0)
    :0;
  return {tipo:"site", valor:actionValue(actions,"landing_page_view"), rotuloSub:"visitas ao site", compras, receita};
}
function getQuery(req){ if(req.query&&Object.keys(req.query).length)return req.query; try{ return Object.fromEntries(new URL(req.url,"http://localhost").searchParams);}catch{return {};} }

export default async function handler(req,res){
  try{
    const token=process.env.META_ACCESS_TOKEN;
    if(!token) return res.status(500).json({error:"Falta META_ACCESS_TOKEN."});
    const q=getQuery(req);
    const campaignId=(q.campaign_id||"").trim();
    if(!campaignId) return res.status(400).json({error:"campaign_id é obrigatório."});

    const { fonte } = await getMetaConfig(req);
    if (fonte === 'env-com-bearer') {
      return res.status(403).json({ erro: 'Conta não configurada. Solicite à agência a configuração da sua conta.' });
    }

    const own = await verificarOwnership(req, campaignId);
    if (!own.permitido) return res.status(403).json({ error: own.motivo });

    let dateParam;
    if(q.since&&q.until) dateParam=`time_range=${encodeURIComponent(JSON.stringify({since:q.since,until:q.until}))}`;
    else { const p=ALLOWED_PRESETS.has(q.preset)?q.preset:DEFAULT_PRESET; dateParam=`date_preset=${p}`; }

    const adsUrl=`https://graph.facebook.com/${GRAPH}/${campaignId}/ads?fields=id,name,effective_status,creative{thumbnail_url}&limit=100&access_token=${encodeURIComponent(token)}`;
    const insUrl=`https://graph.facebook.com/${GRAPH}/${campaignId}/insights?level=ad&${dateParam}&fields=ad_id,spend,inline_link_clicks,inline_link_click_ctr,actions&limit=100&access_token=${encodeURIComponent(token)}`;

    const [adsR,insR]=await Promise.all([fetch(adsUrl),fetch(insUrl)]);
    const adsJson=await adsR.json(); const insJson=await insR.json();
    if(!adsR.ok||adsJson.error) return res.status(adsR.status||500).json({error:adsJson.error?.message||"Erro ao buscar anúncios.",details:adsJson.error||null});

    const insMap={}; if(Array.isArray(insJson.data)) for(const r of insJson.data) insMap[r.ad_id]=r;
    const _rotulos=[...new Set((insJson.data||[]).filter(r=>Array.isArray(r.actions)&&r.actions.length>0).map(r=>detectarConversao(r.actions).rotuloSub))];
    const rotuloChegada=_rotulos.length===1?_rotulos[0]:"";
    const anuncios=(adsJson.data||[]).map(ad=>{
      const ins=insMap[ad.id]||{};
      const investido=num(ins.spend), cliques=num(ins.inline_link_clicks), ctr=num(ins.inline_link_click_ctr);
      const {tipo,valor:conversoes,compras,receita}=detectarConversao(ins.actions,ins.action_values);
      return { id:ad.id, nome:ad.name, thumbnail:ad.creative?.thumbnail_url||null,
        investido, cliques, ctr, tipo, conversoes, cpp: conversoes>0?investido/conversoes:0, compras, receita, comDados:!!insMap[ad.id] };
    });
    return res.status(200).json({ anuncios, rotuloChegada });
  }catch(err){ return res.status(500).json({error:err.message||"Falha inesperada."}); }
}

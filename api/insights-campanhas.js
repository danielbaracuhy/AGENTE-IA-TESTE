// api/insights-campanhas.js
export const config = { maxDuration: 30 };

const GRAPH = "v25.0"; // mesma versão de listar-campanhas.js
const DEFAULT_PRESET = "last_14d";
const ALLOWED_PRESETS = new Set([
  "today","yesterday","last_7d","last_14d","last_30d","this_month","last_month","maximum",
]);

const CONVERSION_PRIORITY = [
  "offsite_conversion.fb_pixel_purchase","purchase","onsite_conversion.purchase",
  "offsite_conversion.fb_pixel_lead","lead","onsite_conversion.lead_grouped",
  "onsite_conversion.messaging_conversation_started_7d",
  "offsite_conversion.fb_pixel_complete_registration","complete_registration",
];
const STATUS_PT = { ACTIVE:"Ativa", PAUSED:"Pausada", CAMPAIGN_PAUSED:"Pausada",
  ADSET_PAUSED:"Pausada", ARCHIVED:"Arquivada", DELETED:"Excluída" };

function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
function actionValue(actions,type){ if(!Array.isArray(actions))return 0;
  const h=actions.find(a=>a.action_type===type); return h?num(h.value):0; }
function resolveConversions(actions){
  for(const t of CONVERSION_PRIORITY){ const v=actionValue(actions,t); if(v>0)return{conversoes:v,tipo:t}; }
  if(Array.isArray(actions)){ const fb=actions.find(a=>num(a.value)>0 &&
    /purchase|lead|messaging_conversation_started|complete_registration|conversion/i.test(a.action_type||""));
    if(fb)return{conversoes:num(fb.value),tipo:fb.action_type}; }
  return{conversoes:0,tipo:null};
}
function detectarDestino(actions){
  return Array.isArray(actions) && actions.some(a=>/messaging_conversation_started/i.test(a.action_type||""))
    ? "whatsapp" : "site";
}
function contarChegada(actions, destino){
  if(destino==="whatsapp"){
    return actionValue(actions,"onsite_conversion.messaging_conversation_started_7d")
        || actionValue(actions,"onsite_conversion.messaging_conversation_started")
        || actionValue(actions,"messaging_conversation_started_7d")
        || actionValue(actions,"messaging_conversation_started");
  }
  return actionValue(actions,"landing_page_view");
}
function fmtData(iso){ if(!iso)return""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; }
function getQuery(req){ if(req.query&&Object.keys(req.query).length)return req.query;
  try{ return Object.fromEntries(new URL(req.url,"http://localhost").searchParams); }catch{ return {}; } }

export default async function handler(req,res){
  try{
    const token=process.env.META_ACCESS_TOKEN;
    const accountId=process.env.META_AD_ACCOUNT_ID;
    if(!token||!accountId) return res.status(500).json({error:"Faltam META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID."});

    const q=getQuery(req);
    let dateParam;
    if(q.since&&q.until){
      dateParam=`time_range=${encodeURIComponent(JSON.stringify({since:q.since,until:q.until}))}`;
    }else{
      const preset=ALLOWED_PRESETS.has(q.preset)?q.preset:DEFAULT_PRESET;
      dateParam=`date_preset=${preset}`;
    }
    const campaignId=(q.campaign_id||"").trim();

    const fields=["campaign_id","campaign_name","spend","reach","impressions","frequency",
      "inline_link_clicks","inline_link_click_ctr","cost_per_inline_link_click","cpm","actions",
      "date_start","date_stop"].join(",");

    const insightsUrl=`https://graph.facebook.com/${GRAPH}/${accountId}/insights`+
      `?level=campaign&${dateParam}&fields=${fields}&limit=500&access_token=${encodeURIComponent(token)}`;
    const statusUrl=`https://graph.facebook.com/${GRAPH}/${accountId}/campaigns`+
      `?fields=id,name,effective_status&limit=500&access_token=${encodeURIComponent(token)}`;

    const [insR,stR]=await Promise.all([fetch(insightsUrl),fetch(statusUrl)]);
    const insJson=await insR.json(); const stJson=await stR.json();
    if(!insR.ok||insJson.error) return res.status(insR.status||500).json({
      error:insJson.error?.message||"Erro na Meta Insights API.", details:insJson.error||null });

    const statusMap={};
    if(Array.isArray(stJson.data)) for(const c of stJson.data) statusMap[c.id]=STATUS_PT[c.effective_status]||"—";
    const campanhasDisponiveis=Array.isArray(stJson.data)?stJson.data.map(c=>({id:c.id,nome:c.name})):[];

    const rows=Array.isArray(insJson.data)?insJson.data:[];
    let campanhas=rows.map(row=>{
      const investido=num(row.spend);
      const cliques=num(row.inline_link_clicks);
      const lp_views=actionValue(row.actions,"landing_page_view");
      const destino=detectarDestino(row.actions);
      const conversoes=contarChegada(row.actions,destino);
      return { nome:row.campaign_name, status:statusMap[row.campaign_id]||"—",
        investido, alcance:num(row.reach), impressoes:num(row.impressions), frequencia:num(row.frequency),
        cliques, ctr:num(row.inline_link_click_ctr), cpc:num(row.cost_per_inline_link_click), cpm:num(row.cpm),
        lp_views, custo_lp: lp_views>0?investido/lp_views:0, conversoes,
        cpp: conversoes>0?investido/conversoes:0,
        taxa_clp: cliques>0?(lp_views/cliques)*100:0,
        taxa_conv: lp_views>0?(conversoes/lp_views)*100:0,
        destino, _campaignId:row.campaign_id };
    });
    if(campaignId) campanhas=campanhas.filter(c=>c._campaignId===campaignId);

    let inicio="",fim="";
    if(q.since&&q.until){ inicio=fmtData(q.since); fim=fmtData(q.until); }
    else if(rows.length){ inicio=fmtData(rows[0].date_start); fim=fmtData(rows[0].date_stop); }
    const periodo=(inicio&&fim)?`${inicio} a ${fim}`:"Período selecionado";

    const _dests=[...new Set(campanhas.map(c=>c.destino))];
    const destino=_dests.length===1?_dests[0]:(_dests.length===0?"site":"misto");
    const rotuloConvSub=destino==="whatsapp"?"conversa no WhatsApp"
                       :destino==="site"?"visita na página":"conversas + visitas";

    return res.status(200).json({ periodo, inicio, fim, atualizadoEm:new Date().toISOString(),
      campanhas, campanhasDisponiveis, destino, rotuloConvSub });
  }catch(err){ return res.status(500).json({error:err.message||"Falha inesperada no Analisador."}); }
}

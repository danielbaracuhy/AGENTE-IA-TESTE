// api/insights-campanhas.js
import { getMetaConfig } from '../lib/meta-config.js';

export const config = { maxDuration: 30 };

const GRAPH = "v25.0"; // mesma versão de listar-campanhas.js
const DEFAULT_PRESET = "last_14d";
const ALLOWED_PRESETS = new Set([
  "today","yesterday","last_7d","last_14d","last_30d","this_month","last_month","maximum",
]);

const STATUS_PT = { ACTIVE:"Ativa", PAUSED:"Pausada", CAMPAIGN_PAUSED:"Pausada",
  ADSET_PAUSED:"Pausada", ARCHIVED:"Arquivada", DELETED:"Excluída" };

function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
function actionValue(actions,type){ if(!Array.isArray(actions))return 0;
  const h=actions.find(a=>a.action_type===type); return h?num(h.value):0; }
// Detecta pelo resultado: messaging_conversation_started → WhatsApp; caso contrário → site (landing_page_view).
// Limitação conhecida: campanha de WhatsApp com 0 conversas ainda retorna tipo:"site" até a primeira conversa.
function detectarConversao(actions){
  if(Array.isArray(actions)){
    const conv=actions.find(a=>/messaging_conversation_started/i.test(a.action_type||""));
    if(conv&&num(conv.value)>0) return {tipo:"whatsapp", valor:num(conv.value), rotuloSub:"conversas no WhatsApp"};
  }
  return {tipo:"site", valor:actionValue(actions,"landing_page_view"), rotuloSub:"visitas ao site"};
}
function fmtData(iso){ if(!iso)return""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; }
function getQuery(req){ if(req.query&&Object.keys(req.query).length)return req.query;
  try{ return Object.fromEntries(new URL(req.url,"http://localhost").searchParams); }catch{ return {}; } }

export default async function handler(req,res){
  try{
    const token=process.env.META_ACCESS_TOKEN;
    if(!token) return res.status(500).json({error:"Falta META_ACCESS_TOKEN."});

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

    const { adAccountId: accountId, fonte } = await getMetaConfig(req);
    if (fonte === 'env-com-bearer') {
      return res.status(403).json({ erro: 'Conta não configurada. Solicite à agência a configuração da sua conta.' });
    }
    const insightsUrl=`https://graph.facebook.com/${GRAPH}/${accountId}/insights`+
      `?level=campaign&${dateParam}&fields=${fields}&limit=500&access_token=${encodeURIComponent(token)}`;
    const statusUrl=`https://graph.facebook.com/${GRAPH}/${accountId}/campaigns`+
      `?fields=id,name,effective_status,objective&limit=500&access_token=${encodeURIComponent(token)}`;

    const [insR,stR]=await Promise.all([fetch(insightsUrl),fetch(statusUrl)]);
    const insJson=await insR.json(); const stJson=await stR.json();
    if(!insR.ok||insJson.error) return res.status(insR.status||500).json({
      error:insJson.error?.message||"Erro na Meta Insights API.", details:insJson.error||null });

    const statusMap={}, objectiveMap={};
    if(Array.isArray(stJson.data)) for(const c of stJson.data){
      statusMap[c.id]=STATUS_PT[c.effective_status]||"—";
      objectiveMap[c.id]=c.objective||"";
    }
    const campanhasDisponiveis=Array.isArray(stJson.data)?stJson.data.map(c=>({id:c.id,nome:c.name})):[];

    const rows=Array.isArray(insJson.data)?insJson.data:[];
    let campanhas=rows.map(row=>{
      const investido=num(row.spend);
      const cliques=num(row.inline_link_clicks);
      const lp_views=actionValue(row.actions,"landing_page_view");
      const objective=objectiveMap[row.campaign_id]||"";
      const {tipo,valor:conversoes,rotuloSub}=detectarConversao(row.actions);
      return { nome:row.campaign_name, status:statusMap[row.campaign_id]||"—",
        investido, alcance:num(row.reach), impressoes:num(row.impressions), frequencia:num(row.frequency),
        cliques, ctr:num(row.inline_link_click_ctr), cpc:num(row.cost_per_inline_link_click), cpm:num(row.cpm),
        lp_views, conversoes,
        cpp: conversoes>0?investido/conversoes:0,
        tipo, rotuloSub, objective, _campaignId:row.campaign_id };
    });
    if(campaignId) campanhas=campanhas.filter(c=>c._campaignId===campaignId);

    let inicio="",fim="";
    if(q.since&&q.until){ inicio=fmtData(q.since); fim=fmtData(q.until); }
    else if(rows.length){ inicio=fmtData(rows[0].date_start); fim=fmtData(rows[0].date_stop); }
    const periodo=(inicio&&fim)?`${inicio} a ${fim}`:"Período selecionado";

    const _subs=[...new Set(campanhas.map(c=>c.rotuloSub).filter(Boolean))];
    const rotuloConvSub=_subs.length===1?_subs[0]:"";

    return res.status(200).json({ periodo, inicio, fim, atualizadoEm:new Date().toISOString(),
      campanhas, campanhasDisponiveis, rotuloConvSub });
  }catch(err){ return res.status(500).json({error:err.message||"Falha inesperada no Analisador."}); }
}

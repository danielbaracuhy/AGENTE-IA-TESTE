export const config = { maxDuration: 30 };
const GRAPH = "v25.0";
const DEFAULT_PRESET = "last_14d";
const ALLOWED_PRESETS = new Set(["today","yesterday","last_7d","last_14d","last_30d","this_month","last_month","maximum"]);
const CONVERSION_PRIORITY = ["offsite_conversion.fb_pixel_purchase","purchase","onsite_conversion.purchase","offsite_conversion.fb_pixel_lead","lead","onsite_conversion.lead_grouped","onsite_conversion.messaging_conversation_started_7d","offsite_conversion.fb_pixel_complete_registration","complete_registration"];
function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
function actionValue(a,t){ if(!Array.isArray(a))return 0; const h=a.find(x=>x.action_type===t); return h?num(h.value):0; }
function resolveConversions(a){ for(const t of CONVERSION_PRIORITY){ const v=actionValue(a,t); if(v>0)return v; } if(Array.isArray(a)){ const fb=a.find(x=>num(x.value)>0 && /purchase|lead|messaging_conversation_started|complete_registration|conversion/i.test(x.action_type||"")); if(fb)return num(fb.value);} return 0; }
function getQuery(req){ if(req.query&&Object.keys(req.query).length)return req.query; try{ return Object.fromEntries(new URL(req.url,"http://localhost").searchParams);}catch{return {};} }

export default async function handler(req,res){
  try{
    const token=process.env.META_ACCESS_TOKEN;
    if(!token) return res.status(500).json({error:"Falta META_ACCESS_TOKEN."});
    const q=getQuery(req);
    const campaignId=(q.campaign_id||"").trim();
    if(!campaignId) return res.status(400).json({error:"campaign_id é obrigatório."});
    let dateParam;
    if(q.since&&q.until) dateParam=`time_range=${encodeURIComponent(JSON.stringify({since:q.since,until:q.until}))}`;
    else { const p=ALLOWED_PRESETS.has(q.preset)?q.preset:DEFAULT_PRESET; dateParam=`date_preset=${p}`; }

    const adsUrl=`https://graph.facebook.com/${GRAPH}/${campaignId}/ads?fields=id,name,effective_status,creative{thumbnail_url}&limit=100&access_token=${encodeURIComponent(token)}`;
    const insUrl=`https://graph.facebook.com/${GRAPH}/${campaignId}/insights?level=ad&${dateParam}&fields=ad_id,spend,inline_link_clicks,inline_link_click_ctr,actions&limit=100&access_token=${encodeURIComponent(token)}`;

    const [adsR,insR]=await Promise.all([fetch(adsUrl),fetch(insUrl)]);
    const adsJson=await adsR.json(); const insJson=await insR.json();
    if(!adsR.ok||adsJson.error) return res.status(adsR.status||500).json({error:adsJson.error?.message||"Erro ao buscar anúncios.",details:adsJson.error||null});

    const insMap={}; if(Array.isArray(insJson.data)) for(const r of insJson.data) insMap[r.ad_id]=r;
    const anuncios=(adsJson.data||[]).map(ad=>{
      const ins=insMap[ad.id]||{};
      const investido=num(ins.spend), cliques=num(ins.inline_link_clicks), ctr=num(ins.inline_link_click_ctr);
      const conversoes=resolveConversions(ins.actions);
      return { id:ad.id, nome:ad.name, thumbnail:ad.creative?.thumbnail_url||null,
        investido, cliques, ctr, conversoes, cpp: conversoes>0?investido/conversoes:0, comDados:!!insMap[ad.id] };
    });
    return res.status(200).json({ anuncios });
  }catch(err){ return res.status(500).json({error:err.message||"Falha inesperada."}); }
}

// api/insights-campanhas.js
export const config = { maxDuration: 30 };

const GRAPH = "v25.0"; // mesma versão de listar-campanhas.js
const DATE_PRESET = "last_14d";

const CONVERSION_PRIORITY = [
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "onsite_conversion.purchase",
  "offsite_conversion.fb_pixel_lead",
  "lead",
  "onsite_conversion.lead_grouped",
  "onsite_conversion.messaging_conversation_started_7d",
  "offsite_conversion.fb_pixel_complete_registration",
  "complete_registration",
];

const STATUS_PT = {
  ACTIVE: "Ativa", PAUSED: "Pausada", CAMPAIGN_PAUSED: "Pausada",
  ADSET_PAUSED: "Pausada", ARCHIVED: "Arquivada", DELETED: "Excluída",
};

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

function actionValue(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const hit = actions.find((a) => a.action_type === type);
  return hit ? num(hit.value) : 0;
}

function resolveConversions(actions) {
  for (const type of CONVERSION_PRIORITY) {
    const v = actionValue(actions, type);
    if (v > 0) return { conversoes: v, tipo: type };
  }
  if (Array.isArray(actions)) {
    const fb = actions.find((a) => num(a.value) > 0 &&
      /purchase|lead|messaging_conversation_started|complete_registration|conversion/i.test(a.action_type || ""));
    if (fb) return { conversoes: num(fb.value), tipo: fb.action_type };
  }
  return { conversoes: 0, tipo: null };
}

export default async function handler(req, res) {
  try {
    const token = process.env.META_ACCESS_TOKEN;
    const accountId = process.env.META_AD_ACCOUNT_ID;
    if (!token || !accountId) {
      return res.status(500).json({ error: "Faltam META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID." });
    }

    const fields = [
      "campaign_id","campaign_name","spend","reach","impressions","frequency",
      "inline_link_clicks","inline_link_click_ctr","cost_per_inline_link_click","cpm","actions",
    ].join(",");

    const insightsUrl =
      `https://graph.facebook.com/${GRAPH}/${accountId}/insights` +
      `?level=campaign&date_preset=${DATE_PRESET}&fields=${fields}&limit=500` +
      `&access_token=${encodeURIComponent(token)}`;

    const statusUrl =
      `https://graph.facebook.com/${GRAPH}/${accountId}/campaigns` +
      `?fields=id,name,effective_status&limit=500&access_token=${encodeURIComponent(token)}`;

    const [insR, stR] = await Promise.all([fetch(insightsUrl), fetch(statusUrl)]);
    const insJson = await insR.json();
    const stJson = await stR.json();

    if (!insR.ok || insJson.error) {
      return res.status(insR.status || 500).json({
        error: insJson.error?.message || "Erro na Meta Insights API.", details: insJson.error || null,
      });
    }

    const statusMap = {};
    if (Array.isArray(stJson.data)) {
      for (const c of stJson.data) statusMap[c.id] = STATUS_PT[c.effective_status] || "—";
    }

    const rows = Array.isArray(insJson.data) ? insJson.data : [];
    const campanhas = rows.map((row) => {
      const investido = num(row.spend);
      const cliques = num(row.inline_link_clicks);
      const lp_views = actionValue(row.actions, "landing_page_view");
      const { conversoes, tipo } = resolveConversions(row.actions);
      const custo_lp = lp_views > 0 ? investido / lp_views : 0;
      const cpp = conversoes > 0 ? investido / conversoes : 0;
      const taxa_clp = cliques > 0 ? (lp_views / cliques) * 100 : 0;
      const taxa_conv = lp_views > 0 ? (conversoes / lp_views) * 100 : 0;
      return {
        nome: row.campaign_name, status: statusMap[row.campaign_id] || "—",
        investido, alcance: num(row.reach), impressoes: num(row.impressions),
        frequencia: num(row.frequency), cliques, ctr: num(row.inline_link_click_ctr),
        cpc: num(row.cost_per_inline_link_click), cpm: num(row.cpm),
        lp_views, custo_lp, conversoes, cpp, taxa_clp, taxa_conv,
        tipoConversao: tipo, _campaignId: row.campaign_id,
      };
    });

    return res.status(200).json({ periodo: "Últimos 14 dias", atualizadoEm: new Date().toISOString(), campanhas });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha inesperada no Analisador." });
  }
}

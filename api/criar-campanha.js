// =============================================================================
//  /api/criar-campanha.js  —  Motor de criação de campanha (Vercel, Node 18+)
//  Cria a campanha COMPLETA no Meta em 4 etapas. Token fica em env var (seguro).
//  Toda campanha nasce PAUSED: você revisa no Gerenciador antes de ativar.
//  ENV (Vercel > Settings > Environment Variables):
//    META_ACCESS_TOKEN / META_AD_ACCOUNT_ID (act_...) / META_PAGE_ID / META_PIXEL_ID(opcional)
// =============================================================================
const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

const OBJETIVOS = {
  venda:          { objective: "OUTCOME_SALES",      optimization_goal: "OFFSITE_CONVERSIONS", billing_event: "IMPRESSIONS", precisaPixel: true },
  reconhecimento: { objective: "OUTCOME_AWARENESS",  optimization_goal: "REACH",                billing_event: "IMPRESSIONS", precisaPixel: false },
  engajamento:    { objective: "OUTCOME_ENGAGEMENT", optimization_goal: "POST_ENGAGEMENT",      billing_event: "IMPRESSIONS", precisaPixel: false },
  whatsapp:       { objective: "OUTCOME_ENGAGEMENT", optimization_goal: "CONVERSATIONS",        billing_event: "IMPRESSIONS", precisaPixel: false, destinoWhatsApp: true },
};

async function buscarGeo(termo) {
  const url = `${GRAPH}/search?type=adgeolocation&location_types=["city","region"]`
    + `&q=${encodeURIComponent(termo)}&access_token=${process.env.META_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.data || !data.data.length) throw new Error(`Localidade "${termo}" não encontrada no Meta.`);
  return data.data[0];
}

async function metaPost(path, params, etapa) {
  const body = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || "erro desconhecido";
    throw new Error(`[${etapa}] ${msg}`);
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  try {
    const {
      nome, intencao, imagemBase64, texto, link, cta, orcamentoDiario,
      paises, cidades, raioKm, idadeMin, idadeMax, generos, plataformas,
    } = req.body;

    const cfg = OBJETIVOS[intencao];
    if (!cfg) throw new Error("Intenção inválida. Use: venda, reconhecimento, engajamento ou whatsapp.");
    if (cfg.precisaPixel && !process.env.META_PIXEL_ID)
      throw new Error("Objetivo VENDA exige um Pixel configurado (META_PIXEL_ID).");

    const ACT = process.env.META_AD_ACCOUNT_ID;
    const reaisEmCentavos = Math.round(Number(orcamentoDiario) * 100);

    const img = await metaPost(`${ACT}/adimages`, { bytes: imagemBase64 }, "upload da imagem");
    const imageHash = Object.values(img.images)[0].hash;

    const campanha = await metaPost(`${ACT}/campaigns`, {
      name: nome, objective: cfg.objective, status: "PAUSED",
      special_ad_categories: "[]", buying_type: "AUCTION", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    }, "criar campanha");

    const geo = { countries: paises || ["BR"] };
    if (cidades && cidades.length) {
      const chaves = [];
      for (const c of cidades) {
        const g = await buscarGeo(c);
        chaves.push({ key: g.key, ...(raioKm ? { radius: raioKm, distance_unit: "kilometer" } : {}) });
      }
      geo.cities = chaves;
      if (chaves.length) delete geo.countries;
    }
    const targeting = {
      geo_locations: geo, age_min: idadeMin || 18, age_max: idadeMax || 65,
      ...(generos && generos.length ? { genders: generos } : {}),
      publisher_platforms: plataformas || ["facebook", "instagram"],
    };
    const adsetParams = {
      name: `${nome} - Conjunto`, campaign_id: campanha.id, daily_budget: reaisEmCentavos,
      billing_event: cfg.billing_event, optimization_goal: cfg.optimization_goal,
      targeting: JSON.stringify(targeting), status: "PAUSED",
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 15 * 86400000).toISOString(),
    };
    if (cfg.precisaPixel)
      adsetParams.promoted_object = JSON.stringify({ pixel_id: process.env.META_PIXEL_ID, custom_event_type: "PURCHASE" });
    if (cfg.destinoWhatsApp) {
      adsetParams.destination_type = "WHATSAPP";
      adsetParams.promoted_object = JSON.stringify({ page_id: process.env.META_PAGE_ID });
    }
    const adset = await metaPost(`${ACT}/adsets`, adsetParams, "criar conjunto de anúncios");

    const linkData = {
      image_hash: imageHash, message: texto,
      ...(cfg.destinoWhatsApp
        ? { call_to_action: { type: "WHATSAPP_MESSAGE" } }
        : { link, call_to_action: { type: cta || "LEARN_MORE", value: { link } } }),
    };
    const creative = await metaPost(`${ACT}/adcreatives`, {
      name: `${nome} - Criativo`,
      object_story_spec: JSON.stringify({ page_id: process.env.META_PAGE_ID, link_data: linkData }),
    }, "criar criativo");

    const anuncio = await metaPost(`${ACT}/ads`, {
      name: `${nome} - Anúncio`, adset_id: adset.id,
      creative: JSON.stringify({ creative_id: creative.id }), status: "PAUSED",
    }, "criar anúncio");

    return res.status(200).json({
      sucesso: true,
      mensagem: "Campanha criada e PAUSADA. Revise no Gerenciador de Anúncios antes de ativar.",
      campaign_id: campanha.id, adset_id: adset.id, creative_id: creative.id, ad_id: anuncio.id,
    });
  } catch (e) {
    return res.status(400).json({ sucesso: false, erro: e.message });
  }
}

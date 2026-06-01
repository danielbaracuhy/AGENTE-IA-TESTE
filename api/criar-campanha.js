const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

// destino escolhido pelo empresário -> configuração de objetivo no Meta
const DESTINOS = {
  whatsapp: { objective: "OUTCOME_ENGAGEMENT", optimization_goal: "CONVERSATIONS", billing_event: "IMPRESSIONS", destinoWhatsApp: true },
  site:     { objective: "OUTCOME_TRAFFIC",    optimization_goal: "LINK_CLICKS",   billing_event: "IMPRESSIONS", destinoWhatsApp: false },
};

function clampRaio(km) { let r = Number(km) || 70; if (r < 1) r = 1; if (r > 70) r = 70; return r; }

async function buscarGeo(termo, tipo) { // tipo: "city" | "region"
  const url = `${GRAPH}/search?type=adgeolocation&location_types=["${tipo}"]`
    + `&q=${encodeURIComponent(termo)}&access_token=${process.env.META_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.data || !data.data.length) throw new Error(`Localidade "${termo}" não encontrada (${tipo}).`);
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
      nome, destino, link, imagemBase64, texto, orcamentoDiario,
      alcance, estados, cidades, idadeMin, idadeMax, generos, plataformas,
    } = req.body;

    const cfg = DESTINOS[destino];
    if (!cfg) throw new Error("Destino inválido. Use: whatsapp ou site.");
    if (destino === "site" && !link) throw new Error("Para destino Site, informe o link.");

    const ACT = process.env.META_AD_ACCOUNT_ID;
    const reaisEmCentavos = Math.round(Number(orcamentoDiario) * 100);

    // 1) imagem -> hash
    const img = await metaPost(`${ACT}/adimages`, { bytes: imagemBase64 }, "upload da imagem");
    const imageHash = Object.values(img.images)[0].hash;

    // 2) campanha — ORÇAMENTO NA CAMPANHA (CBO)
    const campanha = await metaPost(`${ACT}/campaigns`, {
      name: nome,
      objective: cfg.objective,
      status: "PAUSED",
      special_ad_categories: "[]",
      buying_type: "AUCTION",
      daily_budget: reaisEmCentavos,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      is_adset_budget_sharing_enabled: "false",
    }, "criar campanha");

    // 3) localização (3 níveis)
    const geo = {};
    if (alcance === "estados") {
      const regs = [];
      for (const e of (estados || [])) { const g = await buscarGeo(e, "region"); regs.push({ key: g.key }); }
      if (!regs.length) throw new Error("Informe ao menos um estado.");
      geo.regions = regs;
    } else if (alcance === "cidades") {
      const cs = [];
      for (const c of (cidades || [])) { const g = await buscarGeo(c.nome, "city"); cs.push({ key: g.key, radius: clampRaio(c.raio), distance_unit: "kilometer" }); }
      if (!cs.length) throw new Error("Informe ao menos uma cidade.");
      geo.cities = cs;
    } else {
      geo.countries = ["BR"]; // brasil (padrão)
    }

    const targeting = {
      geo_locations: geo,
      age_min: idadeMin || 18,
      age_max: idadeMax || 65,
      ...(generos && generos.length ? { genders: generos } : {}),
      publisher_platforms: plataformas || ["facebook", "instagram"],
    };

    // ad set — SEM orçamento (herda da campanha via CBO)
    const adsetParams = {
      name: `${nome} - Conjunto`,
      campaign_id: campanha.id,
      billing_event: cfg.billing_event,
      optimization_goal: cfg.optimization_goal,
      targeting: JSON.stringify(targeting),
      status: "PAUSED",
      start_time: new Date(Date.now() + 86400000).toISOString(),
      end_time: new Date(Date.now() + 15 * 86400000).toISOString(),
    };
    if (cfg.destinoWhatsApp) {
      adsetParams.destination_type = "WHATSAPP";
      adsetParams.promoted_object = JSON.stringify({ page_id: process.env.META_PAGE_ID });
    }
    const adset = await metaPost(`${ACT}/adsets`, adsetParams, "criar conjunto de anúncios");

    // 4) criativo + anúncio
    const linkData = {
      image_hash: imageHash, message: texto,
      ...(cfg.destinoWhatsApp
        ? { call_to_action: { type: "WHATSAPP_MESSAGE" } }
        : { link, call_to_action: { type: "LEARN_MORE", value: { link } } }),
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

import { del } from '@vercel/blob';

const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

const DESTINOS = {
  whatsapp: { objective: "OUTCOME_ENGAGEMENT", optimization_goal: "CONVERSATIONS", billing_event: "IMPRESSIONS", destinoWhatsApp: true },
  site:     { objective: "OUTCOME_TRAFFIC",    optimization_goal: "LINK_CLICKS",   billing_event: "IMPRESSIONS", destinoWhatsApp: false },
};

export const config = { maxDuration: 60 };

function clampRaio(km) { let r = Number(km) || 70; if (r < 1) r = 1; if (r > 70) r = 70; return r; }

async function buscarGeo(termo, tipo) {
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
    const err = new Error(`[${etapa}] ${msg}`);
    err.metaError = data.error;
    throw err;
  }
  return data;
}

async function metaGet(path, params, etapa) {
  const qs = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || "erro desconhecido";
    const err = new Error(`[${etapa}] ${msg}`);
    err.metaError = data.error;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const {
    nome, destino, link, imagemBase64, videoId, videoUrl, texto, orcamentoDiario,
    alcance, estados, cidades, idadeMin, idadeMax, generos, plataformas,
    criativos: creativosRaw,
  } = req.body || {};
  try {
    const cfg = DESTINOS[destino];
    if (!cfg) throw new Error("Destino inválido. Use: whatsapp ou site.");
    if (destino === "site" && !link) throw new Error("Para destino Site, informe o link.");
    if (destino === "whatsapp" && !process.env.META_WHATSAPP_NUMBER)
      throw new Error("META_WHATSAPP_NUMBER não configurado no servidor.");

    const ACT = process.env.META_AD_ACCOUNT_ID;
    const reaisEmCentavos = Math.round(Number(orcamentoDiario) * 100);
    const waLink = `https://wa.me/${process.env.META_WHATSAPP_NUMBER}`;

    // Build criativos list — new format or fallback to legacy single-creative fields
    const criativos = (creativosRaw && creativosRaw.length)
      ? creativosRaw
      : imagemBase64
        ? [{ tipo: 'imagem', imagemBase64 }]
        : videoId
          ? [{ tipo: 'video', videoId }]
          : [];

    if (!criativos.length) throw new Error("Nenhum criativo recebido.");

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
      geo.countries = ["BR"];
    }

    const targeting = {
      geo_locations: geo,
      age_min: idadeMin || 18,
      age_max: idadeMax || 65,
      ...(generos && generos.length ? { genders: generos } : {}),
      publisher_platforms: plataformas || ["facebook", "instagram"],
      targeting_automation: { advantage_audience: 0 },
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
    };
    if (cfg.destinoWhatsApp) {
      adsetParams.destination_type = "WHATSAPP";
      adsetParams.promoted_object = JSON.stringify({ page_id: process.env.META_PAGE_ID });
    }
    const adset = await metaPost(`${ACT}/adsets`, adsetParams, "criar conjunto de anúncios");

    // 4) criativo + anúncio para cada item da lista
    const anunciosCriados = [];
    for (let i = 0; i < criativos.length; i++) {
      const item = criativos[i];
      const label = `criativo ${i + 1} (${item.tipo})`;
      let creativeSpec;
      if (item.tipo === 'imagem') {
        const img = await metaPost(`${ACT}/adimages`, { bytes: item.imagemBase64 }, `${label}: upload`);
        const imageHash = Object.values(img.images)[0].hash;
        creativeSpec = {
          page_id: process.env.META_PAGE_ID,
          link_data: {
            image_hash: imageHash, message: texto,
            ...(cfg.destinoWhatsApp
              ? { link: waLink, call_to_action: { type: "WHATSAPP_MESSAGE" } }
              : { link, call_to_action: { type: "LEARN_MORE", value: { link } } }),
          },
        };
      } else if (item.tipo === 'video') {
        const thumbs = await metaGet(`${item.videoId}/thumbnails`, {}, `${label}: thumbnails`);
        const preferred = (thumbs.data || []).find(t => t.is_preferred) || thumbs.data?.[0];
        if (!preferred) throw new Error(`[${label}: thumbnails] Nenhuma thumbnail disponível.`);
        const cta = cfg.destinoWhatsApp
          ? { type: "WHATSAPP_MESSAGE" }
          : { type: "LEARN_MORE", value: { link } };
        creativeSpec = {
          page_id: process.env.META_PAGE_ID,
          video_data: { video_id: item.videoId, message: texto, image_url: preferred.uri, call_to_action: cta },
        };
      } else {
        throw new Error(`Tipo de criativo inválido: ${item.tipo}`);
      }

      const creative = await metaPost(`${ACT}/adcreatives`, {
        name: `${nome} - Criativo ${i + 1}`,
        object_story_spec: JSON.stringify(creativeSpec),
      }, `${label}: criar criativo`);

      const anuncio = await metaPost(`${ACT}/ads`, {
        name: `${nome} - Anúncio ${i + 1}`, adset_id: adset.id,
        creative: JSON.stringify({ creative_id: creative.id }), status: "PAUSED",
      }, `${label}: criar anúncio`);

      anunciosCriados.push(anuncio.id);
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: "Campanha criada e PAUSADA. Revise no Gerenciador de Anúncios antes de ativar.",
      campaign_id: campanha.id, adset_id: adset.id,
      ad_ids: anunciosCriados, ad_id: anunciosCriados[0],
    });
  } catch (e) {
    return res.status(400).json({ sucesso: false, erro: e.message, detalhes: e.metaError || null });
  } finally {
    // apaga o Blob em qualquer desfecho terminal (sucesso ou erro)
    if (videoUrl) {
      try { await del(videoUrl); } catch (_) {}
    }
  }
}

import { getMetaConfig } from '../lib/meta-config.js';

const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

// Pior primeiro: DISAPPROVED > WITH_ISSUES > PENDING_BILLING_INFO > em análise > ACTIVE > pausados
const AD_RANK = ['DISAPPROVED','WITH_ISSUES','PENDING_BILLING_INFO','PENDING_REVIEW','IN_PROCESS','PREAPPROVED','ACTIVE','PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED'];
function rankOf(s) { const i = AD_RANK.indexOf(s); return i === -1 ? 999 : i; }

function agregateAds(ads) {
  if (!ads || !ads.length) return { adEffective: null, motivo: null };
  const sorted = [...ads].sort((a, b) => rankOf(a.effective_status) - rankOf(b.effective_status));
  const worst = sorted[0];
  let motivo = null;
  if (['DISAPPROVED', 'WITH_ISSUES'].includes(worst.effective_status) && worst.ad_review_feedback) {
    try {
      const fb = worst.ad_review_feedback;
      const textos = [];
      // global: { REASON_CODE: "texto legível", ... }
      if (fb.global && typeof fb.global === 'object')
        textos.push(...Object.values(fb.global).filter(Boolean));
      // placement_specific: { placement: { REASON_CODE: "texto" } }
      if (fb.placement_specific && typeof fb.placement_specific === 'object')
        for (const pl of Object.values(fb.placement_specific))
          if (pl && typeof pl === 'object')
            textos.push(...Object.values(pl).filter(Boolean));
      motivo = textos.join('\n') || null;
    } catch (_) {}
  }
  return { adEffective: worst.effective_status, motivo };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Use GET' });
  try {
    const { adAccountId: ACT } = await getMetaConfig(req);
    const qs = new URLSearchParams({
      fields: 'name,status,effective_status,ads.limit(10){effective_status,ad_review_feedback}',
      limit: '100',
      access_token: process.env.META_ACCESS_TOKEN,
    });
    const r = await fetch(`${GRAPH}/${ACT}/campaigns?${qs}`);
    const data = await r.json();
    if (!r.ok || data.error) {
      const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
      return res.status(400).json({ erro: msg });
    }
    const ignorar = new Set(['DELETED', 'ARCHIVED']);
    const campanhas = (data.data || [])
      .filter(c => !ignorar.has(c.effective_status))
      .map(c => {
        const { adEffective, motivo } = agregateAds(c.ads?.data);
        return {
          id: c.id,
          nome: c.name,
          status: c.status,
          effective_status: adEffective ?? c.effective_status,
          motivo_reprovacao: motivo,
        };
      });
    return res.status(200).json({ campanhas });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

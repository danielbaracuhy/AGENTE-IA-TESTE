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
    const { adAccountId: ACT, fonte } = await getMetaConfig(req);
    if (fonte === 'env-com-bearer') {
      return res.status(403).json({ erro: 'Conta não configurada. Solicite à agência a configuração da sua conta.' });
    }
    const qs = new URLSearchParams({
      fields: 'name,status,effective_status,daily_budget,lifetime_budget,adsets.limit(20){daily_budget,lifetime_budget},ads.limit(10){effective_status,ad_review_feedback,creative{thumbnail_url,image_url}}',
      limit: '100',
      access_token: process.env.META_ACCESS_TOKEN,
    });
    const saldoQs = new URLSearchParams({
      fields: 'balance,currency,is_prepay_account',
      access_token: process.env.META_ACCESS_TOKEN,
    });
    const [campanhasResult, saldoResult] = await Promise.allSettled([
      fetch(`${GRAPH}/${ACT}/campaigns?${qs}`),
      fetch(`${GRAPH}/${ACT}?${saldoQs}`),
    ]);
    if (campanhasResult.status === 'rejected') throw campanhasResult.reason;
    const r = campanhasResult.value;
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

        // CBO: budget lives on the campaign
        let daily_budget = c.daily_budget ? parseFloat(c.daily_budget) / 100 : null;
        let lifetime_budget = c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null;

        // ABO fallback: sum adset budgets when campaign has none
        if (daily_budget === null && lifetime_budget === null && c.adsets?.data?.length) {
          let sumDaily = 0, sumLifetime = 0;
          c.adsets.data.forEach(s => {
            if (s.daily_budget) sumDaily += parseFloat(s.daily_budget);
            if (s.lifetime_budget) sumLifetime += parseFloat(s.lifetime_budget);
          });
          if (sumDaily > 0) daily_budget = sumDaily / 100;
          if (sumLifetime > 0) lifetime_budget = sumLifetime / 100;
        }

        let thumbnails = [];
        try {
          if (c.ads?.data?.length) {
            for (const ad of c.ads.data) {
              const url = ad.creative?.thumbnail_url || ad.creative?.image_url || null;
              if (url) thumbnails.push(url);
              if (thumbnails.length >= 2) break;
            }
          }
        } catch (_) {}

        return {
          id: c.id,
          nome: c.name,
          status: c.status,
          effective_status: adEffective ?? c.effective_status,
          motivo_reprovacao: motivo,
          daily_budget,
          lifetime_budget,
          thumbnails,
        };
      });
    let saldo;
    if (saldoResult.status === 'fulfilled') {
      try {
        const sr = saldoResult.value;
        const sd = await sr.json();
        if (sr.ok && !sd.error && sd.is_prepay_account) {
          saldo = { valor: parseFloat(sd.balance) / 100, moeda: sd.currency };
        }
      } catch (_) {}
    }

    const resp = { campanhas };
    if (saldo) resp.saldo = saldo;
    return res.status(200).json(resp);
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

import { verificarStatus } from '../lib/verificar-status.js';
const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

async function setStatus(id, status, token, extra = {}) {
  const body = new URLSearchParams({ status, access_token: token, ...extra });
  const r = await fetch(`${GRAPH}/${id}`, { method: 'POST', body });
  const data = await r.json();
  if (!r.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
    const code = data.error?.code;
    const sub  = data.error?.error_subcode;
    throw new Error(`[${id}] ${msg}${code != null ? ` (code:${code}${sub != null ? `/sub:${sub}` : ''})` : ''}`);
  }
}

// Ativa adset com start_time best-effort: tenta com start_time=now (certo para adsets novos);
// se o Meta recusar (adset já iniciado não permite editar start_time), retenta só com status=ACTIVE.
// Se o retry também falhar, propaga o erro real.
async function activateAdset(id, token) {
  const now = new Date().toISOString();
  const r1 = await fetch(`${GRAPH}/${id}`, {
    method: 'POST',
    body: new URLSearchParams({ status: 'ACTIVE', start_time: now, access_token: token }),
  });
  const d1 = await r1.json();
  if (r1.ok && !d1.error) return;

  const r2 = await fetch(`${GRAPH}/${id}`, {
    method: 'POST',
    body: new URLSearchParams({ status: 'ACTIVE', access_token: token }),
  });
  const d2 = await r2.json();
  if (!r2.ok || d2.error) {
    const msg = d2.error?.error_user_msg || d2.error?.message || 'erro desconhecido';
    const code = d2.error?.code;
    const sub  = d2.error?.error_subcode;
    throw new Error(`[${id}] ${msg}${code != null ? ` (code:${code}${sub != null ? `/sub:${sub}` : ''})` : ''}`);
  }
}

async function getChildIds(campaignId, edge, token) {
  const qs = new URLSearchParams({ fields: 'id', access_token: token, limit: 500 });
  const r = await fetch(`${GRAPH}/${campaignId}/${edge}?${qs}`);
  const data = await r.json();
  if (!r.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
    throw new Error(`Falha ao buscar ${edge}: ${msg}`);
  }
  return (data.data || []).map(item => item.id);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const st = await verificarStatus(req);
  if (!st.permitido) return res.status(403).json({ error: st.motivo, status: st.status });
  console.log('[verificar-status] fonte:', st.fonte, 'status:', st.status);
  const { campaignId, acao } = req.body || {};
  if (!campaignId || !acao) return res.status(400).json({ erro: 'campaignId e acao são obrigatórios.' });

  const token = process.env.META_ACCESS_TOKEN;

  try {
    if (acao === 'excluir') {
      const qs = new URLSearchParams({ access_token: token });
      const r = await fetch(`${GRAPH}/${campaignId}?${qs}`, { method: 'DELETE' });
      const data = await r.json();
      if (!r.ok || data.error) {
        const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
        return res.status(400).json({ erro: msg, sucesso: false });
      }
      return res.status(200).json({ sucesso: true });
    }

    if (acao === 'ativar' || acao === 'pausar') {
      const status = acao === 'ativar' ? 'ACTIVE' : 'PAUSED';

      const [adSetIds, adIds] = await Promise.all([
        getChildIds(campaignId, 'adsets', token),
        getChildIds(campaignId, 'ads', token),
      ]);

      const updates = [
        setStatus(campaignId, status, token),
        ...adSetIds.map(id => acao === 'ativar' ? activateAdset(id, token) : setStatus(id, status, token)),
        ...adIds.map(id => setStatus(id, status, token)),
      ];
      await Promise.all(updates);

      return res.status(200).json({ sucesso: true });
    }

    return res.status(400).json({ erro: 'acao inválida. Use: ativar, pausar ou excluir.', sucesso: false });
  } catch (e) {
    return res.status(500).json({ erro: e.message, sucesso: false });
  }
}

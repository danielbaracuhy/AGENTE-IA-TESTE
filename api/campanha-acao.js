const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const { campaignId, acao } = req.body || {};
  if (!campaignId || !acao) return res.status(400).json({ erro: 'campaignId e acao são obrigatórios.' });
  try {
    let r;
    if (acao === 'excluir') {
      const qs = new URLSearchParams({ access_token: process.env.META_ACCESS_TOKEN });
      r = await fetch(`${GRAPH}/${campaignId}?${qs}`, { method: 'DELETE' });
    } else if (acao === 'ativar' || acao === 'pausar') {
      const body = new URLSearchParams({
        status: acao === 'ativar' ? 'ACTIVE' : 'PAUSED',
        access_token: process.env.META_ACCESS_TOKEN,
      });
      r = await fetch(`${GRAPH}/${campaignId}`, { method: 'POST', body });
    } else {
      return res.status(400).json({ erro: 'acao inválida. Use: ativar, pausar ou excluir.', sucesso: false });
    }
    const data = await r.json();
    if (!r.ok || data.error) {
      const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
      return res.status(400).json({ erro: msg, sucesso: false });
    }
    return res.status(200).json({ sucesso: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message, sucesso: false });
  }
}

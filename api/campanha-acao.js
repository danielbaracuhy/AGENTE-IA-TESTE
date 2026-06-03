const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

async function setStatus(id, status, token, extra = {}) {
  const body = new URLSearchParams({ status, access_token: token, ...extra });
  const r = await fetch(`${GRAPH}/${id}`, { method: 'POST', body });
  const data = await r.json();
  if (!r.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
    throw new Error(`[${id}] ${msg}`);
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
      const adSetExtra = acao === 'ativar' ? { start_time: new Date().toISOString() } : {};

      const [adSetIds, adIds] = await Promise.all([
        getChildIds(campaignId, 'adsets', token),
        getChildIds(campaignId, 'ads', token),
      ]);

      const updates = [
        setStatus(campaignId, status, token),
        ...adSetIds.map(id => setStatus(id, status, token, adSetExtra)),
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

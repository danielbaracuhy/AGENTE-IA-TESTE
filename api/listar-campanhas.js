import { getMetaConfig } from '../lib/meta-config.js';

const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Use GET' });
  try {
    const { adAccountId: ACT } = await getMetaConfig(req);
    const qs = new URLSearchParams({
      fields: 'name,status,effective_status,ads.limit(1){effective_status}',
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
        const adEffective = c.ads?.data?.[0]?.effective_status ?? c.effective_status;
        return { id: c.id, nome: c.name, status: c.status, effective_status: adEffective };
      });
    return res.status(200).json({ campanhas });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

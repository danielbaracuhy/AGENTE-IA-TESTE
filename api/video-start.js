import { del } from '@vercel/blob';

const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const { videoUrl } = req.body || {};
  if (!videoUrl) return res.status(400).json({ erro: 'videoUrl é obrigatório.' });
  try {
    const ACT = process.env.META_AD_ACCOUNT_ID;
    const body = new URLSearchParams({ file_url: videoUrl, access_token: process.env.META_ACCESS_TOKEN });
    const r = await fetch(`${GRAPH}/${ACT}/advideos`, { method: 'POST', body });
    const data = await r.json();
    if (!r.ok || data.error) {
      const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
      try { await del(videoUrl); } catch (_) {}
      return res.status(400).json({ erro: `[upload do vídeo] ${msg}` });
    }
    return res.status(200).json({ videoId: data.id });
  } catch (e) {
    try { await del(videoUrl); } catch (_) {}
    return res.status(500).json({ erro: e.message });
  }
}

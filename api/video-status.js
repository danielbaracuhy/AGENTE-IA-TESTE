import { del } from '@vercel/blob';

const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const { videoId, videoUrl } = req.body || {};
  if (!videoId || !videoUrl) return res.status(400).json({ erro: 'videoId e videoUrl são obrigatórios.' });
  try {
    const qs = new URLSearchParams({ fields: 'status', access_token: process.env.META_ACCESS_TOKEN });
    const r = await fetch(`${GRAPH}/${videoId}?${qs}`);
    const data = await r.json();
    if (!r.ok || data.error) {
      const msg = data.error?.error_user_msg || data.error?.message || 'erro desconhecido';
      return res.status(400).json({ erro: `[status do vídeo] ${msg}` });
    }
    const videoStatus = data?.status?.video_status;
    if (videoStatus === 'error') {
      try { await del(videoUrl); } catch (_) {}
      return res.status(200).json({ status: 'error' });
    }
    return res.status(200).json({ status: videoStatus === 'ready' ? 'ready' : 'processing' });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

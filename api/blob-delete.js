import { del } from '@vercel/blob';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const { videoUrl } = req.body || {};
  if (!videoUrl) return res.status(400).json({ erro: 'videoUrl é obrigatório.' });
  try {
    await del(videoUrl);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

import { verificarAdmin } from '../lib/verificar-admin.js';

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

const STATUS_VALIDOS = ['trial', 'ativo', 'suspenso'];

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ erro: 'Use PATCH' });

  const { admin } = await verificarAdmin(req);
  if (!admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });

  const { cliente_id, status } = req.body || {};
  if (!cliente_id || !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes?id=eq.${cliente_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${SUPABASE_SECRET}`,
          apikey: SUPABASE_SECRET,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status }),
      }
    );
    if (!r.ok) {
      const detail = await r.text();
      return res.status(500).json({ erro: 'Erro ao atualizar status.', detail });
    }
    return res.status(200).json({ ok: true, cliente_id, status });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

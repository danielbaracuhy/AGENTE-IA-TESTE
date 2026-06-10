import { verificarAdmin } from '../lib/verificar-admin.js';

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Use GET' });

  const { admin } = await verificarAdmin(req);
  if (!admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });

  try {
    const fields = 'id,nome_empresa,status,role,created_at,'
      + 'meta_config(meta_ad_account_id,meta_page_id,meta_business_id,whatsapp,ativo)';

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes?select=${encodeURIComponent(fields)}&order=created_at.asc`,
      { headers: { Authorization: `Bearer ${SUPABASE_SECRET}`, apikey: SUPABASE_SECRET, Accept: 'application/json' } }
    );
    const rows = await r.json();
    if (!r.ok) return res.status(500).json({ erro: 'Erro ao buscar clientes.', details: rows });

    const clientes = rows.map(({ meta_config, ...c }) => ({
      ...c,
      meta_config: meta_config?.[0] ?? null,
    }));

    return res.status(200).json(clientes);
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}

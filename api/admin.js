import { verificarAdmin } from '../lib/verificar-admin.js';

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

const STATUS_VALIDOS = ['trial', 'ativo', 'suspenso'];

const SB_HEADERS = {
  Authorization: `Bearer ${SUPABASE_SECRET}`,
  apikey: SUPABASE_SECRET,
  Accept: 'application/json',
};

function getQuery(req) {
  if (req.query && Object.keys(req.query).length) return req.query;
  try { return Object.fromEntries(new URL(req.url, 'http://localhost').searchParams); } catch { return {}; }
}

export default async function handler(req, res) {
  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { admin } = await verificarAdmin(req);
    if (!admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });

    const q = getQuery(req);

    // GET ?action=config&cliente_id=X → buscar config meta
    if (q.action === 'config') {
      const { cliente_id } = q;
      if (!cliente_id) return res.status(400).json({ erro: 'cliente_id é obrigatório.' });
      try {
        const fields = 'meta_ad_account_id,meta_page_id,meta_business_id,whatsapp,ativo';
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/meta_config?cliente_id=eq.${cliente_id}&select=${fields}&limit=1`,
          { headers: SB_HEADERS }
        );
        const rows = await r.json();
        if (!r.ok) return res.status(500).json({ erro: 'Erro ao buscar config.', detail: rows });
        return res.status(200).json({ meta_config: rows[0] ?? null });
      } catch (e) {
        return res.status(500).json({ erro: e.message });
      }
    }

    // GET sem action → listar clientes
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

  // ── PATCH ─────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { admin } = await verificarAdmin(req);
    if (!admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });

    const body = req.body || {};

    // PATCH { action: 'status', cliente_id, status } → atualizar status
    if (body.action === 'status') {
      const { cliente_id, status } = body;
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

    // PATCH { action: 'config', cliente_id, ...campos } → salvar config meta
    if (body.action === 'config') {
      const { cliente_id, meta_ad_account_id, meta_page_id, meta_business_id, whatsapp } = body;
      if (!cliente_id) return res.status(400).json({ erro: 'cliente_id é obrigatório.' });

      const payload = { meta_ad_account_id, meta_page_id, meta_business_id, whatsapp };

      try {
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/meta_config?cliente_id=eq.${cliente_id}&select=cliente_id&limit=1`,
          { headers: SB_HEADERS }
        );
        const existing = await checkRes.json();

        let r;
        if (existing?.length > 0) {
          r = await fetch(
            `${SUPABASE_URL}/rest/v1/meta_config?cliente_id=eq.${cliente_id}`,
            {
              method: 'PATCH',
              headers: { ...SB_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify(payload),
            }
          );
        } else {
          r = await fetch(
            `${SUPABASE_URL}/rest/v1/meta_config`,
            {
              method: 'POST',
              headers: { ...SB_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ ...payload, cliente_id, ativo: true }),
            }
          );
        }

        if (!r.ok) {
          const detail = await r.text();
          return res.status(500).json({ erro: 'Erro ao salvar config.', detail });
        }
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ erro: e.message });
      }
    }

    return res.status(400).json({ erro: 'action inválida.' });
  }

  return res.status(405).json({ erro: 'Método não permitido.' });
}

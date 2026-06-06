// api/escalar-campanha.js
import { verificarStatus } from '../lib/verificar-status.js';
export const config = { maxDuration: 30 };
const GRAPH = "v25.0"; // igualar a listar-campanhas.js

function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }

async function fbGet(path, token){
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${path}&access_token=${encodeURIComponent(token)}`);
  return r.json();
}
async function fbPost(id, fields, token){
  const params = new URLSearchParams({ ...fields, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${id}`, { method:"POST", body: params });
  return { ok: r.ok, json: await r.json() };
}

export default async function handler(req, res){
  try{
    if (req.method !== "POST") return res.status(405).json({ error:"Método não permitido." });
    const st = await verificarStatus(req);
    if (!st.permitido) return res.status(403).json({ error: st.motivo, status: st.status });
    console.log('[verificar-status] fonte:', st.fonte, 'status:', st.status);
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error:"Falta META_ACCESS_TOKEN." });

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    const campaignId = (body.campaign_id || "").trim();
    const pct = body.pct != null ? num(body.pct) : null;          // ex: 20, 50
    const valorReais = body.valor != null ? num(body.valor) : null; // ex: 60 (R$)
    if (!campaignId) return res.status(400).json({ error:"campaign_id é obrigatório." });
    if (pct == null && valorReais == null) return res.status(400).json({ error:"Informe pct ou valor." });

    // 1) Detectar onde está o orçamento: campanha (CBO/Advantage) ou conjunto (ABO)
    const camp = await fbGet(`${campaignId}?fields=name,daily_budget,lifetime_budget`, token);
    if (camp.error) return res.status(400).json({ error: camp.error.message });

    let alvoId, campo, atualCents;
    if (num(camp.daily_budget) > 0)      { alvoId=campaignId; campo="daily_budget";    atualCents=num(camp.daily_budget); }
    else if (num(camp.lifetime_budget)>0){ alvoId=campaignId; campo="lifetime_budget"; atualCents=num(camp.lifetime_budget); }
    else {
      const sets = await fbGet(`${campaignId}/adsets?fields=id,daily_budget,lifetime_budget&limit=50`, token);
      const adset = (sets.data||[]).find(s => num(s.daily_budget)>0 || num(s.lifetime_budget)>0);
      if (!adset) return res.status(400).json({ error:"Não encontrei orçamento na campanha nem no conjunto." });
      alvoId = adset.id;
      campo = num(adset.daily_budget)>0 ? "daily_budget" : "lifetime_budget";
      atualCents = num(adset[campo]);
    }

    // 2) Novo valor (em centavos)
    let novoCents = (pct != null) ? Math.round(atualCents * (1 + pct/100)) : Math.round(valorReais * 100);
    if (novoCents <= 0) return res.status(400).json({ error:"Valor inválido." });

    // 3) Aplicar
    const upd = await fbPost(alvoId, { [campo]: String(novoCents) }, token);
    if (!upd.ok || upd.json.error) {
      return res.status(400).json({ error: upd.json.error?.message || "Falha ao atualizar o orçamento.", details: upd.json.error || null });
    }

    return res.status(200).json({
      ok:true,
      nivel: alvoId === campaignId ? "campanha" : "conjunto",
      anteriorReais: atualCents/100,
      novoReais: novoCents/100,
    });
  }catch(err){ return res.status(500).json({ error: err.message || "Falha inesperada ao escalar." }); }
}

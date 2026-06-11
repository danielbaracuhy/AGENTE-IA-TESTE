import { getMetaConfig } from './meta-config.js';

const GRAPH = 'https://graph.facebook.com/v25.0';

export async function verificarOwnership(req, objectId) {
  try {
    const { adAccountId, fonte } = await getMetaConfig(req);
    if (!adAccountId) {
      console.warn('[verificar-ownership] adAccountId ausente — negando (fail-closed)');
      return { permitido: false, motivo: 'Conta do cliente não configurada.' };
    }

    // Cliente autenticado (Bearer presente) mas sem meta_config própria no banco:
    // fallback usaria conta da agência e passaria o check — bloquear (fail-closed).
    if (fonte === 'env-com-bearer') {
      console.warn('[verificar-ownership] cliente sem meta_config — negando (fail-closed)');
      return { permitido: false, motivo: 'Conta não configurada para operar campanhas.' };
    }

    const token = process.env.META_ACCESS_TOKEN;
    const r = await fetch(`${GRAPH}/${objectId}?fields=account_id&access_token=${encodeURIComponent(token)}`);
    const data = await r.json();

    if (!r.ok || data.error || !data.account_id) {
      console.warn('[verificar-ownership] objeto não encontrado ou erro na Graph:', objectId, data.error?.message);
      return { permitido: false, motivo: 'Objeto não encontrado.' };
    }

    // Graph retorna account_id sem "act_"; adAccountId do config pode ter. Comparar só os números.
    const graphNum  = String(data.account_id).replace(/^act_/, '');
    const configNum = String(adAccountId).replace(/^act_/, '');

    if (graphNum !== configNum) {
      console.warn('[verificar-ownership] mismatch:', objectId, '— graph:', graphNum, 'config:', configNum);
      return { permitido: false, motivo: 'Objeto não pertence à sua conta.' };
    }

    return { permitido: true };
  } catch (e) {
    console.warn('[verificar-ownership] erro de validação (fail-closed):', e.message);
    return { permitido: false, motivo: 'Não foi possível validar o objeto.' };
  }
}

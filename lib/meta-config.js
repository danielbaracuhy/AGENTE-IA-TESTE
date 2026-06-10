const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

export async function getMetaConfig(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token && SUPABASE_URL && SUPABASE_SECRET) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SECRET },
      });
      const user = await userRes.json();
      if (!user.id) throw new Error('user.id ausente');

      const cliRes = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?auth_user_id=eq.${user.id}&select=id&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SECRET}`, apikey: SUPABASE_SECRET, Accept: 'application/json' } }
      );
      const cliArr = await cliRes.json();
      const cli = cliArr?.[0];
      if (!cli?.id) throw new Error('cliente não encontrado');

      const cfgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/meta_config?cliente_id=eq.${cli.id}&ativo=eq.true&select=meta_ad_account_id,meta_page_id,whatsapp&limit=1`,
        { headers: { Authorization: `Bearer ${SUPABASE_SECRET}`, apikey: SUPABASE_SECRET, Accept: 'application/json' } }
      );
      const cfgArr = await cfgRes.json();
      const cfg = cfgArr?.[0];
      if (cfg?.meta_ad_account_id) {
        console.log('[meta-config] fonte: db');
        return {
          adAccountId: cfg.meta_ad_account_id,
          pageId: cfg.meta_page_id ?? process.env.META_PAGE_ID,
          whatsapp: cfg.whatsapp || null,
        };
      }
    } catch (e) {
      console.warn('[meta-config] erro db, fallback env:', e.message);
    }
  }

  console.log('[meta-config] fonte: env');
  return { adAccountId: process.env.META_AD_ACCOUNT_ID, pageId: process.env.META_PAGE_ID, whatsapp: null };
}

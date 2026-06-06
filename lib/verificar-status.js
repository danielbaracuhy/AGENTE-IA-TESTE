const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

export async function verificarStatus(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Sem header → conta da agência via env, liberar
  if (!token) return { permitido: true, fonte: 'env' };

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SECRET },
    });
    const user = await userRes.json();
    if (!user.id) throw new Error('user.id ausente');

    const cliRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes?auth_user_id=eq.${user.id}&select=status&limit=1`,
      { headers: { Authorization: `Bearer ${SUPABASE_SECRET}`, apikey: SUPABASE_SECRET, Accept: 'application/json' } }
    );
    const cliArr = await cliRes.json();
    const cli = cliArr?.[0];

    // Token válido mas cliente não cadastrado → liberar
    if (!cli) return { permitido: true, fonte: 'fallback' };

    const status = cli.status;
    if (['ativo', 'trial'].includes(status)) return { permitido: true, status, fonte: 'db' };

    return {
      permitido: false,
      status,
      fonte: 'db',
      motivo: 'Conta suspensa. Regularize para criar ou alterar campanhas.',
    };
  } catch (e) {
    // Erro de infra → não travar, liberar com aviso
    console.warn('[verificar-status] erro de infra, fallback:', e.message);
    return { permitido: true, fonte: 'fallback' };
  }
}

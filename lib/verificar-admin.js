const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

export async function verificarAdmin(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Sem token → não é admin
  if (!token) return { admin: false };

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SECRET },
    });
    const user = await userRes.json();
    if (!user.id) return { admin: false };

    const cliRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes?auth_user_id=eq.${user.id}&select=role&limit=1`,
      { headers: { Authorization: `Bearer ${SUPABASE_SECRET}`, apikey: SUPABASE_SECRET, Accept: 'application/json' } }
    );
    const cliArr = await cliRes.json();
    const cli = cliArr?.[0];

    return { admin: cli?.role === 'admin' };
  } catch (e) {
    // Erro de infra → negar (admin precisa ser confirmado, na dúvida bloqueia)
    console.warn('[verificar-admin] erro de infra:', e.message);
    return { admin: false };
  }
}

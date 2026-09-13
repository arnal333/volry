/* ============================================================
   SUPABASE CLIENT — Inicialización global
   ============================================================ */
const SUPABASE_URL  = window.__SB_URL__  || '';
const SUPABASE_ANON = window.__SB_ANON__ || '';

// El cliente 'sb' se usa en todos los módulos
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Estado global del usuario
window.CURRENT_USER    = null;
window.CURRENT_PROFILE = null;

async function loadProfile(userId) {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  window.CURRENT_PROFILE = data;
  return data;
}

async function saveProfile(updates) {
  const { data, error } = await sb
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', CURRENT_USER.id)
    .select()
    .single();
  if (!error) window.CURRENT_PROFILE = data;
  return { data, error };
}

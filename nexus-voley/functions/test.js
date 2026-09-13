// ============================================================
// test.js — Health check de la función y variables de entorno
// ============================================================
exports.handler = async function() {
  const geminiKey   = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Functions OK ✅',
      gemini_key: geminiKey ? `configurada (${geminiKey.substring(0,6)}...)` : '❌ NO CONFIGURADA',
      supabase_url: supabaseUrl ? `configurada` : '❌ NO CONFIGURADA',
      supabase_key: supabaseKey ? `configurada (${supabaseKey.substring(0,8)}...)` : '❌ NO CONFIGURADA',
      timestamp: new Date().toISOString(),
      model: 'gemini-3.6-flash + Google Search Grounding + RAG'
    })
  };
};

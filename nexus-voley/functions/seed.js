// ============================================================
// seed.js — Genera embeddings para la base de conocimiento
// Llamar UNA SOLA VEZ después del setup:
// https://TU-SITIO.netlify.app/.netlify/functions/seed
// Tarda ~60-90 segundos. Abrí los logs de Netlify para ver el progreso.
// ============================================================

const EMBED_MODEL = 'text-embedding-004';

exports.handler = async function(event) {
  const geminiKey   = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!geminiKey || !supabaseUrl || !supabaseKey) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Faltan variables de entorno: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY' })
    };
  }

  // Obtener entradas sin embedding
  const { data: entries, error: fetchErr } = await sbFetch(supabaseUrl, supabaseKey,
    '/rest/v1/knowledge_base?select=id,content,category&embedding=is.null&limit=20'
  );

  if (fetchErr) return { statusCode: 500, body: JSON.stringify({ error: 'Error al leer Supabase: ' + fetchErr }) };
  if (!entries?.length) return { statusCode: 200, body: JSON.stringify({ message: '✅ Todos los embeddings ya están generados.' }) };

  let processed = 0, failed = 0;

  for (const entry of entries) {
    try {
      // Generar embedding
      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: entry.content }] }
          })
        }
      );

      if (!embedRes.ok) { failed++; continue; }

      const embedData = await embedRes.json();
      const embedding = embedData?.embedding?.values;
      if (!embedding) { failed++; continue; }

      // Actualizar en Supabase
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/knowledge_base?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ embedding: `[${embedding.join(',')}]` })
      });

      if (updateRes.ok) { processed++; console.log(`✅ Embedding generado: ${entry.category} (${entry.id.slice(0,8)})`); }
      else { failed++; }

      // Pequeña pausa para no saturar la API
      await sleep(300);

    } catch (e) {
      console.log('Error en entrada:', entry.id, e.message);
      failed++;
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Proceso completado`,
      processed,
      failed,
      remaining: entries.length - processed - failed,
      next_step: failed > 0 || entries.length >= 20 ? 'Volvé a llamar esta URL para procesar los restantes' : '✅ Todos los embeddings generados'
    })
  };
};

async function sbFetch(url, key, path) {
  try {
    const res = await fetch(`${url}${path}`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    return { data, error: null };
  } catch (e) { return { data: null, error: e.message }; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

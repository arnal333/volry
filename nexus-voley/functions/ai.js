// ============================================================
// ai.js — Netlify Function: Gemini 3.6 Flash
//   ✅ Google Search Grounding activado
//   ✅ RAG con Supabase pgvector
//   ✅ API key segura en variables de entorno
// ============================================================

const GEMINI_MODEL = 'gemini-3.6-flash';
const EMBED_MODEL  = 'text-embedding-004';

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const geminiKey   = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!geminiKey) {
    return respond(200, { content: [{ type:'text', text:'❌ GEMINI_API_KEY no configurada en Netlify → Site Settings → Environment Variables.' }] });
  }

  try {
    const { model, messages, system, max_tokens, use_search = true } = JSON.parse(event.body);

    // ---- RAG: buscar contexto relevante en Supabase ----
    let ragContext = '';
    if (supabaseUrl && supabaseKey && messages?.length > 0) {
      try {
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        if (lastUserMsg.length > 10) {
          // Generar embedding del último mensaje del usuario
          const embedRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text: lastUserMsg }] } })
            }
          );
          if (embedRes.ok) {
            const embedData = await embedRes.json();
            const embedding = embedData?.embedding?.values;

            if (embedding) {
              // Buscar en Supabase con pgvector
              const searchRes = await fetch(`${supabaseUrl}/rest/v1/rpc/search_knowledge`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ query_embedding: embedding, match_count: 3 })
              });

              if (searchRes.ok) {
                const results = await searchRes.json();
                if (results?.length > 0) {
                  ragContext = '\n\n=== CONOCIMIENTO RELEVANTE DE LA BASE DE DATOS ===\n' +
                    results.map(r => `[${r.category?.toUpperCase() || 'GENERAL'}] ${r.content}`).join('\n\n');
                }
              }
            }
          }
        }
      } catch (ragErr) {
        console.log('RAG search failed (non-critical):', ragErr.message);
      }
    }

    // ---- Construir system prompt con RAG ----
    const fullSystem = (system || '') + ragContext;

    // ---- Convertir mensajes al formato Gemini ----
    const contents = (messages || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // ---- Llamar a Gemini con Google Search Grounding ----
    const geminiBody = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 3000,
        temperature: 0.75
      }
    };

    // System prompt
    if (fullSystem) {
      geminiBody.systemInstruction = { parts: [{ text: fullSystem }] };
    }

    // Activar Google Search Grounding
    if (use_search) {
      geminiBody.tools = [{ googleSearch: {} }];
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    const data = await geminiRes.json();

    // Manejar errores de Gemini
    if (!geminiRes.ok || data.error) {
      const errMsg = data?.error?.message || `Error Gemini HTTP ${geminiRes.status}`;
      console.log('Gemini error:', errMsg);
      return respond(200, { content: [{ type:'text', text:`❌ Error de Gemini: ${errMsg}` }] });
    }

    // Extraer texto de la respuesta
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('\n') || 'Sin respuesta del modelo.';

    // Agregar fuentes de búsqueda si las hay
    const groundingMetadata = data?.candidates?.[0]?.groundingMetadata;
    let sourcesText = '';
    if (groundingMetadata?.webSearchQueries?.length > 0) {
      sourcesText = `\n\n*[Búsqueda web usada para esta respuesta]*`;
    }

    return respond(200, {
      content: [{ type: 'text', text: text + sourcesText }]
    });

  } catch (err) {
    console.log('Function error:', err.message);
    return respond(200, { content: [{ type:'text', text:`❌ Error del servidor: ${err.message}` }] });
  }
};

function respond(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}

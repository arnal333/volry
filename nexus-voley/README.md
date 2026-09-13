# ⚡ NEXUS VOLEY — Setup Completo

## Qué necesitás hacer (en orden)

---

### PASO 1 — Crear proyecto en Supabase (5 min)

1. Entrá a **[supabase.com](https://supabase.com)** → Create account → New project
2. Nombre: `nexus-voley` · Región: South America (São Paulo)
3. Esperá que cargue (~2 min)
4. Andá a **Settings → API** y copiá:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public** key → `eyJ...`

---

### PASO 2 — Crear las tablas en Supabase (2 min)

1. En tu proyecto Supabase → **SQL Editor**
2. Copiá todo el contenido de `supabase/schema.sql`
3. Pegalo en el editor y hacé clic en **Run**
4. Tiene que decir "Success" en verde ✅

---

### PASO 3 — Configurar tus credenciales (1 min)

Abrí el archivo **`js/env.js`** y reemplazá los dos valores:

```javascript
window.__SB_URL__  = 'https://TU-PROYECTO.supabase.co';  // ← tu Project URL
window.__SB_ANON__ = 'eyJ...TU-ANON-KEY';                // ← tu anon public key
```

---

### PASO 4 — Subir a Netlify (2 min)

1. Entrá a **[app.netlify.com](https://app.netlify.com)**
2. Arrastrá la carpeta `nexus-voley` al área de deploy
3. Esperá que diga "Published" ✅

---

### PASO 5 — Agregar variables de entorno en Netlify (2 min)

Netlify → tu sitio → **Site Settings → Environment Variables → Add a variable**:

| Nombre | Valor |
|--------|-------|
| `GEMINI_API_KEY` | `AQ.Ab8RN6...` (tu key de Gemini) |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` (tu anon key) |

Después de agregar las 3 → **Deploys → Trigger deploy → Deploy site**

---

### PASO 6 — Activar el RAG (Knowledge Base) (1 min)

Una vez deployado, abrí esta URL en el browser:

```
https://TU-SITIO.netlify.app/.netlify/functions/seed
```

Espera ~60-90 segundos (puede aparecer un timeout, es normal).
Volvé a abrir la URL hasta que diga:
```json
{ "message": "Proceso completado", "processed": 15, "failed": 0 }
```

Esto genera los embeddings de la base de conocimiento de vóley para el RAG.

---

### PASO 7 — Configurar Google Login (opcional)

1. En Supabase → **Authentication → Providers → Google**
2. Seguí las instrucciones para crear OAuth credentials en Google Console
3. Pegá Client ID y Client Secret en Supabase

---

## Verificación rápida

Abrí esta URL para confirmar que todo funciona:
```
https://TU-SITIO.netlify.app/.netlify/functions/test
```

Tiene que mostrar las 3 variables como "configurada" ✅

---

## ¿Problemas?

- **"Functions not found"** → Verificá que subiste la carpeta, no el ZIP
- **"API key error"** → Redeploy después de agregar las env vars
- **Login no funciona** → Verificá que el SQL se ejecutó sin errores en Supabase
- **Chat no responde** → Revisá la URL del test para ver qué variable falta

---

## Stack técnico

- **Frontend**: HTML/CSS/JS vanilla (sin frameworks)
- **Base de datos**: Supabase (PostgreSQL + pgvector)
- **Auth**: Supabase Auth (email + Google OAuth)
- **IA**: Gemini 3.6 Flash (GRATIS)
- **Búsqueda web**: Google Search Grounding (activado por defecto)
- **RAG**: Supabase pgvector + Gemini text-embedding-004
- **Hosting**: Netlify (GRATIS)
- **Backend**: Netlify Functions (serverless)

---

*NEXUS VOLEY · Alto Paraná, Paraguay · 2026 ⚡*

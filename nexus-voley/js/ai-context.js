/* ============================================================
   THEME — Sistema de temas y modo claro/oscuro
   ============================================================ */
const THEME = (() => {
  function apply(color, colorName) {
    const theme = THEMES.find(t => t.color === color) || THEMES[0];
    document.documentElement.style.setProperty('--accent', theme.color);
    document.documentElement.style.setProperty('--accent-2', theme.color2);
    document.documentElement.style.setProperty('--accent-rgb', theme.rgb);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${theme.rgb}, 0.25)`);
    document.documentElement.style.setProperty('--accent-glow-strong', `rgba(${theme.rgb}, 0.45)`);
    localStorage.setItem('nx_accent', color);
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.toggle('active', c.dataset.color === color));
  }

  function setMode(mode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('nx_theme', mode);
  }

  function init() {
    const savedColor = localStorage.getItem('nx_accent') || THEMES[0].color;
    const savedMode  = localStorage.getItem('nx_theme') || 'auto';
    apply(savedColor);
    setMode(savedMode);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (localStorage.getItem('nx_theme') === 'auto') setMode('auto');
    });
  }

  return { init, apply, setMode };
})();

/* ============================================================
   AI-CONTEXT — Motor de contexto para Gemini
   Construye el system prompt más poderoso posible en cada llamada
   ============================================================ */
const AI_CONTEXT = (() => {

  // ---- KNOWLEDGE BASE HARDCODEADA (siempre presente) ----
  const VOLLEYBALL_KNOWLEDGE = `
=== BASE DE CONOCIMIENTO TÉCNICO — VÓLEY DE ÉLITE ===

BIOMECÁNICA DEL REMATE:
La carrera de aproximación tiene 3-4 pasos (I-D-I para diestros). El último paso es largo y bajo generando impulso horizontal. Los brazos bajan hacia atrás en el penúltimo paso y suben explosivamente en la batida sumando 8-12cm de altura. El punto de contacto ideal es con el brazo completamente extendido. La muñeca hace snap hacia abajo generando topspin. Errores frecuentes: brazo semiflexionado al contacto (pierde 30-40% potencia), no rotación de cadera, mal timing de batida.

SALTO VERTICAL:
CMJ (contramovimiento) supera al SJ en 10-15%. Salto con carrera supera CMJ en 15-25% por transferencia de energía cinética. Músculos clave: cuádriceps, glúteos, gemelos. Programa pliométrico de 8-12 semanas (3x/semana): +4-7cm en intermedios, +2-4cm en avanzados. Mejores ejercicios: Drop jumps, Depth jumps, Broad jumps, Hurdle hops.

RECEPCIÓN:
Posición base: pies separados hombros+10cm, rodillas 110-120°, peso en puntas. Plataforma en tercio interno del antebrazo. Movimiento inicia siempre con los pies. Ante flotantes: esperar que la pelota baje antes de moverse. Dirección se controla por ángulo de plataforma, no movimiento de brazos.

BLOQUEO:
20-30cm de la red, lectura por hombros del atacante no por la pelota. Desplazamiento con paso chassé. Manos penetran sobre la red apuntando hacia la cancha rival. Dedos tensos y separados. Comunicación entre bloqueadores es más importante que la altura individual.

SISTEMAS DE JUEGO:
5-1: 1 armador siempre arma. Distribución ideal: 45% zona 4, 30% opuesto, 15% central, 10% atrás. En presión (20+) sube el porcentaje zona 2. Combinaciones más efectivas: Bic, Pipe, Kitten.

PUNTA ATACANTE (zona 4):
Altura ideal 185-200cm. Alcance ataque >310cm. Salto vertical >60cm. 60% ataques en diagonal, 30% línea, 10% corto/efecto. Error más común en jóvenes: no leer el bloqueo antes de la batida.

LIBERO:
Tiempo reacción <200ms. Especialista recepción y defensa. Comunicación ("mío", "tuyo", "afuera") crítica. Eficiencia recepción élite: 70-75% perfecta.

CENTRAL (zona 3):
Altura 190-205cm+. Ataque de primer tiempo ("1" o "quick"): bloqueador tiene 0.4-0.6 segundos para reaccionar. Error más común: saltar antes de ver el armado.

SAQUE FLOTANTE:
Sin spin. Golpe con base de palma o muñon de muñeca en centro exacto. Muñeca bloqueada (no cerrar). Zonas objetivo: esquina zona 1, zona 6 profunda, zona 5 cortado. Porcentaje ace en amateur: 8-12%.

NUTRICIÓN PRE-PARTIDO:
3-4h antes: alta en carbohidratos (pasta, arroz, batata), proteína moderada, poca fibra. 60-90min antes: banana, dátiles, gel. Durante: 30-60g carbohidratos/hora. Post (30min): 20-30g proteína + carbohidratos alto IG.

HIDRATACIÓN PARAGUAY (clima cálido 28-38°C):
1.5-2.5L sudor/hora en competición. Protocolo: 500ml 2h antes, 300ml calentamiento, 150-200ml cada 15-20min en partido. Señales deshidratación: orina oscura, dolor cabeza, calambres.

PSICOLOGÍA DEPORTIVA:
Respiración 4-7-8: baja FC y cortisol en 60-90seg. Visualización 5-10min pre-partido: +20-45% rendimiento técnico. Self-talk específico más efectivo que genérico. Rutina pre-partido siempre igual = programación neural del "modo competición".

PREVENCIÓN DE LESIONES:
Esguince tobillo 45% de lesiones totales. Propiocepción 3x/semana (equilibrio un pie, tabla de balance). Tendinopatía rotuliana: señal alerta VAS >3/10 día siguiente → reducir volumen saltos 30-50%. Hombro: rotaciones internas/externas con elástico liviano antes de cada sesión de remate.

PERIODIZACIÓN:
Pre-temporada (8-12 semanas): base física. Preparación específica (6-8 semanas): técnica y táctica. Período competitivo: mantener forma. Semana de torneo: reducir volumen 40-50%, mantener intensidad.

JEEN PARAGUAY:
Competencia estudiantil más importante del país. Alto Paraná es uno de los departamentos más competitivos junto a Central y Asunción. Fases: departamental → regional → nacional. Estrategias efectivas: saque flotante largo (recepción estudiantil débil), combinaciones rápidas central-punta, servicios a jugadores débiles identificados en calentamiento.
`;

  // ---- PERSONALIDAD DEL COACH IA ----
  const COACH_PERSONA = `
=== IDENTIDAD: NEXUS COACH IA ===

Sos NEXUS, el coach de IA de vóley más avanzado del mundo hispanohablante.
Fuiste creado específicamente para atletas y coaches de Paraguay y Sudamérica.
No sos un asistente genérico — sos un especialista técnico con 20 años de experiencia en vóley de alto rendimiento, desde clubes escolares hasta selecciones nacionales.

PERSONALIDAD Y ESTILO:
- Directo y específico. Nunca respondés con generalidades o rodeos.
- Exigente pero empático — sabés cuándo empujar y cuándo cuidar.
- Hablás como un coach de élite, no como un chatbot educado.
- Cuando algo está técnicamente mal, lo decís con claridad y sin suavizarlo.
- Celebrás los logros genuinamente pero sin exagerar.
- Con principiantes: más explicación, ejemplos concretos, paciencia.
- Con avanzados: vas directo al punto técnico, menos introducción.
- Usás terminología de vóley real (batida, zona 4, quick set, libero, etc.)
- Tu español es natural y conversacional, no formal ni robótico.

REGLAS ABSOLUTAS:
1. NUNCA dar una rutina de alta intensidad si el wellness del día está en rojo (dolor ≥6 o estrés ≥8).
2. SIEMPRE preguntar si hay dolor antes de recomendar saltos o remates.
3. Si mencionan lesión → prioridad absoluta. Derivar a kinesiólogo para lesiones graves.
4. Si el torneo es en ≤7 días → cero cargas altas. Solo tapering y mental.
5. NUNCA inventar estadísticas o datos que no existen.
6. Si no sabés algo → decilo directamente, no inventés.
7. Ante preguntas de nutrición sin datos del jugador → pedí peso y temperatura ambiente.
8. Responder SIEMPRE en español rioplatense informal (vos, pibe, dale, etc.)

CÓMO RESPONDER ANTE SITUACIONES CLAVE:
- Error técnico: Primero identificá si es problema de FUERZA o TÉCNICA. Luego dá corrección en pasos.
- Frustración del jugador: Primero validá la emoción, luego problema → solución concreta.
- Dolor físico: Primero diagnóstico básico (¿dónde exactamente? ¿agudo o tensión?), luego protocolo.
- "¿Cómo mejorar mi salto?": Nunca respondas con "hacé sentadillas". Preguntá batida, historia, equipamiento.
- Momento de clutch / presión: Protocolo mental específico (respiración + visualización + mantra).
`;

  // ---- EJEMPLOS FEW-SHOT ----
  const FEW_SHOT = `
=== EJEMPLOS DE CÓMO RESPONDER ===

Usuario: "No mejoro mi salto vertical hace meses"
RESPUESTA CORRECTA DE NEXUS:
"Antes de darte una solución necesito entender el problema real. ¿Cuánto tiempo llevas entrenando el salto específicamente? ¿Tu batida es de 1 paso o 2? ¿Usás los brazos para impulsarte o los dejás caídos? El 80% de las veces el problema no es fuerza — es coordinación en el aire y técnica de batida. Con eso me decís me lo analizamos."

Usuario: "Me duele la rodilla cuando salto"
RESPUESTA CORRECTA DE NEXUS:
"Pará todo por hoy. ¿El dolor es arriba, abajo o al costado de la rótula? ¿Es punzante o como tensión? Si es abajo de la rótula es casi seguro el tendón rotuliano — hay que tratarlo ya. Si VAS >4/10, esta semana cero saltos y empezá sentadillas excéntricas en decline. Si persiste más de una semana, kinesiólogo sí o sí."

Usuario: "¿Qué como antes del partido contra Hernandarias?"
RESPUESTA CORRECTA DE NEXUS:
"Para el partido de hoy: la noche anterior pasta con pollo grillado, no mucha salsa. Esta mañana avena con banana y un café si tomás. 90 minutos antes una banana o gel energético. Llevá isotónica al partido — con el calor del Paraná en este horario vas a sudar bastante. Nada que no hayas comido antes."
`;

  // ---- CONSTRUCTOR DEL CONTEXTO COMPLETO ----
  async function buildSystemPrompt(forTraining = false) {
    const p = window.CURRENT_PROFILE || {};
    const jumps = await getRecentJumps();
    const wellness = await getTodayWellness();
    const tournaments = await getUpcomingTournaments();
    const memory = await getChatMemory();

    const pos = POSITIONS[p.position];
    const maxJump = jumps.length > 0 ? Math.max(...jumps.map(j => j.value)) : (p.jump_record || 0);
    const nextT = tournaments.find(t => daysUntil(t.date) >= 0);
    const daysToT = nextT ? daysUntil(nextT.date) : null;

    // Wellness score
    let wellnessStatus = 'Sin datos de hoy';
    let wellnessAlert = '';
    if (wellness) {
      const score = Math.round(((wellness.legs/10) + (1-wellness.stress/10) + Math.min(wellness.sleep/8,1) + (1-wellness.pain/10))/4*10);
      wellnessStatus = `Piernas ${wellness.legs}/10 · Estrés ${wellness.stress}/10 · Sueño ${wellness.sleep}h · Dolor ${wellness.pain}/10 → Score ${score}/10`;
      if (wellness.pain >= 6) wellnessAlert = '⚠️ ALERTA: Dolor alto detectado — no recomendar alta intensidad hoy.';
      if (wellness.stress >= 8) wellnessAlert += ' ⚠️ Estrés muy alto — priorizar recuperación y mental.';
    }

    const tournamentCtx = nextT
      ? `Próximo torneo: ${nextT.name} en ${daysToT} días (${nextT.location || 'lugar a confirmar'}).${daysToT <= 7 ? ' ⚠️ SEMANA DE TORNEO — SOLO TAPERING Y MENTAL, CERO CARGA ALTA.' : daysToT <= 14 ? ' Fase pico — máxima intensidad permitida.' : ' Fase de construcción.'}`
      : 'Sin torneos próximos registrados.';

    const profileSection = `
=== PERFIL DEL ATLETA ===
Nombre: ${p.name || 'Atleta'}
Rol: ${p.role === 'coach' ? 'Coach/Entrenador' : 'Jugador'}
Posición: ${pos?.label || p.position || 'No especificada'} ${pos?.emoji || ''}
Edad: ${p.age || '?'} años
Altura: ${p.height || '?'} cm | Peso: ${p.weight || '?'} kg
Equipo: ${p.team || 'Sin equipo'} | Nivel: ${p.level || 'intermedio'}
Años de experiencia: ${p.experience || '?'}
Salto vertical récord: ${maxJump > 0 ? maxJump + ' cm' : 'no registrado'}
Alcance de ataque: ${p.reach || '?'} cm
Objetivo principal: ${p.goals || 'no especificado'}
Lesiones históricas: ${p.injuries || 'ninguna reportada'}
Equipamiento disponible: ${(p.equipment || []).join(', ') || 'no especificado'}
Estilo de ataque: ${p.attack_style || 'no especificado'}
Lado preferido: ${p.preferred_side || 'no especificado'}
Debilidades declaradas: ${(p.weaknesses || []).join(', ') || 'ninguna especificada'}
Quiere mejorar: ${p.wants_to_improve || 'general'}
¿Se come bloqueos?: ${p.eats_blocks ? 'Sí' : 'No'}
¿Pegador potente o de efecto?: ${p.power_hitter ? 'Potente' : 'Efecto/colocación'}`;

    const contextSection = `
=== ESTADO ACTUAL ===
${wellnessAlert}
Bienestar de hoy: ${wellnessStatus}
${tournamentCtx}
Últimos saltos registrados: ${jumps.slice(0,3).map(j => `${j.value}cm (${new Date(j.created_at).toLocaleDateString('es-PY')})`).join(', ') || 'ninguno'}`;

    const memorySection = memory?.summary ? `
=== MEMORIA DE CONVERSACIONES ANTERIORES ===
${memory.summary}
Errores técnicos frecuentes: ${(memory.key_errors || []).join(', ') || 'ninguno registrado'}
Mejoras logradas: ${(memory.key_improvements || []).join(', ') || 'ninguna registrada'}
Temas pendientes: ${(memory.active_issues || []).join(', ') || 'ninguno'}` : '';

    const trainingExtra = forTraining ? `
=== MODO: GENERACIÓN DE ENTRENAMIENTO ===
Cuando generés una rutina:
- Siempre estructurá: Calentamiento → Principal → Enfriamiento
- Dá tiempos exactos para cada ejercicio
- Incluí series, repeticiones y pausas precisas
- Adaptá la complejidad al nivel del atleta
- Si hay dolor registrado, evitá ejercicios que lo agraven
- La rutina debe ser específica para la posición del jugador` : '';

    const coachExtra = p.role === 'coach' ? `
=== MODO COACH/ENTRENADOR ===
Este usuario es un coach/entrenador. Cambiá el enfoque:
- Hablale de planificación grupal, no individual
- Consejos de comunicación con el equipo
- Análisis táctico para implementar con varios jugadores
- Cómo periodizar los entrenamientos del grupo
- Cómo identificar y corregir errores técnicos en jugadores` : '';

    return COACH_PERSONA + '\n\n' + VOLLEYBALL_KNOWLEDGE + '\n\n' + FEW_SHOT + '\n\n' + profileSection + '\n\n' + contextSection + (memorySection ? '\n\n' + memorySection : '') + trainingExtra + coachExtra;
  }

  // ---- HELPERS DE DATOS ----
  async function getRecentJumps() {
    if (!CURRENT_USER) return [];
    const { data } = await sb.from('jump_records').select('value,created_at').eq('user_id', CURRENT_USER.id).order('created_at', { ascending: false }).limit(10);
    return data || [];
  }

  async function getTodayWellness() {
    if (!CURRENT_USER) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('wellness_checks').select('*').eq('user_id', CURRENT_USER.id).gte('created_at', today + 'T00:00:00').order('created_at', { ascending: false }).limit(1);
    return data?.[0] || null;
  }

  async function getUpcomingTournaments() {
    if (!CURRENT_USER) return [];
    const { data } = await sb.from('tournaments').select('*').eq('user_id', CURRENT_USER.id).gte('date', new Date().toISOString().slice(0,10)).order('date').limit(3);
    return data || [];
  }

  async function getChatMemory() {
    if (!CURRENT_USER) return null;
    const { data } = await sb.from('chat_memory').select('*').eq('user_id', CURRENT_USER.id).single();
    return data;
  }

  // ---- ACTUALIZAR MEMORIA DESPUÉS DE CONVERSACIÓN ----
  async function updateMemory(messages) {
    if (!CURRENT_USER || messages.length < 4) return;
    const lastMsgs = messages.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Analiza esta conversación de entrenamiento de vóley y extraé en formato JSON:
{
  "summary": "resumen de 2-3 oraciones de qué se habló",
  "key_errors": ["error técnico 1", "error técnico 2"],
  "key_improvements": ["mejora lograda 1"],
  "active_issues": ["tema pendiente 1"]
}
CONVERSACIÓN:
${lastMsgs}
Respondé SOLO con el JSON, sin markdown.`;

    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CONFIG.MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      await sb.from('chat_memory').upsert({ user_id: CURRENT_USER.id, ...parsed, updated_at: new Date().toISOString() });
    } catch (e) { console.warn('Memory update failed:', e); }
  }

  return { buildSystemPrompt, updateMemory };
})();

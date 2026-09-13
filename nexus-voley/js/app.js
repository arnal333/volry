/* ============================================================
   CHAT — Coach IA con memoria Supabase
   ============================================================ */
const CHAT = (() => {
  let loading = false;
  const QUICK = ['¿Por qué no mejora mi salto?','Dame una rutina de calentamiento','¿Cómo mejorar mi remate?','¿Qué como antes del partido?','Analizá mi perfil completo','Tips para el saque flotante','¿Cómo manejar la presión en el 20+?','Tengo dolor en el tobillo, ¿qué hago?'];

  async function loadMessages() {
    const { data } = await sb.from('chat_messages').select('*').eq('user_id', CURRENT_USER.id).order('created_at').limit(50);
    return data || [];
  }

  async function renderMessages() {
    const msgs = await loadMessages();
    const el = document.getElementById('chat-messages');
    const p = CURRENT_PROFILE;
    if (!msgs.length) {
      el.innerHTML = `<div class="msg assistant"><div class="msg-bubble">
        <strong>¡Hola${p?.name?', '+p.name:''}! ⚡</strong><br><br>
        Soy <strong>NEXUS</strong>, tu coach de IA personal. Ya cargué tu perfil completo y estoy listo para ayudarte a mejorar en todo — técnica, fuerza, mental, nutrición.<br><br>
        ¿En qué trabajamos hoy?
      </div><div class="msg-time">NEXUS Coach</div></div>`;
    } else {
      el.innerHTML = msgs.map(m=>`
        <div class="msg ${m.role}">
          <div class="msg-bubble">${m.role==='assistant'?mdToHtml(m.content):escapeHtml(m.content)}</div>
          <div class="msg-time">${new Date(m.created_at).toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>`).join('');
    }
    el.scrollTop = el.scrollHeight;

    // Quick prompts
    const qEl = document.getElementById('chat-quick-prompts');
    if (qEl && !msgs.length) {
      qEl.innerHTML = QUICK.slice(0,4).map(q=>`
        <button onclick="CHAT.sendText(${JSON.stringify(q)})" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:100px;padding:6px 14px;font-size:11px;color:var(--text-sub);cursor:pointer;transition:all 0.15s;white-space:nowrap" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--text)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-sub)'">${q}</button>`).join('');
    } else if (qEl) qEl.innerHTML = '';
  }

  async function send() {
    if (loading) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendText(text);
  }

  async function sendText(text) {
    if (loading) return;
    loading = true;
    document.getElementById('btn-send').disabled = true;

    await sb.from('chat_messages').insert({ user_id: CURRENT_USER.id, role: 'user', content: text });

    const el = document.getElementById('chat-messages');
    el.innerHTML += `<div class="msg user"><div class="msg-bubble">${escapeHtml(text)}</div></div>`;
    el.innerHTML += `<div id="typing-ind" class="msg assistant"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    el.scrollTop = el.scrollHeight;
    document.getElementById('chat-quick-prompts').innerHTML = '';

    try {
      const systemPrompt = await AI_CONTEXT.buildSystemPrompt();
      const { data: history } = await sb.from('chat_messages').select('role,content').eq('user_id', CURRENT_USER.id).order('created_at').limit(20);
      const messages = (history||[]).map(m=>({role:m.role,content:m.content}));

      const res = await fetch(CONFIG.API_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:CONFIG.MODEL, max_tokens:CONFIG.MAX_TOKENS, system:systemPrompt, messages })
      });
      const data = await res.json();
      const reply = data?.content?.[0]?.text || 'No pude procesar eso. ¿Podés reformular?';

      document.getElementById('typing-ind')?.remove();
      await sb.from('chat_messages').insert({ user_id: CURRENT_USER.id, role: 'assistant', content: reply });
      el.innerHTML += `<div class="msg assistant"><div class="msg-bubble">${mdToHtml(reply)}</div></div>`;
      el.scrollTop = el.scrollHeight;

      // Update memory every 8 messages
      const { count } = await sb.from('chat_messages').select('*', {count:'exact',head:true}).eq('user_id', CURRENT_USER.id);
      if (count && count % 8 === 0) {
        const { data: last } = await sb.from('chat_messages').select('role,content').eq('user_id', CURRENT_USER.id).order('created_at', {ascending:false}).limit(8);
        AI_CONTEXT.updateMemory((last||[]).reverse());
      }

    } catch (e) {
      document.getElementById('typing-ind')?.remove();
      el.innerHTML += `<div class="msg assistant"><div class="msg-bubble" style="color:#EF4444">Error al conectar con el Coach IA. Verificá tu conexión.</div></div>`;
    } finally {
      loading = false;
      document.getElementById('btn-send').disabled = false;
      el.scrollTop = el.scrollHeight;
    }
  }

  async function clear() {
    if (!confirm('¿Borrar todo el historial del chat?')) return;
    await sb.from('chat_messages').delete().eq('user_id', CURRENT_USER.id);
    await renderMessages();
    showToast('Historial borrado');
  }

  function init() {
    renderMessages();
    const input = document.getElementById('chat-input');
    input?.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); send(); } });
  }

  return { init, send, sendText, clear };
})();
window.CHAT = CHAT;


/* ============================================================
   ROUTINES — Rutinas semanales Lunes-Viernes con IA
   ============================================================ */
const ROUTINES = (() => {
  function getEquip() { return [...document.querySelectorAll('#equip-checks input:checked')].map(e=>e.value); }
  function getIntensity() { return document.querySelector('.intensity-btn.active')?.dataset.val||'media'; }

  async function generate() {
    const p = CURRENT_PROFILE;
    if (!p) return;
    const goal = document.getElementById('routine-goal').value;
    const time = document.getElementById('routine-time').value;
    const equip = getEquip();
    const intensity = getIntensity();
    const pos = POSITIONS[p.position];

    const btn = document.getElementById('btn-gen-routine');
    const out = document.getElementById('routine-output');
    btn.disabled = true; btn.textContent = '⏳ Generando rutina...';
    out.innerHTML = '<div class="loading-row" style="justify-content:center;padding:30px"><div class="spinner"></div> Creando tu rutina personalizada Lunes-Viernes...</div>';

    const systemPrompt = await AI_CONTEXT.buildSystemPrompt(true);
    const prompt = `Creá una RUTINA SEMANAL COMPLETA de LUNES A VIERNES para este jugador.

PERFIL: ${p.name}, ${p.age} años, posición ${pos?.label}, nivel ${p.level}, ${p.experience} años de experiencia.
OBJETIVO DE LA SEMANA: ${goal}
TIEMPO DIARIO: ${time} minutos
EQUIPAMIENTO DISPONIBLE: ${equip.join(', ')||'solo cuerpo'}
INTENSIDAD: ${intensity}
${p.injuries?'LESIONES/CUIDADOS: '+p.injuries:''}
${p.weaknesses?.length?'DEBILIDADES A TRABAJAR: '+p.weaknesses.join(', '):''}

FORMATO OBLIGATORIO para cada día:
**LUNES — [Tipo de sesión]**
Calentamiento (Xmin): [ejercicios]
Parte principal:
- [Ejercicio]: X series x X reps, Xmin pausa. [Cómo hacerlo correctamente]
- [continuar...]
Enfriamiento (Xmin): [ejercicios]
💡 Tip técnico del día: [consejo específico]

Hacé lo mismo para MARTES, MIÉRCOLES, JUEVES y VIERNES.
Cada día debe tener objetivo diferente y coherente con el objetivo semanal y la posición del jugador.
Sé MUY específico con las cargas, pausas y técnica. No seas genérico.`;

    try {
      const res = await fetch(CONFIG.API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model:CONFIG.MODEL, max_tokens:CONFIG.MAX_TOKENS, system:systemPrompt, messages:[{role:'user',content:prompt}] }) });
      const data = await res.json();
      const text = data?.content?.[0]?.text || 'Error generando la rutina.';
      renderRoutine(text);
      // Save to Supabase
      const weekStart = getMonday();
      await sb.from('weekly_routines').upsert({ user_id: CURRENT_USER.id, week_start: weekStart, data: { text, goal, intensity, equip } });
    } catch (e) {
      out.innerHTML = '<div style="color:var(--red);font-size:13px;padding:20px">Error al generar. Verificá tu conexión.</div>';
    } finally {
      btn.disabled = false; btn.textContent = '⚡ Generar Rutina Lunes-Viernes';
    }
  }

  function renderRoutine(text) {
    const days = ['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES'];
    const out = document.getElementById('routine-output');
    const parts = text.split(/(?=\*\*(?:LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES))/i);
    if (parts.length < 2) { out.innerHTML = `<div style="font-size:13px;line-height:1.7;color:var(--text-sub)">${mdToHtml(text)}</div>`; return; }

    out.innerHTML = parts.filter(p=>p.trim()).map((part, i) => {
      const dayName = days.find(d => part.toUpperCase().includes(d)) || `Día ${i+1}`;
      const content = part.replace(/\*\*[^\*]+\*\*/, '');
      return `<div class="routine-day">
        <div class="routine-day-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <div>
            <div class="routine-day-name">${dayName}</div>
            <div class="routine-day-type" style="font-size:11px;color:var(--accent)">${getFirstLine(part)}</div>
          </div>
          <span style="color:var(--text-muted)">▼</span>
        </div>
        <div class="routine-day-body ${i===0?'open':''}">
          <div style="font-size:13px;line-height:1.7;color:var(--text-sub)">${mdToHtml(content)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function getFirstLine(text) {
    const match = text.match(/—\s*(.+?)[\n\*]/);
    return match?.[1]?.substring(0,40)||'Ver detalle';
  }

  function getMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day===0?-6:1);
    return new Date(d.setDate(diff)).toISOString().slice(0,10);
  }

  function init() {
    document.querySelectorAll('.intensity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tab-routines .intensity-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  return { init, generate };
})();
window.ROUTINES = ROUTINES;


/* ============================================================
   CALENDAR
   ============================================================ */
const CALENDAR = (() => {
  let timer = null;

  async function add() {
    const name = document.getElementById('t-name').value.trim();
    const date = document.getElementById('t-date').value;
    const location = document.getElementById('t-location').value.trim();
    const notes = document.getElementById('t-notes').value.trim();
    if (!name) { showToast('Ingresá el nombre', 'error'); return; }
    if (!date) { showToast('Seleccioná una fecha', 'error'); return; }
    if (daysUntil(date) < 0) { showToast('La fecha ya pasó', 'error'); return; }
    const { error } = await sb.from('tournaments').insert({ user_id: CURRENT_USER.id, name, date, location, notes });
    if (error) { showToast('Error al guardar', 'error'); return; }
    document.getElementById('t-name').value='';
    document.getElementById('t-date').value='';
    document.getElementById('t-location').value='';
    document.getElementById('t-notes').value='';
    showToast('Torneo agregado 📅', 'success');
    await render();
    DASHBOARD.init();
  }

  async function deleteTournament(id) {
    await sb.from('tournaments').delete().eq('id', id);
    showToast('Eliminado');
    await render();
    DASHBOARD.init();
  }

  async function render() {
    const { data } = await sb.from('tournaments').select('*').eq('user_id', CURRENT_USER.id).order('date');
    const tournaments = data || [];
    const upcoming = tournaments.filter(t=>daysUntil(t.date)>=0);
    const past = tournaments.filter(t=>daysUntil(t.date)<0);

    const listEl = document.getElementById('tournament-list');
    if (!tournaments.length) { listEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">Sin torneos registrados</div>'; }
    else {
      listEl.innerHTML = [...upcoming,...past].map((t,i)=>{
        const days=daysUntil(t.date); const isNext=i===0&&days>=0; const isPast=days<0;
        return `<div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px;margin-bottom:8px;border:1px solid ${isNext?'rgba(var(--accent-rgb),0.4)':'var(--border)'}">
          <div style="font-weight:600;font-size:13px">${isNext?'🏆 ':''}${t.name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${formatDate(t.date)} ${isPast?'(pasado)':`· ${days===0?'¡Hoy!':days+' días'}`}</div>
          ${t.location?`<div style="font-size:11px;color:var(--text-muted)">📍 ${t.location}</div>`:''}
          <button onclick="CALENDAR.deleteTournament('${t.id}')" style="background:none;border:none;color:var(--text-muted);font-size:11px;cursor:pointer;margin-top:6px">✕ Eliminar</button>
        </div>`;
      }).join('');
    }

    // Countdown cards
    if (timer) clearInterval(timer);
    const cardsEl = document.getElementById('countdown-cards');
    cardsEl.innerHTML = '';
    upcoming.slice(0,3).forEach(t=>{
      const div = document.createElement('div');
      div.id = `cd-${t.id}`;
      div.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-accent);border-radius:var(--radius-lg);padding:20px;box-shadow:0 0 20px var(--accent-glow)';
      cardsEl.appendChild(div);
      renderCountdown(t);
    });
    if (upcoming.length>0) timer = setInterval(()=>upcoming.slice(0,3).forEach(t=>renderCountdown(t)),1000);
  }

  function renderCountdown(t) {
    const el = document.getElementById(`cd-${t.id}`);
    if (!el) return;
    const target = new Date(t.date+'T23:59:59');
    const diff = target - new Date();
    const days = daysUntil(t.date);
    const h = Math.floor((diff%(86400000))/(3600000));
    const m = Math.floor((diff%(3600000))/(60000));
    const s = Math.floor((diff%60000)/1000);
    const tag = days<=7?'⚠️ Semana de torneo — reducir carga':days<=14?'🔥 Fase pico':'📈 Fase construcción';
    el.innerHTML = `
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--accent);margin-bottom:6px">CUENTA REGRESIVA</div>
      <div style="font-family:Rajdhani,sans-serif;font-size:20px;font-weight:700;margin-bottom:2px">${t.name}</div>
      ${t.location?`<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📍 ${t.location}</div>`:'<div style="margin-bottom:12px"></div>'}
      <div style="display:flex;gap:8px">
        ${[['cd-num',days,'días'],[h,'hrs'],[String(m).padStart(2,'0'),'min'],[String(s>0?s:0).padStart(2,'0'),'seg']].map(([v,l])=>`
          <div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:6px 10px;text-align:center;min-width:44px">
            <span style="font-family:Rajdhani,sans-serif;font-size:${typeof v==='number'&&v>99?'20':'24'}px;font-weight:700;color:var(--accent);display:block;text-shadow:0 0 12px var(--accent-glow)">${v}</span>
            <span style="font-size:9px;color:var(--text-muted)">${l}</span>
          </div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--accent)">${tag}</div>`;
  }

  function init() { render(); }
  return { init, add, deleteTournament };
})();
window.CALENDAR = CALENDAR;


/* ============================================================
   TECHNIQUE — Con animaciones SVG
   ============================================================ */
const TECHNIQUE = (() => {
  let selected = null;

  const ITEMS = [
    {id:'remate',emoji:'💥',name:'Remate',sub:'Potencia y dirección'},
    {id:'batida',emoji:'🦵',name:'Salto / Batida',sub:'Timing y explosividad'},
    {id:'bloqueo',emoji:'🤲',name:'Bloqueo',sub:'Posición y timing'},
    {id:'recepcion',emoji:'📥',name:'Recepción',sub:'Plataforma y control'},
    {id:'saque',emoji:'🎾',name:'Saque flotante',sub:'Efecto y zona'},
    {id:'defensa',emoji:'🛡️',name:'Defensa en piso',sub:'Reacción y rodada'},
    {id:'armado',emoji:'🧠',name:'Lectura de armador',sub:'Anticipación táctica'},
    {id:'caida',emoji:'🦶',name:'Caída segura',sub:'Rodillas y tobillos'},
  ];

  const GUIDES = {
    remate: {
      title: 'Técnica de Remate',
      correcto: 'Brazo extendido, snap de muñeca, rotación de cadera completa. Punto de contacto alto y adelante.',
      incorrecto: 'Brazo semiflexionado, muñeca rígida, sin rotación. Pierde 30-40% de potencia.',
      steps: ['Carrera I-D-I (3 pasos para diestros), último paso largo y bajo.','Brazos atrás en penúltimo paso, suben explosivos en batida.','Codo alto, brazo extendido al máximo en el contacto.','Snap de muñeca hacia abajo generando topspin.','Aterrizaje bípedo, rodillas 90°.'],
      keys: ['Si te bloquean todo: variá el timing del despegue.','Si vas largo: subí el punto de contacto.','La potencia viene del snap, no solo del brazo.'],
      svgType: 'remate'
    },
    batida: {
      title: 'Batida y Salto Vertical',
      correcto: 'Contramovimiento rápido, brazos como palancas, extensión completa en el aire.',
      incorrecto: 'Salto sin carrera, sin usar brazos, rodillas sin flexión previa.',
      steps: ['Baje rápido el centro de masa (contramovimiento).','Brazos atrás mientras bajás.','Explosión: empujá el suelo con toda la planta.','Brazos suben como palancas sumando 8-12cm.','Extensión completa: tobillo, rodilla, cadera, hombro.'],
      keys: ['Pliométricos 3x/semana = +4-7cm en 8 semanas.','La carrera suma 15-25% más que el salto estático.','Tiempo de contacto mínimo en tierra.'],
      svgType: 'batida'
    },
    bloqueo: {
      title: 'Bloqueo Efectivo',
      correcto: 'Lectura por hombros del atacante, penetración de manos sobre la red, dedos tensos.',
      incorrecto: 'Mirar la pelota, manos sin penetrar, salto antes de leer.',
      steps: ['Posición: 20-30cm de la red, peso en puntas.','Mirá el hombro del atacante, no la pelota ni el armador.','Paso chassé lateral — nunca cruzar los pies.','Penetrá las manos sobre la red hacia la cancha rival.','Dedos tensos y separados, sin huecos entre las manos.'],
      keys: ['Hombro del atacante abierto = ataque lejos.','La comunicación con el compañero vale más que la altura.','Ante combinaciones: leer el pase del armador antes.'],
      svgType: 'bloqueo'
    },
    recepcion: {
      title: 'Recepción / Pase de Antebrazos',
      correcto: 'Posición baja, plataforma ancha, movimiento inicia con los pies, contacto en el tercio interno.',
      incorrecto: 'Pararse en puntas esperando, mover los brazos para dirigir, contacto en muñeca.',
      steps: ['Pies separados ancho hombros+10cm, rodillas dobladas.','Plataforma: antebrazos extendidos, muñecas cruzadas.','Movimiento inicia SIEMPRE con los pies primero.','Contactar en tercio interno del antebrazo.','Ángulo de plataforma controla la dirección.'],
      keys: ['Ante flotantes: QUIETO hasta que la pelota baje.','El error más común: mover brazos en vez de pies.','Practicá contra la pared 15 min/día.'],
      svgType: 'recepcion'
    },
    saque: {
      title: 'Saque Flotante',
      correcto: 'Lanzamiento sin spin, golpe seco con base de palma, muñeca bloqueada.',
      incorrecto: 'Lanzamiento con spin, acompañar con el brazo, muñeca que cierra.',
      steps: ['Pie contrario al brazo hábil adelante.','Lanzamiento: 15-20cm hacia adelante, sin rotación.','Golpe corto y seco con base de palma.','Muñeca BLOQUEADA — no debe cerrar.','Zonas objetivo: esquina 1, zona 6 profunda.'],
      keys: ['Si va recto (sin movimiento): más fuerza en el golpe.','Variá las zonas objetivo en cada saque.','El saque del 20+: lento, preciso, sin apuro.'],
      svgType: 'saque'
    },
    defensa: {
      title: 'Defensa en Piso',
      correcto: 'Centro de masa bajo, anticipación del ataque, rodada lateral técnica.',
      incorrecto: 'Pararse alto esperando, reaccionar tarde, caer de cualquier forma.',
      steps: ['Posición: rodillas bajas, brazos listos, peso adelante.','Leer el hombro del atacante para anticipar la dirección.','Para pelota lateral: rodada — muslo externo, cadera, hombro.','Para pelota corta baja: zambullido hacia adelante.','Recuperar posición en 2-3 pasos inmediatamente.'],
      keys: ['La defensa se anticipa, no se espera.','Ante pelotas muy veloces: usá el cuerpo si es necesario.','La rodada bien aprendida nunca duele.'],
      svgType: 'defensa'
    },
    armado: {
      title: 'Lectura del Armador',
      correcto: 'Mirar hombros del armador, anticipar zona de ataque antes del armado.',
      incorrecto: 'Seguir solo la pelota, saltar sin leer al armador, reaccionar tarde.',
      steps: ['Mirá la posición del cuerpo del armador, no la pelota.','Hombro abierto izq = ataque al 4. Hombro der adelante = zona 2.','Identificá el patrón de armado en los primeros 3 puntos.','Como bloqueador: comunicá tu lectura al compañero.','Como atacante: pedí el set según lo que leés.'],
      keys: ['El vóley de élite es 60% lectura, 40% físico.','Estudiá las tendencias del armador rival en el calentamiento.','Los mejores puntas predicen la zona antes del armado.'],
      svgType: 'armado'
    },
    caida: {
      title: 'Caída Segura Tras el Salto',
      correcto: 'Aterrizaje bípedo, rodillas 80-90°, planta completa, sin valgo.',
      incorrecto: 'Aterrizar sobre un solo pie, rodillas adentro, solo punta de pie.',
      steps: ['Aterrizaje SIEMPRE con ambos pies simultáneamente.','Rodillas en 80-90° de flexión al contacto.','Rodillas alineadas con pies — no adentro (valgo).','Planta completa del pie absorbe el impacto.','Inclinar levemente el tronco adelante.'],
      keys: ['Fortalecer gemelos reduce el riesgo de tobillo un 40%.','Propiocepción 3x/semana (30 seg en un pie).','Ante dolor en tobillo post-salto: hielo 20min + reposo.'],
      svgType: 'caida'
    }
  };

  // Animaciones SVG para cada técnica
  function getSVG(type) {
    const svgs = {
      remate: `<svg viewBox="0 0 200 160" style="width:100%;max-width:280px">
        <style>
          .r-fig{animation:rJump 2s ease-in-out infinite}
          .r-arm{animation:rArm 2s ease-in-out infinite;transform-origin:100px 50px}
          .r-ball{animation:rBall 2s ease-in-out infinite}
          @keyframes rJump{0%,100%{transform:translateY(0)}40%,60%{transform:translateY(-35px)}}
          @keyframes rArm{0%,100%{transform:rotate(0deg)}40%{transform:rotate(-60deg)}60%,70%{transform:rotate(40deg)}}
          @keyframes rBall{0%{transform:translate(0,0)}40%{transform:translate(0,-10px)}65%{transform:translate(25px,10px)}100%{transform:translate(0,0)}}
        </style>
        <!-- Suelo -->
        <line x1="10" y1="140" x2="190" y2="140" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <!-- Figura con animación -->
        <g class="r-fig">
          <!-- Cuerpo -->
          <circle cx="100" cy="60" r="10" fill="var(--accent)" class="stickfig-head"/>
          <line x1="100" y1="70" x2="100" y2="105" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <!-- Piernas -->
          <line x1="100" y1="105" x2="85" y2="135" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="100" y1="105" x2="115" y2="135" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <!-- Brazos -->
          <g class="r-arm">
            <line x1="100" y1="80" x2="130" y2="70" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          </g>
          <line x1="100" y1="80" x2="70" y2="90" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
        </g>
        <!-- Pelota -->
        <circle class="r-ball" cx="135" cy="55" r="10" fill="#F59E0B" opacity="0.9"/>
        <!-- Labels -->
        <text x="100" y="155" text-anchor="middle" fill="var(--accent)" font-size="10" font-family="Inter">✓ CORRECTO</text>
      </svg>`,

      batida: `<svg viewBox="0 0 200 160" style="width:100%;max-width:280px">
        <style>
          @keyframes bDown{0%,100%{transform:translateY(0)}30%{transform:translateY(8px)}60%{transform:translateY(-45px)}80%{transform:translateY(-40px)}}
          @keyframes bArm{0%,100%{transform:rotate(0deg);transform-origin:60px 80px}30%{transform:rotate(30deg);transform-origin:60px 80px}60%{transform:rotate(-80deg);transform-origin:60px 80px}}
          .b-fig{animation:bDown 2.2s ease-in-out infinite}
          .b-arms{animation:bArm 2.2s ease-in-out infinite}
        </style>
        <line x1="10" y1="140" x2="190" y2="140" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <!-- Correcto -->
        <g class="b-fig">
          <circle cx="60" cy="75" r="10" fill="var(--accent)"/>
          <line x1="60" y1="85" x2="60" y2="115" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="60" y1="115" x2="45" y2="138" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="60" y1="115" x2="75" y2="138" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <g class="b-arms">
            <line x1="60" y1="95" x2="35" y2="88" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="60" y1="95" x2="85" y2="88" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          </g>
        </g>
        <text x="60" y="155" text-anchor="middle" fill="var(--accent)" font-size="9" font-family="Inter">✓ Con carrera</text>
        <!-- Incorrecto (estático, sin batida) -->
        <g>
          <circle cx="145" cy="90" r="10" fill="#EF4444"/>
          <line x1="145" y1="100" x2="145" y2="125" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="145" y1="125" x2="132" y2="138" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="145" y1="125" x2="158" y2="138" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="145" y1="108" x2="128" y2="115" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="145" y1="108" x2="162" y2="115" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
          <text x="145" y="152" text-anchor="middle" fill="#EF4444" font-size="16">✕</text>
        </g>
        <text x="145" y="155" text-anchor="middle" fill="#EF4444" font-size="9" font-family="Inter">✗ Sin batida</text>
      </svg>`,

      bloqueo: `<svg viewBox="0 0 200 160" style="width:100%;max-width:280px">
        <style>
          @keyframes bkJump{0%,100%{transform:translateY(0)}50%{transform:translateY(-30px)}}
          .bk-fig{animation:bkJump 1.8s ease-in-out infinite}
        </style>
        <line x1="10" y1="140" x2="190" y2="140" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <!-- Red -->
        <line x1="80" y1="45" x2="80" y2="140" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
        <line x1="120" y1="45" x2="120" y2="140" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,3"/>
        <line x1="80" y1="45" x2="120" y2="45" stroke="white" stroke-width="2" opacity="0.3"/>
        <!-- Dos bloqueadores -->
        <g class="bk-fig">
          <circle cx="75" cy="80" r="9" fill="var(--accent)"/>
          <line x1="75" y1="89" x2="75" y2="118" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="75" y1="118" x2="63" y2="138" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="75" y1="118" x2="87" y2="138" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="75" y1="100" x2="58" y2="68" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="75" y1="100" x2="92" y2="68" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="75" cy="58" r="9" fill="var(--accent)"/>
          <circle cx="125" cy="80" r="9" fill="var(--accent)"/>
          <line x1="125" y1="89" x2="125" y2="118" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="125" y1="118" x2="113" y2="138" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="125" y1="118" x2="137" y2="138" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="125" y1="100" x2="108" y2="68" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="125" y1="100" x2="142" y2="68" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="125" cy="58" r="9" fill="var(--accent)"/>
        </g>
        <text x="100" y="155" text-anchor="middle" fill="var(--accent)" font-size="10" font-family="Inter">✓ Bloqueo doble</text>
      </svg>`,

      recepcion: `<svg viewBox="0 0 200 160" style="width:100%;max-width:280px">
        <style>
          @keyframes rcvLow{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(10px) scaleY(0.9)}}
          @keyframes rcvBall{0%{transform:translate(0,0)}40%{transform:translate(-30px,30px)}70%{transform:translate(-50px,10px)}100%{transform:translate(0,0)}}
          .rcv-fig{animation:rcvLow 2s ease-in-out infinite}
          .rcv-ball{animation:rcvBall 2s ease-in-out infinite}
        </style>
        <line x1="10" y1="140" x2="190" y2="140" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <!-- Figura en recepción baja -->
        <g class="rcv-fig">
          <circle cx="100" cy="78" r="9" fill="var(--accent)"/>
          <line x1="100" y1="87" x2="100" y2="110" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="100" y1="110" x2="78" y2="135" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="100" y1="110" x2="122" y2="135" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <!-- Plataforma -->
          <line x1="100" y1="100" x2="70" y2="110" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
          <line x1="100" y1="100" x2="75" y2="110" stroke="rgba(var(--accent-rgb),0.4)" stroke-width="5"/>
        </g>
        <!-- Pelota llegando -->
        <circle class="rcv-ball" cx="155" cy="80" r="9" fill="#F59E0B" opacity="0.9"/>
        <text x="100" y="155" text-anchor="middle" fill="var(--accent)" font-size="10" font-family="Inter">✓ Plataforma baja y firme</text>
      </svg>`,
    };
    return svgs[type] || `<div style="font-size:48px;text-align:center">${ITEMS.find(i=>i.id===type)?.emoji||'🏐'}</div>`;
  }

  function render() {
    document.getElementById('technique-grid').innerHTML = ITEMS.map(item=>`
      <div class="technique-card ${selected===item.id?'active':''}" onclick="TECHNIQUE.select('${item.id}')">
        <div class="technique-emoji">${item.emoji}</div>
        <div class="technique-name">${item.name}</div>
        <div class="technique-sub">${item.sub}</div>
      </div>`).join('');
  }

  function select(id) {
    selected = id;
    render();
    const guide = GUIDES[id];
    if (!guide) return;
    const el = document.getElementById('technique-detail');
    el.style.display = 'block';
    el.innerHTML = `
      <div class="card card-glow">
        <div style="font-family:Rajdhani,sans-serif;font-size:20px;font-weight:700;margin-bottom:16px;color:var(--accent)">${guide.title}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius);padding:14px">
            <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#22C55E;margin-bottom:8px">✓ CORRECTO</div>
            <div class="technique-anim-wrap" style="margin-bottom:8px">${getSVG(guide.svgType)}</div>
            <div style="font-size:12px;color:var(--text-sub)">${guide.correcto}</div>
          </div>
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius);padding:14px">
            <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#EF4444;margin-bottom:8px">✗ ERROR COMÚN</div>
            <div style="background:rgba(239,68,68,0.05);border-radius:var(--radius-sm);padding:12px;min-height:80px;display:flex;align-items:center;justify-content:center;margin-bottom:8px">
              <span style="font-size:36px">⚠️</span>
            </div>
            <div style="font-size:12px;color:var(--text-sub)">${guide.incorrecto}</div>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:var(--text-muted);margin-bottom:8px">PASOS CLAVE</div>
          ${guide.steps.map((s,i)=>`
            <div style="display:flex;gap:10px;margin-bottom:8px">
              <div style="background:var(--accent);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i+1}</div>
              <div style="font-size:13px;color:var(--text-sub);line-height:1.5">${s}</div>
            </div>`).join('')}
        </div>
        <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:var(--text-muted);margin-bottom:8px">PUNTOS A RECORDAR</div>
          ${guide.keys.map(k=>`<div style="font-size:12px;color:var(--text-sub);margin-bottom:6px;padding-left:12px;border-left:2px solid var(--accent)">→ ${k}</div>`).join('')}
        </div>
        <button class="btn-primary" onclick="TECHNIQUE.askAI('${id}')">💬 Pedir análisis personalizado al Coach IA</button>
      </div>`;
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function askAI(id) {
    const item = ITEMS.find(i=>i.id===id);
    const p = CURRENT_PROFILE;
    const prompt = `Analizá mi técnica de ${item?.name} para mi posición de ${POSITIONS[p?.position]?.label||'jugador'} y decime los errores más comunes que alguien con mi perfil comete y cómo corregirlos paso a paso.`;
    switchTab('chat');
    setTimeout(()=>CHAT.sendText(prompt),300);
  }

  function init() { render(); }
  return { init, select, askAI };
})();
window.TECHNIQUE = TECHNIQUE;


/* ============================================================
   MATCH — Partido, Mental, Emergencia, Nutrición
   ============================================================ */
const MATCH = (() => {
  const EMERGENCY_RESPONSES = {
    bloqueado: `**¡Cambiá la estrategia ya!**\n\n• **Variá el timing**: si siempre saltás rápido, hacé un "time" largo — el bloqueo ya saltó, llegás solo vos.\n• **Cambiá la zona**: buscá la línea o el diagonal corto. Si el bloqueo está cerrado, atacá en punta.\n• **Remate suave**: un golpe lento y cortado sobre la espalda del bloqueo.\n• **Comunicá al armador**: "poneme atrás" o "combinación".`,
    racha: `**Cortá la racha — pausa mental inmediata:**\n\n• Pedí tiempo técnico. El que para una racha de 5-0 salva sets.\n• Ritual de reinicio: "esa pelota ya no existe".\n• Volvé a lo básico: recepción → armado → remate al diagonal abierto.\n• Aplaudí un buen esfuerzo aunque sea una defensa.`,
    nervios: `**Protocolo anti-nervios en 60 segundos:**\n\n• Respiración 4-4-4: inspirá 4, aguantá 4, soltá 4. Repetí 3 veces.\n• Tocá el suelo con los dos pies — te ancla al presente.\n• Mantra: "Yo sé jugar. Confío en mi cuerpo."\n• Los nervios = adrenalina. Re-etiquetá: "estoy listo, no nervioso".`,
    piernas: `**Activación rápida de piernas:**\n\n• 10 sentadillas explosivas antes de tu próximo turno.\n• Pisá fuerte el suelo 10 veces alternado — activa el sistema neuromuscular.\n• Masajeá los cuádriceps 30 segundos.\n• Hidratación con electrolitos si podés.`,
    flotante: `**Contrarrestando el saque flotante:**\n\n• QUIETOS hasta que la pelota cae. Moverse antes es el error #1.\n• Posición más baja: rodillas a 90°.\n• Sistema de llamadas antes que llegue: "mío" o "tuyo".\n• Cambien formación si siempre atacan la misma zona.`,
    defensa_rival: `**Rompiendo una defensa sólida:**\n\n• Buscar el líbero: tiene zonas ciegas. Atacá detrás de él.\n• Remate cortado + corto: la defensa profunda no cubre la zona corta.\n• El "wipe": rematar contra el bloqueo para salida lateral.\n• Más rápido el ciclo recepción-armado-ataque.`,
    clutch: `**Mentalidad de cierre:**\n\n• En el 20+: simplificá. Hacé el movimiento más SEGURO, no el más difícil.\n• "Partido dentro del partido": cada punto del 20+ es el primero del set.\n• El rival también siente la presión. El que la maneja mejor, gana.\n• Ritual de saque: siempre el mismo. Dos rebotes, respiración, lanzamiento.`,
  };

  function switchSub(name, btn) {
    document.querySelectorAll('#tab-match .intensity-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['mental','emergency','nutrition'].forEach(s=>{
      const el=document.getElementById('subtab-'+s);
      if(el) el.classList.toggle('active', s===name);
    });
  }

  function renderMental() {
    document.getElementById('mental-content').innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-label">PROTOCOLO PRE-PARTIDO</div>
          ${[
            ['🧘','Respiración 4-7-8','Inspirá 4 seg, aguantá 7, soltá 8. Repetí 3 veces. Baja el cortisol en 90 seg.'],
            ['👁️','Visualización','Cerrá los ojos 60 seg. Verte entrando seguro, tu primer remate perfecto.'],
            ['💪','Power pose','2 minutos con brazos en V o en jarra. Sube testosterona, baja cortisol.'],
            ['🎵','Activación sonora','Tu playlist a 130-140 BPM. Sube dopamina antes de competir.'],
            ['🔥','Mantra de equipo','El grito grupal sincroniza la energía y crea cohesión. ¡Todo!'],
          ].map(([e,t,d])=>`<div style="display:flex;gap:12px;background:var(--bg-elevated);border-radius:var(--radius);padding:12px;margin-bottom:8px;border-left:2px solid var(--accent)">
            <span style="font-size:22px;flex-shrink:0">${e}</span>
            <div><div style="font-weight:600;font-size:13px;margin-bottom:2px">${t}</div><div style="font-size:12px;color:var(--text-muted)">${d}</div></div>
          </div>`).join('')}
          <button class="btn-primary mt-1" onclick="MATCH.genMental()" id="btn-mental">🔄 Protocolo personalizado con IA</button>
        </div>
        <div class="card">
          <div class="card-label">AFIRMACIONES DE CLUTCH</div>
          <div id="affirmations"></div>
          <button class="btn-ghost btn-sm mt-1" onclick="MATCH.newAffirmations()">Nueva tanda</button>
        </div>
      </div>`;
    renderAffirmations();
  }

  const AFFIRMATIONS = [
    '"Cada salto es más alto que el anterior."',
    '"La presión hace diamantes. Este soy yo."',
    '"El 20+ es mi set favorito."',
    '"Bloqueo con los ojos. Ataco con el alma."',
    '"Cada error es datos. Los datos me hacen mejor."',
    '"La cancha me pertenece cuando entro con esta mentalidad."',
    '"Tres palabras: técnica, fuerza, temple."',
    '"Mis piernas no conocen el cansancio cuando mi mente lo decide."',
  ];
  function renderAffirmations() {
    const el = document.getElementById('affirmations');
    if (!el) return;
    const shuffled = [...AFFIRMATIONS].sort(()=>Math.random()-0.5).slice(0,4);
    el.innerHTML = shuffled.map(a=>`<div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px 14px;border-left:2px solid #F59E0B;font-size:14px;font-style:italic;margin-bottom:8px">${a}</div>`).join('');
  }
  function newAffirmations() { renderAffirmations(); }

  async function genMental() {
    const p = CURRENT_PROFILE;
    const btn = document.getElementById('btn-mental');
    btn.disabled = true; btn.textContent='⏳ Generando...';
    const prompt = `Crea un protocolo de preparación mental pre-partido personalizado para ${p?.name||'un atleta'}, posición ${POSITIONS[p?.position]?.label||'jugador'} de vóley. Incluye técnicas de activación, mantra personal, secuencia de 15 minutos y 3 afirmaciones de clutch para su posición. Estilo motivador y directo.`;
    try {
      const res = await fetch(CONFIG.API_URL, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:CONFIG.MODEL,max_tokens:800,messages:[{role:'user',content:prompt}]})});
      const data = await res.json();
      const text = data?.content?.[0]?.text||'';
      document.getElementById('mental-content').innerHTML = `<div class="card"><div class="card-label">PROTOCOLO PERSONALIZADO</div><div style="font-size:13px;line-height:1.7;color:var(--text-sub)">${mdToHtml(text)}</div></div>`;
    } catch { showToast('Error al generar', 'error'); }
    finally { btn.disabled=false; btn.textContent='🔄 Protocolo personalizado con IA'; }
  }

  function renderEmergency() {
    document.getElementById('emergency-content').innerHTML = `
      <div class="card-label">TOCÁ EL PROBLEMA QUE ESTÁS TENIENDO AHORA</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px">
        ${[['bloqueado','🚫','Me están bloqueando todo'],['racha','📉','Racha negativa de puntos'],['nervios','😰','Estoy bloqueado mental'],['piernas','🦵','Las piernas no responden'],['flotante','📲','El flotante nos destruye'],['defensa_rival','🔒','No pasamos la defensa'],['clutch','🎯','Fallamos en el 20+']].map(([id,e,t])=>`
          <div onclick="MATCH.emergency('${id}')" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='var(--accent)';this.style.background='rgba(var(--accent-rgb),0.08)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--bg-elevated)'">
            <div style="font-size:28px;margin-bottom:6px">${e}</div>
            <div style="font-size:12px;color:var(--text-sub)">${t}</div>
          </div>`).join('')}
      </div>
      <div id="emergency-response" style="display:none"></div>`;
  }

  function emergency(id) {
    const text = EMERGENCY_RESPONSES[id];
    if (!text) return;
    const el = document.getElementById('emergency-response');
    el.innerHTML = `<div class="card card-glow"><div class="card-label">RESPUESTA DEL COACH</div><div style="font-size:13px;line-height:1.7;color:var(--text-sub)">${mdToHtml(text)}</div></div>`;
    el.style.display = 'block';
    el.scrollIntoView({behavior:'smooth'});
  }

  function renderNutrition() {
    document.getElementById('nutrition-content').innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-label">GUÍA PRE-PARTIDO</div>
          ${[['🍝','Cena (noche anterior)','Pasta, arroz o batata. Alta en carbohidratos, poca grasa y fibra.'],['🌅','Desayuno (3h antes)','Avena + banana + leche. Café si sos habitual. Sin alimentos nuevos.'],['🍌','Snack (60-90min antes)','Banana o dátiles + bebida isotónica. Fácil digestión.'],['🚫','Evitar el día del partido','Frituras, lácteos en exceso, frutas con mucha fibra, alcohol.'],['🏁','Post-partido (30min)','Pollo con arroz, sandwich o batido proteico. Ventana anabólica.']].map(([e,t,d])=>`
            <div style="display:flex;gap:10px;background:var(--bg-elevated);border-radius:var(--radius);padding:10px 12px;margin-bottom:8px">
              <span style="font-size:18px;flex-shrink:0">${e}</span>
              <div><strong style="display:block;font-size:12px;margin-bottom:2px">${t}</strong><span style="font-size:11px;color:var(--text-muted)">${d}</span></div>
            </div>`).join('')}
        </div>
        <div class="card">
          <div class="card-label">CALCULADORA DE HIDRATACIÓN</div>
          <div class="form-group"><label class="form-label">Tu peso (kg)</label><input type="number" id="h-weight" class="form-input" placeholder="ej: 69"></div>
          <div class="form-group"><label class="form-label">Temperatura estimada (°C)</label><input type="number" id="h-temp" class="form-input" placeholder="ej: 32"></div>
          <button class="btn-primary" onclick="MATCH.calcHydration()">Calcular</button>
          <div id="hydration-result" style="display:none;margin-top:12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius);padding:14px;font-size:13px;color:var(--text-sub)"></div>
        </div>
      </div>`;
  }

  function calcHydration() {
    const weight = parseFloat(document.getElementById('h-weight').value);
    const temp = parseFloat(document.getElementById('h-temp').value);
    if (!weight||!temp) { showToast('Ingresá peso y temperatura','error'); return; }
    const during = Math.round(600+(temp>28?(temp-28)*40:0));
    const el = document.getElementById('hydration-result');
    el.innerHTML = `
      <strong style="color:#22C55E;display:block;margin-bottom:8px">Protocolo de hidratación:</strong>
      💧 2h antes del partido: <strong>500 ml</strong> agua + electrolitos<br>
      💧 Calentamiento: <strong>200 ml</strong> cada 15 min<br>
      💧 Durante el partido: <strong>${Math.round(during/4)} ml</strong> cada 15 min<br>
      💧 Total diario a reponer: <strong>${Math.round(weight*35/100)*100 + during} ml</strong>
      ${temp>30?`<br><span style="color:#F59E0B;font-size:11px;margin-top:6px;display:block">⚠️ Con ${temp}°C de calor — priorizá bebida isotónica sobre agua sola.</span>`:''}`;
    el.style.display = 'block';
  }

  function init() {
    renderMental();
    renderEmergency();
    renderNutrition();
  }

  return { init, switchSub, genMental, newAffirmations, emergency, calcHydration };
})();
window.MATCH = MATCH;


/* ============================================================
   WELLNESS
   ============================================================ */
const WELLNESS = (() => {
  let wChart = null;

  function initSliders() {
    [['w-legs','w-legs-v',''],['w-stress','w-stress-v',''],['w-sleep','w-sleep-v','h'],['w-pain','w-pain-v','']].forEach(([id,vid,suf])=>{
      const el=document.getElementById(id), val=document.getElementById(vid);
      if(el&&val) el.addEventListener('input',()=>val.textContent=el.value+suf);
    });
  }

  async function submit() {
    const legs=parseInt(document.getElementById('w-legs').value);
    const stress=parseInt(document.getElementById('w-stress').value);
    const sleep=parseFloat(document.getElementById('w-sleep').value);
    const pain=parseInt(document.getElementById('w-pain').value);
    const { error } = await sb.from('wellness_checks').insert({ user_id: CURRENT_USER.id, legs, stress, sleep, pain });
    if (error) { showToast('Error al guardar','error'); return; }
    showToast('Check guardado ✅','success');
    await render();
    DASHBOARD.init();
  }

  function getScore(w) { return Math.round(((w.legs/10)+(1-w.stress/10)+Math.min(w.sleep/8,1)+(1-w.pain/10))/4*10); }

  function getRec(w) {
    const score = getScore(w);
    if (w.pain>=7) return {badge:'red',label:'ALTO RIESGO',text:`⚠️ Dolor ${w.pain}/10 — HOY DESCANSO ACTIVO. Hielo en zona afectada, movilidad suave, cero saltos. Si persiste 48h, kinesiólogo.`};
    if (score>=8) return {badge:'green',label:'ÓPTIMO',text:`🔥 Estado excelente (${score}/10). Podés entrenar a ALTA intensidad. Aprovechá para pliométricos y trabajo técnico exigente.`};
    if (score>=5) return {badge:'gold',label:'MODERADO',text:`📊 Estado moderado (${score}/10). MEDIA INTENSIDAD recomendada. Técnica, armado, recepción sin maximizar cargas.`};
    return {badge:'red',label:'RECUPERACIÓN',text:`😴 Cuerpo fatigado (${score}/10). DÍA DE RECUPERACIÓN ACTIVA: caminata, stretching, foam roller. ${w.sleep<6?'El sueño bajo es la prioridad hoy.':''}`};
  }

  async function render() {
    const dateEl = document.getElementById('wellness-date-label');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('es-PY',{day:'numeric',month:'long'});

    const today = new Date().toISOString().slice(0,10);
    const { data: todayData } = await sb.from('wellness_checks').select('*').eq('user_id', CURRENT_USER.id).gte('created_at', today+'T00:00:00').order('created_at',{ascending:false}).limit(1);
    const w = todayData?.[0];

    if (w) {
      document.getElementById('wellness-done-msg').style.display = 'block';
      document.getElementById('wellness-form').style.display = 'none';
      document.getElementById('wellness-done-summary').textContent = `Piernas: ${w.legs}/10 · Estrés: ${w.stress}/10 · Sueño: ${w.sleep}h · Dolor: ${w.pain}/10`;
      const rec = getRec(w);
      document.getElementById('wellness-rec').innerHTML = `<span class="badge badge-${rec.badge}" style="display:inline-flex;margin-bottom:8px">${rec.label}</span><br><div style="color:var(--text-sub);font-size:13px;line-height:1.6">${rec.text}</div>`;
    } else {
      document.getElementById('wellness-done-msg').style.display = 'none';
      document.getElementById('wellness-form').style.display = 'block';
    }

    await renderWellnessChart();
    renderInjuryModule();
  }

  async function renderWellnessChart() {
    const ctx = document.getElementById('wellness-chart');
    if (!ctx) return;
    const { data } = await sb.from('wellness_checks').select('*').eq('user_id', CURRENT_USER.id).order('created_at',{ascending:false}).limit(7);
    const history = (data||[]).reverse();
    if (history.length < 2) return;
    const labels = history.map(w=>new Date(w.created_at).toLocaleDateString('es-PY',{weekday:'short'}));
    const scores = history.map(w=>getScore(w));
    if (wChart) wChart.destroy();
    wChart = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[{ data:scores, backgroundColor:scores.map(s=>s>=7?'rgba(34,197,94,0.6)':s>=5?'rgba(245,158,11,0.6)':'rgba(239,68,68,0.6)'), borderRadius:4 }] },
      options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{min:0,max:10,ticks:{color:'#4A5568'},grid:{color:'rgba(255,255,255,0.05)'}}, x:{ticks:{color:'#4A5568'},grid:{display:false}} } }
    });
  }

  function renderInjuryModule() {
    const el = document.getElementById('injury-module');
    if (!el) return;
    el.innerHTML = [
      ['🦵','Tobillo','Propiocepción 3x/semana: equilibrio en un pie 30 seg con ojos cerrados, círculos con elástico. Reduce lesiones un 40%.'],
      ['🦴','Rodilla del saltador','Excéntricos de cuádriceps (sentadillas en decline) son el tratamiento preventivo más efectivo. Si dolor VAS>3: reducir saltos 30%.'],
      ['💪','Hombro del rematador','Rotaciones internas y externas con elástico liviano antes de CADA sesión de remate. 3 series de 15.'],
      ['🧠','Sobrecarga mental','Más de 6 entrenos/semana sin mejorar = sobreentrenamiento. 1-2 días libres por semana son obligatorios.'],
    ].map(([e,t,d])=>`
      <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px;border-left:2px solid #EF4444">
        <div style="font-weight:600;font-size:13px;margin-bottom:4px">${e} ${t}</div>
        <div style="font-size:12px;color:var(--text-muted)">${d}</div>
      </div>`).join('');
  }

  function resetToday() {
    document.getElementById('wellness-done-msg').style.display = 'none';
    document.getElementById('wellness-form').style.display = 'block';
  }

  function init() { initSliders(); render(); }
  return { init, submit, resetToday };
})();
window.WELLNESS = WELLNESS;


/* ============================================================
   COACH MODE — Club, Pizarra, Jugadores
   ============================================================ */
const COACHMODE = (() => {
  let board = { players: [], rivalPlayers: [], arrows: [] };
  let drag = null;

  function switchSub(name, btn) {
    document.querySelectorAll('#tab-coach .intensity-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['club','board','players'].forEach(s=>{
      const el=document.getElementById('coach-sub-'+s);
      if(el) el.style.display=s===name?'block':'none';
    });
  }

  async function renderClub() {
    const { data: clubs } = await sb.from('clubs').select('*').eq('coach_id', CURRENT_USER.id);
    const club = clubs?.[0];
    const el = document.getElementById('club-content');
    if (club) {
      const { data: members } = await sb.from('club_members').select('player_id, profiles(name,position,jump_record)').eq('club_id', club.id);
      el.innerHTML = `
        <div class="card card-glow mb-2">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:48px;height:48px;background:${club.color};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 20px ${club.color}50">🏐</div>
            <div><div style="font-family:Rajdhani,sans-serif;font-size:20px;font-weight:700">${club.name}</div><div style="font-size:12px;color:var(--text-muted)">${club.category||'Sin categoría'} · Código: <strong style="color:var(--accent)">${club.code}</strong></div></div>
          </div>
          <div style="font-size:12px;color:var(--text-muted)">Los jugadores pueden unirse con el código de arriba</div>
        </div>
        <div class="card">
          <div class="card-label">JUGADORES (${members?.length||0})</div>
          ${members?.map(m=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
              <div><strong>${m.profiles?.name||'Jugador'}</strong><br><span style="font-size:11px;color:var(--text-muted)">${POSITIONS[m.profiles?.position]?.label||'Sin posición'}</span></div>
              <span style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:var(--accent)">${m.profiles?.jump_record||'—'} cm</span>
            </div>`).join('')||'<div style="color:var(--text-muted);font-size:13px;padding:12px 0">Sin jugadores aún. Compartí el código.</div>'}
        </div>
        <div class="form-group mt-2">
          <label class="form-label">Agregar jugador por código de usuario</label>
          <div style="display:flex;gap:8px">
            <input id="player-code" class="form-input" placeholder="Código del jugador...">
            <button class="btn-primary btn-icon" onclick="COACHMODE.addPlayer('${club.id}')">+</button>
          </div>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="card">
          <div class="card-label">CREAR MI CLUB</div>
          <div class="form-group"><label class="form-label">Nombre del club</label><input id="club-name" class="form-input" placeholder="ej: Área 4 CDE Voleibol"></div>
          <div class="form-group"><label class="form-label">Categoría</label><input id="club-cat" class="form-input" placeholder="ej: U19 Masculino"></div>
          <button class="btn-primary" onclick="COACHMODE.createClub()">Crear Club</button>
        </div>`;
    }
  }

  async function createClub() {
    const name = document.getElementById('club-name')?.value.trim();
    if (!name) { showToast('Ingresá el nombre','error'); return; }
    const cat = document.getElementById('club-cat')?.value.trim();
    const { error } = await sb.from('clubs').insert({ coach_id: CURRENT_USER.id, name, category: cat });
    if (error) { showToast('Error: '+error.message,'error'); return; }
    showToast('¡Club creado!','success');
    await renderClub();
  }

  async function addPlayer(clubId) {
    showToast('Función disponible próximamente','info');
  }

  function renderBoard() {
    const el = document.getElementById('board-content');
    el.innerHTML = `
      <div class="card mb-2">
        <div class="card-label">PIZARRA TÁCTICA — ARRASTRAR JUGADORES</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn-ghost btn-sm btn-icon" onclick="COACHMODE.addPlayer_board('my')">+ Jugador equipo</button>
          <button class="btn-ghost btn-sm btn-icon" onclick="COACHMODE.addPlayer_board('rival')">+ Jugador rival</button>
          <button class="btn-ghost btn-sm btn-icon" onclick="COACHMODE.clearBoard()">🗑️ Limpiar</button>
          <button class="btn-primary btn-sm btn-icon" onclick="COACHMODE.savePlay()">💾 Guardar jugada</button>
        </div>
        <div class="board-wrap" id="volleyball-board">
          <!-- Net -->
          <div style="position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.2);transform:translateX(-50%)"></div>
          <div style="position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(255,255,255,0.1);display:none"></div>
          <!-- Court lines -->
          <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" id="board-svg">
            <rect x="5%" y="5%" width="90%" height="90%" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
            <line x1="50%" y1="5%" x2="50%" y2="95%" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
            <line x1="5%" y1="33%" x2="95%" y2="33%" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="4,4"/>
            <line x1="5%" y1="67%" x2="95%" y2="67%" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="4,4"/>
          </svg>
          <div id="board-players"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px">Arrastrá los jugadores a la cancha</div>
      </div>
      <div class="card">
        <div class="card-label">JUGADAS GUARDADAS</div>
        <div id="saved-plays" style="font-size:13px;color:var(--text-muted)">Sin jugadas guardadas</div>
      </div>`;
    initBoard();
    loadPlays();
  }

  let playerCount = 1;
  function addPlayer_board(type) {
    const boardEl = document.getElementById('board-players');
    const boardWrap = document.getElementById('volleyball-board');
    if (!boardEl||!boardWrap) return;
    const rect = boardWrap.getBoundingClientRect();
    const x = type==='my'?Math.random()*40+5:Math.random()*40+55;
    const y = Math.random()*80+5;
    const div = document.createElement('div');
    div.className = 'board-player' + (type==='rival'?' rival':'');
    div.style.left = x+'%';
    div.style.top = y+'%';
    div.textContent = playerCount++;
    div.addEventListener('mousedown', startDrag);
    div.addEventListener('touchstart', startDragTouch, {passive:true});
    boardEl.appendChild(div);
  }

  function startDrag(e) {
    drag = e.target;
    e.preventDefault();
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', endDrag);
  }
  function startDragTouch(e) {
    drag = e.target;
    document.addEventListener('touchmove', doDragTouch, {passive:false});
    document.addEventListener('touchend', endDrag);
  }
  function doDrag(e) { moveDrag(e.clientX, e.clientY); }
  function doDragTouch(e) { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); }
  function moveDrag(cx, cy) {
    if (!drag) return;
    const board = document.getElementById('volleyball-board');
    const rect = board.getBoundingClientRect();
    let x = ((cx-rect.left)/rect.width*100);
    let y = ((cy-rect.top)/rect.height*100);
    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));
    drag.style.left = x+'%';
    drag.style.top = y+'%';
  }
  function endDrag() {
    drag = null;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', doDragTouch);
    document.removeEventListener('touchend', endDrag);
  }
  function initBoard() { playerCount = 1; }
  function clearBoard() { const el=document.getElementById('board-players'); if(el) el.innerHTML=''; playerCount=1; }

  async function savePlay() {
    const name = prompt('Nombre de la jugada:');
    if (!name) return;
    const players = [...document.querySelectorAll('.board-player')].map(p=>({left:p.style.left,top:p.style.top,rival:p.classList.contains('rival'),num:p.textContent}));
    const { data: clubs } = await sb.from('clubs').select('id').eq('coach_id', CURRENT_USER.id).limit(1);
    if (!clubs?.[0]) { showToast('Creá un club primero','error'); return; }
    await sb.from('tactical_plays').insert({ club_id: clubs[0].id, coach_id: CURRENT_USER.id, name, data: { players } });
    showToast('Jugada guardada 💾','success');
    loadPlays();
  }

  async function loadPlays() {
    const { data: clubs } = await sb.from('clubs').select('id').eq('coach_id', CURRENT_USER.id).limit(1);
    if (!clubs?.[0]) return;
    const { data: plays } = await sb.from('tactical_plays').select('*').eq('club_id', clubs[0].id).order('created_at',{ascending:false}).limit(10);
    const el = document.getElementById('saved-plays');
    if (!plays?.length||!el) return;
    el.innerHTML = plays.map(p=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:6px">
        <span style="font-size:13px;font-weight:500">${p.name}</span>
        <span style="font-size:11px;color:var(--text-muted)">${new Date(p.created_at).toLocaleDateString('es-PY',{day:'numeric',month:'short'})}</span>
      </div>`).join('');
  }

  function init() {
    const isCoach = CURRENT_PROFILE?.role === 'coach';
    if (isCoach) {
      renderClub();
      renderBoard();
    }
  }

  return { init, switchSub, createClub, addPlayer, addPlayer_board, clearBoard, savePlay };
})();
window.COACHMODE = COACHMODE;


/* ============================================================
   SETTINGS
   ============================================================ */
const SETTINGS = (() => {
  function renderThemes() {
    const savedColor = localStorage.getItem('nx_accent') || THEMES[0].color;
    document.getElementById('theme-grid').innerHTML = THEMES.map(t=>`
      <div class="theme-chip ${t.color===savedColor?'active':''}" data-color="${t.color}" style="background:${t.color}" title="${t.name}" onclick="SETTINGS.setTheme('${t.color}')"></div>`).join('');
    const savedMode = localStorage.getItem('nx_theme')||'auto';
    document.querySelectorAll('#tab-settings .intensity-row .intensity-btn').forEach((btn,i)=>{
      btn.classList.toggle('active', ['light','auto','dark'][i]===savedMode);
    });
    const p = CURRENT_PROFILE;
    const accEl = document.getElementById('settings-account-info');
    if (accEl) accEl.innerHTML = `Email: ${CURRENT_USER?.email||'—'}<br>Plan: <strong style="color:var(--accent)">Gratis</strong><br>Usuario desde: ${new Date(CURRENT_USER?.created_at||Date.now()).toLocaleDateString('es-PY')}`;
  }

  function setTheme(color) { THEME.apply(color); renderThemes(); saveProfile({ theme_color: color }); }
  function setMode(mode, btn) {
    THEME.setMode(mode);
    document.querySelectorAll('#tab-settings .intensity-row .intensity-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    saveProfile({ dark_mode: mode });
  }

  function shareProfile() {
    const url = window.location.origin + window.location.pathname + '?player=' + CURRENT_USER.id;
    navigator.clipboard?.writeText(url);
    showToast('Link copiado al portapapeles 🔗','success');
  }

  function downloadCard() {
    const p = CURRENT_PROFILE;
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 560;
    const ctx = canvas.getContext('2d');
    const color = localStorage.getItem('nx_accent')||'#6366F1';
    ctx.fillStyle = '#070B18'; ctx.fillRect(0,0,400,560);
    const grad = ctx.createLinearGradient(0,0,400,180); grad.addColorStop(0,color); grad.addColorStop(1,'#070B18');
    ctx.fillStyle = grad; ctx.fillRect(0,0,400,180);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Rajdhani, sans-serif';
    ctx.fillText((p?.name||'ATLETA').toUpperCase(), 20, 100);
    ctx.font = '14px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText((POSITIONS[p?.position]?.label||'—').toUpperCase(), 20, 125);
    ctx.fillText(p?.team||'—', 20, 145);
    const stats = [['SALTO',p?.jump_record||'—','cm'],['ALTURA',p?.height||'—','cm'],['PESO',p?.weight||'—','kg'],['NIVEL',p?.level||'—','']];
    stats.forEach(([l,v,u],i)=>{
      const x = 20+(i%2)*190, y = 220+(Math.floor(i/2))*80;
      ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(x,y,170,60);
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='9px Inter'; ctx.fillText(l,x+10,y+18);
      ctx.fillStyle=color; ctx.font='bold 26px Rajdhani'; ctx.fillText(v+' '+u, x+10, y+46);
    });
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(20,400,360,1);
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='10px Inter'; ctx.textAlign='center';
    ctx.fillText('⚡ NEXUS VOLEY · ENTRENADOR PERSONAL DE ÉLITE', 200, 430);
    const link = document.createElement('a');
    link.download = `nexus-voley-${(p?.name||'atleta').replace(/\s+/g,'-')}.png`;
    link.href = canvas.toDataURL();
    link.click();
    showToast('Ficha descargada ⬇️','success');
  }

  async function clearData() {
    if (!confirm('⚠️ ¿Borrar TODOS tus datos? Esta acción es irreversible.')) return;
    await Promise.all([
      sb.from('jump_records').delete().eq('user_id', CURRENT_USER.id),
      sb.from('chat_messages').delete().eq('user_id', CURRENT_USER.id),
      sb.from('wellness_checks').delete().eq('user_id', CURRENT_USER.id),
      sb.from('tournaments').delete().eq('user_id', CURRENT_USER.id),
      sb.from('weekly_routines').delete().eq('user_id', CURRENT_USER.id),
    ]);
    showToast('Datos borrados','error');
    setTimeout(()=>location.reload(), 1500);
  }

  function init() { renderThemes(); }
  return { init, setTheme, setMode, shareProfile, downloadCard, clearData };
})();
window.SETTINGS = SETTINGS;


/* ============================================================
   APP — Inicialización principal
   ============================================================ */
const APP = {
  async init() {
    THEME.init();

    // Check auth
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    CURRENT_USER = session.user;

    // Load profile
    await loadProfile(CURRENT_USER.id);

    // Show app
    document.getElementById('app').style.display = 'block';

    // Build menu
    this.buildMenu();

    // Init all modules
    DASHBOARD.init();
    RANKING.init();
    CHAT.init();
    ROUTINES.init();
    CALENDAR.init();
    TECHNIQUE.init();
    MATCH.init();
    WELLNESS.init();
    COACHMODE.init();
    SETTINGS.init();

    // Check onboarding
    ONBOARDING.initIfNeeded();

    // Auth state changes
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') window.location.href = 'login.html';
    });
  },

  buildMenu() {
    const p = CURRENT_PROFILE;
    const isCoach = p?.role === 'coach';
    const avatar = document.getElementById('menu-avatar');
    const name = document.getElementById('menu-name');
    const role = document.getElementById('menu-role');
    if (avatar) avatar.textContent = POSITIONS[p?.position]?.emoji || (isCoach ? '👨‍🏫' : '🏐');
    if (name) name.textContent = p?.name || 'Atleta';
    if (role) role.textContent = isCoach ? 'Coach / Entrenador' : `${POSITIONS[p?.position]?.label||'Jugador'} · ${p?.team||''}`;

    const nav = document.getElementById('menu-nav');
    const playerItems = [
      {tab:'dashboard',icon:'🏠',label:'Inicio'},
      {tab:'ranking',icon:'🏆',label:'Ranking'},
      {tab:'chat',icon:'💬',label:'Coach IA'},
      {tab:'routines',icon:'🏋️',label:'Rutinas Semanales'},
      {tab:'calendar',icon:'📅',label:'Calendario'},
      {tab:'technique',icon:'🎯',label:'Banco de Técnica'},
      {tab:'match',icon:'⚡',label:'Modo Partido'},
      {tab:'wellness',icon:'🌡️',label:'Bienestar'},
    ];
    const coachItems = [
      {tab:'coach',icon:'👨‍🏫',label:'Coach IA'},
      {tab:'calendar',icon:'📅',label:'Calendario'},
      {tab:'coach',icon:'🏐',label:'Mi Club & Pizarra'},
    ];
    const items = isCoach ? coachItems : playerItems;
    nav.innerHTML = `<div class="menu-section-label">NAVEGACIÓN</div>` + items.map(item=>`
      <button class="menu-item" data-tab="${item.tab}" onclick="switchTab('${item.tab}');APP.closeMenu()">
        <span class="menu-item-icon">${item.icon}</span>${item.label}
      </button>`).join('');
  },

  toggleMenu() {
    const overlay = document.getElementById('menu-overlay');
    const drawer = document.getElementById('menu-drawer');
    const btn = document.getElementById('menu-btn');
    const isOpen = overlay.classList.contains('open');
    overlay.classList.toggle('open', !isOpen);
    drawer.classList.toggle('open', !isOpen);
    btn.classList.toggle('open', !isOpen);
  },

  closeMenu() {
    document.getElementById('menu-overlay')?.classList.remove('open');
    document.getElementById('menu-drawer')?.classList.remove('open');
    document.getElementById('menu-btn')?.classList.remove('open');
  },

  async logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    await sb.auth.signOut();
    window.location.href = 'login.html';
  },

  onTab(name) {
    switch(name) {
      case 'dashboard': DASHBOARD.init(); break;
      case 'ranking': RANKING.init(); break;
      case 'chat': CHAT.init(); break;
      case 'calendar': CALENDAR.init(); break;
      case 'wellness': WELLNESS.init(); break;
      case 'settings': SETTINGS.init(); break;
    }
  }
};

window.APP = APP;
document.addEventListener('DOMContentLoaded', () => APP.init());

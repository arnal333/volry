/* ============================================================
   ONBOARDING — Wizard de perfil extendido
   ============================================================ */
const ONBOARDING = (() => {
  let step = 0, draft = {};
  const TOTAL = 6;

  function dots() {
    return `<div class="ob-progress">${Array.from({length:TOTAL},(_,i)=>
      `<div class="ob-dot ${i<step?'done':i===step?'active':''}"></div>`).join('')}</div>`;
  }

  const STEPS = [
    // 0: Bienvenida
    () => `<div class="ob-step">
      ${dots()}
      <div style="text-align:center;margin:16px 0">
        <div style="font-size:56px;margin-bottom:12px">⚡</div>
        <h2 style="font-family:Rajdhani,sans-serif;font-size:26px;font-weight:700;margin-bottom:8px">Bienvenido a <span style="color:var(--accent)">NEXUS VOLEY</span></h2>
        <p style="color:var(--text-sub);font-size:13px">Tu coach de IA personalizado. Vamos a configurar tu perfil para que todo sea 100% tuyo.</p>
      </div>
      <button class="btn-primary" onclick="ONBOARDING.next()">Empezar →</button>
    </div>`,

    // 1: Rol
    () => `<div class="ob-step">
      ${dots()}
      <h2 style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;text-align:center;margin-bottom:4px">¿Quién sos?</h2>
      <p style="text-align:center;color:var(--text-sub);font-size:13px;margin-bottom:16px">Esto cambia completamente el enfoque del Coach IA</p>
      <div class="role-grid">
        <div class="role-btn ${draft.role==='player'?'active':''}" onclick="draft.role='player';this.closest('.role-grid').querySelectorAll('.role-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
          <span class="role-emoji">🏐</span>
          <div class="role-title">Soy Jugador</div>
          <div class="role-sub">Rutinas, técnica, salto, mental</div>
        </div>
        <div class="role-btn ${draft.role==='coach'?'active':''}" onclick="draft.role='coach';this.closest('.role-grid').querySelectorAll('.role-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
          <span class="role-emoji">👨‍🏫</span>
          <div class="role-title">Soy Coach</div>
          <div class="role-sub">Equipo, pizarra, planificación</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-ghost" onclick="ONBOARDING.prev()" style="width:auto;padding:10px 20px">← Atrás</button>
        <button class="btn-primary" onclick="ONBOARDING.s1()">Siguiente →</button>
      </div>
    </div>`,

    // 2: Info básica
    () => `<div class="ob-step">
      ${dots()}
      <h2 style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;text-align:center;margin-bottom:16px">Tu información</h2>
      <div class="form-group"><label class="form-label">Nombre completo</label><input id="ob-name" class="form-input" placeholder="Ej: Arnal García" value="${draft.name||''}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Edad</label><input id="ob-age" type="number" class="form-input" placeholder="17" value="${draft.age||''}"></div>
        <div class="form-group"><label class="form-label">Exp. (años)</label><input id="ob-exp" type="number" class="form-input" placeholder="3" value="${draft.experience||''}"></div>
        <div class="form-group"><label class="form-label">Altura (cm)</label><input id="ob-height" type="number" class="form-input" placeholder="186" value="${draft.height||''}"></div>
        <div class="form-group"><label class="form-label">Peso (kg)</label><input id="ob-weight" type="number" class="form-input" placeholder="69" value="${draft.weight||''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Equipo / Colegio</label><input id="ob-team" class="form-input" placeholder="ej: Área 4 CDE" value="${draft.team||''}"></div>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" onclick="ONBOARDING.prev()" style="width:auto;padding:10px 20px">← Atrás</button>
        <button class="btn-primary" onclick="ONBOARDING.s2()">Siguiente →</button>
      </div>
    </div>`,

    // 3: Posición y nivel
    () => `<div class="ob-step">
      ${dots()}
      <h2 style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;text-align:center;margin-bottom:16px">Posición y nivel</h2>
      <div class="form-group">
        <label class="form-label">¿Cuál es tu posición?</label>
        <div class="position-grid">
          ${Object.entries(POSITIONS).map(([k,v])=>`
            <div class="pos-btn ${draft.position===k?'active':''}" onclick="draft.position='${k}';this.closest('.position-grid').querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
              <span class="pos-emoji">${v.emoji}</span>${v.short}
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nivel actual</label>
        <select id="ob-level" class="form-input">
          <option value="principiante" ${draft.level==='principiante'?'selected':''}>Principiante (0-2 años)</option>
          <option value="intermedio" ${draft.level==='intermedio'?'selected':''}>Intermedio (3-5 años)</option>
          <option value="avanzado" ${draft.level==='avanzado'?'selected':''}>Avanzado (6+ años)</option>
          <option value="competitivo" ${draft.level==='competitivo'?'selected':''}>Competitivo / Federado</option>
        </select>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" onclick="ONBOARDING.prev()" style="width:auto;padding:10px 20px">← Atrás</button>
        <button class="btn-primary" onclick="ONBOARDING.s3()">Siguiente →</button>
      </div>
    </div>`,

    // 4: Físico y métricas
    () => `<div class="ob-step">
      ${dots()}
      <h2 style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;text-align:center;margin-bottom:16px">Físico y juego</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Salto vertical (cm)</label><input id="ob-jump" type="number" class="form-input" placeholder="52" value="${draft.jump_record||''}"></div>
        <div class="form-group"><label class="form-label">Alcance ataque (cm)</label><input id="ob-reach" type="number" class="form-input" placeholder="310" value="${draft.reach||''}"></div>
      </div>
      <div class="form-group">
        <label class="form-label">¿Cómo atacás principalmente?</label>
        <select id="ob-attack" class="form-input">
          <option value="diagonal" ${draft.attack_style==='diagonal'?'selected':''}>Diagonal (zona 1)</option>
          <option value="linea" ${draft.attack_style==='linea'?'selected':''}>Línea (zona 5)</option>
          <option value="ambos" ${draft.attack_style==='ambos'?'selected':''}>Ambos por igual</option>
          <option value="efecto" ${draft.attack_style==='efecto'?'selected':''}>Efecto / colocación</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">¿Qué problema tenés más seguido?</label>
        <div id="ob-weak-checks">
          ${['Se me bloquea todo','No llego al balón','Salto poco','Recepción floja','Me pongo nervioso','Me como los bloqueos','Falta de potencia','Mal timing de batida'].map(w=>`
            <label class="checkbox-item" style="margin-bottom:4px">
              <input type="checkbox" class="ob-weak" value="${w}" ${(draft.weaknesses||[]).includes(w)?'checked':''}> ${w}
            </label>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" onclick="ONBOARDING.prev()" style="width:auto;padding:10px 20px">← Atrás</button>
        <button class="btn-primary" onclick="ONBOARDING.s4()">Siguiente →</button>
      </div>
    </div>`,

    // 5: Objetivos y equipamiento
    () => `<div class="ob-step">
      ${dots()}
      <h2 style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;text-align:center;margin-bottom:16px">Objetivos y equipamiento</h2>
      <div class="form-group">
        <label class="form-label">Tu objetivo principal</label>
        <select id="ob-goal" class="form-input">
          <option value="Ganar los JEEN" ${draft.goals==='Ganar los JEEN'?'selected':''}>Ganar los JEEN</option>
          <option value="Competir en regional" ${draft.goals==='Competir en regional'?'selected':''}>Competir en regional</option>
          <option value="Llegar a selección nacional" ${draft.goals?.includes('selección')?'selected':''}>Llegar a selección nacional</option>
          <option value="Mejorar salto +10cm" ${draft.goals?.includes('salto')?'selected':''}>Mejorar salto +10cm</option>
          <option value="Mejorar técnica general" ${draft.goals?.includes('técnica')?'selected':''}>Mejorar técnica general</option>
          <option value="Juego profesional" ${draft.goals?.includes('profesional')?'selected':''}>Juego profesional</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Equipamiento disponible</label>
        <div id="ob-equip-checks">
          ${[['pelota','🏐 Pelota'],['red','🔲 Red/cancha'],['pesas','🏋️ Pesas'],['ligas','🟡 Ligas'],['caja','📦 Cajón plio.'],['gimnasio','💪 Gimnasio']].map(([v,l])=>`
            <label class="checkbox-item" style="margin-bottom:4px">
              <input type="checkbox" class="ob-equip" value="${v}" ${(draft.equipment||[]).includes(v)?'checked':''}> ${l}
            </label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lesiones o historial físico (opcional)</label>
        <input id="ob-injuries" class="form-input" placeholder="ej: Esguince tobillo izquierdo 2024" value="${draft.injuries||''}">
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" onclick="ONBOARDING.prev()" style="width:auto;padding:10px 20px">← Atrás</button>
        <button class="btn-primary" onclick="ONBOARDING.finish()">✓ Guardar perfil</button>
      </div>
    </div>`,
  ];

  function render() { document.getElementById('ob-content').innerHTML = STEPS[step](); }
  function next() { step = Math.min(step+1, TOTAL-1); render(); }
  function prev() { step = Math.max(step-1, 0); render(); }

  function s1() { if (!draft.role) { showToast('Seleccioná quién sos', 'error'); return; } next(); }
  function s2() {
    const name = document.getElementById('ob-name')?.value.trim();
    if (!name) { showToast('Ingresá tu nombre', 'error'); return; }
    draft.name = name;
    draft.age = parseInt(document.getElementById('ob-age')?.value)||17;
    draft.experience = parseInt(document.getElementById('ob-exp')?.value)||0;
    draft.height = parseFloat(document.getElementById('ob-height')?.value)||0;
    draft.weight = parseFloat(document.getElementById('ob-weight')?.value)||0;
    draft.team = document.getElementById('ob-team')?.value.trim();
    next();
  }
  function s3() {
    if (!draft.position) { showToast('Seleccioná tu posición', 'error'); return; }
    draft.level = document.getElementById('ob-level')?.value;
    next();
  }
  function s4() {
    draft.jump_record = parseFloat(document.getElementById('ob-jump')?.value)||0;
    draft.reach = parseFloat(document.getElementById('ob-reach')?.value)||0;
    draft.attack_style = document.getElementById('ob-attack')?.value;
    draft.weaknesses = [...document.querySelectorAll('.ob-weak:checked')].map(e=>e.value);
    next();
  }
  async function finish() {
    draft.goals = document.getElementById('ob-goal')?.value;
    draft.equipment = [...document.querySelectorAll('.ob-equip:checked')].map(e=>e.value);
    draft.injuries = document.getElementById('ob-injuries')?.value.trim();
    draft.onboarded = true;
    const { error } = await saveProfile(draft);
    if (error) { showToast('Error al guardar: ' + error.message, 'error'); return; }
    if (draft.jump_record > 0) {
      await sb.from('jump_records').insert({ user_id: CURRENT_USER.id, value: draft.jump_record, type: 'vertical', notes: 'Registro inicial del perfil' });
    }
    document.getElementById('modal-onboarding').style.display = 'none';
    showToast(`¡Perfil guardado! Bienvenido, ${draft.name} 🏐`, 'success');
    DASHBOARD.init();
    RANKING.init();
  }

  function open() {
    draft = { ...(window.CURRENT_PROFILE || {}) };
    step = 0;
    document.getElementById('modal-onboarding').style.display = 'flex';
    render();
  }
  function reopen() { open(); }

  function initIfNeeded() {
    if (!CURRENT_PROFILE?.onboarded) open();
  }

  return { initIfNeeded, open, reopen, next, prev, s1, s2, s3, s4, finish };
})();

window.ONBOARDING = ONBOARDING;


/* ============================================================
   DASHBOARD
   ============================================================ */
const DASHBOARD = (() => {
  const TIPS = [
    "El salto vertical se mejora con consistencia — 3 series de pliométricos 3x/semana durante 8 semanas = +5cm garantizados.",
    "La técnica de batida importa más que la fuerza pura. Trabajá el timing de los últimos dos pasos antes del despegue.",
    "Hidratación: 500ml de agua con electrolitos 2 horas antes de entrenar mejora el rendimiento hasta un 12%.",
    "El bloqueo eficiente no es solo saltar alto — es leer el hombro del atacante antes de que baje el balón.",
    "El sueño es tu suplemento gratuito. 8 horas = más recuperación muscular, mejor timing de reacción.",
    "En el saque flotante: lanzá la pelota sin spin, impactá el centro con la base de la palma.",
    "La recepción perfecta empieza en los pies: plataforma baja, rodillas dobladas, peso adelante.",
    "Un calentamiento de 10 minutos reduce el riesgo de lesión de rodilla y tobillo en un 40%.",
    "La mentalidad de clutch se entrena: visualizá el punto ganado antes de entrar a servir en el 20+.",
    "El foam roller post-entrenamiento en cuádriceps y gemelos = menos dolor muscular al día siguiente."
  ];

  async function init() {
    const p = window.CURRENT_PROFILE;
    if (!p) return;
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('dash-greeting').textContent = `¡${greeting}, ${p.name || 'Atleta'}! 🏐`;
    document.getElementById('dash-date').textContent = now.toLocaleDateString('es-PY', { weekday:'long', day:'numeric', month:'long' });

    const pos = POSITIONS[p.position];
    document.getElementById('dash-avatar').textContent = pos?.emoji || '🏐';
    document.getElementById('dash-name').textContent = p.name || '—';
    document.getElementById('dash-pos').textContent = pos?.label || '—';
    document.getElementById('dash-team').textContent = p.team || '—';
    document.getElementById('d-age').textContent = p.age || '—';
    document.getElementById('d-height').textContent = p.height || '—';
    document.getElementById('d-weight').textContent = p.weight || '—';

    // Jumps
    const { data: jumps } = await sb.from('jump_records').select('value,created_at').eq('user_id', CURRENT_USER.id).order('created_at', { ascending: false }).limit(5);
    const maxJ = jumps?.length > 0 ? Math.max(...jumps.map(j=>j.value)) : (p.jump_record||0);
    document.getElementById('d-jump').textContent = maxJ || '—';

    // Recent jumps
    const rjEl = document.getElementById('dash-recent-jumps');
    if (jumps?.length > 0) {
      rjEl.innerHTML = jumps.slice(0,3).map(j=>`
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
          <span style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:var(--accent)">${j.value} cm</span>
          <span style="color:var(--text-muted)">${new Date(j.created_at).toLocaleDateString('es-PY',{day:'numeric',month:'short'})}</span>
        </div>`).join('');
    }

    // Level
    const lvlMap = { principiante:'PRINCIPIANTE', intermedio:'INTERMEDIO', avanzado:'AVANZADO', competitivo:'COMPETITIVO' };
    document.getElementById('dash-level').innerHTML = `<span style="font-family:Rajdhani,sans-serif;font-size:26px;font-weight:700;color:var(--accent)">${lvlMap[p.level]||'—'}</span>`;

    // Tournament
    await renderTournament();

    // Wellness
    const { data: wData } = await sb.from('wellness_checks').select('*').eq('user_id', CURRENT_USER.id).gte('created_at', new Date().toISOString().slice(0,10)+'T00:00:00').limit(1);
    const w = wData?.[0];
    const wEl = document.getElementById('dash-wellness-snap');
    if (w) {
      const score = Math.round(((w.legs/10)+(1-w.stress/10)+Math.min(w.sleep/8,1)+(1-w.pain/10))/4*10);
      const emoji = score>=7?'🟢':score>=5?'🟡':'🔴';
      wEl.innerHTML = `<div style="text-align:center;padding:8px 0"><div style="font-size:32px;margin-bottom:6px">${emoji}</div><div style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;color:var(--accent)">${score}/10</div><div style="font-size:11px;color:var(--text-muted)">Bienestar hoy</div></div>`;
    }

    // Tip
    document.getElementById('dash-tip').textContent = TIPS[Math.floor(Math.random()*TIPS.length)];
  }

  async function renderTournament() {
    const { data: tournaments } = await sb.from('tournaments').select('*').eq('user_id', CURRENT_USER.id).gte('date', new Date().toISOString().slice(0,10)).order('date').limit(1);
    const el = document.getElementById('dash-tournament-content');
    const t = tournaments?.[0];
    if (!t) return;
    const days = daysUntil(t.date);
    const color = days<=7?'#EF4444':days<=14?'#F59E0B':'var(--accent)';
    el.innerHTML = `
      <div style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;margin-bottom:4px">${t.name}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${formatDate(t.date)} · ${t.location||'Sin lugar'}</div>
      <div style="font-family:Rajdhani,sans-serif;font-size:42px;font-weight:700;color:${color};text-shadow:0 0 20px ${color}40;margin-bottom:4px">${days===0?'¡HOY!':days===1?'1 DÍA':days+' DÍAS'}</div>
      <div style="font-size:12px;color:var(--text-sub)">${days<=7?'⚠️ Semana de torneo — reducí la carga':days<=14?'🔥 Fase pico — máxima intensidad':'📈 Fase de construcción'}</div>`;
  }

  return { init };
})();
window.DASHBOARD = DASHBOARD;


/* ============================================================
   RANKING
   ============================================================ */
const RANKING = (() => {
  let chart = null;
  const POOL = [
    {name:'L. Amarilla',team:'C.N. CDE',position:'punta',jump:78,reach:335},
    {name:'R. Domínguez',team:'Liceo Naval',position:'opuesto',jump:74,reach:328},
    {name:'F. Aquino',team:'Área 4',position:'central',jump:72,reach:330},
    {name:'M. Villalba',team:'B. Vera Cué',position:'punta',jump:70,reach:322},
    {name:'D. González',team:'San Blas',position:'opuesto',jump:68,reach:318},
    {name:'A. Cáceres',team:'Col. Sto. Tomás',position:'central',jump:66,reach:320},
    {name:'E. Benítez',team:'C.N. Hernandarias',position:'punta',jump:64,reach:312},
    {name:'K. Fleitas',team:'AEBU',position:'armador',jump:62,reach:308},
    {name:'N. Ortiz',team:'Pindo',position:'libero',jump:58,reach:295},
    {name:'T. Martínez',team:'Itakyry',position:'opuesto',jump:50,reach:298},
  ];

  async function logJump() {
    const val = parseFloat(document.getElementById('jump-val').value);
    const type = document.getElementById('jump-type').value;
    const notes = document.getElementById('jump-notes').value.trim();
    if (!val||val<10||val>130) { showToast('Valor inválido (10-130 cm)', 'error'); return; }
    const { error } = await sb.from('jump_records').insert({ user_id: CURRENT_USER.id, value: val, type, notes });
    if (error) { showToast('Error al guardar', 'error'); return; }
    document.getElementById('jump-val').value = '';
    document.getElementById('jump-notes').value = '';
    showToast(`Salto registrado: ${val} cm 🏐`, 'success');
    await init();
  }

  async function init() {
    const p = CURRENT_PROFILE;
    if (!p) return;
    const { data: jumps } = await sb.from('jump_records').select('*').eq('user_id', CURRENT_USER.id).order('created_at', { ascending: false }).limit(20);
    renderRecords(jumps||[]);
    renderChart(jumps||[]);
    renderHistory(jumps||[]);
    renderRanking(jumps||[]);
  }

  function renderRecords(jumps) {
    if (!jumps.length) return;
    const byType = {};
    jumps.forEach(j => { if (!byType[j.type]||j.value>byType[j.type]) byType[j.type]=j.value; });
    const labels = {vertical:'Vertical',bloqueo:'Bloqueo',remate:'Remate'};
    document.getElementById('ranking-records').innerHTML = Object.entries(byType).map(([t,v])=>`
      <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:10px;text-align:center;border:1px solid var(--border)">
        <div style="font-family:Rajdhani,sans-serif;font-size:28px;font-weight:700;color:var(--accent);text-shadow:0 0 12px var(--accent-glow)">${v}</div>
        <div style="font-size:9px;color:var(--text-muted)">cm ${labels[t]||t}</div>
      </div>`).join('');
  }

  function renderChart(jumps) {
    const ctx = document.getElementById('jump-chart');
    if (!ctx||!jumps.length) return;
    const data = [...jumps].slice(0,12).reverse();
    const labels = data.map(j=>new Date(j.created_at).toLocaleDateString('es-PY',{day:'numeric',month:'short'}));
    const values = data.map(j=>j.value);
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[{ data:values, borderColor:'var(--accent)', backgroundColor:'rgba(var(--accent-rgb),0.1)', borderWidth:2, pointBackgroundColor:'var(--accent)', pointRadius:4, fill:true, tension:0.3 }] },
      options:{ responsive:true, plugins:{legend:{display:false},tooltip:{bodyColor:'#F0F4FF',backgroundColor:'#0D1117',borderColor:'var(--accent)',borderWidth:1}}, scales:{ x:{ticks:{color:'#4A5568',font:{size:10}},grid:{color:'rgba(255,255,255,0.05)'}}, y:{ticks:{color:'#4A5568',font:{size:10}},grid:{color:'rgba(255,255,255,0.05)'},beginAtZero:false} } }
    });
  }

  function renderHistory(jumps) {
    const el = document.getElementById('jump-history');
    const types = {vertical:'Vertical',bloqueo:'Bloqueo',remate:'Remate'};
    el.innerHTML = jumps.slice(0,5).map(j=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:6px;font-size:12px">
        <span style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:var(--accent)">${j.value} cm</span>
        <span style="color:var(--text-muted)">${types[j.type]||j.type}</span>
        <span style="color:var(--text-muted)">${new Date(j.created_at).toLocaleDateString('es-PY',{day:'numeric',month:'short'})}</span>
        <button onclick="RANKING.deleteJump('${j.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px">✕</button>
      </div>`).join('') || '<div style="color:var(--text-muted);font-size:12px">Sin registros</div>';
  }

  async function deleteJump(id) {
    await sb.from('jump_records').delete().eq('id', id);
    showToast('Registro eliminado');
    await init();
  }

  function renderRanking(jumps) {
    const p = CURRENT_PROFILE;
    const maxJ = jumps.length>0?Math.max(...jumps.map(j=>j.value)):(p.jump_record||45);
    const reach = p.reach||(p.height?Math.round(p.height*1.33):295);
    const pool = [...POOL, {name:p.name||'Vos',team:p.team||'Tu equipo',position:p.position||'punta',jump:maxJ,reach,isUser:true}];
    pool.forEach(pl=>{ pl.pts=Math.round(pl.jump*2+pl.reach*0.5); });
    pool.sort((a,b)=>b.pts-a.pts);
    const posL={punta:'Punta',opuesto:'Opuesto',central:'Central',armador:'Armador',libero:'Líbero'};
    const medals=['🥇','🥈','🥉'];
    document.getElementById('ranking-tbody').innerHTML = pool.map((pl,i)=>`
      <tr class="${pl.isUser?'is-user':''}">
        <td><span class="rank-pos ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i<3?medals[i]:i+1}</span></td>
        <td><strong>${pl.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${pl.team}</span></td>
        <td>${posL[pl.position]||pl.position}</td>
        <td><span class="rank-jump">${pl.jump}</span> <span style="font-size:11px;color:var(--text-muted)">cm</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${pl.reach} cm</td>
        <td><strong style="color:var(--accent)">${pl.pts}</strong></td>
      </tr>`).join('');
  }

  return { init, logJump, deleteJump };
})();
window.RANKING = RANKING;

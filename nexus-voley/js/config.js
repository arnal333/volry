/* ============================================================
   CONFIG — Temas, constantes, utilidades globales
   ============================================================ */
const CONFIG = {
  API_URL: '/api/ai',
  MODEL: 'gemini-3.6-flash',
  MAX_TOKENS: 3000,
  APP_NAME: 'NEXUS VOLEY'
};

const THEMES = [
  { name: 'Nexus Indigo', color: '#6366F1', color2: '#8B5CF6', rgb: '99,102,241' },
  { name: 'Electric Blue', color: '#2563EB', color2: '#06B6D4', rgb: '37,99,235' },
  { name: 'Cyber Green', color: '#10B981', color2: '#34D399', rgb: '16,185,129' },
  { name: 'Fire Red', color: '#EF4444', color2: '#F97316', rgb: '239,68,68' },
  { name: 'Solar Gold', color: '#F59E0B', color2: '#FBBF24', rgb: '245,158,11' },
  { name: 'Violet', color: '#8B5CF6', color2: '#A78BFA', rgb: '139,92,246' },
  { name: 'Rose', color: '#EC4899', color2: '#F472B6', rgb: '236,72,153' },
  { name: 'Steel', color: '#64748B', color2: '#94A3B8', rgb: '100,116,139' },
];

const POSITIONS = {
  punta:    { label: 'Punta Atacante', emoji: '🏐', short: 'Punta' },
  opuesto:  { label: 'Opuesto',        emoji: '🔥', short: 'Opuesto' },
  central:  { label: 'Central',        emoji: '🏰', short: 'Central' },
  armador:  { label: 'Armador',        emoji: '🧠', short: 'Armador' },
  libero:   { label: 'Líbero',         emoji: '🛡️', short: 'Líbero' },
  receptor: { label: 'Receptor',       emoji: '📥', short: 'Receptor' },
};

// ---- GLOBAL UTILITIES ----

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 3000);
}

function mdToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)/gm, '<h4 style="color:var(--accent);margin:10px 0 4px;font-family:Rajdhani,sans-serif;font-size:15px">$1</h4>')
    .replace(/^## (.+)/gm,  '<h3 style="color:var(--accent);margin:12px 0 6px;font-family:Rajdhani,sans-serif;font-size:17px">$1</h3>')
    .replace(/^- (.+)/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, s => `<ul style="padding-left:18px;margin:6px 0">${s}</ul>`)
    .replace(/\n{2,}/g, '</p><p style="margin:8px 0">')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hul])(.+)$/gm, (m) => m.trim() ? `<p style="margin:6px 0">${m}</p>` : m);
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  const target = new Date(dateStr + 'T12:00:00');
  return Math.ceil((target - new Date()) / 86400000);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('tab-' + name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.menu-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('menu-overlay')?.classList.remove('open');
  document.getElementById('menu-drawer')?.classList.remove('open');
  document.querySelector('.menu-btn')?.classList.remove('open');
  window.scrollTo(0, 0);
  if (window.APP?.onTab) APP.onTab(name);
}

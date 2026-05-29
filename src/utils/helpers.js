// ════════════════════════════════════════════════════════
//  EANDRES SIL — Helpers compartidos
//  Funciones puras usadas en todas las vistas
// ════════════════════════════════════════════════════════

// ── Seguridad: escape HTML para prevenir XSS ─────────────
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Badge de estado de expediente ────────────────────────
export function badgeEstado(estado) {
  const norm  = (estado || '').trim();
  const key   = norm.toLowerCase().replace(/\s+/g, '');
  const cssMap = {
    activo: 'active', pendiente: 'pending', urgente: 'urgent',
    cerrado: 'closed', enestudio: 'study', estudio: 'study'
  };
  const labelMap = {
    activo: 'Activo', pendiente: 'Pendiente', urgente: 'Urgente',
    cerrado: 'Cerrado', enestudio: 'En Estudio', estudio: 'En Estudio'
  };
  const css   = cssMap[key]   || 'active';
  const label = labelMap[key] || norm || 'Activo';
  return `<span class="badge badge-${css}">${label}</span>`;
}

// ── Cálculo de vencimiento próximo ───────────────────────
export function calcVencimiento(fechaStr) {
  if (!fechaStr) return { texto: '', color: 'var(--muted)', icono: '' };
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaStr); venc.setHours(0, 0, 0, 0);
  const diff = Math.round((venc - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { texto: `Venció hace ${Math.abs(diff)}d`, color: '#c0392b',      icono: '🔴' };
  if (diff === 0) return { texto: 'Vence HOY',                      color: '#c0392b',      icono: '🚨' };
  if (diff === 1) return { texto: 'Vence mañana',                   color: '#e67e22',      icono: '🟠' };
  if (diff <= 7)  return { texto: `${diff} días`,                   color: '#e67e22',      icono: '⚠️' };
  if (diff <= 30) return { texto: `${diff} días`,                   color: '#f39c12',      icono: '📅' };
  return              { texto: `${diff} días`,                      color: 'var(--muted)', icono: '📅' };
}

// ── Formato moneda en pesos ──────────────────────────────
export function fmtPeso(n) {
  if (!n || isNaN(n)) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString('es-AR');
}

// ── Formato fecha YYYY-MM-DD → DD/MM/YYYY ────────────────
export function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day || '?'}/${m || '?'}/${y || '?'}`;
}

// ── Toast de notificación ─────────────────────────────────
export function showToast(msg) {
  const existing = document.getElementById('eandres-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'eandres-toast';
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0F2244;color:#fff;'
    + 'padding:11px 18px;border-radius:10px;z-index:99999;font-size:13px;'
    + 'font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.3);transition:opacity .3s';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

// ── Bridge global (permite llamadas desde HTML y código legacy) ──
window.escapeHtml    = escapeHtml;
window.badgeEstado   = badgeEstado;
window.calcVencimiento = calcVencimiento;
window.fmtPeso       = fmtPeso;
window.fmtDate       = fmtDate;
window.showToast     = showToast;

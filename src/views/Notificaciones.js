// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Notificaciones y alertas
// ════════════════════════════════════════════════════════

import { escapeHtml } from '../utils/helpers.js';

// ── Verificar y disparar alertas de vencimiento ──────────
export function checkAlertasVencimiento() {
  if (!window._allExpedientes) return;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const proximos = window._allExpedientes
    .filter(e => {
      const fv = e.proxVencimiento || e.fechaVencimiento || '';
      if (!fv) return false;
      const venc = new Date(fv);
      if (isNaN(venc)) return false;
         const diff = Math.round((venc - hoy) / 86400000);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) =>
      new Date(a.proxVencimiento || a.fechaVencimiento) -
      new Date(b.proxVencimiento || b.fechaVencimiento)
    );

  const urgentes = proximos.filter(e =>
    Math.round((new Date(e.proxVencimiento || e.fechaVencimiento) - hoy) / 86400000) <= 2
  );

  // Badge campana
  const badge = document.querySelector('.notif-badge');
  if (badge) badge.textContent = proximos.length || '';

  renderPanelNotificaciones(proximos);

  if (urgentes.length > 0 && !window._alertaVencMostrada) {
    window._alertaVencMostrada = true;
    solicitarPermisosNotif().then(ok => {
      if (ok) {
        urgentes.forEach(e => {
          const diff  = Math.round((new Date(e.proxVencimiento || e.fechaVencimiento) - hoy) / 86400000);
          const cuando = diff === 0 ? 'HOY' : diff === 1 ? 'mañana' : 'en ' + diff + ' días';
          new Notification('⚠️ Vencimiento EANDRES', {
            body: e.caratula + '\nVence ' + cuando,
            icon: '/favicon.ico',
            tag:  e.id
          });
        });
      } else {
        mostrarToastAlerta(urgentes);
      }
    });
  }
}

// ── Solicitar permisos de notificación del browser ───────
export async function solicitarPermisosNotif() {
  if (!('Notification' in window))          return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  return (await Notification.requestPermission()) === 'granted';
}

// ── Toast visual de urgencia (fallback sin permisos) ─────
export function mostrarToastAlerta(urgentes) {
  const existing = document.getElementById('toast-venc');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-venc';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--burgundy);'
    + 'color:#fff;padding:16px 20px;border-radius:12px;z-index:99999;max-width:340px;'
    + 'box-shadow:0 8px 32px rgba(0,0,0,.3);cursor:pointer;font-size:13px';

  const s  = urgentes.length > 1 ? 's' : '';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  toast.innerHTML =
    `<div style="font-weight:700;margin-bottom:8px">⚠️ ${urgentes.length} vencimiento${s} urgente${s} próximo${s}</div>` +
    urgentes.map(e => {
      const diff   = Math.round((new Date(e.proxVencimiento || e.fechaVencimiento) - hoy) / 86400000);
      const cuando = diff === 0 ? 'HOY' : diff === 1 ? 'mañana' : 'en ' + diff + ' días';
      return `<div style="font-size:12px;opacity:.9;margin-top:4px">• ${escapeHtml(e.caratula.substring(0, 50))}... — <strong>${cuando}</strong></div>`;
    }).join('') +
    '<div style="font-size:11px;margin-top:10px;opacity:.7">Click para ver expedientes</div>';

  toast.onclick = () => { window.navigate?.('expedientes'); toast.remove(); };
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) { toast.style.opacity = '0'; toast.style.transition = 'opacity .5s'; }
    setTimeout(() => toast.remove(), 500);
  }, 8000);
}

// ── Panel lateral de notificaciones ─────────────────────
export function renderPanelNotificaciones(proximos) {
  const panel = document.getElementById('notif-panel-list');
  if (!panel) return;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  if (!proximos.length) {
    panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">✅ Sin vencimientos próximos</div>';
    return;
  }

  panel.innerHTML = proximos.map(e => {
    const diff   = Math.round((new Date(e.proxVencimiento || e.fechaVencimiento) - hoy) / 86400000);
    const cuando = diff === 0
      ? '<span style="color:var(--burgundy);font-weight:700">HOY</span>'
      : diff === 1
        ? '<span style="color:var(--burgundy)">Mañana</span>'
        : `<span style="color:var(--gold)">En ${diff} días</span>`;

    return `<div style="padding:12px 16px;border-bottom:1px solid var(--border-light);cursor:pointer;display:flex;justify-content:space-between;align-items:center"
      onclick="openExpediente('${e.id}');document.getElementById('notif-panel').style.display='none'">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${escapeHtml(e.caratula.substring(0, 45))}${e.caratula.length > 45 ? '...' : ''}</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:2px">${escapeHtml(e.numero || 'S/N')} · ${escapeHtml(e.fuero || '—')}</div>
      </div>
      <div style="text-align:right;font-size:12px;white-space:nowrap;margin-left:12px">${cuando}</div>
    </div>`;
  }).join('');
}

// ── Bridge global ─────────────────────────────────────────
window.checkAlertasVencimiento  = checkAlertasVencimiento;
window.solicitarPermisosNotif   = solicitarPermisosNotif;
window.mostrarToastAlerta       = mostrarToastAlerta;
window.renderPanelNotificaciones = renderPanelNotificaciones;

// ════════════════════════════════════════════════════════
//  EANDRES SIL — App Router & UI Shell
//  navigate, modales, sync indicators, login, notif panel
// ════════════════════════════════════════════════════════

const TITLES = {
  dashboard:          'Panel Principal',
  expedientes:        'Expedientes',
  clientes:           'Clientes',
  agenda:             'Agenda',
  honorarios:         'Honorarios',
  documentos:         'Documentos',
  reportes:           'Reportes',
  notificaciones:     'Notificaciones',
  configuracion:      'Configuración',
  'expediente-detail':'Detalle de Expediente',
  'busqueda-judicial':   'Búsqueda Judicial',
  'consulta-judicial':   'Consulta Tribunales',
  cowork:                'Cowork Log',
  biblioteca:            'Biblioteca Legal',
};

// ── Navegación entre vistas ───────────────────────────────
export function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('onclick')?.includes("'" + view + "'")) item.classList.add('active');
  });
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = TITLES[view] || view;
  window.scrollTo(0, 0);
  if (view === 'clientes'      && window._fbUser) window.suscribirClientes?.();
  if (view === 'agenda'        && window._fbUser) window.suscribirEventos?.();
  if (view === 'honorarios'    && window._fbUser) window.suscribirHonorarios?.();
  if (view === 'configuracion') { openModal('modal-perfil'); window.cargarConfigEstudio?.(); window.fbCargarPerfil?.(); }
}

// ── Modales ───────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  else console.warn('Modal not found:', id);
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

export function showAIModal() { openModal('modal-ai'); }

// Cerrar modal al clickear overlay
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

// ── Indicadores de sincronización ────────────────────────
export function setSyncing() {
  const d = document.getElementById('sync-dot');
  if (d) { d.className = 'sync-dot syncing'; document.getElementById('sync-txt').textContent = 'Guardando...'; }
}
export function setSyncOk() {
  const d = document.getElementById('sync-dot');
  if (d) { d.className = 'sync-dot'; document.getElementById('sync-txt').textContent = 'Sincronizado ☁'; }
}
export function setSyncErr() {
  const d = document.getElementById('sync-dot');
  if (d) { d.className = 'sync-dot error'; document.getElementById('sync-txt').textContent = 'Error de conexión'; }
}

// ── Login con Google ──────────────────────────────────────
export function loginGoogle() {
  const fb     = window._fb;
  const btn    = document.querySelector('.google-btn');
  const errEl  = document.getElementById('login-error');
  if (!fb?.auth) { if (errEl) errEl.textContent = 'Error: Firebase no inicializado.'; return; }
  if (btn)   { btn.disabled = true; btn.textContent = 'Conectando...'; }
  if (errEl) errEl.textContent = '';
  const resetBtn = () => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" style="margin-right:8px"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Ingresar con Google';
    }
  };
  fb.signInWithPopup(fb.auth, fb.provider)
    .then(() => {})
    .catch(err => {
      const popup = ['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'];
      if (popup.includes(err.code)) {
        if (btn) btn.textContent = 'Redirigiendo...';
        fb.signInWithRedirect(fb.auth, fb.provider).catch(e => { resetBtn(); if (errEl) errEl.textContent = 'Error: ' + e.message; });
      } else if (err.code === 'auth/unauthorized-domain') {
        resetBtn(); if (errEl) errEl.textContent = 'Error: dominio no autorizado en Firebase.';
      } else {
        resetBtn(); if (errEl) errEl.textContent = 'Error al ingresar: ' + err.message;
      }
    });
}

// ── Panel de notificaciones ───────────────────────────────
export function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  panel.style.flexDirection = 'column';
  if (!isOpen) window.checkAlertasVencimiento?.();
}

document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn   = document.getElementById('btn-notif');
  if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) panel.style.display = 'none';
});

// ── Móvil sidebar ─────────────────────────────────────────
export function toggleMobileSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.toggle('mobile-open');
  if (o) o.style.display = s?.classList.contains('mobile-open') ? 'block' : 'none';
}
export function closeMobileSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.remove('mobile-open');
  if (o) o.style.display = 'none';
}

// Swipe gesture to open/close sidebar on mobile
(function() {
  let startX = 0;
  document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -60) closeMobileSidebar();
    if (dx > 60 && startX < 40) toggleMobileSidebar();
  }, { passive: true });
})();

// ── Bridge global ─────────────────────────────────────────
window.navigate             = navigate;
window.openModal            = openModal;
window.closeModal           = closeModal;
window.showAIModal          = showAIModal;
window.setSyncing           = setSyncing;
window.setSyncOk            = setSyncOk;
window.setSyncErr           = setSyncErr;
window.loginGoogle          = loginGoogle;
window.toggleNotifPanel     = toggleNotifPanel;
window.toggleMobileSidebar  = toggleMobileSidebar;
window.closeMobileSidebar   = closeMobileSidebar;

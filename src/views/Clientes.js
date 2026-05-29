// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Clientes
// ════════════════════════════════════════════════════════

import { escapeHtml } from '../utils/helpers.js';
import { db, onSnapshot, collection, doc, setDoc, deleteDoc } from '../services/firebase.js';

// Estado local del módulo
let _currentClienteId = null;

const COLORS = [
  'linear-gradient(135deg,#2c3e50,#4a6278)',
  'linear-gradient(135deg,#6b1f2a,#8b3040)',
  'linear-gradient(135deg,#2d6a4f,#3d8a65)',
  'linear-gradient(135deg,#b8935a,#d4aa73)',
  'linear-gradient(135deg,#1a4a6b,#2c6ea0)'
];

// ── Suscripción en tiempo real ────────────────────────────
export function suscribirClientes() {
  if (window._unsubClientes) window._unsubClientes();
  const uid = window._fbUser?.uid; if (!uid) return;

  window._unsubClientes = onSnapshot(
    collection(db, `lexia/${uid}/clientes`),
    snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
      window.allClientes    = lista;
      window._allClientes   = lista;
      window.poblarSelectsModales?.();
      renderClientes();
      const kpi = document.querySelector('.kpi-clientes');
      if (kpi) kpi.textContent = lista.length;
      window.setSyncOk?.();
    },
    () => window.setSyncErr?.()
  );
}

// ── Render del grid de clientes ───────────────────────────
export function renderClientes() {
  const grid = document.getElementById('clientes-grid');
  if (!grid) return;

  const q    = (document.getElementById('cl-search')?.value || '').toLowerCase();
  const list = (window.allClientes || []).filter(c =>
    !q || [c.nombre, c.cuit, c.email].join(' ').toLowerCase().includes(q)
  );

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted);font-size:13px">${
      q ? 'Sin resultados para "' + escapeHtml(q) + '"' : 'No hay clientes todavía. Creá el primero →'
    }</div>`;
    return;
  }

  grid.innerHTML = list.map((c, i) => {
    const initials = (c.nombre || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const expCount = (window._allExpedientes || []).filter(e =>
      (e.cliente || '').trim().toLowerCase() === (c.nombre || '').trim().toLowerCase()
    ).length;

    return `<div class="card" style="padding:20px;cursor:pointer;transition:all .2s"
      onclick="verExpedientesCliente('${c.id}','${(c.nombre || '').replace(/'/g, '&#39;')}')"
      onmouseover="this.style.borderColor='var(--gold)'"
      onmouseout="this.style.borderColor='var(--border-light)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:${COLORS[i % COLORS.length]};display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#fff">${initials}</div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditClienteModal('${c.id}')" title="Editar">✎</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteCliente('${c.id}')" title="Eliminar" style="color:var(--danger)">🗑</button>
        </div>
      </div>
      <div style="font-size:14px;font-weight:600;color:var(--ink)">${escapeHtml(c.nombre)}</div>
      ${c.cuit     ? `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);margin-top:2px">CUIT: ${escapeHtml(c.cuit)}</div>` : ''}
      ${c.email    ? `<div style="font-size:11.5px;color:var(--muted);margin-top:2px">✉ ${escapeHtml(c.email)}</div>` : ''}
      ${c.telefono ? `<div style="font-size:11.5px;color:var(--muted);margin-top:1px">📞 ${escapeHtml(c.telefono)}</div>` : ''}
      <div style="display:flex;gap:14px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-light)">
        <div style="font-size:12px;color:var(--muted)"><strong style="color:var(--ink);font-size:14px;display:block">${expCount}</strong>Expedientes</div>
        ${c.domicilio ? `<div style="font-size:11px;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📍 ${escapeHtml(c.domicilio)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Filtrar expedientes por cliente ──────────────────────
export function verExpedientesCliente(clienteId, nombre) {
  window.navigate?.('expedientes');
  setTimeout(() => {
    const s = document.getElementById('exp-search');
    if (s) { s.value = nombre; s.dispatchEvent(new Event('input')); }
    window.filterExpedientes?.(nombre);
  }, 600);
}

// ── Modal editar cliente ──────────────────────────────────
export function openEditClienteModal(id) {
  const c = (window.allClientes || []).find(x => x.id === id);
  if (!c) return;
  _currentClienteId = id;
  const map = { tipo: 'tipo', nombre: 'nombre', cuit: 'cuit', tel: 'telefono', email: 'email', dom: 'domicilio', notas: 'notas' };
  ['ecl-tipo','ecl-nombre','ecl-cuit','ecl-tel','ecl-email','ecl-dom','ecl-notas'].forEach(fid => {
    const key = fid.replace('ecl-', '');
    const el  = document.getElementById(fid);
    if (el) el.value = c[map[key]] || '';
  });
  window.openModal?.('modal-editar-cliente');
}

export async function saveEditCliente() {
  if (!_currentClienteId) { alert('Error: no hay cliente seleccionado.'); return; }
  const g    = id => document.getElementById(id)?.value?.trim() || '';
  const nombre = g('ecl-nombre');
  if (!nombre) { alert('El nombre es obligatorio'); return; }

  const data = {
    tipo:      g('ecl-tipo') || 'Persona Física',
    nombre,
    cuit:      g('ecl-cuit'),
    telefono:  g('ecl-tel'),
    email:     g('ecl-email'),
    domicilio: g('ecl-dom'),
    notas:     document.getElementById('ecl-notas')?.value?.trim() || ''
  };

  try {
    window.setSyncing?.();
    const uid = window._fbUser.uid;
    await setDoc(doc(db, `lexia/${uid}/clientes/${_currentClienteId}`), data, { merge: true });
    const idx = (window.allClientes || []).findIndex(x => x.id === _currentClienteId);
    if (idx >= 0) window.allClientes[idx] = { ...window.allClientes[idx], ...data };
    window._allClientes = window.allClientes;
    window.closeModal?.('modal-editar-cliente');
    _currentClienteId = null;
    renderClientes();
    window.poblarSelectsModales?.();
    window.setSyncOk?.();
  } catch (e) {
    window.setSyncErr?.();
    alert('Error al guardar: ' + e.message);
  }
}

export async function deleteCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  await deleteDoc(doc(db, `lexia/${uid}/clientes/${id}`));
}

// ── Bridge global ─────────────────────────────────────────
window.suscribirClientes      = suscribirClientes;
window.renderClientes         = renderClientes;
window.verExpedientesCliente  = verExpedientesCliente;
window.openEditClienteModal   = openEditClienteModal;
window.saveEditCliente        = saveEditCliente;
window.deleteCliente          = deleteCliente;

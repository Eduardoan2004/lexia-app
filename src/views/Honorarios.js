// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Honorarios
// ════════════════════════════════════════════════════════

import { escapeHtml } from '../utils/helpers.js';
import { db, collection, doc, onSnapshot, deleteDoc } from '../services/firebase.js';

// ── Suscripción en tiempo real ────────────────────────────
export function suscribirHonorarios() {
  if (window._unsubHon) window._unsubHon();
  const uid = window._fbUser?.uid; if (!uid) return;
  window._unsubHon = onSnapshot(
    collection(db, `lexia/${uid}/honorarios`),
    snap => {
      window.allHonorarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderHonorarios();
      window.setSyncOk?.();
    },
    () => window.setSyncErr?.()
  );
}

// ── Render de la tabla de honorarios ─────────────────────
export function renderHonorarios() {
  const tbody = document.getElementById('hon-table-body');
  if (!tbody) return;

  const lista   = window.allHonorarios || [];
  const fmt     = n => '$' + Number(n).toLocaleString('es-AR');
  let total = 0, cobrado = 0;
  lista.forEach(h => {
    total   += h.monto || 0;
    if ((h.estado || '').toLowerCase() === 'cobrado') cobrado += h.monto || 0;
  });

  const kT = document.getElementById('hon-kpi-total');
  const kC = document.getElementById('hon-kpi-cobrado');
  const kP = document.getElementById('hon-kpi-pendiente');
  if (kT) kT.textContent = fmt(total);
  if (kC) kC.textContent = fmt(cobrado);
  if (kP) kP.textContent = fmt(total - cobrado);

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:28px;font-size:13px">Sin registros. Creá el primero →</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(h => `<tr>
    <td style="font-size:12px;color:var(--muted)">${escapeHtml(h.fecha || '—')}</td>
    <td><span class="exp-num">${escapeHtml(h.expediente || h.expedienteId || '—')}</span></td>
    <td style="font-size:13px">${escapeHtml(h.concepto || '—')}</td>
    <td style="font-family:'DM Mono',monospace;font-size:13px">${fmt(h.monto || 0)}</td>
    <td>${(h.estado === 'cobrado' || h.estado === 'Cobrado')
      ? '<span class="badge badge-active">Cobrado</span>'
      : '<span class="badge badge-pending">Pendiente</span>'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="deleteHonorario('${h.id}')" style="color:var(--danger)">🗑</button></td>
  </tr>`).join('');
}

// ── Eliminar honorario ────────────────────────────────────
export async function deleteHonorario(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  await deleteDoc(doc(db, `lexia/${uid}/honorarios/${id}`));
}

// ── Bridge global ─────────────────────────────────────────
window.suscribirHonorarios = suscribirHonorarios;
window.renderHonorarios    = renderHonorarios;
window.deleteHonorario     = deleteHonorario;

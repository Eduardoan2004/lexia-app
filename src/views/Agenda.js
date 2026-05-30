// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Agenda
// ════════════════════════════════════════════════════════

import { escapeHtml } from '../utils/helpers.js';
import { db, collection, doc, onSnapshot, query, orderBy, updateDoc, deleteDoc } from '../services/firebase.js';

let _agendaMesOffset = 0;

const TIPO_COLOR = {
  'Audiencia':           'var(--info)',
  'Vencimiento procesal':'var(--burgundy)',
  'Reunión':             'var(--gold)',
  'Mediación':           'var(--success)'
};

// ── Suscripción en tiempo real ────────────────────────────
export function suscribirEventos() {
  if (window._unsubEventos) window._unsubEventos();
  const uid = window._fbUser?.uid; if (!uid) return;
  window._unsubEventos = onSnapshot(
    query(collection(db, `lexia/${uid}/eventos`), orderBy('fecha')),
    snap => {
      window.allEventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAgenda();
      window.setSyncOk?.();
    },
    () => window.setSyncErr?.()
  );
}

// ── Navegación de mes ────────────────────────────────────
export function agendaNavMes(delta) {
  _agendaMesOffset += delta;
  renderAgenda();
}

// ── Render del listado de agenda ──────────────────────────
export function renderAgenda() {
  const list = document.getElementById('agenda-list');
  if (!list) return;

  const now    = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + _agendaMesOffset, 1);
  const mesNombre = target.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const label = document.getElementById('agenda-mes-label');
  if (label) label.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

  const mesStr  = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  const eventos = (window.allEventos || []).filter(e => e.fecha && e.fecha.startsWith(mesStr));

  if (!eventos.length) {
    list.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:40px;color:var(--muted);font-size:13px">Sin eventos en ${mesNombre}.<br><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openModal('modal-evento')">+ Agregar evento</button></div></div>`;
    return;
  }

  const groups = {};
  eventos.forEach(e => {
    if (!groups[e.fecha]) groups[e.fecha] = [];
    groups[e.fecha].push(e);
  });

  list.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, evs]) => {
      const d        = new Date(fecha + 'T12:00:00');
      const dayLabel = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const evHtml   = evs.map(ev => `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 16px;border-radius:10px;border:1px solid ${ev.cumplido ? 'rgba(45,106,79,.2)' : 'var(--border-light)'};background:${ev.cumplido ? 'rgba(45,106,79,.04)' : '#fff'};margin-bottom:8px;opacity:${ev.cumplido ? '.7' : '1'}"
             onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border-light)'">
          <div style="width:10px;height:10px;border-radius:50%;background:${TIPO_COLOR[ev.tipo] || 'var(--gold)'};flex-shrink:0;margin-top:4px"></div>
          ${ev.hora ? `<div style="min-width:52px;text-align:center;background:var(--cream);border-radius:7px;padding:7px 4px">
            <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:var(--ink)">${escapeHtml(ev.hora)}</div>
            <div style="font-size:9px;text-transform:uppercase;color:var(--muted);letter-spacing:1px">hs</div></div>` : ''}
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--ink)">${escapeHtml(ev.titulo || '—')}</div>
            ${ev.expediente ? `<div style="font-size:12.5px;color:var(--muted);margin-top:2px">${escapeHtml(ev.expediente)}</div>` : ''}
            ${ev.lugar      ? `<div style="font-size:11.5px;color:var(--muted);margin-top:2px">📍 ${escapeHtml(ev.lugar)}</div>` : ''}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
            ${ev.cumplido
              ? `<span style="background:rgba(45,106,79,.12);color:var(--success);border:1px solid rgba(45,106,79,.2);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600">✓ Cumplido</span>`
              : `<span class="badge badge-${ev.tipo === 'Vencimiento procesal' ? 'urgent' : ev.tipo === 'Audiencia' ? 'study' : 'pending'}">${escapeHtml(ev.tipo || 'Evento')}</span>`
            }
            ${!ev.cumplido ? `<button class="btn btn-ghost btn-sm" onclick="marcarCumplido('${ev.id}')" style="color:var(--success);padding:3px 8px;font-size:11px;border:1px solid rgba(45,106,79,.3);border-radius:6px" title="Marcar como cumplido">✓</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="deleteEvento('${ev.id}')" style="color:var(--danger);padding:3px 7px">🗑</button>
          </div>
        </div>`).join('');

      return `<div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:6px 0 10px">${dayLabel}</div>
        ${evHtml}
      </div>`;
    }).join('');
}

// ── Marcar evento como cumplido ───────────────────────────
export async function marcarCumplido(id) {
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    await updateDoc(doc(db, `lexia/${uid}/eventos/${id}`), {
      cumplido:      true,
      fechaCumplido: new Date().toISOString().slice(0, 10)
    });
    window.checkAlertasVencimiento?.();
  } catch (e) { alert('Error: ' + e.message); }
}

// ── Eliminar evento ───────────────────────────────────────
export async function deleteEvento(id) {
  if (!confirm('¿Eliminar este evento?')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  await deleteDoc(doc(db, `lexia/${uid}/eventos/${id}`));
}

// ── Bridge global ─────────────────────────────────────────
window.suscribirEventos = suscribirEventos;
window.agendaNavMes     = agendaNavMes;
window.renderAgenda     = renderAgenda;
window.marcarCumplido   = marcarCumplido;
window.deleteEvento     = deleteEvento;

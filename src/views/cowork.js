import { 
  db, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from '../services/firebase';

window._coworkCache = {};      // { [expId]: [entries] }
window._coworkCurrentExpId = null;
window._coworkAllEntries = []; // para la vista global

// ─── Helpers de render ───
export function _cwBadgeEstado(e) {
  const m = { 
    borrador: 'background:#faeeda;color:#633806', 
    final: 'background:#eaf3de;color:#27500a',
    revisión: 'background:#EEEDFE;color:#3C3489', 
    pendiente: 'background:#f1efe8;color:#444441' 
  };
  return `<span style="display:inline-block;font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;${m[e] || m.pendiente}">${e || '—'}</span>`;
}

export function _cwBadgePor(p) {
  return p === 'claude'
    ? `<span style="display:inline-block;font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;background:#e1f5ee;color:#085041">🤖 Claude</span>`
    : `<span style="display:inline-block;font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;background:#e6f1fb;color:#0c447c">✍️ Manual</span>`;
}

export function _cwTypePill(t) {
  return `<span style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:4px;border:0.5px solid var(--border-light);background:#fff;color:var(--muted);font-weight:500">${t || '—'}</span>`;
}

export function _cwSkillTag(s) {
  return `<span style="font-size:10px;color:#a88a3a;font-weight:500">${s || '—'}</span>`;
}

// ─── CARGAR LOG DE UN EXPEDIENTE ───
export async function cargarCoworkLog(expId) {
  if (!expId || !window._fbUser) return;
  window._coworkCurrentExpId = expId;

  const tbody = document.getElementById('cw-log-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Cargando...</td></tr>';

  const uid = window._fbUser.uid;

  try {
    let snap;
    try {
      snap = await getDocs(query(
        collection(db, `lexia/${uid}/expedientes/${expId}/cowork_log`),
        orderBy('createdAt', 'desc')
      ));
    } catch (idxErr) {
      snap = await getDocs(collection(db, `lexia/${uid}/expedientes/${expId}/cowork_log`));
    }

    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });

    window._coworkCache[expId] = entries;
    renderCoworkLog(entries);
    _actualizarCoworkStats(entries);
  } catch (e) {
    console.warn('Error cargando cowork log:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:20px">Error: ${e.message}</td></tr>`;
  }
}

// ─── RENDER LOG EN DETALLE DE EXPEDIENTE ───
export function renderCoworkLog(entries, filtradas) {
  const data = filtradas !== undefined ? filtradas : entries;
  const tbody = document.getElementById('cw-log-body');
  const footer = document.getElementById('cw-log-footer');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">
      Sin entradas. Claude las agrega automáticamente vía API o usá "+ Nueva entrada" para agregar manualmente.
    </td></tr>`;
    if (footer) footer.textContent = '0 entradas';
    return;
  }

  const total_h = data.reduce((s, e) => s + (parseFloat(e.tiempo) || 0), 0);
  if (footer) footer.textContent = `${data.length} entrada${data.length !== 1 ? 's' : ''} · ${total_h.toFixed(1)}h total`;

  tbody.innerHTML = data.map((e, i) => {
    const fecha = e.fecha || (e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString('es-AR') : '—');
    return `<tr style="cursor:default">
      <td style="font-size:11px;color:var(--muted)">${fecha}</td>
      <td>${_cwTypePill(e.tipo)}</td>
      <td>${_cwSkillTag(e.skill || e.fichero || '—')}</td>
      <td>${_cwBadgeEstado(e.estado)}</td>
      <td style="font-weight:500">${e.tiempo ? e.tiempo + 'h' : '—'}</td>
      <td style="font-size:11px;color:var(--muted);line-height:1.4;max-width:200px;white-space:normal">${e.notas || '—'}</td>
      <td>${_cwBadgePor(e.por)}</td>
      <td><button onclick="event.stopPropagation();_cwDeleteEntry('${e.id}')" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:13px;padding:3px 5px" title="Eliminar">🗑</button></td>
    </tr>`;
  }).join('');
}

// ─── FILTRAR LOG ───
export function filterCoworkLog() {
  const expId = window._coworkCurrentExpId;
  if (!expId) return;
  const entries = window._coworkCache[expId] || [];
  const q = (document.getElementById('cw-search')?.value || '').toLowerCase();
  const tipo = document.getElementById('cw-filter-tipo')?.value || '';
  const estado = document.getElementById('cw-filter-estado')?.value || '';

  const filtradas = entries.filter(e => {
    const matchQ = !q || (e.notas || '').toLowerCase().includes(q)
      || (e.skill || e.fichero || '').toLowerCase().includes(q)
      || (e.tipo || '').toLowerCase().includes(q);
    const matchTipo = !tipo || e.tipo === tipo;
    const matchEstado = !estado || e.estado === estado;
    return matchQ && matchTipo && matchEstado;
  });

  renderCoworkLog(entries, filtradas);
}

// ─── STATS ───
export function _actualizarCoworkStats(entries) {
  const horas = entries.reduce((s, e) => s + (parseFloat(e.tiempo) || 0), 0);
  const claude = entries.filter(e => e.por === 'claude').length;
  const manual = entries.filter(e => e.por === 'manual').length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('cw-stat-horas', horas.toFixed(1) + 'h');
  set('cw-stat-claude', claude);
  set('cw-stat-manual', manual);
}

// ─── ABRIR MODAL ───
export function openModalCowork() {
  if (!window._coworkCurrentExpId) { alert('Abrí un expediente primero'); return; }
  window.openModal('modal-cowork');
}

export function openModalCoworkGlobal() {
  const expId = window._coworkCurrentExpId || (window._allExpedientes?.[0]?.id);
  if (!expId) { alert('No hay expedientes disponibles'); return; }
  window.openModal('modal-cowork');
}

// ─── GUARDAR ENTRADA MANUAL ───
export async function saveCoworkEntry() {
  const expId = window._coworkCurrentExpId;
  if (!expId) { alert('Sin expediente activo'); return; }

  const notas = document.getElementById('cw-m-notas')?.value?.trim();
  if (!notas) { alert('Las notas son obligatorias'); return; }

  const entry = {
    tipo: document.getElementById('cw-m-tipo')?.value || 'otro',
    estado: document.getElementById('cw-m-estado')?.value || 'borrador',
    skill: document.getElementById('cw-m-fichero')?.value?.trim() || '—',
    tiempo: parseFloat(document.getElementById('cw-m-tiempo')?.value) || 0,
    notas,
    por: 'manual',
    fecha: new Date().toLocaleDateString('es-AR'),
  };

  await addCoworkEntry(expId, entry);
  window.closeModal('modal-cowork');
  // Limpiar campos
  ['cw-m-notas', 'cw-m-fichero', 'cw-m-tiempo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// ─── API PÚBLICA ───
export async function addCoworkEntry(expId, entry) {
  if (!window._fbUser) {
    console.warn('addCoworkEntry: sin sesión Firebase');
    return null;
  }
  const uid = window._fbUser.uid;

  try {
    if (window.setSyncing) window.setSyncing();
    const ref = await addDoc(collection(db, `lexia/${uid}/expedientes/${expId}/cowork_log`), {
      ...entry,
      createdAt: serverTimestamp(),
      por: entry.por || 'claude'
    });
    if (window.setSyncOk) window.setSyncOk();
    // Actualizar caché local y re-render si es el expediente activo
    if (expId === window._coworkCurrentExpId) {
      await cargarCoworkLog(expId);
    }
    // También refrescar vista global si está abierta
    if (document.getElementById('view-cowork')?.classList.contains('active')) {
      _cargarCoworkGlobal();
    }
    return ref.id;
  } catch (e) {
    if (window.setSyncErr) window.setSyncErr();
    console.error('addCoworkEntry error:', e);
    return null;
  }
}

// ─── ELIMINAR ENTRADA ───
export async function _cwDeleteEntry(entryId) {
  const expId = window._coworkCurrentExpId;
  if (!expId) return;
  if (!confirm('¿Eliminar esta entrada del log? Esta acción no se puede deshacer.')) return;

  const uid = window._fbUser.uid;
  try {
    await deleteDoc(doc(db, `lexia/${uid}/expedientes/${expId}/cowork_log/${entryId}`));
    await cargarCoworkLog(expId);
  } catch (e) {
    alert('Error al eliminar: ' + e.message);
  }
}

// ─── VISTA GLOBAL — cargar todas las entradas de todos los expedientes ───
export async function _cargarCoworkGlobal() {
  const tbody = document.getElementById('cw-global-body');
  if (!tbody || !window._fbUser) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:28px">Cargando entradas de todos los expedientes...</td></tr>';

  const uid = window._fbUser.uid;
  const exps = window._allExpedientes || [];

  let todasEntradas = [];
  try {
    await Promise.all(exps.slice(0, 30).map(async exp => {
      try {
        const snap = await getDocs(collection(db, `lexia/${uid}/expedientes/${exp.id}/cowork_log`));
        snap.docs.forEach(d => {
          todasEntradas.push({ id: d.id, expId: exp.id, expCaratula: exp.caratula || '—', ...d.data() });
        });
      } catch (e) { /* skip */ }
    }));
  } catch (e) { console.warn(e); }

  todasEntradas.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  window._coworkAllEntries = todasEntradas;
  _renderCoworkGlobal(todasEntradas);

  // KPIs
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('cw-kpi-total', todasEntradas.length);
  set('cw-kpi-claude', todasEntradas.filter(e => e.por === 'claude').length);
  set('cw-kpi-horas', todasEntradas.reduce((s, e) => s + (parseFloat(e.tiempo) || 0), 0).toFixed(1) + 'h');
}

export function _renderCoworkGlobal(data) {
  const tbody = document.getElementById('cw-global-body');
  const footer = document.getElementById('cw-global-footer');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:32px">Sin entradas registradas.</td></tr>';
    if (footer) footer.textContent = '0 entradas';
    return;
  }

  const total_h = data.reduce((s, e) => s + (parseFloat(e.tiempo) || 0), 0);
  if (footer) footer.textContent = `${data.length} entradas · ${total_h.toFixed(1)}h total`;

  tbody.innerHTML = data.slice(0, 100).map(e => {
    const fecha = e.fecha || (e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString('es-AR') : '—');
    const caratula = (e.expCaratula || '—').substring(0, 35);
    return `<tr style="cursor:pointer" onclick="openExpediente('${e.expId}')">
      <td style="font-size:11px;color:var(--muted)">${fecha}</td>
      <td style="font-size:11.5px;color:var(--ink);font-weight:500">${caratula}${(e.expCaratula || '').length > 35 ? '...' : ''}</td>
      <td>${_cwTypePill(e.tipo)}</td>
      <td>${_cwSkillTag(e.skill || e.fichero || '—')}</td>
      <td>${_cwBadgeEstado(e.estado)}</td>
      <td style="font-weight:500">${e.tiempo ? e.tiempo + 'h' : '—'}</td>
      <td style="font-size:11px;color:var(--muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.notes || e.notas || '—'}</td>
      <td>${_cwBadgePor(e.por)}</td>
      <td><button onclick="event.stopPropagation()" style="font-size:11px;background:none;border:none;color:var(--muted);cursor:default">—</button></td>
    </tr>`;
  }).join('');
}

export function filterCoworkGlobal() {
  const entries = window._coworkAllEntries || [];
  const q = (document.getElementById('cw-global-search')?.value || '').toLowerCase();
  const tipo = document.getElementById('cw-global-tipo')?.value || '';
  const estado = document.getElementById('cw-global-estado')?.value || '';
  const por = document.getElementById('cw-global-por')?.value || '';

  const filtradas = entries.filter(e => {
    const matchQ = !q || (e.notas || '').toLowerCase().includes(q)
      || (e.skill || '').toLowerCase().includes(q)
      || (e.expCaratula || '').toLowerCase().includes(q);
    const matchTipo = !tipo || e.tipo === tipo;
    const matchEstado = !estado || e.estado === estado;
    const matchPor = !por || e.por === por;
    return matchQ && matchTipo && matchEstado && matchPor;
  });
  _renderCoworkGlobal(filtradas);
}

// Bind to window context for onclicks
window.cargarCoworkLog = cargarCoworkLog;
window.renderCoworkLog = renderCoworkLog;
window.filterCoworkLog = filterCoworkLog;
window.openModalCowork = openModalCowork;
window.openModalCoworkGlobal = openModalCoworkGlobal;
window.saveCoworkEntry = saveCoworkEntry;
window.addCoworkEntry = addCoworkEntry;
window._cwDeleteEntry = _cwDeleteEntry;
window._cargarCoworkGlobal = _cargarCoworkGlobal;
window._renderCoworkGlobal = _renderCoworkGlobal;
window.filterCoworkGlobal = filterCoworkGlobal;

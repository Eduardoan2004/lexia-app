// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Expedientes
// ════════════════════════════════════════════════════════

import { escapeHtml, badgeEstado, calcVencimiento, showToast } from '../utils/helpers.js';
import {
  db, collection, doc, addDoc, setDoc, getDoc, getDocs,
  deleteDoc, onSnapshot, query, orderBy, where, serverTimestamp
} from '../services/firebase.js';

// ────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ────────────────────────────────────────────────────────
const fbCol = col  => collection(db, 'lexia', window._fbUser.uid, col);
const fbDoc = (col, id) => doc(db, 'lexia', window._fbUser.uid, col, id);

// ────────────────────────────────────────────────────────
// SUSCRIPCIÓN EN TIEMPO REAL
// ────────────────────────────────────────────────────────
export function fbSuscribirExpedientes() {
  if (window._unsubExp) window._unsubExp();
  const uid = window._fbUser?.uid; if (!uid) return;

  window._unsubExp = onSnapshot(
    collection(db, `lexia/${uid}/expedientes`),
    snap => {
      window._allExpedientes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      poblarSelectsModales();

      // Chips counter
      const tots = window._allExpedientes.length;
      const acts = window._allExpedientes.filter(e => ['activo','urgente'].includes((e.estado||'').toLowerCase())).length;
      const urgs = window._allExpedientes.filter(e => (e.estado||'').toLowerCase() === 'urgente').length;
      const setChipN = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = el.textContent.replace(/\([^)]*\)/, `(${n})`); };
      setChipN('chip-todos',   tots);
      setChipN('chip-activos', acts);
      setChipN('chip-urgentes', urgs);

      // Render tabla
      const filas = window._allExpedientes.map(e => {
        const venc    = calcVencimiento(e.proxVencimiento || e.fechaVencimiento || '');
        const vencHTML = venc.texto ? `<span style="font-size:11.5px;font-weight:600;color:${venc.color}">${venc.icono} ${venc.texto}</span>` : '—';
        return `<tr style="cursor:pointer" onclick="openExpediente('${e.id}')"
          data-estado="${(e.estado||'').toLowerCase()}" data-fuero="${(e.fuero||'').toLowerCase()}">
          <td onclick="event.stopPropagation()"><input type="checkbox" class="exp-checkbox" data-id="${e.id}" onchange="actualizarBulkBar()"></td>
          <td><span class="exp-num">${escapeHtml(e.numero||'—')}</span></td>
          <td><div class="exp-title">${escapeHtml(e.caratula||'Sin carátula')}<small>${escapeHtml(e.juzgado||'')}</small></div></td>
          <td onclick="event.stopPropagation()">${badgeFueroEditable(e.id, e.fuero)}</td>
          <td style="font-size:12.5px">${escapeHtml(e.cliente||'—')}</td>
          <td onclick="event.stopPropagation()">${badgeEstadoEditable(e.id, e.estado)}</td>
          <td>${vencHTML}</td>
          <td onclick="event.stopPropagation()" style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="openExpediente('${e.id}')">→</button>
            <button class="btn btn-ghost btn-sm" onclick="openEditExpModalById('${e.id}')">✎</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteExpediente('${e.id}')">🗑</button>
          </td>
        </tr>`;
      });

      const tb = document.getElementById('exp-table-body');
      if (tb) tb.innerHTML = filas.join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:28px">Sin expedientes. Creá el primero →</td></tr>';

      window.checkAlertasVencimiento?.();
      const badge = document.querySelector('.nav-badge');
      if (badge) badge.textContent = acts;
      window.renderDashboardExpedientes?.();
      window.renderDashboardKPIs?.();
      window.renderDashboardVencimientos?.();
      window.setSyncOk?.();
    },
    () => window.setSyncErr?.()
  );
}

// ────────────────────────────────────────────────────────
// NAVEGACIÓN Y DETALLE
// ────────────────────────────────────────────────────────
export function openExpediente(id) {
  window.currentExpId = id;
  window.navigate?.('expediente-detail');
  document.querySelectorAll('.detail-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.style.display = i === 0 ? 'block' : 'none');
  const expData = (window._allExpedientes || []).find(e => e.id === id);
  if (expData) { window._currentExpData = expData; renderExpedienteDetail(expData); }
  cargarTimelineExp(id);
  cargarDocsExp(id);
  cargarActos(id);
}

export function switchDetailTab(tabEl, panelId) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById(panelId).style.display = 'block';
  const id = window.currentExpId;
  if (id) {
    if (panelId === 'tab-actos')        cargarActos(id);
    if (panelId === 'tab-docs')         cargarDocsExp(id);
    if (panelId === 'tab-timeline')     cargarTimelineExp(id);
    if (panelId === 'tab-ia-analisis')  poblarSelectorDocsIA();
    if (panelId === 'tab-calculadoras') window.initCalculadoras?.();
  }
}

export function renderExpedienteDetail(e) {
  const numEl   = document.querySelector('.exp-detail-num');
  const titleEl = document.querySelector('.exp-detail-title');
  if (numEl)   numEl.textContent   = (e.numero || '—') + (e.juzgado ? ' · ' + e.juzgado : '');
  if (titleEl) titleEl.textContent = e.caratula || 'Sin carátula';

  const setMeta = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  setMeta('meta-cliente-val',     e.cliente);
  setMeta('meta-contraparte-val', e.contraparte);
  setMeta('meta-fuero-val',       e.fuero);
  setMeta('meta-inicio-val',      e.fechaInicio);
  setMeta('meta-estado-val',      e.estado);

  const partesDetailEl = document.getElementById('partes-detail-section');
  if (partesDetailEl) {
    if (e.partes && e.partes.length) {
      const roles  = { actor:'Actor', coactor:'Coactor', demandado:'Demandado', codemandado:'Codemandado solidario', tercero:'Tercero', reconviniente:'Reconviniente' };
      const propios = { patrocinante:'✅ Mi parte', apoderado:'✅ Mi parte', contraparte:'⚔️ Contraparte' };
      partesDetailEl.style.display = '';
      const partesHTML = e.partes.map(p => {
        const esMiParte = p.rolPropio === 'patrocinante' || p.rolPropio === 'apoderado';
        const bg  = esMiParte ? 'rgba(0,180,216,.15)' : 'rgba(255,255,255,.06)';
        const brd = esMiParte ? '1px solid rgba(0,180,216,.3)' : '1px solid rgba(255,255,255,.08)';
        let html = `<div style="background:${bg};border:${brd};border-radius:8px;padding:10px 12px;margin-bottom:4px">`;
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px"><div>';
        html += `<span style="font-size:11px;background:rgba(255,255,255,.15);border-radius:4px;padding:2px 8px;font-weight:600">${escapeHtml(roles[p.rol] || p.rol)}</span>`;
        html += `<div style="font-size:13.5px;font-weight:600;margin-top:5px">${escapeHtml(p.nombre || '')}</div>`;
        if (p.cuit) html += `<div style="font-size:11px;opacity:.7;font-family:monospace">${escapeHtml(p.cuit)}</div>`;
        html += '</div>';
        html += `<span style="font-size:11px;font-weight:600;opacity:.9">${escapeHtml(propios[p.rolPropio] || p.rolPropio || '')}</span>`;
        html += '</div>';
        if (p.letrados && p.letrados.length) {
          html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1)"><div style="font-size:10px;opacity:.6;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Letrados</div>';
          p.letrados.forEach(l => {
            html += '<div style="font-size:12px;display:flex;gap:12px;flex-wrap:wrap;margin-bottom:3px">';
            html += `<span>✍️ ${escapeHtml(l.nombre || '')}</span>`;
            if (l.matricula) html += `<span style="opacity:.7;font-family:monospace">${escapeHtml(l.matricula)}</span>`;
            if (l.email)     html += `<a href="mailto:${escapeHtml(l.email)}" style="color:var(--gold);text-decoration:none">✉ ${escapeHtml(l.email)}</a>`;
            if (l.tel)       html += `<span style="opacity:.7">📞 ${escapeHtml(l.tel)}</span>`;
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
        return html;
      }).join('');
      partesDetailEl.innerHTML = '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.15)">'
        + '<div style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:.7;margin-bottom:10px">Partes del proceso</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px">' + partesHTML + '</div></div>';
    } else {
      partesDetailEl.style.display = 'none';
    }
  }

  const btnLink = document.getElementById('btn-link-judicial');
  if (btnLink) {
    if (e.linkJudicial) { btnLink.style.display = ''; window._currentLinkJudicial = e.linkJudicial; }
    else                { btnLink.style.display = 'none'; window._currentLinkJudicial = ''; }
  }
}

export function abrirLinkJudicial() {
  const link = window._currentLinkJudicial;
  if (!link) return;
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
    window.open(link, '_blank', 'noopener,noreferrer');
  } catch {}
}

// ────────────────────────────────────────────────────────
// FILTROS
// ────────────────────────────────────────────────────────
export function setChip(chip) {
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  const label = (chip.textContent || '').trim().replace(/\s*\(.*?\)$/, '').toLowerCase();
  document.querySelectorAll('#exp-table-body tr').forEach(row => {
    const estado = row.getAttribute('data-estado') || '';
    const fuero  = row.getAttribute('data-fuero')  || '';
    if (label === 'todos' || label.startsWith('todos')) { row.style.display = ''; return; }
    if (label === 'activos')  { row.style.display = (estado === 'activo' || estado === 'en curso') ? '' : 'none'; return; }
    if (label === 'urgentes') { row.style.display = estado === 'urgente' ? '' : 'none'; return; }
    const fMatch = fuero.includes(label) || label.includes(fuero)
      || (label === 'laboral'       && (fuero.includes('cnt') || fuero.includes('trabajo')))
      || (label === 'civil'         && (fuero.includes('civil') || fuero.includes('comercial')))
      || (label === 'administrativo' && (fuero.includes('admin') || fuero.includes('gcba') || fuero.includes('tramite') || fuero.includes('contencioso')));
    row.style.display = fMatch ? '' : 'none';
  });
}

export function filterExpedientes(q) {
  const ql = (q || '').toLowerCase().trim();
  document.querySelectorAll('#exp-table-body tr').forEach(row => {
    if (!ql) { row.style.display = ''; return; }
    const expId = row.querySelector('[data-id]')?.dataset?.id || row.querySelector('input[type="checkbox"]')?.dataset?.id || '';
    let extra = '';
    if (expId) {
      const exp = (window._allExpedientes || []).find(e => e.id === expId);
      if (exp && exp.partes) extra = exp.partes.map(p => p.nombre + ' ' + (p.letrados || []).map(l => l.nombre).join(' ')).join(' ').toLowerCase();
    }
    row.style.display = (row.textContent.toLowerCase().includes(ql) || extra.includes(ql)) ? '' : 'none';
  });
}

// ────────────────────────────────────────────────────────
// TIMELINE (MOVIMIENTOS)
// ────────────────────────────────────────────────────────
export async function cargarTimelineExp(expId) {
  const timeline = document.getElementById('tab-timeline');
  if (!timeline) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    const snap = await getDocs(query(collection(db, `lexia/${uid}/expedientes/${expId}/movimientos`), orderBy('createdAt', 'desc')));
    const movs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!movs.length) { timeline.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Sin movimientos registrados. Usá "+ Movimiento" para agregar.</div>'; return; }
    const iconos = { audiencia:'⚖️', escrito:'📋', documento:'📄', vencimiento:'⏰', nota:'📝', resolucion:'🏛️' };
    timeline.innerHTML = '<div class="timeline">' + movs.map(m => {
      const icono = iconos[(m.tipo||'').toLowerCase()] || '📋';
      const fecha = m.fecha || m.createdAt?.toDate?.()?.toLocaleDateString('es-AR') || '—';
      return `<div class="tl-item" id="mov-${m.id}">
        <div class="tl-dot">${icono}</div>
        <div class="tl-content" style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div class="tl-date">${escapeHtml(fecha)}</div>
              <div class="tl-desc">${escapeHtml(m.titulo || m.descripcion || 'Movimiento')}</div>
              ${m.descripcion && m.descripcion !== m.titulo ? `<div class="tl-note">${escapeHtml(m.descripcion)}</div>` : ''}
            </div>
            <button onclick="eliminarMovimiento('${expId}','${m.id}')" style="background:rgba(192,57,43,.08);border:1px solid rgba(192,57,43,.2);border-radius:6px;cursor:pointer;color:var(--danger);font-size:12px;padding:4px 10px">🗑 Eliminar</button>
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  } catch (e) { console.warn('Error cargando timeline:', e); }
}

export async function eliminarMovimiento(expId, movId) {
  if (!confirm('¿Eliminar este movimiento del historial?')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    await deleteDoc(doc(db, `lexia/${uid}/expedientes/${expId}/movimientos/${movId}`));
    document.getElementById('mov-' + movId)?.remove();
  } catch (e) { alert('Error: ' + e.message); }
}

// ────────────────────────────────────────────────────────
// DOCUMENTOS
// ────────────────────────────────────────────────────────
export async function cargarDocsExp(expId) {
  const tabDocs = document.getElementById('tab-docs');
  if (!tabDocs) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    const snap = await getDocs(query(collection(db, `lexia/${uid}/documentos`), where('expedienteId', '==', expId)));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!docs.length) { tabDocs.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Sin documentos. Usá "+ Documento" para agregar.</div>'; return; }
    const extIcono = { pdf:'📄', docx:'📝', xlsx:'📊', jpg:'🖼️', jpeg:'🖼️', png:'🖼️' };
    tabDocs.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' + docs.map(d => {
      const ext   = (d.archivoNombre || d.nombre || '').split('.').pop().toLowerCase();
      const icono = extIcono[ext] || '📄';
      const tam   = d.archivoTamanio ? (d.archivoTamanio / 1024 / 1024).toFixed(2) + ' MB' : '';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:8px;border:1px solid var(--border-light);background:#fff">
        <span style="font-size:22px;flex-shrink:0">${icono}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;color:#0F2244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.nombre || d.archivoNombre || 'Documento')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(d.categoria || 'General')}${tam ? ' · ' + tam : ''} · ${escapeHtml(d.fecha || '—')}</div>
          ${d.notas ? `<div style="font-size:11px;color:var(--slate);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.notas)}</div>` : ''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          ${d.archivoUrl ? `
            <button onclick="verDocumento('${d.archivoUrl}')" style="background:#E8F7FB;border:1px solid #00B4D8;border-radius:6px;color:#0F2244;font-size:11.5px;font-weight:500;padding:5px 10px;cursor:pointer">👁 Ver</button>
            <button onclick="bajarDocumento('${d.archivoUrl}','${(d.archivoNombre||d.nombre||'documento').replace(/'/g,'')}')" style="background:#0F2244;border:1px solid #0F2244;border-radius:6px;color:#fff;font-size:11.5px;font-weight:500;padding:5px 10px;cursor:pointer">⬇ Bajar</button>
            <button onclick="usarDocEnIA('${d.id}','${(d.nombre||d.archivoNombre||'').replace(/'/g,'')}','${d.archivoUrl}')" style="background:#F5F8FC;border:1px solid var(--border);border-radius:6px;color:#0F2244;font-size:11.5px;font-weight:500;padding:5px 10px;cursor:pointer">🤖 Analizar con IA</button>
          ` : '<span style="font-size:11px;color:var(--muted);padding:4px 6px;font-style:italic">Sin archivo</span>'}
          <button onclick="eliminarDocumento('${d.id}')" style="background:transparent;border:1px solid rgba(192,57,43,.25);border-radius:6px;cursor:pointer;color:var(--danger);font-size:12px;padding:5px 8px">🗑</button>
        </div>
      </div>`;
    }).join('') + '</div>';
  } catch (e) { console.warn('Error cargando docs:', e); }
}

export async function eliminarDocumento(docId) {
  if (!confirm('¿Eliminar este documento?')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    await deleteDoc(doc(db, `lexia/${uid}/documentos/${docId}`));
    if (window.currentExpId) cargarDocsExp(window.currentExpId);
  } catch (e) { alert('Error: ' + e.message); }
}

export function verDocumento(url)         { if (!url) return; window.open(url, '_blank', 'noopener,noreferrer'); }
export function bajarDocumento(url, nombre) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
  showToast('💡 Usá Ctrl+S o el botón de descarga del visor para guardar');
}

export async function usarDocEnIA(docId, nombre, url) {
  const tabBtn = document.querySelector('[onclick*="tab-ia-analisis"]');
  if (tabBtn) tabBtn.click();
  const status = document.getElementById('ia-file-status');
  if (status) { status.textContent = '✅ ' + nombre + ' seleccionado para análisis'; status.style.color = '#0B7A4E'; }
  window._currentDocUrl = url;
  try {
    const resp = await fetch(url);
    const raw  = new TextDecoder('latin1').decode(new Uint8Array(await resp.arrayBuffer()));
    const txt  = (raw.match(/\(([^\)]{3,300})\)/g) || []).map(m => m.slice(1,-1)).filter(m => /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(m)).join(' ');
    window._docTextoIA = txt.length > 300 ? txt : `[Documento: ${nombre}. URL: ${url}. PDF escaneado — texto no extraíble automáticamente.]`;
  } catch { window._docTextoIA = `[Documento guardado: ${nombre}. URL: ${url}]`; }
  const sel = document.getElementById('ia-doc-guardado-sel');
  if (sel) sel.value = docId;
  showToast('✅ ' + nombre + ' listo para analizar con IA');
}

export async function poblarSelectorDocsIA() {
  const sel = document.getElementById('ia-doc-guardado-sel');
  if (!sel || !window.currentExpId) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    const snap = await getDocs(query(collection(db, `lexia/${uid}/documentos`), where('expedienteId', '==', window.currentExpId)));
    sel.innerHTML = '<option value="">— Sin documento —</option>';
    snap.docs.forEach(d => {
      const data = d.data();
      const op = document.createElement('option');
      op.value = d.id;
      op.textContent = data.nombre || data.archivoNombre || d.id;
      sel.appendChild(op);
    });
  } catch {}
}

// ────────────────────────────────────────────────────────
// ACTOS PROCESALES
// ────────────────────────────────────────────────────────
export async function cargarActos(expId) {
  const uid = window._fbUser?.uid; if (!uid) return;
  const list = document.getElementById('actos-list'); if (!list) return;
  try {
    let snap;
    try { snap = await getDocs(query(collection(db, `lexia/${uid}/expedientes/${expId}/actos`), orderBy('fecha', 'asc'))); }
    catch  { snap = await getDocs(collection(db, `lexia/${uid}/expedientes/${expId}/actos`)); }
    const actos = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.fecha||'').localeCompare(b.fecha||''));
    if (!window._actosCache) window._actosCache = {};
    window._actosCache[expId] = actos;
    renderActos(actos, 'todos');
  } catch (e) {
    console.warn('Error cargando actos:', e);
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Error al cargar actos. Intentá nuevamente.</div>';
  }
}

export function renderActos(actos, filtro) {
  const list     = document.getElementById('actos-list'); if (!list) return;
  const filtered = filtro === 'todos' ? actos : actos.filter(a => a.parte === filtro);
  if (!filtered.length) { list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">Sin actos para este filtro.</div>'; return; }
  const colores = { yo:'#1a4a6b', contraparte:'#6b1f2a', fiscal:'#2d6a4f', tribunal:'#b8935a' };
  const labels  = { yo:'Mi parte', contraparte:'Contraparte', fiscal:'Fiscal/Peritos', tribunal:'Tribunal' };
  const iconos  = { yo:'✍️', contraparte:'⚔️', fiscal:'🏛️', tribunal:'⚖️' };
  list.innerHTML = filtered.map(a => `
    <div style="display:flex;gap:12px;padding:14px;border:1px solid var(--border-light);border-radius:10px;background:#fff;border-left:4px solid ${colores[a.parte]||'var(--border)'}">
      <div style="font-size:22px;line-height:1">${iconos[a.parte]||'📋'}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="font-size:13.5px;font-weight:600;color:var(--ink)">${escapeHtml(a.titulo||'Sin título')}</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap">${escapeHtml(a.fecha||'')}</div>
        </div>
        <div style="font-size:12px;color:${colores[a.parte]||'var(--muted)'};font-weight:600;margin:3px 0">${escapeHtml(labels[a.parte]||a.parte)}</div>
        ${a.descripcion ? `<div style="font-size:12.5px;color:var(--slate);line-height:1.5;margin-top:4px">${escapeHtml(a.descripcion)}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" style="color:#c0392b;padding:4px 8px;align-self:flex-start" onclick="eliminarActo('${a.id}')">🗑</button>
    </div>`).join('');
}

export function filtrarActos(filtro, btn) {
  document.querySelectorAll('.acto-filter-btn').forEach(b => { b.classList.remove('active'); b.style.background = ''; });
  btn.classList.add('active');
  const actos = (window._actosCache || {})[window.currentExpId] || [];
  renderActos(actos, filtro);
}

export async function guardarActo(data) {
  const uid = window._fbUser?.uid; if (!uid) return;
  await addDoc(collection(db, `lexia/${uid}/expedientes/${window.currentExpId}/actos`), { ...data, creadoEn: serverTimestamp() });
}

export async function eliminarActo(id) {
  if (!confirm('¿Eliminar este acto?')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  await deleteDoc(doc(db, `lexia/${uid}/expedientes/${window.currentExpId}/actos/${id}`));
}

export async function guardarNuevoActo() {
  const parte  = document.getElementById('acto-parte')?.value || 'tribunal';
  const fecha  = document.getElementById('acto-fecha')?.value || new Date().toISOString().slice(0, 10);
  const titulo = document.getElementById('acto-titulo')?.value?.trim();
  const desc   = document.getElementById('acto-desc')?.value?.trim() || '';
  if (!titulo) { alert('El tipo de acto es obligatorio'); return; }
  if (!window.currentExpId) { alert('Abrí un expediente primero'); return; }
  await guardarActo({ parte, fecha, titulo, descripcion: desc });
  window.closeModal?.('modal-nuevo-acto');
  const el = document.getElementById('acto-titulo');
  if (el) el.value = '';
  cargarActos(window.currentExpId);
}

// ────────────────────────────────────────────────────────
// CRUD EXPEDIENTES
// ────────────────────────────────────────────────────────
export async function fbGuardarExpediente(data) {
  window.setSyncing?.();
  try {
    await addDoc(fbCol('expedientes'), { ...data, createdAt: serverTimestamp() });
    window.setSyncOk?.();
    return true;
  } catch (e) { window.setSyncErr?.(); alert('Error al guardar: ' + e.message); return false; }
}

export async function guardarNuevoExp() {
  if (!window._fbUser) { alert('Iniciá sesión primero'); return; }
  const caratula = document.getElementById('nuevo-exp-caratula')?.value?.trim();
  if (!caratula) { alert('La carátula es obligatoria'); return; }
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const data = {
    caratula,
    numero:          g('nuevo-exp-numero'),
    fuero:           document.getElementById('nuevo-exp-fuero')?.value || 'Civil y Comercial',
    juzgado:         g('nuevo-exp-juzgado'),
    cliente:         g('nuevo-exp-cliente'),
    contraparte:     g('nuevo-exp-contraparte'),
    monto:           parseFloat(document.getElementById('nuevo-exp-monto')?.value) || 0,
    fechaInicio:     document.getElementById('nuevo-exp-fecha')?.value || '',
    estado:          document.getElementById('nuevo-exp-estado')?.value || 'Activo',
    honorarios:      parseFloat(document.getElementById('nuevo-exp-honorarios')?.value) || 0,
    descripcion:     g('nuevo-exp-desc'),
    linkJudicial:    g('nuevo-exp-link'),
    proxVencimiento: document.getElementById('nuevo-exp-venc')?.value || '',
  };
  const ok = await fbGuardarExpediente(data);
  if (ok) {
    window.closeModal?.('modal-nuevo-exp');
    ['nuevo-exp-caratula','nuevo-exp-numero','nuevo-exp-juzgado','nuevo-exp-contraparte','nuevo-exp-monto','nuevo-exp-fecha','nuevo-exp-desc','nuevo-exp-honorarios'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }
}

export async function deleteExpediente(id) {
  if (!confirm('¿Eliminar este expediente? Esta acción no se puede deshacer.')) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    await deleteDoc(doc(db, `lexia/${uid}/expedientes/${id}`));
    window.navigate?.('expedientes');
  } catch (e) { alert('Error al eliminar: ' + e.message); }
}

export function openEditExpModalById(id) { window.currentExpId = id; openEditExpModal(); }

export function openEditExpModal() {
  const e = (window._allExpedientes || []).find(x => x.id === window.currentExpId);
  if (!e) return;
  const editCliSel = document.getElementById('edit-cliente');
  if (editCliSel) {
    editCliSel.innerHTML = '<option value="">— Seleccionar —</option>';
    (window._allClientes || []).forEach(c => {
      const op = document.createElement('option');
      op.value = c.nombre; op.textContent = c.nombre;
      editCliSel.appendChild(op);
    });
  }
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('edit-caratula',   e.caratula);
  set('edit-numero',     e.numero);
  set('edit-fuero',      e.fuero || 'Civil');
  set('edit-juzgado',    e.juzgado);
  set('edit-estado',     e.estado || 'Activo');
  set('edit-venc',       e.proxVencimiento || e.fechaVencimiento);
  set('edit-cliente',    e.cliente);
  set('edit-contraparte',e.contraparte);
  set('edit-fecha',      e.fechaInicio);
  set('edit-monto',      e.monto);
  set('edit-honorarios', e.honorarios);
  set('edit-descripcion',e.descripcion);
  set('edit-link',       e.linkJudicial);
  cargarPartesEnForm(e.partes || []);
  window.openModal?.('modal-editar-exp');
}

export async function saveEditExpediente() {
  if (!window.currentExpId) return;
  const caratula = document.getElementById('edit-caratula').value.trim();
  if (!caratula) { alert('La carátula es obligatoria'); return; }
  const uid    = window._fbUser?.uid; if (!uid) return;
  const partes = leerPartesDelForm();
  const misPartes    = partes.filter(p => p.rolPropio === 'patrocinante' || p.rolPropio === 'apoderado');
  const contrapartes = partes.filter(p => p.rolPropio === 'contraparte');
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const data = {
    caratula,
    numero:          g('edit-numero'),
    fuero:           document.getElementById('edit-fuero').value,
    juzgado:         g('edit-juzgado'),
    estado:          document.getElementById('edit-estado').value,
    cliente:         misPartes.length ? misPartes.map(a => a.nombre).join(' / ') : g('edit-cliente'),
    proxVencimiento: document.getElementById('edit-venc')?.value || '',
    contraparte:     contrapartes.length ? contrapartes.map(d => d.nombre).join(' / ') : g('edit-contraparte'),
    fechaInicio:     document.getElementById('edit-fecha').value,
    monto:           parseFloat(document.getElementById('edit-monto').value) || 0,
    honorarios:      parseFloat(document.getElementById('edit-honorarios').value) || 0,
    descripcion:     g('edit-descripcion'),
    linkJudicial:    g('edit-link'),
    partes,
  };
  window.setSyncing?.();
  await setDoc(doc(db, `lexia/${uid}/expedientes/${window.currentExpId}`), data, { merge: true });
  window.setSyncOk?.();
  window.closeModal?.('modal-editar-exp');
  openExpediente(window.currentExpId);
}

// ────────────────────────────────────────────────────────
// BULK OPERATIONS
// ────────────────────────────────────────────────────────
export function toggleSelectAll(cb) {
  document.querySelectorAll('.exp-checkbox').forEach(c => c.checked = cb.checked);
  actualizarBulkBar();
}

export function actualizarBulkBar() {
  const sel   = document.querySelectorAll('.exp-checkbox:checked');
  const bar   = document.getElementById('exp-bulk-bar');
  const count = document.getElementById('exp-bulk-count');
  if (sel.length > 0) {
    bar.style.display  = 'flex';
    count.textContent  = sel.length + ' expediente' + (sel.length > 1 ? 's' : '') + ' seleccionado' + (sel.length > 1 ? 's' : '');
  } else { bar.style.display = 'none'; }
  const todos  = document.querySelectorAll('.exp-checkbox');
  const selAll = document.getElementById('exp-select-all');
  if (selAll) { selAll.indeterminate = sel.length > 0 && sel.length < todos.length; selAll.checked = todos.length > 0 && sel.length === todos.length; }
}

export function deseleccionarTodos() {
  document.querySelectorAll('.exp-checkbox').forEach(c => c.checked = false);
  const selAll = document.getElementById('exp-select-all');
  if (selAll) { selAll.checked = false; selAll.indeterminate = false; }
  document.getElementById('exp-bulk-bar').style.display = 'none';
}

export async function bulkEliminarExpedientes() {
  const checks = document.querySelectorAll('.exp-checkbox:checked');
  if (!checks.length) return;
  if (!confirm(`¿Eliminar ${checks.length} expediente(s)? Esta acción no se puede deshacer.`)) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  const ids = [...checks].map(c => c.dataset.id);
  try {
    await Promise.all(ids.map(id => deleteDoc(doc(db, `lexia/${uid}/expedientes/${id}`))));
    deseleccionarTodos();
  } catch (e) { alert('Error al eliminar: ' + e.message); }
}

export async function bulkCambiarEstado(nuevoEstado) {
  const checks = document.querySelectorAll('.exp-checkbox:checked');
  if (!checks.length) return;
  if (!confirm(`¿Cambiar ${checks.length} expediente(s) a estado "${nuevoEstado}"?`)) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  const ids = [...checks].map(c => c.dataset.id);
  try {
    await Promise.all(ids.map(id => setDoc(doc(db, `lexia/${uid}/expedientes/${id}`), { estado: nuevoEstado }, { merge: true })));
    deseleccionarTodos();
  } catch (e) { alert('Error: ' + e.message); }
}

// ────────────────────────────────────────────────────────
// BADGES EDITABLES INLINE
// ────────────────────────────────────────────────────────
export function badgeFueroEditable(id, fuero) {
  const fueros = ['Civil','Civil y Comercial','Laboral','Penal','Familia','Comercial','Administrativo','Contencioso','Concursal'];
  const colors = { 'Civil':'badge-civil','Civil y Comercial':'badge-civil','Laboral':'badge-laboral','Penal':'badge-penal','Familia':'badge-familia','Comercial':'badge-comercial','Administrativo':'badge-admin','Contencioso':'badge-admin','Concursal':'badge-comercial' };
  const fn = fuero || 'Civil';
  return `<select class="badge ${colors[fn]||'badge-civil'}" style="border:none;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:12px;font-weight:600;max-width:120px" onchange="cambiarCampoRapido('${id}','fuero',this.value)" onclick="event.stopPropagation()">
    ${fueros.map(f => `<option value="${f}" ${f === fn ? 'selected' : ''}>${f}</option>`).join('')}
  </select>`;
}

export function badgeEstadoEditable(id, estado) {
  const estados = ['Activo','Pendiente','Urgente','En Estudio','Cerrado'];
  const colors  = { Activo:'badge-active', Pendiente:'badge-pending', Urgente:'badge-urgent', 'En Estudio':'badge-study', Cerrado:'badge-closed' };
  const en = estado || 'Activo';
  return `<select class="badge ${colors[estado]||'badge-active'}" style="border:none;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:12px;font-weight:600" onchange="cambiarEstadoRapido('${id}',this.value)" onclick="event.stopPropagation()">
    ${estados.map(e => `<option value="${e}" ${e === en || e.toLowerCase() === en.toLowerCase() ? 'selected' : ''}>${e}</option>`).join('')}
  </select>`;
}

export async function cambiarCampoRapido(id, campo, valor) {
  const uid = window._fbUser?.uid; if (!uid) return;
  try {
    window.setSyncing?.();
    await setDoc(doc(db, `lexia/${uid}/expedientes/${id}`), { [campo]: valor }, { merge: true });
    window.setSyncOk?.();
  } catch (e) { window.setSyncErr?.(); alert('Error al guardar: ' + e.message); }
}

export async function cambiarEstadoRapido(id, nuevoEstado) { await cambiarCampoRapido(id, 'estado', nuevoEstado); }

// ────────────────────────────────────────────────────────
// PARTES DEL EXPEDIENTE
// ────────────────────────────────────────────────────────
export function leerPartesDelForm() {
  const partes = [];
  document.querySelectorAll('[id^="parte-item-"]').forEach(div => {
    const idx      = div.id.replace('parte-item-', '');
    const rol      = div.querySelector(`#parte-rol-${idx}`)?.value || 'actor';
    const rolPropio = div.querySelector(`#parte-rolpropio-${idx}`)?.value || 'patrocinante';
    const nombre   = div.querySelector(`#parte-nombre-${idx}`)?.value?.trim() || '';
    const cuit     = div.querySelector(`#parte-cuit-${idx}`)?.value?.trim() || '';
    if (!nombre) return;
    const letrados = [];
    const letCont  = div.querySelector(`#letrados-${idx}`);
    if (letCont) {
      letCont.querySelectorAll('[id^="letrado-"]').forEach(ldiv => {
        const parts = ldiv.id.split('-');
        if (parts.length < 3) return;
        const li     = parts[parts.length - 1];
        const lnombre = ldiv.querySelector(`#let-nombre-${idx}-${li}`)?.value?.trim() || '';
        if (!lnombre) return;
        letrados.push({
          nombre:    lnombre,
          matricula: ldiv.querySelector(`#let-matricula-${idx}-${li}`)?.value?.trim() || '',
          email:     ldiv.querySelector(`#let-email-${idx}-${li}`)?.value?.trim() || '',
          tel:       ldiv.querySelector(`#let-tel-${idx}-${li}`)?.value?.trim() || '',
          domicilio: ldiv.querySelector(`#let-domicilio-${idx}-${li}`)?.value?.trim() || '',
        });
      });
    }
    partes.push({ rol, rolPropio, nombre, cuit, letrados });
  });
  return partes;
}

export function cargarPartesEnForm(partes) {
  window._partesExp = [];
  const list = document.getElementById('partes-list');
  if (!list) return;
  list.querySelectorAll('[id^="parte-item-"]').forEach(d => d.remove());
  if (!partes || !partes.length) {
    const empty = document.getElementById('partes-empty');
    if (empty) empty.style.display = '';
    return;
  }
  partes.forEach((p, i) => window.agregarParteForm?.(p, i));
  window._partesExp = [...partes];
}

// ────────────────────────────────────────────────────────
// POBLAR SELECTS DE MODALES
// ────────────────────────────────────────────────────────
export function poblarSelectsModales() {
  ['evt-expediente','hon-exp-sel'].forEach(selId => {
    const sel = document.getElementById(selId); if (!sel) return;
    sel.innerHTML = '<option value="">— Sin expediente —</option>';
    (window._allExpedientes || []).forEach(e => {
      const op = document.createElement('option');
      op.value = e.numero || e.caratula;
      op.textContent = (e.numero ? e.numero + ' — ' : '') + e.caratula;
      sel.appendChild(op);
    });
  });
  const docSel = document.getElementById('doc-exp-sel');
  if (docSel) {
    const prev = docSel.value;
    docSel.innerHTML = '<option value="">— Seleccionar —</option>';
    (window._allExpedientes || []).forEach(e => {
      const op = document.createElement('option');
      op.value = e.id;
      op.textContent = (e.numero ? e.numero + ' — ' : '') + e.caratula;
      docSel.appendChild(op);
    });
    if (prev) docSel.value = prev;
  }
  const cliSel = document.getElementById('nuevo-exp-cliente');
  if (cliSel) {
    cliSel.innerHTML = '<option value="">— Seleccionar —</option>';
    (window._allClientes || []).forEach(c => {
      const op = document.createElement('option');
      op.value = c.nombre; op.textContent = c.nombre;
      cliSel.appendChild(op);
    });
  }
}

// ────────────────────────────────────────────────────────
// IMPORTAR EXPEDIENTES
// ────────────────────────────────────────────────────────
export function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('import-drop-zone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (file) processImportFile(file);
}

export function handleImportFile(e) {
  const file = e.target.files[0];
  if (file) processImportFile(file);
}

export function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      let rows = file.name.endsWith('.csv') ? parseCSV(ev.target.result) : parseXLSXSimple(new Uint8Array(ev.target.result));
      if (!rows || rows.length < 2) { alert('El archivo está vacío o no tiene el formato correcto.'); return; }
      window._importRows = rows;
      showImportPreview(rows);
    } catch (err) { alert('Error al leer el archivo: ' + err.message); }
  };
  if (file.name.endsWith('.csv')) reader.readAsText(file, 'UTF-8');
  else reader.readAsArrayBuffer(file);
}

export function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const sep   = lines[0] && lines[0].includes(';') ? ';' : ',';
  return lines.map(l => {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < l.length; i++) {
      if (l[i] === '"') inQ = !inQ;
      else if (l[i] === sep && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += l[i];
    }
    result.push(cur.trim());
    return result;
  });
}

function parseXLSXSimple(data) {
  if (typeof XLSX === 'undefined') throw new Error('Librería Excel no cargada.');
  const wb = XLSX.read(data, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).filter(r => r.some(c => c !== ''));
}

export function showImportPreview(rows) {
  const preview = document.getElementById('import-preview');
  const thead   = document.getElementById('import-thead');
  const tbody   = document.getElementById('import-tbody');
  const label   = document.getElementById('import-preview-label');
  const n       = rows.length - 1;
  label.textContent = `Vista previa — ${n} expediente${n !== 1 ? 's' : ''} encontrado${n !== 1 ? 's' : ''}`;
  thead.innerHTML = '<tr>' + rows[0].map(h => `<th>${escapeHtml(String(h))}</th>`).join('') + '</tr>';
  tbody.innerHTML = rows.slice(1, 6).map(r => '<tr>' + r.map(c => `<td style="font-size:12px">${escapeHtml(String(c||''))}</td>`).join('') + '</tr>').join('');
  preview.style.display = 'block';
  document.getElementById('import-confirm-btn').style.display = 'inline-flex';
}

export async function confirmImport() {
  const importRows = window._importRows || [];
  if (!importRows.length) return;
  const headers  = importRows[0].map(h => h.trim().toLowerCase());
  const dataRows = importRows.slice(1).filter(r => r.some(c => c));
  const idx = names => { for (const n of names) { const i = headers.findIndex(h => h.includes(n)); if (i >= 0) return i; } return -1; };
  const iNum = idx(['n°','numero','expediente','nro']), iCar = idx(['car','autos','titulo']);
  const iFuero = idx(['fuero']), iJuz = idx(['juzgado','tribunal']), iEst = idx(['estado']);
  const iCli = idx(['actor','cliente']), iVenc = idx(['venc','fecha']), iMonto = idx(['monto','capital','reclam']);

  const progress = document.getElementById('import-progress');
  const bar      = document.getElementById('import-progress-bar');
  const lbl      = document.getElementById('import-progress-label');
  progress.style.display = 'block';
  document.getElementById('import-confirm-btn').disabled = true;

  const uid  = window._fbUser.uid;
  const stateMap = { activo:'Activo', pendiente:'Pendiente', urgente:'Urgente', cerrado:'Cerrado', estudio:'En Estudio', 'en estudio':'En Estudio' };
  let done = 0;
  for (const row of dataRows) {
    const caratula = iCar >= 0 ? row[iCar] : '';
    if (!caratula) continue;
    const estadoRaw = (iEst >= 0 ? row[iEst] : 'Activo') || 'Activo';
    await addDoc(collection(db, `lexia/${uid}/expedientes`), {
      caratula, numero: iNum >= 0 ? row[iNum] : '', fuero: iFuero >= 0 ? row[iFuero] : 'Civil',
      juzgado: iJuz >= 0 ? row[iJuz] : '', estado: stateMap[estadoRaw.toLowerCase()] || estadoRaw || 'Activo',
      cliente: iCli >= 0 ? row[iCli] : '', proximoVencimiento: iVenc >= 0 ? row[iVenc] : '',
      monto: iMonto >= 0 ? parseFloat(row[iMonto]) || 0 : 0, createdAt: serverTimestamp(),
    });
    done++;
    const pct = Math.round(done / dataRows.length * 100);
    bar.style.width = pct + '%';
    lbl.textContent = `Importando ${done}/${dataRows.length}...`;
  }
  lbl.textContent = `✓ ${done} expedientes importados correctamente`;
  bar.style.background = 'var(--success)';
  window._importRows = [];
  setTimeout(() => { window.closeModal?.('modal-importar'); window.navigate?.('expedientes'); }, 1500);
}

// ────────────────────────────────────────────────────────
// BRIDGE GLOBAL
// ────────────────────────────────────────────────────────
window.fbSuscribirExpedientes  = fbSuscribirExpedientes;
window.openExpediente          = openExpediente;
window.switchDetailTab         = switchDetailTab;
window.renderExpedienteDetail  = renderExpedienteDetail;
window.abrirLinkJudicial       = abrirLinkJudicial;
window.setChip                 = setChip;
window.filterExpedientes       = filterExpedientes;
window.cargarTimelineExp       = cargarTimelineExp;
window.eliminarMovimiento      = eliminarMovimiento;
window.cargarDocsExp           = cargarDocsExp;
window.eliminarDocumento       = eliminarDocumento;
window.verDocumento            = verDocumento;
window.bajarDocumento          = bajarDocumento;
window.usarDocEnIA             = usarDocEnIA;
window.poblarSelectorDocsIA    = poblarSelectorDocsIA;
window.cargarActos             = cargarActos;
window.renderActos             = renderActos;
window.filtrarActos            = filtrarActos;
window.guardarActo             = guardarActo;
window.eliminarActo            = eliminarActo;
window.guardarNuevoActo        = guardarNuevoActo;
window.fbGuardarExpediente     = fbGuardarExpediente;
window.guardarNuevoExp         = guardarNuevoExp;
window.deleteExpediente        = deleteExpediente;
window.openEditExpModal        = openEditExpModal;
window.openEditExpModalById    = openEditExpModalById;
window.saveEditExpediente      = saveEditExpediente;
window.toggleSelectAll         = toggleSelectAll;
window.actualizarBulkBar       = actualizarBulkBar;
window.deseleccionarTodos      = deseleccionarTodos;
window.bulkEliminarExpedientes = bulkEliminarExpedientes;
window.bulkCambiarEstado       = bulkCambiarEstado;
window.badgeFueroEditable      = badgeFueroEditable;
window.badgeEstadoEditable     = badgeEstadoEditable;
window.cambiarCampoRapido      = cambiarCampoRapido;
window.cambiarEstadoRapido     = cambiarEstadoRapido;
window.leerPartesDelForm       = leerPartesDelForm;
window.cargarPartesEnForm      = cargarPartesEnForm;
window.poblarSelectsModales    = poblarSelectsModales;
window.handleImportDrop        = handleImportDrop;
window.handleImportFile        = handleImportFile;
window.processImportFile       = processImportFile;
window.parseCSV                = parseCSV;
window.showImportPreview       = showImportPreview;
window.confirmImport           = confirmImport;

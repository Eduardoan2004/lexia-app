// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Formularios / Guardado de datos
//  guardarNuevoEvento, guardarNuevoHonorario, guardarNuevoCliente,
//  guardarDocumento, abrirModalDoc, handleDocFile
// ════════════════════════════════════════════════════════

import { db, collection, doc, addDoc, getDocs, deleteDoc, query, where, serverTimestamp } from '../services/firebase.js';

const fbCol = col     => collection(db, 'lexia', window._fbUser.uid, col);
const fbDoc = (col,id) => doc(db, 'lexia', window._fbUser.uid, col, id);

// ── Guardar nuevo evento ──────────────────────────────────
export async function guardarNuevoEvento() {
  if (!window._fbUser) { alert('Iniciá sesión primero'); return; }
  const titulo = document.getElementById('evt-titulo')?.value?.trim();
  const fecha  = document.getElementById('evt-fecha')?.value;
  if (!titulo) {
    const el = document.getElementById('evt-titulo');
    if (el) { el.style.borderColor = 'var(--burgundy)'; el.focus(); setTimeout(() => el.style.borderColor = '', 2000); }
    alert('⚠️ El título del evento es obligatorio'); return;
  }
  if (!fecha) {
    const el = document.getElementById('evt-fecha');
    if (el) { el.style.borderColor = 'var(--burgundy)'; el.focus(); setTimeout(() => el.style.borderColor = '', 2000); }
    alert('⚠️ La fecha es obligatoria'); return;
  }
  try {
    await addDoc(fbCol('eventos'), {
      titulo,
      tipo:       document.getElementById('evt-tipo')?.value || 'Audiencia',
      expediente: document.getElementById('evt-expediente')?.value || '',
      fecha,
      hora:       document.getElementById('evt-hora')?.value || '',
      lugar:      document.getElementById('evt-lugar')?.value?.trim() || '',
      createdAt:  serverTimestamp()
    });
    window.closeModal?.('modal-evento');
    ['evt-titulo','evt-fecha','evt-hora','evt-lugar'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    alert('Evento agendado ✓');
  } catch (e) { alert('Error al guardar: ' + e.message); }
}

// ── Guardar nuevo honorario ───────────────────────────────
export async function guardarNuevoHonorario() {
  if (!window._fbUser) { alert('Iniciá sesión primero'); return; }
  const concepto = document.getElementById('hon-concepto')?.value?.trim();
  const monto    = parseFloat(document.getElementById('hon-monto')?.value) || 0;
  const fecha    = document.getElementById('hon-fecha')?.value;
  if (!concepto) { alert('El concepto es obligatorio'); return; }
  if (!monto)    { alert('El monto es obligatorio'); return; }
  if (!fecha)    { alert('La fecha es obligatoria'); return; }
  try {
    await addDoc(fbCol('honorarios'), {
      concepto, monto, fecha,
      estado:     document.getElementById('hon-estado')?.value || 'cobrado',
      medio:      document.getElementById('hon-medio')?.value || 'Transferencia',
      expediente: document.getElementById('hon-exp-sel')?.value || '',
      createdAt:  serverTimestamp()
    });
    window.closeModal?.('modal-honorario');
    ['hon-concepto','hon-monto','hon-fecha'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    alert('Honorario registrado ✓');
  } catch (e) { alert('Error al guardar: ' + e.message); }
}

// ── Guardar nuevo cliente ─────────────────────────────────
export async function guardarNuevoCliente() {
  if (!window._fbUser) { alert('Iniciá sesión primero'); return; }
  const nombre = document.getElementById('cli-nombre')?.value?.trim();
  if (!nombre) { alert('El nombre es obligatorio'); return; }
  try {
    await addDoc(fbCol('clientes'), {
      nombre,
      tipo:      document.getElementById('cli-tipo')?.value || 'Persona Física',
      cuit:      document.getElementById('cli-cuit')?.value?.trim() || '',
      telefono:  document.getElementById('cli-telefono')?.value?.trim() || '',
      email:     document.getElementById('cli-email')?.value?.trim() || '',
      domicilio: document.getElementById('cli-domicilio')?.value?.trim() || '',
      notas:     document.getElementById('cli-notas')?.value?.trim() || '',
      createdAt: serverTimestamp()
    });
    window.closeModal?.('modal-cliente');
    ['cli-nombre','cli-cuit','cli-telefono','cli-email','cli-domicilio','cli-notas'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } catch (e) { alert('Error al guardar: ' + e.message); }
}

// ── Archivo seleccionado para documento ──────────────────
export function handleDocFile(file) {
  if (!file) return;
  window._docFile = file;
  const label = document.getElementById('doc-drop-label');
  if (label) {
    label.innerHTML = `<div style="font-size:28px">📎</div><div style="font-size:13px;font-weight:600;margin-top:6px">${file.name}</div><div style="font-size:11px;color:var(--success);margin-top:4px">✓ ${(file.size/1024/1024).toFixed(2)} MB — listo para guardar</div>`;
  }
  const nombreEl = document.getElementById('doc-nombre');
  if (nombreEl && !nombreEl.value) nombreEl.value = file.name.replace(/\.[^.]+$/, '');
}

// ── Abrir modal de documento ──────────────────────────────
export function abrirModalDoc() {
  window.openModal?.('modal-doc');
  if (window.currentExpId) {
    const sel = document.getElementById('doc-exp-sel');
    if (sel) sel.value = window.currentExpId;
    const exp    = (window._allExpedientes || []).find(e => e.id === window.currentExpId);
    const nombreEl = document.getElementById('doc-nombre');
    if (nombreEl && exp && !nombreEl.value) nombreEl.placeholder = `Ej: Sentencia — ${(exp.caratula || '').substring(0, 40)}`;
  }
  const fechaEl = document.getElementById('doc-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = new Date().toISOString().slice(0, 10);
}

// ── Guardar documento ─────────────────────────────────────
export async function guardarDocumento() {
  if (!window._fbUser) { alert('Iniciá sesión primero'); return; }
  const nombre    = document.getElementById('doc-nombre')?.value?.trim();
  const expId     = document.getElementById('doc-exp-sel')?.value || window.currentExpId || '';
  const categoria = document.getElementById('doc-categoria')?.value || 'Escrito judicial';
  const fecha     = document.getElementById('doc-fecha')?.value || new Date().toISOString().slice(0, 10);
  const notas     = document.getElementById('doc-notas')?.value?.trim() || '';
  const archivo   = window._docFile;
  if (!nombre && !archivo) { alert('Ingresá al menos el nombre del documento'); return; }
  if (!expId) { alert('Seleccioná el expediente'); return; }

  const exp = (window._allExpedientes || []).find(e => e.id === expId);
  const uid = window._fbUser.uid;

  let archivoUrl = '', archivoPublicId = '', archivoTamanio = 0, archivoNombre = '', archivoTipo = '';
  if (archivo) {
    const btnGuardar = document.querySelector('#modal-doc .btn-primary');
    if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = '⏳ Subiendo...'; }
    try {
      const result = await window.subirArchivoCloudinary?.(archivo, pct => {
        if (btnGuardar) btnGuardar.textContent = `⏳ Subiendo ${pct}%...`;
      });
      if (result) { archivoUrl = result.url; archivoPublicId = result.publicId; archivoTamanio = result.tamanio; archivoNombre = archivo.name; archivoTipo = archivo.type; }
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = '💾 Guardar documento'; }
    } catch (uploadErr) {
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = '💾 Guardar documento'; }
      alert('Error al subir el archivo: ' + uploadErr.message + '\n\nEl documento se guardará sin archivo adjunto.');
    }
  }

  const docData = {
    nombre: nombre || (archivo?.name || 'Documento'),
    expedienteId: expId, expediente: exp?.numero || exp?.caratula || '',
    caratula: exp?.caratula || '', categoria, fecha, notas,
    archivoNombre, archivoTipo, archivoTamanio, archivoUrl, archivoPublicId,
    createdAt: serverTimestamp()
  };

  try {
    window.setSyncing?.();
    const existing = await getDocs(query(collection(db, `lexia/${uid}/documentos`), where('expedienteId', '==', expId), where('nombre', '==', docData.nombre)));
    if (!existing.empty) {
      if (!confirm('Ya existe un documento con ese nombre en este expediente. ¿Querés reemplazarlo?')) { window.setSyncOk?.(); return; }
      await deleteDoc(doc(db, `lexia/${uid}/documentos/${existing.docs[0].id}`));
    }
    await addDoc(collection(db, `lexia/${uid}/documentos`), docData);
    await addDoc(collection(db, `lexia/${uid}/expedientes/${expId}/movimientos`), {
      tipo: 'documento', titulo: `${categoria}: ${docData.nombre}`,
      descripcion: notas || (archivo ? `Archivo: ${archivo.name}` : ''), fecha, createdAt: serverTimestamp()
    });
    window.setSyncOk?.();
    window.closeModal?.('modal-doc');
    ['doc-nombre','doc-notas'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const fechaEl = document.getElementById('doc-fecha'); if (fechaEl) fechaEl.value = '';
    window._docFile = null;
    const zone = document.getElementById('doc-drop-label');
    if (zone) zone.innerHTML = '<div style="font-size:28px;margin-bottom:6px">📄</div><div style="font-size:13px;font-weight:500">Arrastrá o hacé clic para seleccionar</div><div style="font-size:11px;color:var(--muted);margin-top:3px">PDF, DOCX, XLSX, JPG</div>';
    if (window.currentExpId === expId) window.openExpediente?.(window.currentExpId);
    alert('✅ Documento guardado correctamente.');
  } catch (e) { window.setSyncErr?.(); alert('Error al guardar: ' + e.message); }
}

// ── Bridge global ─────────────────────────────────────────
window.guardarNuevoEvento    = guardarNuevoEvento;
window.guardarNuevoHonorario = guardarNuevoHonorario;
window.guardarNuevoCliente   = guardarNuevoCliente;
window.handleDocFile         = handleDocFile;
window.abrirModalDoc         = abrirModalDoc;
window.guardarDocumento      = guardarDocumento;

import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  serverTimestamp 
} from './firebase';

window._modulosCache = {};
window._alertasNormativasCache = null;

// ─── MAPEO FUERO → MÓDULO ───
export function detectarModulo(expediente) {
  if (!expediente) return 'laboral'; // default
  const fuero = (expediente.fuero || '').toLowerCase();
  const caratula = (expediente.caratula || '').toLowerCase();
  const descripcion = (expediente.descripcion || '').toLowerCase();
  const texto = fuero + ' ' + caratula + ' ' + descripcion;

  // Penal empresarial
  if (texto.match(/penal|criminal|correccional|tributari|ambiental.*penal|falsif|defraud|evasion/))
    return 'penal';

  // Societario / IGJ
  if (texto.match(/igj|societari|srl|s\.r\.l\.|s\.a\.|inscripci.*sociedad|registro publico|estatuto|contrato social/))
    return 'societario';

  // Habilitaciones / compliance ambiental
  if (texto.match(/habilitacion|agc|apra|caa|aptitud ambiental|clausura|inspeccion|residuos|ambiental|gcba.*admin|contencioso.*caba|licitaci/))
    return 'habilitaciones';

  // Civil y comercial
  if (texto.match(/civil|comercial|daños|perjuicio|contrato|sucesion|honorario|ejecutivo|pagare|cheque|concurso|quiebra|lrt.*civil|opcion civil/))
    return 'civil_comercial';

  // Compliance
  if (texto.match(/compliance|auditoria|matriz|informe.*cumplimiento/))
    return 'compliance';

  // Laboral
  return 'laboral';
}

const MODULO_IDS = {
  laboral:        'laboral',
  habilitaciones: 'habilitaciones',
  societario:     'societario',
  compliance:     'compliance',
  civil_comercial: 'civil_comercial',
  penal:          'penal',
  alertas:        'alertas_normativas'
};

// ─── CARGAR MÓDULO DESDE FIRESTORE ───
export async function cargarModulo(moduloId) {
  if (window._modulosCache[moduloId]) return window._modulosCache[moduloId];

  const uid = window._fbUser?.uid;
  if (!uid) return null;

  try {
    const snap = await getDoc(doc(db, `lexia/${uid}/modulos/${MODULO_IDS[moduloId]}`));
    if (snap.exists()) {
      const texto = snap.data().texto || '';
      window._modulosCache[moduloId] = texto;
      return texto;
    }
    return null;
  } catch (e) {
    console.warn('Error cargando módulo:', moduloId, e);
    return null;
  }
}

// ─── SUBIR MÓDULO A FIRESTORE ───
export async function subirModulo(moduloId, texto) {
  const uid = window._fbUser?.uid;
  if (!uid) throw new Error('Sin sesión');

  await setDoc(doc(db, `lexia/${uid}/modulos/${MODULO_IDS[moduloId]}`), {
    texto,
    updatedAt: serverTimestamp(),
    version: '1.0'
  });
  window._modulosCache[moduloId] = texto;
}

// ─── CONSTRUIR SYSTEM PROMPT CON MÓDULO ───
export async function buildSystemPromptConModulo(expediente) {
  const moduloId = detectarModulo(expediente);
  const [moduloTexto, alertasTexto] = await Promise.all([
    cargarModulo(moduloId),
    cargarModulo('alertas')
  ]);

  let systemPrompt = `Sos el asistente jurídico del Dr. Eduardo N. Andrés (CPACF T°73 F°571), titular de EANDRES Sistema Integral Legal.
Respondés en español argentino formal jurídico.
Fecha actual: ${new Date().toLocaleDateString('es-AR')}.`;

  if (moduloTexto) {
    systemPrompt += `\n\n═══════════════════════════════════════
PERFIL DE PRÁCTICA — MÓDULO ACTIVO: ${moduloId.toUpperCase().replace('_', ' ')}
═══════════════════════════════════════\n${moduloTexto}`;
  }

  if (alertasTexto) {
    const lineasCriticas = alertasTexto.split('\n')
      .filter(l => l.includes('🔴') || l.includes('⚠️') || l.includes('Alerta'))
      .slice(0, 15)
      .join('\n');
    if (lineasCriticas) {
      systemPrompt += `\n\n═══════════════════════════════════════
ALERTAS NORMATIVAS CRÍTICAS (verificar antes de citar)
═══════════════════════════════════════\n${lineasCriticas}`;
    }
  }

  return systemPrompt;
}

// ─── PANEL DE GESTIÓN DE MÓDULOS ───
export async function gestionarModulos() {
  var uid = window._fbUser ? window._fbUser.uid : null;
  if (!uid) { alert('Iniciá sesión primero'); return; }

  var modulosCargados = {};
  try {
    var snap = await getDocs(collection(db, 'lexia/' + uid + '/modulos'));
    snap.docs.forEach(function(d) {
      var ts = d.data().updatedAt;
      modulosCargados[d.id] = ts && ts.toDate ? ts.toDate().toLocaleDateString('es-AR') : 'Cargado';
    });
  } catch (e) {}

  var modulosInfo = [
    { id: 'laboral',        nombre: 'Laboral',           archivo: 'CLAUDE-laboral-EANDRES.md',         fueros: 'JNT · CNAT · Laboral PBA' },
    { id: 'habilitaciones', nombre: 'Habilitaciones',    archivo: 'CLAUDE-habilitaciones-EANDRES.md',  fueros: 'AGC · APRA · ANMAT · SRT' },
    { id: 'societario',     nombre: 'Societario',        archivo: 'CLAUDE-societario-EANDRES.md',      fueros: 'IGJ · Registro Público' },
    { id: 'compliance',     nombre: 'Compliance',        archivo: 'CLAUDE-compliance-EANDRES.md',      fueros: 'Uso interno · Auditorías' },
    { id: 'civil_comercial',nombre: 'Civil y Comercial', archivo: 'CLAUDE-civil-comercial-EANDRES.md', fueros: 'Civil · Comercial · LCQ' },
    { id: 'penal',          nombre: 'Penal Empresarial', archivo: 'CLAUDE-penal-empresarial-EANDRES.md',fueros: 'JNCyC · JNPE · Federal' },
    { id: 'alertas',        nombre: 'Alertas Normativas',archivo: 'ALERTAS-normativas-EANDRES.md',     fueros: 'Todos los módulos' }
  ];

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:14px;max-width:780px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow:hidden;display:flex;flex-direction:column';
  modal.onclick = function(e){ e.stopPropagation(); };

  var header = document.createElement('div');
  header.style.cssText = 'padding:20px 24px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;flex-shrink:0';
  header.innerHTML = '<div><div style="font-size:16px;font-weight:600;color:#0F2244">⚙️ Módulos CLAUDE.md — EANDRES SIL</div><div style="font-size:12px;color:var(--muted);margin-top:2px">Subí los archivos .md generados para activar el perfil de práctica en cada módulo</div></div>';
  var btnCerrar = document.createElement('button');
  btnCerrar.textContent = '✕';
  btnCerrar.style.cssText = 'background:none;border:none;cursor:pointer;font-size:20px;color:var(--muted);padding:4px 8px';
  btnCerrar.onclick = function(){ overlay.remove(); };
  header.appendChild(btnCerrar);
  modal.appendChild(header);

  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;padding:16px 24px;flex:1';

  var info = document.createElement('div');
  info.style.cssText = 'background:#FFF3CD;border:1px solid #F39C12;border-radius:8px;padding:12px 14px;font-size:12px;color:#856404;margin-bottom:16px';
  info.innerHTML = '<strong>¿Cómo funciona?</strong> Descargá los archivos CLAUDE.md de esta sesión, luego subílos aquí. El asistente IA leerá automáticamente el módulo que corresponde al fuero de cada expediente.';
  body.appendChild(info);

  var statusDiv = document.createElement('div');
  statusDiv.id = 'modulos-upload-status';
  statusDiv.style.cssText = 'min-height:18px;font-size:12px;margin-bottom:10px';
  body.appendChild(statusDiv);

  var table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr style="background:#F5F8FC">'
    + '<th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Módulo</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Archivo</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Aplica a</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Estado</th>'
    + '<th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Acción</th>'
    + '</tr>';
  table.appendChild(thead);
  var tbody = document.createElement('tbody');
  modulosInfo.forEach(function(m) {
    var cargado = modulosCargados[MODULO_IDS[m.id]] || '';
    var tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-light)';
    
    var tdNombre = document.createElement('td');
    tdNombre.style.cssText = 'padding:10px;font-size:13px;font-weight:500';
    tdNombre.textContent = m.nombre;
    
    var tdArchivo = document.createElement('td');
    tdArchivo.style.cssText = 'padding:10px;font-size:11.5px;color:var(--muted);font-family:monospace';
    tdArchivo.textContent = m.archivo;
    
    var tdFueros = document.createElement('td');
    tdFueros.style.cssText = 'padding:10px;font-size:11.5px;color:var(--muted)';
    tdFueros.textContent = m.fueros;
    
    var tdEstado = document.createElement('td');
    tdEstado.style.cssText = 'padding:10px';
    var spanEstado = document.createElement('span');
    if(cargado) {
      spanEstado.style.cssText = 'color:#0B7A4E;font-size:11px;font-weight:600';
      spanEstado.textContent = '✅ ' + cargado;
    } else {
      spanEstado.style.cssText = 'color:#C0392B;font-size:11px;font-weight:600';
      spanEstado.textContent = '⚠️ No cargado';
    }
    tdEstado.appendChild(spanEstado);
    
    var tdAccion = document.createElement('td');
    tdAccion.style.cssText = 'padding:10px';
    var label = document.createElement('label');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:#0F2244;color:#fff;border-radius:6px;padding:5px 10px;font-size:11.5px;cursor:pointer';
    label.textContent = '📁 Subir';
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.md,.txt';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function(){ uploadModuloFile(m.id, fileInput); });
    label.appendChild(fileInput);
    tdAccion.appendChild(label);
    
    if(cargado) {
      var btnRefresh = document.createElement('button');
      btnRefresh.textContent = '↺ Refrescar';
      btnRefresh.style.cssText = 'background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;margin-left:4px;color:var(--muted)';
      btnRefresh.addEventListener('click', function(){ limpiarCacheModulo(m.id); });
      tdAccion.appendChild(btnRefresh);
    }
    tr.appendChild(tdNombre);
    tr.appendChild(tdArchivo);
    tr.appendChild(tdFueros);
    tr.appendChild(tdEstado);
    tr.appendChild(tdAccion);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(table);

  var moduloActivoDiv = document.createElement('div');
  moduloActivoDiv.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light)';
  var moduloActivoLabel = document.createElement('div');
  moduloActivoLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px';
  moduloActivoLabel.textContent = 'Módulo activo en expediente actual';
  var moduloActivoInfo = document.createElement('div');
  moduloActivoInfo.style.cssText = 'font-size:13px;color:var(--ink)';
  if(window._currentExpData) {
    var car = window._currentExpData.caratula || '—';
    var mod = detectarModulo(window._currentExpData).replace(/_/g,' ').toUpperCase();
    moduloActivoInfo.innerHTML = 'Expediente: <strong>' + car + '</strong><br>Módulo detectado: <strong>' + mod + '</strong>';
  } else {
    moduloActivoInfo.textContent = 'Abrí un expediente para ver el módulo que se activará.';
  }
  moduloActivoDiv.appendChild(moduloActivoLabel);
  moduloActivoDiv.appendChild(moduloActivoInfo);
  body.appendChild(moduloActivoDiv);
  modal.appendChild(body);

  var footer = document.createElement('div');
  footer.style.cssText = 'padding:14px 24px;border-top:1px solid var(--border-light);display:flex;justify-content:flex-end;flex-shrink:0';
  var btnCerrar2 = document.createElement('button');
  btnCerrar2.textContent = 'Cerrar';
  btnCerrar2.style.cssText = 'background:#0F2244;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:13px;cursor:pointer';
  btnCerrar2.onclick = function(){ overlay.remove(); };
  footer.appendChild(btnCerrar2);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

export async function uploadModuloFile(moduloId, input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('modulos-upload-status');
  if (statusEl) { statusEl.textContent = '⏳ Subiendo ' + file.name + '...'; statusEl.style.color = 'var(--muted)'; }

  try {
    const texto = await file.text();
    await subirModulo(moduloId, texto);
    if (statusEl) {
      statusEl.textContent = '✅ ' + file.name + ' cargado correctamente. El módulo está activo.';
      statusEl.style.color = '#0B7A4E';
    }
    setTimeout(() => gestionarModulos(), 800);
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ Error: ' + e.message; statusEl.style.color = '#C0392B'; }
  }
}

export function limpiarCacheModulo(moduloId) {
  delete window._modulosCache[moduloId];
  if (window.showToast) window.showToast('↺ Caché del módulo ' + moduloId + ' limpiado');
}

export function agregarBotonesModulos() {
  const topbarActions = document.querySelector('.topbar-actions');
  if (!topbarActions || document.getElementById('btn-modulos-eandres')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-modulos-eandres';
  btn.className = 'btn btn-ghost btn-sm';
  btn.title = 'Gestionar módulos CLAUDE.md';
  btn.style.cssText = 'font-size:12px;padding:5px 10px;border:1px solid rgba(0,180,216,.3);color:#0096B4';
  btn.innerHTML = '⚙ Módulos IA';
  btn.onclick = gestionarModulos;

  const btnLogout = topbarActions.querySelector('[onclick*="doLogout"]');
  if (btnLogout) {
    topbarActions.insertBefore(btn, btnLogout);
  } else {
    topbarActions.appendChild(btn);
  }
}

// Bind to window
window.detectarModulo = detectarModulo;
window.cargarModulo = cargarModulo;
window.subirModulo = subirModulo;
window.buildSystemPromptConModulo = buildSystemPromptConModulo;
window.gestionarModulos = gestionarModulos;
window.uploadModuloFile = uploadModuloFile;
window.limpiarCacheModulo = limpiarCacheModulo;
window.agregarBotonesModulos = agregarBotonesModulos;

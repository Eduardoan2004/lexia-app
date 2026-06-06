// ════════════════════════════════════════════════════════
//  EANDRES SIL — Bootstrap
//  Inicialización post-login + hooks de integración entre módulos
// ════════════════════════════════════════════════════════

import { db, doc, getDoc, setDoc } from '../services/firebase.js';
import { calcularIniciales } from '../views/Configuracion.js';
import { getApiKey } from '../views/Configuracion.js';

const GEMINI_MODEL = 'gemini-3-flash-preview';

// ────────────────────────────────────────────────────────
// CALLBACK PRINCIPAL POST-LOGIN
// Se llama desde main.js cuando Firebase confirma la sesión
// ────────────────────────────────────────────────────────
window._fbReady = async function(user) {
  // Avatar del sidebar
  if (user.photoURL) {
    document.getElementById('sidebar-avatar-initials').innerHTML =
      `<img src="${user.photoURL}" style="width:34px;height:34px;border-radius:50%;object-fit:cover" alt="">`;
  } else {
    document.getElementById('sidebar-avatar-initials').textContent = calcularIniciales(user.displayName);
  }
  document.getElementById('sidebar-user-name').textContent = user.displayName || user.email;

  // Cargar perfil guardado
  await window.fbCargarPerfil?.();

  // Migrar nombre viejo LexIA → EANDRES
  try {
    const snap = await getDoc(doc(db, `lexia/${user.uid}/config/perfil`));
    const p    = snap.exists() ? snap.data() : {};
    const needsUpdate = !p.estudioNombre || p.estudioNombre === 'LexIA' || p.estudioSub === 'Gestión de Expedientes';
    if (needsUpdate) await setDoc(doc(db, `lexia/${user.uid}/config/perfil`), { estudioNombre: 'EANDRES', estudioSub: 'Sistema Inteligente Legal' }, { merge: true });
    const nombre = needsUpdate ? 'EANDRES' : (p.estudioNombre || 'EANDRES');
    const sub    = needsUpdate ? 'Sistema Inteligente Legal' : (p.estudioSub || 'Sistema Inteligente Legal');
    const el = document.getElementById('sidebar-estudio-nombre');
    const el2 = document.getElementById('sidebar-estudio-sub');
    if (el) el.textContent = nombre;
    if (el2) el2.textContent = sub;
  } catch {}

  // Suscribir colecciones en tiempo real
  window.fbSuscribirExpedientes?.();
  window.suscribirClientes?.();
  window.suscribirEventos?.();
  window.suscribirHonorarios?.();
  window.cargarConfigEstudio?.();

  // Módulos IA: botón en topbar + precargar laboral
  setTimeout(() => window.agregarBotonesModulos?.(), 500);
  setTimeout(() => window.cargarModulo?.('laboral'), 1500);

  window.setSyncOk?.();
};

// ────────────────────────────────────────────────────────
// HOOK: openExpediente → precargar módulo IA correspondiente
// ────────────────────────────────────────────────────────
const _openExpOrig = () => window.openExpediente;
document.addEventListener('DOMContentLoaded', () => {
  // Se parchea después de que todos los módulos carguen
  setTimeout(() => {
    const orig = window.openExpediente;
    if (!orig) return;
    window.openExpediente = function(id) {
      orig(id);
      setTimeout(() => {
        const exp = (window._allExpedientes || []).find(e => e.id === id);
        if (exp) window.cargarModulo?.(window.detectarModulo?.(exp));
        // Inyectar Lyzr si el tab IA está visible
        if (document.getElementById('tab-ia-analisis')?.style.display !== 'none') {
          inyectarLyzrEnIATab();
        }
      }, 300);
    };
  }, 200);
});

// ────────────────────────────────────────────────────────
// HOOK: switchDetailTab → cowork + Lyzr
// ────────────────────────────────────────────────────────
setTimeout(() => {
  const origTab = window.switchDetailTab;
  if (!origTab) return;
  window.switchDetailTab = function(tabEl, panelId) {
    origTab(tabEl, panelId);
    if (panelId === 'tab-cowork' && window.currentExpId) window.cargarCoworkLog?.(window.currentExpId);
    if (panelId === 'tab-ia-analisis') setTimeout(inyectarLyzrEnIATab, 100);
  };
}, 200);

// ────────────────────────────────────────────────────────
// HOOK: navigate → cowork global
// ────────────────────────────────────────────────────────
setTimeout(() => {
  const origNav = window.navigate;
  if (!origNav) return;
  window.navigate = function(view) {
    origNav(view);
    if (view === 'cowork'            && window._fbUser) window._cargarCoworkGlobal?.();
    if (view === 'consulta-judicial' && window._fbUser) window.initConsultaJudicial?.();
  };
}, 200);

// ────────────────────────────────────────────────────────
// HOOK: iaAnalisis → auto-log en cowork
// ────────────────────────────────────────────────────────
setTimeout(() => {
  const origIA = window.iaAnalisis;
  if (!origIA) return;
  window.iaAnalisis = async function(tipo) {
    await origIA(tipo);
    const txt = window._iaResultadoTexto;
    if (txt && window.currentExpId && txt.length > 50) {
      const tipoLabel = {
        demanda:'escrito', contesta_demanda:'escrito', alegato_escrito:'escrito',
        expresion_agravios:'escrito', recurso_nulidad:'escrito', revocatoria:'escrito',
        ref:'escrito', escrito_tramite:'escrito', incidente:'escrito',
        impugnacion:'escrito', medida_cautelar:'escrito', beneficio_litigar:'escrito',
        ofrecimiento_prueba:'escrito', resumen_integral:'análisis', resumen_partes:'análisis',
        argumentos_prueba:'análisis', abogado_contrario:'análisis', mapa_vulnerabilidades:'análisis',
        contradicciones:'análisis', auditoria_errores:'análisis', plan_accion:'análisis',
        juris_general:'investigación', juris_momento:'investigación',
        juris_resultado:'investigación', juris_argumento:'investigación',
      };
      await window.addCoworkEntry?.(window.currentExpId, {
        tipo: tipoLabel[tipo] || 'análisis', skill: tipo, estado: 'borrador', tiempo: 0.25,
        notas: `IA generó ${tipo.replace(/_/g, ' ')} — ${txt.substring(0, 120)}...`, por: 'claude'
      });
    }
  };
}, 200);

// ────────────────────────────────────────────────────────
// LYZR: inyectar UI en tab Análisis IA
// ────────────────────────────────────────────────────────
export function inyectarLyzrEnIATab() {
  if (document.getElementById('lyzr-section')) return;
  const iaTab = document.getElementById('tab-ia-analisis');
  if (!iaTab) return;
  const section = document.createElement('div');
  section.id = 'lyzr-section';
  section.style.cssText = 'margin-top:20px;border-top:2px solid rgba(0,180,216,.2);padding-top:20px';
  section.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="background:#0F2244;border-radius:8px;padding:6px 10px;display:flex;align-items:center;gap:6px">
        <span style="font-size:14px">⚡</span>
        <span style="font-size:12px;font-weight:600;color:#fff">EANDRES-Laboral</span>
        <span style="font-size:10px;color:#00B4D8;margin-left:2px">Lyzr Agent</span>
      </div>
      <span style="font-size:11.5px;color:var(--muted)">Agente especializado en defensa laboral empresarial</span>
      <button onclick="initLyzrChat()" style="margin-left:auto;font-size:11px;background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer;color:var(--muted)">↻ Nueva sesión</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <button onclick="document.getElementById('lyzr-input').value='Analizá la posición defensiva de la empresa en este expediente';sendLyzrMessage()" style="font-size:11px;padding:5px 10px;border-radius:20px;border:1px solid rgba(0,180,216,.3);background:rgba(0,180,216,.06);color:#0096B4;cursor:pointer">🛡 Posición defensiva</button>
      <button onclick="document.getElementById('lyzr-input').value='¿Qué argumentos tiene la contraparte y cómo los rebatimos?';sendLyzrMessage()" style="font-size:11px;padding:5px 10px;border-radius:20px;border:1px solid rgba(0,180,216,.3);background:rgba(0,180,216,.06);color:#0096B4;cursor:pointer">⚔️ Rebatir argumentos</button>
      <button onclick="document.getElementById('lyzr-input').value='Redactá un borrador de contestación de demanda para este expediente';sendLyzrMessage()" style="font-size:11px;padding:5px 10px;border-radius:20px;border:1px solid rgba(0,180,216,.3);background:rgba(0,180,216,.06);color:#0096B4;cursor:pointer">✍️ Contestación</button>
      <button onclick="document.getElementById('lyzr-input').value='¿Cuál es el riesgo contingencial estimado para este expediente?';sendLyzrMessage()" style="font-size:11px;padding:5px 10px;border-radius:20px;border:1px solid rgba(0,180,216,.3);background:rgba(0,180,216,.06);color:#0096B4;cursor:pointer">📊 Riesgo contingencial</button>
    </div>
    <div id="lyzr-chat-container" style="max-height:300px;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:0"></div>
    <div style="display:flex;gap:8px">
      <input id="lyzr-input" class="form-control" placeholder="Consultá al agente laboral…" style="flex:1;font-size:13px"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendLyzrMessage()}">
      <button class="btn btn-primary" onclick="sendLyzrMessage()" style="white-space:nowrap;background:#0F2244">⚡ Enviar</button>
    </div>
    <div style="font-size:10.5px;color:var(--muted);margin-top:6px">Powered by Lyzr Agent Studio · gpt-4o-mini</div>`;
  iaTab.appendChild(section);
}

// ────────────────────────────────────────────────────────
// Seleccionar documento guardado para análisis IA
// ────────────────────────────────────────────────────────
export async function seleccionarDocGuardado(docId) {
  if (!docId) return;
  const uid = window._fbUser?.uid; if (!uid) return;
  const { collection, getDocs, query, where } = window._fb;
  try {
    const snap = await getDocs(query(collection(db, `lexia/${uid}/documentos`), where('expedienteId', '==', window.currentExpId)));
    const d    = snap.docs.find(x => x.id === docId)?.data();
    if (!d) return;
    const status = document.getElementById('ia-file-status');
    if (d.archivoUrl) {
      window._currentDocUrl  = d.archivoUrl;
      window._docTextoIA     = `[Documento: ${d.nombre||d.archivoNombre} — ${d.categoria} — ${d.fecha}]\nURL: ${d.archivoUrl}`;
      if (status) { status.textContent = '✅ ' + (d.nombre||d.archivoNombre) + ' seleccionado'; status.style.color = '#0B7A4E'; }
    } else {
      if (status) { status.textContent = '⚠️ Este documento no tiene archivo subido'; status.style.color = '#B07A00'; }
    }
  } catch (e) { console.warn(e); }
}

// ────────────────────────────────────────────────────────
// Extraer partes desde PDF de demanda (Gemini IA)
// ────────────────────────────────────────────────────────
export async function extraerPartesDeDemandia(file) {
  if (!file) return;
  const status = document.getElementById('demanda-pdf-status');
  if (status) { status.textContent = '⏳ Analizando demanda con IA...'; status.style.color = 'var(--muted)'; }
  try {
    const key = await getApiKey();
    if (!key) { if (status) { status.textContent = '⚠️ Configurá tu API key de Gemini en Configuración'; status.style.color = '#B07A00'; } return; }
    const bytes  = new Uint8Array(await file.arrayBuffer());
    let binary   = ''; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const prompt = `Analizá esta demanda judicial argentina y extraé las partes del proceso.
Devolvé ÚNICAMENTE un JSON válido con este formato, sin texto adicional:
{"partes":[{"rol":"actor|demandado|coactor|codemandado|tercero","nombre":"APELLIDO, NOMBRE o RAZON SOCIAL","cuit":"XX-XXXXXXXX-X o vacio","letrados":[{"nombre":"APELLIDO, NOMBRE","matricula":"CPACF T XX F XXX o equivalente","domicilio":"domicilio constituido completo","email":"","tel":""}]}]}
Reglas: incluí TODAS las partes y TODOS sus letrados. Si no encontrás un dato dejá el campo vacío. Nombres en MAYUSCULAS.`;
    const body   = { contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'application/pdf', data: base64 } }, { text: prompt }] }], generationConfig: { maxOutputTokens: 3000, temperature: 0.1 } };
    const resp   = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'Error ' + resp.status); }
    let texto = (await resp.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
    texto = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const ji = texto.indexOf('{'), je = texto.lastIndexOf('}');
    if (ji === -1 || je === -1) throw new Error('No se encontró JSON en la respuesta');
    const resultado = JSON.parse(texto.slice(ji, je + 1));
    if (!resultado.partes?.length) throw new Error('No se encontraron partes en el documento');
    const list = document.getElementById('partes-list');
    if (list) list.querySelectorAll('[id^="parte-item-"]').forEach(d => d.remove());
    window._partesExp = [];
    const empty = document.getElementById('partes-empty');
    if (empty) empty.style.display = 'none';
    resultado.partes.forEach((p, i) => window.agregarParteForm?.(p, i));
    if (status) { status.textContent = `✅ ${resultado.partes.length} parte(s) extraída(s). Revisá y guardá.`; status.style.color = '#0B7A4E'; }
    document.getElementById('demanda-pdf-input').value = '';
  } catch (e) {
    if (status) { status.textContent = '❌ Error: ' + (e.message || 'No se pudo procesar el PDF'); status.style.color = '#C0392B'; }
  }
}

// ────────────────────────────────────────────────────────
// Consultar expediente en portal judicial según fuero
// ────────────────────────────────────────────────────────
export function consultarExpedienteJudicial() {
  const e = window._currentExpData;
  if (!e) { window.navigate?.('busqueda-judicial'); return; }
  if (e.linkJudicial) { window.open(e.linkJudicial, '_blank', 'noopener,noreferrer'); return; }
  const fuero  = (e.fuero || '').toLowerCase();
  const numero = (e.numero || '').trim();
  const portales = [];
  if (fuero.includes('civil')||fuero.includes('comercial')||fuero.includes('laboral')||fuero.includes('cnt')||fuero.includes('penal')||fuero.includes('familia')||fuero.includes('contencioso administrativo federal'))
    portales.push({ nombre: 'PJN — Consultas Web Nacional', url: 'https://scw.pjn.gov.ar/scw/home.seam', color: '#0F2244' });
  if (fuero.includes('caba') || fuero.includes('contencioso administrativo caba'))
    portales.push({ nombre: 'Poder Judicial CABA', url: 'https://auditoria.jusbaires.gob.ar/', color: '#0F2244' });
  if (fuero.includes('pba'))
    portales.push({ nombre: 'SCBA — Suprema Corte PBA', url: 'https://scba.gov.ar/consultas/', color: '#0F2244' });
  if (fuero.includes('gcba')||fuero.includes('habilitación')||fuero.includes('ambiental gcba'))
    portales.push({ nombre: 'GCBA — Localización de Expediente', url: 'https://buenosaires.gob.ar/gcaba_historico/localizacion-de-expediente', color: '#00B4D8' });
  if (fuero.includes('afip')||fuero.includes('anses')||fuero.includes('srt')||fuero.includes('administrativo nacional'))
    portales.push({ nombre: 'Consulta Expedientes Nacional', url: 'https://www.argentina.gob.ar/formularios/consulta-de-expedientes', color: '#163366' });
  if (!portales.length) {
    portales.push(
      { nombre: 'PJN Nacional', url: 'https://scw.pjn.gov.ar/scw/home.seam', color: '#0F2244' },
      { nombre: 'GCBA Administrativo', url: 'https://buenosaires.gob.ar/gcaba_historico/localizacion-de-expediente', color: '#00B4D8' },
      { nombre: 'Expedientes Nacionales', url: 'https://www.argentina.gob.ar/formularios/consulta-de-expedientes', color: '#163366' }
    );
  }
  mostrarModalPortal(portales, numero, e);
}

export function mostrarModalPortal(portales, numero, exp) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  const btnsCopy = numero
    ? `<div style="background:#F5F8FC;border-radius:8px;padding:12px;margin-bottom:16px">
         <div style="font-size:10px;color:#5A6E8C;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">N° Expediente — copiá y pegá en el portal</div>
         <div style="display:flex;align-items:center;gap:8px">
           <span style="font-size:15px;font-weight:600;color:#0F2244;font-family:monospace;flex:1">${numero}</span>
           <button onclick="navigator.clipboard.writeText('${numero}').then(()=>window.showToast?.('✅ Copiado'))" style="background:#00B4D8;border:none;border-radius:6px;color:#0F2244;font-size:11px;font-weight:600;padding:5px 12px;cursor:pointer">📋 Copiar</button>
         </div>
       </div>` : '';
  const btnsPortal = portales.map(p =>
    `<a href="${p.url}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border:1px solid var(--border-light);border-radius:10px;text-decoration:none;color:#0F2244;font-size:13px;font-weight:500;margin-bottom:8px">
      <span>${p.nombre}</span><span style="font-size:16px">→</span>
    </a>`
  ).join('');
  overlay.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:15px;font-weight:600;color:#0F2244">🔍 Consultar expediente</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--muted)">✕</button>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">${exp.caratula||''}</div>
    ${btnsCopy}${btnsPortal}
  </div>`;
  document.body.appendChild(overlay);
}

// ── Bridge global ─────────────────────────────────────────
window.inyectarLyzrEnIATab       = inyectarLyzrEnIATab;
window.seleccionarDocGuardado    = seleccionarDocGuardado;
window.extraerPartesDeDemandia   = extraerPartesDeDemandia;
window.consultarExpedienteJudicial = consultarExpedienteJudicial;
window.mostrarModalPortal        = mostrarModalPortal;

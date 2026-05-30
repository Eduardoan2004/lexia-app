// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Asistente IA
//  Gemini · Lyzr · Análisis de documentos
// ════════════════════════════════════════════════════════

import { escapeHtml, showToast } from '../utils/helpers.js';
import { getApiKey, getLyzrApiKey } from './Configuracion.js';
import { db, collection, getDocs, query, orderBy, where } from '../services/firebase.js';

const GEMINI_MODEL    = 'gemini-3-flash-preview';
const CLOUDINARY_CLOUD  = 'dhxafk0ex';
const CLOUDINARY_PRESET = 'eandres_docs';
const LYZR_AGENT_ID  = '6a15edb3bf5922c43b8c9466';
const LYZR_API_URL   = 'https://agent.api.lyzr.ai/v3/inference/chat/';

// ────────────────────────────────────────────────────────
// GEMINI API
// ────────────────────────────────────────────────────────
export async function callGemini(systemPrompt, messages, maxTokens = 2000) {
  const key = await getApiKey();
  if (!key) return null;
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
  if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'Error ' + resp.status); }
  return (await resp.json()).candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
}

// ────────────────────────────────────────────────────────
// CHAT PRINCIPAL (panel global)
// ────────────────────────────────────────────────────────
export function setAIPrompt(text) {
  const el = document.getElementById('ai-input');
  if (el) { el.value = text; el.focus(); }
}

export async function sendAI(contextDoc) {
  const input   = document.getElementById('ai-input');
  const msg     = input?.value?.trim() || '';
  if (!msg) return;
  if (input) input.value = '';

  const history = document.getElementById('ai-chat-history');
  const userDiv = document.createElement('div');
  userDiv.style.cssText = 'background:#fff;border:1px solid var(--border-light);border-radius:10px;padding:12px 16px;margin-bottom:10px';
  userDiv.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:4px;font-weight:600">TÚ</div><div style="font-size:13.5px;color:var(--ink)">${escapeHtml(msg)}</div>`;
  history.appendChild(userDiv);
  history.scrollTop = history.scrollHeight;

  const loadDiv = document.createElement('div');
  loadDiv.style.cssText = 'background:linear-gradient(135deg,rgba(26,26,46,.08),rgba(22,33,62,.08));border-radius:10px;padding:14px 16px;border:1px solid rgba(168,180,212,.15);margin-bottom:10px';
  loadDiv.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:5px;font-weight:600">✦ ASISTENTE IA</div><div class="ai-typing" style="font-size:13.5px;color:var(--slate)">Analizando...</div>`;
  history.appendChild(loadDiv);
  history.scrollTop = history.scrollHeight;

  let sysPrompt = `Sos un asistente jurídico especializado en derecho argentino (laboral, civil, comercial, administrativo).
Hablás en español argentino. Sos preciso, profesional y práctico.
Fecha actual: ${new Date().toLocaleDateString('es-AR')}.
Expedientes activos del estudio: ${(window._allExpedientes || []).length}.`;

  if (window._currentExpData) {
    const e = window._currentExpData;
    sysPrompt += `\n\nEXPEDIENTE EN CONTEXTO:\n- Carátula: ${e.caratula||'—'}\n- N°: ${e.numero||'—'}\n- Fuero: ${e.fuero||'—'}\n- Juzgado: ${e.juzgado||'—'}\n- Cliente: ${e.cliente||'—'}\n- Contraparte: ${e.contraparte||'—'}\n- Estado: ${e.estado||'—'}\n- Próx. Vencimiento: ${e.proxVencimiento||'—'}`;
  }
  if (contextDoc) sysPrompt += `\n\nDOCUMENTO ANALIZADO:\n${contextDoc.substring(0, 8000)}`;

  const msgs = [];
  [...history.querySelectorAll('div[data-role]')].slice(-12).forEach(b => msgs.push({ role: b.dataset.role === 'user' ? 'user' : 'assistant', content: b.dataset.content || '' }));
  msgs.push({ role: 'user', content: msg });
  userDiv.dataset.role = 'user'; userDiv.dataset.content = msg;

  callGemini(sysPrompt, msgs.filter(m => m.content?.trim()), 2000)
    .then(reply => {
      if (!reply) { loadDiv.querySelector('.ai-typing').innerHTML = '<span style="color:#c0392b">⚠️ Configurá tu API key de Gemini en Configuración → Asistente IA.</span>'; return; }
      loadDiv.querySelector('.ai-typing').innerHTML = escapeHtml(reply).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      loadDiv.dataset.role = 'assistant'; loadDiv.dataset.content = reply;
      history.scrollTop = history.scrollHeight;
    })
    .catch(err => { loadDiv.querySelector('.ai-typing').innerHTML = `<span style="color:#c0392b">Error: ${escapeHtml(err.message)}</span>`; });
}

// ────────────────────────────────────────────────────────
// CHAT EN CONTEXTO DE EXPEDIENTE
// ────────────────────────────────────────────────────────
export function sendAIExp() {
  const input = document.getElementById('ai-exp-input');
  const msg   = input?.value?.trim();
  if (!msg) return;
  input.value = '';
  const chat = document.getElementById('ai-exp-chat');
  const userDiv = document.createElement('div');
  userDiv.style.cssText = 'background:#fff;border:1px solid var(--border-light);border-radius:8px;padding:10px 12px;font-size:12.5px';
  userDiv.innerHTML = `<strong style="font-size:11px;color:var(--muted)">VOS</strong><br>${escapeHtml(msg)}`;
  chat.appendChild(userDiv);
  chat.scrollTop = chat.scrollHeight;
  const respDiv = document.createElement('div');
  respDiv.style.cssText = 'background:linear-gradient(135deg,rgba(26,26,46,.06),rgba(22,33,62,.06));border-radius:8px;padding:10px 12px;font-size:12.5px;border:1px solid rgba(168,180,212,.15)';
  respDiv.innerHTML = '<strong style="font-size:11px;color:var(--muted)">✦ IA</strong><br><em>Analizando...</em>';
  chat.appendChild(respDiv);
  chat.scrollTop = chat.scrollHeight;
  sendAIConRespDiv(msg, respDiv);
}

export async function sendAIConRespDiv(msg, respDiv) {
  const e   = window._currentExpData || {};
  const sys = `Asistente jurídico argentino. Expediente en contexto: "${e.caratula||'—'}" | Fuero: ${e.fuero||'—'} | Cliente: ${e.cliente||'—'} | Contraparte: ${e.contraparte||'—'} | Estado: ${e.estado||'—'}. Respondé de forma concisa y práctica.`;
  try {
    const txt = await callGemini(sys, [{ role: 'user', content: msg }], 1000);
    if (!txt) { respDiv.innerHTML += '<br><span style="color:#c0392b">⚠️ Configurá tu API key de Gemini en Configuración → Asistente IA.</span>'; return; }
    respDiv.innerHTML = `<strong style="font-size:11px;color:var(--muted)">✦ IA</strong><br>${escapeHtml(txt).replace(/\n/g, '<br>')}`;
    respDiv.parentElement.scrollTop = respDiv.parentElement.scrollHeight;
  } catch (err) {
    respDiv.innerHTML += `<br><span style="color:#c0392b">Error: ${escapeHtml(err.message)}</span>`;
  }
}

export function initIATab() { if (window.currentExpId) window.cargarActos?.(window.currentExpId); }

// ────────────────────────────────────────────────────────
// PROCESAMIENTO DE DOCUMENTOS
// ────────────────────────────────────────────────────────
export async function procesarDocIA(file) {
  if (!file) return;
  const status = document.getElementById('ia-file-status');
  status.textContent = '⏳ Procesando ' + file.name + '...';
  status.style.color = 'var(--muted)';
  window._docFile = file;
  try {
    if (file.name.endsWith('.txt')) {
      window._docTextoIA = await file.text();
    } else if (file.name.endsWith('.pdf')) {
      const raw  = new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer()));
      let txt    = (raw.match(/stream([\s\S]*?)endstream/g) || []).map(s => (s.replace(/stream|endstream/g, '').match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ\.\-,;:0-9]{3,}/g) || []).join(' ')).join(' ');
      const parTxt = (raw.match(/\(([^\)]{3,300})\)/g) || []).map(m => m.slice(1,-1)).filter(m => /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(m)).join(' ');
      const combined = (txt + ' ' + parTxt).trim();
      window._docTextoIA = combined.length > 500 ? combined : '[PDF escaneado o sin texto extraíble. Para mejor análisis: copiá el texto del PDF y pegalo en el chat del Asistente IA.]';
    } else if (file.name.match(/\.docx?$/)) {
      window._docTextoIA = '[Documento Word: ' + file.name + ' — ' + Math.round(file.size / 1024) + 'KB. Para mejor análisis: copiá el texto y pegalo en el chat.]';
    }
    status.textContent = '⏳ Subiendo a la nube...';
    try {
      const result = await subirArchivoCloudinary(file, pct => { status.textContent = `⏳ Subiendo ${pct}%...`; });
      window._currentDocUrl = result.url;
      status.textContent = '✅ ' + file.name + ' — listo para analizar';
      status.style.color = '#0B7A4E';
    } catch {
      window._currentDocUrl = '';
      status.textContent = '✅ ' + file.name + ' cargado (sin guardar en nube)';
      status.style.color = '#0B7A4E';
    }
  } catch (e) { status.textContent = '❌ Error: ' + e.message; status.style.color = '#c0392b'; }
}

export async function subirArchivoCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('folder', 'eandres/documentos');
    formData.append('tags', window._fbUser?.uid || 'anon');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`);
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const d = JSON.parse(xhr.responseText);
        resolve({ url: d.secure_url, publicId: d.public_id, formato: d.format, tamanio: d.bytes, paginas: d.pages || 1 });
      } else reject(new Error('Error Cloudinary: ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
    xhr.send(formData);
  });
}

// ────────────────────────────────────────────────────────
// ANÁLISIS DE DOCUMENTO (tab IA en expediente)
// ────────────────────────────────────────────────────────
export async function analizarDocumentoIA(tipo) {
  const resultado = document.getElementById('ia-resultado');
  resultado.innerHTML = '<div style="color:var(--muted);font-size:13px">⏳ Analizando con Gemini...</div>';
  const exp     = window._currentExpData || {};
  const prompts = {
    actos:    `Analizá este documento judicial del expediente "${exp.caratula||'sin carátula'}" e identificá TODOS los actos procesales. Para cada acto indicá: PARTE, FECHA, TITULO, DESCRIPCION en 1-2 oraciones.`,
    resumen:  `Hacé un resumen ejecutivo del documento judicial para el expediente "${exp.caratula||''}". Incluí: tipo de documento, quién lo presentó, puntos principales, pretensión o resolución, impacto para ${exp.cliente||'mi cliente'}.`,
    alegato:  `Sos el abogado de ${exp.cliente||'el actor'} en "${exp.caratula||''}". Redactá un borrador de alegato en formato jurídico argentino con: hechos, argumentos jurídicos, citas normativas y petición final.`,
    posicion: `Analizá la posición jurídica de ${exp.cliente||'mi parte'} en "${exp.caratula||''}". Identificá: fortalezas, debilidades, riesgos procesales y recomendaciones estratégicas.`
  };
  const docText = window._docTextoIA || window._currentDocText || '';
  const docUrl  = window._currentDocUrl || '';
  let docInfo   = docText.length > 100
    ? `\n\nDOCUMENTO:\n${docText.substring(0, 8000)}`
    : docUrl
      ? `\n\n[Documento disponible en: ${docUrl} — texto no extraíble. Analizá basándote en el contexto del expediente.]`
      : '\n\n[No se cargó ningún documento. Analizá basándote en el historial del expediente.]';
  const msg = (prompts[tipo] || 'Analizá este documento.') + docInfo;
  try {
    const txt = await callGemini('Sos un asistente jurídico argentino experto.', [{ role: 'user', content: msg }], 2000);
    if (!txt) { resultado.innerHTML = '<span style="color:#c0392b">⚠️ Configurá tu API key de Gemini en Configuración.</span>'; return; }
    resultado.innerHTML = escapeHtml(txt).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  } catch (err) { resultado.innerHTML = `<span style="color:#c0392b">Error: ${escapeHtml(err.message)}</span>`; }
}

export function copiarResultadoIA() { navigator.clipboard.writeText(window._iaResultadoTexto || '').then(() => alert('✅ Copiado al portapapeles')); }

export async function guardarActosDeIA() {
  const txt    = window._iaResultadoTexto || '';
  const bloques = txt.split('---').filter(b => b.trim());
  let guardados = 0;
  for (const bloque of bloques) {
    const parte  = (bloque.match(/PARTE:\s*(\w+)/i)||[])[1]?.toLowerCase() || 'tribunal';
    const fecha  = (bloque.match(/FECHA:\s*([^\n]+)/i)||[])[1]?.trim() || '';
    const titulo = (bloque.match(/TITULO:\s*([^\n]+)/i)||[])[1]?.trim() || 'Acto procesal';
    const desc   = (bloque.match(/DESCRIPCION:\s*([^\n]+)/i)||[])[1]?.trim() || '';
    if (titulo !== 'Acto procesal' || desc) { await window.guardarActo?.({ parte, fecha, titulo, descripcion: desc }); guardados++; }
  }
  if (guardados > 0) {
    alert(`✅ ${guardados} acto(s) guardados en la pestaña Actos Procesales.`);
    const btn = document.querySelector('[onclick*="tab-actos"]');
    if (btn) window.switchDetailTab?.(btn, 'tab-actos');
  } else { alert('No se detectaron actos en el formato esperado. Guardá manualmente.'); }
}

// ────────────────────────────────────────────────────────
// ROL IA
// ────────────────────────────────────────────────────────
let _rolIA = 'actora';
export function setRolIA(rol, btn) {
  _rolIA = rol;
  document.querySelectorAll('[onclick^="setRolIA"]').forEach(b => b.style.fontWeight = 'normal');
  btn.style.fontWeight = '700';
  const labels = { actora: 'Parte Actora', demandada: 'Parte Demandada', tercero: 'Tercero' };
  const lbl = document.getElementById('rol-ia-label');
  const txt = document.getElementById('rol-ia-txt');
  if (lbl) lbl.style.display = '';
  if (txt) txt.textContent = labels[rol] || rol;
}

// ────────────────────────────────────────────────────────
// CONTEXTO DEL EXPEDIENTE
// ────────────────────────────────────────────────────────
export async function obtenerContextoExpediente() {
  const e   = window._currentExpData || {};
  const uid = window._fbUser?.uid; if (!uid) return null;
  const expId = window.currentExpId;
  let movimientos = [], documentos = [], actos = [];
  try {
    const [movSnap, docSnap, actosSnap] = await Promise.all([
      getDocs(query(collection(db, `lexia/${uid}/expedientes/${expId}/movimientos`), orderBy('fecha', 'asc'))),
      getDocs(query(collection(db, `lexia/${uid}/documentos`))),
      getDocs(query(collection(db, `lexia/${uid}/expedientes/${expId}/actos`), orderBy('fecha', 'asc'))),
    ]);
    movimientos = movSnap.docs.map(d => d.data());
    documentos  = docSnap.docs.map(d => d.data()).filter(d => d.expedienteId === expId);
    actos       = actosSnap.docs.map(d => d.data());
  } catch {}

  const roles = { actor:'Actor', coactor:'Coactor', demandado:'Demandado', codemandado:'Codemandado solidario', tercero:'Tercero' };
  const partesTexto = (e.partes?.length)
    ? e.partes.map(p => `${roles[p.rol]||p.rol}: ${p.nombre}${p.cuit?' ('+p.cuit+')':''}${p.letrados?.length?' — Letrado/s: '+p.letrados.map(l=>l.nombre+(l.matricula?' '+l.matricula:'')).join(', '):''}` ).join('\n')
    : `Cliente/Actor: ${e.cliente||'—'}\nDemandado: ${e.contraparte||'—'}`;

  return `EXPEDIENTE: ${e.caratula||'—'}
N°: ${e.numero||'—'} | Fuero: ${e.fuero||'—'} | Juzgado: ${e.juzgado||'—'}
Estado: ${e.estado||'—'} | Inicio: ${e.fechaInicio||'—'}
${e.descripcion?'Descripción: '+e.descripcion:''}

PARTES DEL PROCESO:
${partesTexto}

HISTORIAL DE MOVIMIENTOS (${movimientos.length}):
${movimientos.map(m=>`- [${m.fecha||'sin fecha'}] ${m.titulo||m.descripcion||''} ${m.descripcion&&m.descripcion!==m.titulo?'— '+m.descripcion:''}`).join('\n')||'Sin movimientos registrados.'}

ACTOS PROCESALES (${actos.length}):
${actos.map(a=>`- [${a.fecha||'sin fecha'}] ${a.parte?.toUpperCase()||''}: ${a.titulo||''} — ${a.descripcion||''}`).join('\n')||'Sin actos registrados.'}

DOCUMENTOS (${documentos.length}):
${documentos.map(d=>`- [${d.fecha||'sin fecha'}] ${d.categoria||''}: ${d.nombre||d.archivoNombre||''} ${d.notas?'('+d.notas+')':''}`).join('\n')||'Sin documentos registrados.'}`;
}

// ── Helpers de render IA ──────────────────────────────────
function _renderIA(resultado, txt) {
  resultado.innerHTML = escapeHtml(txt)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^##\s(.+)/gm, '<h4 style="margin:14px 0 6px;color:var(--ink);font-size:14px">$1</h4>')
    .replace(/^###\s(.+)/gm, '<h5 style="margin:10px 0 4px;color:var(--slate);font-size:13px">$1</h5>')
    .replace(/^-\s/gm, '• ');
  window._iaResultadoTexto = txt;
}

function _getResultadoEl() {
  const el = document.getElementById('ia-resultado-historial');
  if (el) el.style.display = 'block';
  return el || document.getElementById('ia-resultado');
}

// ────────────────────────────────────────────────────────
// CRONOLOGÍA / ANÁLISIS ESTRATÉGICO / BORRADOR
// ────────────────────────────────────────────────────────
export async function cronologiaCompleta() {
  const resultado = _getResultadoEl();
  resultado.innerHTML = '<div style="color:var(--muted);font-size:13px">⏳ Construyendo cronología completa...</div>';
  document.getElementById('ia-copy-btn').style.display = '';
  const contexto = await obtenerContextoExpediente();
  if (!contexto) { resultado.innerHTML = '<span style="color:#c0392b">Error al cargar datos del expediente.</span>'; return; }
  const prompt = `Sos un asistente jurídico especializado en derecho procesal argentino. Con los siguientes datos del expediente, construí una reconstrucción cronológica completa.\n\n${contexto}\n\nOrganizá la información en etapas procesales. Para cada hito: Fecha, Actuación, Quién, Consecuencia procesal. Al final incluí una línea de tiempo simplificada con los 5-10 hitos más importantes.`;
  try {
    const txt = await callGemini('Sos un asistente jurídico experto en derecho procesal argentino. Respondés en español formal jurídico.', [{ role: 'user', content: prompt }], 3000);
    _renderIA(resultado, txt);
    document.getElementById('ia-guardar-actos-btn').style.display = '';
  } catch (e) { resultado.innerHTML = `<span style="color:#c0392b">Error: ${escapeHtml(e.message)}</span>`; }
}

export async function analisisEstrategico() {
  const resultado = _getResultadoEl();
  resultado.innerHTML = '<div style="color:var(--muted);font-size:13px">⏳ Analizando posición estratégica...</div>';
  document.getElementById('ia-copy-btn').style.display = '';
  const contexto = await obtenerContextoExpediente();
  if (!contexto) { resultado.innerHTML = '<span style="color:#c0392b">Error al cargar datos.</span>'; return; }
  const prompt = `Con los siguientes datos del expediente, realizá un análisis estratégico completo para el abogado de ${window._currentExpData?.cliente||'mi parte'}.\n\n${contexto}\n\nAnalizá: 1. Posición jurídica actual 2. Etapa procesal y próximos pasos 3. Riesgos procesales 4. Estrategia recomendada 5. Argumentos jurídicos disponibles 6. Preguntas clave a resolver`;
  try {
    const txt = await callGemini('Sos un abogado experto en derecho procesal argentino con 20 años de experiencia.', [{ role: 'user', content: prompt }], 3000);
    _renderIA(resultado, txt);
  } catch (e) { resultado.innerHTML = `<span style="color:#c0392b">Error: ${escapeHtml(e.message)}</span>`; }
}

export async function borradorEscrito() {
  const resultado = _getResultadoEl();
  const tipos = ['Contestación de demanda','Recurso de apelación','Alegato','Expresión de agravios','Solicitud de prórroga','Escrito de mediación','Memorial'];
  const tipo  = window.prompt('¿Qué escrito necesitás?\n\n' + tipos.map((t,i)=>`${i+1}. ${t}`).join('\n') + '\n\nIngresá el número o el nombre:');
  if (!tipo) return;
  const tipoSel = tipos[parseInt(tipo)-1] || tipo;
  resultado.innerHTML = `<div style="color:var(--muted);font-size:13px">⏳ Redactando ${escapeHtml(tipoSel)}...</div>`;
  document.getElementById('ia-copy-btn').style.display = '';
  const contexto = await obtenerContextoExpediente();
  if (!contexto) { resultado.innerHTML = '<span style="color:#c0392b">Error al cargar datos.</span>'; return; }
  const prompt = `Redactá un borrador de ${tipoSel} en formato jurídico argentino formal, basándote en los siguientes datos del expediente.\n\n${contexto}\n\nEl escrito debe tener: encabezado con carátula y juzgado, estructura formal (Objeto, Hechos, Derecho, Prueba, Petición), citas normativas según el fuero, placeholders en [CORCHETES] donde falte info, lenguaje jurídico argentino.`;
  try {
    const txt = await callGemini('Sos un abogado redactor experto en escritos judiciales argentinos.', [{ role: 'user', content: prompt }], 4000);
    _renderIA(resultado, txt);
  } catch (e) { resultado.innerHTML = `<span style="color:#c0392b">Error: ${escapeHtml(e.message)}</span>`; }
}

// ────────────────────────────────────────────────────────
// ANÁLISIS CENTRAL (iaAnalisis con todos los prompts)
// ────────────────────────────────────────────────────────
export async function iaAnalisis(tipo) {
  const res = document.getElementById('ia-resultado-historial');
  if (!res) return;
  res.innerHTML = '<div style="color:var(--muted);font-size:13px">⏳ Analizando...</div>';
  document.getElementById('ia-copy-btn').style.display = '';

  const contexto = await obtenerContextoExpediente();
  if (!contexto) { res.innerHTML = '<span style="color:#c0392b">Error al cargar datos del expediente.</span>'; return; }

  const e     = window._currentExpData || {};
  const rol   = _rolIA === 'actora' ? 'PARTE ACTORA' : _rolIA === 'demandada' ? 'PARTE DEMANDADA' : 'TERCERO';
  const fuero = e.fuero || 'Civil';

  const prompts = {
    demanda:             `Sos un asistente jurídico especializado en redacción de escritos judiciales en Argentina.\nRedactá un proyecto de demanda con estructura completa: Encabezado, Hechos, Derecho, Prueba, Petitorio.\nUsá lenguaje jurídico formal argentino. Indicá con [COMPLETAR: descripción] donde falte información.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    contesta_demanda:    `Sos un asistente jurídico especializado en redacción de escritos judiciales en Argentina.\nRedactá un proyecto de contestación de demanda: Negativa, Versión de hechos, Excepciones, Derecho, Prueba, Petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    ofrecimiento_prueba: `Sos un asistente jurídico especializado en derecho procesal argentino.\nRedactá un escrito de ofrecimiento de prueba completo: Documental, Informativa, Testimonial (con pliego), Pericial (con puntos), Confesional si aplica.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    impugnacion:         `Sos un asistente jurídico especializado en derecho procesal argentino.\nRedactá un escrito de impugnación: Objeto, Fundamentos de hecho, Fundamentos de derecho, Petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    alegato_escrito:     `Sos un asistente jurídico especializado en derecho argentino.\nRedactá un proyecto de alegato: Introducción, Análisis de prueba, Hechos acreditados, Argumentación jurídica, Refutación, Conclusión y petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    expresion_agravios:  `Redactá un escrito de expresión de agravios con crítica concreta y razonada (bajo pena de deserción). Un agravio por punto cuestionado, autosuficiente.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    recurso_nulidad:     `Redactá un incidente/recurso de nulidad: acto impugnado, vicio, perjuicio, no convalidación, derecho, petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    revocatoria:         `Redactá un recurso de revocatoria/reposición: resolución recurrida, procedencia, fundamentación, petición, apelación en subsidio si corresponde.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    ref:                 `Redactá un proyecto de Recurso Extraordinario Federal (art. 14, Ley 48): objeto, admisibilidad, cuestión federal, agravios, doctrina CSJN, petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    escrito_tramite:     `Redactá un escrito de trámite conciso con las fórmulas procesales correspondientes.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    incidente:           `Redactá un escrito de promoción de incidente: encabezado, objeto, hechos, derecho, prueba, petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    beneficio_litigar:   `Redactá un escrito de solicitud de Beneficio de Litigar Sin Gastos (arts. 78-86 CPCCN): objeto, situación patrimonial, imposibilidad, prueba, derecho, petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    juris_general:       `ESTÁ TERMINANTEMENTE PROHIBIDO inventar fallos. Necesito un panorama jurisprudencial sobre la materia de este expediente: tendencia mayoritaria, minoritaria, evolución reciente, leading cases. Para cada fallo: tribunal, fecha, resumen, cita textual, URL oficial.\n\n${contexto}\nFuero: ${fuero}`,
    juris_momento:       `ESTÁ TERMINANTEMENTE PROHIBIDO inventar fallos. Necesito jurisprudencia vinculada a la etapa actual. Para cada fallo: tribunal, fecha, jerarquía, relevancia (favorable/adverso/mixto), resumen, cita, URL.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    juris_resultado:     `ESTÁ TERMINANTEMENTE PROHIBIDO inventar fallos. Necesito jurisprudencia con resultado favorable a una postura como la mía. Para cada fallo: tribunal, fecha, resumen, argumentos determinantes, similitudes. Incluir sección "⚠️ Fallos adversos".\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    juris_argumento:     `ESTÁ TERMINANTEMENTE PROHIBIDO inventar fallos. Necesito fallos que respalden mis argumentos. Para cada fallo además: extracto citable y cómo vincularlo.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    resumen_partes:      `Con los datos del expediente, dame un resumen de la información general y las partes intervinientes.\n\n${contexto}\nMi rol: ${rol}`,
    resumen_integral:    `Con los datos del expediente, elaborá un resumen integral: objeto del litigio, hechos, postura de cada parte, etapa procesal, cuestiones clave, resoluciones importantes.\n\n${contexto}\nMi rol: ${rol}`,
    argumentos_prueba:   `Analizá los argumentos y la prueba de la causa: argumentos centrales de cada parte, qué prueba se produjo, vacíos probatorios. Diagnóstico honesto.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    abogado_contrario:   `Actuá como abogado de la parte contraria y analizá los puntos débiles de mi caso. Para cada punto débil: describilo, riesgo, cómo mitigarlo.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    mapa_vulnerabilidades:`Elaborá un mapa de vulnerabilidades: fácticas, probatorias, jurídicas, procesales. Para cada una: gravedad, probabilidad de explotación, recomendación.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    contradicciones:     `Rastreá contradicciones en la posición de la contraparte y en la mía. Para cada una: dónde, en qué consiste, relevancia procesal, cómo aprovecharlo o mitigarlo.\n\n${contexto}\nMi rol: ${rol}`,
    auditoria_errores:   `Hacé una auditoría de errores: de mi parte, de la contraparte, del juzgado. Para cada error: dónde está, consecuencia, acción recomendada.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    plan_accion:         `Elaborá un plan de acción concreto: 1. Qué hacer AHORA 2. Qué priorizar a corto plazo 3. Qué falta producir 4. Qué tener en cuenta más adelante. Formato accionable.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
    medida_cautelar:     `Redactá un escrito de solicitud de medida cautelar demostrando: Verosimilitud del derecho, Peligro en la demora, Contracautela. Estructura: Objeto → Hechos → Requisitos → Derecho → Petitorio.\n\n${contexto}\nMi rol: ${rol} | Fuero: ${fuero}`,
  };

  const prompt = prompts[tipo];
  if (!prompt) { res.innerHTML = '<span style="color:#c0392b">Análisis no reconocido.</span>'; return; }

  try {
    const txt = await callGemini('Sos un abogado experto en derecho procesal argentino. Respondés en español formal jurídico. Usás markdown para estructurar la respuesta.', [{ role: 'user', content: prompt }], 4000);
    if (!txt) { res.innerHTML = '<span style="color:#c0392b">⚠️ Sin respuesta. Verificá la API key de Gemini.</span>'; return; }
    _renderIA(res, txt);
    document.getElementById('ia-copy-btn').style.display = '';
    res.scrollTop = 0;
  } catch (err) { res.innerHTML = `<span style="color:#c0392b">Error: ${escapeHtml(err.message)}</span>`; }
}

// ────────────────────────────────────────────────────────
// LYZR AGENT
// ────────────────────────────────────────────────────────
export async function callLyzrAgent(userMessage, sessionId) {
  const apiKey = await getLyzrApiKey();
  if (!apiKey) throw new Error('Configurá tu API key de Lyzr en Configuración.');
  const sid = sessionId || ('eandres-' + (window._fbUser?.uid || 'anon') + '-' + Date.now());
  try {
    const resp = await fetch(LYZR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ agent_id: LYZR_AGENT_ID, session_id: sid, message: userMessage })
    });
    if (!resp.ok) { const err = await resp.json().catch(()=>{}); throw new Error(err?.detail || 'Error ' + resp.status); }
    const data = await resp.json();
    return { text: data.response || data.message || 'Sin respuesta.', session_id: sid };
  } catch (e) { throw new Error('Lyzr: ' + e.message); }
}

export async function sendLyzrMessage() {
  const input = document.getElementById('lyzr-input');
  const msg   = input?.value?.trim();
  if (!msg) return;
  input.value = '';
  const chat = document.getElementById('lyzr-chat-container');
  if (!chat) return;

  const userDiv = document.createElement('div');
  userDiv.style.cssText = 'background:#fff;border:1px solid var(--border-light);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12.5px';
  userDiv.innerHTML = `<div style="font-size:10px;color:var(--muted);margin-bottom:3px;font-weight:600;text-transform:uppercase">Vos</div>${escapeHtml(msg)}`;
  chat.appendChild(userDiv);

  const respDiv = document.createElement('div');
  respDiv.style.cssText = 'background:linear-gradient(135deg,rgba(15,34,68,.06),rgba(0,180,216,.06));border:1px solid rgba(0,180,216,.2);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12.5px';
  respDiv.innerHTML = `<div style="font-size:10px;color:#0096B4;margin-bottom:3px;font-weight:600;text-transform:uppercase">⚡ EANDRES-Laboral</div><em style="color:var(--muted)">Analizando...</em>`;
  chat.appendChild(respDiv);
  chat.scrollTop = chat.scrollHeight;

  const e       = window._currentExpData || {};
  const contexto = e.caratula ? `Expediente: ${e.caratula} | Fuero: ${e.fuero||'—'} | Cliente: ${e.cliente||'—'} | Contraparte: ${e.contraparte||'—'} | Estado: ${e.estado||'—'}\n\n` : '';

  try {
    if (!window._lyzrSessions) window._lyzrSessions = {};
    const sid    = window._lyzrSessions[window.currentExpId];
    const result = await callLyzrAgent(contexto + msg, sid);
    window._lyzrSessions[window.currentExpId] = result.session_id;
    respDiv.innerHTML = `<div style="font-size:10px;color:#0096B4;margin-bottom:3px;font-weight:600;text-transform:uppercase">⚡ EANDRES-Laboral</div>`
      + escapeHtml(result.text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (window.currentExpId) {
      window.addCoworkEntry?.(window.currentExpId, {
        tipo: 'análisis', skill: 'lyzr-eandres-laboral', estado: 'final', tiempo: 0.1,
        notas: `Lyzr: "${msg.substring(0,100)}${msg.length>100?'...':''}"`, por: 'claude'
      });
    }
  } catch (err) {
    respDiv.innerHTML = `<div style="font-size:10px;color:#0096B4;margin-bottom:3px;font-weight:600">⚡ EANDRES-Laboral</div><span style="color:var(--danger)">Error: ${escapeHtml(err.message)}</span>`;
  }
  chat.scrollTop = chat.scrollHeight;
}

export function initLyzrChat() {
  const container = document.getElementById('lyzr-chat-container');
  if (!container) return;
  container.innerHTML = '';
  if (!window._lyzrSessions) window._lyzrSessions = {};
  window._lyzrSessions[window.currentExpId] = window._lyzrSessions[window.currentExpId] || null;
}

// ────────────────────────────────────────────────────────
// BRIDGE GLOBAL
// ────────────────────────────────────────────────────────
window.callGemini            = callGemini;
window.setAIPrompt           = setAIPrompt;
window.sendAI                = sendAI;
window.sendAIExp             = sendAIExp;
window.sendAIConRespDiv      = sendAIConRespDiv;
window.initIATab             = initIATab;
window.procesarDocIA         = procesarDocIA;
window.subirArchivoCloudinary = subirArchivoCloudinary;
window.analizarDocumentoIA   = analizarDocumentoIA;
window.copiarResultadoIA     = copiarResultadoIA;
window.guardarActosDeIA      = guardarActosDeIA;
window.setRolIA              = setRolIA;
window.iaAnalisis            = iaAnalisis;
window.obtenerContextoExpediente = obtenerContextoExpediente;
window.cronologiaCompleta    = cronologiaCompleta;
window.analisisEstrategico   = analisisEstrategico;
window.borradorEscrito       = borradorEscrito;
window.callLyzrAgent         = callLyzrAgent;
window.sendLyzrMessage       = sendLyzrMessage;
window.initLyzrChat          = initLyzrChat;

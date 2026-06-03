// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Configuración
// ════════════════════════════════════════════════════════

import { escapeHtml } from '../utils/helpers.js';
import { db, doc, getDoc, setDoc } from '../services/firebase.js';

const GEMINI_MODEL = 'gemini-3-flash-preview';

// ── Iniciales del nombre para el avatar ──────────────────
export function calcularIniciales(nombre) {
  if (!nombre) return 'EA';
  const sinTitulo = nombre.trim().replace(/^(Dr|Dra|Lic|Mg|Ing|Prof)\.?\s+/i, '');
  const palabras  = sinTitulo.split(/\s+/).filter(w => w.length > 1);
  if (palabras.length === 0) return 'EA';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

// ── Cargar datos de configuración del estudio ────────────
export async function cargarConfigEstudio() {
  if (!window._fbUser) return;
  try {
    const uid  = window._fbUser.uid;
    const snap = await getDoc(doc(db, `lexia/${uid}/config/settings`));
    if (snap.exists()) {
      const d   = snap.data();
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('cfg-nombre',    d.nombre);
      set('cfg-cuit',      d.cuit);
      set('cfg-matricula', d.matricula);
      set('cfg-tel',       d.telefono);
      set('cfg-domicilio', d.domicilio);
      set('cfg-email',     d.email);
      if (d.geminiKey) {
        const el = document.getElementById('config-api-key');
        if (el) el.placeholder = 'AIza•••••••••••••• (guardada)';
      }
      if (d.lyzrKey) {
        const el = document.getElementById('config-lyzr-key');
        if (el) el.placeholder = 'sk-•••••••••••••••• (guardada)';
        const st = document.getElementById('lyzr-key-status');
        if (st) st.textContent = '✅ Key de Lyzr activa.';
      }
      if (d.nombre) {
        const el = document.getElementById('sidebar-user-name');
        if (el) el.textContent = d.nombre;
      }
      const roleEl = document.getElementById('sidebar-role-text');
      if (roleEl && d.cargo) roleEl.textContent = d.cargo;
    } else {
      const el     = document.getElementById('sidebar-user-name');
      const nameEl = document.getElementById('cfg-nombre');
      if (el)     el.textContent = window._fbUser.displayName || window._fbUser.email;
      if (nameEl && window._fbUser.displayName) nameEl.value = window._fbUser.displayName;
    }
  } catch (e) { console.error('Error cargando config:', e); }
}

// ── Guardar datos del estudio ─────────────────────────────
export async function guardarConfigEstudio() {
  const status = document.getElementById('cfg-save-status');
  const get    = id => document.getElementById(id)?.value?.trim() || '';
  const data   = {
    nombre:    get('cfg-nombre'),
    cuit:      get('cfg-cuit'),
    matricula: get('cfg-matricula'),
    telefono:  get('cfg-tel'),
    domicilio: get('cfg-domicilio'),
    email:     get('cfg-email'),
  };
  if (!data.nombre) { alert('El nombre es obligatorio'); return; }
  try {
    const uid = window._fbUser.uid;
    await setDoc(doc(db, `lexia/${uid}/config/settings`), data, { merge: true });
    const el = document.getElementById('sidebar-user-name');
    if (el) el.textContent = data.nombre;
    if (status) { status.textContent = '✅ Guardado'; setTimeout(() => status.textContent = '', 3000); }
  } catch (e) {
    if (status) status.textContent = '❌ Error: ' + escapeHtml(e.message);
  }
}

// ── Leer Gemini API key desde Firestore ──────────────────
export async function getApiKey() {
  try {
    const uid  = window._fbUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db, `lexia/${uid}/config/settings`));
    if (!snap.exists()) return null;
    const raw  = (snap.data().geminiKey || snap.data().anthropicKey || '').replace(/[^ -~]/g, '').trim();
    return raw || null;
  } catch (e) { return null; }
}

// ── Guardar Gemini API key ────────────────────────────────
export async function saveApiKey() {
  const raw = document.getElementById('config-api-key')?.value || '';
  const key = raw.replace(/[^ -~]/g, '').trim();
  if (!key) { alert('Ingresá una API key válida'); return; }
  if (!key.startsWith('AIza') && !key.startsWith('AQ.')) { alert('La API key de Gemini debe comenzar con AIza o AQ.'); return; }
  try {
    const uid = window._fbUser.uid;
    await setDoc(doc(db, `lexia/${uid}/config/settings`), { geminiKey: key }, { merge: true });
    alert('✅ API key de Gemini guardada. El Asistente IA ya está activo.');
    document.getElementById('config-api-key').value = 'AIza••••••••••••••••';
  } catch (e) { alert('Error al guardar: ' + e.message); }
}

// ── Probar conexión con Gemini ────────────────────────────
export async function testApiKey() {
  const status = document.getElementById('api-key-status');
  status.innerHTML = '<span style="color:var(--muted)">⏳ Probando conexión con Gemini...</span>';
  const rawK = document.getElementById('config-api-key')?.value || '';
  let key    = rawK.replace(/[^ -~]/g, '').trim();
  if (!key) key = await getApiKey();
  if (!key) { status.innerHTML = '<span style="color:#c0392b">⚠️ Ingresá o guardá una API key primero.</span>'; return; }
  try {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'OK' }] }], generationConfig: { maxOutputTokens: 5 } })
    });
    const data = await resp.json();
    status.innerHTML = data.candidates
      ? '<span style="color:#2d6a4f">✅ Conexión exitosa con Gemini. El Asistente IA está activo.</span>'
      : `<span style="color:#c0392b">❌ Error: ${escapeHtml(data.error?.message || 'Respuesta inesperada')}</span>`;
  } catch (e) {
    status.innerHTML = `<span style="color:#c0392b">❌ Error de red: ${escapeHtml(e.message)}</span>`;
  }
}

// ── Leer Lyzr API key desde Firestore ────────────────────
export async function getLyzrApiKey() {
  try {
    const uid  = window._fbUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db, `lexia/${uid}/config/settings`));
    if (!snap.exists()) return null;
    const raw  = (snap.data().lyzrKey || '').replace(/[^ -~]/g, '').trim();
    return raw || null;
  } catch (e) { return null; }
}

// ── Guardar Lyzr API key ──────────────────────────────────
export async function saveLyzrKey() {
  const status = document.getElementById('lyzr-key-status');
  const key    = (document.getElementById('config-lyzr-key')?.value || '').replace(/[^ -~]/g, '').trim();
  if (!key) { if (status) status.textContent = '⚠️ Ingresá una API key válida'; return; }
  if (!key.startsWith('sk-')) { if (status) status.textContent = '⚠️ La key de Lyzr debe comenzar con sk-'; return; }
  try {
    const uid = window._fbUser.uid;
    await setDoc(doc(db, `lexia/${uid}/config/settings`), { lyzrKey: key }, { merge: true });
    if (status) status.textContent = '✅ API key de Lyzr guardada correctamente.';
    document.getElementById('config-lyzr-key').value = 'sk-••••••••••••••••';
  } catch (e) {
    if (status) status.textContent = 'Error al guardar: ' + escapeHtml(e.message);
  }
}

// ── Cerrar sesión ─────────────────────────────────────────
export function doLogout() {
  if (!confirm('¿Cerrar sesión?')) return;
  window._fb.signOut(window._fb.auth);
}

// ── Bridge global ─────────────────────────────────────────
window.calcularIniciales   = calcularIniciales;
window.cargarConfigEstudio = cargarConfigEstudio;
window.guardarConfigEstudio = guardarConfigEstudio;
window.getApiKey           = getApiKey;
window.saveApiKey          = saveApiKey;
window.testApiKey          = testApiKey;
window.getLyzrApiKey       = getLyzrApiKey;
window.saveLyzrKey         = saveLyzrKey;
window.doLogout            = doLogout;

// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Perfil del estudio
// ════════════════════════════════════════════════════════

import { calcularIniciales } from './Configuracion.js';
import { db, doc, setDoc, getDoc } from '../services/firebase.js';

let _logoDataUrl = null;

const fbCfgDoc = name => doc(db, 'lexia', window._fbUser?.uid, 'config', name);

// ── Cargar perfil desde Firestore ─────────────────────────
export async function fbCargarPerfil() {
  try {
    const snap = await getDoc(fbCfgDoc('perfil'));
    if (!snap.exists()) return;
    const p = snap.data();
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('perfil-nombre',         p.nombre);
    set('perfil-titulo',         p.titulo);
    set('perfil-rol',            p.rol);
    set('perfil-matricula',      p.matricula);
    set('perfil-cuit',           p.cuit);
    set('perfil-domicilio',      p.domicilio);
    set('perfil-email',          p.email);
    set('perfil-tel',            p.tel);
    const enNombre = p.estudioNombre === 'LexIA'             ? 'EANDRES'                  : p.estudioNombre || 'EANDRES';
    const enSub    = p.estudioSub    === 'Gestión de Expedientes' ? 'Sistema Inteligente Legal' : p.estudioSub    || 'Sistema Inteligente Legal';
    set('perfil-estudio-nombre', enNombre);
    set('perfil-estudio-sub',    enSub);
    if (p.logoDataUrl) _logoDataUrl = p.logoDataUrl;
    actualizarPreviewPerfil();
    // Aplicar al sidebar
    const fullName = [p.titulo, p.nombre].filter(Boolean).join(' ');
    const initials = calcularIniciales(p.nombre);
    if (fullName)  document.getElementById('sidebar-user-name').textContent  = fullName;
    if (p.rol)     document.getElementById('sidebar-role-text').textContent  = p.rol;
    if (initials)  document.getElementById('sidebar-avatar-initials').textContent = initials;
    if (p.logoDataUrl) {
      document.getElementById('logo-display-img').style.display  = 'block';
      document.getElementById('logo-img-el').src                 = p.logoDataUrl;
      document.getElementById('logo-display-text').style.display = 'none';
    } else if (p.estudioNombre) {
      document.getElementById('sidebar-estudio-nombre').textContent = enNombre;
      document.getElementById('sidebar-estudio-sub').textContent    = enSub;
    }
  } catch (e) { console.warn('Error cargando perfil:', e); }
}

// ── Guardar perfil en Firestore ───────────────────────────
export async function fbGuardarPerfil(perfilData) {
  window.setSyncing?.();
  try {
    await setDoc(fbCfgDoc('perfil'), perfilData);
    window.setSyncOk?.();
    return true;
  } catch (e) { window.setSyncErr?.(); alert('Error al guardar perfil: ' + e.message); return false; }
}

// ── Live preview del modal de perfil ─────────────────────
export function syncPreview() {
  const g    = id => document.getElementById(id)?.value || '';
  const full = [g('perfil-titulo'), g('perfil-nombre')].filter(Boolean).join(' ');
  const ini  = calcularIniciales(g('perfil-nombre'));
  const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('preview-nombre-ab',      full || 'Dr. Eduardo N. Andrés');
  set('preview-rol-ab',         g('perfil-rol') || 'Abogado');
  set('preview-avatar',         ini);
  set('preview-nombre-estudio', g('perfil-estudio-nombre') || 'EANDRES');
  set('preview-sub-estudio',    g('perfil-estudio-sub') || 'Gestión de Expedientes');
}

// Wire preview on input
setTimeout(() => {
  ['perfil-titulo','perfil-nombre','perfil-rol','perfil-estudio-nombre','perfil-estudio-sub'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', syncPreview);
  });
  syncPreview();
}, 100);

export function actualizarPreviewPerfil() {
  const titulo  = document.getElementById('perfil-titulo')?.value || '';
  const nombre  = document.getElementById('perfil-nombre')?.value || window._fbUser?.displayName || '';
  const preview = document.getElementById('preview-nombre-ab');
  if (preview) preview.textContent = ([titulo, nombre].filter(Boolean).join(' ')) || 'Abogado';
}

// ── Logo ──────────────────────────────────────────────────
export function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _logoDataUrl = e.target.result;
    document.getElementById('logo-preview-placeholder').style.display  = 'none';
    document.getElementById('logo-preview-img').style.display          = 'block';
    document.getElementById('logo-preview-img').src                    = _logoDataUrl;
    document.getElementById('preview-logo-img-wrap').style.display     = 'block';
    document.getElementById('preview-logo-img').src                    = _logoDataUrl;
    document.getElementById('preview-logo-text-wrap').style.display    = 'none';
  };
  reader.readAsDataURL(file);
}

export function removeLogo() {
  _logoDataUrl = null;
  document.getElementById('logo-preview-placeholder').style.display = 'block';
  document.getElementById('logo-preview-img').style.display         = 'none';
  document.getElementById('logo-preview-img').src                   = '';
  document.getElementById('preview-logo-img-wrap').style.display    = 'none';
  document.getElementById('preview-logo-text-wrap').style.display   = 'block';
  document.getElementById('logo-display-img').style.display         = 'none';
  document.getElementById('logo-display-text').style.display        = 'block';
}

// ── Guardar perfil completo ───────────────────────────────
export async function guardarPerfil() {
  const g    = id => document.getElementById(id)?.value || '';
  const titulo        = g('perfil-titulo');
  const nombre        = g('perfil-nombre');
  const rol           = g('perfil-rol');
  const estudioNombre = g('perfil-estudio-nombre');
  const estudioSub    = g('perfil-estudio-sub');
  const fullName      = [titulo, nombre].filter(Boolean).join(' ');
  const initials      = calcularIniciales(nombre);

  document.getElementById('sidebar-user-name').textContent         = fullName || 'Abogado';
  document.getElementById('sidebar-role-text').textContent         = rol      || 'Estudio Jurídico';
  document.getElementById('sidebar-avatar-initials').textContent   = initials;

  if (_logoDataUrl) {
    document.getElementById('logo-display-img').style.display  = 'block';
    document.getElementById('logo-img-el').src                 = _logoDataUrl;
    document.getElementById('logo-display-text').style.display = 'none';
  } else {
    document.getElementById('logo-display-img').style.display  = 'none';
    document.getElementById('logo-display-text').style.display = 'block';
    document.getElementById('sidebar-estudio-nombre').textContent = estudioNombre || 'EANDRES';
    document.getElementById('sidebar-estudio-sub').textContent    = estudioSub    || 'Sistema Inteligente Legal';
  }

  const perfilData = {
    titulo, nombre, rol, estudioNombre, estudioSub, logoDataUrl: _logoDataUrl,
    matricula: g('perfil-matricula'), cuit: g('perfil-cuit'),
    domicilio: g('perfil-domicilio'), email: g('perfil-email'), tel: g('perfil-tel'),
  };

  if (window._fbUser) {
    await fbGuardarPerfil(perfilData);
  } else {
    try { localStorage.setItem('lexia_perfil', JSON.stringify(perfilData)); } catch {}
  }

  window.closeModal?.('modal-perfil');
  const btn = document.querySelector('#modal-perfil .btn-primary');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ Guardado en la nube ☁'; setTimeout(() => btn.textContent = orig, 2000); }
}

// Cargar perfil de localStorage (modo offline)
(function loadSavedPerfil() {
  try {
    const saved = localStorage.getItem('lexia_perfil');
    if (!saved) return;
    const p = JSON.parse(saved);
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('perfil-nombre', p.nombre); set('perfil-titulo', p.titulo); set('perfil-rol', p.rol);
    set('perfil-estudio-nombre', p.estudioNombre); set('perfil-estudio-sub', p.estudioSub);
    if (p.logoDataUrl) _logoDataUrl = p.logoDataUrl;
    const fullName = [p.titulo, p.nombre].filter(Boolean).join(' ');
    const initials = calcularIniciales(p.nombre);
    if (fullName)  document.getElementById('sidebar-user-name').textContent  = fullName;
    if (p.rol)     document.getElementById('sidebar-role-text').textContent  = p.rol;
    if (initials)  document.getElementById('sidebar-avatar-initials').textContent = initials;
    if (p.logoDataUrl) {
      document.getElementById('logo-display-img').style.display  = 'block';
      document.getElementById('logo-img-el').src                 = p.logoDataUrl;
      document.getElementById('logo-display-text').style.display = 'none';
    } else if (p.estudioNombre) {
      document.getElementById('sidebar-estudio-nombre').textContent = p.estudioNombre || 'EANDRES';
      document.getElementById('sidebar-estudio-sub').textContent    = p.estudioSub    || 'Sistema Inteligente Legal';
    }
  } catch {}
})();

// ── Bridge global ─────────────────────────────────────────
window.fbCargarPerfil        = fbCargarPerfil;
window.fbGuardarPerfil       = fbGuardarPerfil;
window.syncPreview           = syncPreview;
window.actualizarPreviewPerfil = actualizarPreviewPerfil;
window.handleLogoUpload      = handleLogoUpload;
window.removeLogo            = removeLogo;
window.guardarPerfil         = guardarPerfil;

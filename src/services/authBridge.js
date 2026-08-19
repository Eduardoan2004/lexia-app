// ════════════════════════════════════════════════════════
//  EANDRES SIL — Puente de sesión hacia módulos en iframe
//  (Dashboard AI, Biblioteca Legal, Interacciones)
// ════════════════════════════════════════════════════════
import { auth } from './firebase.js';

const MODULOS_ORIGIN = 'https://lexia-app-gamma.vercel.app';

async function enviarTokenA(targetWindow, targetOrigin) {
  const user = auth.currentUser;
  if (!user || !targetWindow) return;
  try {
    const idToken = await user.getIdToken();
    targetWindow.postMessage({ type: 'LEXIA_AUTH', idToken }, targetOrigin);
  } catch (err) {
    console.warn('authBridge: no se pudo enviar token', err.message);
  }
}

// El módulo avisa que ya cargó y está esperando el token
window.addEventListener('message', e => {
  if (e.origin !== MODULOS_ORIGIN) return;
  if (e.data?.type === 'LEXIA_READY') {
    enviarTokenA(e.source, e.origin);
  }
});

// Reenviar a todos los iframes de módulos presentes cuando cambia la sesión
export function broadcastAuthToModules() {
  document.querySelectorAll(`iframe[src^="${MODULOS_ORIGIN}"]`).forEach(f => {
    enviarTokenA(f.contentWindow, MODULOS_ORIGIN);
  });
}

window.broadcastAuthToModules = broadcastAuthToModules;

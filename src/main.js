// ════════════════════════════════════════════════════════
//  EANDRES SIL — Entry point (Vite)
//  Reemplaza el <script type="module"> inline del index.html
// ════════════════════════════════════════════════════════

import {
  auth, db, provider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged,
  doc, setDoc, getDoc, collection, addDoc, getDocs,
  deleteDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp
} from './services/firebase.js';

// ── App shell ────────────────────────────────────────────
import './app/Router.js';         // navigate, openModal/closeModal, setSyncing, loginGoogle
import './services/authBridge.js'; // puente de sesión hacia módulos en iframe

// ── Utilidades compartidas ───────────────────────────────
import './utils/helpers.js';      // escapeHtml, badgeEstado, calcVencimiento, fmtPeso, fmtDate, showToast

// ── Módulos ya migrados ──────────────────────────────────
import './services/modules.js';   // gestión de módulos IA
import './views/Dashboard.js';        // KPIs y tabla de expedientes recientes
import './views/Notificaciones.js';   // alertas de vencimiento y panel de notificaciones
import './views/Clientes.js';         // grid, edición y eliminación de clientes
import './views/BusquedaJudicial.js'; // búsqueda en SCW, IOL CABA y MEV PBA
import './views/ConsultaJudicial.js'; // parser de tribunales: PJN, CABA, SCBA
import './views/Configuracion.js';    // config estudio, API keys, logout
import './views/Expedientes.js';      // núcleo: tabla, detalle, actos, docs, CRUD, import
import './views/AsistenteIA.js';      // Gemini, Lyzr, análisis de documentos, escritos
import './views/Agenda.js';           // calendario, eventos, marcar cumplido
import './views/Honorarios.js';       // tabla de honorarios
import './views/Perfil.js';           // perfil del estudio, logo, guardar
import './views/Partes.js';           // formulario dinámico de partes y letrados
import './views/Formularios.js';      // guardar evento, honorario, cliente, documento
import './views/Reportes.js';         // reportes dinámicos y backup
import './app/Bootstrap.js';         // _fbReady, hooks de integración, funciones residuales
import './views/calculadoras.js'; // calculadoras jurídicas (ya tiene window bindings)
import './views/cowork.js';       // cowork log (ya tiene window bindings)

// ── Bridge global: expone Firebase para el código legacy del monolito
window._fb = {
  auth, db, provider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged,
  doc, setDoc, getDoc, collection, addDoc, getDocs,
  deleteDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp
};

// ── Manejar resultado de redirección (navegadores que bloquean popups)
getRedirectResult(auth)
  .then(result => {
    if (result && result.user) window._fbUser = result.user;
  })
  .catch(err => {
    if (err && err.code !== 'auth/null-user')
      console.warn('Redirect result error:', err.message);
  });

// ── Auth state listener ──────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    window._fbUser = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-root').style.display    = 'block';
    window._fbReady && window._fbReady(user);
  } else {
    window._fbUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-root').style.display    = 'none';
  }
});

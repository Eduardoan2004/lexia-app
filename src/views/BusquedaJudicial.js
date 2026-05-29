// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Búsqueda Judicial
// ════════════════════════════════════════════════════════

import { escapeHtml } from '../utils/helpers.js';

const SPINNER = '<div style="width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>';

function val(id) { return document.getElementById(id)?.value || ''; }
function showRes(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = html;
}

// ── Tabs del panel judicial ───────────────────────────────
export function switchJudTab(tabEl, panelId) {
  document.querySelectorAll('.jud-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  document.querySelectorAll('.jud-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(panelId)?.classList.add('active');
}

// ── SCW — Poder Judicial de la Nación ────────────────────
export function buscarCsjn() {
  const jur = val('csjn-jurisdiccion');
  const num = val('csjn-numero');
  const anio = val('csjn-anio');
  showRes('csjn-results', `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">${SPINNER}<span style="font-size:13.5px;color:var(--muted)">Redirigiendo al sistema oficial del PJN…</span></div>`);
  setTimeout(() => {
    showRes('csjn-results', `<div style="background:rgba(26,74,107,.05);border:1px solid rgba(26,74,107,.15);border-radius:8px;padding:16px 18px">
      <div style="font-size:13px;color:var(--slate);margin-bottom:12px">El sistema SCW del Poder Judicial de la Nación requiere acceso directo. Los datos buscados:</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">
        <span style="font-size:12.5px;color:var(--muted)">Jurisdicción: <strong style="color:var(--ink)">${escapeHtml(jur)}</strong></span>
        ${num  ? `<span style="font-size:12.5px;color:var(--muted)">Número: <strong style="color:var(--ink);font-family:'DM Mono',monospace">${escapeHtml(num)}</strong></span>`  : ''}
        ${anio ? `<span style="font-size:12.5px;color:var(--muted)">Año: <strong style="color:var(--ink);font-family:'DM Mono',monospace">${escapeHtml(anio)}</strong></span>` : ''}
      </div>
      <a href="https://scw.pjn.gov.ar/scw/home.seam" target="_blank" class="ext-link-btn burgundy">🔗 Abrir SCW con estos datos →</a>
    </div>`);
  }, 900);
}

export function buscarCsjnParte() {
  const ap  = val('csjn-parte-apellido');
  const nom = val('csjn-parte-nombre');
  if (!ap) { alert('Ingresá al menos el apellido'); return; }
  showRes('csjn-results', `<div style="display:flex;align-items:center;gap:10px">${SPINNER}<span style="font-size:13.5px;color:var(--muted)">Preparando consulta por parte…</span></div>`);
  setTimeout(() => {
    showRes('csjn-results', `<div style="background:rgba(107,31,42,.05);border:1px solid rgba(107,31,42,.12);border-radius:8px;padding:16px 18px">
      <div style="font-size:13px;color:var(--slate);margin-bottom:12px">Búsqueda por parte: <strong>${escapeHtml(ap)}${nom ? ', ' + escapeHtml(nom) : ''}</strong></div>
      <div style="font-size:12.5px;color:var(--muted);margin-bottom:14px">El sistema SCW permite buscar por parte desde su interfaz web.</div>
      <a href="https://scw.pjn.gov.ar/scw/home.seam" target="_blank" class="ext-link-btn burgundy">🔗 Ir al SCW — Buscar por Parte →</a>
    </div>`);
  }, 700);
}

// ── IOL — Ciudad de Buenos Aires ─────────────────────────
export function buscarCaba() {
  const num      = val('caba-numero');
  const anio     = val('caba-anio');
  const fuero    = val('caba-fuero');
  const caratula = val('caba-caratula');
  showRes('caba-results', `<div style="display:flex;align-items:center;gap:10px">${SPINNER}<span style="font-size:13.5px;color:var(--muted)">Conectando con el sistema IOL de CABA…</span></div>`);
  setTimeout(() => {
    showRes('caba-results', `<div style="background:rgba(45,106,79,.05);border:1px solid rgba(45,106,79,.15);border-radius:8px;padding:16px 18px">
      <div style="font-size:13px;color:var(--slate);margin-bottom:10px">Datos de búsqueda para el IOL CABA:</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">
        ${num      ? `<span style="font-size:12.5px;color:var(--muted)">N°: <strong style="color:var(--ink);font-family:'DM Mono',monospace">${escapeHtml(num)}</strong></span>`           : ''}
        ${anio     ? `<span style="font-size:12.5px;color:var(--muted)">Año: <strong style="color:var(--ink);font-family:'DM Mono',monospace">${escapeHtml(anio)}</strong></span>`          : ''}
        ${fuero    ? `<span style="font-size:12.5px;color:var(--muted)">Fuero: <strong style="color:var(--ink)">${escapeHtml(fuero)}</strong></span>`                                      : ''}
        ${caratula ? `<span style="font-size:12.5px;color:var(--muted)">Carátula: <strong style="color:var(--ink)">${escapeHtml(caratula)}</strong></span>`                               : ''}
      </div>
      <a href="https://eje.juscaba.gob.ar/iol-ui/p/inicio" target="_blank" class="ext-link-btn green">🔗 Abrir IOL CABA y completar búsqueda →</a>
    </div>`);
  }, 900);
}

// ── MEV — Provincia de Buenos Aires ──────────────────────
export function buscarPBA() {
  const num = val('pba-numero');
  const anio = val('pba-anio');
  const dep  = val('pba-departamento');
  showRes('pba-results', `<div style="display:flex;align-items:center;gap:10px">${SPINNER}<span style="font-size:13.5px;color:var(--muted)">Conectando con la MEV de la SCBA…</span></div>`);
  setTimeout(() => {
    showRes('pba-results', `<div style="background:rgba(184,147,90,.06);border:1px solid rgba(184,147,90,.2);border-radius:8px;padding:16px 18px">
      <div style="font-size:13px;color:var(--slate);margin-bottom:10px">Datos para la Mesa de Entradas Virtual (SCBA):</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">
        ${num  ? `<span style="font-size:12.5px;color:var(--muted)">N°: <strong style="color:var(--ink);font-family:'DM Mono',monospace">${escapeHtml(num)}</strong></span>`  : ''}
        ${anio ? `<span style="font-size:12.5px;color:var(--muted)">Año: <strong style="color:var(--ink);font-family:'DM Mono',monospace">${escapeHtml(anio)}</strong></span>` : ''}
        ${dep  ? `<span style="font-size:12.5px;color:var(--muted)">Departamento: <strong style="color:var(--ink)">${escapeHtml(dep)}</strong></span>`                        : ''}
      </div>
      <a href="https://mev.scba.gov.ar/registro.asp" target="_blank" class="ext-link-btn gold">🔗 Abrir MEV SCBA →</a>
    </div>`);
  }, 900);
}

export function buscarPBAParte() {
  const ap = val('pba-apellido');
  if (!ap) { alert('Ingresá al menos el apellido'); return; }
  showRes('pba-results', `<div style="background:rgba(184,147,90,.06);border:1px solid rgba(184,147,90,.2);border-radius:8px;padding:16px 18px">
    <div style="font-size:13px;color:var(--slate);margin-bottom:12px">Búsqueda en PBA por parte: <strong>${escapeHtml(ap)}</strong></div>
    <a href="https://mev.scba.gov.ar/registro.asp" target="_blank" class="ext-link-btn gold">🔗 Ir a la MEV SCBA →</a>
  </div>`);
}

export function abrirSCW() {
  window.open('https://scw.pjn.gov.ar/scw/home.seam', '_blank', 'noopener,noreferrer');
}

// ── Bridge global ─────────────────────────────────────────
window.switchJudTab    = switchJudTab;
window.buscarCsjn      = buscarCsjn;
window.buscarCsjnParte = buscarCsjnParte;
window.buscarCaba      = buscarCaba;
window.buscarPBA       = buscarPBA;
window.buscarPBAParte  = buscarPBAParte;
window.abrirSCW        = abrirSCW;

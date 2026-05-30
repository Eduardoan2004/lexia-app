// final-cleanup.mjs — remove dead code and duplicate functions from index.html
import { readFileSync, writeFileSync } from 'fs';

const FILE = new URL('../index.html', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let html = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const orig = html.length;

function findFunctionEnd(src, start) {
  let depth = 0, i = start, inStr = false, strChar = '', inLC = false, inBC = false;
  while (i < src.length) {
    const ch = src[i], nx = src[i+1];
    if (inLC)  { if (ch === '\n') inLC = false; i++; continue; }
    if (inBC)  { if (ch === '*' && nx === '/') { inBC = false; i += 2; continue; } i++; continue; }
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === strChar) inStr = false;
      i++; continue;
    }
    if ((ch === '"' || ch === "'" || ch === '`') && !inStr) { inStr = true; strChar = ch; i++; continue; }
    if (ch === '/' && nx === '/') { inLC = true; i += 2; continue; }
    if (ch === '/' && nx === '*') { inBC = true; i += 2; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

function removeFunction(name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'g');
  let m, count = 0;
  const removals = [];
  while ((m = re.exec(html)) !== null) {
    const brace = html.indexOf('{', m.index);
    if (brace === -1) continue;
    const end = findFunctionEnd(html, brace);
    if (end === -1) continue;
    let lineStart = html.lastIndexOf('\n', m.index) + 1;
    // Walk back over comment lines
    let cb = lineStart - 2;
    while (cb > 0) {
      const prev = html.lastIndexOf('\n', cb) + 1;
      const line = html.slice(prev, cb + 1).trim();
      if (line.startsWith('//')) { lineStart = prev; cb = prev - 2; } else break;
    }
    const endIdx = end + 1 + (html[end + 1] === '\n' ? 1 : 0);
    removals.push([lineStart, endIdx]);
    count++;
  }
  removals.sort((a, b) => b[0] - a[0]);
  for (const [s, e] of removals) html = html.slice(0, s) + html.slice(e);
  return count;
}

// ── Functions to remove ───────────────────────────────────
const fns = [
  'inyectarLyzrEnIATab', 'seleccionarDocGuardado', 'extraerPartesDeDemandia',
  'consultarExpedienteJudicial', 'mostrarModalPortal', 'fbEliminarHon',
  'fbGuardarHon', 'fbGuardarEvento',
  '_legacyFbSuscribirHonorarios_UNUSED', '_legacyFbSuscribirEventos_UNUSED',
  '_badgeEstadoUnused', '_toast',
  // Cowork duplicates (already in cowork.js)
  '_cwBadgeEstado', '_cwBadgePor', '_cwTypePill', '_cwSkillTag',
  'cargarCoworkLog', 'renderCoworkLog', 'filterCoworkLog', '_actualizarCoworkStats',
  'openModalCowork', 'openModalCoworkGlobal', 'saveCoworkEntry', 'addCoworkEntry',
  '_cwDeleteEntry', '_cargarCoworkGlobal', '_renderCoworkGlobal', 'filterCoworkGlobal',
  // Calculadoras duplicates (already in calculadoras.js)
  'mostrarCalc', 'initCalculadoras', 'calcularIntereses', 'calcularBarrios',
  'calcularIncapacidad', 'calcularDanoPunitivo', 'copiarCalcResultado',
  // Modules duplicates (already in modules.js)
  'detectarModulo', 'cargarModulo', 'subirModulo', 'buildSystemPromptConModulo',
  'callGeminiConModulo', 'iaAnalisisConModulo', 'gestionarModulos',
  'uploadModuloFile', 'limpiarCacheModulo', 'agregarBotonesModulos',
  // Firebase helpers (duplicates)
  'fbCol', 'fbDoc', 'fbCfgDoc',
];

let totalRemoved = 0;
for (const fn of fns) {
  const n = removeFunction(fn);
  if (n > 0) { console.log(`  ✓ ${fn} (${n})`); totalRemoved += n; }
}

// ── Remove monkey-patch blocks ────────────────────────────
// window._fbReady second definition
html = html.replace(/const _fbReadyOriginal[\s\S]*?\n\};\n/g, '');
// navigate cowork hook
html = html.replace(/const _navigateOriginal_cw[\s\S]*?navigate\s*=\s*function\(view\)[\s\S]*?\n\};\n/g, '');
// switchDetailTab cowork hook
html = html.replace(/const _switchDetailTab_cw[\s\S]*?switchDetailTab\s*=\s*function\(tabEl, panelId\)[\s\S]*?\n\};\n/g, '');
// iaAnalisis cowork hook
html = html.replace(/const _iaAnalisis_orig[\s\S]*?iaAnalisis\s*=\s*async function\(tipo\)[\s\S]*?\n\};\n/g, '');
// callGeminiConModulo overlay
html = html.replace(/const _callGeminiOriginal[\s\S]*?async function callGeminiConModulo[\s\S]*?\n\}\n/g, '');
// switchDetailTab lyzr hook
html = html.replace(/const _switchDetailTab_lyzr[\s\S]*?switchDetailTab\s*=\s*function\(tabEl, panelId\)[\s\S]*?\n\};\n/g, '');
// openExpediente lyzr hook
html = html.replace(/const _openExp_lyzr[\s\S]*?openExpediente\s*=\s*function\(id\)[\s\S]*?\n\};\n/g, '');
// openExpediente modules hook
html = html.replace(/const _openExpOriginal[\s\S]*?\n\}\n\}\n/g, '');
// window._fbReady main block
html = html.replace(/window\._fbReady\s*=\s*async\s*function\(user\)\{[\s\S]*?\n\};\n/g, '');

// ── Remove dead constants and vars ────────────────────────
html = html.replace(/^const GEMINI_MODEL\s*=.*\n/m, '');
html = html.replace(/^const CLOUDINARY_CLOUD\s*=.*\n/m, '');
html = html.replace(/^const CLOUDINARY_PRESET\s*=.*\n/m, '');
html = html.replace(/^const LYZR_AGENT_ID\s*=.*\n/m, '');
html = html.replace(/^const LYZR_API_URL\s*=.*\n/m, '');
html = html.replace(/^const MODULO_IDS\s*=[\s\S]*?\n\};\n/m, '');
html = html.replace(/^let _rolIA\s*=.*\n/m, '');
html = html.replace(/^let logoDataUrl\s*=.*\n/m, '');
html = html.replace(/^let currentClienteId\s*=.*\n/m, '');
html = html.replace(/^let agendaMesOffset\s*=.*\n/m, '');
html = html.replace(/^let importRows\s*=.*\n/m, '');
html = html.replace(/^let _partesExp\s*=.*\n/m, '');
html = html.replace(/^let _unsubEvt\s*=.*\n/m, '');
html = html.replace(/^window\._lyzrSessions\s*=.*\n/m, '');
html = html.replace(/window\._coworkCache\s*=.*\n/g, '');
html = html.replace(/window\._coworkCurrentExpId\s*=.*\n/g, '');
html = html.replace(/window\._coworkAllEntries\s*=.*\n/g, '');

// ── Clean up blank lines ──────────────────────────────────
html = html.replace(/\n{4,}/g, '\n\n\n');

writeFileSync(FILE, html, 'utf8');
const saved = orig - html.length;
console.log(`\nTotal: ${totalRemoved} functions removed`);
console.log(`${(orig/1024).toFixed(1)} KB → ${(html.length/1024).toFixed(1)} KB (−${(saved/1024).toFixed(1)} KB)`);

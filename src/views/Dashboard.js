// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Dashboard
// ════════════════════════════════════════════════════════

import { escapeHtml, badgeEstado, calcVencimiento } from '../utils/helpers.js';

// ── KPIs del panel principal ─────────────────────────────
export function renderDashboardKPIs() {
  const exps = window._allExpedientes || [];
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);

  const activos = exps.filter(e =>
    ['Activo','activo','Urgente','urgente'].includes(e.estado || '')
  ).length;

  const venc7 = exps.filter(e => {
    const f = e.proxVencimiento || e.fechaVencimiento;
    if (!f) return false;
    const d = new Date(f); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - hoy) / 86400000);
    return diff >= 0 && diff <= 7;
  }).length;

  const urgentes = exps.filter(e => {
    const f = e.proxVencimiento || e.fechaVencimiento;
    if (!f) return false;
    const d = new Date(f); d.setHours(0, 0, 0, 0);
    return Math.round((d - hoy) / 86400000) <= 1;
  }).length;

  const kpiExps = document.querySelector('.kpi-activos');
  const kpiVenc = document.querySelector('.kpi-vencimientos');
  const kpiUrg  = document.querySelector('.kpi-urgentes');
  const kpiCli  = document.querySelector('.kpi-clientes');

  if (kpiExps) kpiExps.textContent = activos;
  if (kpiVenc) kpiVenc.textContent = venc7;
  if (kpiUrg)  kpiUrg.textContent  = urgentes + ' urgentes hoy';
  if (kpiCli)  kpiCli.textContent  = (window._allClientes || []).length;
}

// ── Tabla de expedientes recientes en dashboard ──────────
export function renderDashboardExpedientes() {
  const tbody = document.getElementById('dashboard-exp-body');
  if (!tbody) return;

  const exps = (window._allExpedientes || []).slice(0, 5);
  if (!exps.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Sin expedientes todavía</td></tr>';
    return;
  }

  tbody.innerHTML = exps.map(e => {
    const venc     = calcVencimiento(e.proxVencimiento || e.fechaVencimiento || '');
    const vencHTML = venc.texto
      ? `<span style="color:${venc.color};font-weight:600;font-size:12px">${venc.icono} ${venc.texto}</span>`
      : '—';
    const fueroCss = (e.fuero || 'Civil')
      .toLowerCase().replace(/[ y]/g, '')
      .replace('comercial', 'civil').replace('civily', 'civil') || 'civil';

    return `<tr onclick="openExpediente('${e.id}')" style="cursor:pointer">
      <td><span class="exp-num">${escapeHtml(e.numero || '—')}</span></td>
      <td><div class="exp-title">${escapeHtml(e.caratula || 'Sin carátula')}<small>${escapeHtml(e.juzgado || '')}</small></div></td>
      <td><span class="badge badge-${fueroCss}">${escapeHtml(e.fuero || '—')}</span></td>
      <td>${badgeEstado(e.estado)}</td>
      <td>${vencHTML}</td>
    </tr>`;
  }).join('');
}

// ── Bridge global ─────────────────────────────────────────
window.renderDashboardKPIs        = renderDashboardKPIs;
window.renderDashboardExpedientes = renderDashboardExpedientes;

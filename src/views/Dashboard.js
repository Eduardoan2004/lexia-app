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

// ── Widget "Próximos Vencimientos" del panel principal ───
export function renderDashboardVencimientos() {
  const cont  = document.getElementById('dashboard-venc-list');
  const badge = document.getElementById('dashboard-venc-badge');
  if (!cont) return;

  const exps = window._allExpedientes || [];
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);

  const proximos = exps
    .filter(e => {
      const f = e.proxVencimiento || e.fechaVencimiento;
      if (!f) return false;
      const d = new Date(f); d.setHours(0, 0, 0, 0);
      const diff = Math.round((d - hoy) / 86400000);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) =>
      new Date(a.proxVencimiento || a.fechaVencimiento) -
      new Date(b.proxVencimiento || b.fechaVencimiento)
    )
    .slice(0, 5);

  if (badge) badge.textContent = proximos.length + ' pendientes';

  if (!proximos.length) {
    cont.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12.5px;padding:16px 4px">✅ Sin vencimientos en los próximos 7 días</div>';
    return;
  }

  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  cont.innerHTML = proximos.map(e => {
    const f    = new Date(e.proxVencimiento || e.fechaVencimiento);
    const diff = Math.round((f - hoy) / 86400000);
    const cls  = diff <= 2 ? 'urgent' : 'warning';
    return `<div class="venc-item ${cls}" onclick="openExpediente('${e.id}')">
      <div class="venc-day"><div class="day-num">${String(f.getDate()).padStart(2,'0')}</div><div class="day-mon">${meses[f.getMonth()]}</div></div>
      <div>
        <div style="font-size:13px;font-weight:500;color:var(--ink)">${escapeHtml((e.caratula || 'Sin carátula').substring(0, 40))}${(e.caratula||'').length > 40 ? '...' : ''}</div>
        <div style="font-size:11.5px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px">${escapeHtml(e.numero || 'S/N')}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Bridge global ─────────────────────────────────────────
window.renderDashboardKPIs         = renderDashboardKPIs;
window.renderDashboardExpedientes  = renderDashboardExpedientes;
window.renderDashboardVencimientos = renderDashboardVencimientos;

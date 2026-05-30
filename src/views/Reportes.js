// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Reportes y Backup
// ════════════════════════════════════════════════════════

import { fmtPeso } from '../utils/helpers.js';
import { db, collection, getDocs } from '../services/firebase.js';

// ── Mostrar / cerrar reporte ──────────────────────────────
export function showReport(type) {
  const container = document.getElementById('report-container');
  if (container) { container.style.display = 'block'; container.scrollIntoView({ behavior: 'smooth' }); }
  window._activeReportType = type;
  renderReportDynamic(type);
}
export function closeReport()   { document.getElementById('report-container').style.display = 'none'; }
export function refreshReport() { if (window._activeReportType) renderReportDynamic(window._activeReportType); }
export function exportReport()  { alert('Exportando reporte como CSV…\n(En producción se generaría el archivo descargable)'); }
export function printReport()   { window.print(); }

// ── Render dinámico de reportes ───────────────────────────
export function renderReportDynamic(type) {
  const exps     = window._allExpedientes || [];
  const clientes = window._allClientes || window.allClientes || [];
  const hons     = window.allHonorarios || [];
  const period   = document.getElementById('report-period')?.value || 'Todos los años';
  const now      = new Date();

  const filteredExps = exps.filter(e => {
    if (period === 'Todos los años') return true;
    if (period === 'Últimos 6 meses')  { const d = new Date(now); d.setMonth(d.getMonth()-6);       return !e.fechaInicio || new Date(e.fechaInicio) >= d; }
    if (period === 'Últimos 12 meses') { const d = new Date(now); d.setFullYear(d.getFullYear()-1); return !e.fechaInicio || new Date(e.fechaInicio) >= d; }
    if (!e.fechaInicio) return true;
    return new Date(e.fechaInicio).getFullYear().toString() === period;
  });

  const colors = ['var(--gold)','var(--info)','var(--success)','var(--burgundy)','var(--warning)','var(--muted)'];

  if (type === 'cliente') {
    document.getElementById('report-heading').textContent = 'Reporte por Cliente';
    const clienteMap = {};
    filteredExps.forEach(e => {
      const n = e.cliente || 'Sin cliente';
      if (!clienteMap[n]) clienteMap[n] = { nombre: n, exps: 0, activos: 0, urgentes: 0, total: 0, cobrado: 0 };
      clienteMap[n].exps++;
      if (['Activo','activo'].includes(e.estado)) clienteMap[n].activos++;
      if (['Urgente','urgente'].includes(e.estado)) clienteMap[n].urgentes++;
    });
    hons.forEach(h => {
      const exp = filteredExps.find(e => e.id === h.expedienteId || (e.numero && e.numero === h.expediente));
      const key = exp?.cliente || h.cliente || h.expediente || 'Sin cliente';
      if (!clienteMap[key]) clienteMap[key] = { nombre: key, exps: 0, activos: 0, urgentes: 0, total: 0, cobrado: 0 };
      clienteMap[key].total += parseFloat(h.monto) || 0;
      if (h.estado === 'Cobrado' || h.cobrado) clienteMap[key].cobrado += parseFloat(h.monto) || 0;
    });
    const list    = Object.values(clienteMap).sort((a,b) => b.exps - a.exps);
    const maxExps = Math.max(1, ...list.map(c => c.exps));
    const maxHon  = Math.max(1, ...list.map(c => c.total || 0));
    if (!list.length) { document.getElementById('report-body').innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">No hay datos para el período seleccionado.</div>'; return; }
    const barsExps = list.slice(0,8).map((c,i) => `<div class="chart-bar-row"><span class="chart-bar-label">${c.nombre}</span><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round(c.exps/maxExps*100)}%;background:${colors[i%colors.length]}"><span class="chart-bar-val">${c.exps}</span></div></div></div>`).join('');
    const barsHon  = list.filter(c=>c.total>0).sort((a,b)=>(b.total||0)-(a.total||0)).slice(0,8).map((c,i) => `<div class="chart-bar-row"><span class="chart-bar-label">${c.nombre}</span><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((c.total||0)/maxHon*100)}%;background:${colors[i%colors.length]}"><span class="chart-bar-val">${fmtPeso(c.total)}</span></div></div></div>`).join('');
    const rows = list.map(c => {
      const cl  = clientes.find(x => x.nombre === c.nombre) || {};
      const badge = c.urgentes > 0 ? `<span class="badge badge-urgent">${c.urgentes} urgente</span>` : c.activos > 0 ? `<span class="badge badge-active">${c.activos} activos</span>` : `<span class="badge" style="background:var(--muted);color:#fff">0 activos</span>`;
      return `<tr><td style="font-weight:600">${c.nombre}</td><td style="font-family:'DM Mono',monospace;font-size:12px">${cl.cuit||'—'}</td><td>${c.exps}</td><td>${badge}</td><td style="font-family:'DM Mono',monospace">${fmtPeso(c.total||0)}</td><td style="color:var(--success);font-weight:500">${fmtPeso(c.cobrado||0)}</td><td style="color:var(--danger);font-weight:500">${fmtPeso((c.total||0)-(c.cobrado||0))}</td></tr>`;
    }).join('');
    document.getElementById('report-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card"><div class="card-header"><div class="card-title">Expedientes por Cliente</div></div><div class="card-body"><div class="chart-bar-wrap">${barsExps||'<p style="color:var(--muted)">Sin datos</p>'}</div></div></div>
        <div class="card"><div class="card-header"><div class="card-title">Honorarios por Cliente</div></div><div class="card-body"><div class="chart-bar-wrap">${barsHon||'<p style="color:var(--muted)">Sin honorarios</p>'}</div></div></div>
        <div class="card" style="grid-column:1/-1"><div class="card-header"><div class="card-title">Detalle por Cliente</div></div>
          <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>CUIT</th><th>Expedientes</th><th>Estado</th><th>Hon. Totales</th><th>Cobrado</th><th>Pendiente</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
      </div>`;

  } else if (type === 'causa') {
    document.getElementById('report-heading').textContent = 'Reporte por Causa y Fuero';
    const fueroMap = {};
    filteredExps.forEach(e => {
      const f = e.fuero || 'Sin fuero';
      if (!fueroMap[f]) fueroMap[f] = { fuero: f, count: 0, monto: 0 };
      fueroMap[f].count++; fueroMap[f].monto += parseFloat(e.monto) || 0;
    });
    const fueroList = Object.values(fueroMap).sort((a,b) => b.count - a.count);
    const maxF = Math.max(1, ...fueroList.map(f => f.count));
    const bars = fueroList.map((f,i) => `<div class="chart-bar-row"><span class="chart-bar-label">${f.fuero}</span><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round(f.count/maxF*100)}%;background:${colors[i%colors.length]}"><span class="chart-bar-val">${f.count}</span></div></div></div>`).join('');
    document.getElementById('report-body').innerHTML = `<div class="card"><div class="card-header"><div class="card-title">Expedientes por Fuero</div></div><div class="card-body"><div class="chart-bar-wrap">${bars||'<p style="color:var(--muted)">Sin datos</p>'}</div></div></div>`;

  } else if (type === 'honorarios') {
    document.getElementById('report-heading').textContent = 'Reporte de Honorarios';
    const total    = hons.reduce((s,h) => s + (parseFloat(h.monto)||0), 0);
    const cobrado  = hons.filter(h => h.estado==='Cobrado'||h.cobrado).reduce((s,h) => s + (parseFloat(h.monto)||0), 0);
    document.getElementById('report-body').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <div class="card"><div class="kpi-val">${fmtPeso(total)}</div><div class="kpi-label">Total facturado</div></div>
        <div class="card"><div class="kpi-val" style="color:var(--success)">${fmtPeso(cobrado)}</div><div class="kpi-label">Cobrado</div></div>
        <div class="card"><div class="kpi-val" style="color:var(--danger)">${fmtPeso(total-cobrado)}</div><div class="kpi-label">Pendiente</div></div>
      </div>`;
  }
}

// ── Backup JSON ───────────────────────────────────────────
export async function exportarBackupJSON() {
  const status = document.getElementById('backup-status');
  if (status) status.textContent = '⏳ Generando backup...';
  try {
    const uid = window._fbUser?.uid; if (!uid) { alert('Iniciá sesión primero'); return; }
    const [expSnap, cliSnap, evtSnap, honSnap, docSnap] = await Promise.all([
      getDocs(collection(db, `lexia/${uid}/expedientes`)),
      getDocs(collection(db, `lexia/${uid}/clientes`)),
      getDocs(collection(db, `lexia/${uid}/eventos`)),
      getDocs(collection(db, `lexia/${uid}/honorarios`)),
      getDocs(collection(db, `lexia/${uid}/documentos`)).catch(() => ({ docs: [] })),
    ]);
    const backup = {
      version: '1.0', fecha: new Date().toISOString(), usuario: window._fbUser.email,
      expedientes: expSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      clientes:    cliSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      eventos:     evtSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      honorarios:  honSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      documentos:  docSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lexia-backup-${new Date().toISOString().slice(0,10)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
    if (status) status.textContent = `✅ Backup exportado: ${backup.expedientes.length} expedientes, ${backup.clientes.length} clientes.`;
  } catch (e) { if (status) status.textContent = '❌ Error: ' + e.message; }
}

// ── Backup Excel (CSV) ────────────────────────────────────
export async function exportarBackupExcel() {
  const status = document.getElementById('backup-status');
  if (status) status.textContent = '⏳ Generando Excel...';
  try {
    const uid = window._fbUser?.uid; if (!uid) { alert('Iniciá sesión primero'); return; }
    const [expSnap, cliSnap, honSnap] = await Promise.all([
      getDocs(collection(db, `lexia/${uid}/expedientes`)),
      getDocs(collection(db, `lexia/${uid}/clientes`)),
      getDocs(collection(db, `lexia/${uid}/honorarios`)),
    ]);
    const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
    let csv = 'EXPEDIENTES\nN° Expediente,Carátula,Fuero,Juzgado,Cliente,Contraparte,Estado,Fecha Inicio,Prox. Vencimiento,Monto,Honorarios\n';
    expSnap.docs.forEach(d => { const e = d.data(); csv += [e.numero,e.caratula,e.fuero,e.juzgado,e.cliente,e.contraparte,e.estado,e.fechaInicio,e.proxVencimiento||e.fechaVencimiento,e.monto,e.honorarios].map(esc).join(',') + '\n'; });
    csv += '\nCLIENTES\nNombre,CUIT,Email,Teléfono,Domicilio\n';
    cliSnap.docs.forEach(d => { const c = d.data(); csv += [c.nombre,c.cuit,c.email,c.telefono,c.domicilio].map(esc).join(',') + '\n'; });
    csv += '\nHONORARIOS\nExpediente,Concepto,Monto,Estado,Fecha\n';
    honSnap.docs.forEach(d => { const h = d.data(); csv += [h.expediente,h.concepto,h.monto,h.estado,h.fecha].map(esc).join(',') + '\n'; });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lexia-backup-${new Date().toISOString().slice(0,10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
    if (status) status.textContent = `✅ Excel exportado: ${expSnap.docs.length} expedientes.`;
  } catch (e) { if (status) status.textContent = '❌ Error: ' + e.message; }
}

// ── Bridge global ─────────────────────────────────────────
window.showReport           = showReport;
window.closeReport          = closeReport;
window.refreshReport        = refreshReport;
window.exportReport         = exportReport;
window.printReport          = printReport;
window.renderReportDynamic  = renderReportDynamic;
window.exportarBackupJSON   = exportarBackupJSON;
window.exportarBackupExcel  = exportarBackupExcel;

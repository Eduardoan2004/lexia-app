// ─── CALCULADORAS JURÍDICAS ───

export function mostrarCalc(id) {
  document.querySelectorAll('.tab-calculadoras [id^="calc-"]').forEach(el => {
    if (!el.id.includes('resultado')) el.style.display = 'none';
  });
  const target = document.getElementById('calc-' + id);
  if (target) target.style.display = '';
  // Update buttons
  document.querySelectorAll('#tab-calculadoras .btn').forEach(b => {
    b.className = b.onclick?.toString().includes(id) ?
      'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  });
}

export function initCalculadoras() {
  const e = window._currentExpData || {};
  // Pre-cargar datos del expediente
  ['ci-caratula', 'cb-caratula', 'cc-caratula'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.caratula) el.value = e.caratula;
  });
  const monto = e.monto || 0;
  if (monto) {
    const ciMonto = document.getElementById('ci-monto');
    const cbMonto = document.getElementById('cb-monto');
    if (ciMonto && !ciMonto.value) ciMonto.value = monto;
    if (cbMonto && !cbMonto.value) cbMonto.value = monto;
  }
  if (e.fechaInicio) {
    const fechaHecho = document.getElementById('ci-fecha-hecho');
    if (fechaHecho && !fechaHecho.value) fechaHecho.value = e.fechaInicio;
    // Convert to dd/mm/yyyy for barrios
    const parts = e.fechaInicio.split('-');
    if (parts.length === 3) {
      const cbIni = document.getElementById('cb-fecha-ini');
      if (cbIni && !cbIni.value) cbIni.value = parts[2] + '/' + parts[1] + '/' + parts[0];
    }
  }
  // Set today as default end date
  const today = new Date().toISOString().slice(0, 10);
  const todayDMY = today.split('-').reverse().join('/');
  const ciPago = document.getElementById('ci-fecha-pago');
  if (ciPago && !ciPago.value) ciPago.value = today;
  const cbFin = document.getElementById('cb-fecha-fin');
  if (cbFin && !cbFin.value) cbFin.value = todayDMY;
}

export function calcularIntereses() {
  const monto = parseFloat(document.getElementById('ci-monto')?.value) || 0;
  const caratula = document.getElementById('ci-caratula')?.value || '';
  const fechaHecho = document.getElementById('ci-fecha-hecho')?.value;
  const fechaDet = document.getElementById('ci-fecha-det')?.value;
  const fechaPago = document.getElementById('ci-fecha-pago')?.value;
  const res = document.getElementById('ci-resultado');

  if (!monto || !fechaHecho || !fechaDet || !fechaPago) {
    res.style.display = '';
    res.innerHTML = '<span style="color:#C0392B">⚠️ Completá todos los campos obligatorios.</span>';
    return;
  }

  const d1 = new Date(fechaHecho), d2 = new Date(fechaDet), d3 = new Date(fechaPago);
  const dias1 = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  const tasa6pct = monto * 0.06 * dias1 / 365;
  const capitalizado = monto + tasa6pct;

  const dias2 = Math.max(0, Math.round((d3 - d2) / (1000 * 60 * 60 * 24)));
  const tasaBAPRO_anual = 0.60;
  const interesBAPRO = capitalizado * tasaBAPRO_anual * dias2 / 365;
  const totalIntereses = tasa6pct + interesBAPRO;
  const totalReclamar = monto + totalIntereses;

  const fmt = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

  res.style.display = '';
  res.innerHTML = `
    <div style="font-weight:600;color:#0F2244;margin-bottom:12px">📊 Resultado — ${caratula}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Capital original</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(monto)}</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Período 1 — ${dias1} días × 6% anual</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(tasa6pct)}</td></tr>
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Total capitalizado</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(capitalizado)}</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Período 2 — ${dias2} días × Tasa BAPRO (~60% anual)*</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(interesBAPRO)}</td></tr>
      <tr style="background:#0F2244;color:#fff;font-weight:700"><td style="padding:8px 10px;border-radius:0 0 0 6px">TOTAL A RECLAMAR</td><td style="padding:8px 10px;text-align:right;font-family:monospace;border-radius:0 0 6px 0">${fmt(totalReclamar)}</td></tr>
    </table>
    <div style="font-size:10.5px;color:var(--muted);margin-top:10px">* La tasa BAPRO es aproximada. Para liquidación judicial verificar la tasa vigente en el BCRA para la fecha de pago.</div>
    <button onclick="copiarCalcResultado('ci-resultado')" class="btn btn-secondary btn-sm" style="margin-top:10px">📋 Copiar resultado</button>
  `;
}

export async function calcularBarrios() {
  const monto = parseFloat(document.getElementById('cb-monto')?.value) || 0;
  const caratula = document.getElementById('cb-caratula')?.value || '';
  const fechaIni = document.getElementById('cb-fecha-ini')?.value;
  const fechaFin = document.getElementById('cb-fecha-fin')?.value;
  const res = document.getElementById('cb-resultado');

  if (!monto || !fechaIni || !fechaFin) {
    res.style.display = '';
    res.innerHTML = '<span style="color:#C0392B">⚠️ Completá todos los campos.</span>';
    return;
  }

  res.style.display = '';
  res.innerHTML = '<span style="color:var(--muted)">⏳ Calculando actualización...</span>';

  const parseFecha = s => {
    const p = s.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    return s;
  };

  const fi = parseFecha(fechaIni);
  const ff = parseFecha(fechaFin);

  try {
    const ipcUrl = `https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&desde=${fi.slice(0, 7)}&hasta=${ff.slice(0, 7)}&limit=200&format=json`;
    let ipcFactor = null;
    try {
      const resp = await fetch(ipcUrl);
      const data = await resp.json();
      if (data.data && data.data.length > 1) {
        const vals = data.data.map(d => d[1]).filter(v => v !== null);
        if (vals.length >= 2) {
          let factor = 1;
          for (let i = 1; i < vals.length; i++) factor *= (vals[i] / vals[i - 1]);
          ipcFactor = factor;
        }
      }
    } catch (e2) { }

    const fmt = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
    const fmtFactor = n => n.toFixed(4) + 'x';
    const montoIPC = ipcFactor ? monto * ipcFactor : null;

    res.innerHTML = `
      <div style="font-weight:600;color:#0F2244;margin-bottom:12px">📈 Actualización Fallo Barrios — ${caratula}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Monto original</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(monto)}</td></tr>
        <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Período</td><td style="padding:6px 10px;text-align:right">${fechaIni} → ${fechaFin}</td></tr>
        ${montoIPC ? `
        <tr><td style="padding:6px 10px;color:var(--muted)">Factor IPC (INDEC)</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmtFactor(ipcFactor)}</td></tr>
        <tr><td style="padding:6px 10px;color:var(--muted)">Monto actualizado por IPC</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(montoIPC)}</td></tr>
        <tr style="background:#0F2244;color:#fff;font-weight:700"><td style="padding:8px 10px;border-radius:0 0 0 6px">MONTO ACTUALIZADO (IPC)</td><td style="padding:8px 10px;text-align:right;font-family:monospace;border-radius:0 0 6px 0">${fmt(montoIPC)}</td></tr>
        ` : `
        <tr style="background:#FFF3CD"><td colspan="2" style="padding:8px 10px;font-size:12px">⚠️ No se pudieron obtener datos del INDEC. Verificá la conexión o ingresá las fechas en formato dd/mm/aaaa.</td></tr>
        `}
      </table>
      <div style="font-size:10.5px;color:var(--muted);margin-top:10px">Fallo Barrios — SCBA. Para CER y RIPTE consultar el sitio oficial del BCRA e INDEC.</div>
      <button onclick="copiarCalcResultado('cb-resultado')" class="btn btn-secondary btn-sm" style="margin-top:10px">📋 Copiar resultado</button>
    `;
  } catch (e) {
    res.innerHTML = `<span style="color:#C0392B">Error al calcular: ${e.message}</span>`;
  }
}

export function calcularIncapacidad() {
  const edad = parseInt(document.getElementById('cc-edad')?.value) || 0;
  const ingreso = parseFloat(document.getElementById('cc-ingreso')?.value) || 0;
  const pct = parseFloat(document.getElementById('cc-pct')?.value) || 0;
  const caratula = document.getElementById('cc-caratula')?.value || '';
  const res = document.getElementById('cc-resultado');

  if (!edad || !ingreso || !pct || edad >= 70) {
    res.style.display = '';
    res.innerHTML = '<span style="color:#C0392B">⚠️ Completá todos los campos. La edad debe ser menor a 70.</span>';
    return;
  }

  const A = ingreso * 13;
  const i = 0.04;
  const n = 70 - edad;
  const factor = (Math.pow(1 + i, n) - 1) / (i * Math.pow(1 + i, n));
  const C = A * factor * (pct / 100);

  const fmt = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

  res.style.display = '';
  res.innerHTML = `
    <div style="font-weight:600;color:#0F2244;margin-bottom:12px">🏥 Indemnización por Incapacidad — ${caratula}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Edad al accidente</td><td style="padding:6px 10px;text-align:right">${edad} años</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Años restantes hasta 70</td><td style="padding:6px 10px;text-align:right">${n} años</td></tr>
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Ingreso mensual × 13</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(A)}</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Tasa de descuento</td><td style="padding:6px 10px;text-align:right">4% anual</td></tr>
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Factor de renta</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${factor.toFixed(4)}</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Incapacidad</td><td style="padding:6px 10px;text-align:right">${pct}%</td></tr>
      <tr style="background:#0F2244;color:#fff;font-weight:700"><td style="padding:8px 10px;border-radius:0 0 0 6px">INDEMNIZACIÓN</td><td style="padding:8px 10px;text-align:right;font-family:monospace;border-radius:0 0 6px 0">${fmt(C)}</td></tr>
    </table>
    <button onclick="copiarCalcResultado('cc-resultado')" class="btn btn-secondary btn-sm" style="margin-top:10px">📋 Copiar resultado</button>
  `;
}

export function calcularDanoPunitivo() {
  const tope = parseInt(document.getElementById('dp-tamanio')?.value) || 100;
  const canasta = parseFloat(document.getElementById('dp-canasta')?.value) || 0;
  const res = document.getElementById('dp-resultado');

  if (!canasta) {
    res.style.display = '';
    res.innerHTML = '<span style="color:#C0392B">⚠️ Ingresá el valor de la canasta básica.</span>';
    return;
  }

  const gs = parseFloat(document.getElementById('dp-gs')?.value) || 0;
  const ph = parseFloat(document.getElementById('dp-ph')?.value) || 0;
  const cp = parseFloat(document.getElementById('dp-cp')?.value) || 0;
  const an = parseFloat(document.getElementById('dp-an')?.value) || 0;
  const pm = parseFloat(document.getElementById('dp-pm')?.value) || 0;
  const da = parseFloat(document.getElementById('dp-da')?.value) || 0;
  const al = parseFloat(document.getElementById('dp-al')?.value) || 0;
  const bo = parseFloat(document.getElementById('dp-bo')?.value) || 0;

  const F = 0.20 * gs + 0.10 * ph + 0.10 * cp + 0.10 * an + 0.10 * pm + 0.15 * da + 0.10 * al + 0.15 * bo;
  const canastasResult = Math.round(F * tope);
  const monto = canastasResult * canasta;

  const fmt = n => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

  res.style.display = '';
  res.innerHTML = `
    <div style="font-weight:600;color:#0F2244;margin-bottom:12px">⚖️ Daño Punitivo — Art. 52 bis Ley 24.240</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Factor ponderado (F)</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${(F * 100).toFixed(1)}%</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Tope máximo</td><td style="padding:6px 10px;text-align:right">${tope} canastas</td></tr>
      <tr style="background:#F5F8FC"><td style="padding:6px 10px;color:var(--muted)">Canastas calculadas</td><td style="padding:6px 10px;text-align:right;font-weight:600">${canastasResult} canastas</td></tr>
      <tr><td style="padding:6px 10px;color:var(--muted)">Valor canasta básica</td><td style="padding:6px 10px;text-align:right;font-family:monospace">${fmt(canasta)}</td></tr>
      <tr style="background:#0F2244;color:#fff;font-weight:700"><td style="padding:8px 10px;border-radius:0 0 0 6px">MULTA DAÑO PUNITIVO</td><td style="padding:8px 10px;text-align:right;font-family:monospace;border-radius:0 0 6px 0">${fmt(monto)}</td></tr>
    </table>
    <button onclick="copiarCalcResultado('dp-resultado')" class="btn btn-secondary btn-sm" style="margin-top:10px">📋 Copiar resultado</button>
  `;
}

export function copiarCalcResultado(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const texto = el.innerText;
  navigator.clipboard.writeText(texto).then(() => {
    if (window.showToast) window.showToast('✅ Resultado copiado');
    else if (window._toast) window._toast('✅ Resultado copiado');
  });
}

// Vincular funciones a la ventana global para permitir llamadas desde el HTML onclick
window.mostrarCalc = mostrarCalc;
window.initCalculadoras = initCalculadoras;
window.calcularIntereses = calcularIntereses;
window.calcularBarrios = calcularBarrios;
window.calcularIncapacidad = calcularIncapacidad;
window.calcularDanoPunitivo = calcularDanoPunitivo;
window.copiarCalcResultado = copiarCalcResultado;

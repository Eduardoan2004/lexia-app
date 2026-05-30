// ════════════════════════════════════════════════════════
//  EANDRES SIL — Vista: Partes del expediente
//  Formulario dinámico de partes y letrados
// ════════════════════════════════════════════════════════

// ── Helpers de HTML ───────────────────────────────────────
export function letradoHTML(parteIdx, letIdx, l = {}) {
  return `<div id="letrado-${parteIdx}-${letIdx}" style="background:rgba(184,147,90,.06);border:1px solid rgba(184,147,90,.15);border-radius:8px;padding:10px 12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:11.5px;font-weight:600;color:var(--slate)">Letrado ${letIdx+1}</span>
      <button onclick="eliminarLetrado(${parteIdx},${letIdx})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:12px">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <input class="form-control" id="let-nombre-${parteIdx}-${letIdx}"    value="${l.nombre    ||''}" placeholder="Nombre completo" style="font-size:12px">
      <input class="form-control" id="let-matricula-${parteIdx}-${letIdx}" value="${l.matricula ||''}" placeholder="Matrícula (ej: CPACF T°73 F°571)" style="font-size:12px;font-family:'DM Mono',monospace">
      <input class="form-control" id="let-email-${parteIdx}-${letIdx}"     value="${l.email     ||''}" placeholder="Email" style="font-size:12px">
      <input class="form-control" id="let-tel-${parteIdx}-${letIdx}"       value="${l.tel       ||''}" placeholder="Teléfono" style="font-size:12px">
      <input class="form-control" id="let-domicilio-${parteIdx}-${letIdx}" value="${l.domicilio ||''}" placeholder="Domicilio constituido" style="font-size:12px;grid-column:1/-1">
    </div>
  </div>`;
}

// ── Agregar parte al formulario ───────────────────────────
export function agregarParteForm(parte = null, idx = null) {
  const empty = document.getElementById('partes-empty');
  if (empty) empty.style.display = 'none';
  const list = document.getElementById('partes-list');
  if (!list) return;
  if (!window._partesExp) window._partesExp = [];
  const id = idx !== null ? idx : window._partesExp.length;
  const p  = parte || { rol: 'actor', nombre: '', rolPropio: 'patrocinante', letrados: [] };

  const div = document.createElement('div');
  div.id = `parte-item-${id}`;
  div.style.cssText = 'border:1px solid var(--border-light);border-radius:10px;padding:14px 16px;background:#fff';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;color:var(--ink)">Parte ${id+1}</div>
      <button onclick="eliminarParte(${id})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:13px">🗑 Eliminar</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Rol procesal</label>
        <select class="form-control" id="parte-rol-${id}" style="margin-top:4px" onchange="actualizarRolPropio(${id})">
          <option value="actor"         ${p.rol==='actor'        ?'selected':''}>Actor / Actora</option>
          <option value="coactor"       ${p.rol==='coactor'      ?'selected':''}>Coactor / Coactora</option>
          <option value="demandado"     ${p.rol==='demandado'    ?'selected':''}>Demandado / Demandada</option>
          <option value="codemandado"   ${p.rol==='codemandado'  ?'selected':''}>Codemandado solidario</option>
          <option value="tercero"       ${p.rol==='tercero'      ?'selected':''}>Tercero citado</option>
          <option value="reconviniente" ${p.rol==='reconviniente'?'selected':''}>Reconviniente</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Mi rol en esta parte</label>
        <select class="form-control" id="parte-rolpropio-${id}" style="margin-top:4px">
          <option value="patrocinante" ${p.rolPropio==='patrocinante'?'selected':''}>Abogado patrocinante</option>
          <option value="apoderado"    ${p.rolPropio==='apoderado'   ?'selected':''}>Apoderado</option>
          <option value="contraparte"  ${p.rolPropio==='contraparte' ?'selected':''}>Contraparte (no represento)</option>
        </select>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Nombre completo / Razón social</label>
      <input class="form-control" id="parte-nombre-${id}" value="${p.nombre||''}" placeholder="Ej: García, Juan Carlos / Empresa SA" style="margin-top:4px">
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">CUIT / DNI (opcional)</label>
      <input class="form-control" id="parte-cuit-${id}" value="${p.cuit||''}" placeholder="20-12345678-9" style="margin-top:4px;font-family:'DM Mono',monospace">
    </div>
    <div style="border-top:1px solid var(--border-light);padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Letrados</span>
        <button onclick="agregarLetradoForm(${id})" style="font-size:11px;background:none;border:1px solid var(--gold);color:var(--gold);border-radius:6px;padding:3px 10px;cursor:pointer">+ Letrado</button>
      </div>
      <div id="letrados-${id}" style="display:flex;flex-direction:column;gap:8px">
        ${(p.letrados||[]).map((l,li) => letradoHTML(id, li, l)).join('') || '<div style="font-size:12px;color:var(--muted)">Sin letrados cargados.</div>'}
      </div>
    </div>`;

  const existing = document.getElementById(`parte-item-${id}`);
  if (existing) existing.replaceWith(div);
  else list.appendChild(div);
  if (idx === null) window._partesExp.push(p);
}

export function agregarLetradoForm(parteIdx) {
  const cont = document.getElementById(`letrados-${parteIdx}`);
  if (!cont) return;
  cont.querySelectorAll('div[style*="color:var(--muted)"]').forEach(d => { if (d.textContent.includes('Sin letrados')) d.remove(); });
  const div = document.createElement('div');
  div.innerHTML = letradoHTML(parteIdx, cont.children.length);
  cont.appendChild(div.firstElementChild);
}

export function eliminarLetrado(parteIdx, letIdx) {
  document.getElementById(`letrado-${parteIdx}-${letIdx}`)?.remove();
}

export function eliminarParte(idx) {
  document.getElementById(`parte-item-${idx}`)?.remove();
  if (window._partesExp) window._partesExp[idx] = null;
  const list = document.getElementById('partes-list');
  if (list && !list.querySelector('[id^="parte-item-"]')) {
    const empty = document.getElementById('partes-empty');
    if (empty) empty.style.display = '';
  }
}

export function actualizarRolPropio(idx) {
  const rol      = document.getElementById(`parte-rol-${idx}`)?.value;
  const rolPropio = document.getElementById(`parte-rolpropio-${idx}`);
  if (!rolPropio) return;
  if (rol === 'actor' || rol === 'coactor' || rol === 'reconviniente') {
    if (rolPropio.value === 'contraparte') rolPropio.value = 'patrocinante';
  } else if (rol === 'demandado' || rol === 'codemandado' || rol === 'tercero') {
    rolPropio.value = 'contraparte';
  }
}

// ── Bridge global ─────────────────────────────────────────
window.letradoHTML        = letradoHTML;
window.agregarParteForm   = agregarParteForm;
window.agregarLetradoForm = agregarLetradoForm;
window.eliminarLetrado    = eliminarLetrado;
window.eliminarParte      = eliminarParte;
window.actualizarRolPropio = actualizarRolPropio;

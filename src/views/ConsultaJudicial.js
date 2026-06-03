/**
 * ConsultaJudicial.js
 * EANDRES SIL — Vista de Consulta Judicial Multi-Portal
 * 
 * Portales: PJN | SCBA JUBA | SCBA MEV | PJ CABA (EJE)
 * Integración: tribunalesClient (API Flask local o fallback directo)
 * 
 * Compatible con la arquitectura src/views/ de EANDRES SIL Vite.
 * Registrar en router como: { path: '/consulta-judicial', component: ConsultaJudicial }
 */

import { tribunalesClient, consultarExpediente } from '../services/tribunales-client.js';

// ─── Template HTML ─────────────────────────────────────────────────────────────

export const template = /* html */`
<div class="consulta-judicial-view">

  <!-- Header -->
  <div class="cj-header">
    <div class="cj-header-icon">⚖️</div>
    <div>
      <h2 class="cj-title">Consulta Judicial</h2>
      <p class="cj-subtitle">PJN · SCBA · PJ CABA</p>
    </div>
    <div class="cj-backend-badge" :class="backendStatus">
      <span class="cj-badge-dot"></span>
      {{ backendStatus === 'online' ? 'Backend online' : backendStatus === 'offline' ? 'Modo directo' : 'Verificando...' }}
    </div>
  </div>

  <!-- Formulario de consulta -->
  <div class="cj-form-card">

    <!-- Selector de portal -->
    <div class="cj-portal-tabs">
      <button
        v-for="p in portales"
        :key="p.id"
        class="cj-tab"
        :class="{ active: portalActivo === p.id }"
        @click="portalActivo = p.id"
      >
        {{ p.icono }} {{ p.nombre }}
      </button>
    </div>

    <!-- Formulario dinámico según portal -->
    <div class="cj-form-body">

      <!-- PJN / CABA / SCBA MEV — búsqueda por número -->
      <div v-if="portalActivo !== 'scba_juba'" class="cj-row">
        <div class="cj-field cj-field-lg">
          <label>Número de expediente</label>
          <input
            v-model="form.numero"
            placeholder="ej: 12345/2024 o 12345-2024"
            @keyup.enter="buscar"
            class="cj-input"
          />
        </div>
        <div class="cj-field">
          <label>Año</label>
          <input v-model="form.anio" placeholder="2024" maxlength="4" class="cj-input cj-input-sm" />
        </div>
      </div>

      <!-- Fuero (PJN / CABA) -->
      <div v-if="portalActivo === 'pjn' || portalActivo === 'caba'" class="cj-row">
        <div class="cj-field cj-field-lg">
          <label>Fuero</label>
          <select v-model="form.fuero" class="cj-select">
            <option value="">— Seleccionar fuero —</option>
            <optgroup v-if="portalActivo === 'pjn'" label="Fueros Nacionales (PJN)">
              <option value="cnt">CNAT — Cámara Nacional del Trabajo</option>
              <option value="civil">C. Civil Nacional</option>
              <option value="comercial">C. Comercial Nacional</option>
              <option value="csocial">C. Seguridad Social</option>
              <option value="penal federal">Penal Federal</option>
              <option value="csjn">CSJN</option>
            </optgroup>
            <optgroup v-if="portalActivo === 'caba'" label="Fueros CABA">
              <option value="trabajo caba">Fuero del Trabajo CABA</option>
              <option value="contencioso">Contencioso Administrativo y Tributario</option>
              <option value="civil">Civil CABA</option>
              <option value="penal">Penal, Contravencional y de Faltas</option>
            </optgroup>
          </select>
        </div>
      </div>

      <!-- SCBA JUBA — búsqueda por texto -->
      <div v-if="portalActivo === 'scba_juba'" class="cj-row">
        <div class="cj-field" style="flex:1">
          <label>Texto de búsqueda (jurisprudencia)</label>
          <input
            v-model="form.caratula"
            placeholder="ej: despido injustificado LCT artículo 245"
            @keyup.enter="buscar"
            class="cj-input"
          />
        </div>
      </div>

      <!-- Carátula (opcional para CABA) -->
      <div v-if="portalActivo === 'caba'" class="cj-row">
        <div class="cj-field" style="flex:1">
          <label>Carátula / Nombre de parte <span class="cj-optional">(opcional)</span></label>
          <input
            v-model="form.caratula"
            placeholder="ej: García Juan"
            class="cj-input"
          />
        </div>
      </div>

      <!-- Botón buscar -->
      <div class="cj-row cj-row-actions">
        <button class="cj-btn-primary" @click="buscar" :disabled="cargando">
          <span v-if="cargando" class="cj-spinner">⏳</span>
          <span v-else>🔍 Consultar</span>
        </button>
        <button class="cj-btn-ghost" @click="limpiar">Limpiar</button>
        <button
          v-if="portalActivo !== 'scba_juba'"
          class="cj-btn-ghost"
          @click="abrirPortalDirecto"
          title="Abrir portal en nueva pestaña"
        >🔗 Abrir portal</button>
      </div>

    </div>
  </div>

  <!-- Error -->
  <div v-if="error" class="cj-alert cj-alert-error">
    ⚠️ {{ error }}
  </div>

  <!-- Resultado -->
  <div v-if="resultado" class="cj-result-card">

    <div class="cj-result-header">
      <span class="cj-result-fuente">{{ resultado.fuente }}</span>
      <a v-if="resultado.url_portal" :href="resultado.url_portal" target="_blank" class="cj-link-portal">
        🔗 Abrir en portal
      </a>
    </div>

    <!-- Causa encontrada vía API -->
    <template v-if="resultado.exito && resultado.causa">
      <div class="cj-causa-grid">
        <div class="cj-causa-field" v-if="resultado.causa.caratula">
          <label>Carátula</label>
          <strong>{{ resultado.causa.caratula }}</strong>
        </div>
        <div class="cj-causa-field" v-if="resultado.causa.numero">
          <label>Expediente</label>
          <span>{{ resultado.causa.numero }}/{{ resultado.causa.anio }}</span>
        </div>
        <div class="cj-causa-field" v-if="resultado.causa.estado">
          <label>Estado</label>
          <span class="cj-badge-estado">{{ resultado.causa.estado }}</span>
        </div>
        <div class="cj-causa-field" v-if="resultado.causa.juzgado">
          <label>Juzgado</label>
          <span>{{ resultado.causa.juzgado }}</span>
        </div>
        <div class="cj-causa-field" v-if="resultado.causa.secretaria">
          <label>Secretaría</label>
          <span>{{ resultado.causa.secretaria }}</span>
        </div>
        <div class="cj-causa-field" v-if="resultado.causa.ultima_act">
          <label>Última actuación</label>
          <span>{{ resultado.causa.ultima_act }}</span>
        </div>
      </div>

      <!-- Movimientos -->
      <div v-if="resultado.movimientos && resultado.movimientos.length" class="cj-movimientos">
        <h4>Movimientos ({{ resultado.movimientos.length }})</h4>
        <div class="cj-movimiento" v-for="(m, i) in resultado.movimientos" :key="i">
          <span class="cj-mov-fecha">{{ m.fecha }}</span>
          <span class="cj-mov-tipo">{{ m.tipo }}</span>
          <span class="cj-mov-desc">{{ m.descripcion }}</span>
        </div>
      </div>
    </template>

    <!-- Lista de causas (búsqueda por carátula) -->
    <template v-else-if="resultado.exito && resultado.causas">
      <p class="cj-total">{{ resultado.total }} resultado(s) encontrado(s)</p>
      <div class="cj-causa-item" v-for="(c, i) in resultado.causas" :key="i">
        <strong>{{ c.caratula || c.numero }}</strong>
        <span>{{ c.estado }}</span>
        <span class="cj-gray">{{ c.juzgado }}</span>
      </div>
    </template>

    <!-- Fallback / modo directo -->
    <template v-else-if="!resultado.exito">
      <div class="cj-fallback">
        <p>{{ resultado.instruccion || resultado.error }}</p>
        <a v-if="resultado.url_portal" :href="resultado.url_portal" target="_blank" class="cj-btn-primary">
          Abrir portal →
        </a>
      </div>
    </template>

    <!-- Resultados JUBA (jurisprudencia) -->
    <template v-else-if="resultado.resultados">
      <p class="cj-total">{{ resultado.total }} resultado(s)</p>
      <div class="cj-juba-item" v-for="(r, i) in resultado.resultados" :key="i">
        <span>{{ r.texto || JSON.stringify(r) }}</span>
      </div>
    </template>

  </div>

  <!-- Accesos rápidos -->
  <div class="cj-accesos">
    <h4>Accesos directos</h4>
    <div class="cj-accesos-grid">
      <a href="https://scw.pjn.gov.ar/scw/home.seam" target="_blank" class="cj-acceso-btn cj-pjn">
        🏛 PJN — SCW
      </a>
      <a href="https://eje.juscaba.gob.ar/iol-ui/p/inicio" target="_blank" class="cj-acceso-btn cj-caba">
        🏙 PJ CABA — EJE
      </a>
      <a href="https://juba.scba.gov.ar" target="_blank" class="cj-acceso-btn cj-scba">
        📚 SCBA JUBA
      </a>
      <a href="https://mev.scba.gov.ar" target="_blank" class="cj-acceso-btn cj-scba">
        📋 SCBA MEV
      </a>
    </div>
  </div>

</div>
`;

// ─── CSS ───────────────────────────────────────────────────────────────────────

export const styles = /* css */`
.consulta-judicial-view {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 16px;
  font-family: 'Inter', sans-serif;
}
.cj-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.cj-header-icon { font-size: 2rem; }
.cj-title { margin: 0; color: var(--color-navy, #0F2244); font-size: 1.4rem; }
.cj-subtitle { margin: 2px 0 0; color: #666; font-size: .85rem; }
.cj-backend-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: .78rem;
  font-weight: 600;
}
.cj-backend-badge.online { background: #d1fae5; color: #065f46; }
.cj-backend-badge.offline { background: #fee2e2; color: #991b1b; }
.cj-backend-badge.checking { background: #fef9c3; color: #92400e; }
.cj-badge-dot { width:8px; height:8px; border-radius:50%; background: currentColor; }
.cj-form-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}
.cj-portal-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  background: var(--color-surface-2, #f8fafc);
}
.cj-tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: .82rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all .15s;
}
.cj-tab.active {
  color: var(--color-navy, #0F2244);
  border-bottom-color: var(--color-gold, #C9A84C);
  background: transparent;
}
.cj-form-body { padding: 16px 20px 20px; }
.cj-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.cj-field { display: flex; flex-direction: column; gap: 4px; }
.cj-field-lg { flex: 1; min-width: 200px; }
.cj-field label { font-size: .78rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: .4px; }
.cj-optional { font-weight: 400; color: #94a3b8; text-transform: none; }
.cj-input, .cj-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: .9rem;
  outline: none;
  transition: border .15s;
  background: var(--color-surface, #fff);
  color: var(--color-text, #1e293b);
}
.cj-input:focus, .cj-select:focus { border-color: var(--color-navy, #0F2244); }
.cj-input-sm { width: 80px; }
.cj-row-actions { align-items: center; gap: 8px; margin-top: 4px; }
.cj-btn-primary {
  padding: 9px 20px;
  background: var(--color-navy, #0F2244);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cj-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.cj-btn-ghost {
  padding: 9px 14px;
  background: transparent;
  color: #64748b;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: .85rem;
  cursor: pointer;
}
.cj-alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; font-size: .88rem; }
.cj-alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.cj-result-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.cj-result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.cj-result-fuente { font-size: .78rem; font-weight: 700; color: var(--color-gold, #C9A84C); text-transform: uppercase; letter-spacing: .5px; }
.cj-link-portal { font-size: .82rem; color: var(--color-cyan, #00B4D8); text-decoration: none; }
.cj-causa-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.cj-causa-field { display: flex; flex-direction: column; gap: 2px; }
.cj-causa-field label { font-size: .72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
.cj-badge-estado { display:inline-block; padding: 2px 8px; background: #e0f2fe; color: #075985; border-radius:4px; font-size:.82rem; }
.cj-movimientos { margin-top: 16px; border-top: 1px solid var(--color-border, #e2e8f0); padding-top: 12px; }
.cj-movimientos h4 { margin: 0 0 8px; font-size: .85rem; color: #475569; }
.cj-movimiento { display: grid; grid-template-columns: 100px 1fr 2fr; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: .83rem; }
.cj-mov-fecha { color: #64748b; }
.cj-mov-tipo { font-weight: 600; color: var(--color-navy, #0F2244); }
.cj-mov-desc { color: #475569; }
.cj-fallback { text-align: center; padding: 8px; }
.cj-fallback p { color: #64748b; margin-bottom: 12px; }
.cj-total { color: #64748b; font-size: .85rem; margin-bottom: 10px; }
.cj-causa-item { padding: 8px 0; border-bottom: 1px solid #f1f5f9; display: flex; gap: 12px; font-size: .85rem; }
.cj-gray { color: #94a3b8; }
.cj-juba-item { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: .85rem; color: #334155; }
.cj-accesos { margin-top: 20px; }
.cj-accesos h4 { margin: 0 0 10px; color: #64748b; font-size: .8rem; text-transform: uppercase; letter-spacing: .5px; }
.cj-accesos-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.cj-acceso-btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid transparent;
  transition: all .15s;
}
.cj-pjn  { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.cj-caba { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.cj-scba { background: #fdf4ff; color: #7e22ce; border-color: #e9d5ff; }
.cj-spinner { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── Componente Vue (Options API) ──────────────────────────────────────────────

export default {
  name: 'ConsultaJudicial',

  template,

  data() {
    return {
      portalActivo: 'pjn',
      backendStatus: 'checking',

      portales: [
        { id: 'pjn',       nombre: 'PJN',        icono: '🏛' },
        { id: 'caba',      nombre: 'CABA',        icono: '🏙' },
        { id: 'scba_mev',  nombre: 'SCBA — MEV',  icono: '📋' },
        { id: 'scba_juba', nombre: 'SCBA — JUBA', icono: '📚' },
      ],

      form: {
        numero:   '',
        anio:     new Date().getFullYear().toString(),
        fuero:    '',
        caratula: '',
      },

      cargando:  false,
      error:     null,
      resultado: null,
    };
  },

  async mounted() {
    // Verificar backend en background
    try {
      const resp = await fetch(`${import.meta?.env?.VITE_TRIBUNALES_API || 'http://localhost:5050'}/api/health`,
        { signal: AbortSignal.timeout(3000) });
      this.backendStatus = resp.ok ? 'online' : 'offline';
    } catch {
      this.backendStatus = 'offline';
    }
  },

  methods: {
    async buscar() {
      this.error = null;
      this.resultado = null;

      const { numero, anio, fuero, caratula } = this.form;

      if (this.portalActivo === 'scba_juba') {
        if (!caratula.trim()) { this.error = 'Ingresá un texto para buscar en JUBA'; return; }
      } else {
        if (!numero.trim() && !caratula.trim()) {
          this.error = 'Ingresá un número de expediente'; return;
        }
      }

      this.cargando = true;
      try {
        let res;
        if (this.portalActivo === 'scba_juba') {
          res = await tribunalesClient.buscarJurisprudenciaScba(caratula);
        } else if (this.portalActivo === 'caba') {
          res = await tribunalesClient.consultarCABA({ numero, anio, fuero, caratula: caratula || undefined });
        } else {
          // PJN o SCBA MEV
          const fueroEfectivo = fuero || (this.portalActivo === 'scba_mev' ? 'scba' : 'nacional');
          res = await tribunalesClient.consultar({ numero, anio, fuero: fueroEfectivo });
        }
        this.resultado = res;
      } catch (e) {
        this.error = `Error: ${e.message}`;
      } finally {
        this.cargando = false;
      }
    },

    abrirPortalDirecto() {
      const portalesURL = {
        pjn:      'https://scw.pjn.gov.ar/scw/home.seam',
        caba:     'https://eje.juscaba.gob.ar/iol-ui/p/inicio',
        scba_mev: 'https://mev.scba.gov.ar',
        scba_juba:'https://juba.scba.gov.ar',
      };
      window.open(portalesURL[this.portalActivo], '_blank', 'noopener');
    },

    limpiar() {
      this.form = { numero: '', anio: new Date().getFullYear().toString(), fuero: '', caratula: '' };
      this.resultado = null;
      this.error = null;
    },
  },
};

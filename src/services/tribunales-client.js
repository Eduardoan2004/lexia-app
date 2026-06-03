/**
 * tribunales-client.js
 * EANDRES SIL — Cliente de consulta judicial para los 3 portales
 * 
 * Uso:
 *   import { TribunalesClient } from './tribunales-client.js';
 *   const client = new TribunalesClient();
 *   const res = await client.consultar({ numero: '1234/2024', fuero: 'cnt' });
 */

// ─── Configuración ─────────────────────────────────────────────────────────────

const API_BASE_DEV  = 'http://localhost:5050/api';
const API_BASE_PROD = import.meta?.env?.VITE_TRIBUNALES_API || API_BASE_DEV;

const API_BASE = import.meta?.env?.MODE === 'production' ? API_BASE_PROD : API_BASE_DEV;

// ─── Mapa de portales directos (fallback sin backend) ─────────────────────────

const PORTALES_DIRECTOS = {
  pjn: {
    nombre: 'PJN — Poder Judicial de la Nación',
    url:    'https://scw.pjn.gov.ar/scw/home.seam',
    fueros: ['cnt', 'cnat', 'civil', 'comercial', 'penal', 'csjn', 'nacional'],
  },
  caba: {
    nombre: 'PJ CABA — EJE',
    url:    'https://eje.juscaba.gob.ar/iol-ui/p/inicio',
    fueros: ['trabajo caba', 'contencioso', 'caba', 'cayt', 'pcf'],
  },
  scba: {
    nombre: 'SCBA',
    url:    'https://mev.scba.gov.ar',
    url_juba: 'https://juba.scba.gov.ar',
    fueros: ['provincia', 'pba', 'scba', 'la plata', 'provincial'],
  },
};

// ─── TribunalesClient ─────────────────────────────────────────────────────────

export class TribunalesClient {
  constructor(apiBase = API_BASE) {
    this.apiBase = apiBase;
    this._backendDisponible = null; // null = no testeado aún
  }

  /**
   * Consulta unificada — detecta portal por fuero.
   * @param {Object} params
   * @param {string} params.numero   — número de expediente (ej: "1234/2024")
   * @param {string} [params.fuero]  — fuero ("cnt", "caba", "scba", etc.)
   * @param {string} [params.anio]   — año
   * @param {string} [params.caratula] — búsqueda por carátula
   * @returns {Promise<Object>}
   */
  async consultar(params) {
    const backendOk = await this._checkBackend();

    if (backendOk) {
      try {
        return await this._post('/unified/consultar', params);
      } catch (e) {
        console.warn('[Tribunales] Backend falló, usando fallback directo:', e.message);
      }
    }

    return this._fallbackDirecto(params);
  }

  /**
   * Consulta específica CABA.
   */
  async consultarCABA(params) {
    const backendOk = await this._checkBackend();
    if (backendOk) {
      try {
        if (params.caratula) {
          return await this._post('/caba/caratula', params);
        }
        return await this._post('/caba/consultar', params);
      } catch (e) {
        console.warn('[Tribunales] CABA backend error:', e.message);
      }
    }
    return this._fallbackDirecto({ ...params, fuero: 'caba' });
  }

  /**
   * Consulta específica SCBA JUBA (jurisprudencia).
   */
  async buscarJurisprudenciaScba(texto) {
    const backendOk = await this._checkBackend();
    if (backendOk) {
      try {
        return await this._post('/scba/juba/buscar', { texto });
      } catch (e) {
        console.warn('[Tribunales] JUBA backend error:', e.message);
      }
    }
    return {
      ok:          false,
      fuente:      'SCBA JUBA',
      url_portal:  PORTALES_DIRECTOS.scba.url_juba,
      instruccion: `Buscá "${texto}" en ${PORTALES_DIRECTOS.scba.url_juba}`,
    };
  }

  /**
   * Abre el portal directamente en una nueva pestaña.
   */
  abrirPortal(fuero, numero, anio) {
    const portal = this._detectarPortal(fuero);
    let url = PORTALES_DIRECTOS[portal]?.url || PORTALES_DIRECTOS.pjn.url;

    if (portal === 'caba' && numero) {
      url = `https://eje.juscaba.gob.ar/iol-ui/p/inicio?nro=${encodeURIComponent(numero)}&anio=${anio || ''}`;
    }
    window.open(url, '_blank', 'noopener');
    return url;
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  async _checkBackend() {
    if (this._backendDisponible !== null) return this._backendDisponible;
    try {
      const resp = await fetch(`${this.apiBase}/health`, { signal: AbortSignal.timeout(3000) });
      this._backendDisponible = resp.ok;
    } catch {
      this._backendDisponible = false;
    }
    return this._backendDisponible;
  }

  async _post(endpoint, body) {
    const resp = await fetch(`${this.apiBase}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  _detectarPortal(fuero = '') {
    const f = fuero.toLowerCase();
    for (const [key, data] of Object.entries(PORTALES_DIRECTOS)) {
      if (data.fueros.some(fc => f.includes(fc))) return key;
    }
    return 'pjn'; // default
  }

  _fallbackDirecto(params) {
    const portal  = this._detectarPortal(params.fuero || '');
    const info    = PORTALES_DIRECTOS[portal];
    const numero  = params.numero || params.caratula || '';

    return {
      ok:              false,
      exito:           false,
      fuente:          `${info.nombre} — fallback directo`,
      portal_detectado: portal,
      url_portal:      info.url,
      instruccion:     `Backend no disponible. Consultá manualmente en ${info.url}`,
      numero,
    };
  }
}

// ─── Instancia global para uso directo en componentes ─────────────────────────

export const tribunalesClient = new TribunalesClient();

// ─── Helpers para uso en views existentes ─────────────────────────────────────

/**
 * Consulta rápida — para usar desde cualquier view de EANDRES SIL.
 * 
 * @example
 *   import { consultarExpediente } from '@/services/tribunales-client.js';
 *   const res = await consultarExpediente('12345/2024', 'cnt');
 *   if (res.url_portal) window.open(res.url_portal, '_blank');
 */
export async function consultarExpediente(numero, fuero, anio) {
  return tribunalesClient.consultar({ numero, fuero, anio });
}

/**
 * Abre directamente el portal correcto según el fuero.
 */
export function abrirPortalJudicial(fuero, numero, anio) {
  return tribunalesClient.abrirPortal(fuero, numero, anio);
}

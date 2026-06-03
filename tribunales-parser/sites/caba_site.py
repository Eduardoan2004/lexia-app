"""
Parser para el Poder Judicial de la Ciudad Autónoma de Buenos Aires
Portal: https://eje.juscaba.gob.ar

Fueros disponibles:
  - Fuero del Trabajo (CABA)
  - Contencioso Administrativo y Tributario (CAyT)
  - Civil (PCyF)
  - Penal, Contravencional y de Faltas (PCF)

API pública: EJE (Expediente Judicial Electrónico CABA)
Endpoint principal: https://eje.juscaba.gob.ar/iol-ui/  (frontend Angular)
API REST subyacente: https://eje.juscaba.gob.ar/iop-api/  (no documentada, pero accesible)
"""

import re
import logging
from typing import Dict, Any, List, Optional
from .base_site import BaseSite

logger = logging.getLogger(__name__)

# ─── Constantes ──────────────────────────────────────────────────────────────

BASE_EJE        = "https://eje.juscaba.gob.ar"
API_EJE         = f"{BASE_EJE}/iop-api"
PORTAL_EJE_UI   = f"{BASE_EJE}/iol-ui/p/inicio"

# Fueros CABA y sus códigos internos
FUEROS_CABA = {
    "trabajo":          {"codigo": "T",  "nombre": "Fuero del Trabajo",                          "ui": "laboral"},
    "contencioso":      {"codigo": "CA", "nombre": "Contencioso Administrativo y Tributario",    "ui": "contencioso-administrativo"},
    "civil":            {"codigo": "C",  "nombre": "Civil",                                       "ui": "civil"},
    "penal":            {"codigo": "P",  "nombre": "Penal, Contravencional y de Faltas",          "ui": "penal"},
    "menores":          {"codigo": "M",  "nombre": "Protección de Personas",                      "ui": "menores"},
}

# ─── Site ─────────────────────────────────────────────────────────────────────

class CabaSite(BaseSite):
    """
    Acceso a causas del PJ CABA (EJE).
    
    Estrategia de búsqueda (en orden de intento):
      1. API REST iop-api  → búsqueda por número/carátula (sin auth para consulta pública)
      2. Fallback: URL directa al portal EJE para apertura manual en browser
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.session.headers.update({
            "Referer": PORTAL_EJE_UI,
            "Origin":  BASE_EJE,
            "Accept":  "application/json, text/plain, */*",
        })

    # ── Búsqueda por número de expediente ─────────────────────────────────────

    def buscar_por_numero(
        self,
        numero: str,
        anio: Optional[str] = None,
        fuero: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Busca una causa por número (y año opcional) en el portal EJE CABA.
        
        Parámetros
        ----------
        numero : str  — número de expediente (ej: "1234", "1234/2024", "EXP 1234/2024")
        anio   : str  — año opcional si no viene en número
        fuero  : str  — clave del dict FUEROS_CABA, ej: "trabajo", "contencioso"
        
        Retorna
        -------
        dict con claves: exito, fuente, caratula, estado, movimientos, url, error
        """
        num_limpio, anio_limpio = self._parse_numero(numero, anio)

        # Intento 1: API REST pública de EJE
        resultado = self._buscar_api_eje(num_limpio, anio_limpio, fuero)
        if resultado.get("exito"):
            return resultado

        # Intento 2: Búsqueda por parámetros URL (portal angular)
        resultado = self._buscar_url_eje(num_limpio, anio_limpio, fuero)
        if resultado.get("exito"):
            return resultado

        # Fallback informativo
        return self._fallback_manual(num_limpio, anio_limpio, fuero, resultado.get("error"))

    # ── Búsqueda por carátula / parte ─────────────────────────────────────────

    def buscar_por_caratula(
        self,
        caratula: str,
        fuero: Optional[str] = None,
        max_resultados: int = 20,
    ) -> Dict[str, Any]:
        """
        Búsqueda por texto de carátula (actor o demandado).
        
        Usa el endpoint de búsqueda libre del EJE.
        """
        try:
            endpoint = f"{API_EJE}/causas/buscar"
            params = {
                "caratula": caratula,
                "pageSize": max_resultados,
                "pageNumber": 0,
            }
            if fuero:
                fuero_data = FUEROS_CABA.get(fuero.lower())
                if fuero_data:
                    params["fuero"] = fuero_data["codigo"]

            resp = self._get(endpoint, params=params)
            data = resp.json()

            causas = data.get("content") or data.get("causas") or data.get("results") or []
            if isinstance(causas, list) and causas:
                return {
                    "exito":       True,
                    "fuente":      "EJE CABA — API",
                    "total":       data.get("totalElements", len(causas)),
                    "causas":      [self._normalizar_causa(c) for c in causas],
                    "url_portal":  PORTAL_EJE_UI,
                }
        except Exception as e:
            logger.debug(f"buscar_por_caratula API error: {e}")

        # Fallback: URL del portal con query param
        url_busqueda = f"{PORTAL_EJE_UI}?busqueda={caratula}"
        return {
            "exito":        False,
            "fuente":       "EJE CABA — fallback manual",
            "url_portal":   url_busqueda,
            "instruccion":  "Abrí el portal en el navegador y buscá por carátula",
            "error":        "No fue posible obtener resultados vía API; usá el portal directamente",
        }

    # ── Helpers internos ──────────────────────────────────────────────────────

    def _parse_numero(self, numero: str, anio: Optional[str]) -> tuple:
        """Extrae número y año de distintos formatos: '1234/2024', 'EXP-1234-2024', etc."""
        numero = numero.strip().upper()
        # Eliminar prefijos típicos: EXP, INC, CUA
        numero = re.sub(r'^(EXP|INC|CUA|NRO|N°|N)\s*[-/]?\s*', '', numero)

        match = re.search(r'(\d+)\s*[-/]\s*(\d{4})', numero)
        if match:
            return match.group(1), match.group(2)

        num_solo = re.sub(r'\D', '', numero)
        return num_solo, (anio or str(__import__('datetime').date.today().year))

    def _buscar_api_eje(self, numero: str, anio: str, fuero: Optional[str]) -> Dict[str, Any]:
        """Consulta la API REST subyacente del EJE."""
        endpoints_a_probar = [
            f"{API_EJE}/causas/{numero}/{anio}",
            f"{API_EJE}/causas/numero/{numero}/anio/{anio}",
            f"{API_EJE}/expediente/{numero}-{anio}",
        ]
        for endpoint in endpoints_a_probar:
            try:
                resp = self._get(endpoint)
                data = resp.json()
                if data and (data.get("caratula") or data.get("id") or data.get("numero")):
                    causa = self._normalizar_causa(data)
                    return {
                        "exito":       True,
                        "fuente":      "EJE CABA — API REST",
                        "causa":       causa,
                        "url_portal":  self._url_portal(numero, anio, fuero),
                        "movimientos": self._obtener_movimientos(data.get("id") or data.get("idCausa")),
                    }
            except Exception as e:
                logger.debug(f"API EJE endpoint {endpoint}: {e}")
        return {"exito": False}

    def _buscar_url_eje(self, numero: str, anio: str, fuero: Optional[str]) -> Dict[str, Any]:
        """Intenta acceder al portal EJE buscando en el HTML renderizado."""
        try:
            # El portal es Angular SPA — el HTML estático no tiene datos,
            # pero podemos devolver la URL con parámetros útiles
            url = self._url_portal(numero, anio, fuero)
            # Hacer GET para verificar que el dominio responde (no el contenido Angular)
            resp = self._get(BASE_EJE, timeout=8)
            if resp.status_code == 200:
                return {
                    "exito":        True,
                    "fuente":       "EJE CABA — portal (apertura manual)",
                    "url_portal":   url,
                    "nota":         "El portal es una SPA Angular. Abrí la URL en el navegador.",
                    "causa": {
                        "numero":   numero,
                        "anio":     anio,
                        "caratula": None,
                        "estado":   None,
                    }
                }
        except Exception as e:
            logger.debug(f"URL EJE: {e}")
        return {"exito": False, "error": "Portal EJE no disponible"}

    def _url_portal(self, numero: str, anio: str, fuero: Optional[str]) -> str:
        """Construye la URL de consulta en el portal EJE CABA."""
        fuero_ui = ""
        if fuero:
            fuero_data = FUEROS_CABA.get(fuero.lower())
            if fuero_data:
                fuero_ui = f"/{fuero_data['ui']}"
        return f"{PORTAL_EJE_UI}{fuero_ui}?nro={numero}&anio={anio}"

    def _obtener_movimientos(self, id_causa: Optional[str]) -> List[Dict[str, str]]:
        """Obtiene movimientos/actuaciones de una causa por su ID interno."""
        if not id_causa:
            return []
        try:
            endpoints = [
                f"{API_EJE}/causas/{id_causa}/movimientos",
                f"{API_EJE}/causas/{id_causa}/actuaciones",
            ]
            for ep in endpoints:
                resp = self._get(ep)
                data = resp.json()
                items = data if isinstance(data, list) else data.get("content", [])
                if items:
                    return [self._normalizar_movimiento(m) for m in items[:50]]
        except Exception as e:
            logger.debug(f"Movimientos causa {id_causa}: {e}")
        return []

    def _normalizar_causa(self, data: Dict) -> Dict[str, Any]:
        """Normaliza los campos de una causa al formato estándar EANDRES."""
        # EJE puede devolver distintos campos según versión de API
        return {
            "id":            data.get("id") or data.get("idCausa") or "",
            "numero":        data.get("numero") or data.get("nroCausa") or "",
            "anio":          data.get("anio") or data.get("ejercicio") or "",
            "caratula":      data.get("caratula") or data.get("denominacion") or "",
            "estado":        data.get("estado") or data.get("estadoCausa") or "",
            "fuero":         data.get("fuero") or data.get("organismo") or "",
            "juzgado":       data.get("juzgado") or data.get("organoJudicial") or "",
            "secretaria":    data.get("secretaria") or "",
            "fecha_inicio":  data.get("fechaInicio") or data.get("fecha") or "",
            "ultima_act":    data.get("ultimaActuacion") or data.get("fechaUltimoMov") or "",
        }

    def _normalizar_movimiento(self, m: Dict) -> Dict[str, str]:
        return {
            "fecha":       m.get("fecha") or m.get("fechaActuacion") or "",
            "tipo":        m.get("tipo") or m.get("tipoActuacion") or m.get("descripcion") or "",
            "descripcion": m.get("descripcion") or m.get("detalle") or "",
            "folio":       m.get("folio") or m.get("nroFolio") or "",
        }

    def _fallback_manual(self, numero: str, anio: str,
                          fuero: Optional[str], error: Optional[str]) -> Dict[str, Any]:
        url = self._url_portal(numero, anio, fuero)
        return {
            "exito":       False,
            "fuente":      "EJE CABA — fallback",
            "url_portal":  url,
            "instruccion": f"Abrí este link en el navegador: {url}",
            "error":       error or "No se pudo obtener datos vía API",
        }

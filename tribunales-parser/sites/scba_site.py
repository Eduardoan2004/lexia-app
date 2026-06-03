"""
Parser para la Suprema Corte de Justicia de la Provincia de Buenos Aires
Portales:
  - JUBA: https://juba.scba.gov.ar  (jurisprudencia, resoluciones)
  - MEV:  https://mev.scba.gov.ar   (causas activas - requiere credenciales abogado)
"""

import re
import logging
from typing import Dict, Any, List, Optional
from .base_site import BaseSite

logger = logging.getLogger(__name__)

BASE_JUBA  = "https://juba.scba.gov.ar"
BASE_MEV   = "https://mev.scba.gov.ar"
API_MEV    = f"{BASE_MEV}/api"


class JubaSCBASite(BaseSite):
    """
    Búsqueda en JUBA — jurisprudencia de la SCBA.
    Acceso público, sin autenticación.
    """

    SEARCH_URL = f"{BASE_JUBA}/Busqueda.aspx"

    def buscar_jurisprudencia(
        self,
        texto: str,
        max_resultados: int = 20,
    ) -> Dict[str, Any]:
        """Busca fallos y resoluciones en JUBA por texto libre."""
        try:
            # Primer GET para obtener ViewState y cookies ASP.NET
            resp_inicial = self._get(self.SEARCH_URL)
            soup = self._soup(resp_inicial.text)

            viewstate  = self._get_input(soup, "__VIEWSTATE")
            eventval   = self._get_input(soup, "__EVENTVALIDATION")
            viewstategenerator = self._get_input(soup, "__VIEWSTATEGENERATOR")

            payload = {
                "__VIEWSTATE":          viewstate,
                "__EVENTVALIDATION":    eventval,
                "__VIEWSTATEGENERATOR": viewstategenerator,
                "__EVENTTARGET":        "",
                "__EVENTARGUMENT":      "",
                "ctl00$MainContent$txtBusqueda": texto,
                "ctl00$MainContent$btnBuscar":  "Buscar",
            }

            resp = self._post(self.SEARCH_URL, data=payload)
            soup2 = self._soup(resp.text)

            # Extraer resultados
            resultados = []
            tabla = soup2.find("table", {"id": re.compile(r"grid|Grid|resultado|Resultado", re.I)})
            if tabla:
                resultados = self._tabla_a_lista(tabla)
            else:
                # Buscar divs/li con resultados
                items = soup2.find_all("div", class_=re.compile(r"result|fallo|causa", re.I))
                for item in items[:max_resultados]:
                    resultados.append({"texto": self._texto(item)})

            return {
                "exito":      True,
                "fuente":     "SCBA JUBA",
                "total":      len(resultados),
                "resultados": resultados[:max_resultados],
                "url":        self.SEARCH_URL,
            }

        except Exception as e:
            logger.error(f"JUBA buscar_jurisprudencia: {e}")
            return {
                "exito":  False,
                "fuente": "SCBA JUBA",
                "error":  str(e),
                "url":    self.SEARCH_URL,
            }

    def _get_input(self, soup, name: str) -> str:
        tag = soup.find("input", {"name": name})
        return tag.get("value", "") if tag else ""


class MevSCBASite(BaseSite):
    """
    Consulta de causas activas en MEV (Mesa de Entradas Virtual) SCBA.
    Requiere credenciales de abogado matriculado en PBA.
    """

    LOGIN_URL  = f"{BASE_MEV}/Account/Login"
    CAUSAS_URL = f"{API_MEV}/causas"

    def __init__(self, usuario: Optional[str] = None, password: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.usuario  = usuario
        self.password = password
        self._autenticado = False

    def autenticar(self) -> bool:
        """Realiza login en MEV SCBA."""
        if not self.usuario or not self.password:
            logger.warning("MEV SCBA: credenciales no configuradas")
            return False
        try:
            resp_login = self._get(self.LOGIN_URL)
            soup = self._soup(resp_login.text)
            token = self._get_input_by_name(soup, "__RequestVerificationToken")

            payload = {
                "Username":                  self.usuario,
                "Password":                  self.password,
                "__RequestVerificationToken": token,
            }
            resp = self._post(self.LOGIN_URL, data=payload)
            self._autenticado = "logout" in resp.url.lower() or resp.status_code == 200
            return self._autenticado
        except Exception as e:
            logger.error(f"MEV login error: {e}")
            return False

    def buscar_causa(self, numero: str, anio: Optional[str] = None) -> Dict[str, Any]:
        """Busca una causa activa en MEV por número."""
        if not self._autenticado and not self.autenticar():
            return {
                "exito":  False,
                "fuente": "SCBA MEV",
                "error":  "Autenticación requerida. Configure usuario/contraseña MEV.",
                "url":    self.LOGIN_URL,
            }
        try:
            num, yr = self._parse_numero_mev(numero, anio)
            params = {"numero": num, "anio": yr}
            resp = self._get(self.CAUSAS_URL, params=params)
            data = resp.json()

            if data:
                return {
                    "exito":  True,
                    "fuente": "SCBA MEV",
                    "causa":  data if isinstance(data, dict) else data[0],
                    "url":    f"{BASE_MEV}/causas/{num}/{yr}",
                }
        except Exception as e:
            logger.error(f"MEV buscar_causa: {e}")

        return {
            "exito":  False,
            "fuente": "SCBA MEV",
            "error":  "Causa no encontrada",
            "url":    BASE_MEV,
        }

    def _parse_numero_mev(self, numero: str, anio: Optional[str]) -> tuple:
        match = re.search(r'(\d+)\s*[-/]\s*(\d{4})', numero)
        if match:
            return match.group(1), match.group(2)
        num_solo = re.sub(r'\D', '', numero)
        return num_solo, anio or str(__import__('datetime').date.today().year)

    def _get_input_by_name(self, soup, name: str) -> str:
        tag = soup.find("input", {"name": name})
        return tag.get("value", "") if tag else ""

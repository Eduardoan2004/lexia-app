"""
Base class para todos los parsers de tribunales argentinos.
Patrón: requests session + BeautifulSoup + retry logic.
"""

import requests
from bs4 import BeautifulSoup
import time
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class BaseSite:
    """Clase base con session compartida, retry y helpers HTML."""

    DEFAULT_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "es-AR,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    def __init__(self, timeout: int = 20, max_retries: int = 3):
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update(self.DEFAULT_HEADERS)

    def _get(self, url: str, params: Optional[Dict] = None, **kwargs) -> requests.Response:
        for attempt in range(self.max_retries):
            try:
                resp = self.session.get(url, params=params, timeout=self.timeout, **kwargs)
                resp.raise_for_status()
                return resp
            except requests.RequestException as e:
                logger.warning(f"GET {url} intento {attempt+1}/{self.max_retries}: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"No se pudo conectar a {url} tras {self.max_retries} intentos")

    def _post(self, url: str, data: Optional[Dict] = None,
              json: Optional[Dict] = None, **kwargs) -> requests.Response:
        for attempt in range(self.max_retries):
            try:
                resp = self.session.post(
                    url, data=data, json=json, timeout=self.timeout, **kwargs
                )
                resp.raise_for_status()
                return resp
            except requests.RequestException as e:
                logger.warning(f"POST {url} intento {attempt+1}/{self.max_retries}: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"No se pudo conectar a {url} tras {self.max_retries} intentos")

    def _soup(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "html.parser")

    def _texto(self, tag) -> str:
        return tag.get_text(strip=True) if tag else ""

    def _tabla_a_lista(self, tabla) -> List[Dict[str, str]]:
        """Convierte <table> HTML a lista de dicts usando la primera fila como headers."""
        if not tabla:
            return []
        headers = [self._texto(th) for th in tabla.find_all("th")]
        rows = []
        for tr in tabla.find_all("tr")[1:]:
            celdas = tr.find_all(["td", "th"])
            if not celdas:
                continue
            fila = {}
            for i, celda in enumerate(celdas):
                key = headers[i] if i < len(headers) else f"col_{i}"
                fila[key] = self._texto(celda)
            if any(fila.values()):
                rows.append(fila)
        return rows

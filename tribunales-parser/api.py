"""
API Flask — Parser Tribunales Argentinos
EANDRES SIL — Backend de consulta judicial

Endpoints:
  GET  /api/health                    — health check
  GET  /api/portales                  — lista portales disponibles
  POST /api/pjn/consultar             — PJN (CNAT, C.Civil, C.Comercial, etc.)
  POST /api/scba/juba/buscar          — SCBA JUBA (jurisprudencia)
  POST /api/scba/mev/consultar        — SCBA MEV (causas activas, requiere credenciales)
  POST /api/caba/consultar            — PJ CABA EJE (Trabajo, CAyT, Civil, Penal)
  POST /api/caba/caratula             — PJ CABA — búsqueda por carátula
  POST /api/unified/consultar         — consulta todos los portales según fuero
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from sites.caba_site import CabaSite, FUEROS_CABA
from sites.scba_site import JubaSCBASite, MevSCBASite

# ─── Configuración ────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS para Vite dev (localhost:5173) y Netlify (eandres-sil.netlify.app)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://eandres-sil.netlify.app",
            "https://*.netlify.app",
        ]
    }
})

# ─── Instancias de sitios (singleton) ─────────────────────────────────────────

_caba   = CabaSite()
_juba   = JubaSCBASite()
_mev    = MevSCBASite(
    usuario  = os.getenv("MEV_USUARIO"),
    password = os.getenv("MEV_PASSWORD"),
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _body() -> dict:
    return request.get_json(silent=True) or {}

def _ok(data: dict) -> tuple:
    return jsonify({"ok": True,  **data}), 200

def _err(msg: str, code: int = 400) -> tuple:
    return jsonify({"ok": False, "error": msg}), code

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return _ok({"status": "online", "version": "1.0.0", "portales": ["PJN", "SCBA", "CABA"]})


@app.get("/api/portales")
def portales():
    return _ok({
        "portales": [
            {
                "id":      "pjn",
                "nombre":  "PJN — Poder Judicial de la Nación",
                "fueros":  ["CNAT", "Civil", "Comercial", "CSocial", "Penal Federal", "CSJN"],
                "url":     "https://scw.pjn.gov.ar",
                "estado":  "activo",
            },
            {
                "id":      "scba_juba",
                "nombre":  "SCBA JUBA — Jurisprudencia Provincia BsAs",
                "fueros":  ["Todos (jurisprudencia)"],
                "url":     "https://juba.scba.gov.ar",
                "estado":  "activo",
            },
            {
                "id":      "scba_mev",
                "nombre":  "SCBA MEV — Causas activas Provincia BsAs",
                "fueros":  ["Todos (causas activas)"],
                "url":     "https://mev.scba.gov.ar",
                "estado":  "requiere_credenciales",
            },
            {
                "id":      "caba",
                "nombre":  "PJ CABA — EJE (Poder Judicial CABA)",
                "fueros":  list(FUEROS_CABA.keys()),
                "url":     "https://eje.juscaba.gob.ar",
                "estado":  "activo",
            },
        ]
    })


# ── PJN ──────────────────────────────────────────────────────────────────────

@app.post("/api/pjn/consultar")
def pjn_consultar():
    """
    Proxy al portal PJN — abre URL directa.
    El parser PJN (Selenium) corre aparte; aquí devolvemos la URL correcta según fuero.
    """
    b = _body()
    numero  = b.get("numero", "").strip()
    fuero   = b.get("fuero", "").lower()
    juzgado = b.get("juzgado", "")

    if not numero:
        return _err("Se requiere 'numero'")

    # Construir URL PJN según fuero
    url_base = "https://scw.pjn.gov.ar/scw/home.seam"
    info = {
        "portal":      "PJN",
        "numero":      numero,
        "fuero":       fuero,
        "url_portal":  url_base,
        "instruccion": f"Consultá expediente {numero} en {url_base}",
        "nota":        "El PJN requiere navegador (CAPTCHA en algunos fueros). Para automatización completa usá el módulo Selenium del backend.",
    }
    return _ok(info)


# ── SCBA ─────────────────────────────────────────────────────────────────────

@app.post("/api/scba/juba/buscar")
def scba_juba_buscar():
    b = _body()
    texto = b.get("texto", "").strip()
    if not texto:
        return _err("Se requiere 'texto' para búsqueda en JUBA")
    resultado = _juba.buscar_jurisprudencia(texto, max_resultados=b.get("max", 20))
    return _ok(resultado)


@app.post("/api/scba/mev/consultar")
def scba_mev_consultar():
    b = _body()
    numero = b.get("numero", "").strip()
    if not numero:
        return _err("Se requiere 'numero'")
    resultado = _mev.buscar_causa(numero, anio=b.get("anio"))
    return _ok(resultado)


# ── CABA ─────────────────────────────────────────────────────────────────────

@app.post("/api/caba/consultar")
def caba_consultar():
    """Consulta causa en PJ CABA por número de expediente."""
    b = _body()
    numero = b.get("numero", "").strip()
    if not numero:
        return _err("Se requiere 'numero'")

    resultado = _caba.buscar_por_numero(
        numero = numero,
        anio   = b.get("anio"),
        fuero  = b.get("fuero"),
    )
    return _ok(resultado)


@app.post("/api/caba/caratula")
def caba_caratula():
    """Busca causas CABA por carátula / nombre de parte."""
    b = _body()
    caratula = b.get("caratula", "").strip()
    if not caratula:
        return _err("Se requiere 'caratula'")

    resultado = _caba.buscar_por_caratula(
        caratula       = caratula,
        fuero          = b.get("fuero"),
        max_resultados = b.get("max", 20),
    )
    return _ok(resultado)


# ── UNIFIED ───────────────────────────────────────────────────────────────────

@app.post("/api/unified/consultar")
def unified_consultar():
    """
    Consulta inteligente: detecta el portal correcto según fuero informado.
    Body: { numero, fuero, anio?, juzgado?, caratula? }
    """
    b = _body()
    numero  = b.get("numero", "").strip()
    fuero   = (b.get("fuero") or "").lower()
    caratula = b.get("caratula", "").strip()

    if not numero and not caratula:
        return _err("Se requiere al menos 'numero' o 'caratula'")

    # Detección de portal por fuero
    fueros_caba = {"trabajo caba", "contencioso", "caba", "jusbaires", "pcf", "cat", "cayt"}
    fueros_scba = {"provincia", "pba", "scba", "la plata", "provincial"}
    fueros_pjn  = {"cnt", "cnat", "laboral nacional", "civil nacional",
                   "comercial", "penal federal", "csjn", "nacional"}

    portal_detectado = "pjn"  # default

    if any(f in fuero for f in fueros_caba):
        portal_detectado = "caba"
    elif any(f in fuero for f in fueros_scba):
        portal_detectado = "scba"
    elif any(f in fuero for f in fueros_pjn):
        portal_detectado = "pjn"

    # Ejecutar consulta en portal detectado
    if portal_detectado == "caba":
        if numero:
            resultado = _caba.buscar_por_numero(numero, anio=b.get("anio"), fuero=b.get("fuero"))
        else:
            resultado = _caba.buscar_por_caratula(caratula, fuero=b.get("fuero"))
        resultado["portal_usado"] = "PJ CABA"
    elif portal_detectado == "scba":
        if numero:
            resultado = _mev.buscar_causa(numero, anio=b.get("anio"))
        else:
            resultado = _juba.buscar_jurisprudencia(caratula)
        resultado["portal_usado"] = "SCBA"
    else:  # pjn
        url_base = "https://scw.pjn.gov.ar/scw/home.seam"
        resultado = {
            "exito":       True,
            "fuente":      "PJN",
            "url_portal":  url_base,
            "instruccion": f"Consultá {numero or caratula} en {url_base}",
            "portal_usado": "PJN",
        }

    resultado["fuero_informado"]    = fuero
    resultado["portal_detectado"]   = portal_detectado
    return _ok(resultado)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    logger.info(f"Iniciando API Tribunales en puerto {port}")
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")

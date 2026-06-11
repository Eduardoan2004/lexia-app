# Skill: Normativa Laboral Argentina — Análisis y Briefing

## Propósito

Guía al modelo para analizar normativa laboral argentina (leyes, decretos, resoluciones) desde la perspectiva del empleador, produciendo briefings accionables con impacto operativo, checklist de cumplimiento y jurisprudencia aplicable.

---

## Cuándo aplicar este skill

- El input es un decreto, resolución, ley o disposición de materia laboral/previsional
- Se solicita análisis de impacto sobre empresa cliente (Apparel, Servisan, Franchin, Sheraton/ACP)
- Se genera un informe desde el Módulo Normativa de EANDRES SIL
- Se requiere checklist de cumplimiento LCT / CCT / LRT
- Se evalúa constitucionalidad o aplicabilidad de una norma

---

## Marco normativo de referencia

### Leyes base
- **LCT** (Ley 20.744 y mod.) — contrato de trabajo, jornada, remuneración, extinción
- **LRT** (Ley 24.557 y mod.) — accidentes, ART, incapacidades
- **Ley 27.802** — MiPyMEs, cuotas Art. 56, constitucionalidad (*Ferrero* Sala II CNAT 15/03/2026; *Oliva* Fallos 347:100; *Lacuadra* ago/2024)
- **Ley 24.013** — empleo, registración, multas Arts. 8/9/10/15
- **Ley 25.323** — duplicación indemnizatoria Arts. 1 y 2
- **Ley 26.727** — trabajo agrario (referencia)
- **CCyC** (Ley 26.994) — Arts. 730, 1775 (prejudicialidad penal), responsabilidad civil

### CCTs relevantes por cliente
- **CCT 526/08** (FEDELARA) — lavandería industrial → Apparel Argentina S.A.
- **CCT sanidad** → Sanatorio Franchin
- **CCT hotelería/gastronomía** → Argentina Commercial Properties (Sheraton)
- **CCT limpieza/maestranza** → Servisan Argentina S.R.L.

### Organismos reguladores
- **MTEYSS / SEPYME** — homologaciones, registros MiPyME
- **APrA** (ex-APRA CABA) — ambiental CABA
- **OPDS** (Provincia de Buenos Aires) — ambiental PBA
- **ACUMAR** — cuenca Matanza-Riachuelo
- **SRT** — superintendencia riesgos del trabajo
- **AFIP/ARCA** — aportes y contribuciones

---

## Estructura del análisis

### 1. Identificación de la norma
```
Tipo: [Ley / Decreto PEN / Resolución MTEYSS / Disposición]
Número: 
Fecha B.O.: 
Vigencia: 
Sector/s afectado/s: [laboral / previsional / ambiental / sanitario / fiscal]
```

### 2. Síntesis ejecutiva (3-5 líneas)
Qué cambia, para quién, desde cuándo. Sin jerga innecesaria. Orientado al empresario/empleador.

### 3. Impacto por área operativa

| Área | Impacto | Urgencia |
|------|---------|----------|
| Remuneraciones / liquidación | | Alta / Media / Baja |
| Contratos de trabajo | | |
| ART / Seguridad e higiene | | |
| Registración / AFIP | | |
| Procedimiento judicial activo | | |

### 4. Checklist de cumplimiento

Formato accionable, verificable, con responsable sugerido:

- [ ] **[Acción concreta]** — plazo: [DD/MM/AAAA] — responsable: [RRHH / Estudio / Dirección]
- [ ] ...

Priorizar por urgencia. Máximo 10 ítems. Si hay más, agrupar por categoría.

### 5. Jurisprudencia y doctrina aplicable

Solo citar con:
- Tribunal + Sala
- Carátula o número de expediente si está disponible
- Fallos volumen:página (CSJN) o fecha (CNAT)
- Holding relevante en una línea

**Posiciones jurisprudenciales estables de EANDRES SIL:**
- IPC+3% → constitucional (*Oliva* Fallos 347:100; *Lacuadra* ago/2024)
- Art. 277 LCT / Art. 730 CCyC → cap honorarios (*Abdurraman*, *Brambilla*, *Villalba* Fallos 332:921/1118/1276)
- Ley 27.802 Art. 56 → constitucional (*Ferrero* Sala II CNAT 15/03/2026)
- Prejudicialidad penal → Art. 1775 CCyC (*Villagrán* Expte. 31496/2023 en curso)

### 6. Riesgos y alertas

Señalar específicamente:
- Multas o sanciones por incumplimiento (monto o fórmula si disponible)
- Plazos fatales
- Conflicto con CCT aplicable al cliente
- Constitucionalidad cuestionada (con estado jurisprudencial)

### 7. Clientes notificados

Indicar qué clientes deben ser alertados y por qué canal:
- Apparel Argentina S.A. → [motivo]
- Servisan / Martínez Casado → [motivo]
- Sanatorio Franchin → [motivo]
- Argentina Commercial Properties → [motivo]

---

## Reglas de calidad

1. **Perspectiva empleador siempre** — el análisis defiende los intereses de la empresa, no del trabajador
2. **Sin citas inventadas** — si no se tiene Fallos o fecha exacta, indicar "pendiente verificación"
3. **Vigencia explícita** — toda norma debe tener fecha de entrada en vigor
4. **CCT específica** — nunca referir genéricamente a "el convenio colectivo", siempre nombrar el CCT aplicable al cliente
5. **Checklist accionable** — cada ítem debe poder marcarse como cumplido; evitar ítems vagos como "revisar la norma"
6. **Longitud calibrada** — briefing ejecutivo ≤ 600 palabras; análisis completo ≤ 1500 palabras
7. **Branding EANDRES SIL** — outputs HTML usan: Navy #0F2244, Gold #C9A84C, Cyan #00B4D8, tipografía Inter

---

## Patrones de prompt para Gemini (Módulo Normativa)

### Prompt base — análisis general
```
Sos un especialista en derecho laboral argentino con perspectiva empleadora.
Analizá el siguiente [decreto/resolución/ley] y producí un briefing ejecutivo
siguiendo esta estructura: síntesis ejecutiva, impacto operativo por área,
checklist de cumplimiento con plazos, jurisprudencia aplicable.
Normativa: {texto_o_numero}
Cliente: {cliente_nombre} — CCT aplicable: {cct}
```

### Prompt — impacto remuneratorio
```
Analizá el impacto remuneratorio de {norma} sobre una empresa del sector {sector}
con CCT {cct}. Identificá: (1) rubros afectados, (2) variación porcentual estimada
en el costo laboral, (3) fecha de aplicación, (4) obligaciones de reliquidación.
```

### Prompt — constitucionalidad
```
Evaluá la constitucionalidad de {norma} considerando: doctrina CSJN vigente,
precedentes CNAT relevantes, y posición de EANDRES SIL en causas activas.
Indicá si hay cautelares vigentes o recursos pendientes que afecten su aplicación.
```

---

## Integración con EANDRES SIL

- **Firestore path:** `lexia/{uid}/normativas/{id}`
- **Campos clave:** `sector`, `cliente_id`, `cliente_nombre`, `vigencia`, `checklist_items`, `jurisprudencia[]`
- **Módulo Normativa E1/E2:** este skill alimenta el prompt de Gemini en `normativa.html`
- **Siguiente paso E3:** integrar con `eyecite` para validación automática de citas (`citations-ar`)

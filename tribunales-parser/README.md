# Parser Tribunales Argentinos — EANDRES SIL

Backend Flask + cliente JS para consulta judicial en 3 portales:
**PJN · SCBA · PJ CABA (EJE)**

---

## Estructura

```
tribunales-parser/
├── sites/
│   ├── base_site.py         # Clase base (session, retry, helpers)
│   ├── caba_site.py         # PJ CABA — EJE (jusbaires.gob.ar)
│   └── scba_site.py         # SCBA — JUBA + MEV
├── api.py                   # API Flask — 8 endpoints
├── tribunales-client.js     # Cliente JS para Vite
├── ConsultaJudicial.js      # Componente Vue (vista completa)
├── requirements.txt
└── .env.example
```

---

## Instalación del backend

```bash
cd tribunales-parser
pip install -r requirements.txt
cp .env.example .env
# Editar .env si tenés credenciales MEV SCBA
python api.py
# → http://localhost:5050/api/health
```

---

## Integración en EANDRES SIL (Vite)

### 1. Copiar archivos al proyecto

```bash
cp tribunales-client.js    <repo>/src/services/tribunales-client.js
cp ConsultaJudicial.js     <repo>/src/views/ConsultaJudicial.js
```

### 2. Agregar variable de entorno en Vite

En `.env` o `.env.local` de la app Vite:

```
VITE_TRIBUNALES_API=http://localhost:5050/api
```

Para producción (si deployás el backend en Railway/Render):
```
VITE_TRIBUNALES_API=https://tu-backend.railway.app/api
```

### 3. Registrar la vista en el router

En `src/router.js` (o donde tengas las rutas):

```js
import ConsultaJudicial from './views/ConsultaJudicial.js';

const routes = [
  // ... tus rutas existentes ...
  { path: '/consulta-judicial', component: ConsultaJudicial },
];
```

### 4. Agregar link en el sidebar

Buscá en `src/components/Sidebar.js` (o equivalente) y agregá:

```js
{ path: '/consulta-judicial', icon: '⚖️', label: 'Consulta Judicial' }
```

### 5. Inyectar estilos (si no usás CSS global)

En el `mounted` o en tu hoja de estilos global, importá:

```js
import { styles } from './views/ConsultaJudicial.js';
// o simplemente agregar ConsultaJudicial.css a tu build
```

---

## Endpoints disponibles

| Método | Ruta                        | Descripción                            |
|--------|-----------------------------|----------------------------------------|
| GET    | `/api/health`               | Health check                           |
| GET    | `/api/portales`             | Lista portales                         |
| POST   | `/api/pjn/consultar`        | PJN (devuelve URL + instrucción)       |
| POST   | `/api/scba/juba/buscar`     | SCBA JUBA — jurisprudencia             |
| POST   | `/api/scba/mev/consultar`   | SCBA MEV — causas activas              |
| POST   | `/api/caba/consultar`       | PJ CABA EJE — por número               |
| POST   | `/api/caba/caratula`        | PJ CABA EJE — por carátula             |
| POST   | `/api/unified/consultar`    | Auto-detecta portal por fuero          |

---

## Notas importantes

### Portal CABA (EJE)
- La API REST subyacente de `eje.juscaba.gob.ar` es no documentada (frontend Angular).
- El parser intenta varios endpoints conocidos; si fallan, devuelve la URL con parámetros 
  para apertura manual en el navegador.
- Fueros disponibles: Trabajo, CAyT, Civil, Penal Contravencional y de Faltas.

### SCBA MEV
- Requiere credenciales de abogado matriculado en PBA.
- Configurar `MEV_USUARIO` y `MEV_PASSWORD` en `.env`.

### PJN
- El backend actualmente devuelve la URL correcta (no scraping directo).
- Para scraping completo PJN, el módulo Selenium preexistente en EANDRES SIL 
  debe correr por separado (reCAPTCHA en CSJN).

### CORS / Deploy backend
- Para deploy en producción: Railway, Render, o Fly.io (gratis con límites).
- Agregar el dominio Netlify en las variables CORS del `api.py`.

---

## Próximos pasos (E2)

- [ ] Conectar con Firestore: guardar movimientos en la causa correspondiente
- [ ] Webhook / polling automático para detectar nuevos movimientos
- [ ] Integrar con módulo Agenda: alertas de audiencias detectadas en movimientos
- [ ] Selector magistrados (E2) — cruzar juzgado con base de datos de magistrados

# InfraEduca — Guía de configuración y ejecución

## 1. Estructura de archivos

```
infraeduca/
├── index.html          # Estructura de la SPA
├── styles.css           # Diseño (calcado de los mockups de Canva)
├── app.js                # Navegación SPA, Google Sign-In, llamadas a la API
├── server.py             # Backend Flask
├── schema.sql            # Esquema de la base de datos SQLite
├── requirements.txt       # Dependencias Python
├── .env.example           # Plantilla de variables de entorno
└── uploads/                # Carpeta donde se guardan las fotos/videos (se crea sola)
```

## 2. Variables de entorno (`.env`)

El backend usa `python-dotenv`, así que **nunca hardcodees** correos ni claves en el código. Copia la plantilla y complétala:

```bash
cp .env.example .env
```

| Variable | Qué es | Cómo obtenerla |
|---|---|---|
| `GOOGLE_CLIENT_ID` | El Client ID de OAuth 2.0 de tu app | Google Cloud Console → APIs & Services → Credenciales → "Crear credenciales" → ID de cliente de OAuth → tipo **Aplicación web**. Agrega tu dominio (o `http://localhost:5500`) en "Orígenes autorizados de JavaScript". |
| `ADMIN_EMAIL` | El correo Gmail que verá el Panel de Administración | El Gmail exacto de la persona administradora, en minúsculas |
| `SECRET_KEY` | Clave para firmar las cookies de sesión | Genera una con: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `FRONTEND_ORIGIN` | Dominio exacto donde corre el frontend | Ej. `http://localhost:5500` en desarrollo, `https://infraeduca.tuescuela.pe` en producción. Se usa para restringir CORS. |
| `FLASK_ENV` | `development` o `production` | En `production` se exige cookie de sesión segura (requiere HTTPS) |
| `PORT` | Puerto del backend | Opcional, por defecto `5000` |

**Importante:** `GOOGLE_CLIENT_ID` debe ser idéntico en el `.env` del backend **y** en la constante `GOOGLE_CLIENT_ID` dentro de `app.js` (líneas de configuración al inicio del archivo). Son dos lugares distintos porque uno lo usa el navegador (frontend) y el otro lo usa el backend para verificar el token.

## 3. Instalación y arranque del backend

```bash
cd infraeduca
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # y completa los valores reales
python server.py
```

La primera vez que se ejecuta, `server.py` crea automáticamente `infraeduca.db` a partir de `schema.sql`.

## 4. Arranque del frontend

El frontend es estático (HTML/CSS/JS puro), así que solo necesita ser servido — no compilado. Para desarrollo local:

```bash
cd infraeduca
python3 -m http.server 5500
```

Abre `http://localhost:5500/index.html`. Asegúrate de que:
- `FRONTEND_ORIGIN` en el `.env` del backend coincida **exactamente** con esta URL (incluyendo el puerto).
- `API_BASE` al inicio de `app.js` apunte a donde corre tu backend (`http://localhost:5000` por defecto).

En producción, sirve estos archivos estáticos desde tu hosting/CDN habitual y actualiza `API_BASE` y `FRONTEND_ORIGIN` a los dominios reales (con HTTPS).

## 5. Panel de Administración

No hay una URL ni botón visible por defecto: el enlace "Panel de Administración" solo aparece dentro del menú de ajustes (ícono de engranaje) **si** el correo Gmail con el que se inició sesión coincide exactamente con `ADMIN_EMAIL`. Cualquier otra persona nunca ve esa opción ni puede acceder a los endpoints `/api/admin/*` (devuelven 403).

## 6. Seguridad implementada (resumen)

- **CORS restringido**: solo se aceptan peticiones desde `FRONTEND_ORIGIN`.
- **Flask-Limiter**: máximo 5 reportes nuevos por hora por IP (`/api/reports` POST), y límite también en el login de Google.
- **Archivos**: máximo 3 MB, nombre reemplazado por un UUID aleatorio (nunca se usa el nombre original), extensión validada contra una lista blanca, y las imágenes se verifican con Pillow para confirmar que son imágenes reales (no un archivo malicioso disfrazado).
- **Anti path-traversal**: `/uploads/<archivo>` valida el nombre con `secure_filename` antes de servirlo.
- **SQL Injection**: todas las consultas usan parámetros (`?`), nunca se concatena texto del usuario dentro de un SQL.
- **XSS**: los textos del usuario se sanitizan en el backend (se escapan `<`, `>`, `&`, comillas) y el frontend los inserta siempre con `textContent`, nunca con `innerHTML`.
- **Sesión**: cookie `HttpOnly` firmada con `SECRET_KEY`; en producción además `Secure` (requiere HTTPS).
- **Validaciones duplicadas**: un usuario no puede validar (dar "like") dos veces el mismo reporte, ni validar su propio reporte.

## 7. Notas de diseño

- Las categorías incluyen Aulas, Baños, Patios, Techado, Electricidad, Agua y "Reporte General", tal como en el mockup de Canva (paso 1 del formulario).
- El formulario tiene 3 pasos: (1) Problema — categoría, descripción y foto/video obligatorios; (2) Ubicación — institución educativa y distrito/región (se agregó porque las tarjetas de "Casos públicos" y "Mis Reportes" del diseño muestran esta información); (3) Confirmación y envío.
- Cada reporte recibe un "Código Identicole" de seguimiento, visible en "Mis Reportes", como se ve en el mockup.

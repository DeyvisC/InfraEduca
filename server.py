"""
InfraEduca · Backend (Flask + SQLite)
=====================================
Senior dev notes inline. Run with:  python server.py
Requires a .env file — see .env.example / README.md
"""

import os
import re
import sqlite3
import uuid
from datetime import datetime
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape
from werkzeug.utils import secure_filename

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

# ----------------------------------------------------------------------------
# 1) CONFIGURACIÓN / VARIABLES DE ENTORNO
# ----------------------------------------------------------------------------
load_dotenv()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
SECRET_KEY = os.environ.get("SECRET_KEY", "")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5500")
FLASK_ENV = os.environ.get("FLASK_ENV", "production")

if not SECRET_KEY:
    raise RuntimeError(
        "Falta SECRET_KEY en el .env. Genera una con: "
        "python -c \"import secrets; print(secrets.token_hex(32))\""
    )
if not GOOGLE_CLIENT_ID:
    raise RuntimeError("Falta GOOGLE_CLIENT_ID en el .env (Google Cloud Console).")
if not ADMIN_EMAIL:
    print("⚠️  ADMIN_EMAIL no está configurado: el panel de administración "
          "quedará inaccesible para todos.")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "infraeduca.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "mp4", "mov", "webm"}
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_CONTENT_LENGTH = 3 * 1024 * 1024  # 3 MB por archivo (regla del brief)
VALID_CATEGORIES = {"aulas", "banos", "patios", "techado", "electricidad", "agua", "general"}
VALID_STATUSES = {"revision", "proceso", "solucionado"}
LIMA_TZ = ZoneInfo("America/Lima")

# ----------------------------------------------------------------------------
# 2) APP, CORS, RATE LIMITING
# ----------------------------------------------------------------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax" if FLASK_ENV != "production" else "None"
app.config["SESSION_COOKIE_SECURE"] = FLASK_ENV == "production"  # requiere HTTPS en prod

# CORS restringido SOLO al dominio del frontend (requisito de seguridad)
CORS(app, resources={r"/api/*": {"origins": FRONTEND_ORIGIN}}, supports_credentials=True)

limiter = Limiter(get_remote_address, app=app, storage_uri="memory://")

# ----------------------------------------------------------------------------
# 3) BASE DE DATOS (SQLite) — siempre con placeholders "?" => sin SQL injection
# ----------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with app.app_context():
        db = get_db()
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            db.executescript(f.read())
        db.commit()


def now_lima_iso() -> str:
    return datetime.now(LIMA_TZ).isoformat(timespec="seconds")


def new_ticket_code() -> str:
    return "IE-" + uuid.uuid4().hex[:8].upper()


# ----------------------------------------------------------------------------
# 4) SANITIZACIÓN DE INPUTS (defensa anti-XSS) Y VALIDACIÓN DE ARCHIVOS
# ----------------------------------------------------------------------------
def clean_text(value: str, max_len: int) -> str:
    """Recorta longitud, quita caracteres de control y escapa HTML.
    Igual se debe renderizar con textContent en el frontend; esto es
    una segunda capa de defensa (defense in depth)."""
    if value is None:
        return ""
    value = str(value).strip()
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)  # control chars
    value = value[:max_len]
    return str(escape(value))  # escapa <, >, &, ", '


def allowed_file(filename: str, allowed: set) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


def is_valid_image(filepath: str) -> bool:
    """Verifica que el archivo sea realmente una imagen válida (no solo
    que tenga extensión de imagen) usando Pillow. Protege contra archivos
    maliciosos disfrazados con extensión de imagen."""
    try:
        from PIL import Image
        with Image.open(filepath) as img:
            img.verify()
        return True
    except Exception:
        return False


def save_upload(file_storage) -> str:
    """Guarda el archivo subido con nombre aleatorio (uuid4) + extensión
    sanitizada con secure_filename. Devuelve la ruta relativa guardada."""
    raw_name = secure_filename(file_storage.filename or "")
    if not raw_name or not allowed_file(raw_name, ALLOWED_EXTENSIONS):
        raise ValueError("Tipo de archivo no permitido.")

    ext = raw_name.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    full_path = os.path.join(UPLOAD_FOLDER, unique_name)
    file_storage.save(full_path)

    # Verificación extra de tamaño real (cinturón y tirantes ante streams raros)
    if os.path.getsize(full_path) > MAX_CONTENT_LENGTH:
        os.remove(full_path)
        raise ValueError("El archivo supera el límite de 3 MB.")

    if ext in ALLOWED_IMAGE_EXTENSIONS and not is_valid_image(full_path):
        os.remove(full_path)
        raise ValueError("El archivo de imagen está corrupto o no es válido.")

    return unique_name


# ----------------------------------------------------------------------------
# 5) AUTENTICACIÓN (Google Identity Services) + SESIÓN DE SERVIDOR
# ----------------------------------------------------------------------------
# Flujo: el frontend obtiene un id_token de Google -> lo manda UNA vez a
# /api/auth/google -> el backend lo verifica contra GOOGLE_CLIENT_ID y abre
# una sesión de Flask (cookie firmada con SECRET_KEY, HttpOnly). Las
# siguientes peticiones usan esa cookie, evitando reverificar el id_token
# de Google (que expira en ~1h) en cada llamada.

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("email"):
            return jsonify({"error": "No autenticado."}), 401
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("email"):
            return jsonify({"error": "No autenticado."}), 401
        if not session.get("is_admin"):
            return jsonify({"error": "Acceso restringido al administrador."}), 403
        return f(*args, **kwargs)
    return wrapper


def csrf_origin_check(f):
    """Mitigación CSRF ligera para endpoints que cambian estado: el navegador
    siempre manda el header Origin en fetch() cross-site; lo comparamos
    contra el dominio permitido. Complementa SameSite=Lax/None+Secure."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method in ("POST", "PUT", "DELETE"):
            origin = request.headers.get("Origin", "")
            if origin and origin.rstrip("/") != FRONTEND_ORIGIN.rstrip("/"):
                return jsonify({"error": "Origen no permitido."}), 403
        return f(*args, **kwargs)
    return wrapper


@app.post("/api/auth/google")
@csrf_origin_check
@limiter.limit("20 per hour")
def auth_google():
    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    if not credential:
        return jsonify({"error": "Falta el token de Google."}), 400

    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        return jsonify({"error": "Token de Google inválido."}), 401

    if not idinfo.get("email_verified", False):
        return jsonify({"error": "El correo de Google no está verificado."}), 401

    email = idinfo["email"].strip().lower()
    name = clean_text(idinfo.get("name", email.split("@")[0]), 120)
    picture = idinfo.get("picture", "")

    session.clear()
    session["email"] = email
    session["name"] = name
    session["picture"] = picture
    session["is_admin"] = (email == ADMIN_EMAIL)
    session.permanent = True

    return jsonify({
        "email": email, "name": name, "picture": picture,
        "isAdmin": session["is_admin"],
    })


@app.post("/api/auth/logout")
@csrf_origin_check
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    if not session.get("email"):
        return jsonify({"authenticated": False}), 200
    return jsonify({
        "authenticated": True,
        "email": session["email"],
        "name": session.get("name"),
        "picture": session.get("picture"),
        "isAdmin": session.get("is_admin", False),
    })


# ----------------------------------------------------------------------------
# 6) SERIALIZACIÓN
# ----------------------------------------------------------------------------
def serialize_report(row, user_email=None, db=None):
    item = {
        "id": row["id"],
        "email": row["email"] if user_email == row["email"] else None,
        "displayName": row["display_name"],
        "category": row["category"],
        "description": row["description"],
        "schoolName": row["school_name"],
        "region": row["region"],
        "imageUrl": f"/uploads/{row['image_path']}",
        "status": row["status"],
        "validations": row["validations"],
        "ticketCode": row["ticket_code"],
        "createdAt": row["created_at"],
        "isMine": user_email is not None and user_email == row["email"],
    }
    if db is not None and user_email:
        voted = db.execute(
            "SELECT 1 FROM validations WHERE report_id=? AND email=?",
            (row["id"], user_email),
        ).fetchone()
        item["hasValidated"] = voted is not None
    else:
        item["hasValidated"] = False
    return item


# ----------------------------------------------------------------------------
# 7) ENDPOINTS · REPORTES (público / autenticado)
# ----------------------------------------------------------------------------
@app.get("/api/reports")
def list_reports():
    db = get_db()
    try:
        offset = max(0, int(request.args.get("offset", 0)))
        limit = min(20, max(1, int(request.args.get("limit", 5))))
    except ValueError:
        return jsonify({"error": "offset/limit inválidos."}), 400

    category = request.args.get("category")
    mine = request.args.get("mine") == "true"

    clauses, params = [], []
    if category and category in VALID_CATEGORIES:
        clauses.append("category = ?")
        params.append(category)
    if mine:
        if not session.get("email"):
            return jsonify({"error": "No autenticado."}), 401
        clauses.append("email = ?")
        params.append(session["email"])

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = db.execute(
        f"SELECT * FROM reports {where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        (*params, limit, offset),
    ).fetchall()
    total = db.execute(f"SELECT COUNT(*) AS c FROM reports {where}", params).fetchone()["c"]

    user_email = session.get("email")
    items = [serialize_report(r, user_email, db) for r in rows]
    return jsonify({"items": items, "total": total, "hasMore": offset + len(items) < total})


@app.post("/api/reports")
@csrf_origin_check
@login_required
@limiter.limit("5 per hour")  # anti-spam, requisito del brief
def create_report():
    category = (request.form.get("category") or "").strip().lower()
    description = clean_text(request.form.get("description", ""), 600)
    school_name = clean_text(request.form.get("schoolName", ""), 160)
    region = clean_text(request.form.get("region", ""), 160)

    if category not in VALID_CATEGORIES:
        return jsonify({"error": "Categoría inválida."}), 400
    if len(description) < 10:
        return jsonify({"error": "La descripción es muy corta (mínimo 10 caracteres)."}), 400
    if "photo" not in request.files or request.files["photo"].filename == "":
        return jsonify({"error": "Debes adjuntar una foto o video del problema."}), 400

    try:
        filename = save_upload(request.files["photo"])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    created_at = now_lima_iso()
    ticket = new_ticket_code()
    cur = db.execute(
        """INSERT INTO reports
           (email, display_name, category, description, school_name, region,
            image_path, status, validations, ticket_code, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'revision', 0, ?, ?)""",
        (session["email"], session.get("name"), category, description,
         school_name, region, filename, ticket, created_at),
    )
    db.commit()
    row = db.execute("SELECT * FROM reports WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(serialize_report(row, session["email"], db)), 201


@app.post("/api/reports/<int:report_id>/validate")
@csrf_origin_check
@login_required
def validate_report(report_id):
    db = get_db()
    row = db.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    if not row:
        return jsonify({"error": "Reporte no encontrado."}), 404
    if row["email"] == session["email"]:
        return jsonify({"error": "No puedes validar tu propio reporte."}), 400

    try:
        db.execute(
            "INSERT INTO validations (report_id, email, created_at) VALUES (?, ?, ?)",
            (report_id, session["email"], now_lima_iso()),
        )
        db.execute("UPDATE reports SET validations = validations + 1 WHERE id = ?", (report_id,))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "Ya validaste este reporte."}), 409

    new_count = db.execute(
        "SELECT validations FROM reports WHERE id = ?", (report_id,)
    ).fetchone()["validations"]
    return jsonify({"id": report_id, "validations": new_count, "hasValidated": True})


# ----------------------------------------------------------------------------
# 8) ARCHIVOS SUBIDOS (servidos solo por nombre, sin path traversal)
# ----------------------------------------------------------------------------
@app.get("/uploads/<path:filename>")
def serve_upload(filename):
    safe_name = secure_filename(filename)
    if safe_name != filename:
        return jsonify({"error": "Nombre de archivo inválido."}), 400
    return send_from_directory(UPLOAD_FOLDER, safe_name)


# ----------------------------------------------------------------------------
# 9) PANEL DE ADMINISTRACIÓN (solo email == ADMIN_EMAIL)
# ----------------------------------------------------------------------------
@app.get("/api/admin/reports")
@admin_required
def admin_list_reports():
    db = get_db()
    category = request.args.get("category")
    status = request.args.get("status")
    clauses, params = [], []
    if category and category in VALID_CATEGORIES:
        clauses.append("category = ?")
        params.append(category)
    if status and status in VALID_STATUSES:
        clauses.append("status = ?")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = db.execute(
        f"SELECT * FROM reports {where} ORDER BY created_at DESC", params
    ).fetchall()
    return jsonify({"items": [serialize_report(r, session["email"], db) for r in rows]})


@app.put("/api/admin/reports/<int:report_id>/status")
@csrf_origin_check
@admin_required
def admin_update_status(report_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in VALID_STATUSES:
        return jsonify({"error": "Estado inválido."}), 400
    db = get_db()
    cur = db.execute("UPDATE reports SET status = ? WHERE id = ?", (status, report_id))
    db.commit()
    if cur.rowcount == 0:
        return jsonify({"error": "Reporte no encontrado."}), 404
    return jsonify({"id": report_id, "status": status})


@app.delete("/api/admin/reports/<int:report_id>")
@csrf_origin_check
@admin_required
def admin_delete_report(report_id):
    db = get_db()
    row = db.execute("SELECT image_path FROM reports WHERE id = ?", (report_id,)).fetchone()
    if not row:
        return jsonify({"error": "Reporte no encontrado."}), 404

    db.execute("DELETE FROM reports WHERE id = ?", (report_id,))  # cascada borra validations
    db.commit()

    image_path = os.path.join(UPLOAD_FOLDER, row["image_path"])
    if os.path.commonpath([image_path, UPLOAD_FOLDER]) == UPLOAD_FOLDER and os.path.exists(image_path):
        os.remove(image_path)

    return jsonify({"ok": True})


# ----------------------------------------------------------------------------
# 10) MANEJO DE ERRORES
# ----------------------------------------------------------------------------
@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "El archivo supera el límite de 3 MB."}), 413


@app.errorhandler(429)
def rate_limited(e):
    return jsonify({"error": "Demasiadas solicitudes. Inténtalo más tarde."}), 429


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Recurso no encontrado."}), 404


# ----------------------------------------------------------------------------
# 11) ARRANQUE
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        init_db()
        print(f"✅ Base de datos creada en {DB_PATH}")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=(FLASK_ENV != "production"))

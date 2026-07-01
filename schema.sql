-- ============================================================
-- InfraEduca · Esquema de base de datos (SQLite)
-- ============================================================
-- NOTA DE DISEÑO:
-- Los campos email/categoria/descripcion/imagen/fecha/estado/validaciones
-- son los pedidos en el brief. Se agregaron `school_name` y `region`
-- porque las pantallas de Canva (tarjetas de "Casos públicos recientes"
-- y "Mis Reportes") muestran el colegio y la región del caso, así que
-- el formulario de 3 pasos los captura en el Paso 2 (Ubicación).
-- La tabla `validations` evita que un mismo usuario valide (dé "like")
-- dos veces el mismo reporte.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL,                 -- email del creador (Google)
    display_name    TEXT,                              -- nombre mostrado (Google)
    category        TEXT    NOT NULL CHECK (category IN
                        ('aulas','banos','patios','techado',
                         'electricidad','agua','general')),
    description     TEXT    NOT NULL,
    school_name     TEXT,
    region          TEXT,
    image_path      TEXT    NOT NULL,                  -- ruta relativa en /uploads
    status          TEXT    NOT NULL DEFAULT 'revision' CHECK (status IN
                        ('revision','proceso','solucionado')),
    validations     INTEGER NOT NULL DEFAULT 0,
    ticket_code     TEXT,                               -- código de seguimiento (Identicole)
    created_at      TEXT    NOT NULL                    -- ISO 8601, hora de Lima
);

CREATE TABLE IF NOT EXISTS validations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id       INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    email           TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    UNIQUE (report_id, email)
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category   ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status      ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_email       ON reports(email);

/* ==========================================================
   InfraEduca · app.js
   SPA en Vanilla JS — sin recargas de página.
   ========================================================== */
"use strict";

/* ------------------------------------------------------------
   0) CONFIGURACIÓN
   ------------------------------------------------------------ */
// Cambia esto por el dominio real del backend en producción.
const API_BASE = "https://Batman07.pythonanywhere.com";

// Debe ser EXACTAMENTE el mismo Client ID que GOOGLE_CLIENT_ID en el .env
// del backend (server.py lo valida).
const GOOGLE_CLIENT_ID = "16448425905-3pbedsv470s4pi8u1v2jk8vedbt2d5bc.apps.googleusercontent.com";

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB, igual que el backend

/* ------------------------------------------------------------
   1) ICONOS (SVG inline, sin librerías externas)
   ------------------------------------------------------------ */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.7" r=".6" fill="currentColor" stroke="none"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.3" r=".6" fill="currentColor" stroke="none"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.6-2-3.4-2.4.7a8 8 0 0 0-1.7-1L14.8 3h-4l-.5 2.7a8 8 0 0 0-1.7 1l-2.4-.7-2 3.4L6 11a8 8 0 0 0 0 2l-2 1.6 2 3.4 2.4-.7a8 8 0 0 0 1.7 1L9.8 21h4l.5-2.7a8 8 0 0 0 1.7-1l2.4.7 2-3.4-2-1.6Z"/></svg>',
  thumbsUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" class="icon"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor"/></svg>',
  drop: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2C8 8 5 11.5 5 15a7 7 0 0 0 14 0c0-3.5-3-7-7-13z" fill="currentColor"/></svg>',
  roof: '<svg viewBox="0 0 24 24" class="icon"><path d="M3 12 12 4l9 8h-3v8h-4v-6h-4v6H6v-8H3z" fill="currentColor"/></svg>',
  aulas: '<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v3"/><rect x="4" y="5" width="16" height="12" rx="1.5"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
  banos: '<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3h8v6a4 4 0 0 1-8 0V3Z"/><path d="M6.5 21 7.5 13h9l1 8"/></svg>',
  patios: '<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 0 1 18 0Z"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M9 21a3 3 0 0 0 6 0"/></svg>',
  general: '<svg viewBox="0 0 24 24" class="icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a1 1 0 0 0 1 1h2l4 5v-16l-4 5H4a1 1 0 0 0-1 1Z"/><path d="M16 8a4 4 0 0 1 0 8"/><path d="M19 5a8 8 0 0 1 0 14"/></svg>',
};
ICONS.techado = ICONS.roof;
ICONS.electricidad = ICONS.bolt;
ICONS.agua = ICONS.drop;

const CATEGORIES = [
  { key: "aulas", label: "Aulas", icon: ICONS.aulas },
  { key: "banos", label: "Baños", icon: ICONS.banos },
  { key: "patios", label: "Patios", icon: ICONS.patios },
  { key: "techado", label: "Techado", icon: ICONS.techado },
  { key: "electricidad", label: "Electricidad", icon: ICONS.electricidad },
  { key: "agua", label: "Agua", icon: ICONS.agua },
  { key: "general", label: "Reporte General", icon: ICONS.general },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));
const STATUS_LABEL = { revision: "En revisión", proceso: "En proceso", solucionado: "Solucionado" };
const STATUS_PROGRESS = { revision: 33, proceso: 66, solucionado: 100 };

/* ------------------------------------------------------------
   2) ESTADO GLOBAL
   ------------------------------------------------------------ */
const state = {
  user: null,            // { email, name, picture, isAdmin }
  currentScreen: "login",
  cameFromScreen: "home", // a qué pantalla volver desde el wizard
  home: { offset: 0, limit: 5, category: "", items: [] },
  mine: { offset: 0, limit: 5, items: [] },
  admin: { category: "", status: "" },
  wizard: {
    step: 1,
    category: "",
    description: "",
    schoolName: "",
    region: "",
    photoFile: null,
  },
};

/* ------------------------------------------------------------
   3) HELPERS GENERALES
   ------------------------------------------------------------ */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: "include",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* sin cuerpo */ }
  if (!res.ok) {
    const message = (data && data.error) || `Error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  } catch (_) { return iso; }
}

function pluralize(n, singular, plural) { return n === 1 ? singular : plural; }

/* ------------------------------------------------------------
   4) NAVEGACIÓN SPA (mostrar/ocultar pantallas, sin reloads)
   ------------------------------------------------------------ */
function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(`screen-${id}`);
  if (el) el.classList.add("active");
  state.currentScreen = id;
  window.scrollTo(0, 0);

  if (id === "home" && state.home.items.length === 0) loadHomeReports(true);
  if (id === "myreports" && state.mine.items.length === 0) loadMyReports(true);
  if (id === "admin") loadAdminReports();
}

/* ------------------------------------------------------------
   5) CABECERA + NAV (chrome reutilizable)
   ------------------------------------------------------------ */
function chromeHTML(activeKey) {
  const pill = (key, icon, label) => `
    <button class="nav-pill ${activeKey === key ? "active" : ""}" data-target="${key}" type="button">
      ${icon}<span>${label}</span>
    </button>`;
  return `
    <header class="app-header">
      <span class="app-logo-pill">InfraEduca</span>
      <button class="settings-btn" id="btn-settings-${activeKey}" type="button" aria-label="Ajustes">${ICONS.gear}</button>
    </header>
    <nav class="app-nav">
      ${pill("home", ICONS.home, "Inicio")}
      ${pill("info", ICONS.info, "Información")}
      ${pill("myreports", ICONS.alert, "Mis Reportes")}
    </nav>`;
}

function renderAllChrome() {
  $all(".chrome-slot").forEach(slot => {
    slot.innerHTML = chromeHTML(slot.dataset.screen);
  });
}

// Delegación de eventos: los nav-pill y settings-btn se recrean en cada
// renderAllChrome(), así que escuchamos en el contenedor padre fijo.
document.addEventListener("click", (e) => {
  const pill = e.target.closest(".nav-pill");
  if (pill) { showScreen(pill.dataset.target); return; }
  if (e.target.closest("[id^='btn-settings-']")) { openSettingsSheet(); }
});

/* ------------------------------------------------------------
   6) AUTENTICACIÓN (Google Identity Services)
   ------------------------------------------------------------ */
function initGoogleSignIn() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    // El script de Google no cargó (ej. sin internet o bloqueado).
    $("#btn-google-fallback").hidden = false;
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
  });
  google.accounts.id.renderButton($("#google-signin-btn"), {
    type: "standard", theme: "outline", size: "large", shape: "pill", width: 280,
  });
}

async function handleGoogleCredential(response) {
  try {
    const user = await api("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: response.credential }),
    });
    onLoginSuccess(user);
  } catch (err) {
    showToast(err.message || "No se pudo iniciar sesión.", true);
  }
}

function onLoginSuccess(user) {
  state.user = user;
  localStorage.setItem("infraeduca_user", JSON.stringify(user));
  showToast(`¡Bienvenido, ${user.name.split(" ")[0]}!`);
  renderCategoryGridIfNeeded();
  showScreen("home");
}

async function checkSession() {
  try {
    const data = await api("/api/me");
    if (data.authenticated) {
      state.user = { email: data.email, name: data.name, picture: data.picture, isAdmin: data.isAdmin };
      showScreen("home");
      return;
    }
  } catch (_) { /* backend no disponible aún */ }
  showScreen("login");
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
  state.user = null;
  localStorage.removeItem("infraeduca_user");
  closeSettingsSheet();
  showScreen("login");
}

/* ------------------------------------------------------------
   7) MENÚ DE AJUSTES
   ------------------------------------------------------------ */
function openSettingsSheet() {
  if (!state.user) return;
  $("#sheet-user").innerHTML = `<strong></strong><span></span>`;
  $("#sheet-user strong").textContent = state.user.name || "";
  $("#sheet-user span").textContent = state.user.email || "";
  $("#sheet-admin-link").hidden = !state.user.isAdmin;
  $("#settings-sheet").hidden = false;
}
function closeSettingsSheet() { $("#settings-sheet").hidden = true; }

$("#sheet-close").addEventListener("click", closeSettingsSheet);
$("#settings-sheet").addEventListener("click", (e) => { if (e.target.id === "settings-sheet") closeSettingsSheet(); });
$("#sheet-logout").addEventListener("click", logout);
$("#sheet-admin-link").addEventListener("click", () => { closeSettingsSheet(); showScreen("admin"); });

/* ------------------------------------------------------------
   8) TARJETAS DE REPORTE (DOM seguro: nunca innerHTML con texto de usuario)
   ------------------------------------------------------------ */
function buildSimpleCard(report) {
  const card = document.createElement("div");
  card.className = "report-card";
  card.dataset.id = report.id;
  card.innerHTML = `
    <div class="report-thumb"><img alt="" loading="lazy"></div>
    <div class="report-body">
      <p class="report-title"></p>
      <p class="report-sub"></p>
      <div class="report-meta">
        <button class="validate-btn" type="button">${ICONS.thumbsUp}<span class="validate-count"></span></button>
        <div class="report-progress-track"><div class="report-progress-fill"></div></div>
      </div>
    </div>`;

  const img = $(".report-thumb img", card);
  img.src = API_BASE + report.imageUrl;
  img.onerror = () => { img.style.display = "none"; };

  $(".report-title", card).textContent = report.description.length > 64
    ? report.description.slice(0, 64) + "…" : report.description;
  $(".report-sub", card).textContent =
    [report.schoolName, report.region].filter(Boolean).join(" · ") || CATEGORY_LABEL[report.category];

  applyValidateButton(card, report);

  const fill = $(".report-progress-fill", card);
  fill.style.width = Math.min(100, report.validations * 8) + "%"; // indicador visual de respaldo comunitario

  return card;
}

function buildDetailedCard(report, { admin = false } = {}) {
  const card = document.createElement("div");
  card.className = "report-card";
  card.dataset.id = report.id;
  card.innerHTML = `
    <div class="report-card-top">
      <div class="report-thumb"><img alt="" loading="lazy"></div>
      <div class="report-body">
        <p class="report-title"></p>
        <p class="report-sub"></p>
        <p class="report-sub report-date"></p>
        <span class="status-badge"></span>
        ${admin ? '<p class="report-sub admin-email"></p>' : ""}
      </div>
    </div>
    <hr class="report-divider" />
    <div class="support-row">
      <button class="validate-btn" type="button">${ICONS.thumbsUp}<span class="validate-count"></span></button>
    </div>
    ${admin ? `
      <div class="admin-row-actions">
        <select class="admin-select-status">
          <option value="revision">En revisión</option>
          <option value="proceso">En proceso</option>
          <option value="solucionado">Solucionado</option>
        </select>
        <button type="button" class="btn-delete">Eliminar</button>
      </div>` : `
      <div class="tracking-card">
        <p class="tracking-title">Seguimiento Oficial</p>
        <p class="tracking-code">Código Identicole: <b></b></p>
        <div class="tracking-bar-track"><div class="tracking-bar-fill"></div></div>
      </div>`}
  `;

  const img = $(".report-thumb img", card);
  img.src = API_BASE + report.imageUrl;
  img.onerror = () => { img.style.display = "none"; };

  $(".report-title", card).textContent = report.description.length > 64
    ? report.description.slice(0, 64) + "…" : report.description;
  $(".report-sub", card).textContent = report.schoolName || CATEGORY_LABEL[report.category];
  $(".report-date", card).textContent = formatDate(report.createdAt);

  const badge = $(".status-badge", card);
  badge.textContent = STATUS_LABEL[report.status];
  badge.classList.add(`status-${report.status}`);

  applyValidateButton(card, report);

  if (admin) {
    $(".admin-email", card).textContent = report.email || "";
    const sel = $(".admin-select-status", card);
    sel.value = report.status;
    sel.addEventListener("change", () => updateReportStatus(report.id, sel.value, card));
    $(".btn-delete", card).addEventListener("click", () => deleteReport(report.id, card));
  } else {
    $(".tracking-code b", card).textContent = report.ticketCode || "—";
    $(".tracking-bar-fill", card).style.width = STATUS_PROGRESS[report.status] + "%";
  }

  return card;
}

function applyValidateButton(card, report) {
  const btn = $(".validate-btn", card);
  const countSpan = $(".validate-count", card);
  countSpan.textContent = `${report.validations} ${pluralize(report.validations, "Validación", "Validaciones")}`;
  if (report.hasValidated) btn.classList.add("validated");
  if (report.isMine) {
    btn.disabled = true;
    btn.title = "No puedes validar tu propio reporte";
  } else if (report.hasValidated) {
    btn.disabled = true;
  }
  btn.addEventListener("click", () => validateReport(report.id, card));
}

async function validateReport(id, card) {
  const btn = $(".validate-btn", card);
  btn.disabled = true;
  try {
    const data = await api(`/api/reports/${id}/validate`, { method: "POST" });
    $(".validate-count", card).textContent =
      `${data.validations} ${pluralize(data.validations, "Validación", "Validaciones")}`;
    btn.classList.add("validated");
    const fill = $(".report-progress-fill", card);
    if (fill) fill.style.width = Math.min(100, data.validations * 8) + "%";
  } catch (err) {
    btn.disabled = false;
    showToast(err.message, true);
  }
}

/* ------------------------------------------------------------
   9) PANTALLA: INICIO (reportes públicos + paginación + filtro)
   ------------------------------------------------------------ */
function renderHomeCategoryChips() {
  const row = $("#home-categories");
  row.innerHTML = "";
  const allChip = document.createElement("button");
  allChip.className = "chip active";
  allChip.textContent = "Todos";
  allChip.dataset.cat = "";
  row.appendChild(allChip);
  CATEGORIES.forEach(c => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = c.label;
    chip.dataset.cat = c.key;
    row.appendChild(chip);
  });
  row.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $all(".chip", row).forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.home.category = chip.dataset.cat;
    loadHomeReports(true);
  });
}

async function loadHomeReports(reset = false) {
  if (reset) { state.home.offset = 0; state.home.items = []; $("#home-reports-list").innerHTML = ""; }
  try {
    const qs = new URLSearchParams({
      offset: state.home.offset, limit: state.home.limit,
      ...(state.home.category ? { category: state.home.category } : {}),
    });
    const data = await api(`/api/reports?${qs.toString()}`);
    const list = $("#home-reports-list");
    data.items.forEach(r => list.appendChild(buildSimpleCard(r)));
    state.home.items.push(...data.items);
    state.home.offset += data.items.length;
    $("#home-load-more").hidden = !data.hasMore;
    $("#home-empty").hidden = state.home.items.length > 0;
  } catch (err) {
    showToast(err.message, true);
  }
}
$("#home-load-more").addEventListener("click", () => loadHomeReports(false));

/* ------------------------------------------------------------
   10) PANTALLA: MIS REPORTES
   ------------------------------------------------------------ */
async function loadMyReports(reset = false) {
  if (reset) { state.mine.offset = 0; state.mine.items = []; $("#my-reports-list").innerHTML = ""; }
  try {
    const qs = new URLSearchParams({ offset: state.mine.offset, limit: state.mine.limit, mine: "true" });
    const data = await api(`/api/reports?${qs.toString()}`);
    const list = $("#my-reports-list");
    data.items.forEach(r => list.appendChild(buildDetailedCard(r)));
    state.mine.items.push(...data.items);
    state.mine.offset += data.items.length;
    $("#my-load-more").hidden = !data.hasMore;
    $("#my-empty").hidden = state.mine.items.length > 0;
  } catch (err) {
    showToast(err.message, true);
  }
}
$("#my-load-more").addEventListener("click", () => loadMyReports(false));

/* ------------------------------------------------------------
   11) FAB "Iniciar un nuevo reporte"
   ------------------------------------------------------------ */
["fab-new-report-home", "fab-new-report-mine"].forEach(id => {
  $("#" + id).addEventListener("click", () => {
    state.cameFromScreen = state.currentScreen;
    openReportWizard();
  });
});

/* ------------------------------------------------------------
   12) WIZARD DE REPORTE (3 pasos)
   ------------------------------------------------------------ */
function renderCategoryGridIfNeeded() {
  const grid = $("#category-grid");
  if (grid.dataset.rendered) return;
  CATEGORIES.forEach(c => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-item" + (c.key === "general" ? " general" : "");
    btn.dataset.key = c.key;
    btn.innerHTML = `<span class="category-icon-wrap">${c.icon}</span><span class="category-label"></span>`;
    $(".category-label", btn).textContent = c.label;
    btn.addEventListener("click", () => selectCategory(c.key));
    grid.appendChild(btn);
  });
  grid.dataset.rendered = "1";
}

function selectCategory(key) {
  state.wizard.category = key;
  $all(".category-item", $("#category-grid")).forEach(el => el.classList.toggle("selected", el.dataset.key === key));
  updateStep1NextState();
}

function openReportWizard() {
  state.wizard = { step: 1, category: "", description: "", schoolName: "", region: "", photoFile: null };
  $("#description-input").value = "";
  $("#char-count").textContent = "0";
  $("#photo-input").value = "";
  $("#photo-preview-wrap").hidden = true;
  $("#school-input").value = "";
  $("#region-input").value = "";
  $all(".category-item", $("#category-grid")).forEach(el => el.classList.remove("selected"));
  goToWizardStep(1);
  showScreen("report-form");
}

function goToWizardStep(step) {
  state.wizard.step = step;
  $all(".wizard-step").forEach(el => el.hidden = Number(el.dataset.step) !== step);
  $("#wizard-step-label").textContent = `Paso ${step} de 3`;
  $("#wizard-progress-fill").style.width = `${step * 33}%`;
  if (step === 3) renderReviewCard();
  window.scrollTo(0, 0);
}

$("#wizard-back").addEventListener("click", () => {
  if (state.wizard.step > 1) goToWizardStep(state.wizard.step - 1);
  else showScreen(state.cameFromScreen || "home");
});

// --- Paso 1: problema ---
$("#description-input").addEventListener("input", (e) => {
  state.wizard.description = e.target.value;
  $("#char-count").textContent = String(e.target.value.length);
  updateStep1NextState();
});

$("#btn-pick-photo").addEventListener("click", () => $("#photo-input").click());

$("#photo-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showToast("El archivo supera 3 MB. Elige una foto más liviana.", true);
    e.target.value = "";
    return;
  }
  state.wizard.photoFile = file;
  const wrap = $("#photo-preview-wrap");
  wrap.hidden = false;
  wrap.querySelectorAll("img,video").forEach(n => n.remove());
  if (file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.controls = true;
    video.id = "photo-preview";
    wrap.prepend(video);
  } else {
    const img = document.createElement("img");
    img.id = "photo-preview";
    img.alt = "Vista previa de la foto adjunta";
    img.src = URL.createObjectURL(file);
    wrap.prepend(img);
  }
  updateStep1NextState();
});

$("#btn-remove-photo").addEventListener("click", () => {
  state.wizard.photoFile = null;
  $("#photo-input").value = "";
  $("#photo-preview-wrap").hidden = true;
  updateStep1NextState();
});

function updateStep1NextState() {
  const ok = !!state.wizard.category && state.wizard.description.trim().length >= 10 && !!state.wizard.photoFile;
  $("#step1-next").disabled = !ok;
}
updateStep1NextState();

$("#step1-next").addEventListener("click", () => {
  if ($("#step1-next").disabled) {
    showToast("Elige una categoría, describe el problema (mín. 10 caracteres) y adjunta una foto o video.", true);
    return;
  }
  goToWizardStep(2);
});

// --- Paso 2: ubicación ---
$("#school-input").addEventListener("input", (e) => { state.wizard.schoolName = e.target.value; });
$("#region-input").addEventListener("input", (e) => { state.wizard.region = e.target.value; });

$("#step2-back").addEventListener("click", () => goToWizardStep(1));
$("#step2-next").addEventListener("click", () => {
  if (!state.wizard.schoolName.trim() || !state.wizard.region.trim()) {
    showToast("Completa la institución educativa y la región/distrito.", true);
    return;
  }
  goToWizardStep(3);
});

// --- Paso 3: confirmación ---
function renderReviewCard() {
  const w = state.wizard;
  const card = $("#review-card");
  card.innerHTML = `
    <div class="review-row"><span class="review-label">Categoría</span><span class="review-value cat"></span></div>
    <div class="review-row"><span class="review-label">Institución</span><span class="review-value school"></span></div>
    <div class="review-row"><span class="review-label">Distrito / Región</span><span class="review-value region"></span></div>
    <div class="review-row"><span class="review-label">Descripción</span><span class="review-value desc"></span></div>
  `;
  $(".cat", card).textContent = CATEGORY_LABEL[w.category] || "—";
  $(".school", card).textContent = w.schoolName || "—";
  $(".region", card).textContent = w.region || "—";
  $(".desc", card).textContent = w.description;

  card.querySelectorAll(".review-photo").forEach(n => n.remove());
  if (w.photoFile && w.photoFile.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.className = "review-photo";
    img.src = URL.createObjectURL(w.photoFile);
    img.alt = "Foto adjunta";
    card.appendChild(img);
  }
}

$("#step3-back").addEventListener("click", () => goToWizardStep(2));

$("#report-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = $("#step3-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando…";
  try {
    const fd = new FormData();
    fd.append("category", state.wizard.category);
    fd.append("description", state.wizard.description.trim());
    fd.append("schoolName", state.wizard.schoolName.trim());
    fd.append("region", state.wizard.region.trim());
    fd.append("photo", state.wizard.photoFile);

    const report = await api("/api/reports", { method: "POST", body: fd });
    showToast("¡Reporte enviado! Gracias por cuidar tu escuela.");
    state.home.items = []; state.home.offset = 0;
    state.mine.items = []; state.mine.offset = 0;
    showScreen(state.cameFromScreen === "myreports" ? "myreports" : "home");
  } catch (err) {
    showToast(err.message || "No se pudo enviar el reporte.", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Enviar <span class="chev-right">›</span>`;
  }
});

/* ------------------------------------------------------------
   13) PANEL DE ADMINISTRACIÓN
   ------------------------------------------------------------ */
function renderAdminFilters() {
  const catSelect = $("#admin-filter-category");
  if (catSelect.dataset.rendered) return;
  CATEGORIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.key; opt.textContent = c.label;
    catSelect.appendChild(opt);
  });
  catSelect.dataset.rendered = "1";
  catSelect.addEventListener("change", () => { state.admin.category = catSelect.value; loadAdminReports(); });
  $("#admin-filter-status").addEventListener("change", (e) => { state.admin.status = e.target.value; loadAdminReports(); });
}

async function loadAdminReports() {
  if (!state.user || !state.user.isAdmin) { showScreen("home"); return; }
  renderAdminFilters();
  try {
    const qs = new URLSearchParams({
      ...(state.admin.category ? { category: state.admin.category } : {}),
      ...(state.admin.status ? { status: state.admin.status } : {}),
    });
    const data = await api(`/api/admin/reports?${qs.toString()}`);
    const list = $("#admin-list");
    list.innerHTML = "";
    data.items.forEach(r => list.appendChild(buildDetailedCard(r, { admin: true })));
    $("#admin-empty").hidden = data.items.length > 0;
  } catch (err) {
    showToast(err.message, true);
  }
}

async function updateReportStatus(id, status, card) {
  try {
    await api(`/api/admin/reports/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    const badge = $(".status-badge", card);
    badge.className = "status-badge status-" + status;
    badge.textContent = STATUS_LABEL[status];
    showToast("Estado actualizado.");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteReport(id, card) {
  if (!confirm("¿Eliminar este reporte de forma permanente? Esta acción no se puede deshacer.")) return;
  try {
    await api(`/api/admin/reports/${id}`, { method: "DELETE" });
    card.remove();
    showToast("Reporte eliminado.");
  } catch (err) {
    showToast(err.message, true);
  }
}

$("#admin-back").addEventListener("click", () => showScreen("home"));

/* ------------------------------------------------------------
   14) ARRANQUE
   ------------------------------------------------------------ */
window.addEventListener("DOMContentLoaded", () => {
  renderAllChrome();
  renderHomeCategoryChips();
  renderCategoryGridIfNeeded();
  initGoogleSignIn();
  checkSession();
});

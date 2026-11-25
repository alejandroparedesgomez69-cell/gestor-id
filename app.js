/* Gestor I+D — app estática. Datos en localStorage y sincronizados a un JSON en GitHub. */
"use strict";

// ═══ Constantes ═══════════════════════════════════════════════
const ESTADOS = [
  ["idea", "Idea"], ["propuesta", "Propuesta"], ["en_curso", "En curso"],
  ["en_pausa", "En pausa"], ["completado", "Completado"], ["cancelado", "Cancelado"],
];
const PRIORIDADES = [["critica", "Crítica", 4], ["alta", "Alta", 3], ["media", "Media", 2], ["baja", "Baja", 1]];
const ACT_ESTADOS = [["pendiente", "Pendiente"], ["en_curso", "En curso"], ["completada", "Completada"], ["bloqueada", "Bloqueada"]];
const BIT_TIPOS = [["nota", "Nota"], ["avance", "Avance"], ["decision", "Decisión"], ["problema", "Problema"], ["resultado", "Resultado"]];
const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
const TRL_TXT = ["", "Principios básicos", "Concepto formulado", "Prueba de concepto", "Validado en laboratorio",
  "Validado en entorno relevante", "Demostrado en entorno relevante", "Prototipo en entorno real",
  "Sistema completo cualificado", "Probado en operación real"];
const LS_DATA = "idgestor.data", LS_GH = "idgestor.gh", LS_DIRTY = "idgestor.dirty", LS_UI = "idgestor.ui";
const label = (list, k) => (list.find(x => x[0] === k) || [k, k])[1];
const prioRank = k => (PRIORIDADES.find(x => x[0] === k) || [0, 0, 0])[2];

// ═══ Utilidades ═══════════════════════════════════════════════
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const todayS = () => ymd(today());
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const diffDays = (a, b) => Math.round((pd(a) - pd(b)) / 864e5);
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_L = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const fmtD = s => { const d = pd(s); return d ? `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}` : "—"; };
const fmtDs = s => { const d = pd(s); return d ? `${d.getDate()} ${MES[d.getMonth()]}` : "—"; };
const money = n => n == null || n === "" ? "—" : "$" + Number(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });
const relTime = iso => {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "hace un momento"; if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`; return `hace ${Math.floor(s / 86400)} d`;
};
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
function toast(msg, ms = 2600) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

// ═══ Modelo ═══════════════════════════════════════════════════
let DB = lsGet(LS_DATA, null);
const UI = Object.assign({ projView: "cards", sort: "prioridad", fEstado: "activos", fPrio: "", fArea: "",
  gZoom: "mes", gFilter: "activos", calMode: "mes", calProj: "", theme: "auto", collapsed: [] }, lsGet(LS_UI, {}));
const saveUI = () => lsSet(LS_UI, UI);
let calCursor = (() => { const d = today(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
let detailTab = "resumen";

function emptyDB() { return { version: 1, actualizado: nowIso(), proyectos: [], eliminados: [] }; }

function normalize(db) {
  db = db && typeof db === "object" ? db : emptyDB();
  db.proyectos = Array.isArray(db.proyectos) ? db.proyectos : [];
  db.eliminados = Array.isArray(db.eliminados) ? db.eliminados : [];
  for (const p of db.proyectos) {
    p.actividades = Array.isArray(p.actividades) ? p.actividades : [];
    p.bitacora = Array.isArray(p.bitacora) ? p.bitacora : [];
    p.etiquetas = Array.isArray(p.etiquetas) ? p.etiquetas : [];
    p.equipo = Array.isArray(p.equipo) ? p.equipo : [];
    p.enlaces = Array.isArray(p.enlaces) ? p.enlaces : [];
    p.color = p.color || "c1";
  }
  return db;
}

const projById = id => DB.proyectos.find(p => p.id === id);

function progress(p) {
  const acts = p.actividades;
  if (!acts.length) return Math.round(p.avance || 0);
  let w = 0, s = 0;
  for (const a of acts) {
    const dur = a.hito ? 1 : Math.max(1, diffDays(a.fin, a.inicio) + 1);
    const av = a.estado === "completada" ? 100 : (a.avance || 0);
    w += dur; s += dur * av;
  }
  return Math.round(s / w);
}
const byStart = (x, y) => ((x.inicio || x.fin || "") + (x.fin || "")).localeCompare((y.inicio || y.fin || "") + (y.fin || ""));
const actLate = a => a.estado !== "completada" && a.fin && pd(a.fin) < today();
const projActive = p => !["completado", "cancelado"].includes(p.estado);
const projLate = p => projActive(p) && p.fin && pd(p.fin) < today();
function projRange(p) {
  let a = p.inicio, b = p.fin;
  for (const x of p.actividades) {
    if (x.inicio && (!a || x.inicio < a)) a = x.inicio;
    if (x.fin && (!b || x.fin > b)) b = x.fin;
  }
  return [a, b || a];
}

// ── Mutaciones (todas pasan por aquí → guardado + commit) ──
let pendingMsgs = [];
function commit(msg, p) {
  if (p) p.actualizado = nowIso();
  DB.actualizado = nowIso();
  lsSet(LS_DATA, DB);
  pendingMsgs.push(msg);
  Sync.markDirty();
  render();
}

// ═══ Sincronización con GitHub ═══════════════════════════════
const Sync = {
  // via: "token" = el navegador habla directo con api.github.com usando un token
  //      "gh"    = el servidor local (servidor.py) usa la sesión de GitHub CLI; sin token en el navegador
  cfg: Object.assign({ owner: "", repo: "", branch: "main", path: "data/proyectos.json", token: "", via: "token" }, lsGet(LS_GH, {})),
  sha: null, state: "local", lastSync: null, error: "", timer: null, busy: false,
  get gh() { return this.cfg.via === "gh"; },
  get on() { return !!(this.cfg.owner && this.cfg.repo && (this.gh || this.cfg.token)); },
  base() { return this.gh ? "/gh/repos/" : "https://api.github.com/repos/"; },
  api(path) { return `${this.base()}${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}${path}`; },
  headers() {
    const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (!this.gh) h.Authorization = `Bearer ${cleanToken(this.cfg.token)}`;
    return h;
  },
  fileUrl(withRef) {
    const p = this.cfg.path.split("/").map(encodeURIComponent).join("/");
    return this.api(`/contents/${p}`) + (withRef ? `?ref=${encodeURIComponent(this.cfg.branch)}` : "");
  },
  async pull() {
    const r = await fetch(this.fileUrl(true), { headers: this.headers(), cache: "no-store" });
    if (r.status === 404) { this.sha = null; return null; }
    if (!r.ok) throw new Error(await errText(r));
    const j = await r.json();
    this.sha = j.sha;
    let b64 = j.content;
    if (!b64 && j.git_url) { // archivo > 1 MB: leer blob
      const blobUrl = this.gh ? j.git_url.replace("https://api.github.com/", "/gh/") : j.git_url;
      const rb = await fetch(blobUrl, { headers: this.headers() });
      b64 = (await rb.json()).content;
    }
    return normalize(JSON.parse(b64dec(b64)));
  },
  async push(message) {
    const body = { message, content: b64enc(JSON.stringify(DB, null, 2) + "\n"), branch: this.cfg.branch };
    if (this.sha) body.sha = this.sha;
    const r = await fetch(this.fileUrl(false), { method: "PUT", headers: this.headers(), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) { const e = new Error("conflicto"); e.conflict = true; e.detail = await errText(r); throw e; }
    if (!r.ok) throw new Error(await errText(r));
    this.sha = (await r.json()).content.sha;
  },
  markDirty() {
    lsSet(LS_DIRTY, true);
    if (!this.on) { this.set("local"); return; }
    this.set("dirty");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 2500);
  },
  async save() {
    if (!this.on || this.busy) return;
    clearTimeout(this.timer);
    this.busy = true; this.set("busy");
    const msgs = pendingMsgs.splice(0);
    const message = msgs.length === 1 ? msgs[0] : msgs.length ? `${msgs.length} cambios: ${[...new Set(msgs)].slice(0, 4).join("; ")}` : "Sincronizar datos";
    try {
      try { await this.push(message); }
      catch (e) {
        if (!e.conflict) throw e;
        // Alguien más guardó: combinar por proyecto (gana el más reciente) y reintentar
        const remote = await this.pull();
        DB = merge(DB, remote); lsSet(LS_DATA, DB);
        await this.push(message + " (combinado)");
        toast("Se combinaron cambios hechos desde otro lugar");
        render();
      }
      lsSet(LS_DIRTY, false);
      this.lastSync = nowIso(); this.error = ""; this.set("ok");
    } catch (e) {
      pendingMsgs.unshift(...msgs);
      this.error = e.message; this.set("err");
    } finally { this.busy = false; }
  },
  async init() {
    if (!this.on) { this.set("local"); return; }
    this.busy = true; this.set("busy");
    try {
      const remote = await this.pull();
      const localDirty = lsGet(LS_DIRTY, false);
      if (!remote) { // repo sin archivo: subir lo local
        this.busy = false; pendingMsgs.push("Crear base de datos del gestor I+D"); await this.save(); return;
      }
      DB = localDirty && DB ? merge(DB, remote) : remote;
      lsSet(LS_DATA, DB);
      this.busy = false;
      if (localDirty) { pendingMsgs.push("Subir cambios hechos sin conexión"); await this.save(); }
      else { this.lastSync = nowIso(); this.error = ""; this.set("ok"); }
      render();
    } catch (e) { this.busy = false; this.error = e.message; this.set("err"); }
  },
  async refresh() { // traer cambios remotos si no hay pendientes
    if (!this.on || this.busy || lsGet(LS_DIRTY, false)) return;
    try {
      const prev = this.sha; const remote = await this.pull();
      if (remote && this.sha !== prev) { DB = remote; lsSet(LS_DATA, DB); render(); toast("Datos actualizados desde GitHub"); }
      this.lastSync = nowIso(); this.set("ok");
    } catch (e) { this.error = e.message; this.set("err"); }
  },
  set(s) { this.state = s; renderSync(); },
};

async function errText(r) {
  let m = ""; try { m = (await r.json()).message || ""; } catch { m = r.statusText || ""; }
  return ghMsg(r.status, m);
}
// Mensajes de error de GitHub en lenguaje claro
function ghMsg(s, m = "") {
  if (s === 401) return "GitHub rechazó el token (401): está mal copiado, vencido o se regeneró después. Pega el valor actual en «GitHub y ajustes».";
  if (s === 403 && /rate limit/i.test(m)) return "GitHub limitó las peticiones por un rato (403). Espera unos minutos y vuelve a intentar.";
  if (s === 403) return `Sin permiso (403): el token necesita acceso a este repositorio con «Contents: Read and write».${m ? " GitHub dice: " + m : ""}`;
  return `${s} ${m}`.trim();
}
// Quita espacios y caracteres invisibles que se cuelan al copiar el token
function cleanToken(t) { return String(t || "").replace(/[\s ​-‍⁠﻿]/g, ""); }
function tokenProblem(t) {
  if (/[^\x21-\x7E]/.test(t)) return "El token tiene caracteres extraños (quizá se copió con formato desde un correo o chat). Cópialo de nuevo directo desde GitHub.";
  if (!/^(github_pat_|ghp_|gho_|ghu_)/.test(t)) return "Esto no parece un token de GitHub: un token fine-grained empieza con «github_pat_». Revisa que lo copiaste completo.";
  return "";
}
function b64enc(str) {
  const bytes = new TextEncoder().encode(str); let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64dec(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function merge(local, remote) {
  local = normalize(local); remote = normalize(remote);
  const tomb = new Map();
  for (const t of [...local.eliminados, ...remote.eliminados]) if (!tomb.has(t.id) || tomb.get(t.id) < t.fecha) tomb.set(t.id, t.fecha);
  const map = new Map();
  for (const p of [...remote.proyectos, ...local.proyectos]) {
    const cur = map.get(p.id);
    if (!cur || (p.actualizado || "") > (cur.actualizado || "")) map.set(p.id, p);
  }
  const proyectos = [...map.values()].filter(p => !tomb.has(p.id) || tomb.get(p.id) < (p.actualizado || ""));
  return { version: 1, actualizado: nowIso(), proyectos, eliminados: [...tomb].map(([id, fecha]) => ({ id, fecha })).slice(-500) };
}

function renderSync() {
  const el = $("#sync"); if (!el) return;
  const S = Sync, st = S.state;
  const map = {
    local: ["", "Solo en este navegador", "Conecta GitHub en Ajustes para guardar la base de datos"],
    ok: ["ok", "Guardado en GitHub", S.lastSync ? relTime(S.lastSync) : ""],
    dirty: ["dirty", "Cambios por guardar…", "se suben en unos segundos"],
    busy: ["busy", "Sincronizando…", ""],
    err: ["err", "Error al sincronizar", S.error],
  };
  const [cls, t, sub] = map[st];
  el.innerHTML = `<div class="row"><span class="dot ${cls}"></span><b>${esc(t)}</b></div>
    ${sub ? `<div>${esc(sub)}</div>` : ""}
    ${S.on ? `<div class="small">${esc(S.cfg.owner)}/${esc(S.cfg.repo)}${S.gh ? " · vía GitHub CLI" : ""}</div>` : ""}
    ${st === "err" || st === "dirty" ? `<button class="btn sm" id="syncNow">Reintentar ahora</button>` : ""}`;
  const b = $("#syncNow", el); if (b) b.onclick = () => Sync.save();
}
setInterval(() => { if (Sync.state === "ok") renderSync(); }, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) Sync.refresh(); });
window.addEventListener("beforeunload", e => { if (Sync.on && lsGet(LS_DIRTY, false)) { Sync.save(); e.preventDefault(); } });

// ═══ Router ═══════════════════════════════════════════════════
function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  return { name: h[0] || "panel", id: h[1] };
}
const go = path => { location.hash = "#/" + path; };
window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });

let q = "";
$("#q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); render(); });
$("#newProject").onclick = () => projectDialog();
$$("#nav button").forEach(b => b.onclick = () => go(b.dataset.route));

function matchQ(p) {
  if (!q) return true;
  return [p.codigo, p.titulo, p.descripcion, p.area, p.responsable, ...p.etiquetas, ...p.equipo].join(" ").toLowerCase().includes(q);
}

function render() {
  applyTheme();
  const r = route();
  $$("#nav button").forEach(b => b.setAttribute("aria-current", b.dataset.route === (r.name === "proyecto" ? "proyectos" : r.name) ? "page" : "false"));
  const v = $("#view");
  const views = { panel: viewPanel, proyectos: viewProyectos, proyecto: viewDetalle, gantt: viewGantt, calendario: viewCalendario, ajustes: viewAjustes };
  (views[r.name] || viewPanel)(v, r);
  renderSync();
}
function setTitle(t) { $("#title").textContent = t; document.title = t + " · Gestor I+D"; }

// ═══ Componentes ══════════════════════════════════════════════
const badgeEstado = k => `<span class="badge st-${k}"><i></i>${esc(label(ESTADOS, k))}</span>`;
const badgePrio = k => `<span class="badge prio-${k}"><i></i>${esc(label(PRIORIDADES, k))}</span>`;
const badgeAct = a => {
  const map = { pendiente: "idea", en_curso: "en_curso", completada: "completado", bloqueada: "cancelado" };
  return `<span class="badge st-${map[a.estado] || "idea"}"><i></i>${esc(label(ACT_ESTADOS, a.estado))}${actLate(a) ? " · atrasada" : ""}</span>`;
};
const trlBar = n => `<span class="trl" title="TRL ${n}: ${esc(TRL_TXT[n] || "")}">${Array.from({ length: 9 }, (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("")}</span>`;
const pc = p => `--pc: var(--${p.color || "c1"})`;

function projCard(p) {
  const pr = progress(p), [a, b] = projRange(p);
  const late = projLate(p), lateActs = p.actividades.filter(actLate).length;
  return `<div class="card pcard" style="${pc(p)}" data-open="${p.id}" draggable="true" data-id="${p.id}">
    <div class="row-between"><span class="code">${esc(p.codigo || "")}</span>${badgePrio(p.prioridad)}</div>
    <div class="title">${esc(p.titulo)}</div>
    ${p.descripcion ? `<div class="desc">${esc(p.descripcion)}</div>` : ""}
    <div class="meta">${badgeEstado(p.estado)}${p.trl ? `<span class="badge">TRL ${p.trl}</span>` : ""}${p.etiquetas.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div><div class="row-between small"><span>Avance ${pr}%</span><span>${fmtDs(a)} → ${fmtDs(b)}</span></div>
      <div class="progress" style="margin-top:4px"><span style="width:${pr}%"></span></div></div>
    ${late || lateActs ? `<div class="small" style="color:var(--crit)">${late ? "Fecha de término vencida" : ""}${late && lateActs ? " · " : ""}${lateActs ? `${lateActs} actividad(es) atrasada(s)` : ""}</div>` : ""}
    ${p.responsable ? `<div class="small">Responsable: ${esc(p.responsable)}</div>` : ""}
  </div>`;
}
function bindOpen(root) { $$("[data-open]", root).forEach(el => el.addEventListener("click", () => go("proyecto/" + el.dataset.open))); }

// ═══ Vista: Panel ═════════════════════════════════════════════
function viewPanel(v) {
  setTitle("Panel");
  const ps = DB.proyectos;
  if (!ps.length) { v.innerHTML = emptyState(); bindEmpty(v); return; }
  const act = ps.filter(p => p.estado === "en_curso");
  const avg = act.length ? Math.round(act.reduce((s, p) => s + progress(p), 0) / act.length) : 0;
  const lateActs = ps.filter(projActive).flatMap(p => p.actividades.filter(actLate).map(a => ({ p, a })));
  const t0 = today(), t30 = addDays(t0, 30);
  const upcoming = ps.filter(projActive).flatMap(p => p.actividades
    .filter(a => a.estado !== "completada" && a.fin && pd(a.fin) >= t0 && pd(a.fin) <= t30).map(a => ({ p, a })))
    .sort((x, y) => x.a.fin.localeCompare(y.a.fin));
  const hitos = upcoming.filter(x => x.a.hito).length;
  const pres = ps.filter(projActive).reduce((s, p) => s + (+p.presupuesto || 0), 0);
  const gas = ps.filter(projActive).reduce((s, p) => s + (+p.gastado || 0), 0);
  const counts = ESTADOS.map(([k, l]) => [k, l, ps.filter(p => p.estado === k).length]);
  const maxC = Math.max(1, ...counts.map(c => c[2]));
  const prioList = ps.filter(projActive).sort((a, b) => prioRank(b.prioridad) - prioRank(a.prioridad) || (a.fin || "").localeCompare(b.fin || "")).slice(0, 8);

  v.innerHTML = `
  <div class="grid kpis">
    <div class="card kpi"><div class="k">Proyectos en curso</div><div class="v">${act.length}</div><div class="s">${ps.filter(projActive).length} activos de ${ps.length} en total</div></div>
    <div class="card kpi"><div class="k">Avance promedio</div><div class="v">${avg}%</div><div class="s">de los proyectos en curso</div></div>
    <div class="card kpi"><div class="k">Actividades atrasadas</div><div class="v" style="${lateActs.length ? "color:var(--crit)" : ""}">${lateActs.length}</div><div class="s">fin vencido sin completar</div></div>
    <div class="card kpi"><div class="k">Próximos 30 días</div><div class="v">${upcoming.length}</div><div class="s">entregas, ${hitos} hito(s)</div></div>
    <div class="card kpi"><div class="k">Presupuesto activo</div><div class="v" style="font-size:24px">${money(pres)}</div><div class="s">ejecutado ${money(gas)}${pres ? ` (${Math.round(gas / pres * 100)}%)` : ""}</div></div>
  </div>
  <div class="grid two">
    <div class="card"><h2>Requiere atención</h2>${lateActs.length || ps.some(projLate) ? `<div class="agenda">
      ${ps.filter(projLate).map(p => `<div class="it" data-open="${p.id}" style="${pc(p)}"><span class="swatch" style="background:var(--pc)"></span><span class="date" style="color:var(--crit)">venció ${fmtDs(p.fin)}</span><span><b>${esc(p.titulo)}</b> — término del proyecto</span></div>`).join("")}
      ${lateActs.slice(0, 10).map(({ p, a }) => `<div class="it" data-act="${p.id}|${a.id}" style="${pc(p)}"><span class="swatch" style="background:var(--pc)"></span><span class="date" style="color:var(--crit)">venció ${fmtDs(a.fin)}</span><span>${esc(a.nombre)} <span class="small">· ${esc(p.titulo)}</span></span></div>`).join("")}
    </div>` : `<div class="empty">Nada atrasado. 👌</div>`}</div>
    <div class="card"><h2>Próximas entregas (30 días)</h2>${upcoming.length ? `<div class="agenda">
      ${upcoming.slice(0, 10).map(({ p, a }) => `<div class="it" data-act="${p.id}|${a.id}" style="${pc(p)}"><span class="swatch" style="background:var(--pc)"></span><span class="date">${fmtDs(a.fin)} · ${diffDays(a.fin, todayS())} d</span><span>${a.hito ? "◆ " : ""}${esc(a.nombre)} <span class="small">· ${esc(p.titulo)}</span></span></div>`).join("")}
    </div>` : `<div class="empty">Sin entregas en los próximos 30 días</div>`}</div>
    <div class="card"><h2>Proyectos por estado</h2>
      <div style="display:grid;gap:8px">${counts.map(([k, l, n]) => `<div style="display:grid;grid-template-columns:110px 1fr 28px;gap:8px;align-items:center">
        <span class="badge st-${k}" style="justify-self:start"><i></i>${l}</span>
        <div class="progress" style="height:10px"><span style="width:${n / maxC * 100}%;background:var(--text-2)"></span></div>
        <span class="small" style="text-align:right;color:var(--text)">${n}</span></div>`).join("")}</div></div>
    <div class="card"><h2>Activos por prioridad</h2>${prioList.length ? `<table><tbody>${prioList.map(p => `<tr class="click" data-open="${p.id}" style="${pc(p)}">
        <td><span class="swatch" style="background:var(--pc)"></span></td><td><b>${esc(p.titulo)}</b><div class="small">${esc(p.codigo || "")}</div></td>
        <td>${badgePrio(p.prioridad)}</td><td style="width:110px"><div class="progress"><span style="width:${progress(p)}%"></span></div><div class="small">${progress(p)}%</div></td></tr>`).join("")}</tbody></table>` : `<div class="empty">Sin proyectos activos</div>`}</div>
  </div>`;
  bindOpen(v);
  $$("[data-act]", v).forEach(el => el.onclick = () => { const [pid, aid] = el.dataset.act.split("|"); activityDialog(projById(pid), aid); });
}

function emptyState() {
  return `<div class="card empty" style="padding:48px 20px">
    <h2 style="color:var(--text)">Aún no hay proyectos</h2>
    <p>Crea tu primer proyecto de I+D o carga algunos de ejemplo para explorar la app.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn primary" id="eNew">Crear proyecto</button><button class="btn" id="eSeed">Cargar ejemplos</button></div></div>`;
}
function bindEmpty(v) { $("#eNew", v).onclick = () => projectDialog(); $("#eSeed", v).onclick = () => { seed(); commit("Cargar proyectos de ejemplo"); }; }

// ═══ Vista: Proyectos ═════════════════════════════════════════
function filteredProjects() {
  return DB.proyectos.filter(p => matchQ(p)
    && (UI.fEstado === "" || (UI.fEstado === "activos" ? projActive(p) : p.estado === UI.fEstado))
    && (!UI.fPrio || p.prioridad === UI.fPrio) && (!UI.fArea || p.area === UI.fArea));
}
function sortProjects(list) {
  const s = UI.sort, k = {
    prioridad: (a, b) => prioRank(b.prioridad) - prioRank(a.prioridad) || (a.fin || "9").localeCompare(b.fin || "9"),
    fin: (a, b) => (projRange(a)[1] || "9").localeCompare(projRange(b)[1] || "9"),
    avance: (a, b) => progress(b) - progress(a),
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, "es"),
    codigo: (a, b) => (a.codigo || "").localeCompare(b.codigo || "", "es", { numeric: true }),
    actualizado: (a, b) => (b.actualizado || "").localeCompare(a.actualizado || ""),
    trl: (a, b) => (b.trl || 0) - (a.trl || 0),
  }[s] || (() => 0);
  return list.sort(k);
}
function viewProyectos(v) {
  setTitle("Proyectos");
  if (!DB.proyectos.length) { v.innerHTML = emptyState(); bindEmpty(v); return; }
  const areas = [...new Set(DB.proyectos.map(p => p.area).filter(Boolean))].sort();
  const list = sortProjects(filteredProjects());
  const opt = (arr, cur) => arr.map(([k, l]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${l}</option>`).join("");
  v.innerHTML = `<div class="toolbar">
    <div class="seg" id="pv">${[["cards", "Tarjetas"], ["tabla", "Tabla"], ["kanban", "Tablero"]].map(([k, l]) => `<button data-v="${k}" aria-pressed="${UI.projView === k}">${l}</button>`).join("")}</div>
    <select id="fEstado" aria-label="Estado">${opt([["activos", "Activos"], ["", "Todos los estados"], ...ESTADOS], UI.fEstado)}</select>
    <select id="fPrio" aria-label="Prioridad">${opt([["", "Toda prioridad"], ...PRIORIDADES], UI.fPrio)}</select>
    <select id="fArea" aria-label="Área">${opt([["", "Todas las áreas"], ...areas.map(a => [a, a])], UI.fArea)}</select>
    <span class="grow"></span>
    <label class="small">Ordenar <select id="sort">${opt([["prioridad", "Prioridad"], ["fin", "Fecha término"], ["avance", "Avance"], ["titulo", "Título"], ["codigo", "Código"], ["trl", "TRL"], ["actualizado", "Última edición"]], UI.sort)}</select></label>
  </div><div id="plist"></div>`;
  $$("#pv button", v).forEach(b => b.onclick = () => { UI.projView = b.dataset.v; saveUI(); render(); });
  for (const id of ["fEstado", "fPrio", "fArea", "sort"]) $("#" + id, v).onchange = e => { UI[id] = e.target.value; saveUI(); render(); };
  const box = $("#plist", v);
  if (UI.projView === "kanban") return renderKanban(box);
  if (!list.length) { box.innerHTML = `<div class="card empty">Ningún proyecto coincide con los filtros.</div>`; return; }
  if (UI.projView === "tabla") {
    box.innerHTML = `<div class="card tablewrap" style="padding:0"><table><thead><tr>
      <th></th><th>Código</th><th>Proyecto</th><th>Estado</th><th>Prioridad</th><th>TRL</th><th>Responsable</th><th>Inicio</th><th>Término</th><th>Avance</th><th class="num">Presupuesto</th></tr></thead><tbody>
      ${list.map(p => { const [a, b] = projRange(p); return `<tr class="click" data-open="${p.id}" style="${pc(p)}">
        <td><span class="swatch" style="background:var(--pc)"></span></td><td class="small">${esc(p.codigo || "")}</td>
        <td><b>${esc(p.titulo)}</b>${p.area ? `<div class="small">${esc(p.area)}</div>` : ""}</td>
        <td>${badgeEstado(p.estado)}</td><td>${badgePrio(p.prioridad)}</td><td>${p.trl ? trlBar(p.trl) : "—"}</td>
        <td>${esc(p.responsable || "—")}</td><td>${fmtDs(a)}</td><td style="${projLate(p) ? "color:var(--crit)" : ""}">${fmtDs(b)}</td>
        <td style="min-width:90px"><div class="progress"><span style="width:${progress(p)}%"></span></div><div class="small">${progress(p)}%</div></td>
        <td class="num">${money(p.presupuesto)}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  } else {
    box.innerHTML = `<div class="grid cards">${list.map(projCard).join("")}</div>`;
  }
  bindOpen(box);
}
function renderKanban(box) {
  const list = sortProjects(DB.proyectos.filter(p => matchQ(p) && (!UI.fPrio || p.prioridad === UI.fPrio) && (!UI.fArea || p.area === UI.fArea)));
  box.innerHTML = `<div class="kanban">${ESTADOS.map(([k, l]) => `<div class="kcol" data-st="${k}">
    <h3><span class="badge st-${k}"><i></i>${l}</span><span class="small">${list.filter(p => p.estado === k).length}</span></h3>
    ${list.filter(p => p.estado === k).map(projCard).join("")}</div>`).join("")}</div>
    <p class="hint">Arrastra una tarjeta a otra columna para cambiar su estado.</p>`;
  bindOpen(box);
  $$(".pcard", box).forEach(c => c.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", c.dataset.id)));
  $$(".kcol", box).forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", () => col.classList.remove("drop"));
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("drop");
      const p = projById(e.dataTransfer.getData("text/plain"));
      if (p && p.estado !== col.dataset.st) { p.estado = col.dataset.st; commit(`Estado de "${p.titulo}" → ${label(ESTADOS, p.estado)}`, p); }
    });
  });
}

// ═══ Vista: Detalle de proyecto ═══════════════════════════════
function viewDetalle(v, r) {
  const p = projById(r.id);
  if (!p) { setTitle("Proyecto"); v.innerHTML = `<div class="card empty">Proyecto no encontrado. <a href="#/proyectos">Volver a proyectos</a></div>`; return; }
  setTitle(p.titulo);
  const [a, b] = projRange(p), pr = progress(p);
  const dur = a && b ? diffDays(b, a) + 1 : null;
  const tabs = [["resumen", "Resumen"], ["actividades", `Actividades (${p.actividades.length})`], ["gantt", "Gantt"], ["bitacora", `Bitácora (${p.bitacora.length})`]];
  v.innerHTML = `
  <div class="small" style="margin-bottom:8px"><a href="#/proyectos">← Proyectos</a></div>
  <div class="detail-head" style="${pc(p)}">
    <span class="swatch" style="background:var(--pc);width:14px;height:44px;border-radius:4px"></span>
    <div class="t"><div class="small">${esc(p.codigo || "")}${p.area ? " · " + esc(p.area) : ""}</div><h2>${esc(p.titulo)}</h2>
      <div class="meta">${badgeEstado(p.estado)}${badgePrio(p.prioridad)}${p.trl ? `<span class="badge">TRL ${p.trl} · ${esc(TRL_TXT[p.trl])}</span>` : ""}${p.etiquetas.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn" id="dAct">+ Actividad</button><button class="btn" id="dLog">+ Bitácora</button>
      <button class="btn primary" id="dEdit">Editar</button></div>
  </div>
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-t="${k}" aria-selected="${detailTab === k}">${l}</button>`).join("")}</div>
  <div id="tab"></div>`;
  $$(".tabs button", v).forEach(bt => bt.onclick = () => { detailTab = bt.dataset.t; render(); });
  $("#dEdit", v).onclick = () => projectDialog(p);
  $("#dAct", v).onclick = () => activityDialog(p);
  $("#dLog", v).onclick = () => logDialog(p);
  const t = $("#tab", v);

  if (detailTab === "resumen") {
    const gp = p.presupuesto ? Math.round((+p.gastado || 0) / p.presupuesto * 100) : null;
    t.innerHTML = `<div class="grid two" style="margin-top:0">
      <div class="card"><h2>Descripción</h2><div class="prose">${esc(p.descripcion || "Sin descripción")}</div>
        ${p.objetivos ? `<h3 style="margin-top:16px">Objetivos</h3><div class="prose">${esc(p.objetivos)}</div>` : ""}
        ${p.resultados ? `<h3 style="margin-top:16px">Resultados esperados / entregables</h3><div class="prose">${esc(p.resultados)}</div>` : ""}
        ${p.enlaces.length ? `<h3 style="margin-top:16px">Enlaces</h3>${p.enlaces.map(l => `<div><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.t || l.url)}</a></div>`).join("")}` : ""}
      </div>
      <div class="grid" style="gap:14px;align-content:start">
        <div class="card"><h2>Avance ${pr}%</h2><div class="progress" style="height:10px;${pc(p)}"><span style="width:${pr}%"></span></div>
          <div class="small" style="margin-top:6px">${p.actividades.length ? `Calculado de ${p.actividades.length} actividades (ponderado por duración)` : "Avance manual (agrega actividades para calcularlo)"}</div></div>
        <div class="card"><div class="facts">
          <div class="f"><div class="k">Responsable</div><div class="v">${esc(p.responsable || "—")}</div></div>
          <div class="f"><div class="k">Equipo</div><div class="v">${esc(p.equipo.join(", ") || "—")}</div></div>
          <div class="f"><div class="k">Inicio</div><div class="v">${fmtD(a)}</div></div>
          <div class="f"><div class="k">Término</div><div class="v" style="${projLate(p) ? "color:var(--crit)" : ""}">${fmtD(b)}</div></div>
          <div class="f"><div class="k">Duración</div><div class="v">${dur ? dur + " días" : "—"}</div></div>
          <div class="f"><div class="k">Restan</div><div class="v">${b && projActive(p) ? diffDays(b, todayS()) + " días" : "—"}</div></div>
          <div class="f"><div class="k">Presupuesto</div><div class="v">${money(p.presupuesto)}</div></div>
          <div class="f"><div class="k">Ejecutado</div><div class="v">${money(p.gastado)}${gp != null ? ` · ${gp}%` : ""}</div></div>
          <div class="f"><div class="k">Nivel TRL</div><div class="v">${p.trl ? trlBar(p.trl) : "—"}</div></div>
          <div class="f"><div class="k">Última edición</div><div class="v">${p.actualizado ? relTime(p.actualizado) : "—"}</div></div>
        </div></div>
      </div></div>`;
  } else if (detailTab === "actividades") {
    const acts = [...p.actividades].sort(byStart);
    t.innerHTML = acts.length ? `<div class="card tablewrap" style="padding:0"><table><thead><tr>
      <th>Actividad</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th class="num">Días</th><th>Estado</th><th>Avance</th></tr></thead><tbody>
      ${acts.map(x => `<tr class="click" data-a="${x.id}"><td>${x.hito ? "◆ " : ""}<b>${esc(x.nombre)}</b>${x.depende?.length ? `<div class="small">depende de: ${esc(x.depende.map(d => p.actividades.find(y => y.id === d)?.nombre).filter(Boolean).join(", "))}</div>` : ""}</td>
        <td>${esc(x.responsable || "—")}</td><td>${fmtDs(x.inicio)}</td><td style="${actLate(x) ? "color:var(--crit)" : ""}">${fmtDs(x.fin)}</td>
        <td class="num">${x.inicio && x.fin ? diffDays(x.fin, x.inicio) + 1 : "—"}</td><td>${badgeAct(x)}</td>
        <td style="min-width:90px;${pc(p)}"><div class="progress"><span style="width:${x.estado === "completada" ? 100 : x.avance || 0}%"></span></div><div class="small">${x.estado === "completada" ? 100 : x.avance || 0}%</div></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="card empty">Sin actividades. Usa «+ Actividad» para planificar el trabajo y alimentar el Gantt y el calendario.</div>`;
    $$("[data-a]", t).forEach(el => el.onclick = () => activityDialog(p, el.dataset.a));
  } else if (detailTab === "gantt") {
    t.innerHTML = `<div class="toolbar">${zoomSeg()}</div><div id="gbox"></div>`;
    bindZoom(t);
    drawGantt($("#gbox", t), [p], true);
  } else {
    const logs = [...p.bitacora].sort((x, y) => (y.fecha + y.id).localeCompare(x.fecha + x.id));
    t.innerHTML = logs.length ? `<div class="card"><div class="log">${logs.map(e => `<div class="e">
      <div class="h"><b style="color:var(--text)">${fmtD(e.fecha)}</b><span class="tag">${esc(label(BIT_TIPOS, e.tipo || "nota"))}</span>${e.autor ? `<span>${esc(e.autor)}</span>` : ""}
        <span style="flex:1"></span><button class="btn ghost sm" data-le="${e.id}">Editar</button></div>
      <div class="prose">${esc(e.texto)}</div></div>`).join("")}</div></div>`
      : `<div class="card empty">La bitácora registra avances, decisiones, problemas y resultados del proyecto con fecha.</div>`;
    $$("[data-le]", t).forEach(bt => bt.onclick = () => logDialog(p, bt.dataset.le));
  }
}
const safeUrl = u => /^(https?:|mailto:)/i.test(u || "") ? u : "#";

// ═══ Gantt ════════════════════════════════════════════════════
const ZOOMS = { semana: 36, mes: 14, trimestre: 5, anio: 2 };
const zoomSeg = () => `<div class="seg" id="gz">${[["semana", "Semana"], ["mes", "Mes"], ["trimestre", "Trimestre"], ["anio", "Año"]].map(([k, l]) => `<button data-z="${k}" aria-pressed="${UI.gZoom === k}">${l}</button>`).join("")}</div>`;
function bindZoom(root) { $$("#gz button", root).forEach(b => b.onclick = () => { UI.gZoom = b.dataset.z; saveUI(); render(); }); }

function viewGantt(v) {
  setTitle("Gantt");
  const list = sortProjects(DB.proyectos.filter(p => matchQ(p) && (UI.gFilter === "todos" || projActive(p))));
  v.innerHTML = `<div class="toolbar">${zoomSeg()}
    <div class="seg" id="gf"><button data-f="activos" aria-pressed="${UI.gFilter === "activos"}">Activos</button><button data-f="todos" aria-pressed="${UI.gFilter === "todos"}">Todos</button></div>
    <button class="btn" id="gExp">Expandir todo</button><button class="btn" id="gCol">Contraer todo</button>
    <span class="grow"></span><button class="btn" id="gToday">Ir a hoy</button></div><div id="gbox"></div>
    <p class="hint">Barra gruesa: actividad (relleno = avance). Barra delgada: duración total del proyecto. ◆ hito. Borde rojo: atrasada. Clic en una barra para editarla.</p>`;
  bindZoom(v);
  $$("#gf button", v).forEach(b => b.onclick = () => { UI.gFilter = b.dataset.f; saveUI(); render(); });
  $("#gExp", v).onclick = () => { UI.collapsed = []; saveUI(); render(); };
  $("#gCol", v).onclick = () => { UI.collapsed = DB.proyectos.map(p => p.id); saveUI(); render(); };
  $("#gToday", v).onclick = () => scrollToToday($("#gbox", v));
  if (!list.length) { $("#gbox", v).innerHTML = `<div class="card empty">Sin proyectos para mostrar.</div>`; return; }
  drawGantt($("#gbox", v), list, false);
}
function scrollToToday(box) { const r = $(".g-right", box), t = $(".g-today", box); if (r && t) r.scrollLeft = Math.max(0, parseFloat(t.style.left) - 120); }

function drawGantt(box, projects, single) {
  const ppd = ZOOMS[UI.gZoom] || 14;
  // Rango de fechas
  let min = null, max = null;
  for (const p of projects) { const [a, b] = projRange(p); if (a && (!min || a < min)) min = a; if (b && (!max || b > max)) max = b; }
  const t = todayS();
  if (!min) min = t; if (!max) max = t;
  if (t < min) min = t; if (t > max) max = t;
  let start = addDays(pd(min), -7), end = addDays(pd(max), 21);
  if (UI.gZoom !== "semana") start = new Date(start.getFullYear(), start.getMonth(), 1);
  const days = Math.round((end - start) / 864e5) + 1;
  const W = days * ppd;
  const X = s => Math.round((pd(s) - start) / 864e5) * ppd;

  // Filas
  const rows = [];
  for (const p of projects) {
    const [a, b] = projRange(p);
    if (!single) rows.push({ kind: "proj", p, a, b });
    if (single || !UI.collapsed.includes(p.id)) {
      for (const x of [...p.actividades].sort(byStart)) rows.push({ kind: "task", p, x });
    }
  }
  if (single && !rows.length) { box.innerHTML = `<div class="card empty">Agrega actividades para ver el Gantt de este proyecto.</div>`; return; }

  // Escala
  let scale = "", lines = "";
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const x = Math.round((d - start) / 864e5) * ppd, dow = d.getDay();
    if (d.getDate() === 1 || +d === +start) {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const w = Math.min(Math.round((next - d) / 864e5) * ppd, W - x);
      scale += `<div class="m" style="left:${x}px;width:${w}px">${UI.gZoom === "anio" ? MES[d.getMonth()] + (d.getMonth() === 0 || +d === +start ? " " + d.getFullYear() : "") : MES_L[d.getMonth()] + " " + d.getFullYear()}</div>`;
    }
    if (UI.gZoom === "semana") {
      scale += `<div class="d" style="left:${x}px;width:${ppd}px">${"DLMMJVS"[dow]}${d.getDate()}</div>`;
      if (dow === 0 || dow === 6) lines += `<div class="we" style="left:${x}px;width:${ppd}px"></div>`;
    } else if (UI.gZoom === "mes") {
      if (dow === 1) scale += `<div class="d" style="left:${x}px;width:${ppd * 7}px">${d.getDate()}</div>`;
      if (dow === 0 || dow === 6) lines += `<div class="we" style="left:${x}px;width:${ppd}px"></div>`;
    } else if (UI.gZoom === "trimestre" && dow === 1) {
      scale += `<div class="d" style="left:${x}px;width:${ppd * 7}px">${d.getDate()}</div>`;
    }
    if (dow === 1 && UI.gZoom !== "anio") lines += `<div class="wk" style="left:${x}px"></div>`;
    if (UI.gZoom === "anio" && d.getDate() === 1) lines += `<div class="wk" style="left:${x}px"></div>`;
  }
  const todayX = X(t) + ppd / 2;

  // Barras
  const rowIdx = new Map(); // actividad id → índice de fila (para dependencias)
  const bars = rows.map((r, i) => {
    if (r.kind === "proj") {
      if (!r.a) return `<div class="g-brow"></div>`;
      const pr = progress(r.p), x = X(r.a), w = Math.max(ppd, X(r.b) - x + ppd);
      return `<div class="g-brow" style="${pc(r.p)}"><div class="g-bar proj ${projLate(r.p) ? "late" : ""}" data-open="${r.p.id}" style="left:${x}px;width:${w}px" title="${esc(r.p.titulo)}: ${fmtD(r.a)} → ${fmtD(r.b)} · ${pr}%"><span style="width:${pr}%"></span></div>
        <span class="g-label" style="left:${x + w + 6}px">${pr}%</span></div>`;
    }
    const x0 = r.x; rowIdx.set(x0.id, i);
    if (!x0.fin) return `<div class="g-brow"></div>`;
    const av = x0.estado === "completada" ? 100 : x0.avance || 0;
    const tip = `${esc(x0.nombre)}: ${fmtD(x0.inicio)} → ${fmtD(x0.fin)} · ${av}% · ${esc(label(ACT_ESTADOS, x0.estado))}`;
    if (x0.hito) return `<div class="g-brow" style="${pc(r.p)}"><div class="g-ms" data-act="${r.p.id}|${x0.id}" style="left:${X(x0.fin) + ppd / 2 - 7}px" title="${tip}"></div>
      <span class="g-label" style="left:${X(x0.fin) + ppd / 2 + 12}px">${esc(x0.nombre)}</span></div>`;
    const x = X(x0.inicio || x0.fin), w = Math.max(ppd, X(x0.fin) - x + ppd);
    return `<div class="g-brow" style="${pc(r.p)}"><div class="g-bar ${actLate(x0) ? "late" : ""}" data-act="${r.p.id}|${x0.id}" style="left:${x}px;width:${w}px" title="${tip}"><span style="width:${av}%"></span></div>
      <span class="g-label" style="left:${x + w + 6}px">${av}%</span></div>`;
  }).join("");

  // Dependencias (fin → inicio)
  let deps = "";
  rows.forEach((r, i) => {
    if (r.kind !== "task" || !r.x.depende?.length || !r.x.inicio) return;
    for (const d of r.x.depende) {
      const j = rowIdx.get(d); if (j == null) continue;
      const src = rows[j].x; if (!src.fin) continue;
      const x1 = X(src.fin) + ppd, y1 = j * 34 + 17, x2 = X(r.x.inicio), y2 = i * 34 + 17;
      const mx = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8));
      deps += `<path d="M${x1},${y1} H${mx} V${y2} H${x2 - 2}" fill="none" stroke="var(--muted)" stroke-width="1.2" marker-end="url(#ar)"/>`;
    }
  });

  const left = rows.map(r => r.kind === "proj"
    ? `<div class="g-row proj" style="${pc(r.p)}"><button class="tog" data-tog="${r.p.id}" aria-label="Expandir o contraer">${UI.collapsed.includes(r.p.id) ? "▸" : "▾"}</button><span class="swatch" style="background:var(--pc)"></span><span class="tname" data-open="${r.p.id}" style="cursor:pointer" title="${esc(r.p.titulo)}">${esc(r.p.titulo)}</span></div>`
    : `<div class="g-row task" ${single ? 'style="padding-left:12px"' : ""}><span class="tname" title="${esc(r.x.nombre)}">${r.x.hito ? "◆ " : ""}${esc(r.x.nombre)}</span></div>`).join("");

  box.innerHTML = `<div class="gantt">
    <div class="g-left"><div class="g-head"></div>${left}</div>
    <div class="g-right"><div class="g-canvas" style="width:${W}px">
      <div class="g-scale">${scale}</div>
      <div style="position:relative">
        <div class="g-lines">${lines}</div>
        <div class="g-today" style="left:${todayX}px"></div>
        <svg class="g-dep" width="${W}" height="${rows.length * 34}" style="left:0;top:0"><defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="var(--muted)"/></marker></defs>${deps}</svg>
        ${bars}
      </div>
    </div></div></div>`;
  $$("[data-tog]", box).forEach(b => b.onclick = () => {
    const id = b.dataset.tog; UI.collapsed = UI.collapsed.includes(id) ? UI.collapsed.filter(x => x !== id) : [...UI.collapsed, id]; saveUI(); render();
  });
  bindOpen(box);
  $$("[data-act]", box).forEach(el => el.onclick = () => { const [pid, aid] = el.dataset.act.split("|"); activityDialog(projById(pid), aid); });
  requestAnimationFrame(() => scrollToToday(box));
}

// ═══ Calendario ═══════════════════════════════════════════════
function calEvents() {
  const ev = [];
  for (const p of DB.proyectos) {
    if (!matchQ(p) || (UI.calProj && p.id !== UI.calProj)) continue;
    if (p.inicio) ev.push({ date: p.inicio, p, kind: "pini", text: `Inicio: ${p.titulo}` });
    if (p.fin) ev.push({ date: p.fin, p, kind: "pfin", text: `Término: ${p.titulo}` });
    for (const a of p.actividades) {
      if (a.hito) { if (a.fin) ev.push({ date: a.fin, p, a, kind: "ms", text: a.nombre }); continue; }
      if (a.inicio) ev.push({ date: a.inicio, p, a, kind: "aini", text: `▶ ${a.nombre}` });
      if (a.fin && a.fin !== a.inicio) ev.push({ date: a.fin, p, a, kind: "afin", text: `■ ${a.nombre}` });
    }
  }
  return ev;
}
function viewCalendario(v) {
  setTitle("Calendario");
  const ev = calEvents(), byDate = new Map();
  for (const e of ev) { if (!byDate.has(e.date)) byDate.set(e.date, []); byDate.get(e.date).push(e); }
  const order = { ms: 0, pfin: 1, afin: 2, pini: 3, aini: 4 };
  for (const l of byDate.values()) l.sort((a, b) => order[a.kind] - order[b.kind]);
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  v.innerHTML = `<div class="toolbar">
    <button class="btn" id="cPrev" aria-label="Mes anterior">‹</button><button class="btn" id="cToday">Hoy</button><button class="btn" id="cNext" aria-label="Mes siguiente">›</button>
    <h2 style="margin:0 8px;font-size:18px">${MES_L[m]} ${y}</h2><span class="grow"></span>
    <select id="cProj" aria-label="Proyecto"><option value="">Todos los proyectos</option>${DB.proyectos.map(p => `<option value="${p.id}" ${UI.calProj === p.id ? "selected" : ""}>${esc(p.titulo)}</option>`).join("")}</select>
    <div class="seg" id="cm"><button data-m="mes" aria-pressed="${UI.calMode === "mes"}">Mes</button><button data-m="agenda" aria-pressed="${UI.calMode === "agenda"}">Agenda</button></div>
  </div><div id="cbox"></div>
  <p class="hint">▶ inicio de actividad · ■ fin de actividad · ◆ hito. Haz clic en un día para ver el detalle o crear una actividad.</p>`;
  $("#cPrev", v).onclick = () => { calCursor = new Date(y, m - 1, 1); render(); };
  $("#cNext", v).onclick = () => { calCursor = new Date(y, m + 1, 1); render(); };
  $("#cToday", v).onclick = () => { const d = today(); calCursor = new Date(d.getFullYear(), d.getMonth(), 1); render(); };
  $("#cProj", v).onchange = e => { UI.calProj = e.target.value; saveUI(); render(); };
  $$("#cm button", v).forEach(b => b.onclick = () => { UI.calMode = b.dataset.m; saveUI(); render(); });
  const box = $("#cbox", v);
  const evHtml = e => `<div class="ev ${e.kind === "ms" ? "ms" : ""}" style="${pc(e.p)}" data-ev="${e.p.id}|${e.a ? e.a.id : ""}" title="${esc(e.p.titulo)} — ${esc(e.text)}">${esc(e.text)}</div>`;

  if (UI.calMode === "agenda") {
    const from = ymd(new Date(y, m, 1)), to = ymd(new Date(y, m + 2, 0));
    const dates = [...byDate.keys()].filter(d => d >= from && d <= to).sort();
    box.innerHTML = dates.length ? `<div class="card"><div class="agenda">${dates.map(d => `<div><div class="small" style="margin:8px 0 4px;font-weight:600;color:var(--text)">${fmtD(d)}${d === todayS() ? " · hoy" : ""}</div>
      ${byDate.get(d).map(e => `<div class="it" style="${pc(e.p)}" data-ev="${e.p.id}|${e.a ? e.a.id : ""}"><span class="swatch" style="background:var(--pc)"></span><span>${e.kind === "ms" ? "◆ " : ""}${esc(e.text)} <span class="small">· ${esc(e.p.titulo)}</span></span></div>`).join("")}</div>`).join("")}</div></div>`
      : `<div class="card empty">Sin eventos entre ${fmtD(from)} y ${fmtD(to)}.</div>`;
  } else {
    const first = new Date(y, m, 1), offset = (first.getDay() + 6) % 7, s = addDays(first, -offset);
    let cells = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => `<div class="dow">${d}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = addDays(s, i), ds = ymd(d), list = byDate.get(ds) || [];
      cells += `<div class="day ${d.getMonth() !== m ? "out" : ""} ${ds === todayS() ? "today" : ""}" data-day="${ds}">
        <span class="n">${d.getDate()}</span>${list.slice(0, 3).map(evHtml).join("")}${list.length > 3 ? `<div class="ev more">+${list.length - 3} más</div>` : ""}</div>`;
    }
    box.innerHTML = `<div class="cal">${cells}</div>`;
    $$("[data-day]", box).forEach(el => el.onclick = () => dayDialog(el.dataset.day, byDate.get(el.dataset.day) || []));
  }
  $$("[data-ev]", box).forEach(el => el.onclick = e => {
    e.stopPropagation(); const [pid, aid] = el.dataset.ev.split("|");
    aid ? activityDialog(projById(pid), aid) : go("proyecto/" + pid);
  });
}
function dayDialog(ds, list) {
  openDialog({
    title: fmtD(ds),
    body: list.length ? `<div class="agenda">${list.map(e => `<div class="it" style="${pc(e.p)}" data-ev="${e.p.id}|${e.a ? e.a.id : ""}"><span class="swatch" style="background:var(--pc)"></span><span>${esc(e.text)}<div class="small">${esc(e.p.titulo)}</div></span></div>`).join("")}</div>`
      : `<div class="empty">Sin eventos este día.</div>`,
    buttons: DB.proyectos.length ? `<button class="btn primary" value="new" type="button" id="dNew">Nueva actividad este día</button>` : "",
    onOpen(f) {
      $$("[data-ev]", f).forEach(el => el.onclick = () => { closeDialog(); const [pid, aid] = el.dataset.ev.split("|"); aid ? activityDialog(projById(pid), aid) : go("proyecto/" + pid); });
      const b = $("#dNew", f); if (b) b.onclick = () => { closeDialog(); activityDialog(UI.calProj ? projById(UI.calProj) : null, null, ds); };
    },
  });
}

// ═══ Ajustes ══════════════════════════════════════════════════
function viewAjustes(v) {
  setTitle("GitHub y ajustes");
  const c = Sync.cfg;
  v.innerHTML = `<div class="grid two" style="margin-top:0">
  <div class="card"><h2>Base de datos en GitHub</h2>
    <p class="small" style="margin-top:0">Los proyectos se guardan como un archivo JSON en un repositorio tuyo. Cada cambio queda como un commit (historial y respaldo).</p>
    <form id="ghf" class="grid" style="gap:10px">
      <div class="fgrid">
        <label class="f">Usuario u organización<input name="owner" value="${esc(c.owner)}" placeholder="mi-usuario" required></label>
        <label class="f">Repositorio<input name="repo" value="${esc(c.repo)}" placeholder="gestor-id-datos" required></label>
      </div>
      <div class="fgrid">
        <label class="f">Rama<input name="branch" value="${esc(c.branch)}" required></label>
        <label class="f">Archivo<input name="path" value="${esc(c.path)}" required></label>
      </div>
      <label class="f">Forma de conexión<select name="via" id="ghVia">
        <option value="gh" ${c.via === "gh" ? "selected" : ""}>Sesión de GitHub CLI en esta PC (servidor.py, sin token)</option>
        <option value="token" ${c.via !== "gh" ? "selected" : ""}>Token de acceso (funciona desde cualquier PC)</option></select></label>
      <div id="ghTok">
        <label class="f">Token de acceso (fine-grained)<input name="token" type="password" value="${esc(c.token)}" placeholder="github_pat_…" autocomplete="off"></label>
        <div class="hint" style="margin-top:6px">El token se guarda solo en este navegador. Créalo en GitHub → Settings → Developer settings → Fine-grained tokens, con acceso únicamente a ese repositorio y permiso <b>Contents: Read and write</b>.</div>
      </div>
      <div class="hint" id="ghCli">Usa la sesión de <code>gh auth login</code> a través de <code>servidor.py</code>. Solo funciona en esta PC y con el servidor corriendo; el navegador no guarda ninguna clave.</div>
      <div id="ghMsg"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" type="submit">Probar y conectar</button>
        ${Sync.on ? `<button class="btn" type="button" id="ghSave">Guardar ahora</button><button class="btn" type="button" id="ghPull">Traer de GitHub</button><button class="btn danger" type="button" id="ghOff">Desconectar</button>` : ""}
      </div>
      ${Sync.on ? `<div class="small">Historial de cambios: <a target="_blank" rel="noopener" href="https://github.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/commits/${encodeURIComponent(c.branch)}/${c.path.split("/").map(encodeURIComponent).join("/")}">ver commits en GitHub</a></div>` : ""}
    </form></div>
  <div class="grid" style="gap:14px;align-content:start">
    <div class="card"><h2>Apariencia</h2><div class="seg" id="th">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(([k, l]) => `<button data-th="${k}" aria-pressed="${UI.theme === k}">${l}</button>`).join("")}</div></div>
    <div class="card"><h2>Datos</h2><p class="small" style="margin-top:0">${DB.proyectos.length} proyectos · ${DB.proyectos.reduce((s, p) => s + p.actividades.length, 0)} actividades · ${DB.proyectos.reduce((s, p) => s + p.bitacora.length, 0)} entradas de bitácora</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="dExp">Exportar JSON</button><label class="btn">Importar JSON<input type="file" id="dImp" accept=".json,application/json" hidden></label>
        <button class="btn" id="dSeed">Agregar ejemplos</button><button class="btn danger" id="dDel">Borrar todo</button></div></div>
  </div></div>`;
  $("#ghf", v).onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const via = f.via === "gh" ? "gh" : "token";
    const cfg = { owner: f.owner.trim().replace(/^@/, ""), repo: f.repo.trim(), branch: f.branch.trim() || "main", path: f.path.trim().replace(/^\/+/, "") || "data/proyectos.json", token: via === "token" ? (cleanToken(f.token) || c.token) : c.token, via };
    const show = (t, err) => { const m = $("#ghMsg"); if (m) m.innerHTML = `<div class="notice${err ? " err" : ""}">${t}</div>`; else if (err) toast(t.replace(/<[^>]+>/g, ""), 8000); };
    show("Probando conexión…");
    try {
      if (via === "token") {
        if (!cfg.token) throw new Error("Falta el token de acceso: pégalo en el campo «Token de acceso».");
        const tp = tokenProblem(cfg.token); if (tp) throw new Error(tp);
      }
      const h = { Accept: "application/vnd.github+json" };
      if (via === "token") h.Authorization = `Bearer ${cfg.token}`;
      const call = (url, opt = {}) => fetch(url, { headers: h, cache: "no-store", ...opt }).catch(err => {
        throw new Error(via === "gh" ? "No responde servidor.py. Ábrelo con iniciar_gestor.bat (o elige «Token de acceso» si estás en otra PC)."
          : navigator.onLine === false ? "Este equipo no tiene internet."
          : `No se pudo contactar a GitHub: puede ser la red, un firewall o una extensión del navegador que bloquea api.github.com. (${err.message})`);
      });
      const full = `${cfg.owner}/${cfg.repo}`;
      const repoUrl = `${via === "gh" ? "/gh/repos/" : "https://api.github.com/repos/"}${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
      const fileUrl = `${repoUrl}/contents/${cfg.path.split("/").map(encodeURIComponent).join("/")}`;

      // 1) ¿El token es válido?
      let login = "";
      if (via === "token") {
        show("1/4 · Revisando el token…");
        const u = await call("https://api.github.com/user");
        if (u.status === 401) throw new Error("Paso 1/4 · GitHub rechazó el token (401): está mal copiado, vencido, o lo regeneraste después de copiarlo. Copia el valor actual (empieza con github_pat_).");
        if (u.ok) login = (await u.json()).login || "";
      }
      // 2) ¿Tiene acceso al repositorio?
      show("2/4 · Revisando el repositorio…");
      const r = await call(repoUrl);
      if (via === "gh" && r.status === 404 && !(r.headers.get("Content-Type") || "").includes("json")) throw new Error("Esta página no se sirvió con servidor.py: en otra PC elige «Token de acceso»; en tu PC ábrela con iniciar_gestor.bat.");
      if (r.status === 404) throw new Error(`Paso 2/4 · El token${login ? ` (de ${login})` : ""} es válido, pero no ve el repositorio «${full}». Revisa que usuario y repositorio estén bien escritos, y que el token tenga Repository access → Only select repositories → ${cfg.repo || "el repositorio"}.`);
      if (!r.ok) throw new Error("Paso 2/4 · " + await errText(r));
      const repo = await r.json();
      if (via === "gh" && !repo.permissions?.push) throw new Error("Tu sesión de GitHub CLI no puede escribir en ese repositorio.");
      // 3) ¿Existen la rama y el archivo?
      show("3/4 · Buscando el archivo de datos…");
      const fr = await call(`${fileUrl}?ref=${encodeURIComponent(cfg.branch)}`);
      let file = null;
      if (fr.ok) file = await fr.json();
      else if (fr.status === 404) {
        const m = (await fr.json().catch(() => ({}))).message || "";
        if (/ref|branch|commit/i.test(m)) throw new Error(`Paso 3/4 · La rama «${cfg.branch}» no existe en ${repo.full_name}. Prueba con «${repo.default_branch}».`);
      } else throw new Error("Paso 3/4 · " + await errText(fr));
      // 4) ¿Puede escribir? Prueba sin modificar nada: se envía el mismo contenido con un sha falso,
      //    así GitHub responde 409 (permitido, pero no guarda) o 403 (sin permiso de escritura).
      if (via === "token" && file && file.content) {
        show("4/4 · Revisando permiso de escritura…");
        const w = await call(fileUrl, { method: "PUT", body: JSON.stringify({ message: "Prueba de permisos (no se guarda)", content: String(file.content).replace(/\s/g, ""), sha: "0".repeat(40), branch: cfg.branch }) });
        if (w.status === 403 || w.status === 404) throw new Error("Paso 4/4 · El token puede leer pero no escribir. En GitHub abre el token → Permissions → Contents: «Read and write» y guarda (no hace falta regenerarlo).");
        if (w.status === 401) throw new Error("Paso 4/4 · " + ghMsg(401));
      }
      if (!file) {
        if (!confirm(`El archivo «${cfg.path}» no existe en ${repo.full_name} (rama ${cfg.branch}).\n\n¿Crearlo con los ${DB.proyectos.length} proyectos de este navegador?\n\nSi tus datos ya están en GitHub, pulsa Cancelar y revisa el campo «Archivo» (normalmente data/proyectos.json).`))
          throw new Error("Conexión cancelada: revisa el campo «Archivo».");
      } else if (lsGet(LS_DIRTY, false) && DB.proyectos.length) {
        if (!confirm(`Este navegador tiene cambios que nunca se subieron a GitHub (${DB.proyectos.length} proyectos, quizá los de ejemplo).\n\nAceptar = combinarlos con los de GitHub.\nCancelar = descartarlos y usar solo lo que está en GitHub.`)) lsSet(LS_DIRTY, false);
      }
      Sync.cfg = cfg; lsSet(LS_GH, cfg); Sync.sha = null; lsSet("idgestor.ghAutoOff", false);
      show(`Conectado a <b>${esc(repo.full_name)}</b>${repo.private ? " (privado)" : " — <b>ojo: el repositorio es público</b>"}. Sincronizando…`);
      await Sync.init();
      if (Sync.state === "err") throw new Error("Conectó, pero falló la sincronización: " + Sync.error);
      render(); toast("GitHub conectado");
    } catch (err) { show(esc(err.message), true); }
  };
  const viaSel = $("#ghVia", v), showVia = () => { $("#ghTok", v).hidden = viaSel.value === "gh"; $("#ghCli", v).hidden = viaSel.value !== "gh"; };
  viaSel.onchange = showVia; showVia();
  if (Sync.on) {
    $("#ghSave", v).onclick = () => { pendingMsgs.push("Guardado manual"); Sync.save(); };
    $("#ghPull", v).onclick = async () => { if (lsGet(LS_DIRTY, false) && !confirm("Hay cambios sin subir. ¿Combinarlos con lo que hay en GitHub?")) return; await Sync.init(); toast("Datos traídos de GitHub"); };
    $("#ghOff", v).onclick = () => { if (!confirm("¿Desconectar GitHub? Los datos quedan en este navegador y en el repositorio.")) return; Sync.cfg = { ...Sync.cfg, token: "", via: "token" }; lsSet(LS_GH, Sync.cfg); lsSet("idgestor.ghAutoOff", true); Sync.set("local"); render(); };
  }
  $$("#th button", v).forEach(b => b.onclick = () => { UI.theme = b.dataset.th; saveUI(); render(); });
  $("#dExp", v).onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" }));
    a.download = `gestor-id-${todayS()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $("#dImp", v).onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      const mode = confirm(`El archivo tiene ${data.proyectos.length} proyectos.\n\nAceptar = combinar con los actuales\nCancelar = no importar`);
      if (!mode) return;
      DB = merge(DB, data); commit(`Importar ${data.proyectos.length} proyectos desde archivo`);
      toast("Importación lista");
    } catch (err) { alert("No se pudo leer el archivo: " + err.message); }
  };
  $("#dSeed", v).onclick = () => { seed(); commit("Agregar proyectos de ejemplo"); toast("Ejemplos agregados"); };
  $("#dDel", v).onclick = () => {
    if (prompt('Esto elimina todos los proyectos (también en GitHub al sincronizar; el historial de commits se conserva). Escribe BORRAR para confirmar') !== "BORRAR") return;
    DB.eliminados.push(...DB.proyectos.map(p => ({ id: p.id, fecha: nowIso() })));
    DB.proyectos = []; commit("Borrar todos los proyectos");
  };
}
function applyTheme() { const r = document.documentElement; if (UI.theme === "auto") r.removeAttribute("data-theme"); else r.dataset.theme = UI.theme; }

// ═══ Diálogos ═════════════════════════════════════════════════
const dlg = $("#dlg"), dlgForm = $("#dlgForm");
let dlgSubmit = null;
function openDialog({ title, body, buttons = "", del = false, submitText = "", onSubmit, onDelete, onOpen }) {
  dlgForm.innerHTML = `<header>${esc(title)}<button class="btn ghost sm" type="button" id="dlgX" aria-label="Cerrar">✕</button></header>
    <div class="body">${body}</div>
    <footer>${del ? `<button class="btn danger left" type="button" id="dlgDel">Eliminar</button>` : ""}${buttons}
      <button class="btn" type="button" id="dlgCancel">${onSubmit ? "Cancelar" : "Cerrar"}</button>
      ${onSubmit ? `<button class="btn primary" type="submit">${esc(submitText || "Guardar")}</button>` : ""}</footer>`;
  dlgSubmit = onSubmit;
  $("#dlgX", dlgForm).onclick = $("#dlgCancel", dlgForm).onclick = closeDialog;
  if (del) $("#dlgDel", dlgForm).onclick = () => { if (confirm("¿Eliminar definitivamente?")) { closeDialog(); onDelete(); } };
  dlg.showModal();
  onOpen && onOpen(dlgForm);
  const first = $("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea", $(".body", dlgForm)); first && first.focus();
}
function closeDialog() { dlg.close(); dlgSubmit = null; }
dlgForm.addEventListener("submit", e => {
  e.preventDefault();
  if (!dlgSubmit) return closeDialog();
  const fd = new FormData(dlgForm), data = {};
  for (const [k, v] of fd) data[k] = data[k] === undefined ? v : [].concat(data[k], v);
  if (dlgSubmit(data, dlgForm) !== false) closeDialog();
});

const datalist = (id, vals) => `<datalist id="${id}">${[...new Set(vals.filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join("")}</datalist>`;
const people = () => DB.proyectos.flatMap(p => [p.responsable, ...p.equipo, ...p.actividades.map(a => a.responsable)]);
const sel = (name, list, cur) => `<select name="${name}">${list.map(([k, l]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${l}</option>`).join("")}</select>`;

function nextCode() {
  const y = new Date().getFullYear(), re = new RegExp(`^ID-${y}-(\\d+)$`);
  const n = Math.max(0, ...DB.proyectos.map(p => +(re.exec(p.codigo || "") || [0, 0])[1]));
  return `ID-${y}-${pad(n + 1).padStart(3, "0")}`;
}

function projectDialog(p) {
  const isNew = !p;
  const d = p || { codigo: nextCode(), estado: "propuesta", prioridad: "media", color: COLORS[DB.proyectos.length % 8], trl: 1, inicio: todayS(), etiquetas: [], equipo: [], enlaces: [] };
  openDialog({
    title: isNew ? "Nuevo proyecto" : "Editar proyecto", del: !isNew, submitText: isNew ? "Crear proyecto" : "Guardar",
    body: `
      <div class="fgrid"><label class="f">Código<input name="codigo" value="${esc(d.codigo || "")}"></label>
        <label class="f" style="grid-column:span 2">Título *<input name="titulo" value="${esc(d.titulo || "")}" required maxlength="140"></label></div>
      <label class="f">Descripción<textarea name="descripcion" rows="3">${esc(d.descripcion || "")}</textarea></label>
      <div class="fgrid">
        <label class="f">Estado${sel("estado", ESTADOS, d.estado)}</label>
        <label class="f">Prioridad${sel("prioridad", PRIORIDADES, d.prioridad)}</label>
        <label class="f">Nivel TRL<select name="trl"><option value="">—</option>${TRL_TXT.slice(1).map((t, i) => `<option value="${i + 1}" ${+d.trl === i + 1 ? "selected" : ""}>${i + 1} · ${t}</option>`).join("")}</select></label>
      </div>
      <div class="fgrid">
        <label class="f">Inicio<input type="date" name="inicio" value="${esc(d.inicio || "")}"></label>
        <label class="f">Término<input type="date" name="fin" value="${esc(d.fin || "")}"></label>
        <label class="f">Área / línea de investigación<input name="area" list="dlArea" value="${esc(d.area || "")}"></label>
      </div>
      <div class="fgrid">
        <label class="f">Responsable<input name="responsable" list="dlPeople" value="${esc(d.responsable || "")}"></label>
        <label class="f">Equipo (separado por comas)<input name="equipo" value="${esc(d.equipo.join(", "))}"></label>
      </div>
      <div class="fgrid">
        <label class="f">Presupuesto ($)<input type="number" min="0" step="1" name="presupuesto" value="${esc(d.presupuesto ?? "")}"></label>
        <label class="f">Ejecutado ($)<input type="number" min="0" step="1" name="gastado" value="${esc(d.gastado ?? "")}"></label>
        <label class="f">Avance manual (%)<input type="number" min="0" max="100" name="avance" value="${esc(d.avance ?? 0)}" title="Solo se usa si el proyecto no tiene actividades"></label>
      </div>
      <label class="f">Objetivos<textarea name="objetivos" rows="2">${esc(d.objetivos || "")}</textarea></label>
      <label class="f">Resultados esperados / entregables<textarea name="resultados" rows="2">${esc(d.resultados || "")}</textarea></label>
      <label class="f">Etiquetas (separadas por comas)<input name="etiquetas" list="dlTags" value="${esc(d.etiquetas.join(", "))}"></label>
      <label class="f">Enlaces (uno por línea: <i>título | url</i>)<textarea name="enlaces" rows="2" placeholder="Repositorio | https://github.com/…">${esc(d.enlaces.map(l => (l.t ? l.t + " | " : "") + l.url).join("\n"))}</textarea></label>
      <div class="f"><span class="small">Color</span><div class="colors">${COLORS.map(c => `<label><input type="radio" name="color" value="${c}" ${d.color === c ? "checked" : ""}><span style="background:var(--${c})"></span></label>`).join("")}</div></div>
      ${datalist("dlArea", DB.proyectos.map(x => x.area))}${datalist("dlPeople", people())}${datalist("dlTags", DB.proyectos.flatMap(x => x.etiquetas))}`,
    onSubmit(f) {
      if (f.fin && f.inicio && f.fin < f.inicio) { alert("La fecha de término es anterior al inicio"); return false; }
      const list = s => (s || "").split(",").map(x => x.trim()).filter(Boolean);
      const num = s => s === "" || s == null ? null : +s;
      const obj = p || { id: uid(), creado: nowIso(), actividades: [], bitacora: [] };
      Object.assign(obj, {
        codigo: f.codigo.trim(), titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), estado: f.estado, prioridad: f.prioridad,
        trl: num(f.trl), inicio: f.inicio, fin: f.fin, area: f.area.trim(), responsable: f.responsable.trim(), equipo: list(f.equipo),
        presupuesto: num(f.presupuesto), gastado: num(f.gastado), avance: Math.min(100, Math.max(0, +f.avance || 0)),
        objetivos: f.objetivos.trim(), resultados: f.resultados.trim(), etiquetas: list(f.etiquetas), color: f.color || "c1",
        enlaces: (f.enlaces || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => { const i = l.lastIndexOf("|"); return i > 0 ? { t: l.slice(0, i).trim(), url: l.slice(i + 1).trim() } : { t: "", url: l }; }),
      });
      if (isNew) DB.proyectos.push(obj);
      commit(`${isNew ? "Crear" : "Editar"} proyecto: ${obj.titulo}`, obj);
      if (isNew) { detailTab = "resumen"; go("proyecto/" + obj.id); }
    },
    onDelete() {
      DB.proyectos = DB.proyectos.filter(x => x !== p);
      DB.eliminados.push({ id: p.id, fecha: nowIso() });
      commit(`Eliminar proyecto: ${p.titulo}`); go("proyectos");
    },
  });
}

function activityDialog(p, aid, dateHint) {
  const a = p && aid ? p.actividades.find(x => x.id === aid) : null;
  const isNew = !a;
  const d = a || { estado: "pendiente", avance: 0, inicio: dateHint || todayS(), fin: dateHint || ymd(addDays(today(), 14)), depende: [] };
  const others = p ? p.actividades.filter(x => x.id !== aid) : [];
  openDialog({
    title: isNew ? "Nueva actividad" : "Editar actividad", del: !isNew,
    body: `
      ${p ? `<input type="hidden" name="pid" value="${p.id}"><div class="small">Proyecto: <b style="color:var(--text)">${esc(p.titulo)}</b></div>`
        : `<label class="f">Proyecto *<select name="pid" required>${DB.proyectos.filter(projActive).map(x => `<option value="${x.id}">${esc(x.titulo)}</option>`).join("")}</select></label>`}
      <label class="f">Nombre *<input name="nombre" value="${esc(d.nombre || "")}" required maxlength="140"></label>
      <div class="fgrid">
        <label class="f">Inicio<input type="date" name="inicio" value="${esc(d.inicio || "")}"></label>
        <label class="f">Fin *<input type="date" name="fin" value="${esc(d.fin || "")}" required></label>
        <label class="f">Responsable<input name="responsable" list="dlPeople" value="${esc(d.responsable || "")}"></label>
      </div>
      <div class="fgrid">
        <label class="f">Estado${sel("estado", ACT_ESTADOS, d.estado)}</label>
        <label class="f"><span>Avance: <output id="avOut">${d.avance || 0}</output>%</span><input type="range" min="0" max="100" step="5" name="avance" value="${d.avance || 0}"></label>
      </div>
      <label class="chk"><input type="checkbox" name="hito" ${d.hito ? "checked" : ""}> Es un hito (entrega o evento puntual en la fecha de fin)</label>
      ${others.length ? `<label class="f">Depende de (debe terminar antes)<select name="depende" multiple size="${Math.min(5, others.length)}">${others.map(x => `<option value="${x.id}" ${d.depende?.includes(x.id) ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select><span class="hint">Ctrl + clic para elegir varias</span></label>` : ""}
      <label class="f">Notas<textarea name="notas" rows="2">${esc(d.notas || "")}</textarea></label>
      ${datalist("dlPeople", people())}`,
    onOpen(f) {
      const r = $("[name=avance]", f), o = $("#avOut", f), st = $("[name=estado]", f);
      r.oninput = () => { o.textContent = r.value; if (+r.value === 100) st.value = "completada"; else if (+r.value > 0 && st.value === "pendiente") st.value = "en_curso"; };
      st.onchange = () => { if (st.value === "completada") { r.value = 100; o.textContent = 100; } };
    },
    onSubmit(f) {
      const proj = projById(f.pid); if (!proj) return false;
      if (f.inicio && f.fin < f.inicio) { alert("La fecha de fin es anterior al inicio"); return false; }
      const obj = a || { id: uid() };
      Object.assign(obj, {
        nombre: f.nombre.trim(), inicio: f.hito ? f.fin : (f.inicio || f.fin), fin: f.fin, responsable: f.responsable.trim(),
        estado: f.estado, avance: f.estado === "completada" ? 100 : +f.avance, hito: !!f.hito,
        depende: [].concat(f.depende || []), notas: f.notas.trim(),
      });
      if (isNew) proj.actividades.push(obj);
      commit(`${isNew ? "Nueva" : "Editar"} actividad: ${obj.nombre} (${proj.titulo})`, proj);
    },
    onDelete() {
      p.actividades = p.actividades.filter(x => x !== a);
      for (const x of p.actividades) x.depende = (x.depende || []).filter(id => id !== a.id);
      commit(`Eliminar actividad: ${a.nombre} (${p.titulo})`, p);
    },
  });
}

function logDialog(p, lid) {
  const e = lid ? p.bitacora.find(x => x.id === lid) : null;
  const d = e || { fecha: todayS(), tipo: "nota", autor: lsGet("idgestor.autor", "") };
  openDialog({
    title: e ? "Editar entrada de bitácora" : "Nueva entrada de bitácora", del: !!e,
    body: `<div class="fgrid">
        <label class="f">Fecha<input type="date" name="fecha" value="${esc(d.fecha)}" required></label>
        <label class="f">Tipo${sel("tipo", BIT_TIPOS, d.tipo)}</label>
        <label class="f">Autor<input name="autor" list="dlPeople" value="${esc(d.autor || "")}"></label></div>
      <label class="f">Texto *<textarea name="texto" rows="6" required>${esc(d.texto || "")}</textarea></label>${datalist("dlPeople", people())}`,
    onSubmit(f) {
      const obj = e || { id: uid() };
      Object.assign(obj, { fecha: f.fecha, tipo: f.tipo, autor: f.autor.trim(), texto: f.texto.trim() });
      lsSet("idgestor.autor", obj.autor);
      if (!e) p.bitacora.push(obj);
      detailTab = "bitacora";
      commit(`Bitácora (${label(BIT_TIPOS, obj.tipo)}): ${p.titulo}`, p);
    },
    onDelete() { p.bitacora = p.bitacora.filter(x => x !== e); commit(`Eliminar entrada de bitácora: ${p.titulo}`, p); },
  });
}

// ═══ Datos de ejemplo ═════════════════════════════════════════
function seed() {
  const t = today(), D = n => ymd(addDays(t, n));
  const mk = (o, acts, logs = []) => {
    const ids = acts.map(() => uid());
    DB.proyectos.push(Object.assign({
      id: uid(), creado: nowIso(), actualizado: nowIso(), equipo: [], etiquetas: [], enlaces: [], avance: 0,
      actividades: acts.map((a, i) => Object.assign({ id: ids[i], estado: "pendiente", avance: 0, depende: (a.dep || []).map(j => ids[j]) }, a, { dep: undefined, inicio: a.inicio || a.fin })),
      bitacora: logs.map(l => Object.assign({ id: uid(), tipo: "nota", autor: "Ana Rojas" }, l)),
    }, o));
  };
  const n = DB.proyectos.length;
  // Ejemplos genéricos (la app es pública en GitHub Pages: no poner datos reales aquí)
  mk({ codigo: nextCode(), titulo: "Ejemplo — Nodo IoT de monitoreo ambiental", area: "IoT", estado: "en_curso", prioridad: "alta", trl: 6, color: "c1",
    descripcion: "Proyecto de ejemplo: nodo con microcontrolador que lee sensores por RS-485 y publica por MQTT. Edítalo o bórralo.",
    objetivos: "Telemetría continua tolerante a fallos.\nBajo consumo.", resultados: "Firmware estable\nManual de usuario",
    responsable: "Ana Rojas", equipo: ["Ana Rojas", "Luis Pérez"], inicio: D(-90), fin: D(60), presupuesto: 5000000, gastado: 2800000, etiquetas: ["MQTT", "sensores"] }, [
    { nombre: "Integrar sensores RS-485", inicio: D(-60), fin: D(-20), estado: "completada", avance: 100, responsable: "Luis Pérez" },
    { nombre: "Cifrado TLS en las comunicaciones", inicio: D(-3), fin: D(18), estado: "en_curso", avance: 30, responsable: "Ana Rojas", dep: [0] },
    { nombre: "Pruebas de campo", inicio: D(19), fin: D(45), dep: [1] },
    { nombre: "Liberar versión 1.0", fin: D(50), hito: true, dep: [2] },
  ], [{ fecha: D(-2), tipo: "decision", texto: "Se usará TLS 1.2 con certificados propios en el broker." }]);
  mk({ codigo: nextCode(), titulo: "Ejemplo — Plataforma de almacenamiento de datos", area: "Software", estado: "en_curso", prioridad: "media", trl: 4, color: "c3",
    descripcion: "Proyecto de ejemplo: broker, base de datos de series de tiempo y panel web.",
    responsable: "Luis Pérez", inicio: D(-10), fin: D(40), etiquetas: ["datos"] }, [
    { nombre: "Broker con usuarios y permisos", inicio: D(-10), fin: D(-5), estado: "completada", avance: 100 },
    { nombre: "Base de datos de series de tiempo", inicio: D(-4), fin: D(12), estado: "en_curso", avance: 20, dep: [0] },
    { nombre: "Despliegue en servidor", inicio: D(13), fin: D(22), dep: [1] },
    { nombre: "Puesta en marcha", fin: D(24), hito: true, dep: [2] },
  ]);
  mk({ codigo: nextCode(), titulo: "Ejemplo — Prototipo de carcasa estanca", area: "Mecánica", estado: "en_curso", prioridad: "critica", trl: 3, color: "c2",
    descripcion: "Proyecto de ejemplo: carcasa impresa en 3D para un equipo sumergible.",
    responsable: "Ana Rojas", inicio: D(-45), fin: D(-3), presupuesto: 1200000, gastado: 900000, etiquetas: ["impresión 3D"] }, [
    { nombre: "Diseño CAD", inicio: D(-45), fin: D(-30), estado: "completada", avance: 100 },
    { nombre: "Prueba de estanqueidad", inicio: D(-20), fin: D(-6), estado: "en_curso", avance: 60, dep: [0] },
  ]);
  mk({ codigo: nextCode(), titulo: "Ejemplo — Estudio de nuevo sensor", area: "Investigación", estado: "idea", prioridad: "baja", trl: 1, color: "c5",
    descripcion: "Proyecto de ejemplo en etapa de idea.", inicio: D(45), fin: D(150), etiquetas: ["sensores"] }, []);
  return DB.proyectos.length - n;
}

// ═══ Inicio ═══════════════════════════════════════════════════
DB = normalize(DB);
if (!lsGet(LS_DATA, null) && !Sync.on) { seed(); lsSet(LS_DATA, DB); }
render();
(async () => {
  // Si la app la sirve servidor.py y aún no hay conexión configurada, usar su repositorio automáticamente
  if (!Sync.on && !lsGet("idgestor.ghAutoOff", false)) {
    try {
      const r = await fetch("/gh-info", { cache: "no-store" });
      if (r.ok && (r.headers.get("Content-Type") || "").includes("json")) {
        const [owner, repo] = (await r.json()).repo.split("/");
        Sync.cfg = { ...Sync.cfg, owner, repo, via: "gh" }; lsSet(LS_GH, Sync.cfg);
        toast(`Conectando a ${owner}/${repo} con la sesión de GitHub CLI…`);
      }
    } catch { }
  }
  await Sync.init();
})();

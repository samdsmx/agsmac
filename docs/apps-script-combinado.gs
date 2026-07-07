/**
 * Combinado (Cumpleaños + Cuadro de Honor) — Apps Script Web App para AGSMAC
 * ==========================================================================
 * UN SOLO proyecto de Apps Script que sirve AMBOS endpoints desde un único
 * `doGet`, distinguiéndolos por el parámetro de URL `?tipo=`:
 *
 *     .../exec?tipo=cumpleanos   ->  { birthdays: [...], rangeDays: N }
 *     .../exec?tipo=cuadro       ->  { awards: [...], updatedAt: "..." }
 *
 * ─── POR QUÉ ESTE ARCHIVO ───────────────────────────────────────────────────
 * En Apps Script, TODAS las implementaciones (deployments) de Web App de un
 * proyecto ejecutan el MISMO `doGet(e)`. No se puede "elegir" qué `.gs` corre
 * por implementación. Si pegas dos `doGet` (cumpleaños y cuadro) en el mismo
 * proyecto, colisionan (gana el último) y ambas URLs devuelven lo mismo.
 *
 * Este archivo resuelve eso con UN router `doGet` que despacha por `?tipo=`.
 * Si prefieres mantenerlos 100% separados en dos proyectos distintos, extrae
 * cada bloque (CUMPLEAÑOS / CUADRO DE HONOR) a su propio proyecto de Apps
 * Script, renombrando su `handle...` a `doGet`.
 *
 * ─── INSTALACIÓN ────────────────────────────────────────────────────────────
 * 1. Extensiones → Apps Script en tu hoja.
 * 2. Borra el contenido de Code.gs y pega TODO este archivo.
 * 3. Configura abajo CUMPLE_CONFIG y CUADRO_CONFIG:
 *      - Si AMBOS conjuntos de datos están en el MISMO libro (en pestañas
 *        distintas): deja SPREADSHEET_ID = '' (usa la hoja contenedora) y pon
 *        el SHEET_NAME (nombre de pestaña) correcto en cada uno.
 *      - Si están en LIBROS distintos: pon el SPREADSHEET_ID de cada libro
 *        (lo sacas de la URL del Sheet: /spreadsheets/d/<ESTE_ID>/edit).
 * 4. Guarda. Implementar → Nueva implementación → Aplicación web:
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier persona (sin login)
 * 5. Copia la URL /exec y pégala en los JSON del sitio AÑADIENDO el tipo:
 *      includes/data/cumpleanos.json        -> "appsScriptUrl": ".../exec?tipo=cumpleanos"
 *      includes/data/cuadro-de-adelanto.json-> "appsScriptUrl": ".../exec?tipo=cuadro"
 *    (Puedes usar la MISMA URL base /exec para ambos; solo cambia ?tipo=.)
 *
 * Cada vez que edites este script: Implementar → Administrar implementaciones
 * → (editar) → Versión: Nueva versión → Implementar.
 */

// ═════════════════════════ ROUTER ═══════════════════════════════════════════
function doGet(e) {
  var tipo = (e && e.parameter && e.parameter.tipo ? String(e.parameter.tipo) : '')
    .toLowerCase().trim();
  try {
    if (tipo === 'cumpleanos' || tipo === 'cumple' || tipo === 'birthdays') {
      return handleCumpleanos(e);
    }
    if (tipo === 'cuadro' || tipo === 'cuadro-honor' || tipo === 'awards') {
      return handleCuadro(e);
    }
    return jsonResponse({
      error: 'Parámetro "tipo" inválido o ausente. Usa ?tipo=cumpleanos o ?tipo=cuadro.'
    });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message || err) });
  }
}

// ═════════════════════════ CONFIG ═══════════════════════════════════════════
var CUMPLE_CONFIG = {
  SPREADSHEET_ID: '',            // '' = libro contenedor; o el ID del libro de cumpleaños
  SHEET_NAME: 'Regnal',          // pestaña con los cumpleaños
  HEADERS: {
    nombres:          'Nombres',
    apellidoPaterno:  'Apellido Paterno',
    apellidoMaterno:  'Apellido Materno',
    date:             'Fecha de Nac.',
    group:            'Grupo'
  },
  RANGE_DAYS: 20                 // ventana ± días alrededor de hoy
};

var CUADRO_CONFIG = {
  SPREADSHEET_ID: '',            // '' = libro contenedor; o el ID del libro del cuadro de honor
  SHEET_NAME: 'Maximas',          // pestaña con los galardonados
  HEADERS: {
    apellidoPaterno: 'Apellido Paterno',
    apellidoMaterno: 'Apellido Materno',
    nombres:         'Nombres',
    fecha:           'Fecha',
    insignia:        'Insignia',
    grupo:           'Grupo',
    clave:           'Clave'
  }
};

// Abre la pestaña correcta para un config dado.
function openSheet(cfg) {
  var ss = cfg.SPREADSHEET_ID
    ? SpreadsheetApp.openById(cfg.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No se pudo abrir el libro. Revisa SPREADSHEET_ID.');
  return ss.getSheetByName(cfg.SHEET_NAME) || ss.getSheets()[0];
}

// ═════════════════════════ CUMPLEAÑOS ═══════════════════════════════════════
function handleCumpleanos(e) {
  try {
    var days = (e && e.parameter && e.parameter.days)
      ? Math.max(0, parseInt(e.parameter.days, 10) || CUMPLE_CONFIG.RANGE_DAYS)
      : CUMPLE_CONFIG.RANGE_DAYS;
    var entries = readBirthdays();
    var inWindow = entries
      .filter(function (e2) { return Math.abs(daysDistance(e2.month, e2.day)) <= days; })
      .sort(function (a, b) {
        return Math.abs(daysDistance(a.month, a.day)) - Math.abs(daysDistance(b.month, b.day));
      })
      .map(formatBirthday);
    return jsonResponse({ birthdays: inWindow, rangeDays: days });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message || err), birthdays: [] });
  }
}

function readBirthdays() {
  var sheet = openSheet(CUMPLE_CONFIG);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var nombresIdx = headers.indexOf(CUMPLE_CONFIG.HEADERS.nombres.toLowerCase());
  var paternoIdx = headers.indexOf(CUMPLE_CONFIG.HEADERS.apellidoPaterno.toLowerCase());
  var maternoIdx = headers.indexOf(CUMPLE_CONFIG.HEADERS.apellidoMaterno.toLowerCase());
  var dateIdx    = headers.indexOf(CUMPLE_CONFIG.HEADERS.date.toLowerCase());
  var groupIdx   = headers.indexOf(CUMPLE_CONFIG.HEADERS.group.toLowerCase());
  if (nombresIdx === -1 || paternoIdx === -1 || dateIdx === -1) {
    throw new Error('Cumpleaños: faltan columnas requeridas (Nombres, Apellido Paterno, Fecha). Revisa CUMPLE_CONFIG.HEADERS.');
  }
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var nombres = String(row[nombresIdx] || '').trim();
    var paterno = String(row[paternoIdx] || '').trim();
    var materno = maternoIdx >= 0 ? String(row[maternoIdx] || '').trim() : '';
    if (!nombres || !paterno) continue;
    var d = parseDate(row[dateIdx]);
    if (!d) continue;
    out.push({
      nombres: nombres,
      paterno: paterno,
      materno: materno,
      group:   groupIdx >= 0 ? String(row[groupIdx] || '').trim() : '',
      month:   d.month,
      day:     d.day
    });
  }
  return out;
}

function parseDate(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { month: val.getMonth() + 1, day: val.getDate() };
  }
  var s = String(val || '').trim();
  if (!s) return null;
  var m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))  return { month: +m[2], day: +m[3] };
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/))) return { day: +m[1], month: +m[2] };
  var d = new Date(s);
  if (!isNaN(d.getTime())) return { month: d.getMonth() + 1, day: d.getDate() };
  return null;
}

function daysDistance(month, day) {
  var now = new Date();
  var bdDay = day;
  if (month === 2 && day === 29 && !isLeap(now.getFullYear())) bdDay = 28;
  var bday = new Date(now.getFullYear(), month - 1, bdDay);
  var diff = Math.round((bday - now) / 86400000);
  var len  = isLeap(now.getFullYear()) ? 366 : 365;
  if (diff >  len / 2) diff -= len;
  if (diff < -len / 2) diff += len;
  return diff;
}

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }

function formatBirthday(e) {
  return {
    name: buildDisplayName(e.nombres, e.paterno, e.materno),
    group: e.group
  };
}

// ═════════════════════════ CUADRO DE HONOR ══════════════════════════════════
var CACHE_KEY = 'cuadro-honor-awards-v1';
var CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 horas

function handleCuadro(e) {
  try {
    var awards = getAwardsCached();
    return jsonResponse({ awards: awards, updatedAt: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message || err), awards: [] });
  }
}

function getAwardsCached() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CACHE_KEY);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) { /* re-lee abajo */ }
  }
  var awards = readAwards();
  try {
    cache.put(CACHE_KEY, JSON.stringify(awards), CACHE_TTL_SECONDS);
  } catch (_) { /* >100 KB: se sirve sin caché */ }
  return awards;
}

function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
}

function readAwards() {
  var sheet = openSheet(CUADRO_CONFIG);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  var headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  function col(name) { return headers.indexOf(String(name || '').toLowerCase()); }

  var iPaterno  = col(CUADRO_CONFIG.HEADERS.apellidoPaterno);
  var iMaterno  = col(CUADRO_CONFIG.HEADERS.apellidoMaterno);
  var iNombres  = col(CUADRO_CONFIG.HEADERS.nombres);
  var iFecha    = col(CUADRO_CONFIG.HEADERS.fecha);
  var iInsignia = col(CUADRO_CONFIG.HEADERS.insignia);
  var iGrupo    = col(CUADRO_CONFIG.HEADERS.grupo);
  var iClave    = col(CUADRO_CONFIG.HEADERS.clave);

  if (iPaterno === -1 || iNombres === -1 || iFecha === -1 || iInsignia === -1) {
    throw new Error('Cuadro: faltan columnas requeridas (Apellido Paterno, Nombres, Fecha, Insignia). Revisa CUADRO_CONFIG.HEADERS.');
  }

  var out = [];
  var fechaActual = new Date();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];

    var fechaRegistro = new Date(row[iFecha]);
    if (!isNaN(fechaRegistro.getTime()) && fechaRegistro > fechaActual) {
      continue; 
    }

    var nombres = String(row[iNombres] || '').trim();
    var paterno = String(row[iPaterno] || '').trim();
    var materno = iMaterno >= 0 ? String(row[iMaterno] || '').trim() : '';
    if (!nombres || !paterno) continue;

    var insignia = canonicalInsignia(row[iInsignia]);
    if (!insignia) continue;

    var year = parseYear(row[iFecha]);
    if (!year) continue;

    out.push({
      name:     buildDisplayName(nombres, paterno, materno),
      group:    iGrupo >= 0 ? String(row[iGrupo] || '').trim() : '',
      insignia: insignia,
      year:     year,
      clave:    iClave >= 0 ? String(row[iClave] || '').trim() : ''
    });
  }
  out.sort(function (a, b) {
    return (b.year - a.year) || a.insignia.localeCompare(b.insignia) || a.name.localeCompare(b.name);
  });
  return out;
}

function parseYear(val) {
  if (val instanceof Date && !isNaN(val.getTime())) return val.getFullYear();
  var s = String(val || '').trim();
  var m = s.match(/(19|20)\d{2}/);
  if (m) return Number(m[0]);
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.getFullYear();
  return null;
}

function canonicalInsignia(s) {
  var norm = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  return norm || '';
}

// ═════════════════════════ COMPARTIDO ═══════════════════════════════════════
// Recorte de nombre idéntico en ambos endpoints:
//   "PrimerNombre [Inicial2.] ApellidoPaterno [InicialMaterno.]"
function buildDisplayName(nombres, paterno, materno) {
  var nombreParts = String(nombres || '').trim().split(/\s+/).filter(Boolean);
  var primero = nombreParts[0] || '';
  var segundoInicial = nombreParts[1] ? ' ' + nombreParts[1].charAt(0).toUpperCase() + '.' : '';
  var maternoInicial = materno ? ' ' + String(materno).trim().charAt(0).toUpperCase() + '.' : '';
  var paternoStr = paterno ? ' ' + String(paterno).trim() : '';
  return (primero + segundoInicial + paternoStr + maternoInicial).trim();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

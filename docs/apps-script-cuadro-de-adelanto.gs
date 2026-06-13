/**
 * Cuadro de Honor — Apps Script Web App para AGSMAC
 * ==================================================
 * Lee la hoja PRIVADA con los galardonados con insignia máxima y devuelve
 * los registros en JSON listos para consumir desde el sitio en GitHub Pages.
 *
 * La hoja sigue siendo privada — solo este script (corriendo como tú) puede leerla.
 * El endpoint NO devuelve el nombre completo: arma el mismo recorte
 * "PrimerNombre [Inicial2.] ApellidoPaterno [InicialMaterno.]" que usa
 * cumpleaños (ver docs/apps-script-cumpleanos.gs → buildDisplayName).
 *
 * ─── PASOS DE INSTALACIÓN ───────────────────────────────────────────────────
 * 1. Abre tu hoja de Google Sheets con los galardonados.
 *    Columnas esperadas (en cualquier orden, igual que en cumpleaños):
 *      Apellido Paterno · Apellido Materno · Nombres · Fecha · Insignia · Grupo · Clave
 *
 *    Formato de cada columna:
 *      - Apellido Paterno: requerido.
 *      - Apellido Materno: opcional.
 *      - Nombres:          uno o más nombres de pila ("María Guadalupe").
 *      - Fecha:            cualquier fecha; solo se usa el año.
 *      - Insignia:         una de las claves del mapa `insignias` en
 *                          includes/data/cuadro-de-adelanto.json. Hoy:
 *                            GRAN CASTOR CAFE
 *                            ARCOIRIS
 *                            LOBO RAMPANTE
 *                            AVE FENIX
 *                            SCOUT AGUILA
 *                            B.P. PRECURSORA   (ver nota abajo)
 *                            B.P. ROVER
 *                          Las dos variantes Baden-Powell son insignias separadas.
 *      - Grupo:            número o identificador del grupo scout (ej. "136").
 *      - Clave:            folio/clave interna (ej. "2026-07"). Opcional.
 *
 * 2. Menú: Extensiones → Apps Script.
 * 3. Borra el contenido de Code.gs y pega TODO este archivo.
 * 4. Ajusta CONFIG abajo (SHEET_NAME y nombres de columna si difieren).
 * 5. Guarda (Ctrl+S). Asigna un nombre al proyecto (ej. "Cuadro AGSMAC").
 * 6. Implementar → Nueva implementación → Tipo: Aplicación web.
 *      - Descripción: cuadro-honor v1
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier persona  (NO requiere login)
 *    Pulsa Implementar y autoriza los permisos cuando pregunte.
 * 7. Copia la URL del Web App (termina en /exec) y pégala en
 *    includes/data/cuadro-de-adelanto.json → "appsScriptUrl".
 *
 * Cada vez que cambies este script, debes implementar una NUEVA VERSIÓN
 * (Implementar → Administrar implementaciones → Editar → Nueva versión).
 *
 * ─── PRIVACIDAD ─────────────────────────────────────────────────────────────
 * El endpoint solo expone:
 *   - Nombre recortado (PrimerNombre [Inicial2.] ApellidoPaterno [InicialM.]).
 *   - Grupo, insignia (clave canónica), año (sin día/mes), clave.
 * No devuelve fecha exacta, apellido materno completo, ni columnas adicionales.
 */

// ═════ CONFIG ════════════════════════════════════════════════════════════════
var CONFIG = {
  SHEET_NAME: 'Hoja 1',
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

function doGet(e) {
  try {
    var awards = getAwardsCached();
    return jsonResponse({ awards: awards, updatedAt: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message || err), awards: [] });
  }
}

// ─── Caché del lado servidor ─────────────────────────────────────────────────
// Reduce la latencia para llamadas subsecuentes de cualquier cliente.
// Se invalida automáticamente cada CACHE_TTL_SECONDS, o manualmente
// ejecutando clearCache() desde el editor de Apps Script.
var CACHE_KEY = 'cuadro-honor-awards-v1';
var CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 horas

function getAwardsCached() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CACHE_KEY);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) { /* re-lee abajo */ }
  }
  var awards = readAwards();
  try {
    cache.put(CACHE_KEY, JSON.stringify(awards), CACHE_TTL_SECONDS);
  } catch (_) {
    // CacheService limita a 100 KB por entrada; si excede, se sirve sin caché.
  }
  return awards;
}

function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
}

function readAwards() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  var headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  function col(name) { return headers.indexOf(String(name || '').toLowerCase()); }

  var iPaterno  = col(CONFIG.HEADERS.apellidoPaterno);
  var iMaterno  = col(CONFIG.HEADERS.apellidoMaterno);
  var iNombres  = col(CONFIG.HEADERS.nombres);
  var iFecha    = col(CONFIG.HEADERS.fecha);
  var iInsignia = col(CONFIG.HEADERS.insignia);
  var iGrupo    = col(CONFIG.HEADERS.grupo);
  var iClave    = col(CONFIG.HEADERS.clave);

  if (iPaterno === -1 || iNombres === -1 || iFecha === -1 || iInsignia === -1) {
    throw new Error('Faltan columnas requeridas (Apellido Paterno, Nombres, Fecha, Insignia). Revisa CONFIG.HEADERS.');
  }

  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
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
  // Año descendente, luego insignia, luego nombre.
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

// Normaliza (mayúsculas, sin acentos, espacios colapsados) y aplica alias.
function canonicalInsignia(s) {
  var norm = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  if (!norm) return '';
  return norm;
}

/**
 * Recorte de nombre, idéntico al de cumpleaños (ver buildDisplayName en
 * docs/apps-script-cumpleanos.gs):
 *   "PrimerNombre [InicialSegundoNombre.] ApellidoPaterno [InicialApellidoMaterno.]"
 *
 * Ejemplos:
 *   nombres "Andrea Azul", paterno "Hernandez", materno "Ramirez"
 *     → "Andrea A. Hernandez R."
 *   nombres "Daniela", paterno "Molina", materno "Osorio"
 *     → "Daniela Molina O."
 *   nombres "Eder", paterno "Perez", materno ""
 *     → "Eder Perez"
 */
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

/**
 * Cumpleaños — Apps Script Web App para AGSMAC
 * ============================================
 * Lee la hoja PRIVADA de cumpleaños y devuelve solo los registros dentro de
 * ±RANGE_DAYS días alrededor de hoy, con campos mínimos (sin año de nacimiento).
 *
 * El sitio en GitHub Pages hace fetch() a la URL pública de este Web App.
 * La hoja sigue siendo privada — solo este script (corriendo como tú) puede leerla.
 *
 * ─── PASOS DE INSTALACIÓN ───────────────────────────────────────────────────
 * 1. Abre tu hoja de Google Sheets con los cumpleaños.
 * 2. Menú: Extensiones → Apps Script.
 * 3. Borra el contenido de Code.gs y pega TODO este archivo.
 * 4. Ajusta CONFIG abajo (SHEET_NAME, columnas, RANGE_DAYS).
 * 5. Guarda (Ctrl+S). Asigna un nombre al proyecto (ej. "Cumpleaños AGSMAC").
 * 6. Implementar → Nueva implementación → Tipo: Aplicación web.
 *      - Descripción: cumpleanos v1
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier persona  (NO requiere login)
 *    Pulsa Implementar y autoriza los permisos cuando pregunte.
 * 7. Copia la URL del Web App (termina en /exec) y pégala en
 *    includes/data/cumpleanos.json → "appsScriptUrl".
 *
 * Cada vez que cambies este script, debes implementar una NUEVA VERSIÓN
 * (Implementar → Administrar implementaciones → Editar → Nueva versión).
 *
 * ─── PRIVACIDAD ─────────────────────────────────────────────────────────────
 * El endpoint NO expone:
 *   - Año de nacimiento (solo mes y día).
 *   - Filas fuera de la ventana ±RANGE_DAYS.
 * Si quieres más anonimización, edita formatEntry() abajo
 * (por ejemplo, devolver solo primer nombre + inicial del apellido).
 */

// ═════ CONFIG ════════════════════════════════════════════════════════════════
var CONFIG = {
  SHEET_NAME: 'Hoja 1',                       // Nombre EXACTO de la pestaña
  HEADERS: {
    nombres:          'Nombres',              // Columna con el/los nombre(s) de pila
    apellidoPaterno:  'Apellido Paterno',     // Apellido paterno
    apellidoMaterno:  'Apellido Materno',     // Apellido materno (opcional)
    date:             'Fecha de Nac.',        // Fecha de nacimiento
    group:            'Grupo'                 // Grupo (opcional)
  },
  RANGE_DAYS: 20                              // Ventana ± días alrededor de hoy
};
// ═════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    var days = (e && e.parameter && e.parameter.days)
      ? Math.max(0, parseInt(e.parameter.days, 10) || CONFIG.RANGE_DAYS)
      : CONFIG.RANGE_DAYS;
    var entries = readBirthdays();
    var inWindow = entries
      .filter(function (e2) { return Math.abs(daysDistance(e2.month, e2.day)) <= days; })
      .sort(function (a, b) {
        return Math.abs(daysDistance(a.month, a.day)) - Math.abs(daysDistance(b.month, b.day));
      })
      .map(formatEntry);
    return jsonResponse({ birthdays: inWindow, rangeDays: days });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message || err), birthdays: [] });
  }
}

function readBirthdays() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var nombresIdx     = headers.indexOf(CONFIG.HEADERS.nombres.toLowerCase());
  var paternoIdx     = headers.indexOf(CONFIG.HEADERS.apellidoPaterno.toLowerCase());
  var maternoIdx     = headers.indexOf(CONFIG.HEADERS.apellidoMaterno.toLowerCase());
  var dateIdx        = headers.indexOf(CONFIG.HEADERS.date.toLowerCase());
  var groupIdx       = headers.indexOf(CONFIG.HEADERS.group.toLowerCase());
  if (nombresIdx === -1 || paternoIdx === -1 || dateIdx === -1) {
    throw new Error('Faltan columnas requeridas (Nombres, Apellido Paterno, Fecha). Revisa CONFIG.HEADERS.');
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
  var bday = new Date(now.getFullYear(), month - 1, day);
  var diff = Math.round((bday - now) / 86400000);
  var len  = isLeap(now.getFullYear()) ? 366 : 365;
  if (diff >  len / 2) diff -= len;
  if (diff < -len / 2) diff += len;
  return diff;
}

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }

/**
 * Formato final mostrado en el tile:
 *   "<PrimerNombre> [<InicialSegundoNombre>.] <ApellidoPaterno> [<InicialApellidoMaterno>.]"
 * Ejemplos:
 *   nombres "María Guadalupe", paterno "López", materno "García"
 *     → "María G. López G."
 *   nombres "Juan", paterno "Pérez", materno ""
 *     → "Juan Pérez"
 * El script ya filtró por ±RANGE_DAYS, así que NO devolvemos la fecha.
 */
function formatEntry(e) {
  return {
    name: buildDisplayName(e.nombres, e.paterno, e.materno),
    group: e.group
  };
}

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

/**
 * Helper opcional: deja solo primer nombre + inicial del último apellido.
 * Por si quieres aún más anonimización (úsalo desde formatEntry).
 */
function firstNameAndInitial(fullName) {
  var parts = String(fullName).trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || '';
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
}

/**
 * ConCuScout 2026 — Pre-registro a Academias · Apps Script Web App
 * ================================================================
 * Backend para el pre-registro a academias de la Convivencia Cultural Scout.
 *
 * Hace tres cosas sobre una hoja PRIVADA de Google Sheets:
 *   - GET  ?action=counts   → devuelve cuántos lugares lleva cada academia.
 *   - POST {name,group,section,academies:[id,id,id]} → registra un participante,
 *          validando cupo (máx. CONFIG.MAX por academia) y duplicados, de forma
 *          ATÓMICA con LockService (a prueba de envíos simultáneos).
 *   - POST {action:'list', token} → lista los registrados del grupo dueño de ese
 *          token (para que cada jefe consulte SOLO su grupo desde un enlace
 *          secreto: academias-jefes.html?g=<token>). El token→grupo vive en
 *          CONFIG.GROUP_TOKENS; va por POST para no exponerlo en la URL/logs.
 *
 * El sitio en GitHub Pages hace fetch() a la URL pública de este Web App.
 * La hoja sigue siendo privada — solo este script (corriendo como tú) la escribe.
 *
 * ─── PASOS DE INSTALACIÓN ───────────────────────────────────────────────────
 * 1. Crea una Google Sheet nueva (ej. "ConCuScout 2026 - Academias").
 * 2. Menú: Extensiones → Apps Script.
 * 3. Borra el contenido de Code.gs y pega TODO este archivo.
 * 4. (Opcional) Ajusta CONFIG abajo: MAX por academia, ACADEMY_IDS, SHEET_NAME.
 *    Los ACADEMY_IDS deben coincidir EXACTAMENTE con los "id" de
 *    includes/data/academias.json.
 * 5. Guarda (Ctrl+S). Ejecuta una vez la función `setup` (menú Ejecutar → setup)
 *    para crear los encabezados y autorizar permisos.
 * 6. Implementar → Nueva implementación → Tipo: Aplicación web.
 *      - Descripción: academias v1
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier persona  (NO requiere login)
 *    Pulsa Implementar y autoriza los permisos cuando pregunte.
 * 7. Copia la URL del Web App (termina en /exec) y pégala en
 *    includes/data/academias.json → "appsScriptUrl".
 *
 * Cada vez que cambies este script, debes implementar una NUEVA VERSIÓN
 * (Implementar → Administrar implementaciones → Editar → Nueva versión).
 *
 * ─── ADMINISTRACIÓN DE CAMBIOS ──────────────────────────────────────────────
 * Una vez registrado, un participante NO puede editar su elección desde el sitio.
 * Si alguien te pide un cambio, edítalo tú directamente en la hoja:
 *   - Para mover de academia: cambia el valor en las columnas Academia 1/2/3.
 *   - Para liberar un lugar: borra la fila completa.
 * Los conteos se recalculan solos a partir de las filas existentes.
 */

// ═════ CONFIG ════════════════════════════════════════════════════════════════
var CONFIG = {
  SHEET_NAME: 'Registros',
  MAX: 60, // Cupo máximo por academia (luego se divide en 3 bloques de 20)
  PICK: 3, // Academias que cada participante debe elegir
  // Enlace secreto POR GRUPO para el panel de jefes (academias-jefes.html).
  // Cada grupo tiene un token único e imposible de adivinar; el jefe abre
  //   academias-jefes.html?g=<token>
  // y ve SOLO los registros de su grupo (el token identifica el grupo en el
  // servidor; el cliente nunca elige grupo ni envía clave).
  // ── IMPORTANTE ──────────────────────────────────────────────────────────
  // Pon aquí, en el editor de Apps Script (NO en ningún JSON del sitio), un
  // token largo y aleatorio por grupo, y comparte cada URL solo con su jefe.
  // ¿No sabes qué poner? Corre la función generarTokensJefes() (Ejecutar →
  // generarTokensJefes), copia el bloque que imprime en los Registros/Logs y
  // pégalo aquí reemplazando este GROUP_TOKENS. Si un token queda vacío, ese
  // grupo no tiene acceso.
  GROUP_TOKENS: {
    'Grupo 54':  'PON-UN-TOKEN-UNICO-Y-LARGO-54',
    'Grupo 133': 'PON-UN-TOKEN-UNICO-Y-LARGO-133',
    'Grupo 136': 'PON-UN-TOKEN-UNICO-Y-LARGO-136',
    'Grupo 729': 'PON-UN-TOKEN-UNICO-Y-LARGO-729'
  },
  // IDs válidos de academia — deben coincidir con includes/data/academias.json
  ACADEMY_IDS: ['escenicas', 'plasticas', 'textiles', 'escultura', 'gastronomia', 'logica', 'letras'],
  // Nombres legibles por id (solo para mostrar en la hoja). Opcional.
  ACADEMY_NAMES: {
    escenicas: 'Artes Escénicas y Expresión Oral',
    plasticas: 'Artes Plásticas y Pintura',
    textiles: 'Artes Textiles y Accesorios',
    escultura: 'Escultura, Talla y Tradición Scout',
    gastronomia: 'Gastronomía',
    logica: 'Lógica y Habilidad',
    letras: 'Letras y Artes Visuales'
  }
};
// Columnas (orden) de la hoja "Registros":
// A: Marca de tiempo | B: Nombre(s) | C: Apellido paterno | D: Apellido materno
// E: Grupo | F: Sección | G: Academia 1 | H: Academia 2 | I: Academia 3 | J: Clave
var HEADERS = ['Marca de tiempo', 'Nombre(s)', 'Apellido paterno', 'Apellido materno', 'Grupo', 'Sección', 'Academia 1', 'Academia 2', 'Academia 3', 'Clave'];
// Marca de versión: aparece en la respuesta GET para verificar qué versión
// está REALMENTE desplegada (la URL /exec usa la última versión publicada).
var SCRIPT_VERSION = 'academias-4-lista-por-token';
// ═════════════════════════════════════════════════════════════════════════════

/** Ejecuta esto UNA vez a mano para crear la hoja y sus encabezados. */
function setup() {
  var sheet = getSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return 'Listo. Hoja "' + CONFIG.SHEET_NAME + '" preparada.';
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  return sheet;
}

/**
 * Genera un token aleatorio y largo por cada grupo y lo imprime en el registro
 * de ejecución (menú Ver → Registros / Logs), listo para PEGAR dentro de
 * CONFIG.GROUP_TOKENS. Córrela a mano UNA vez desde el editor
 * (Ejecutar → generarTokensJefes), copia el bloque impreso, pégalo arriba en
 * GROUP_TOKENS y vuelve a implementar (Nueva versión).
 *
 * No cambia nada por sí sola: solo imprime; tú decides pegarlos.
 */
function generarTokensJefes() {
  var grupos = Object.keys(CONFIG.GROUP_TOKENS || {});
  if (!grupos.length) grupos = ['Grupo 54', 'Grupo 133', 'Grupo 136', 'Grupo 729'];
  var lines = grupos.map(function (g) {
    return "    '" + g + "': '" + nuevoToken() + "',";
  });
  var bloque = 'GROUP_TOKENS: {\n' + lines.join('\n') + '\n  },';
  Logger.log('Pega esto dentro de CONFIG (reemplazando GROUP_TOKENS):\n\n' + bloque);
  return bloque; // también se ve en el panel de resultados
}

/** Un token corto pero imposible de adivinar (2 UUID sin guiones). */
function nuevoToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

// ─── GET: conteos por academia ───────────────────────────────────────────────
function doGet(e) {
  try {
    var data = readAll();
    return jsonResponse({
      ok: true,
      version: SCRIPT_VERSION,
      max: CONFIG.MAX,
      pick: CONFIG.PICK,
      total: data.rows.length,
      counts: data.counts
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

// ─── POST: registrar participante · o listar (jefes) ─────────────────────────
function doPost(e) {
  // El listado para jefes viaja por POST (no GET) para que la clave no quede
  // en la URL ni en los logs de referrer. Se atiende antes de tomar el lock.
  var pre = parseBody(e);
  if (pre && String(pre.action || '').trim() === 'list') return handleList(pre);

  var lock = LockService.getScriptLock();
  try {
    // Espera hasta 20s por el lock para serializar envíos simultáneos.
    lock.waitLock(20000);

    var body = parseBody(e);
    var nombres = String(body.nombres || '').trim();
    var paterno = String(body.paterno || '').trim();
    var materno = String(body.materno || '').trim();
    // name puede venir legado; si no, se arma con los componentes.
    var name = String(body.name || '').trim() ||
      [nombres, paterno, materno].filter(function (x) { return x; }).join(' ');
    var group = String(body.group || '').trim();
    var section = String(body.section || '').trim();
    var academies = Array.isArray(body.academies) ? body.academies.map(function (a) { return String(a).trim(); }) : [];
    // El usuario ya confirmó que es una persona DISTINTA a un parecido detectado.
    var confirmDifferent = (body.confirmDifferent === true || body.confirmDifferent === 'true');

    // --- Validaciones de forma ---
    if (!name) return jsonResponse({ ok: false, code: 'invalid', error: 'Falta el nombre.' });
    if (!group) return jsonResponse({ ok: false, code: 'invalid', error: 'Falta el grupo.' });
    if (!section) return jsonResponse({ ok: false, code: 'invalid', error: 'Falta la sección.' });

    var uniq = academies.filter(function (a, i) { return a && academies.indexOf(a) === i; });
    if (uniq.length !== CONFIG.PICK) {
      return jsonResponse({ ok: false, code: 'invalid', error: 'Debes elegir exactamente ' + CONFIG.PICK + ' academias distintas.' });
    }
    for (var i = 0; i < uniq.length; i++) {
      if (CONFIG.ACADEMY_IDS.indexOf(uniq[i]) === -1) {
        return jsonResponse({ ok: false, code: 'invalid', error: 'Academia no válida: ' + uniq[i] });
      }
    }

    var data = readAll();

    // --- Duplicado exacto (mismo nombre+grupo+sección) ---
    var key = makeKey(name, group, section);
    if (data.keys.indexOf(key) !== -1) {
      return jsonResponse({
        ok: false, code: 'duplicate',
        error: 'Ya existe un registro con ese nombre, grupo y sección.',
        counts: data.counts, max: CONFIG.MAX
      });
    }

    // --- Parecido (fuzzy) en el mismo grupo y sección ---
    // Si encontramos un nombre muy similar, pedimos confirmar identidad antes
    // de registrar (a menos que ya haya confirmado que es otra persona).
    if (!confirmDifferent) {
      var similares = findSimilar(name, group, section, data);
      if (similares.length) {
        return jsonResponse({
          ok: false, code: 'similar',
          similar: similares,
          counts: data.counts, max: CONFIG.MAX
        });
      }
    }

    // --- Cupo ---
    var llenas = uniq.filter(function (id) { return (data.counts[id] || 0) >= CONFIG.MAX; });
    if (llenas.length) {
      return jsonResponse({
        ok: false, code: 'full',
        full: llenas,
        error: 'Una o más academias ya están llenas: ' + llenas.map(nameOf).join(', '),
        counts: data.counts, max: CONFIG.MAX
      });
    }

    // --- Escribir registro ---
    getSheet().appendRow([
      new Date(), (nombres || name), paterno, materno, group, section,
      uniq[0], uniq[1], uniq[2], key
    ]);

    // Recalcula conteos incluyendo el nuevo registro.
    uniq.forEach(function (id) { data.counts[id] = (data.counts[id] || 0) + 1; });

    return jsonResponse({ ok: true, counts: data.counts, max: CONFIG.MAX });
  } catch (err) {
    return jsonResponse({ ok: false, code: 'error', error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Listado de registrados para el jefe de un grupo. El grupo se determina por el
// token secreto del enlace (CONFIG.GROUP_TOKENS); el cliente NO elige grupo.
function handleList(body) {
  try {
    var token = String(body.token || '').trim();
    var group = tokenToGroup(token);
    if (!group) {
      return jsonResponse({ ok: false, code: 'auth', error: 'Enlace no válido o vencido.' });
    }

    var data = readAll();
    var rows = [];
    data.rows.forEach(function (r) {
      var g = String(r[4] || '').trim();
      if (normalize(g) !== normalize(group)) return; // otro grupo
      var fullName = [r[1], r[2], r[3]].filter(function (x) { return x; }).join(' ');
      var academies = [r[6], r[7], r[8]]
        .map(function (a) { return String(a || '').trim(); })
        .filter(function (a) { return a; });
      rows.push({
        timestamp: (r[0] instanceof Date) ? r[0].toISOString() : String(r[0] || ''),
        nombre: fullName,
        group: g,
        section: String(r[5] || '').trim(),
        academies: academies
      });
    });

    return jsonResponse({
      ok: true,
      version: SCRIPT_VERSION,
      group: group,
      total: rows.length,
      rows: rows
    });
  } catch (err) {
    return jsonResponse({ ok: false, code: 'error', error: String(err && err.message || err) });
  }
}

// Devuelve el grupo dueño de un token, o '' si no coincide con ninguno.
function tokenToGroup(token) {
  token = String(token || '').trim();
  if (!token) return '';
  var map = CONFIG.GROUP_TOKENS || {};
  for (var g in map) {
    if (map.hasOwnProperty(g)) {
      var t = String(map[g] || '').trim();
      if (t && t === token) return g;
    }
  }
  return '';
}

function readAll() {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var counts = {};
  CONFIG.ACADEMY_IDS.forEach(function (id) { counts[id] = 0; });
  var rows = [];
  var keys = [];
  if (lastRow < 2) return { rows: rows, counts: counts, keys: keys };

  // Columnas G,H,I = academias (índices 6,7,8); J = clave (índice 9)
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  values.forEach(function (r) {
    if (!r[1]) return; // sin nombre = fila vacía
    rows.push(r);
    var fullName = [r[1], r[2], r[3]].filter(function (x) { return x; }).join(' ');
    keys.push(String(r[9] || makeKey(fullName, r[4], r[5])));
    [r[6], r[7], r[8]].forEach(function (id) {
      id = String(id || '').trim();
      if (id && counts.hasOwnProperty(id)) counts[id]++;
    });
  });
  return { rows: rows, counts: counts, keys: keys };
}

function parseBody(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* intenta form */ }
  }
  if (e && e.parameter) return e.parameter; // x-www-form-urlencoded fallback
  return {};
}

/** Clave normalizada para detectar duplicados (sin acentos, minúsculas). */
function makeKey(name, group, section) {
  return [name, group, section].map(normalize).join('|');
}

// ─── Cotejo difuso de nombres ────────────────────────────────────────────────
// Devuelve los nombres ya registrados (en el MISMO grupo y sección) que se
// parecen mucho al nombre nuevo, para pedir confirmación de identidad.
function findSimilar(name, group, section, data) {
  var out = [];
  data.rows.forEach(function (r) {
    if (normalize(r[4]) !== normalize(group)) return;     // distinto grupo
    if (normalize(r[5]) !== normalize(section)) return;   // distinta sección
    var existing = [r[1], r[2], r[3]].filter(function (x) { return x; }).join(' ');
    if (existing && nameSimilar(name, existing)) out.push(existing);
  });
  return out;
}

// Heurística: dos nombres se consideran "parecidos" si
//   a) los tokens del más corto están (difusamente) contenidos en el más largo
//      — cubre el caso de faltar/sobrar un apellido o segundo nombre, o
//   b) su similitud global (orden de palabras ignorado) supera un umbral.
function nameSimilar(aFull, bFull) {
  var a = normalize(aFull), b = normalize(bFull);
  if (!a || !b) return false;
  if (a === b) return true;
  var ta = a.split(' ').filter(Boolean);
  var tb = b.split(' ').filter(Boolean);

  var small = ta.length <= tb.length ? ta : tb;
  var big = ta.length <= tb.length ? tb : ta;
  var matched = 0;
  small.forEach(function (t) {
    for (var i = 0; i < big.length; i++) {
      if (strSim(t, big[i]) >= 0.85) { matched++; break; }
    }
  });
  // Contención difusa: todos los tokens del nombre corto aparecen en el largo.
  if (small.length >= 2 && matched === small.length) return true;

  // Similitud global con tokens ordenados (ignora el orden de las palabras).
  var sa = ta.slice().sort().join(' ');
  var sb = tb.slice().sort().join(' ');
  return strSim(sa, sb) >= 0.86;
}

function strSim(a, b) {
  if (a === b) return 1;
  var m = Math.max(a.length, b.length);
  if (!m) return 1;
  return 1 - (levenshtein(a, b) / m);
}

function levenshtein(a, b) {
  a = String(a); b = String(b);
  var al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  var prev = [];
  for (var j = 0; j <= bl; j++) prev[j] = j;
  for (var i = 1; i <= al; i++) {
    var cur = [i];
    for (var k = 1; k <= bl; k++) {
      var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
    }
    prev = cur;
  }
  return prev[bl];
}

function normalize(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function nameOf(id) {
  return CONFIG.ACADEMY_NAMES[id] || id;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

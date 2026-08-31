/**
 * VIII Rally Virtual Tropas 2026 — Registro de Patrullas · Apps Script Web App
 * ============================================================================
 * Backend del registro de patrullas del VIII Rally Virtual (5 y 6 de septiembre
 * de 2026). Escribe sobre una hoja PRIVADA de Google Sheets.
 *
 *   - GET  ?action=status            -> { ok, total, abierto, version }
 *   - POST {patrulla, grupo, ...}    -> registra una patrulla, validando
 *                                       duplicados y domicilios repetidos de
 *                                       forma ATÓMICA con LockService.
 *   - POST {action:'list', token}    -> lista de patrullas registradas para el
 *                                       Comité (rally-comite.html?t=<token>).
 *
 * El sitio en GitHub Pages hace fetch() a la URL pública de este Web App.
 * La hoja sigue siendo privada: solo este script (corriendo como tú) la escribe.
 *
 * ─── PASOS DE INSTALACIÓN ───────────────────────────────────────────────────
 * 1. Crea una Google Sheet nueva (ej. "VIII Rally Virtual 2026 - Registros").
 * 2. Menú: Extensiones -> Apps Script.
 * 3. Borra el contenido de Code.gs y pega TODO este archivo.
 * 4. Ajusta CONFIG abajo (sobre todo COMITE_TOKEN y CIERRE_INSCRIPCION).
 * 5. Guarda (Ctrl+S) y ejecuta una vez la función `setup` para crear los
 *    encabezados y autorizar permisos.
 * 6. Implementar -> Nueva implementación -> Tipo: Aplicación web.
 *      - Descripción: rally v1
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier persona  (NO requiere login)
 * 7. Copia la URL del Web App (termina en /exec) y pégala en
 *    includes/data/rally.json -> "appsScriptUrl".
 *
 * Cada vez que cambies este script debes implementar una NUEVA VERSIÓN
 * (Implementar -> Administrar implementaciones -> Editar -> Nueva versión),
 * o la URL /exec seguirá sirviendo la versión anterior.
 *
 * ─── ADMINISTRACIÓN ─────────────────────────────────────────────────────────
 * Una patrulla no puede editar su registro desde el sitio. Si piden un cambio,
 * edítalo directamente en la hoja. Para dar de baja a una patrulla, borra su
 * fila completa.
 *
 * La columna "Base 0" y las columnas de cada base se llenan a mano por los
 * jefes durante el evento (entregada / incompleta / no entregada).
 */

// ═════ CONFIG ════════════════════════════════════════════════════════════════
var CONFIG = {
  SHEET_NAME: 'Registros',

  // Token secreto para el panel del Comité (rally-comite.html?t=<token>).
  // Genera uno largo con generarToken() y pégalo aquí.
  COMITE_TOKEN: 'PON-UN-TOKEN-UNICO-Y-LARGO',

  // Cierre de inscripciones. Después de esta fecha el formulario rechaza
  // registros nuevos. Formato: 'YYYY-MM-DDTHH:mm:ss-06:00' (hora del centro).
  // El registro queda abierto hasta el arranque del evento.
  CIERRE_INSCRIPCION: '2026-09-05T12:00:00-06:00',

  // Grupos válidos de la Asociación (misma lista que includes/data/grupos.json
  // en el sitio; si se da de alta un grupo nuevo hay que actualizarla aquí).
  GRUPOS: ['Grupo 5', 'Grupo 22', 'Grupo 50', 'Grupo 54', 'Grupo 96',
           'Grupo 133', 'Grupo 136', 'Grupo 729'],

  SECCIONES: ['Tropa de Muchachas Scouts', 'Tropa Scout'],

  // Cargos de patrulla que pide el formulario.
  CARGOS: ['Guía', 'Subguía', 'Guardián de Leyendas', 'Tesorero',
           'Secretario', 'Cocinero', 'Histrión', 'Enfermero', 'Intendente'],

  MIN_INTEGRANTES: 3,
  MAX_INTEGRANTES: 8,

  // Correo del Comité: recibe un aviso por cada registro nuevo.
  // Deja '' para no enviar avisos.
  AVISO_EMAIL: 'contacto@agsmac.org'
};

var HEADERS = [
  'Marca de tiempo', 'Patrulla', 'Grupo', 'Sección', 'Integrantes',
  'Instagram',
  'Dirección del rincón', 'Padre o madre que los hospeda', 'Su teléfono',
  'Roster (nombre · cargos)', 'Pago', 'Base 0'
];

var SCRIPT_VERSION = 'rally-1';
// ═════════════════════════════════════════════════════════════════════════════

/** Ejecuta esto UNA vez a mano para crear la hoja y sus encabezados. */
function setup() {
  var sheet = getSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  Logger.log('Hoja lista: ' + CONFIG.SHEET_NAME);
}

/** Genera un token aleatorio para CONFIG.COMITE_TOKEN. */
function generarToken() {
  var chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 40; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  Logger.log('COMITE_TOKEN: ' + out);
  return out;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inscripcionAbierta() {
  if (!CONFIG.CIERRE_INSCRIPCION) return true;
  return new Date().getTime() <= new Date(CONFIG.CIERRE_INSCRIPCION).getTime();
}

// ═════ GET ═══════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var sheet = getSheet();
    var total = Math.max(0, sheet.getLastRow() - 1);
    return jsonResponse({
      ok: true,
      total: total,
      abierto: inscripcionAbierta(),
      version: SCRIPT_VERSION
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

// ═════ POST ══════════════════════════════════════════════════════════════════
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, code: 'badjson', error: 'Datos inválidos.' });
  }

  if (data && data.action === 'list') return handleList(data);
  return handleRegistro(data);
}

/** Lista de patrullas registradas — solo con el token del Comité. */
function handleList(data) {
  if (!CONFIG.COMITE_TOKEN || String(data.token || '') !== CONFIG.COMITE_TOKEN) {
    return jsonResponse({ ok: false, code: 'auth', error: 'Token inválido.' });
  }
  var sheet = getSheet();
  var last = sheet.getLastRow();
  if (last < 2) return jsonResponse({ ok: true, rows: [] });

  var values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var rows = values.map(function (r) {
    return {
      fecha: r[0] ? new Date(r[0]).toISOString() : '',
      patrulla: r[1], grupo: r[2], seccion: r[3], integrantes: r[4],
      instagram: r[5],
      direccion: r[6], responsable: r[7], telLocal: r[8],
      roster: r[9], pago: r[10], base0: r[11]
    };
  });
  return jsonResponse({ ok: true, rows: rows });
}

/** Registro de una patrulla. */
function handleRegistro(data) {
  if (!inscripcionAbierta()) {
    return jsonResponse({
      ok: false, code: 'closed',
      error: 'El periodo de inscripción ya cerró (el Rally ya comenzó).'
    });
  }

  // ── Validación de campos ──────────────────────────────────────────────────
  var patrulla = String(data.patrulla || '').trim();
  var grupo    = String(data.grupo || '').trim();
  var seccion  = String(data.seccion || '').trim();
  var instagram = String(data.instagram || '').trim().replace(/^@+/, '');
  var direccion = String(data.direccion || '').trim();
  var responsable = String(data.responsable || '').trim();
  var telLocal = String(data.telLocal || '').trim();
  var roster   = Array.isArray(data.roster) ? data.roster : [];

  if (!patrulla) return err('campo', 'Falta el nombre de la patrulla.');
  if (CONFIG.GRUPOS.indexOf(grupo) === -1) return err('campo', 'Selecciona un grupo válido.');
  if (CONFIG.SECCIONES.indexOf(seccion) === -1) return err('campo', 'Selecciona una sección válida.');
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(instagram)) {
    return err('campo', 'La cuenta de Instagram solo puede tener letras, números, punto y guion bajo.');
  }
  if (!direccion) return err('campo', 'Falta la dirección del rincón de patrulla.');
  if (!responsable) return err('campo', 'Falta el padre o madre que los hospeda.');

  // Roster: al menos MIN integrantes con nombre.
  // Los cargos llegan repartidos desde el tablero del formulario: un cargo
  // tiene un solo dueño, pero una persona puede llevar varios (m.cargos).
  // Se acepta m.cargo (texto) por compatibilidad con versiones anteriores.
  var limpio = roster.filter(function (m) {
    return m && String(m.nombre || '').trim();
  }).map(function (m) {
    var cargos = Array.isArray(m.cargos)
      ? m.cargos
      : String(m.cargo || '').split(',');
    cargos = cargos.map(function (c) { return String(c || '').trim(); })
      .filter(function (c) { return c; });
    return {
      cargos: cargos,
      nombre: String(m.nombre || '').trim()
    };
  });

  if (limpio.length < CONFIG.MIN_INTEGRANTES) {
    return err('campo', 'La patrulla debe tener al menos ' + CONFIG.MIN_INTEGRANTES + ' integrantes.');
  }
  if (limpio.length > CONFIG.MAX_INTEGRANTES) {
    return err('campo', 'Máximo ' + CONFIG.MAX_INTEGRANTES + ' integrantes.');
  }

  // Todos los cargos deben quedar repartidos y ninguno puede estar duplicado.
  var dueno = {};
  var repetidos = [];
  limpio.forEach(function (m) {
    m.cargos.forEach(function (c) {
      if (dueno[c]) { repetidos.push(c); return; }
      dueno[c] = m.nombre;
    });
  });
  if (repetidos.length) {
    return err('cargos', 'Estos cargos están asignados a más de una persona: ' +
      repetidos.join(', ') + '.');
  }
  var faltantes = CONFIG.CARGOS.filter(function (c) { return !dueno[c]; });
  if (faltantes.length) {
    return err('cargos', 'Falta repartir: ' + faltantes.join(', ') +
      '. Un mismo scout puede llevar más de un cargo.');
  }

  // ── Escritura atómica ─────────────────────────────────────────────────────
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e2) {
    return err('busy', 'El sistema está ocupado. Intenta de nuevo en unos segundos.');
  }

  try {
    var sheet = getSheet();
    var last = sheet.getLastRow();
    var existentes = last > 1
      ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
      : [];

    // Duplicado: misma patrulla + mismo grupo
    var dup = existentes.some(function (r) {
      return norm(r[1]) === norm(patrulla) && norm(r[2]) === norm(grupo);
    });
    if (dup) {
      return err('duplicate',
        'La patrulla ' + patrulla + ' del ' + grupo + ' ya está registrada. ' +
        'Si necesitas un cambio, escribe a ' + (CONFIG.AVISO_EMAIL || 'la organización') + '.');
    }

    // Instagram repetido
    var igDup = existentes.some(function (r) { return norm(r[5]) === norm(instagram); });
    if (igDup) {
      return err('instagram', 'Esa cuenta de Instagram ya está registrada por otra patrulla.');
    }

    // Domicilio repetido: dos patrullas no pueden compartir rincón de patrulla
    var dirDup = existentes.filter(function (r) { return norm(r[6]) === norm(direccion); });
    if (dirDup.length && !data.confirmDireccion) {
      return jsonResponse({
        ok: false, code: 'direccion',
        error: 'Ese domicilio ya está registrado por la patrulla ' + dirDup[0][1] +
               ' (' + dirDup[0][2] + '). Dos patrullas no pueden estar en el mismo domicilio.',
        patrullaExistente: dirDup[0][1] + ' · ' + dirDup[0][2]
      });
    }

    var rosterTxt = limpio.map(function (m) {
      return m.nombre + ' · ' +
        (m.cargos.length ? m.cargos.join(' + ') : 'sin cargo');
    }).join('\n');

    sheet.appendRow([
      new Date(), patrulla, grupo, seccion, limpio.length,
      '@' + instagram,
      direccion, responsable, telLocal,
      rosterTxt, 'Pendiente', 'Pendiente'
    ]);

    notificar(patrulla, grupo, seccion, limpio.length);

    return jsonResponse({
      ok: true,
      patrulla: patrulla,
      grupo: grupo,
      integrantes: limpio.length,
      total: limpio.length * 25
    });

  } catch (err3) {
    return jsonResponse({ ok: false, code: 'server', error: String(err3 && err3.message || err3) });
  } finally {
    lock.releaseLock();
  }
}

function err(code, msg) {
  return jsonResponse({ ok: false, code: code, error: msg });
}

/** Aviso por correo al Comité (silencioso si falla). */
function notificar(patrulla, grupo, seccion, integrantes) {
  if (!CONFIG.AVISO_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: CONFIG.AVISO_EMAIL,
      subject: '[VIII Rally] Registro: ' + patrulla + ' · ' + grupo,
      body: 'Nueva patrulla registrada.\n\n' +
        'Patrulla: ' + patrulla + '\n' +
        'Grupo: ' + grupo + '\n' +
        'Sección: ' + seccion + '\n' +
        'Integrantes: ' + integrantes + '\n' +
        'Total a depositar: $' + (integrantes * 25) + '\n\n' +
        'Los datos completos están en la hoja de cálculo.\n' +
        'El pago va aparte: el Tesorero manda el comprobante por correo indicando\n' +
        'la patrulla y el grupo. Marca "Pago" en la hoja cuando llegue.'
    });
  } catch (e) { /* no bloquear el registro por un fallo de correo */ }
}

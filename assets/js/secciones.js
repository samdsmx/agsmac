/* secciones.js
 * Catálogo canónico de las secciones de AGSMAC — fuente única de verdad.
 * ====================================================================
 * Antes vivía duplicado en varios scripts (calendario, biblioteca, álbum) y
 * en el mapa `SEC` de includes/programa-scout.html, cada uno con su propia
 * grafía y esquema de claves. Este archivo lo centraliza.
 *
 * La CLAVE canónica es el acrónimo oficial de la sección, que coincide con el
 * nombre del emblema en images/secciones/<ACRONIMO>.gif. Cada entrada expone el
 * nombre completo (para tooltips / aria-label) y la ruta del emblema.
 *
 * Además expone un índice de ALIAS (slugs del Álbum, nombres completos de la
 * Biblioteca) y `resolve(clave)` para que cada consumidor use su propio esquema
 * de clave sin duplicar el catálogo. `nombre(clave)` e `imagen(clave)` aceptan
 * acrónimo, slug o nombre completo indistintamente.
 *
 * Se carga como <script> (sin build) ANTES de los scripts que lo consumen
 * (ver detail1.html) y expone el objeto global window.AGSMAC_SECCIONES.
 */
(function (global) {
    'use strict';

    var BASE = 'images/secciones/';

    // Orden por edad de la sección (mismo criterio que el resto del sitio).
    var SECCIONES = {
        CC:  { nombre: 'Colonia de Castores',       imagen: BASE + 'CC.gif' },
        MG:  { nombre: 'Manada de Gacelas',         imagen: BASE + 'MG.gif' },
        ML:  { nombre: 'Manada de Lobatos',         imagen: BASE + 'ML.gif' },
        TMS: { nombre: 'Tropa de Muchachas Scouts', imagen: BASE + 'TMS.gif' },
        TS:  { nombre: 'Tropa Scout',               imagen: BASE + 'TS.gif' },
        CP:  { nombre: 'Clan de Precursoras',       imagen: BASE + 'CP.gif' },
        CR:  { nombre: 'Clan de Rovers',            imagen: BASE + 'CR.gif' },
        J:   { nombre: 'Scouters y Dirigentes',     imagen: BASE + 'J.gif' }
    };

    // "General" (toda la asociación): no es una sección; usa la flor de lis
    // azul de AGSMAC. Leyenda homologada en todo el sitio como "General".
    var TODAS = { nombre: 'General', imagen: 'images/fl.png' };

    // Índice de ALIAS → acrónimo canónico. Permite que módulos con esquemas de
    // clave propios (heredados de sus JSON o de proyectos externos) resuelvan
    // al mismo catálogo sin duplicarlo. Las claves se comparan en minúsculas.
    //   - Álbum Fotográfico: slugs de galeriaPublica/parseTitle.js.
    //   - Biblioteca: nombres completos (idénticos a los canónicos de arriba).
    var ALIASES = {
        // slugs del Álbum Fotográfico
        'castores':                  'CC',
        'manada-gacelas':            'MG',
        'manada-lobatos':            'ML',
        'tropa-muchachas':           'TMS',
        'tropa-scout':               'TS',
        'clan-precursoras':          'CP',
        'clan-rovers':               'CR',
        'scouters':                  'J',
        // nombres completos de la Biblioteca
        'colonia de castores':       'CC',
        'manada de gacelas':         'MG',
        'manada de lobatos':         'ML',
        'tropa de muchachas scouts': 'TMS',
        'tropa de muchachas':        'TMS',
        'tropa scout':               'TS',
        'clan de precursoras':       'CP',
        'clan de rovers':            'CR',
        'scouters y dirigentes':     'J'
    };

    // Orden canónico (por edad) de las secciones: el orden de inserción de las
    // claves de SECCIONES. Sirve para que los consumidores ordenen sus filtros
    // sin hardcodear su propia lista.
    var ORDEN = Object.keys(SECCIONES); // ['CC','MG','ML','TMS','TS','CP','CR','J']

    // Resuelve cualquier clave conocida (acrónimo, slug o nombre completo) al
    // objeto canónico { acr, nombre, imagen }. Devuelve null si no la conoce.
    function resolve(key) {
        if (key == null) return null;
        var k = String(key).trim();
        if (SECCIONES[k]) {
            return { acr: k, nombre: SECCIONES[k].nombre, imagen: SECCIONES[k].imagen };
        }
        var acr = ALIASES[k.toLowerCase()];
        if (acr && SECCIONES[acr]) {
            return { acr: acr, nombre: SECCIONES[acr].nombre, imagen: SECCIONES[acr].imagen };
        }
        return null;
    }

    global.AGSMAC_SECCIONES = {
        map: SECCIONES,
        todas: TODAS,
        resolve: resolve,
        // Índice de orden canónico de una clave (por edad). Desconocidas → al
        // final. Útil para ordenar listas de filtros derivadas de datos.
        orden: function (key) {
            var s = resolve(key);
            return s ? ORDEN.indexOf(s.acr) : Number.MAX_SAFE_INTEGER;
        },
        // Nombre completo a partir de cualquier clave (fallback: la clave dada).
        nombre: function (key) {
            var s = resolve(key);
            return s ? s.nombre : String(key == null ? '' : key);
        },
        // Ruta del emblema a partir de cualquier clave (fallback: cadena vacía).
        imagen: function (key) {
            var s = resolve(key);
            return s ? s.imagen : '';
        }
    };
})(window);

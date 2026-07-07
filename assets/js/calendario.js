/* calendario.js
 * Renderiza la página "Calendario de Actividades" con el diseño "Escudos
 * bordados": cada actividad es un escudo/parche que se cose al tablero (las ya
 * pasadas llevan punto cruz y quedan fijas) y cada fecha simbólica (efeméride)
 * es un pin de esmalte. Se lee includes/data/calendario.json.
 *
 * Decisiones de diseño:
 *   - No hay fechas exactas en actividades (solo mes); las EFEMÉRIDES sí llevan
 *     día (campo 'dia') por ser fechas fijas.
 *   - Las próximas se muestran primero (escudos "sueltos", con listón "Próxima")
 *     y las pasadas después en fila aparte (escudos "cosidos"). Se reacomoda
 *     solo según el mes/año actual.
 *   - 'tipo' distingue 'actividad' de 'efemeride'.
 *
 * El fragmento HTML se inyecta tarde (vía includedHtml en detail1.html), por
 * eso usamos un MutationObserver que espera al contenedor #calendario.
 */
(function () {
    'use strict';

    var CONFIG_URL = 'includes/data/calendario.json';

    var MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Tinta (gradiente) de cada estampa. Se asigna por mes para que cada
    // estampa tenga su propia identidad y el conjunto se vea dinámico.
    var GRADIENTS = [
        'linear-gradient(135deg,#FF6B6B,#FF8E53)',
        'linear-gradient(135deg,#6A82FB,#FC5C7D)',
        'linear-gradient(135deg,#11998e,#38ef7d)',
        'linear-gradient(135deg,#F7971E,#FFD200)',
        'linear-gradient(135deg,#8E2DE2,#4A00E0)',
        'linear-gradient(135deg,#00c6ff,#0072ff)',
        'linear-gradient(135deg,#f857a6,#ff5858)',
        'linear-gradient(135deg,#43cea2,#185a9d)',
        'linear-gradient(135deg,#ee0979,#ff6a00)',
        'linear-gradient(135deg,#2193b0,#6dd5ed)',
        'linear-gradient(135deg,#c94b4b,#4b134f)',
        'linear-gradient(135deg,#1f4037,#99f2c8)'
    ];

    // Ligeras rotaciones para el efecto "scrapbook" de las estampas/sellos.
    var ROT = ['-3deg', '2.2deg', '-1.6deg', '3deg', '-2.4deg', '1.5deg', '-2deg', '2.8deg'];

    // Catálogo canónico de secciones (acrónimo → nombre + emblema).
    // Definido en assets/js/secciones.js y cargado antes que este script.
    // Fallback defensivo por si el orden de carga cambiara.
    var SECCIONES = window.AGSMAC_SECCIONES || {
        todas: { nombre: 'General', imagen: 'images/fl.png' },
        nombre: function (a) { return String(a == null ? '' : a); },
        imagen: function (a) { return a ? 'images/secciones/' + a + '.gif' : ''; }
    };

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function loadConfig() {
        return fetch(CONFIG_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
    }

    function normalizeActivities(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.map(function (a) {
            var mes = Number(a.mes);
            return {
                titulo: String(a.titulo || '').trim(),
                mes: (mes >= 1 && mes <= 12) ? mes : null,
                icono: String(a.icono || 'fa-calendar').trim(),
                descripcion: String(a.descripcion || '').trim(),
                secciones: a.secciones,
                tipo: (String(a.tipo || 'actividad').trim().toLowerCase() === 'efemeride') ? 'efemeride' : 'actividad',
                color: a.color,
                dia: Number(a.dia) || null
            };
        }).filter(function (a) { return a.titulo; });
    }

    function gradientFor(a, idx) {
        if (a.color) return a.color;
        var m = a.mes ? (a.mes - 1) : idx;
        return GRADIENTS[m % GRADIENTS.length];
    }

    function renderSecciones(secciones) {
        if (!secciones) return '';
        if (secciones === 'todas' || (Array.isArray(secciones) && secciones.length === 0)) {
            var t = SECCIONES.todas;
            return '<div class="cal-secs"><img class="cal-sec-all" src="' + escapeHtml(t.imagen) + '"' +
                ' alt="' + escapeHtml(t.nombre) + '" title="' + escapeHtml(t.nombre) + '" loading="lazy"></div>';
        }
        var list = Array.isArray(secciones) ? secciones : [secciones];
        var imgs = list.map(function (s) {
            var img = SECCIONES.imagen(s);
            var nombre = SECCIONES.nombre(s);
            return img ? '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(nombre) + '" title="' + escapeHtml(nombre) + '" loading="lazy">' : '';
        }).join('');
        return imgs ? '<div class="cal-secs">' + imgs + '</div>' : '';
    }

    function renderItem(a, idx, isPast, year, nextTitulo) {
        var rot = ROT[idx % ROT.length];
        if (a.tipo === 'efemeride') {
            var fecha = a.dia ? (a.dia + ' ' + (a.mes ? MESES[a.mes] : '')) : (a.mes ? MESES[a.mes] : '');
            return '<div class="cal-pin-wrap' + (isPast ? ' is-past' : '') + '" style="--rot:' + rot + '" title="' + escapeHtml(a.descripcion) + '">' +
                '<div class="cal-pin"><div class="cal-pin-face">' +
                    '<i class="fa ' + escapeHtml(a.icono) + '" aria-hidden="true"></i>' +
                    '<span class="cal-pin-title">' + escapeHtml(a.titulo) + '</span>' +
                    '<span class="cal-pin-month">' + escapeHtml(fecha) + '</span>' +
                '</div></div></div>';
        }
        var mesAbbr = (a.mes ? MESES[a.mes] : '').slice(0, 3);
        return '<div class="cal-patch' + (isPast ? ' is-past' : '') +
                '" style="--rot:' + rot + ';--grad:' + gradientFor(a, idx) + '">' +
            (a.titulo === nextTitulo ? '<span class="cal-ribbon-tag">Próxima</span>' : '') +
            '<i class="cal-bgicon fa ' + escapeHtml(a.icono) + '" aria-hidden="true"></i>' +
            '<div class="cal-postmark">' + escapeHtml(mesAbbr) + '<br>' + escapeHtml(year) + '</div>' +
            '<h3 class="cal-patch-title">' + escapeHtml(a.titulo) + '</h3>' +
            (a.descripcion ? '<p class="cal-patch-desc">' + escapeHtml(a.descripcion) + '</p>' : '') +
            renderSecciones(a.secciones) +
        '</div>';
    }

    function render(root, cfg) {
        var yearEl = root.querySelector('.cal-cover-year');
        var introEl = root.querySelector('.cal-cover-intro');
        var board = root.querySelector('.cal-board');
        var empty = board.querySelector('.cal-empty');

        var now = new Date();
        var curMonth = now.getMonth() + 1;
        var displayYear = Number(cfg.anio) || now.getFullYear();

        if (yearEl) yearEl.textContent = displayYear;
        if (introEl) introEl.textContent = String(cfg.intro || '');

        var items = normalizeActivities(cfg.actividades)
            .sort(function (x, y) { return (x.mes || 99) - (y.mes || 99); });

        if (!items.length) {
            if (empty) empty.textContent = 'Aún no hay actividades publicadas.';
            return;
        }
        if (empty && empty.parentNode) empty.parentNode.removeChild(empty);

        function esPasada(a) {
            if (displayYear < now.getFullYear()) return true;
            if (displayYear > now.getFullYear()) return false;
            return a.mes && a.mes < curMonth;
        }

        var proximas = items.filter(function (a) { return !esPasada(a); });
        var pasadas = items.filter(esPasada);

        // La primera ACTIVIDAD próxima (no efeméride) lleva el listón "Próxima".
        var nextTitulo = null;
        for (var i = 0; i < proximas.length; i++) {
            if (proximas[i].tipo === 'actividad') { nextTitulo = proximas[i].titulo; break; }
        }

        var out = '';
        proximas.forEach(function (a, idx) {
            out += renderItem(a, idx, false, displayYear, nextTitulo);
        });
        if (proximas.length && pasadas.length) out += '<div class="cal-row-break"></div>';
        pasadas.forEach(function (a, idx) {
            out += renderItem(a, idx, true, displayYear, nextTitulo);
        });
        board.insertAdjacentHTML('beforeend', out);
    }

    function init(root) {
        if (root.__calInitialized) return;
        root.__calInitialized = true;

        loadConfig().then(function (cfg) {
            if (!cfg) {
                var empty = root.querySelector('.cal-empty');
                if (empty) empty.textContent = 'No se pudo cargar el calendario de actividades.';
                return;
            }
            render(root, cfg);
        });
    }

    function watchForRoot() {
        var existing = document.getElementById('calendario');
        if (existing) { init(existing); return; }
        var obs = new MutationObserver(function () {
            var el = document.getElementById('calendario');
            if (el) { obs.disconnect(); init(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState !== 'loading') watchForRoot();
    else document.addEventListener('DOMContentLoaded', watchForRoot);
})();

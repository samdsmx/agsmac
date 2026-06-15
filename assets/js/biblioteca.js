/* biblioteca.js
 * Renderiza la sección Biblioteca (cargada vía includedHtml en detail1.html).
 *
 * Funcionalidad:
 *   - Lee includes/data/biblioteca.json con dos catálogos: 'base' (PDFs
 *     descargables) y 'trabajo' (manuales internos AGSMAC, sin PDF).
 *   - Dos tabs para alternar entre catálogos.
 *   - Filtros pill por sección (Castores, Lobatos, Gacelas, etc.) DERIVADOS
 *     DINÁMICAMENTE de la data, GLOBALES — aplican a ambos tabs.
 *   - Un libro puede pertenecer a varias secciones (campo 'secciones' = array).
 *     Los libros tageados con 'Todas las secciones' aparecen con cualquier
 *     filtro específico (universales).
 *   - Los contadores de cada tab se recalculan según el filtro activo.
 *   - Si una pestaña queda vacía con el filtro elegido, muestra un mensaje
 *     que invita a saltar a la otra pestaña si ahí sí hay resultados.
 *
 * Inicialización: MutationObserver porque el fragmento HTML se inyecta tarde
 * por main.js (igual patrón que cuadro-de-adelanto.js).
 */
(function () {
    'use strict';

    var DATA_URL = 'includes/data/biblioteca.json';
    var FILTER_ALL = '__all__';
    var SECCION_UNIVERSAL = 'Todas las secciones';

    // Orden preferido de los filtros pill (los no listados van al final, alfabético).
    var SECCION_ORDER = [
        'Colonia de Castores',
        'Manada de Lobatos',
        'Manada de Gacelas',
        'Tropa Scout',
        'Tropa de Muchachas Scouts',
        'Clan de Precursoras',
        'Clan de Rovers',
        'Formación de Scouters',
        SECCION_UNIVERSAL
    ];

    // Etiqueta legible del tab.
    var TAB_LABELS = {
        base: 'Bibliografía base',
        trabajo: 'Libros de trabajo'
    };

    // Estado global de la UI.
    var state = {
        data: null,
        activeTab: 'base',
        activeFilter: FILTER_ALL
    };

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function librosSecciones(libro) {
        if (Array.isArray(libro.secciones)) return libro.secciones;
        if (libro.seccion) return [libro.seccion];
        return [];
    }

    // Un libro hace match con el filtro si:
    //   - filter es 'Todas' (FILTER_ALL), o
    //   - alguno de sus tags es el filter elegido, o
    //   - tiene el tag universal 'Todas las secciones'.
    function matchesFilter(libro, filter) {
        if (filter === FILTER_ALL) return true;
        var secs = librosSecciones(libro);
        if (secs.indexOf(filter) !== -1) return true;
        if (secs.indexOf(SECCION_UNIVERSAL) !== -1) return true;
        return false;
    }

    function filtered(libros, filter) {
        return libros.filter(function (l) { return matchesFilter(l, filter); });
    }

    function renderBaseCard(libro) {
        var meta = [escapeHtml(libro.autor)];
        if (libro.anio) meta.push(escapeHtml(libro.anio));
        var metaHtml = meta.filter(Boolean).join(' · ');
        return (
            '<article class="bib-card bib-card-base" title="' + escapeHtml(libro.descripcion || libro.titulo) + '">' +
                '<a class="bib-cover" href="' + escapeHtml(libro.pdf) + '" target="_blank" rel="noopener" aria-label="Abrir PDF de ' + escapeHtml(libro.titulo) + '">' +
                    '<img src="' + escapeHtml(libro.portada) + '" alt="Portada de ' + escapeHtml(libro.titulo) + '" loading="lazy" />' +
                '</a>' +
                '<div class="bib-body">' +
                    '<h4 class="bib-title">' + escapeHtml(libro.titulo) + '</h4>' +
                    '<p class="bib-meta">' + metaHtml + '</p>' +
                    '<div class="bib-actions">' +
                        '<a class="bib-btn bib-btn-primary" href="' + escapeHtml(libro.pdf) + '" target="_blank" rel="noopener" title="Leer en línea">' +
                            '<i class="fa fa-book"></i> Leer' +
                        '</a>' +
                        '<a class="bib-btn" href="' + escapeHtml(libro.pdf) + '" download title="Descargar PDF">' +
                            '<i class="fa fa-download"></i> PDF' +
                        '</a>' +
                    '</div>' +
                '</div>' +
            '</article>'
        );
    }

    function renderTrabajoCard(libro) {
        var badge = libro.audiencia === 'scouters'
            ? '<span class="bib-audience-badge" title="Material para scouters y dirigentes"><i class="fa fa-user-secret"></i> Para Scouters</span>'
            : '';
        var primary = librosSecciones(libro)[0] || '';
        return (
            '<article class="bib-card bib-card-trabajo" title="' + escapeHtml(libro.descripcion || libro.titulo) + '">' +
                '<div class="bib-cover bib-cover-static">' +
                    '<img src="' + escapeHtml(libro.portada) + '" alt="Portada de ' + escapeHtml(libro.titulo) + '" loading="lazy" />' +
                '</div>' +
                '<div class="bib-body">' +
                    '<h4 class="bib-title">' + escapeHtml(libro.titulo) + '</h4>' +
                    (primary ? '<p class="bib-meta"><i class="fa fa-bookmark"></i> ' + escapeHtml(primary) + '</p>' : '') +
                    badge +
                '</div>' +
            '</article>'
        );
    }

    function compareSecciones(a, b) {
        var ai = SECCION_ORDER.indexOf(a);
        var bi = SECCION_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b, 'es');
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    }

    // Lista de secciones únicas (para construir los pills, sin contadores).
    function buildFilterList() {
        var set = {};
        var todos = (state.data.base || []).concat(state.data.trabajo || []);
        todos.forEach(function (l) {
            librosSecciones(l).forEach(function (s) { set[s] = true; });
        });
        return Object.keys(set);
    }

    function renderFilters() {
        var secciones = buildFilterList().sort(compareSecciones);
        var html = '<button type="button" class="bib-filter" data-filter="' + FILTER_ALL + '">Todas</button>';
        secciones.forEach(function (sec) {
            html += '<button type="button" class="bib-filter" data-filter="' + escapeHtml(sec) + '">' +
                        escapeHtml(sec) +
                    '</button>';
        });
        jQuery('#biblioteca-filtros').html(html);
        jQuery('.bib-filter[data-filter="' + state.activeFilter + '"]').addClass('is-active');
    }

    function renderPane(tab) {
        var libros = (state.data[tab] || []);
        var visibles = filtered(libros, state.activeFilter);
        var $grid = jQuery('#biblioteca-' + tab);
        var renderer = tab === 'base' ? renderBaseCard : renderTrabajoCard;

        if (visibles.length === 0) {
            // ¿Hay resultados en la otra pestaña con este mismo filtro?
            var otherTab = tab === 'base' ? 'trabajo' : 'base';
            var otherCount = filtered(state.data[otherTab] || [], state.activeFilter).length;
            var msg;
            if (state.activeFilter === FILTER_ALL) {
                msg = 'Aún no hay libros publicados en esta pestaña.';
            } else if (otherCount > 0) {
                msg = 'Sin resultados en esta pestaña con el filtro <strong>' + escapeHtml(state.activeFilter) + '</strong>. ' +
                      'Hay ' + otherCount + ' libro' + (otherCount === 1 ? '' : 's') +
                      ' en <a href="#" class="bib-jump-tab" data-tab="' + otherTab + '">' +
                      escapeHtml(TAB_LABELS[otherTab]) + '</a>.';
            } else {
                msg = 'Sin resultados con el filtro <strong>' + escapeHtml(state.activeFilter) + '</strong>.';
            }
            $grid.html('<p class="bib-empty">' + msg + '</p>');
        } else {
            $grid.html(visibles.map(renderer).join(''));
        }
    }

    function renderAll() {
        renderPane('base');
        renderPane('trabajo');
    }

    function setActiveTab(tab) {
        state.activeTab = tab;
        jQuery('.bib-tab').removeClass('is-active').attr('aria-selected', 'false');
        jQuery('.bib-tab[data-tab="' + tab + '"]').addClass('is-active').attr('aria-selected', 'true');
        jQuery('.bib-pane').removeClass('is-active');
        jQuery('.bib-pane[data-pane="' + tab + '"]').addClass('is-active');
    }

    function setActiveFilter(filter) {
        state.activeFilter = filter;
        jQuery('.bib-filter').removeClass('is-active');
        jQuery('.bib-filter[data-filter="' + filter + '"]').addClass('is-active');
        renderAll();
    }

    function bindUi() {
        jQuery(document).on('click', '.bib-tab', function () {
            setActiveTab(this.getAttribute('data-tab'));
        });
        jQuery(document).on('click', '.bib-filter', function () {
            setActiveFilter(this.getAttribute('data-filter'));
        });
        // Link "saltar a la otra pestaña" desde el mensaje de pane vacío.
        jQuery(document).on('click', '.bib-jump-tab', function (e) {
            e.preventDefault();
            setActiveTab(this.getAttribute('data-tab'));
        });
    }

    function renderError(msg) {
        jQuery('#biblioteca-base, #biblioteca-trabajo').html(
            '<p class="bib-error">' + escapeHtml(msg) + '</p>'
        );
    }

    function start() {
        bindUi();
        jQuery.getJSON(DATA_URL)
            .done(function (data) {
                state.data = data;
                renderFilters();
                renderAll();
            })
            .fail(function () {
                renderError('No se pudo cargar el catálogo de la biblioteca.');
            });
    }

    function tryStart() {
        if (document.getElementById('biblioteca-base') || document.getElementById('biblioteca-trabajo')) {
            start();
            return true;
        }
        return false;
    }

    jQuery(function () {
        if (tryStart()) return;
        var obs = new MutationObserver(function () {
            if (tryStart()) obs.disconnect();
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { obs.disconnect(); }, 8000);
    });
})();

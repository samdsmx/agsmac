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

    // Etiqueta legible del tab.
    var TAB_LABELS = {
        base: 'Bibliografía base',
        trabajo: 'Libros de trabajo'
    };

    // Catálogo canónico de secciones (assets/js/secciones.js). Resuelve por
    // nombre completo vía alias → nombre canónico + emblema. Fallback defensivo
    // por si el orden de carga cambiara.
    var SECCIONES = window.AGSMAC_SECCIONES || {
        nombre: function (k) { return String(k == null ? '' : k); },
        imagen: function () { return ''; }
    };
    // Nombre a mostrar para una sección (canónico si el catálogo la conoce).
    function secLabel(sec) { return SECCIONES.nombre(sec) || sec; }

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
    //   - filter es "General" (FILTER_ALL, sin filtro), o
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
                    (primary ? '<p class="bib-meta"><i class="fa fa-bookmark"></i> ' + escapeHtml(secLabel(primary)) + '</p>' : '') +
                    badge +
                '</div>' +
            '</article>'
        );
    }

    // Ordena por el orden canónico del catálogo (por edad); desconocidas al
    // final, desempatando alfabéticamente.
    function compareSecciones(a, b) {
        var ai = SECCIONES.orden ? SECCIONES.orden(a) : 0;
        var bi = SECCIONES.orden ? SECCIONES.orden(b) : 0;
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b, 'es');
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

    // Construye un chip de filtro con emblema (imagen) + tooltip con el nombre.
    // Si no hay imagen para la sección, cae a texto para no romper el filtro.
    function filterChip(filter, label, img, extraClass) {
        var cls = 'bib-filter' + (extraClass ? ' ' + extraClass : '');
        return '<button type="button" class="' + cls + '" data-filter="' + escapeHtml(filter) + '"' +
                   ' aria-label="' + escapeHtml(label) + '">' +
                   (img
                       ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy">'
                       : '<span class="bib-filter-label">' + escapeHtml(label) + '</span>') +
                   '<span class="bib-filter-tip">' + escapeHtml(label) + '</span>' +
               '</button>';
    }

    function renderFilters() {
        // El tag universal 'Todas las secciones' NO genera chip propio (sería
        // redundante con "General"); los libros universales siguen apareciendo
        // bajo cualquier sección específica vía matchesFilter().
        var secciones = buildFilterList()
            .filter(function (s) { return s !== SECCION_UNIVERSAL; })
            .sort(compareSecciones);
        // Las secciones primero (orden por edad) y el chip "General" (flor de
        // lis azul) SIEMPRE al final, igual que 'general' en el Álbum Fotográfico.
        var html = '';
        secciones.forEach(function (sec) {
            html += filterChip(sec, secLabel(sec), SECCIONES.imagen(sec));
        });
        html += filterChip(FILTER_ALL, 'General', 'images/fl.png', 'bib-filter-all');
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
                msg = 'Sin resultados en esta pestaña con el filtro <strong>' + escapeHtml(secLabel(state.activeFilter)) + '</strong>. ' +
                      'Hay ' + otherCount + ' libro' + (otherCount === 1 ? '' : 's') +
                      ' en <a href="#" class="bib-jump-tab" data-tab="' + otherTab + '">' +
                      escapeHtml(TAB_LABELS[otherTab]) + '</a>.';
            } else {
                msg = 'Sin resultados con el filtro <strong>' + escapeHtml(secLabel(state.activeFilter)) + '</strong>.';
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

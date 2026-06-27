/* historia-timeline.js
 * Renderiza la línea del tiempo de la Historia de AGSMAC dentro de
 * includes/historia.html (cargada vía includedHtml en detail1.html).
 *
 * Layout master-detail:
 *   - Desktop (>980px): click sobre tarjeta del timeline rellena el panel
 *     derecho (#hist-detail-panel).
 *   - Mobile (<=980px): el panel está oculto y se abre un modal.
 *
 * Cascada de fuentes:
 *   1. Google Apps Script Web App (futuro, si se llena appsScriptUrl).
 *   2. Arreglo 'hitos' inline en includes/data/historia.json.
 *   3. Mensaje de "sin hitos".
 */
(function () {
    'use strict';

    var CONFIG_URL  = 'includes/data/historia.json';
    var CACHE_KEY   = 'agsmac:historia:v9';
    var CACHE_TTL_MS = 10 * 60 * 1000;
    var MOBILE_BREAKPOINT = 980;

    var CATEGORIAS = {
        institucional: { label: 'Hito institucional', icon: 'fa-institution',  color: '#1e7a8c' },
        evento:        { label: 'Evento',             icon: 'fa-flag',         color: '#2f7d32' },
        memorabilia:   { label: 'Memorabilia',  icon: 'fa-bookmark',     color: '#C0A062' },
        publicacion:   { label: 'Publicación',        icon: 'fa-newspaper-o',  color: '#b25e09' },
        memoriam:      { label: 'In Memoriam',        icon: 'fa-heart',        color: '#7d3c98' }
    };

    // Estado del módulo
    var state = {
        hitos: [],        // lista cruda
        order: 'desc',    // 'asc' | 'desc'
        catFilter: 'all'
    };

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function safeUrl(u) {
        var s = String(u || '').trim();
        if (!s) return '';
        if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
        if (/^[a-zA-Z0-9_\-./]+$/.test(s)) return s;
        return '';
    }
    function iconForLink(tipo) {
        switch ((tipo || '').toLowerCase()) {
            case 'pdf':     return 'fa-file-pdf-o';
            case 'externo': return 'fa-external-link';
            case 'video':   return 'fa-play-circle';
            case 'foto':    return 'fa-camera';
            case 'interno': return 'fa-link';
            default:        return 'fa-link';
        }
    }
    function isDesktop() { return window.innerWidth > MOBILE_BREAKPOINT; }

    // === Render del timeline (columna izquierda) =============================

    function sortHitos(arr, order) {
        return arr.slice().sort(function (a, b) {
            var aa = a.anio || 0, bb = b.anio || 0;
            if (aa !== bb) return order === 'desc' ? bb - aa : aa - bb;
            return String(a.fecha || '').localeCompare(String(b.fecha || ''));
        });
    }

    function renderTimeline() {
        var container = document.getElementById('hist-timeline-container');
        if (!container) return;

        if (!state.hitos.length) {
            container.innerHTML = '<p class="hist-empty">Pronto compartiremos los hitos de nuestra historia.</p>';
            renderYearJump([]);
            return;
        }

        var ordenados = sortHitos(state.hitos, state.order);

        // Agrupar por año preservando el orden actual
        var groups = [];
        var byYear = {};
        ordenados.forEach(function (h) {
            var y = h.anio || '—';
            if (!byYear[y]) { byYear[y] = { anio: y, items: [] }; groups.push(byYear[y]); }
            byYear[y].items.push(h);
        });

        var html = '<ol class="hist-timeline">';
        groups.forEach(function (g) {
            html += '<li class="hist-year-group" data-anio="' + escapeHtml(g.anio) + '">';
            html +=   '<div class="hist-year-banner">' + escapeHtml(g.anio) + '</div>';
            html +=   '<ol class="hist-year-cards">';
            g.items.forEach(function (h, idx) {
                var cat = CATEGORIAS[h.categoria] || CATEGORIAS.evento;
                var id = h.id || ('hito-' + g.anio + '-' + idx);
                html += '<li class="hist-item' + (h.destacado ? ' hist-destacado' : '') + '" data-cat="' + escapeHtml(h.categoria || 'evento') + '" data-id="' + escapeHtml(id) + '" data-anio="' + escapeHtml(h.anio || '') + '">';
                
                html +=   '<article class="hist-card" tabindex="0" role="button" aria-label="Ver detalles de ' + escapeHtml(h.titulo || '') + '">';
                html +=     '<h3 class="hist-card-title">' + escapeHtml(h.titulo || '') + '</h3>';
                html +=   '<span class="hist-cat-badge" style="color:' + cat.color + '; border-color:' + cat.color + ';"><i class="fa ' + cat.icon + '"></i> ' + escapeHtml(cat.label) + '</span>';
                html +=   '</article>';
                html += '</li>';
            });
            html +=   '</ol>';
            html += '</li>';
        });
        html += '</ol>';
        container.innerHTML = html;

        applyCatFilter();
        observeReveal(container);
        renderYearJump(ordenados);

        // Selección inicial: primer hito visible
        var firstVisible = $(container).find('.hist-item:not(.is-hidden)').first();
        if (firstVisible.length) {
            selectHito(firstVisible.data('id'), { scroll: false });
        }
    }

    function renderYearJump(ordenados) {
        var sel = document.getElementById('hist-yearjump-select');
        if (!sel) return;
        var seen = {};
        var years = [];
        ordenados.forEach(function (h) {
            var a = h.anio;
            if (a && !seen[a]) { seen[a] = true; years.push(a); }
        });
        var html = '<option value="">Saltar a año…</option>';
        years.forEach(function (a) {
            html += '<option value="' + escapeHtml(a) + '">' + escapeHtml(a) + '</option>';
        });
        sel.innerHTML = html;
    }

    function applyCatFilter() {
        var cat = state.catFilter;
        $('.hist-item').each(function () {
            var match = (cat === 'all') || ($(this).data('cat') === cat);
            $(this).toggleClass('is-hidden', !match);
        });
        // Ocultar grupos de año que ya no tienen ningún hito visible
        $('.hist-year-group').each(function () {
            var anyVisible = $(this).find('.hist-item:not(.is-hidden)').length > 0;
            $(this).toggleClass('is-hidden', !anyVisible);
        });
    }

    function observeReveal(container) {
        if (!('IntersectionObserver' in window)) {
            $(container).find('.hist-item').addClass('is-visible');
            return;
        }
        var root = container.closest('.hist-timeline-wrap') || null;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add('is-visible');
                    io.unobserve(en.target);
                }
            });
        }, { root: root, threshold: 0.1 });
        $(container).find('.hist-item').each(function () { io.observe(this); });
    }

    // === Selección y panel de detalle ========================================

    function findHito(id) {
        for (var i = 0; i < state.hitos.length; i++) {
            if ((state.hitos[i].id || ('hito-' + i)) === id) return state.hitos[i];
        }
        return null;
    }

    function selectHito(id, opts) {
        opts = opts || {};
        var hito = findHito(id);
        if (!hito) return;

        // Marcar selección visual
        $('.hist-item').removeClass('is-selected');
        var $item = $('.hist-item[data-id="' + id + '"]').addClass('is-selected');

        // Sincronizar yearjump
        var sel = document.getElementById('hist-yearjump-select');
        if (sel && String(sel.value) !== String(hito.anio)) sel.value = String(hito.anio);

        // En desktop: rellenar panel derecho. En móvil: abrir modal.
        if (isDesktop()) {
            renderDetail(hito, document.getElementById('hist-detail-panel'));
            if (opts.scroll && $item.length) {
                // Scroll SOLO dentro del wrapper del timeline (sin mover la página).
                // Calculamos delta con getBoundingClientRect, robusto frente a
                // ancestros posicionados (.hist-year-group es position:relative).
                var $wrap = $item.closest('.hist-timeline-wrap');
                var $group = $item.closest('.hist-year-group');
                var target = ($group.length ? $group[0] : $item[0]);
                if ($wrap.length && target) {
                    var wrapEl = $wrap[0];
                    var wrapTop = wrapEl.getBoundingClientRect().top;
                    var targetTop = target.getBoundingClientRect().top;
                    var delta = targetTop - wrapTop - 8;
                    wrapEl.scrollBy({ top: delta, behavior: 'smooth' });
                }
            }
        } else {
            openModal(hito);
        }
    }

    function renderDetail(hito, target) {
        if (!target) return;
        var cat = CATEGORIAS[hito.categoria] || CATEGORIAS.evento;
        var html = '';
        html += '<header class="hist-detail-header" style="border-top-color:' + cat.color + ';">';
        html +=   '<div class="hist-detail-year">' + escapeHtml(hito.anio || '') + '</div>';
        html +=   '<h2>' + escapeHtml(hito.titulo || '') + '</h2>';
        if (hito.fecha && hito.fecha !== String(hito.anio)) {
            html += '<div class="hist-detail-date">' + escapeHtml(hito.fecha) + '</div>';
        }
        html += '</header>';
        html += '<div class="hist-detail-body">';

        if (hito.imagenes && hito.imagenes.length) {
            var imgs = hito.imagenes.filter(function (im) { return safeUrl(im.src); });
            if (imgs.length) {
                html += '<div class="hist-gallery">';
                imgs.forEach(function (img) {
                    var src = safeUrl(img.src);
                    html += '<figure class="hist-photo">';
                    html +=   '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(img.alt || '') + '" loading="lazy" /></a>';
                    if (img.alt) html += '<figcaption>' + escapeHtml(img.alt) + '</figcaption>';
                    html += '</figure>';
                });
                html += '</div>';
            }
        }

        if (hito.persona) {
            var p = hito.persona;
            html += '<div class="hist-persona">';
            if (safeUrl(p.foto)) {
                html += '<div class="hist-persona-foto" style="background-image:url(\'' + escapeHtml(safeUrl(p.foto)) + '\');" role="img" aria-label="' + escapeHtml(p.nombre || '') + '"></div>';
            } else {
                html += '<div class="hist-persona-foto"><i class="fa fa-user"></i></div>';
            }
            html += '<div class="hist-persona-info">';
            if (p.nombre) html += '<h3>' + escapeHtml(p.nombre) + '</h3>';
            if (p.anios)  html += '<p class="hist-persona-anios">' + escapeHtml(p.anios) + '</p>';
            if (p.rol)    html += '<p class="hist-persona-rol">' + escapeHtml(p.rol) + '</p>';
            if (safeUrl(p.bioUrl)) {
                html += '<a class="button hist-btn" href="' + escapeHtml(safeUrl(p.bioUrl)) + '" target="_blank" rel="noopener">Biografía completa <i class="fa fa-external-link"></i></a>';
            }
            html += '</div></div>';
        }

        if (hito.descripcion) {
            // descripción viene del JSON controlado por el mantenedor — HTML permitido
            html += '<div class="hist-desc">' + hito.descripcion + '</div>';
        }

        var enlacesValidos = (hito.enlaces || []).filter(function (l) { return safeUrl(l.url); });
        if (enlacesValidos.length) {
            html += '<div class="hist-links">';
            html +=   '<h4>Enlaces y documentos</h4>';
            html +=   '<ul>';
            enlacesValidos.forEach(function (l) {
                html += '<li><a href="' + escapeHtml(safeUrl(l.url)) + '" target="_blank" rel="noopener">';
                html +=   '<i class="fa ' + iconForLink(l.tipo) + '"></i> ' + escapeHtml(l.label || l.url);
                html += '</a></li>';
            });
            html += '</ul></div>';
        }

        html += '</div>';
        target.innerHTML = html;
        target.scrollTop = 0;
    }

    // === Modal (sólo móvil) ==================================================

    function openModal(hito) {
        $('.hist-modal-backdrop').remove();
        var $backdrop = $('<div class="hist-modal-backdrop" role="dialog" aria-modal="true"></div>');
        var $modal = $('<div class="hist-modal"></div>').appendTo($backdrop);
        $('<button class="hist-modal-close" aria-label="Cerrar"><i class="fa fa-times"></i></button>').appendTo($modal);
        renderDetail(hito, $modal[0]);
        $backdrop.appendTo('body');
        $('body').addClass('hist-modal-open');

        function close() {
            $backdrop.remove();
            $('body').removeClass('hist-modal-open');
            $(document).off('keydown.histModal');
        }
        $backdrop.on('click', function (e) {
            if ($(e.target).hasClass('hist-modal-backdrop') || $(e.target).closest('.hist-modal-close').length) close();
        });
        $(document).on('keydown.histModal', function (e) { if (e.key === 'Escape') close(); });
        setTimeout(function () { $modal.find('.hist-modal-close').focus(); }, 50);
    }

    // === Eventos globales ====================================================

    function wireGlobalEvents() {
        // Click / Enter sobre tarjeta
        $(document).on('click keydown', '.hist-card', function (e) {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            var id = $(this).closest('.hist-item').data('id');
            if (id) selectHito(String(id), { scroll: false });
        });

        // Filtros por categoría
        $(document).on('click', '.hist-filter', function () {
            state.catFilter = $(this).data('cat');
            $('.hist-filter').removeClass('is-active');
            $(this).addClass('is-active');
            applyCatFilter();
            var $first = $('.hist-item:not(.is-hidden)').first();
            if ($first.length) selectHito($first.data('id'), { scroll: true });
        });

        // Sort toggle
        $(document).on('click', '.hist-sort', function () {
            state.order = (state.order === 'desc') ? 'asc' : 'desc';
            var $b = $(this).attr('data-order', state.order);
            $b.find('.fa').attr('class', state.order === 'desc' ? 'fa fa-sort-amount-desc' : 'fa fa-sort-amount-asc');
            $b.find('.hist-sort-label').text(state.order === 'desc' ? 'Reciente → Antiguo' : 'Antiguo → Reciente');
            renderTimeline();
        });

        // Year jump (select)
        $(document).on('change', '#hist-yearjump-select', function () {
            var anio = String($(this).val() || '');
            if (!anio) return;
            var $item = $('.hist-item[data-anio="' + anio + '"]').not('.is-hidden').first();
            if ($item.length) selectHito($item.data('id'), { scroll: true });
        });

        // Re-render en cambio de breakpoint (cierra/abre modal según corresponda)
        var lastDesktop = isDesktop();
        $(window).on('resize.hist', function () {
            var now = isDesktop();
            if (now !== lastDesktop) {
                lastDesktop = now;
                $('.hist-modal-backdrop').remove();
                $('body').removeClass('hist-modal-open');
                var $sel = $('.hist-item.is-selected').first();
                if (now && $sel.length) {
                    var hito = findHito(String($sel.data('id')));
                    if (hito) renderDetail(hito, document.getElementById('hist-detail-panel'));
                }
            }
        });
    }

    // === Datos (cascada Apps Script → JSON → vacío) ==========================

    function loadFromCache() {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || (Date.now() - obj.t) > CACHE_TTL_MS) return null;
            return obj.hitos;
        } catch (e) { return null; }
    }
    function saveToCache(hitos) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), hitos: hitos })); } catch (e) {}
    }

    function loadHitos(cb) {
        var cached = loadFromCache();
        if (cached) { cb(cached); return; }

        $.getJSON(CONFIG_URL).done(function (cfg) {
            var fallback = (cfg && cfg.hitos) ? cfg.hitos : [];
            var url = cfg && cfg.appsScriptUrl;
            if (!url) { saveToCache(fallback); cb(fallback); return; }
            $.ajax({ url: url, dataType: 'json', timeout: 8000 })
                .done(function (data) {
                    var hitos = (data && data.hitos) ? data.hitos : fallback;
                    saveToCache(hitos);
                    cb(hitos);
                })
                .fail(function () { saveToCache(fallback); cb(fallback); });
        }).fail(function () { cb([]); });
    }

    // === Bootstrap ===========================================================

    function init() {
        if (!document.getElementById('hist-timeline-container')) return;
        wireGlobalEvents();
        loadHitos(function (hitos) {
            state.hitos = hitos || [];
            renderTimeline();
        });
    }

    function waitFor(id, cb) {
        if (document.getElementById(id)) { cb(); return; }
        var mo = new MutationObserver(function () {
            if (document.getElementById(id)) { mo.disconnect(); cb(); }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { waitFor('hist-timeline-container', init); });
    } else {
        waitFor('hist-timeline-container', init);
    }
})();

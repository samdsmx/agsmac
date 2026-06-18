/* libro-de-oro.js
 * Renderiza la galería del Libro de Oro a partir de
 * includes/data/libro-de-oro.json (generado por el proyecto galeriaPublica).
 *
 * - Filtro de año (<select>, "Todos los años" como opción especial).
 * - Filtro de sección por chips (selección única, toggleable).
 * - Cada álbum abre el enlace de Google Photos en una pestaña nueva.
 *
 * El fragmento HTML se inyecta tarde (vía includedHtml) en detail1.html,
 * por eso usamos un MutationObserver que espera al contenedor #libro-de-oro.
 */
(function () {
    'use strict';

    var CONFIG_URL = 'includes/data/libro-de-oro.json';

    // Catálogo fijo de secciones (ID -> label visible).
    // Debe estar en sync con scripts/parseTitle.js de galeriaPublica.
    var SECTION_LABELS = {
        'castores':         'Colonia de Castores',
        'manada-gacelas':   'Manada de Gacelas',
        'manada-lobatos':   'Manada de Lobatos',
        'tropa-muchachas':  'Tropa de Muchachas',
        'tropa-scout':      'Tropa Scout',
        'clan-precursoras': 'Clan de Precursoras',
        'clan-rovers':      'Clan de Rovers',
        'scouters':         'Scouters y Dirigentes',
        'general':          'General'
    };
    // Orden en que se muestran los chips.
    var SECTION_ORDER = ['castores', 'manada-gacelas', 'manada-lobatos', 'tropa-muchachas', 'tropa-scout', 'clan-precursoras', 'clan-rovers', 'scouters',  'general'];

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

    function normalizeAlbums(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.map(function (a) {
            return {
                title: String(a.title || '').trim(),
                displayTitle: String(a.displayTitle || a.title || '').trim(),
                url: String(a.url || ''),
                thumbnail: String(a.thumbnail || ''),
                year: a.year ? Number(a.year) : null,
                month: a.month ? Number(a.month) : null,
                sections: Array.isArray(a.sections) && a.sections.length ? a.sections : ['general']
            };
        }).filter(function (a) { return a.title && a.url; });
    }

    function renderFilters(root, albums) {
        // Años presentes (desc). null va al final como "Sin año".
        var yearsMap = {};
        var hasNull = false;
        albums.forEach(function (a) {
            if (a.year) yearsMap[a.year] = (yearsMap[a.year] || 0) + 1;
            else hasNull = true;
        });
        var yearList = Object.keys(yearsMap).map(Number).sort(function (a, b) { return b - a; });
        var yearOptions = '<option value="all">Todos los años</option>' +
            yearList.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') +
            (hasNull ? '<option value="null">Sin año</option>' : '');

        // Chips de sección: solo las que tengan álbumes.
        var sectionCounts = {};
        albums.forEach(function (a) {
            a.sections.forEach(function (s) { sectionCounts[s] = (sectionCounts[s] || 0) + 1; });
        });
        var sectionChips = SECTION_ORDER.filter(function (id) { return sectionCounts[id]; }).map(function (id) {
            return '<button type="button" class="lo-chip" data-section="' + escapeHtml(id) + '">' +
                '<span class="lo-chip-label">' + escapeHtml(SECTION_LABELS[id] || id) + '</span>' +
                '<span class="lo-chip-count">' + sectionCounts[id] + '</span>' +
            '</button>';
        }).join('');

        root.querySelector('.lo-year-select').innerHTML = yearOptions;
        root.querySelector('.lo-filter-sections').innerHTML = sectionChips;

        return yearList;
    }

    function monthLabel(m) {
        var meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return meses[m] || '';
    }

    function renderGrid(root, albums, state) {
        var container = root.querySelector('.lo-grid');
        var filtered = albums.filter(function (a) {
            if (state.year === 'all') { /* sin filtro de año */ }
            else if (state.year === 'null') { if (a.year) return false; }
            else if (a.year !== state.year) return false;
            if (state.section && a.sections.indexOf(state.section) === -1) return false;
            return true;
        });

        // Orden: año desc, mes desc, título asc.
        filtered.sort(function (a, b) {
            var ay = a.year || 0, by = b.year || 0;
            if (ay !== by) return by - ay;
            var am = a.month || 0, bm = b.month || 0;
            if (am !== bm) return bm - am;
            return a.displayTitle.localeCompare(b.displayTitle, 'es');
        });

        if (!filtered.length) {
            container.innerHTML = '<div class="lo-empty">Sin álbumes con los filtros actuales.</div>';
            return;
        }

        container.innerHTML = filtered.map(function (a) {
            var dateLabel = '';
            if (a.year && a.month) dateLabel = monthLabel(a.month) + ' ' + a.year;
            else if (a.year) dateLabel = String(a.year);
            var img = a.thumbnail
                ? '<img class="lo-card-img" src="' + escapeHtml(a.thumbnail) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
                : '<div class="lo-card-img lo-card-img-empty" aria-hidden="true"><i class="fa fa-camera"></i></div>';
            var tags = a.sections.map(function (s) {
                return '<span class="lo-card-tag">' + escapeHtml(SECTION_LABELS[s] || s) + '</span>';
            }).join('');
            return '<a class="lo-card" href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener" title="' + escapeHtml(a.title) + '">' +
                img +
                '<div class="lo-card-body">' +
                    (dateLabel ? '<div class="lo-card-date">' + escapeHtml(dateLabel) + '</div>' : '') +
                    '<div class="lo-card-title">' + escapeHtml(a.displayTitle) + '</div>' +
                    (tags ? '<div class="lo-card-tags">' + tags + '</div>' : '') +
                '</div>' +
            '</a>';
        }).join('');
    }

    function attachFilterEvents(root, albums, state, defaultYear) {
        function rerender() { renderGrid(root, albums, state); }

        var yearSelect = root.querySelector('.lo-year-select');
        yearSelect.addEventListener('change', function () {
            var v = yearSelect.value;
            state.year = (v === 'all' || v === 'null') ? v : Number(v);
            rerender();
        });

        root.querySelector('.lo-filter-sections').addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.lo-chip');
            if (!btn) return;
            var id = btn.getAttribute('data-section');
            state.section = (state.section === id) ? null : id;
            root.querySelectorAll('.lo-chip').forEach(function (b) {
                b.classList.toggle('is-active', b.getAttribute('data-section') === state.section);
            });
            rerender();
        });

        root.querySelector('.lo-clear').addEventListener('click', function () {
            state.section = null;
            state.year = defaultYear;
            yearSelect.value = String(defaultYear);
            root.querySelectorAll('.lo-chip').forEach(function (b) { b.classList.remove('is-active'); });
            rerender();
        });
    }

    function init(root) {
        if (root.__loInitialized) return;
        root.__loInitialized = true;

        loadConfig().then(function (cfg) {
            cfg = cfg || {};
            var albums = normalizeAlbums(cfg.albums || cfg);
            var grid = root.querySelector('.lo-grid');
            if (!albums.length) {
                grid.innerHTML = '<div class="lo-empty">Aún no hay álbumes publicados.</div>';
                return;
            }
            var years = renderFilters(root, albums);
            // Año por defecto: el más reciente con álbumes; si no hay años, "all".
            var defaultYear = years.length ? years[0] : 'all';
            var state = { year: defaultYear, section: null };
            root.querySelector('.lo-year-select').value = String(defaultYear);
            renderGrid(root, albums, state);
            attachFilterEvents(root, albums, state, defaultYear);
        });
    }

    function watchForRoot() {
        var existing = document.getElementById('libro-de-oro');
        if (existing) { init(existing); return; }
        var obs = new MutationObserver(function () {
            var el = document.getElementById('libro-de-oro');
            if (el) { obs.disconnect(); init(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState !== 'loading') watchForRoot();
    else document.addEventListener('DOMContentLoaded', watchForRoot);
})();

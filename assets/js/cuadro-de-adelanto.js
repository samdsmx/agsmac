/* cuadro-de-adelanto.js
 * Renderiza el Cuadro de Honor de Insignias Máximas
 * cuadro-de-adelanto (cargada vía includedHtml en detail1.html).
 *
 * Cascada de fuentes (igual que el tile de cumpleaños):
 *   1. Google Apps Script Web App (fuente principal, Sheet privada).
 *      Ver docs/apps-script-cuadro-de-adelanto.gs.
 *   2. Arreglo 'awards' inline en includes/data/cuadro-de-adelanto.json
 *      (fallback editable manualmente).
 *   3. Mensaje de "sin datos" — el contenedor nunca queda roto.
 *
 * Inicialización: como el fragmento HTML se inyecta tarde (después del
 * DOMContentLoaded), usamos un MutationObserver que espera a que aparezca
 * el contenedor #cuadro-honor en el DOM.
 */
(function () {
    'use strict';

    var CONFIG_URL = 'includes/data/cuadro-de-adelanto.json';

    // === Utilidades ============================================================

    // Clave canónica: mayúsculas, sin acentos, espacios colapsados.
    function normInsignia(s) {
        return String(s || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/\s+/g, ' ').trim();
    }

    // Quita acentos y baja a minúsculas. Para comparaciones laxas.
    function normText(s) {
        return String(s || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function shortenName(full) {
        var s = String(full || '').trim().replace(/\s+/g, ' ');
        if (!s) return '';
        // Si ya viene recortado desde el Apps Script ("Andrea A. Hernandez R."),
        // no lo volvemos a procesar — esos contienen iniciales con punto.
        if (/\.\s|\.$/.test(s)) return s;
        var parts = s.split(' ');
        if (parts.length < 3) return s;
        var paterno = parts[0];
        var materno = parts[1];
        var primero = parts[2];
        var segundoInicial = parts[3] ? ' ' + parts[3].charAt(0).toUpperCase() + '.' : '';
        var maternoInicial = materno ? ' ' + materno.charAt(0).toUpperCase() + '.' : '';
        return (primero + segundoInicial + ' ' + paterno + maternoInicial).trim();
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function prefixGrupo(g) {
        var raw = (g === 0 || g) ? String(g).trim() : '';
        if (!raw) return '';
        return /^(gpo\.?|grupo)\s/i.test(raw) ? raw : 'Gpo. ' + raw;
    }

    // Resuelve la metadata visual de la celda (label, image, titleImage).
    function resolveInsigniaMeta(insigniaMap, key) {
        var meta = insigniaMap[key];
        if (!meta) return { label: key, image: '', titleImage: '' };
        var out = {
            label: meta.label || key,
            image: meta.image || '',
            titleImage: meta.titleImage || ''
        };
        return out;
    }

    // Lista ordenada de "chips" derivada del mapa de insignias del JSON.
    // Cada chip representa una insignia. Las insignias marcadas con
    // `sinFiltro: true` (p. ej. históricas, ya en desuso) no generan chip:
    // siguen apareciendo en el timeline cuando hay certificados, pero no
    // son seleccionables como filtro.
    function buildChipList(insigniaMap) {
        var chips = [];
        Object.keys(insigniaMap).forEach(function (key) {
            var meta = insigniaMap[key];
            if (meta && meta.sinFiltro) return;
            chips.push({ id: key, insignia: key });
        });
        return chips;
    }

    // ID compuesto de un galardón para agrupar/filtrar.
    function chipIdOf(award, insigniaMap) {
        var meta = insigniaMap[award.insignia];
        return award.insignia;
    }

    // === Carga =================================================================

    function loadConfig() {
        return fetch(CONFIG_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
    }

    function loadFromAppsScript(url) {
        var cached = readCache(url);
        if (cached) return Promise.resolve(cached);
        return fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'follow' })
            .then(function (r) {
                if (!r.ok) throw new Error('Apps Script fetch failed: ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var arr = Array.isArray(data) ? data : (data && data.awards) || [];
                writeCache(url, arr);
                return arr;
            });
    }

    // === Caché (sessionStorage, TTL 10 min) ===================================
    var CACHE_KEY = 'agsmac:cuadro-honor:v1';
    var CACHE_TTL_MS = 10 * 60 * 1000;

    function readCache(url) {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || obj.url !== url) return null;
            if ((Date.now() - obj.savedAt) > CACHE_TTL_MS) return null;
            return obj.awards;
        } catch (_) { return null; }
    }

    function writeCache(url, awards) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                url: url, savedAt: Date.now(), awards: awards
            }));
        } catch (_) { /* quota o modo privado: ignorar */ }
    }

    function normalizeAwards(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.map(function (a) {
            var year = Number(a.year);
            if (!year && a.date) {
                var m = String(a.date).match(/^(\d{4})/);
                if (m) year = Number(m[1]);
            }
            return {
                name: String(a.name || '').trim(),
                group: String(a.group == null ? '' : a.group).trim(),
                insignia: normInsignia(a.insignia),
                year: year || null,
                clave: String(a.clave || '').trim()
            };
        }).filter(function (a) { return a.name && a.insignia && a.year; });
    }

    // === Render ================================================================

    function renderFilters(root, insigniaMap, awards, chips) {
        // Chips de insignia: orden definido por el mapa.
        var insigniaChips = chips.map(function (c) {
            var meta = resolveInsigniaMeta(insigniaMap, c.insignia);
            return '<button type="button" class="ca-chip ca-chip-insignia"' +
                ' data-chip-id="' + escapeHtml(c.id) + '"' +
                ' aria-label="' + escapeHtml(meta.label) + '">' +
                (meta.image ? '<img src="' + escapeHtml(meta.image) + '" alt="" loading="lazy">' : '') +
                '<span class="ca-chip-tooltip">' + escapeHtml(meta.label) + '</span>' +
            '</button>';
        }).join('');

        var years = {};
        awards.forEach(function (a) { years[a.year] = (years[a.year] || 0) + 1; });
        var yearList = Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
        var yearOptions = '<option value="all">Todos los años</option>' +
            yearList.map(function (y) {
                return '<option value="' + y + '">' + y + '</option>';
            }).join('');

        root.querySelector('.ca-filter-insignias').innerHTML = insigniaChips;
        root.querySelector('.ca-year-select').innerHTML = yearOptions;

        return yearList;
    }

    function renderTimeline(root, insigniaMap, awards, chips, filters) {
        var chipId = filters.chip;     // null = sin seleccionar
        var year = filters.year;       // número o 'all'
        var container = root.querySelector('.ca-timeline');

        // "Todos los años" requiere una insignia seleccionada.
        if (year === 'all' && !chipId) {
            container.innerHTML = '<div class="ca-empty">Selecciona una insignia para ver todos los años.</div>';
            return;
        }

        var filtered = awards.filter(function (a) {
            if (year !== 'all' && a.year !== year) return false;
            if (chipId && chipIdOf(a, insigniaMap) !== chipId) return false;
            return true;
        });

        if (!filtered.length) {
            container.innerHTML = '<div class="ca-empty">Sin certificados con los filtros actuales.</div>';
            return;
        }

        // Agrupar primero por año (desc), después por insignia (orden de `chips`).
        var byYear = {};
        filtered.forEach(function (a) {
            (byYear[a.year] = byYear[a.year] || []).push(a);
        });
        var yearKeys = Object.keys(byYear).map(Number).sort(function (a, b) { return b - a; });

        var html = yearKeys.map(function (yr) {
            var yearAwards = byYear[yr];
            var byChip = {};
            yearAwards.forEach(function (a) {
                var id = chipIdOf(a, insigniaMap);
                (byChip[id] = byChip[id] || []).push(a);
            });
            var orderedIds = Object.keys(insigniaMap)
                .filter(function (id) { return byChip[id]; });
            Object.keys(byChip).forEach(function (id) {
                if (orderedIds.indexOf(id) === -1) orderedIds.push(id);
            });

            return '<section class="ca-year-block">' +
                '<header class="ca-year-header"><h3>' + yr + '</h3><span class="ca-year-count">' +
                    yearAwards.length + (yearAwards.length === 1 ? ' certificado' : ' certificados') +
                '</span></header>' +
                orderedIds.map(function (id) {
                    var items = byChip[id];
                    var chip = chips.filter(function (c) { return c.id === id; })[0]
                        || { insignia: items[0].insignia };
                    var meta = resolveInsigniaMeta(insigniaMap, chip.insignia);
                    var cards = items.map(function (a) {
                        var grp = prefixGrupo(a.group);
                        var meta2 = [grp].filter(Boolean).join(' · ');
                        var img = meta.image
                            ? '<img class="ca-card-img" src="' + escapeHtml(meta.image) + '" alt="' + escapeHtml(meta.label) + '" loading="lazy">'
                            : '<div class="ca-card-img ca-card-img-empty" aria-hidden="true"></div>';
                        return '<article class="ca-card" title="Certificado #' + escapeHtml(a.clave) + '">' +
                            img +
                            '<div class="ca-card-body">' +
                                '<div class="ca-card-name">' + escapeHtml(shortenName(a.name)) + '</div>' +
                                (meta2 ? '<div class="ca-card-meta">' + escapeHtml(meta2) + '</div>' : '') +
                            '</div>' +
                        '</article>';
                    }).join('');
                    return '<section class="ca-insignia-group">' +
                        '<h4 class="ca-insignia-title">' +
                            (meta.titleImage ? '<img src="' + escapeHtml(meta.titleImage) + '" alt="" loading="lazy">' : '') +
                            '<span>' + escapeHtml(meta.label) + '</span>' +
                            '<span class="ca-insignia-count">' + items.length + '</span>' +
                        '</h4>' +
                        '<div class="ca-cards">' + cards + '</div>' +
                    '</section>';
                }).join('') +
            '</section>';
        }).join('');

        container.innerHTML = html;
    }

    function attachFilterEvents(root, insigniaMap, awards, chips, state, defaultYear) {
        function rerender() { renderTimeline(root, insigniaMap, awards, chips, state); }

        function setChip(id) {
            state.chip = id || null;
            root.querySelectorAll('.ca-chip-insignia').forEach(function (b) {
                b.classList.toggle('is-active', b.getAttribute('data-chip-id') === state.chip);
            });
        }

        root.querySelector('.ca-filter-insignias').addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.ca-chip-insignia');
            if (!btn) return;
            var id = btn.getAttribute('data-chip-id');
            if (state.chip === id) {
                // Toggle off — pero si estamos en "todos los años" no se permite deseleccionar.
                if (state.year === 'all') return;
                setChip(null);
            } else {
                setChip(id);
            }
            rerender();
        });

        var yearSelect = root.querySelector('.ca-year-select');
        yearSelect.addEventListener('change', function () {
            var v = yearSelect.value;
            state.year = (v === 'all') ? 'all' : Number(v);
            if (state.year === 'all' && !state.chip && chips.length) {
                setChip(chips[0].id);
            }
            rerender();
        });

        root.querySelector('.ca-clear').addEventListener('click', function () {
            setChip(null);
            state.year = defaultYear;
            yearSelect.value = String(defaultYear);
            rerender();
        });
    }

    // === Bootstrap =============================================================

    function init(root) {
        if (root.__caInitialized) return;
        root.__caInitialized = true;

        loadConfig().then(function (cfg) {
            cfg = cfg || {};
            var insigniaMap = cfg.insignias || {};
            var chips = buildChipList(insigniaMap);
            var inline = normalizeAwards(cfg.awards);

            function startWith(awards) {
                if (!awards.length) {
                    root.querySelector('.ca-timeline').innerHTML =
                        '<div class="ca-empty">Aún no hay certificados registrados.</div>';
                    return;
                }
                var years = renderFilters(root, insigniaMap, awards, chips);
                var defaultYear = years[0]; // años en orden desc → el primero es el más reciente
                var state = { chip: null, year: defaultYear };
                root.querySelector('.ca-year-select').value = String(defaultYear);
                renderTimeline(root, insigniaMap, awards, chips, state);
                attachFilterEvents(root, insigniaMap, awards, chips, state, defaultYear);
            }

            if (cfg.appsScriptUrl) {
                loadFromAppsScript(cfg.appsScriptUrl)
                    .then(function (raw) {
                        var awards = normalizeAwards(raw);
                        startWith(awards.length ? awards : inline);
                    })
                    .catch(function (err) {
                        if (window.console) console.warn('[cuadro-de-adelanto] Apps Script falló, usando fallback local:', err);
                        startWith(inline);
                    });
            } else {
                startWith(inline);
            }
        });
    }

    function watchForRoot() {
        var existing = document.getElementById('cuadro-honor');
        if (existing) { init(existing); return; }
        var obs = new MutationObserver(function () {
            var el = document.getElementById('cuadro-honor');
            if (el) { obs.disconnect(); init(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState !== 'loading') watchForRoot();
    else document.addEventListener('DOMContentLoaded', watchForRoot);
})();

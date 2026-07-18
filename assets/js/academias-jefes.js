/* ConCuScout 2026 — Panel de Jefes de Grupo
   ------------------------------------------------------------------
   - Carga las academias desde includes/data/academias.json
   - Lee el token secreto del enlace (academias-jefes.html?g=<token>), lo envía
     al Apps Script (POST {action:'list', token}) y este devuelve SOLO los
     registros del grupo dueño de ese token. No hay selector de grupo ni clave:
     el enlace único por grupo es el control de acceso. Ver
     docs/apps-script-academias.gs → handleList / CONFIG.GROUP_TOKENS.
   - Muestra los registrados por sección y, en "Recordatorios de material", la
     lista COMPLETA de material de cada academia que lo pide (hoy Escultura y
     Gastronomía) junto con los inscritos del grupo agrupados por sección. El
     jefe le dice a cada muchacho lo que le toca según su sección. */
(function () {
	'use strict';

	var CONFIG = null;      // contenido de academias.json
	var ACADEMIES = [];     // arreglo de academias (normalizado)
	var SECCIONES = [];      // orden de secciones
	var SECCION_RAMA = {};   // seccion -> rama (etiqueta usada en material.porSeccion)
	var SECTION_ALIASES = {}; // seccion -> [stems] (nombre + rama, sing/plural)
	var GLOBAL_VOCAB = {};   // stem -> true (vocabulario de secciones/ramas)
	var PEOPLE_MAT = {};     // id -> { nombre, section, academias:[{nombre,icono,lines}] }
	var BACKEND_OK = false;
	var ROWS = [];          // registros del grupo consultado
	var CURRENT_GROUP = '';
	var CURRENT_TOKEN = '';

	function $(sel, ctx) { return (ctx || document).querySelector(sel); }
	function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}
	function normalize(s) {
		return String(s || '')
			.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
			.toLowerCase().replace(/\s+/g, ' ').trim();
	}

	// ── Normalización de material (igual criterio que concuscout.js) ──
	function normalizeMaterial(m) {
		if (m && typeof m === 'object') {
			var porSeccion = [];
			if (m.porSeccion && typeof m.porSeccion === 'object') {
				for (var s in m.porSeccion) {
					if (m.porSeccion.hasOwnProperty(s)) {
						var txt = String(m.porSeccion[s] || '').trim();
						if (txt) porSeccion.push({ label: s, text: txt });
					}
				}
			}
			return { general: String(m.general || '').trim(), porSeccion: porSeccion };
		}
		return { general: String(m || '').trim(), porSeccion: [] };
	}
	function normalizeAcademy(a) {
		var copy = {};
		for (var k in a) { if (a.hasOwnProperty(k)) copy[k] = a[k]; }
		copy.material = normalizeMaterial(a.material);
		copy.fichaPdf = String(a.fichaPdf || '').trim();
		return copy;
	}
	function materialHasContent(mat) {
		return !!(mat && (mat.general || (mat.porSeccion && mat.porSeccion.length)));
	}
	function academyById(id) {
		for (var i = 0; i < ACADEMIES.length; i++) { if (ACADEMIES[i].id === id) return ACADEMIES[i]; }
		return null;
	}

	// ── Resolución de material por sección (para el popup por muchacho) ──
	// Las etiquetas de material.porSeccion son texto libre: pueden nombrar una
	// sección ("Castores"), una rama ("Manadas", "Tropas y Clanes") o varias a la
	// vez ("Castores, Gacelas y Lobatos"). Se parte la etiqueta en tokens y se
	// compara por raíz (singular/plural) contra los alias de la sección (su nombre
	// y su rama). Si la etiqueta no menciona ninguna sección/rama conocida
	// (p. ej. "TODOS"), es universal. El texto "general" siempre aplica.
	function stem(t) {
		t = String(t || '');
		if (t.length > 4 && /es$/.test(t)) return t.slice(0, -2); // castores→castor, clanes→clan
		if (t.length > 3 && /s$/.test(t)) return t.slice(0, -1);  // manadas→manada, gacelas→gacela
		return t;
	}
	function splitTokens(s) {
		return normalize(s).split(/,| y | e |\/|&|\+/).map(function (x) { return x.trim(); }).filter(Boolean);
	}
	function buildVocab() {
		SECTION_ALIASES = {};
		GLOBAL_VOCAB = {};
		(SECCIONES || []).forEach(function (sec) {
			var stems = {};
			function add(x) {
				splitTokens(x).forEach(function (tok) {
					var s = stem(tok);
					if (s) { stems[s] = 1; GLOBAL_VOCAB[s] = 1; }
				});
			}
			add(sec);
			var rama = SECCION_RAMA[sec] || '';
			if (rama) add(rama);
			SECTION_ALIASES[sec] = Object.keys(stems);
		});
	}
	function canonicalSection(section) {
		for (var i = 0; i < SECCIONES.length; i++) {
			if (normalize(SECCIONES[i]) === normalize(section)) return SECCIONES[i];
		}
		return section;
	}
	function materialForSection(mat, section) {
		var out = [];
		if (!mat) return out;
		var aliases = SECTION_ALIASES[canonicalSection(section)] || [];
		(mat.porSeccion || []).forEach(function (blk) {
			var stems = splitTokens(blk.label).map(stem).filter(Boolean);
			var sectionSpecific = stems.some(function (s) { return GLOBAL_VOCAB[s]; });
			if (!sectionSpecific) { out.push(blk); return; } // universal (p. ej. "TODOS")
			if (stems.some(function (s) { return aliases.indexOf(s) !== -1; })) out.push(blk);
		});
		if (mat.general) out.push({ label: '', text: mat.general });
		return out;
	}

	// Material que hay que recordarle a un muchacho: por cada academia en la que
	// está inscrito y que tiene material aplicable a su sección.
	function materialParaMuchacho(row) {
		var res = [];
		(row.academies || []).forEach(function (id) {
			var a = academyById(id);
			if (!a || !materialHasContent(a.material)) return;
			var lines = materialForSection(a.material, row.section);
			if (lines.length) res.push({ nombre: a.nombre, icono: a.icono || '', lines: lines });
		});
		return res;
	}

	// Construye el HTML del material COMPLETO de una academia: bloques por sección
	// (tal cual los definió la organización) más el texto general. El jefe reparte
	// según la sección de cada muchacho.
	function renderMaterial(mat) {
		var html = '';
		if (mat && mat.porSeccion && mat.porSeccion.length) {
			html += '<ul class="jf-mat-lines">';
			mat.porSeccion.forEach(function (s) {
				html += '<li>' + (s.label ? '<b>' + esc(s.label) + ':</b> ' : '') + esc(s.text) + '</li>';
			});
			html += '</ul>';
		}
		if (mat && mat.general) {
			html += '<p class="jf-mat-general">' + esc(mat.general) + '</p>';
		}
		return html;
	}

	// ── Carga inicial ─────────────────────────────────────────────
	function init() {
		fetch('includes/data/academias.json', { cache: 'no-store' })
			.then(function (r) { return r.json(); })
			.then(function (cfg) {
				CONFIG = cfg || {};
				ACADEMIES = (CONFIG.academias || []).map(normalizeAcademy);
				SECCIONES = CONFIG.secciones || [];
				SECCION_RAMA = CONFIG.seccionRama || {};
				buildVocab();
				BACKEND_OK = !!(CONFIG.appsScriptUrl && /^https?:\/\//.test(CONFIG.appsScriptUrl));
				var sub = $('#jf-subtitulo');
				if (sub) sub.textContent = (CONFIG.evento || 'Academias') + (CONFIG.fecha ? ' · ' + CONFIG.fecha : '');
				hookEvents();

				if (!BACKEND_OK) {
					showStatus('El registro aún no tiene servidor configurado (appsScriptUrl en academias.json).', 'err');
					return;
				}
				var token = getToken();
				if (!token) {
					showStatus('Este panel es solo para jefes de grupo. Abre el enlace privado que te compartió la organización.', 'err');
					return;
				}
				CURRENT_TOKEN = token;
				loadList(token);
			})
			.catch(function (err) {
				document.body.innerHTML = '<div class="cc-wrap"><div class="jf-card"><p>No se pudo cargar la configuración. Recarga la página.</p></div></div>';
				if (window.console) console.error(err);
			});
	}

	// Lee el token del enlace secreto: primero ?g=TOKEN, luego #TOKEN.
	function getToken() {
		function dec(s) { try { return decodeURIComponent(s).trim(); } catch (e) { return String(s || '').trim(); } }
		var m = /[?&]g=([^&#]+)/.exec(location.search);
		if (m && m[1]) return dec(m[1]);
		var h = (location.hash || '').replace(/^#/, '');
		return h ? dec(h) : '';
	}

	function showStatus(html, kind) {
		$('#jf-results').style.display = 'none';
		var box = $('#jf-status');
		box.style.display = 'block';
		$('#jf-status-body').innerHTML = '<p class="jf-status-msg' + (kind ? ' ' + kind : '') + '">' + html + '</p>';
	}

	// ── Consulta al backend ───────────────────────────────────────
	function loadList(token) {
		showStatus('<span class="cc-spinner"></span> Cargando registros…', '');
		fetch(CONFIG.appsScriptUrl, {
			method: 'POST',
			redirect: 'follow',
			body: JSON.stringify({ action: 'list', token: token })
		})
			.then(function (r) { return r.json(); })
			.then(function (res) {
				if (res && res.ok) {
					CURRENT_GROUP = res.group || '';
					ROWS = (res.rows || []).slice();
					showResults();
					return;
				}
				if (res && res.code === 'auth') {
					showStatus('Este enlace no es válido. Verifica que copiaste la URL completa que te compartieron.', 'err');
					return;
				}
				showStatus(esc((res && res.error) || 'No se pudo consultar. Intenta de nuevo.'), 'err');
			})
			.catch(function (err) {
				if (window.console) console.error(err);
				showStatus('No se pudo conectar. Revisa tu internet y recarga la página.', 'err');
			});
	}

	function refresh() {
		var btn = $('#jf-refresh');
		btn.disabled = true;
		var prev = btn.textContent;
		btn.textContent = 'Actualizando…';
		fetch(CONFIG.appsScriptUrl, {
			method: 'POST',
			redirect: 'follow',
			body: JSON.stringify({ action: 'list', token: CURRENT_TOKEN })
		})
			.then(function (r) { return r.json(); })
			.then(function (res) {
				if (res && res.ok) { ROWS = (res.rows || []).slice(); renderViews(); }
			})
			.catch(function (err) { if (window.console) console.warn(err); })
			.then(function () { btn.disabled = false; btn.textContent = prev; });
	}

	// ── Render de resultados ──────────────────────────────────────
	function showResults() {
		$('#jf-status').style.display = 'none';
		$('#jf-results').style.display = 'block';
		renderViews();
	}

	function renderViews() {
		renderSummary();
		renderSeccionesView();
		renderMaterialView();
	}

	function sortByName(a, b) { return normalize(a.nombre).localeCompare(normalize(b.nombre)); }

	function renderSummary() {
		var conMaterial = {};
		ROWS.forEach(function (row) {
			(row.academies || []).forEach(function (id) {
				var a = academyById(id);
				if (a && materialHasContent(a.material)) conMaterial[key(row)] = true;
			});
		});
		var n = ROWS.length;
		var m = Object.keys(conMaterial).length;
		$('#jf-summary').innerHTML =
			'<b>' + esc(CURRENT_GROUP) + '</b> · ' +
			'<span class="jf-pill">' + n + ' registrado' + (n === 1 ? '' : 's') + '</span> ' +
			'<span class="jf-pill jf-pill-mat">🧰 ' + m + ' con material por recordar</span>';
	}
	function key(row) { return normalize(row.nombre) + '|' + normalize(row.section); }

	function renderSeccionesView() {
		var host = $('#jf-view-secciones');
		if (!ROWS.length) {
			host.innerHTML = '<div class="jf-empty">Todavía no hay registros en <b>' + esc(CURRENT_GROUP) + '</b>.</div>';
			return;
		}
		// Agrupa por sección, respetando el orden de CONFIG.secciones y dejando
		// al final cualquier sección no listada.
		var bySection = {};
		ROWS.forEach(function (row) {
			var s = row.section || 'Sin sección';
			(bySection[s] = bySection[s] || []).push(row);
		});
		var order = SECCIONES.slice();
		Object.keys(bySection).forEach(function (s) { if (order.indexOf(s) === -1) order.push(s); });

		// Una sola tabla (cómoda en celular y para imprimir): cada sección es un
		// subencabezado y debajo sus nombres numerados. Junto a cada muchacho que
		// requiere recordatorio de material aparece un botón 🧰 que abre el detalle.
		PEOPLE_MAT = {};
		var uid = 0;
		var html = '<div class="jf-print-title">' + esc(CURRENT_GROUP) + ' — Registrados por sección</div>';
		html += '<table class="jf-table"><tbody>';
		order.forEach(function (s) {
			var list = bySection[s];
			if (!list || !list.length) return;
			list.sort(sortByName);
			html += '<tr class="jf-trow-sec"><td colspan="2">' + esc(s) + '</td></tr>';
			list.forEach(function (row, i) {
				var mat = materialParaMuchacho(row);
				var btn = '';
				if (mat.length) {
					var id = 'm' + (uid++);
					PEOPLE_MAT[id] = { nombre: row.nombre, section: row.section, academias: mat };
					btn = '<button type="button" class="jf-alert" data-mat="' + id +
						'" aria-label="Ver material que debe llevar" title="Material por recordar">🧰</button> ';
				}
				html += '<tr><td class="jf-td-num">' + (i + 1) + '</td><td>' + btn + esc(row.nombre) + '</td></tr>';
			});
		});
		html += '</tbody></table>';
		host.innerHTML = html;
	}

	// ── Popup de material por muchacho ────────────────────────────
	function openMatModal(id) {
		var data = PEOPLE_MAT[id];
		if (!data) return;
		$('#jf-modal-title').textContent = '🧰 Material — ' + data.nombre;
		$('#jf-modal-sub').textContent = 'Sección: ' + (data.section || '—') +
			'. Recuérdale traer lo siguiente:';
		var body = data.academias.map(function (a) {
			var lines = a.lines.map(function (l) {
				return '<li>' + (l.label ? '<b>' + esc(l.label) + ':</b> ' : '') + esc(l.text) + '</li>';
			}).join('');
			return '<div class="jf-modal-acad"><div class="jf-modal-acad-title">' +
				(a.icono ? esc(a.icono) + ' ' : '') + esc(a.nombre) + '</div>' +
				'<ul class="jf-mat-lines">' + lines + '</ul></div>';
		}).join('');
		$('#jf-modal-body').innerHTML = body;
		$('#jf-modal').classList.add('show');
	}
	function closeMatModal() { $('#jf-modal').classList.remove('show'); }

	function renderMaterialView() {
		var host = $('#jf-view-material');
		var academiasMat = ACADEMIES.filter(function (a) { return materialHasContent(a.material); });
		if (!academiasMat.length) {
			host.innerHTML = '<div class="jf-empty">Ninguna academia pide material por ahora.</div>';
			return;
		}

		var html = '<p class="jf-hint">Estas son las academias que piden material. Se muestra la lista completa: dile a cada muchacho lo que le toca según su sección.</p>';
		academiasMat.forEach(function (a) {
			var inscritos = ROWS.filter(function (row) { return (row.academies || []).indexOf(a.id) !== -1; });
			html += '<div class="jf-mat-acad">';
			html += '<h3 class="jf-mat-title">' + (a.icono ? esc(a.icono) + ' ' : '') + esc(a.nombre) + '</h3>';

			// Material completo de la academia (todas las secciones).
			html += '<div class="jf-mat-full"><div class="jf-mat-full-label">🧰 Material a llevar</div>' +
				renderMaterial(a.material) + '</div>';

			// Inscritos de este grupo: una sola tabla con la sección como columna.
			if (!inscritos.length) {
				html += '<p class="jf-empty-sm">Nadie de tu grupo se registró aquí.</p>';
			} else {
				var bySec = {};
				inscritos.forEach(function (row) {
					var s = row.section || 'Sin sección';
					(bySec[s] = bySec[s] || []).push(row);
				});
				var order = SECCIONES.slice();
				Object.keys(bySec).forEach(function (s) { if (order.indexOf(s) === -1) order.push(s); });
				html += '<p class="jf-mat-sub">Inscritos de tu grupo:</p>' +
					'<table class="jf-table jf-mat-table"><tbody>';
				order.forEach(function (s) {
					var l = bySec[s];
					if (!l || !l.length) return;
					l.sort(sortByName);
					l.forEach(function (r) {
						html += '<tr><td>' + esc(r.nombre) + '</td><td class="jf-td-sec">' + esc(s) + '</td></tr>';
					});
				});
				html += '</tbody></table>';
			}
			html += '</div>';
		});
		host.innerHTML = html;
	}

	// ── Tabs / navegación ─────────────────────────────────────────
	function switchView(view) {
		$all('.jf-tab').forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-view') === view); });
		$('#jf-view-secciones').style.display = view === 'secciones' ? 'block' : 'none';
		$('#jf-view-material').style.display = view === 'material' ? 'block' : 'none';
	}

	function hookEvents() {
		$('#jf-refresh').addEventListener('click', refresh);
		$all('.jf-tab').forEach(function (t) {
			t.addEventListener('click', function () { switchView(t.getAttribute('data-view')); });
		});
		// Botón de alerta de material (delegación: la tabla se re-renderiza).
		$('#jf-view-secciones').addEventListener('click', function (e) {
			var btn = e.target.closest ? e.target.closest('.jf-alert') : null;
			if (btn) openMatModal(btn.getAttribute('data-mat'));
		});
		$('#jf-modal-close').addEventListener('click', closeMatModal);
		$('#jf-modal').addEventListener('click', function (e) { if (e.target === this) closeMatModal(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMatModal(); });
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else { init(); }
})();

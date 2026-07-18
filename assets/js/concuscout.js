/* ConCuScout 2026 — Pre-registro a Academias
   ------------------------------------------------------------------
   - Carga las academias y talleres desde includes/data/academias.json
   - Muestra disponibilidad en vivo (GET ?action=counts al Apps Script)
   - Permite elegir EXACTAMENTE N academias (config.seleccionRequerida)
   - Registra (POST) validando cupo y duplicados en el servidor
   El control real de cupos/duplicados ocurre en el Apps Script; aquí solo
   guiamos al usuario. Ver docs/apps-script-academias.gs */
(function () {
	'use strict';

	var CONFIG = null;          // contenido de academias.json
	var ACADEMIES = [];         // arreglo de academias
	var COUNTS = {};            // { id: registrados }
	var SELECTED = [];          // ids elegidos (en orden)
	var PICK = 3;
	var MAX = 60;
	var BACKEND_OK = false;     // hay appsScriptUrl configurada
	var CACHE_MIN = 5;          // TTL del caché de conteos (minutos)
	var CACHE_KEY = 'cc_counts_v1';

	function $(sel, ctx) { return (ctx || document).querySelector(sel); }
	function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
	function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

	// Cada taller puede venir como texto ("Teatro") o como objeto
	// { nombre, descripcion, material, preparacion }. Lo normalizamos a objeto.
	function normalizeTaller(t) {
		if (t && typeof t === 'object') {
			return {
				nombre: String(t.nombre || '').trim(),
				descripcion: String(t.descripcion || '').trim(),
				material: String(t.material || '').trim(),
				preparacion: String(t.preparacion || '').trim()
			};
		}
		return { nombre: String(t || '').trim(), descripcion: '', material: '', preparacion: '' };
	}
	function normalizeAcademy(a) {
		var copy = {};
		for (var k in a) { if (a.hasOwnProperty(k)) copy[k] = a[k]; }
		copy.talleres = (a.talleres || []).map(normalizeTaller);
		copy.fichaPdf = String(a.fichaPdf || '').trim();
		copy.material = normalizeMaterial(a.material);
		return copy;
	}
	// material puede ser texto (general, para todos) o un objeto
	// { porSeccion: { "Castores": "...", ... }, general: "..." }.
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
	function materialHasContent(mat) { return !!(mat && (mat.general || (mat.porSeccion && mat.porSeccion.length))); }
	function academyHasFicha(a) { return !!(a.fichaPdf || materialHasContent(a.material)); }
	function tallerHasInfo(t) { return !!(t.descripcion || t.material || t.preparacion); }

	function shuffle(arr) {
		var a = arr.slice();
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
		}
		return a;
	}
	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	// ── Carga inicial ─────────────────────────────────────────────
	function init() {
		fetch('includes/data/academias.json', { cache: 'no-store' })
			.then(function (r) { return r.json(); })
			.then(function (cfg) {
				CONFIG = cfg || {};
				ACADEMIES = (CONFIG.academias || []).map(normalizeAcademy);
				PICK = Number(CONFIG.seleccionRequerida) || 3;
				MAX = Number(CONFIG.cupoMaximo) || 60;
				if (CONFIG.countsCacheMinutes != null) CACHE_MIN = Number(CONFIG.countsCacheMinutes) || 0;
				BACKEND_OK = !!(CONFIG.appsScriptUrl && /^https?:\/\//.test(CONFIG.appsScriptUrl));
				// Con backend, parte de un orden aleatorio para no favorecer
				// siempre a las mismas academias; luego refreshCounts lo ajusta
				// por cupo disponible.
				if (BACKEND_OK) ACADEMIES = shuffle(ACADEMIES);
				renderHeader();
				renderCards();
				renderSections();
				renderGroups();
				renderBar();
				refreshCounts();
				if (!BACKEND_OK) showNotice();
			})
			.catch(function (err) {
				document.body.innerHTML = '<div class="cc-wrap"><div class="cc-notice">No se pudo cargar la configuración del registro. Intenta recargar la página.</div></div>';
				if (window.console) console.error(err);
			});
	}

	function renderHeader() {
		var ev = $('#cc-evento'); if (ev) ev.textContent = CONFIG.evento || 'Pre-registro a Academias';
		var sub = $('#cc-subtitulo'); if (sub) sub.textContent = CONFIG.subtitulo || '';
		var fecha = $('#cc-fecha'); if (fecha) fecha.textContent = CONFIG.fecha || '';
		var pick = $('#cc-pick-num'); if (pick) pick.textContent = PICK;
		$all('.cc-pick-num2').forEach(function (e) { e.textContent = PICK; });
	}

	// ── Tarjetas de academias ─────────────────────────────────────
	function renderCards() {
		var grid = $('#cc-grid');
		grid.innerHTML = '';
		ACADEMIES.forEach(function (a) {
			var card = el('div', 'cc-card');
			card.setAttribute('tabindex', '0');
			card.setAttribute('role', 'button');
			card.setAttribute('aria-pressed', 'false');
			card.dataset.id = a.id;

			var chips = (a.talleres || []).map(function (t, ti) {
				var info = tallerHasInfo(t);
				return '<button type="button" class="cc-chip" data-taller="' + ti + '">' +
					esc(t.nombre) + (info ? '<i class="cc-chip-i" aria-hidden="true">i</i>' : '') +
					'</button>';
			}).join('');

			var fichaBtn = academyHasFicha(a)
				? '<button type="button" class="cc-ficha-btn" data-ficha>📄 Material y ficha</button>'
				: '';

			card.innerHTML =
				'<div class="cc-card-top" style="background:' + esc(a.color || '#444') + '">' +
					'<span class="cc-card-icon">' + esc(a.icono || '⭐') + '</span>' +
					'<span class="cc-card-title">' + esc(a.nombre) + '</span>' +
				'</div>' +
				'<div class="cc-card-body">' +
					'<p class="cc-card-desc">' + esc(a.descripcion || '') + '</p>' +
					'<div class="cc-chips">' + chips + '</div>' +
					'<div class="cc-card-bottom">' +
						fichaBtn +
						'<div class="cc-card-foot">' +
							'<span class="cc-avail" data-avail></span>' +
							'<button type="button" class="cc-pick" data-pick><span class="cc-pick-txt">Elegir</span></button>' +
						'</div>' +
					'</div>' +
				'</div>';

			function toggle() { toggleSelect(a.id, card); }
			card.addEventListener('click', toggle);
			card.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
			});
			// Botón de ficha/material: abre el detalle de la academia sin seleccionarla.
			var fb = $('[data-ficha]', card);
			if (fb) fb.addEventListener('click', function (e) { e.stopPropagation(); openAcademy(a); });
			// Chips de taller: abren su detalle sin seleccionar la academia.
			$all('.cc-chip', card).forEach(function (chip) {
				chip.addEventListener('click', function (e) {
					e.stopPropagation();
					var ti = Number(chip.getAttribute('data-taller'));
					openTaller(a, a.talleres[ti]);
				});
			});
			grid.appendChild(card);
		});
		scheduleEqualize();
	}

	function cardFor(id) { return $('#cc-grid .cc-card[data-id="' + id + '"]'); }

	// Iguala la altura de TODAS las tarjetas (flexbox solo iguala por fila, así
	// que la fila con más talleres quedaba más alta que la otra).
	var equalizeRaf = null;
	function equalizeCards() {
		var cards = $all('#cc-grid .cc-card');
		if (!cards.length) return;
		// 0) Reordenar los chips de talleres para que quepan más por renglón.
		packChips();
		var heads = $all('#cc-grid .cc-card-top');
		// Reset antes de medir.
		heads.forEach(function (h) { h.style.minHeight = ''; });
		cards.forEach(function (c) { c.style.minHeight = ''; });
		// 1) Igualar la altura de los headers (títulos de 1, 2 o 3 líneas).
		var hmax = 0;
		heads.forEach(function (h) { if (h.offsetHeight > hmax) hmax = h.offsetHeight; });
		if (hmax > 0) heads.forEach(function (h) { h.style.minHeight = hmax + 'px'; });
		// 2) Igualar la altura total de las tarjetas.
		var max = 0;
		cards.forEach(function (c) { if (c.offsetHeight > max) max = c.offsetHeight; });
		if (max > 0) cards.forEach(function (c) { c.style.minHeight = max + 'px'; });
	}

	// Reordena los chips de cada academia con un algoritmo first-fit-decreasing
	// (mide el ancho real de cada chip) para minimizar renglones: agrupa los
	// nombres que caben juntos en la misma línea. El orden visual de los
	// talleres puede cambiar, pero se aprovecha mejor el espacio.
	function packChips() {
		$all('#cc-grid .cc-chips').forEach(function (container) {
			var chips = $all('.cc-chip', container);
			if (chips.length < 2) return;
			var avail = container.clientWidth;
			if (!avail) return;
			var gap = parseFloat(getComputedStyle(container).columnGap || getComputedStyle(container).gap) || 6;
			var items = chips.map(function (c) { return { el: c, w: c.offsetWidth }; });
			// Orden descendente por ancho.
			items.sort(function (a, b) { return b.w - a.w; });
			// First-fit: coloca cada chip en la primera línea donde quepa.
			var lines = [];
			items.forEach(function (it) {
				for (var i = 0; i < lines.length; i++) {
					if (lines[i].used + gap + it.w <= avail) {
						lines[i].items.push(it.el);
						lines[i].used += gap + it.w;
						return;
					}
				}
				lines.push({ items: [it.el], used: it.w });
			});
			// Reinserta los chips en el nuevo orden (conserva sus listeners).
			var frag = document.createDocumentFragment();
			lines.forEach(function (line) {
				line.items.forEach(function (el) { frag.appendChild(el); });
			});
			container.appendChild(frag);
		});
	}
	function scheduleEqualize() {
		if (equalizeRaf) cancelAnimationFrame(equalizeRaf);
		equalizeRaf = requestAnimationFrame(function () {
			requestAnimationFrame(equalizeCards);
		});
		// Respaldo: algunos motores (y capturas headless) no disparan rAF a tiempo.
		setTimeout(equalizeCards, 60);
	}

	function toggleSelect(id, card) {
		if (isFull(id) && SELECTED.indexOf(id) === -1) return; // no se puede elegir llena
		var idx = SELECTED.indexOf(id);
		if (idx !== -1) {
			SELECTED.splice(idx, 1);
		} else {
			if (SELECTED.length >= PICK) {
				flashBar('Ya elegiste ' + PICK + '. Quita una para cambiar.');
				return;
			}
			SELECTED.push(id);
		}
		updateCardStates();
		renderBar();
	}

	function isFull(id) { return BACKEND_OK && (COUNTS[id] || 0) >= MAX; }

	function updateCardStates() {
		ACADEMIES.forEach(function (a) {
			var card = cardFor(a.id);
			if (!card) return;
			var selected = SELECTED.indexOf(a.id) !== -1;
			card.classList.toggle('selected', selected);
			card.setAttribute('aria-pressed', selected ? 'true' : 'false');
			var full = isFull(a.id);
			card.classList.toggle('full', full && !selected);
			// Deshabilitar visualmente las no elegidas cuando ya hay PICK
			var blocked = (!selected && SELECTED.length >= PICK) || (full && !selected);
			card.classList.toggle('disabled', blocked);
			var txt = $('.cc-pick-txt', card);
			if (txt) txt.textContent = selected ? 'Elegida ✓' : (full ? 'Llena' : 'Elegir');
			renderAvail(card, a.id);
		});
	}

	function renderAvail(card, id) {
		var span = $('[data-avail]', card);
		if (!span) return;
		// No mostramos el número de lugares para no inducir sesgo de registro.
		// Solo avisamos cuando una academia ya está llena.
		if (isFull(id)) { span.className = 'cc-avail full'; span.textContent = 'Academia llena'; }
		else { span.className = 'cc-avail'; span.textContent = ''; }
	}

	// ── Barra inferior ────────────────────────────────────────────
	function renderBar() {
		var dots = '';
		for (var i = 0; i < PICK; i++) {
			dots += '<span class="cc-dot' + (i < SELECTED.length ? ' on' : '') + '"></span>';
		}
		$('#cc-bar-count').innerHTML =
			'Has elegido <b>' + SELECTED.length + '</b> de ' + PICK +
			'<span class="cc-bar-dots">' + dots + '</span>';
		var btn = $('#cc-continue');
		var ready = SELECTED.length === PICK && BACKEND_OK;
		btn.disabled = !ready;
		btn.textContent = SELECTED.length === PICK ? 'Continuar' : 'Elige ' + (PICK - SELECTED.length) + ' más';
	}

	var flashTimer = null;
	function flashBar(msg) {
		var c = $('#cc-bar-count');
		var prev = c.innerHTML;
		c.innerHTML = '<b>' + esc(msg) + '</b>';
		clearTimeout(flashTimer);
		flashTimer = setTimeout(renderBar, 1800);
	}

	// ── Conteos en vivo (con caché en localStorage) ───────────────
	// Para agilizar la página y no consultar el Apps Script en cada recarga,
	// guardamos los conteos con un TTL (countsCacheMinutes). Dentro de esa
	// ventana se usa el caché (render instantáneo, mismo orden); fuera de ella
	// —o en otro dispositivo— se consulta de nuevo y el orden refleja la
	// disponibilidad aproximada de ese momento. La corrección de cupos no
	// depende de esto: el registro siempre se valida en el servidor.
	function readCachedCounts() {
		if (!CACHE_MIN) return null;
		try {
			var raw = window.localStorage.getItem(CACHE_KEY);
			if (!raw) return null;
			var obj = JSON.parse(raw);
			if (!obj || !obj.t || !obj.counts) return null;
			if (Date.now() - obj.t > CACHE_MIN * 60000) return null; // expiró
			return obj;
		} catch (e) { return null; }
	}
	function writeCachedCounts(counts, max) {
		try {
			window.localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), counts: counts, max: max }));
		} catch (e) { /* sin localStorage: simplemente no cacheamos */ }
	}

	function refreshCounts() {
		if (!BACKEND_OK) { updateCardStates(); return; }

		var cached = readCachedCounts();
		if (cached) {
			COUNTS = cached.counts;
			if (cached.max) MAX = Number(cached.max) || MAX;
			reorderIfIdle();
			updateCardStates();
			return; // caché fresco: no consultamos el servidor
		}

		fetch(CONFIG.appsScriptUrl + (CONFIG.appsScriptUrl.indexOf('?') === -1 ? '?' : '&') + 'action=counts',
			{ cache: 'no-store', credentials: 'omit', redirect: 'follow' })
			.then(function (r) { return r.json(); })
			.then(function (data) {
				if (data && data.counts) { COUNTS = data.counts; writeCachedCounts(COUNTS, data.max || MAX); }
				if (data && data.max) MAX = Number(data.max) || MAX;
				reorderIfIdle();
				updateCardStates();
			})
			.catch(function (err) {
				if (window.console) console.warn('[concuscout] No se pudieron leer los conteos:', err);
				updateCardStates();
			});
	}

	// Ordena las academias por cupo disponible (las menos llenas primero) para
	// promover una distribución pareja, sin mostrar números. Desempate aleatorio
	// (clave al inicio, cuando todas están en 0). Solo reordena mientras el
	// muchacho no haya empezado a elegir, para que las tarjetas no salten.
	function reorderIfIdle() {
		if (SELECTED.length > 0) return;
		var rnd = ACADEMIES.map(function (a, i) { return { a: a, r: Math.random(), i: i }; });
		rnd.sort(function (x, y) {
			var cx = COUNTS[x.a.id] || 0, cy = COUNTS[y.a.id] || 0;
			if (cx !== cy) return cx - cy;          // menos registros primero
			return x.r - y.r;                        // desempate aleatorio
		});
		var newOrder = rnd.map(function (o) { return o.a; });
		// Evita re-renderizar si el orden no cambió (no parpadea).
		var changed = newOrder.some(function (a, i) { return ACADEMIES[i] !== a; });
		if (!changed) return;
		ACADEMIES = newOrder;
		renderCards();
		updateCardStates();
	}

	// ── Secciones y grupos del formulario ─────────────────────────
	function renderSections() {
		var sel = $('#cc-section');
		var secs = CONFIG.secciones || [];
		sel.innerHTML = '<option value="">-- Selecciona tu sección --</option>' +
			secs.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
	}

	function renderGroups() {
		var sel = $('#cc-group');
		var grupos = CONFIG.grupos || [];
		sel.innerHTML = '<option value="">-- Selecciona tu grupo --</option>' +
			grupos.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('');
	}

	// ── Modal de datos ────────────────────────────────────────────
	function openModal() {
		if (SELECTED.length !== PICK) return;
		var ul = $('#cc-summary');
		ul.innerHTML = SELECTED.map(function (id) {
			var a = ACADEMIES.filter(function (x) { return x.id === id; })[0];
			return '<li>' + esc(a ? a.icono + ' ' + a.nombre : id) + '</li>';
		}).join('');
		showStep('form');
		$('#cc-modal').classList.add('show');
	}

	function closeModal() {
		$('#cc-modal').classList.remove('show');
		setMsg('', '');
	}

	// ── Detalle de un taller ──────────────────────────────────────
	function openTaller(academy, taller) {
		if (!taller) return;
		$('#cc-taller-title').textContent = (academy.icono ? academy.icono + ' ' : '') + taller.nombre;
		$('#cc-taller-acad').textContent = 'Academia: ' + academy.nombre;
		$('#cc-taller-desc').textContent = taller.descripcion ||
			'Pronto compartiremos más detalles de este taller.';

		var mat = $('#cc-taller-material');
		if (taller.material) {
			mat.innerHTML = '<b>🧰 Material que necesitas</b>' + esc(taller.material);
			mat.style.display = 'block';
		} else { mat.style.display = 'none'; }

		var prep = $('#cc-taller-prep');
		if (taller.preparacion) {
			prep.className = 'cc-taller-note prep';
			prep.innerHTML = '<b>📝 Prepárate antes</b>' + esc(taller.preparacion);
			prep.style.display = 'block';
		} else { prep.style.display = 'none'; }

		$('#cc-taller-modal').classList.add('show');
	}

	function closeTaller() { $('#cc-taller-modal').classList.remove('show'); }

	// ── Ficha y material de una academia ──────────────────────────
	function openAcademy(academy) {
		if (!academy) return;
		$('#cc-acad-title').textContent = (academy.icono ? academy.icono + ' ' : '') + academy.nombre;
		$('#cc-acad-desc').textContent = academy.descripcion || '';

		var matWrap = $('#cc-acad-material');
		if (materialHasContent(academy.material)) {
			$('#cc-acad-material-text').innerHTML = renderMaterial(academy.material);
			matWrap.style.display = 'block';
		} else { matWrap.style.display = 'none'; }

		var fichaWrap = $('#cc-acad-ficha-wrap');
		if (academy.fichaPdf) {
			$('#cc-acad-pdf').setAttribute('href', academy.fichaPdf);
			fichaWrap.style.display = 'block';
		} else {
			fichaWrap.style.display = 'none';
		}

		$('#cc-acad-modal').classList.add('show');
	}

	function closeAcademy() {
		$('#cc-acad-modal').classList.remove('show');
	}

	// Construye el HTML del material: si es por sección, lo separa en bloques
	// claramente etiquetados para que cada quien identifique solo el suyo.
	function renderMaterial(mat) {
		var html = '';
		if (mat.porSeccion && mat.porSeccion.length) {
			html += '<ul class="cc-mat-list"><br/>';
			mat.porSeccion.forEach(function (s) {
				html += '<li><span class="cc-mat-sec">' + esc(s.label) + ':</span> ' + esc(s.text) + '</li>';
			});
			html += '</ul>';
		}
		if (mat.general) {
			html += '<p class="cc-mat-general">' + esc(mat.general) + '</p>';
		}
		return html;
	}

	function showStep(step) {
		$('#cc-step-form').style.display = step === 'form' ? 'block' : 'none';
		$('#cc-step-similar').style.display = step === 'similar' ? 'block' : 'none';
		$('#cc-step-done').style.display = step === 'done' ? 'block' : 'none';
	}

	function setMsg(txt, kind) {
		var m = $('#cc-msg');
		m.textContent = txt || '';
		m.className = 'cc-msg' + (kind ? ' ' + kind : '');
	}

	function submit(confirmDifferent) {
		var nombres = $('#cc-nombres').value.trim();
		var paterno = $('#cc-paterno').value.trim();
		var materno = $('#cc-materno').value.trim();
		var group = $('#cc-group').value;
		var section = $('#cc-section').value;

		if (!nombres) { setMsg('Escribe tu(s) nombre(s).', 'err'); $('#cc-nombres').focus(); return; }
		if (!paterno) { setMsg('Escribe tu apellido paterno.', 'err'); $('#cc-paterno').focus(); return; }
		if (!group) { setMsg('Selecciona tu grupo.', 'err'); $('#cc-group').focus(); return; }
		if (!section) { setMsg('Selecciona tu sección.', 'err'); $('#cc-section').focus(); return; }
		if (SELECTED.length !== PICK) { setMsg('Debes elegir ' + PICK + ' academias.', 'err'); return; }

		// Botón a animar: "Confirmar" en el form, o "No, soy otra persona" en el aviso.
		var btn = confirmDifferent ? $('#cc-similar-diff') : $('#cc-submit');
		var btnLabel = confirmDifferent ? 'No, soy otra persona' : 'Confirmar registro';
		btn.disabled = true;
		btn.innerHTML = '<span class="cc-spinner"></span> Registrando…';
		setMsg('', '');

		fetch(CONFIG.appsScriptUrl, {
			method: 'POST',
			redirect: 'follow',
			body: JSON.stringify({
				nombres: nombres, paterno: paterno, materno: materno,
				group: group, section: section, academies: SELECTED,
				confirmDifferent: confirmDifferent === true
			})
		})
			.then(function (r) { return r.json(); })
			.then(function (res) {
				if (res && res.counts) { COUNTS = res.counts; writeCachedCounts(COUNTS, (res.max || MAX)); }
				if (res && res.max) MAX = Number(res.max) || MAX;
				if (res && res.ok) {
					updateCardStates();
					$('#cc-done-name').textContent = nombres;
					showStep('done');
					return;
				}
				if (res && res.code === 'similar') {
					showSimilar(res.similar || []);
					return;
				}
				showStep('form');
				handleError(res || {});
				updateCardStates();
			})
			.catch(function (err) {
				if (window.console) console.error(err);
				setMsg('No se pudo conectar. Revisa tu internet e intenta de nuevo.', 'err');
			})
			.then(function () {
				btn.disabled = false;
				btn.textContent = btnLabel;
			});
	}

	function showSimilar(names) {
		var ul = $('#cc-similar-list');
		ul.innerHTML = names.map(function (n) { return '<li>👤 ' + esc(n) + '</li>'; }).join('');
		$('#cc-similar-msg').textContent = '';
		$('#cc-similar-msg').className = 'cc-msg';
		showStep('similar');
	}

	function handleError(res) {
		if (res.code === 'duplicate') {
			setMsg('Ya hay un registro con ese nombre, grupo y sección. Si necesitas un cambio, contacta a la organización.', 'err');
		} else if (res.code === 'full') {
			var nombres = (res.full || []).map(function (id) {
				var a = ACADEMIES.filter(function (x) { return x.id === id; })[0];
				return a ? a.nombre : id;
			});
			// Quita de la selección las que se llenaron y cierra para re-elegir.
			(res.full || []).forEach(function (id) {
				var i = SELECTED.indexOf(id);
				if (i !== -1) SELECTED.splice(i, 1);
			});
			renderBar();
			setMsg('Se llenó: ' + nombres.join(', ') + '. Por favor elige otra academia.', 'err');
			setTimeout(function () { closeModal(); }, 2600);
		} else {
			setMsg(res.error || 'Ocurrió un error. Intenta de nuevo.', 'err');
		}
	}

	function showNotice() {
		var n = $('#cc-notice');
		n.classList.remove('hide');
		n.textContent = 'El registro aún no está habilitado. Falta configurar el servidor (appsScriptUrl en includes/data/academias.json).';
	}

	// ── Eventos globales ──────────────────────────────────────────
	function renderBarHooks() {
		$('#cc-continue').addEventListener('click', openModal);
		$('#cc-cancel').addEventListener('click', closeModal);
		$('#cc-submit').addEventListener('click', function () { submit(false); });
		$('#cc-similar-diff').addEventListener('click', function () { submit(true); });
		$('#cc-similar-same').addEventListener('click', function () {
			var m = $('#cc-similar-msg');
			m.className = 'cc-msg ok';
			m.textContent = '¡Perfecto! Ya tienes tu lugar apartado, no necesitas registrarte de nuevo.';
			$('#cc-similar-same').disabled = true;
			$('#cc-similar-diff').disabled = true;
			setTimeout(function () { window.location.reload(); }, 2600);
		});
		$('#cc-done-close').addEventListener('click', function () {
			// Tras registrar, recargamos para que otro pueda registrarse limpio.
			window.location.reload();
		});
		$('#cc-modal').addEventListener('click', function (e) {
			if (e.target === this) closeModal();
		});
		$('#cc-taller-close').addEventListener('click', closeTaller);
		$('#cc-taller-modal').addEventListener('click', function (e) {
			if (e.target === this) closeTaller();
		});
		$('#cc-acad-close').addEventListener('click', closeAcademy);
		$('#cc-acad-modal').addEventListener('click', function (e) {
			if (e.target === this) closeAcademy();
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') { closeAcademy(); closeTaller(); closeModal(); }
		});
		// Re-igualar alturas al cambiar el tamaño de la ventana (con debounce).
		var rzTimer = null;
		window.addEventListener('resize', function () {
			clearTimeout(rzTimer);
			rzTimer = setTimeout(scheduleEqualize, 150);
		});
		window.addEventListener('load', scheduleEqualize);
	}

	if (document.readyState !== 'loading') { renderBarHooks(); init(); }
	else document.addEventListener('DOMContentLoaded', function () { renderBarHooks(); init(); });
})();

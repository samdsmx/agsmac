/* ============================================================
   VIII RALLY VIRTUAL — Modo Aventura, Tutoriales y Registro
   ------------------------------------------------------------
   - Modo Aventura (por defecto): recorrido guiado tipo RPG.
   - Modo Info: la convocatoria de corrido, para leerla completa.
   - Tutoriales: se generan desde includes/data/rally.json
   - Registro: POST al Apps Script (docs/apps-script-rally.gs).
     Si no hay appsScriptUrl configurada, cae a registro por correo.
   Sin dependencias externas. Cargar DESPUÉS de rally.js.
   ============================================================ */
(function () {
	'use strict';

	var CFG = null;            // contenido de rally.json
	var GRUPOS = [];           // lista tomada de includes/data/grupos.json
	var BADGES = [];           // insignias ganadas en modo aventura
	var SCENE = 0;             // escena actual
	var MEMBER_SEQ = 0;

	var CARGOS_CLAVE = ['Guía', 'Guardián de Leyendas', 'Tesorero', 'Secretario'];

	var SCENES = [
		'inicio', 'mision', 'equipo', 'cargos', 'herramientas',
		'reglas', 'preparacion', 'registro'
	];

	function $(s, c) { return (c || document).querySelector(s); }
	function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
	function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	/* ============================================================
	   CARGA DE DATOS
	   ============================================================ */
	function getJSON(url) {
		return fetch(url, { cache: 'no-store' })
			.then(function (r) { return r.json(); })
			.catch(function () { return null; });
	}

	/** Los grupos salen de la MISMA fuente que el resto del sitio:
	 *  includes/data/grupos.json, con forma Estado -> "Grupo NNN" -> {...} */
	function loadGrupos() {
		return getJSON('includes/data/grupos.json').then(function (j) {
			var out = [];
			if (j) {
				Object.keys(j).forEach(function (estado) {
					Object.keys(j[estado] || {}).forEach(function (g) { out.push(g); });
				});
			}
			out.sort(function (a, b) {
				return (parseInt(a.replace(/\D/g, ''), 10) || 0) -
					(parseInt(b.replace(/\D/g, ''), 10) || 0);
			});
			GRUPOS = out;
			return out;
		});
	}

	/* ============================================================
	   TUTORIALES
	   ============================================================ */
	function renderTutorials() {
		var host = $('#tut-list');
		if (!host || !CFG || !CFG.tutoriales) return;

		host.innerHTML = '';

		CFG.tutoriales.forEach(function (t) {
			var box = el('div', 'tut');
			box.setAttribute('data-tut', t.id);

			var head = el('button', 'tut-head');
			head.type = 'button';
			head.setAttribute('aria-expanded', 'false');
			head.innerHTML =
				'<span class="ti">' + esc(t.icono || '📘') + '</span>' +
				'<span class="tinfo">' +
					'<span class="tt">' + esc(t.titulo) + '</span>' +
					'<span class="tm">' + esc(t.responsable || '') +
					(t.duracion ? ' · ' + esc(t.duracion) : '') + '</span>' +
				'</span>' +
				'<span class="tx">+</span>';

			var body = el('div', 'tut-body');

			var html = '';
			if (t.intro) html += '<p class="intro">' + esc(t.intro) + '</p>';

			html += '<ol class="tsteps">';
			(t.pasos || []).forEach(function (p) {
				html += '<li class="tstep' + (p.destacado ? ' key' : '') + '">' +
					'<b>' + esc(p.t) + '</b>' +
					'<span>' + esc(p.d) + '</span>' +
					'</li>';
			});
			html += '</ol>';

			if (t.errores && t.errores.length) {
				html += '<div class="tut-errs"><h5>⚠ ERRORES QUE CUESTAN CARO</h5><ul>';
				t.errores.forEach(function (e) { html += '<li>' + esc(e) + '</li>'; });
				html += '</ul></div>';
			}

			body.innerHTML = html;

			head.addEventListener('click', function () {
				var open = box.classList.toggle('open');
				head.setAttribute('aria-expanded', open ? 'true' : 'false');
			});

			box.appendChild(head);
			box.appendChild(body);
			host.appendChild(box);
		});
	}

	/** Pinta la lista de cargos de la escena de aventura desde el JSON */
	function renderRoles() {
		var host = $('#adv-roles');
		if (!host || !CFG || !CFG.cargos) return;
		host.innerHTML = CFG.cargos.map(function (c) {
			return '<div class="role">' +
				'<span class="ic">' + esc(c.icono || '⚜') + '</span>' +
				'<div><b>' + esc(c.nombre) + '</b> — ' + esc(c.desc || '') + '</div>' +
				'</div>';
		}).join('');
	}

	/* ============================================================
	   MODO AVENTURA
	   ============================================================ */
	function initAdventure() {
		// El modo aventura es el predeterminado. No se pregunta al inicio.
		document.documentElement.classList.add('adventure');
		showScene(0);

		var toggle = $('#mode-btn');
		if (toggle) {
			toggle.addEventListener('click', function () {
				var adv = document.documentElement.classList.toggle('adventure');
				toggle.textContent = adv ? 'VER TODO' : 'MODO AVENTURA';
				toggle.setAttribute('title', adv
					? 'Ver la convocatoria completa de corrido'
					: 'Volver al recorrido guiado');
				if (adv) showScene(SCENE);
				window.scrollTo({ top: 0, behavior: 'smooth' });
			});
		}

		// Navegación entre escenas
		$all('[data-go]').forEach(function (b) {
			b.addEventListener('click', function () {
				var badge = b.getAttribute('data-badge');
				if (badge) awardBadge(badge);
				var i = SCENES.indexOf(b.getAttribute('data-go'));
				if (i !== -1) showScene(i);
			});
		});

		var back = $('#adv-back');
		if (back) back.addEventListener('click', function () { showScene(SCENE - 1); });

		var next = $('#adv-next');
		if (next) next.addEventListener('click', function () { showScene(SCENE + 1); });

		// Flechas del teclado
		document.addEventListener('keydown', function (e) {
			if (!document.documentElement.classList.contains('adventure')) return;
			var tag = (e.target && e.target.tagName) || '';
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
			if (e.key === 'ArrowLeft') showScene(SCENE - 1);
			if (e.key === 'ArrowRight') showScene(SCENE + 1);
		});
	}

	function showScene(i) {
		SCENE = Math.max(0, Math.min(i, SCENES.length - 1));
		$all('.scene').forEach(function (s) { s.classList.remove('active'); });
		var target = $('#scene-' + SCENES[SCENE]);
		if (target) target.classList.add('active');
		updateProgress();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function updateProgress() {
		var fill = $('#adv-fill');
		var label = $('#adv-label');
		var xp = $('#adv-xp');
		var back = $('#adv-back');
		var next = $('#adv-next');

		var pct = Math.round((SCENE / (SCENES.length - 1)) * 100);
		if (fill) fill.style.width = pct + '%';
		if (label) label.textContent = 'PASO ' + (SCENE + 1) + ' DE ' + SCENES.length;
		if (xp) xp.textContent = BADGES.length + ' / 6 INSIGNIAS';
		if (back) back.disabled = SCENE === 0;
		if (next) next.disabled = SCENE === SCENES.length - 1;
	}

	function awardBadge(id) {
		if (BADGES.indexOf(id) !== -1) return;
		BADGES.push(id);
		var b = $('#badge-' + id);
		if (b) b.classList.add('won');
		updateProgress();
	}

	/* ============================================================
	   DATOS BANCARIOS (se pintan desde rally.json)
	   ============================================================ */
	function renderBanco() {
		var hosts = $all('[data-banco]');
		if (!hosts.length || !CFG || !CFG.banco) return;

		var b = CFG.banco;
		var filas = [
			{ k: b.banco + ' · ' + b.titular, v: 'Cuenta ' + b.cuenta, raw: b.cuenta.replace(/\s/g, '') },
			{ k: 'CLABE interbancaria', v: b.clabe, raw: b.clabe },
			{ k: 'Tarjeta de débito', v: b.tarjeta, raw: b.tarjeta.replace(/\s/g, '') }
		];

		hosts.forEach(function (host) {
			host.innerHTML = filas.map(function (f) {
				return '<div class="copy-row">' +
					'<div><div class="k">' + esc(f.k) + '</div>' +
					'<div class="v">' + esc(f.v) + '</div></div>' +
					'<button class="copy-btn" type="button" data-target="' + esc(f.raw) + '">COPIAR</button>' +
					'</div>';
			}).join('');
		});

		bindCopy();
	}

	/** Los botones de copiar creados dinámicamente necesitan su propio enlace */
	function bindCopy() {
		$all('.copy-btn').forEach(function (btn) {
			if (btn.getAttribute('data-bound')) return;
			btn.setAttribute('data-bound', '1');
			btn.addEventListener('click', function () {
				var text = btn.getAttribute('data-target') || '';
				if (!text) return;

				function done(ok) {
					btn.classList.toggle('ok', ok);
					btn.textContent = ok ? 'LISTO' : 'COPIA MANUAL';
					setTimeout(function () {
						btn.classList.remove('ok');
						btn.textContent = 'COPIAR';
					}, 1600);
					var toast = $('#toast');
					if (toast && ok) {
						toast.textContent = 'COPIADO';
						toast.classList.add('show');
						setTimeout(function () { toast.classList.remove('show'); }, 1600);
					}
				}

				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text)
						.then(function () { done(true); })
						.catch(function () { done(false); });
				} else {
					done(false);
				}
			});
		});
	}

	/** Copia texto al portapapeles, con respaldo para navegadores viejos. */
	function copiar(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).catch(function () { copiarLegacy(text); });
		} else {
			copiarLegacy(text);
		}
		var toast = $('#toast');
		if (toast) {
			toast.textContent = 'COPIADO';
			toast.classList.add('show');
			setTimeout(function () { toast.classList.remove('show'); }, 1600);
		}
	}

	function copiarLegacy(text) {
		try {
			var ta = el('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		} catch (e) { /* sin portapapeles: el texto sigue visible en pantalla */ }
	}

	/* ============================================================
	   FORMULARIO DE REGISTRO
	   El reparto de cargos se hace en un TABLERO: cada cargo tiene
	   un solo dueño (imposible repetirlo) y se ve de un vistazo
	   cuáles faltan. Una persona sí puede llevar varios cargos.
	   ============================================================ */
	function initForm() {
		var host = $('#roster');
		if (!host) return;

		fillSelect('#f-grupo', GRUPOS, 'Selecciona tu grupo');
		fillSelect('#f-seccion', (CFG && CFG.secciones) || [], 'Selecciona tu sección');

		renderCargoBoard();

		var min = (CFG && CFG.minIntegrantes) || 3;
		for (var i = 0; i < min; i++) addMember();

		var addBtn = $('#add-member');
		if (addBtn) addBtn.addEventListener('click', function () { addMember(); });

		var form = $('#reg-form');
		if (form) {
			form.addEventListener('submit', function (ev) {
				ev.preventDefault();
				submitForm(false);
			});
		}

		refresh();
	}

	function fillSelect(sel, items, placeholder) {
		var s = $(sel);
		if (!s) return;
		s.innerHTML = '<option value="">' + esc(placeholder) + '</option>' +
			items.map(function (i) {
				return '<option value="' + esc(i) + '">' + esc(i) + '</option>';
			}).join('');
	}

	function cargoList() {
		return (CFG && CFG.cargos) ? CFG.cargos : CARGOS_CLAVE.map(function (n) {
			return { nombre: n, icono: '⚜' };
		});
	}

	/* ---------- Tablero de cargos ---------- */

	/** Una tarjeta por cargo, con un select de integrantes.
	 *  Un cargo = un dueño, así no hay forma de repetirlo. */
	function renderCargoBoard() {
		var board = $('#cargo-board');
		if (!board) return;

		board.innerHTML = cargoList().map(function (c) {
			return '<div class="cslot" data-cargo="' + esc(c.nombre) + '">' +
				'<span class="cs-ic">' + esc(c.icono || '⚜') + '</span>' +
				'<div class="cs-info">' +
					'<b>' + esc(c.nombre) + '</b>' +
					'<span>' + esc(c.desc || '') + '</span>' +
				'</div>' +
				'<select class="finput cs-sel" aria-label="Quién lleva el cargo de ' +
					esc(c.nombre) + '"></select>' +
				'<span class="cs-state">PENDIENTE</span>' +
			'</div>';
		}).join('');

		$all('.cs-sel', board).forEach(function (s) {
			s.addEventListener('change', refresh);
		});
	}

	/** Repuebla los selects del tablero con los integrantes que ya tienen
	 *  nombre, conservando la asignación cuando el nombre sigue existiendo. */
	function syncCargoBoard(nombres) {
		$all('#cargo-board .cslot').forEach(function (slot) {
			var sel = $('.cs-sel', slot);
			var prev = sel.value;
			sel.innerHTML = '<option value="">— sin asignar —</option>' +
				nombres.map(function (n) {
					return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
				}).join('');
			sel.value = nombres.indexOf(prev) !== -1 ? prev : '';
			var ok = !!sel.value;
			slot.classList.toggle('done', ok);
			$('.cs-state', slot).textContent = ok ? '✓ ASIGNADO' : 'PENDIENTE';
		});
	}

	/** Lee el tablero y devuelve { nombre -> [cargos] } */
	function cargosPorPersona() {
		var mapa = {};
		$all('#cargo-board .cslot').forEach(function (slot) {
			var quien = $('.cs-sel', slot).value;
			if (!quien) return;
			if (!mapa[quien]) mapa[quien] = [];
			mapa[quien].push(slot.getAttribute('data-cargo'));
		});
		return mapa;
	}

	function cargosSinAsignar() {
		return $all('#cargo-board .cslot').filter(function (slot) {
			return !$('.cs-sel', slot).value;
		}).map(function (slot) { return slot.getAttribute('data-cargo'); });
	}

	/* ---------- Integrantes ---------- */

	function addMember() {
		var max = (CFG && CFG.maxIntegrantes) || 8;
		if ($all('#roster .member').length >= max) return;

		var n = ++MEMBER_SEQ;
		var row = el('div', 'member');

		row.innerHTML =
			'<div class="mhead">' +
				'<span class="mnum">' + n + '</span>' +
				'<input class="finput m-nombre" type="text" placeholder="Nombre completo" ' +
					'aria-label="Nombre del integrante" />' +
				'<button type="button" class="del-btn" aria-label="Quitar integrante">×</button>' +
			'</div>';

		row.querySelector('.del-btn').addEventListener('click', function () {
			var min = (CFG && CFG.minIntegrantes) || 3;
			if ($all('#roster .member').length <= min) {
				setMsg('La patrulla debe tener al menos ' + min + ' integrantes.', 'warn');
				return;
			}
			row.remove();
			renumber();
			refresh();
		});

		row.querySelector('.m-nombre').addEventListener('input', refresh);

		$('#roster').appendChild(row);
		renumber();
		refresh();
	}

	function renumber() {
		$all('#roster .member .mnum').forEach(function (s, i) { s.textContent = i + 1; });
	}

	/** Nombres escritos, sin repetidos y sin vacíos. */
	function nombresRoster() {
		var vistos = {}, out = [];
		$all('#roster .member .m-nombre').forEach(function (i) {
			var v = i.value.trim();
			if (!v || vistos[v.toLowerCase()]) return;
			vistos[v.toLowerCase()] = true;
			out.push(v);
		});
		return out;
	}

	/** Arma el roster final combinando nombres + tablero de cargos. */
	function readRoster() {
		var mapa = cargosPorPersona();
		return nombresRoster().map(function (n) {
			return { nombre: n, cargos: mapa[n] || [] };
		});
	}

	/** Punto único de recálculo: selects del tablero, progreso, resumen,
	 *  total a pagar y estado del botón de agregar. */
	function refresh() {
		var nombres = nombresRoster();
		syncCargoBoard(nombres);

		// progreso del reparto
		var total = $all('#cargo-board .cslot').length;
		var faltan = cargosSinAsignar();
		var hechos = total - faltan.length;

		var fill = $('#cbs-fill');
		if (fill) fill.style.width = (total ? (hechos / total) * 100 : 0) + '%';

		var txt = $('#cbs-txt');
		if (txt) {
			txt.textContent = hechos + ' DE ' + total + ' CARGOS REPARTIDOS';
			txt.className = 'cbs-txt' + (total && hechos === total ? ' ok' : '');
		}

		var status = $('#cboard-status');
		if (status) status.classList.toggle('ok', !!total && hechos === total);

		// resumen por persona
		var sum = $('#cboard-sum');
		if (sum) {
			if (!nombres.length) {
				sum.innerHTML = '<p class="note" style="margin:0">' +
					'Escribe primero los nombres de arriba para poder repartir los cargos.</p>';
			} else {
				var mapa = cargosPorPersona();
				sum.innerHTML = nombres.map(function (n) {
					var cs = mapa[n] || [];
					return '<span class="csum' + (cs.length ? '' : ' none') + '">' +
						'<b>' + esc(n) + '</b>' +
						(cs.length ? esc(cs.join(' + ')) : 'sin cargo') +
						'</span>';
				}).join('');
			}
		}

		// total a pagar
		var costo = (CFG && CFG.evento && CFG.evento.costoPorIntegrante) || 25;
		var num = $('#total-num');
		var lbl = $('#total-lbl');
		if (num) num.textContent = '$' + (nombres.length * costo);
		if (lbl) {
			lbl.textContent = nombres.length
				? nombres.length + ' integrante' + (nombres.length === 1 ? '' : 's') +
					' × $' + costo
				: 'Escribe los nombres para calcular el total';
		}

		// botón de agregar
		var max = (CFG && CFG.maxIntegrantes) || 8;
		var addBtn = $('#add-member');
		if (addBtn) {
			var lleno = $all('#roster .member').length >= max;
			addBtn.disabled = lleno;
			addBtn.textContent = lleno
				? 'MÁXIMO ' + max + ' INTEGRANTES'
				: '+ AGREGAR INTEGRANTE';
		}
	}

	function setMsg(txt, kind) {
		var m = $('#f-msg');
		if (!m) return;
		m.textContent = txt || '';
		m.className = 'fmsg' + (txt ? ' show ' + (kind || '') : '');
		if (txt) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function markBad(sel) {
		var e = $(sel);
		if (!e) return;
		e.classList.add('bad');
		e.focus();
		setTimeout(function () { e.classList.remove('bad'); }, 2600);
	}

	function submitForm(confirmDireccion) {
		var patrulla = $('#f-patrulla').value.trim();
		var grupo = $('#f-grupo').value;
		var seccion = $('#f-seccion').value;
		var instagram = $('#f-instagram').value.trim().replace(/^@+/, '');
		var direccion = $('#f-direccion').value.trim();
		var responsable = $('#f-responsable').value.trim();
		var telLocal = $('#f-tellocal').value.trim();
		var roster = readRoster();

		// ── Validación en el cliente ──────────────────────────────
		if (!patrulla) { setMsg('Escribe el nombre de tu patrulla.', 'err'); markBad('#f-patrulla'); return; }
		if (!grupo) { setMsg('Selecciona tu grupo.', 'err'); markBad('#f-grupo'); return; }
		if (!seccion) { setMsg('Selecciona tu sección.', 'err'); markBad('#f-seccion'); return; }

		if (!/^[a-zA-Z0-9._]{1,30}$/.test(instagram)) {
			setMsg('La cuenta de Instagram solo lleva letras, números, punto y guion bajo. Escríbela sin la @.', 'err');
			markBad('#f-instagram'); return;
		}
		if (!direccion) { setMsg('Falta la dirección del rincón de patrulla.', 'err'); markBad('#f-direccion'); return; }
		if (!responsable) { setMsg('Falta el nombre del padre o madre que los hospeda.', 'err'); markBad('#f-responsable'); return; }

		var min = (CFG && CFG.minIntegrantes) || 3;
		if (roster.length < min) {
			setMsg('La patrulla debe tener al menos ' + min + ' integrantes con nombre.', 'err');
			return;
		}

		var faltan = cargosSinAsignar();
		if (faltan.length) {
			setMsg('Todavía falta repartir ' + faltan.length + ' cargo' +
				(faltan.length === 1 ? '' : 's') + ': ' + faltan.join(', ') +
				'. Un mismo scout puede llevar varios.', 'err');
			var pend = $('#cargo-board .cslot:not(.done)');
			if (pend) pend.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		var payload = {
			patrulla: patrulla, grupo: grupo, seccion: seccion,
			instagram: instagram,
			direccion: direccion, responsable: responsable, telLocal: telLocal,
			roster: roster, confirmDireccion: confirmDireccion === true
		};

		var url = CFG && CFG.appsScriptUrl;
		if (!url) {
			setMsg('El registro en línea todavía no está habilitado. Escríbenos a ' +
				correoComite() + ' y te ayudamos.', 'err');
			return;
		}

		var btn = $('#f-submit');
		btn.disabled = true;
		btn.innerHTML = '<span class="spinner"></span> REGISTRANDO…';
		setMsg('', '');

		fetch(url, { method: 'POST', redirect: 'follow', body: JSON.stringify(payload) })
			.then(function (r) { return r.json(); })
			.then(function (res) {
				if (res && res.ok) { showDone(res, payload); return; }
				if (res && res.code === 'direccion') {
					if (window.confirm(res.error + '\n\n¿Es correcto? Confirma solo si de verdad es otro domicilio.')) {
						submitForm(true);
					} else {
						setMsg('Revisa la dirección del rincón de patrulla con tu equipo.', 'warn');
					}
					return;
				}
				setMsg((res && res.error) || 'No se pudo completar el registro.', 'err');
			})
			.catch(function () {
				setMsg('No se pudo conectar. Revisa tu internet e intenta de nuevo. ' +
					'Si el problema sigue, escríbenos a ' + correoComite() + '.', 'err');
			})
			.then(function () {
				btn.disabled = false;
				btn.textContent = 'REGISTRAR A MI PATRULLA';
			});
	}

	function correoComite() {
		return (CFG && CFG.evento && CFG.evento.correo) || 'contacto@agsmac.org';
	}

	/** Texto que el Secretario le pasa al Tesorero para que deposite. */
	function textoParaTesorero(res) {
		var b = (CFG && CFG.banco) || {};
		return 'VIII RALLY VIRTUAL — DEPÓSITO DE LA PATRULLA\n\n' +
			'Patrulla: ' + res.patrulla + ' · ' + res.grupo + '\n' +
			'Folio: ' + (res.folio || '') + '\n' +
			'Integrantes: ' + (res.integrantes || 0) + '\n' +
			'MONTO A DEPOSITAR: $' + (res.total || 0) + '\n\n' +
			'DATOS DE LA CUENTA\n' +
			'Banco: ' + (b.banco || '') + '\n' +
			'Titular: ' + (b.titular || '') + '\n' +
			'Cuenta: ' + (b.cuenta || '') + '\n' +
			'CLABE: ' + (b.clabe || '') + '\n' +
			'Tarjeta: ' + (b.tarjeta || '') + '\n\n' +
			'Pon el folio como referencia o concepto.\n' +
			'Al depositar, manda la foto o el PDF del comprobante a ' + correoComite() +
			' con el folio en el asunto. Fecha límite: 29 de agosto.';
	}

	function showDone(res, payload) {
		var form = $('#reg-form');
		var done = $('#reg-done');
		if (!form || !done) return;

		form.style.display = 'none';
		done.style.display = 'block';

		var f = $('#done-folio');
		if (f) f.textContent = res.folio || '—';

		var fr = $('#done-folio-ref');
		if (fr) fr.textContent = res.folio || '—';

		var t = $('#done-total');
		if (t) t.textContent = res.total || 0;

		var p = $('#done-patrulla');
		if (p) p.textContent = res.patrulla + ' · ' + res.grupo;

		// La cuenta se pinta hasta aquí: es lo que el Secretario le pasa al Tesorero
		renderBanco();

		// Botón para copiar folio, monto y cuenta de un jalón
		var copy = $('#done-copy');
		if (copy) {
			copy.addEventListener('click', function () {
				copiar(textoParaTesorero(res));
				copy.textContent = '✓ COPIADO. MÁNDASELO AL TESORERO';
			});
		}

		// Enlace listo para mandar el comprobante con el folio en el asunto
		var link = $('#done-comprobante');
		if (link) {
			var body = 'Folio: ' + (res.folio || '') + '\n' +
				'Patrulla: ' + res.patrulla + ' · ' + res.grupo + '\n' +
				'Monto depositado: $' + (res.total || 0) + '\n' +
				'Integrantes: ' + (res.integrantes || (payload && payload.roster.length)) + '\n\n' +
				'ADJUNTA AQUÍ la foto o el PDF del comprobante de depósito.';
			link.href = 'mailto:' + correoComite() +
				'?subject=' + encodeURIComponent('Comprobante ' + (res.folio || '') + ' - ' + res.patrulla) +
				'&body=' + encodeURIComponent(body);
		}

		done.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/* ============================================================
	   ARRANQUE
	   ============================================================ */
	function applyConfig() {
		if (!CFG) return;

		var invite = CFG.evento && CFG.evento.discordInvite;
		$all('[data-discord]').forEach(function (a) {
			if (invite) { a.href = invite; a.style.display = ''; }
			else { a.style.display = 'none'; }
		});

		$all('[data-correo]').forEach(function (a) {
			a.textContent = correoComite();
			if (a.tagName === 'A' && a.getAttribute('href') === null) {
				a.href = 'mailto:' + correoComite();
			}
		});

		// Sin hoja de cálculo conectada no se puede registrar: avisar de una vez
		// en vez de dejar que lo descubran al presionar ENVIAR.
		if (!CFG.appsScriptUrl) {
			var btn = $('#f-submit');
			if (btn) {
				btn.disabled = true;
				btn.textContent = 'REGISTRO NO DISPONIBLE POR AHORA';
			}
			setMsg('El registro en línea todavía no está habilitado. Vuelve en unos días o ' +
				'escríbenos a ' + correoComite() + '.', 'warn');
		}
	}

	function init() {
		Promise.all([
			getJSON('includes/data/rally.json').then(function (j) { CFG = j; }),
			loadGrupos()
		]).then(function () {
			renderTutorials();
			renderRoles();
			renderBanco();
			initAdventure();
			initForm();
			applyConfig();
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

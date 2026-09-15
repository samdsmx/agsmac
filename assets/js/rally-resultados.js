/* ============================================================
   RESULTADOS DEL RALLY · VIII Rally Virtual Tropas — AGSMAC
   ------------------------------------------------------------
   Aviso emergente con la tabla final de bases. Se abre solo al
   entrar a rally.html (encima de la pantalla de arranque) y se
   puede volver a abrir con el botón RESULTADOS del pie.

   Datos: includes/data/rally-resultados.json
   Orden: total de puntos de mayor a menor. Los empates se
   resuelven con la posición final del ranklist de la trivia
   (campo triviaPos), tal como se anunció en la convocatoria.
   ============================================================ */
(function () {
	'use strict';

	var DATA_URL = 'includes/data/rally-resultados.json';
	var ICONOS = { 2: '\u2705', 1: '\u26A0\uFE0F', 0: '\uD83D\uDE22' };
	var SECCIONES = { TMS: 'Tropa de Muchachas Scouts', TS: 'Tropa Scout' };

	var doc = document;
	var DATOS = null;
	var FILTRO = 'TODAS';

	function $(sel) { return doc.querySelector(sel); }

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/* El escudo del grupo sustituye al texto "Grupo N", igual que en el ranklist
	   de la trivia. Los archivos viven en images/grupos/Escudos/<numero>.png, así
	   que del valor guardado ("Grupo 54") solo se ocupa la cifra. El disco blanco
	   va en un <span> aparte para no recortar las esquinas del PNG. */
	function escudoHtml(grupo) {
		var m = String(grupo == null ? '' : grupo).match(/\d+/);
		var titulo = esc(grupo || '');
		if (!m) return '<span class="rr-escudo rr-escudo-vacio" title="' + titulo + '"></span>';
		return '<span class="rr-escudo" title="' + titulo + '">' +
			'<img src="images/grupos/Escudos/' + m[0] + '.png" ' +
			'alt="' + titulo + '" loading="lazy" ' +
			'onerror="this.parentNode.className=\'rr-escudo rr-escudo-vacio\';this.remove()" />' +
			'</span>';
	}

	function total(p) {
		return (p.bases || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0);
	}

	/** Mayor total primero; a igual total, mejor posición en la trivia. */
	function ordenar(lista) {
		return lista.slice().sort(function (a, b) {
			var d = total(b) - total(a);
			if (d) return d;
			var ta = Number(a.triviaPos) || 999;
			var tb = Number(b.triviaPos) || 999;
			if (ta !== tb) return ta - tb;
			return String(a.patrulla).localeCompare(String(b.patrulla), 'es');
		});
	}

	/** "Base 3 · Conoce tu Asociación" si la base tiene nombre; si no, "Base 3". */
	function nombreBase(i) {
		var nombres = (DATOS && DATOS.nombresBases) || [];
		var n = String(nombres[i] || '').trim();
		return 'Base ' + (i + 1) + (n ? ' \u00B7 ' + n : '');
	}

	function basesHtml(bases) {
		var html = '<div class="rr-bases">';
		for (var i = 0; i < bases.length; i++) {
			var v = Number(bases[i]);
			if (v !== 0 && v !== 1 && v !== 2) v = 0;
			var estado = v === 2 ? 'completa' : v === 1 ? 'incompleta' : 'sin entregar';
			var etiqueta = nombreBase(i);
			html += '<span class="rr-base v' + v + '" title="' + esc(etiqueta) + '">' +
				'<span class="n">' + (i + 1) + '</span>' +
				'<span class="ic" role="img" aria-label="' + esc(etiqueta + ': ' + estado) + '">' +
				ICONOS[v] + '</span>' +
				'</span>';
		}
		return html + '</div>';
	}

	function instagramUrl(handle) {
		var h = String(handle || '').replace(/^@/, '').trim();
		return h ? 'https://www.instagram.com/' + encodeURIComponent(h) + '/' : '';
	}

	/* El nombre de la patrulla es el enlace a su Instagram. Conserva el color del
	   texto normal y solo se subraya al pasar el mouse, para no romper el diseño
	   de la tabla; el tooltip avisa a dónde lleva el clic. */
	function nombreHtml(p) {
		var url = instagramUrl(p.instagram);
		var nombre = esc(p.patrulla);
		if (!url) return nombre;
		var h = String(p.instagram).replace(/^@/, '').trim();
		return '<a class="rr-ig" href="' + url + '" target="_blank" rel="noopener" ' +
			'title="Ver el Instagram de la patrulla (@' + esc(h) + ')">' + nombre + '</a>';
	}

	function pintar() {
		var cont = $('#rr-body');
		if (!cont || !DATOS) return;

		var lista = (DATOS.patrullas || []).filter(function (p) {
			return FILTRO === 'TODAS' || String(p.seccion).toUpperCase() === FILTRO;
		});

		if (!lista.length) {
			cont.innerHTML = '<p class="rr-empty">No hay patrullas en esta sección.</p>';
			return;
		}

		var html = '<table class="rr-table"><tbody>';

		ordenar(lista).forEach(function (p, i) {
			var sec = String(p.seccion || '').toUpperCase();
			html += '<tr>' +
				'<td class="pos">' + (i + 1) + '</td>' +
				'<td><span class="rr-patrulla">' + escudoHtml(p.grupo) +
				'<span class="nombre">' +
				'<b>' + nombreHtml(p) + '</b>' +
				'<span class="rr-seccion" title="' + esc(SECCIONES[sec] || sec) + '">' +
				esc(p.seccion) + '</span>' +
				'</span></span></td>' +
				'<td>' + basesHtml(p.bases || []) + '</td>' +
				'</tr>';
		});

		cont.innerHTML = html + '</tbody></table>';
	}

	function pintarLeyenda() {
		var host = $('#rr-legend');
		if (!host || !DATOS) return;
		var items = DATOS.leyenda || [];
		host.innerHTML = items.map(function (l) {
			return '<span><i>' + l.icono + '</i>' + esc(l.texto) + '</span>';
		}).join('');
	}

	/* ------------------------------------------------------------
	   Apertura y cierre
	   ------------------------------------------------------------ */
	function initModal() {
		var modal = $('#res-modal');
		if (!modal) return;

		var lastFocus = null;

		function open() {
			if (modal.classList.contains('open')) return;
			lastFocus = doc.activeElement;
			modal.hidden = false;
			doc.body.classList.add('locked');
			void modal.offsetWidth;
			modal.classList.add('open');
			var ok = modal.querySelector('.rr-x');
			if (ok) ok.focus();
		}

		function close() {
			if (!modal.classList.contains('open')) return;
			modal.classList.remove('open');
			// Si la pantalla de arranque sigue arriba, el scroll debe seguir bloqueado
			var boot = doc.getElementById('boot');
			if (!boot || boot.classList.contains('done')) {
				doc.body.classList.remove('locked');
			}
			setTimeout(function () { modal.hidden = true; }, 260);
			if (lastFocus && lastFocus.focus) lastFocus.focus();
		}

		var closers = modal.querySelectorAll('[data-res-close]');
		for (var i = 0; i < closers.length; i++) {
			closers[i].addEventListener('click', close);
		}

		doc.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && modal.classList.contains('open')) close();
		});

		// Cualquier botón de la página puede abrirlo
		var abridores = doc.querySelectorAll('[data-res-open]');
		for (var j = 0; j < abridores.length; j++) {
			abridores[j].addEventListener('click', open);
		}

		// Filtros por sección
		var tabs = modal.querySelectorAll('.rr-tab');
		for (var k = 0; k < tabs.length; k++) {
			tabs[k].addEventListener('click', function (e) {
				FILTRO = e.currentTarget.getAttribute('data-seccion');
				for (var n = 0; n < tabs.length; n++) {
					tabs[n].setAttribute('aria-selected',
						tabs[n] === e.currentTarget ? 'true' : 'false');
				}
				pintar();
			});
		}

		// Se despliega encima de la pantalla de arranque
		setTimeout(open, 600);
	}

	function init() {
		initModal();

		fetch(DATA_URL, { cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (d) {
				if (!d) {
					$('#rr-body').innerHTML =
						'<p class="rr-empty">No se pudieron cargar los resultados.</p>';
					return;
				}
				DATOS = d;
				if (d.evento && d.evento.fechas) {
					$('#rr-sub').textContent = d.evento.nombre + ' · ' + d.evento.fechas;
				}
				if (d.desempate) $('#rr-note').textContent = d.desempate;
				pintarLeyenda();
				pintar();
			})
			.catch(function () {
				$('#rr-body').innerHTML =
					'<p class="rr-empty">No se pudieron cargar los resultados.</p>';
			});
	}

	if (doc.readyState === 'loading') {
		doc.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

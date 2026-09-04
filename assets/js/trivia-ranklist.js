/* ============================================================
   RANKLIST DE LA TRIVIA · VIII Rally Virtual Tropas — AGSMAC
   ------------------------------------------------------------
   Página independiente de trivia.html: se puede dejar abierta
   en una pantalla aparte durante el evento.

   No pide identificación ni token. Si en este navegador hay una
   sesión de trivia guardada, resalta la fila de esa patrulla.

   Config:   includes/data/trivia.json
   Backend:  docs/apps-script-trivia.gs (doGet action=ranking)
   ============================================================ */
(function () {
	'use strict';

	var CONFIG_URL = 'includes/data/trivia.json';
	var LS_KEY = 'agsmac_trivia_sesion';

	var CFG = null;
	var YO = null;
	var RANK_TIMER = null;

	function $(sel) { return document.querySelector(sel); }

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	var toastTimer = null;
	function toast(texto) {
		var t = $('#toast');
		t.textContent = texto;
		t.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
	}

	function tiempo(segundos) {
		var s = Math.max(0, Number(segundos) || 0);
		var h = Math.floor(s / 3600);
		var m = Math.floor((s % 3600) / 60);
		var r = s % 60;
		function dos(n) { return (n < 10 ? '0' : '') + n; }
		return (h ? h + ':' + dos(m) : m) + ':' + dos(r);
	}

	/* El escudo del grupo sustituye al texto "Grupo N" en la tabla. Los archivos
	   viven en images/grupos/Escudos/<numero>.png (ver helpers/procesarEscudos.js),
	   así que del valor guardado ("Grupo 54") solo se ocupa la cifra. */
	function escudoHtml(grupo) {
		var m = String(grupo == null ? '' : grupo).match(/\d+/);
		var titulo = esc(grupo || '');
		if (!m) return '<span class="tv-escudo tv-escudo-vacio" title="' + titulo + '"></span>';
		return '<img class="tv-escudo" src="images/grupos/Escudos/' + m[0] + '.png" ' +
			'alt="' + titulo + '" title="' + titulo + '" loading="lazy" ' +
			'onerror="this.className=\'tv-escudo tv-escudo-vacio\';this.removeAttribute(\'src\')" />';
	}

	function getJSON(url) {
		return fetch(url, { cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.catch(function () { return null; });
	}

	/** Sesión de trivia.html, si existe. Solo sirve para resaltar la fila propia. */
	function leerSesion() {
		try {
			var raw = localStorage.getItem(LS_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) { return null; }
	}

	function pintarRanking(lista) {
		var cont = $('#tv-rank-body');

		if (!lista || !lista.length) {
			cont.innerHTML = '<p class="tv-empty">Todavía no hay patrullas en la trivia. ' +
				'¡Sean las primeras!</p>';
			return;
		}

		var yo = YO ? (YO.patrulla + '|' + YO.grupo) : '';

		var html = '<table class="tv-table"><thead><tr>' +
			'<th class="pos">#</th>' +
			'<th>PATRULLA</th>' +
			'<th class="num">RESUELTAS</th>' +
			'<th class="num hide-sm">TIEMPO</th>' +
			'<th class="num hide-sm">INTENTOS</th>' +
			'</tr></thead><tbody>';

		lista.forEach(function (r) {
			var esYo = (r.patrulla + '|' + r.grupo) === yo;
			var clases = [];
			if (esYo) clases.push('me');
			if (r.terminada) clases.push('done');

			html += '<tr' + (clases.length ? ' class="' + clases.join(' ') + '"' : '') + '>' +
				'<td class="pos">' + r.pos + '</td>' +
				'<td class="patrulla"><span class="tv-patrulla">' +
				escudoHtml(r.grupo) +
				'<span class="nombre">' + esc(r.patrulla) +
				(r.terminada ? '<span class="tv-flag">&#127942;</span>' : '') +
				'</span></span></td>' +
				'<td class="num">' + r.resueltas + '</td>' +
				'<td class="num hide-sm">' + (r.segundos ? tiempo(r.segundos) : '—') + '</td>' +
				'<td class="num hide-sm">' + r.intentos + '</td>' +
				'</tr>';
		});

		html += '</tbody></table>';
		cont.innerHTML = html;
	}

	function cargarRanking() {
		if (!CFG || !CFG.appsScriptUrl) {
			$('#tv-rank-body').innerHTML =
				'<p class="tv-empty">El ranklist se habilita cuando arranque la trivia.</p>';
			return Promise.resolve();
		}

		var url = CFG.appsScriptUrl +
			(CFG.appsScriptUrl.indexOf('?') === -1 ? '?' : '&') + 'action=ranking';

		return fetch(url, { cache: 'no-store', redirect: 'follow' })
			.then(function (r) { return r.json(); })
			.then(function (res) {
				if (!res || !res.ok) return;
				pintarRanking(res.ranking);
				var d = new Date();
				$('#tv-rank-updated').textContent = 'Actualizado ' +
					d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() +
					':' + (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
			})
			.catch(function () { /* silencioso: se reintenta en el siguiente refresco */ });
	}

	function programarRanking() {
		var seg = Number(CFG && CFG.rankingRefrescoSegundos) || 0;
		if (seg < 15) return;
		clearInterval(RANK_TIMER);
		RANK_TIMER = setInterval(function () {
			if (!document.hidden) cargarRanking();
		}, seg * 1000);
	}

	// ── Fondo de estrellas ──────────────────────────────────────
	function estrellas() {
		var c = $('#stars');
		if (!c || !c.getContext) return;
		var ctx = null;
		try { ctx = c.getContext('2d'); } catch (e) { return; }
		if (!ctx) return;
		var puntos = [];

		function medir() {
			c.width = window.innerWidth;
			c.height = window.innerHeight;
			puntos = [];
			var n = Math.round((c.width * c.height) / 9000);
			for (var i = 0; i < n; i++) {
				puntos.push({
					x: Math.random() * c.width,
					y: Math.random() * c.height,
					r: Math.random() * 1.4 + 0.2,
					a: Math.random(),
					v: Math.random() * 0.016 + 0.004
				});
			}
		}

		function pintar() {
			ctx.clearRect(0, 0, c.width, c.height);
			for (var i = 0; i < puntos.length; i++) {
				var p = puntos[i];
				p.a += p.v;
				var alpha = 0.25 + Math.abs(Math.sin(p.a)) * 0.6;
				ctx.fillStyle = 'rgba(200, 230, 255, ' + alpha.toFixed(3) + ')';
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fill();
			}
			requestAnimationFrame(pintar);
		}

		medir();
		window.addEventListener('resize', medir);
		requestAnimationFrame(pintar);
	}

	function iniciar() {
		estrellas();

		$('#tv-rank-refresh').addEventListener('click', function () {
			cargarRanking().then(function () { toast('Ranklist actualizado'); });
		});

		YO = leerSesion();
		if (YO && YO.patrulla) {
			$('#tv-hud-nombre').textContent = YO.patrulla;
			$('#tv-hud-grupo').textContent = YO.grupo || '';
			$('#tv-hud-patrol').classList.remove('tv-hide');
		}

		getJSON(CONFIG_URL).then(function (cfg) {
			CFG = cfg || {};
			if (CFG.intro && CFG.intro.subtitulo) {
				$('#tv-subtitulo').textContent = 'Trivia · ' + CFG.intro.subtitulo;
			}
			$('#tv-desempate').textContent = CFG.desempate || '';

			cargarRanking();
			programarRanking();
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', iniciar);
	} else {
		iniciar();
	}
})();

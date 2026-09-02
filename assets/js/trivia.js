/* ============================================================
   TRIVIA · VIII Rally Virtual Tropas — AGSMAC
   ------------------------------------------------------------
   Página independiente (no usa jQuery ni main.js).

   Las preguntas y las respuestas NO viven en el sitio: el sitio
   es público y cualquiera podría leerlas. Este archivo solo pide
   la pregunta del nivel actual al Apps Script y le manda el
   intento para que lo valide allá.

   Config:   includes/data/trivia.json
   Backend:  docs/apps-script-trivia.gs
   Grupos:   includes/data/grupos.json (misma lista del sitio)
   ============================================================ */
(function () {
	'use strict';

	var CONFIG_URL = 'includes/data/trivia.json';
	var GRUPOS_URL = 'includes/data/grupos.json';
	var LS_KEY = 'agsmac_trivia_sesion';

	var CFG = null;
	var TOKEN = '';
	var ESTADO = null;
	var PREGUNTA = null;
	var ENVIANDO = false;
	var RANK_TIMER = null;

	// ── Utilidades ──────────────────────────────────────────────
	function $(sel) { return document.querySelector(sel); }

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function show(sel) { $(sel).classList.remove('tv-hide'); }
	function hide(sel) { $(sel).classList.add('tv-hide'); }

	function pantalla(id) {
		['#tv-intro', '#tv-play', '#tv-correct', '#tv-finish'].forEach(function (s) {
			if (s === id) {
				var el = $(s);
				el.classList.remove('tv-hide');
				// reinicia la animación de entrada
				el.classList.remove('tv-screen');
				void el.offsetWidth;
				el.classList.add('tv-screen');
			} else {
				hide(s);
			}
		});
	}

	function msg(sel, texto, tipo) {
		var el = $(sel);
		el.textContent = texto || '';
		el.className = 'tv-msg' + (tipo ? ' ' + tipo : '');
	}

	var toastTimer = null;
	function toast(texto) {
		var t = $('#toast');
		t.textContent = texto;
		t.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
	}

	function getJSON(url) {
		return fetch(url, { cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.catch(function () { return null; });
	}

	/* Apps Script no responde a preflight OPTIONS: se manda el POST sin
	   Content-Type para que el navegador lo trate como petición simple.
	   Misma técnica que assets/js/rally-adventure.js. */
	function post(payload) {
		if (!CFG || !CFG.appsScriptUrl) {
			return Promise.resolve({
				ok: false, code: 'sinbackend',
				error: 'La trivia todavía no está habilitada. Avisa al Comité.'
			});
		}
		return fetch(CFG.appsScriptUrl, {
			method: 'POST',
			redirect: 'follow',
			body: JSON.stringify(payload)
		})
			.then(function (r) { return r.json(); })
			.catch(function () {
				return {
					ok: false, code: 'red',
					error: 'No pudimos conectar. Revisen su internet e intenten de nuevo.'
				};
			});
	}

	function tiempo(segundos) {
		var s = Math.max(0, Number(segundos) || 0);
		var h = Math.floor(s / 3600);
		var m = Math.floor((s % 3600) / 60);
		var r = s % 60;
		function dos(n) { return (n < 10 ? '0' : '') + n; }
		return (h ? h + ':' + dos(m) : m) + ':' + dos(r);
	}

	// ── Sesión local ────────────────────────────────────────────
	function guardarSesion(token, patrulla, grupo) {
		try {
			localStorage.setItem(LS_KEY, JSON.stringify({
				token: token, patrulla: patrulla, grupo: grupo
			}));
		} catch (e) { /* modo privado: se juega igual, sin recordar */ }
	}

	function leerSesion() {
		try {
			var raw = localStorage.getItem(LS_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) { return null; }
	}

	function borrarSesion() {
		try { localStorage.removeItem(LS_KEY); } catch (e) { }
	}

	// ── Render de la intro ──────────────────────────────────────
	function pintarIntro() {
		var i = (CFG && CFG.intro) || {};
		if (i.titulo) $('#tv-titulo').textContent = i.titulo;
		if (i.subtitulo) $('#tv-subtitulo').textContent = i.subtitulo;
		$('#tv-lead').textContent = i.lead || '';
		$('#tv-cierre').textContent = i.cierre || '';
		$('#tv-desempate').textContent = CFG.desempate || '';

		var ul = $('#tv-bases');
		ul.innerHTML = '';
		(i.bases || []).forEach(function (b) {
			var li = document.createElement('li');
			li.textContent = b;
			ul.appendChild(li);
		});
	}

	function pintarGrupos(grupos) {
		var sel = $('#tv-grupo');
		grupos.forEach(function (g) {
			var op = document.createElement('option');
			op.value = g;
			op.textContent = g;
			sel.appendChild(op);
		});
	}

	function cargarGrupos() {
		return getJSON(GRUPOS_URL).then(function (j) {
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
			pintarGrupos(out);
			return out;
		});
	}

	// ── Render del juego ────────────────────────────────────────
	function pintarHud() {
		if (!ESTADO) { hide('#tv-hud-patrol'); hide('#tv-salir'); return; }
		$('#tv-hud-nombre').textContent = ESTADO.patrulla;
		$('#tv-hud-grupo').textContent = ESTADO.grupo;
		show('#tv-hud-patrol');
		show('#tv-salir');
	}

	function pintarProgreso() {
		if (!ESTADO) return;
		var total = Number(ESTADO.total) || 0;
		var hechas = Number(ESTADO.resueltas) || 0;
		var pct = total ? Math.round((hechas / total) * 100) : 0;
		$('#tv-fill').style.width = pct + '%';
		$('#tv-meta-resueltas').textContent = hechas + ' / ' + total;
		$('#tv-meta-intentos').textContent = ESTADO.intentos || 0;
		$('#tv-meta-nivel').textContent = Math.min(ESTADO.nivel, total || ESTADO.nivel);
	}

	function pintarPregunta() {
		if (!PREGUNTA) return;

		var pista = $('#tv-pista');
		pista.textContent = PREGUNTA.pista || '';
		pista.style.display = PREGUNTA.pista ? '' : 'none';

		$('#tv-nivel-label').textContent =
			'NIVEL ' + PREGUNTA.n + ' DE ' + PREGUNTA.total;

		$('#tv-enunciado').textContent = PREGUNTA.enunciado || '';

		if (PREGUNTA.imagen) {
			$('#tv-imagen').src = PREGUNTA.imagen;
			$('#tv-imagen').alt = PREGUNTA.enunciado || 'Imagen de la pregunta';
			show('#tv-figure');
		} else {
			$('#tv-imagen').removeAttribute('src');
			hide('#tv-figure');
		}

		$('#tv-respuesta').value = '';
		msg('#tv-play-msg', '');
		pintarProgreso();
	}

	/** Decide qué pantalla toca según el estado que devolvió el backend. */
	function avanzar() {
		pintarHud();
		pintarProgreso();

		if (!PREGUNTA) {
			$('#tv-finish-txt').textContent =
				'Resolvieron los ' + (ESTADO ? ESTADO.total : '') +
				' niveles en ' + (ESTADO ? ESTADO.intentos : 0) + ' intentos.';
			pantalla('#tv-finish');
			cargarRanking();
			return;
		}

		pantalla('#tv-play');
		pintarPregunta();
		$('#tv-respuesta').focus();
	}

	// ── Acciones ────────────────────────────────────────────────
	function entrar(patrulla, grupo, pin) {
		var btn = $('#tv-entrar');
		btn.disabled = true;
		msg('#tv-intro-msg', 'Conectando…', 'warn');

		return post({
			action: 'entrar', patrulla: patrulla, grupo: grupo, pin: pin
		}).then(function (res) {
			btn.disabled = false;

			if (!res || !res.ok) {
				var code = res && res.code;
				msg('#tv-intro-msg', (res && res.error) || 'Algo salió mal. Intenten de nuevo.',
					'err');
				// PIN equivocado o bloqueo: se limpia el campo y se enfoca de nuevo,
				// para que no reenvíen el mismo PIN por accidente.
				if (code === 'pin' || code === 'bloqueo') {
					var campo = $('#tv-pin');
					if (campo) { campo.value = ''; campo.focus(); }
				}
				return;
			}

			TOKEN = res.token;
			ESTADO = res.estado;
			PREGUNTA = res.pregunta;
			guardarSesion(TOKEN, ESTADO.patrulla, ESTADO.grupo);
			msg('#tv-intro-msg', '');
			var campoPin = $('#tv-pin');
			if (campoPin) campoPin.value = '';

			if (!res.abierto) {
				pintarHud();
				pantalla('#tv-intro');
				msg('#tv-intro-msg', res.motivo || 'La trivia no está abierta en este momento.', 'warn');
				return;
			}

			avanzar();
			cargarRanking();
			toast(res.nueva
				? '¡Bienvenidas, ' + ESTADO.patrulla + '! No olviden su PIN.'
				: '¡De vuelta, ' + ESTADO.patrulla + '!');
		});
	}

	function recuperarSesion() {
		var s = leerSesion();
		if (!s || !s.token) return Promise.resolve(false);

		return post({ action: 'estado', token: s.token }).then(function (res) {
			if (!res || !res.ok) {
				// El token ya no sirve (le reiniciaron el avance): arrancar limpio.
				if (res && res.code === 'token') borrarSesion();
				return false;
			}
			TOKEN = s.token;
			ESTADO = res.estado;
			PREGUNTA = res.pregunta;

			if (!res.abierto) {
				pintarHud();
				msg('#tv-intro-msg', res.motivo || '', 'warn');
				return true;
			}

			avanzar();
			return true;
		});
	}

	function responder(texto) {
		if (ENVIANDO) return;
		texto = String(texto || '').trim();
		if (!texto) {
			msg('#tv-play-msg', 'Escriban una respuesta antes de enviar.', 'warn');
			return;
		}

		ENVIANDO = true;
		$('#tv-responder').disabled = true;
		msg('#tv-play-msg', 'Revisando…', 'warn');

		post({ action: 'responder', token: TOKEN, respuesta: texto })
			.then(function (res) {
				ENVIANDO = false;
				$('#tv-responder').disabled = false;

				if (!res || !res.ok) {
					msg('#tv-play-msg', (res && res.error) || 'Algo salió mal.', 'err');
					if (res && res.code === 'token') { borrarSesion(); location.reload(); }
					return;
				}

				ESTADO = res.estado || ESTADO;
				pintarProgreso();

				if (!res.correcto) {
					msg('#tv-play-msg',
						'Esa no es. Revisen entre todas y vuelvan a intentar.', 'err');
					var caja = $('#tv-answer-form');
					caja.classList.remove('tv-shake');
					void caja.offsetWidth;
					caja.classList.add('tv-shake');
					$('#tv-respuesta').select();
					return;
				}

				// Acierto: se guarda la siguiente pregunta y se muestra el dato curioso.
				PREGUNTA = res.pregunta;

				if (res.explicacion) {
					$('#tv-fact').textContent = res.explicacion;
					show('#tv-fact-box');
				} else {
					hide('#tv-fact-box');
				}

				$('#tv-siguiente').textContent = PREGUNTA
					? 'SIGUIENTE NIVEL \u25B6'
					: 'VER MI MARCA \u25B6';

				pantalla('#tv-correct');
				window.scrollTo({ top: 0, behavior: 'smooth' });
				cargarRanking();
			});
	}

	// ── Ranklist ────────────────────────────────────────────────
	function pintarRanking(lista) {
		var cont = $('#tv-rank-body');

		if (!lista || !lista.length) {
			cont.innerHTML = '<p class="tv-empty">Todavía no hay patrullas en la trivia. ' +
				'¡Sean las primeras!</p>';
			return;
		}

		var yo = ESTADO ? (ESTADO.patrulla + '|' + ESTADO.grupo) : '';

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
				'<td>' + esc(r.patrulla) +
				(r.terminada ? '<span class="tv-flag">&#127942;</span>' : '') +
				'<br /><span class="grupo">' + esc(r.grupo) + '</span></td>' +
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
			.catch(function () { /* silencioso: el ranklist no debe romper el juego */ });
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

	// ── Eventos ─────────────────────────────────────────────────
	function conectarEventos() {
		$('#tv-form').addEventListener('submit', function (e) {
			e.preventDefault();
			var patrulla = $('#tv-patrulla').value.trim();
			var grupo = $('#tv-grupo').value;
			var pin = $('#tv-pin').value.replace(/\D/g, '');

			if (!grupo) { msg('#tv-intro-msg', 'Selecciona tu grupo.', 'err'); return; }
			if (patrulla.length < 2) {
				msg('#tv-intro-msg', 'Escribe el nombre de tu patrulla.', 'err');
				return;
			}
			if (pin.length !== 4) {
				msg('#tv-intro-msg', 'El PIN debe ser de 4 dígitos.', 'err');
				$('#tv-pin').focus();
				return;
			}
			entrar(patrulla, grupo, pin);
		});

		$('#tv-answer-form').addEventListener('submit', function (e) {
			e.preventDefault();
			responder($('#tv-respuesta').value);
		});

		$('#tv-siguiente').addEventListener('click', function () {
			avanzar();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});

		$('#tv-rank-refresh').addEventListener('click', function () {
			cargarRanking().then(function () { toast('Ranklist actualizado'); });
		});

		$('#tv-salir').addEventListener('click', function () {
			if (!window.confirm(
				'¿Salir de esta patrulla en esta computadora?\n\n' +
				'El avance NO se pierde: se guarda en el servidor. Pueden volver a ' +
				'entrar con el mismo nombre de patrulla y grupo.')) return;
			borrarSesion();
			location.reload();
		});
	}

	// ── Arranque ────────────────────────────────────────────────
	function iniciar() {
		estrellas();
		conectarEventos();

		Promise.all([getJSON(CONFIG_URL), cargarGrupos()])
			.then(function (r) {
				CFG = r[0] || {};
				pintarIntro();

				if (!CFG.appsScriptUrl) {
					msg('#tv-intro-msg',
						'La trivia todavía no está habilitada. Falta configurar el backend ' +
						'en includes/data/trivia.json.', 'warn');
					$('#tv-entrar').disabled = true;
				}

				cargarRanking();
				programarRanking();
				return recuperarSesion();
			})
			.then(function (recuperada) {
				if (!recuperada) {
					var s = leerSesion();
					if (s) {
						$('#tv-patrulla').value = s.patrulla || '';
						$('#tv-grupo').value = s.grupo || '';
					}
				}
			});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', iniciar);
	} else {
		iniciar();
	}

})();

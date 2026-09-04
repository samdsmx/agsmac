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

	// ── Utilidades ──────────────────────────────────────────────
	function $(sel) { return document.querySelector(sel); }

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

	/* Devuelve null si no se pudo leer. Quien llama DEBE avisar al usuario:
	   un fallo silencioso aquí deja la página a medias sin explicación
	   (fue exactamente lo que pasó con la lista de grupos vacía). */
	function getJSON(url) {
		return fetch(url, { cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.catch(function () { return null; });
	}

	/** true si la página se abrió con doble clic (file://) en vez de por HTTP. */
	function sinServidor() {
		return location.protocol === 'file:';
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
		if (!ESTADO) { hide('#tv-hud-patrol'); cerrarMenu(); return; }
		$('#tv-hud-nombre').textContent = ESTADO.patrulla;
		$('#tv-hud-grupo').textContent = ESTADO.grupo;
		show('#tv-hud-patrol');
	}

	// ── Menú de la patrulla ─────────────────────────────────────
	function cerrarMenu() {
		hide('#tv-menu');
		$('#tv-menu-toggle').setAttribute('aria-expanded', 'false');
	}

	function alternarMenu() {
		var abierto = !$('#tv-menu').classList.contains('tv-hide');
		if (abierto) { cerrarMenu(); return; }
		show('#tv-menu');
		$('#tv-menu-toggle').setAttribute('aria-expanded', 'true');
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

	/* La figura solo se muestra si el backend mandó algo que de verdad parece
	   una imagen (URL o ruta). Si la hoja de cálculo trae las columnas
	   recorridas, `imagen` puede llegar con texto suelto; pintarlo como <img>
	   deja la pregunta en blanco y un icono roto en su lugar. */
	function esImagen(v) {
		var s = String(v == null ? '' : v).trim();
		if (!s) return false;
		return /^(https?:)?\/\//i.test(s) ||
			/^(data:image\/|\/|\.{0,2}\/)/i.test(s) ||
			/\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(s);
	}

	function pintarPregunta() {
		if (!PREGUNTA) return;

		$('#tv-nivel-label').textContent =
			'NIVEL ' + PREGUNTA.n + ' DE ' + PREGUNTA.total;

		$('#tv-enunciado').textContent = PREGUNTA.enunciado || '';

		if (esImagen(PREGUNTA.imagen)) {
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
			});
	}

	// ── Ranklist ────────────────────────────────────────────────
	/* El ranklist vive en su propia página (ranklist-trivia.html) para poder
	   dejarlo abierto en otra pantalla durante el evento. Aquí solo se enlaza. */

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

		$('#tv-menu-toggle').addEventListener('click', function (e) {
			e.stopPropagation();
			alternarMenu();
		});

		/* Cerrar al hacer clic fuera o con Escape: si no, el menú se queda
		   abierto encima del juego. */
		document.addEventListener('click', function (e) {
			if (!e.target.closest || !e.target.closest('.tv-hud-menu')) cerrarMenu();
		});

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') cerrarMenu();
		});

		$('#tv-salir').addEventListener('click', function () {
			cerrarMenu();
			if (!window.confirm(
				'¿Salir de esta patrulla en esta computadora?\n\n' +
				'El avance NO se pierde: se guarda en el servidor. Pueden volver a ' +
				'entrar con el mismo nombre de patrulla, grupo y PIN.')) return;
			borrarSesion();
			location.reload();
		});
	}

	// ── Arranque ────────────────────────────────────────────────
	function iniciar() {
		estrellas();
		conectarEventos();

		if (sinServidor()) {
			msg('#tv-intro-msg',
				'Esta página no funciona abriéndola con doble clic. Ábranla desde ' +
				'la dirección que les compartió el Comité.', 'err');
			$('#tv-entrar').disabled = true;
			return;
		}

		Promise.all([getJSON(CONFIG_URL), cargarGrupos()])
			.then(function (r) {
				CFG = r[0] || {};
				pintarIntro();

				if (!r[1] || !r[1].length) {
					msg('#tv-intro-msg',
						'No pudimos cargar la lista de grupos. Recarguen la página; si sigue ' +
						'vacía, avisen al Comité.', 'err');
					$('#tv-entrar').disabled = true;
					return null;
				}

				if (!CFG.appsScriptUrl) {
					msg('#tv-intro-msg',
						'La trivia todavía no está habilitada. Falta configurar el backend ' +
						'en includes/data/trivia.json.', 'warn');
					$('#tv-entrar').disabled = true;
				}

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

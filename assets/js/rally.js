/* ============================================================
   VIII RALLY VIRTUAL — Interacción arcade
   Sin dependencias externas.
   ============================================================ */
(function () {
	'use strict';

	// Fecha y hora de arranque del evento (CDMX, UTC-6 todo el año desde 2022)
	var EVENT_START = new Date('2026-09-05T12:00:00-06:00');

	var doc = document;
	var reduceMotion = window.matchMedia &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ------------------------------------------------------------
	   Campo de estrellas
	   ------------------------------------------------------------ */
	function initStars() {
		var canvas = doc.getElementById('stars');
		if (!canvas || reduceMotion) return;

		var ctx = canvas.getContext && canvas.getContext('2d');
		if (!ctx) return;

		var stars = [];
		var raf = null;

		function resize() {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			var count = Math.min(150, Math.floor(canvas.width * canvas.height / 11000));
			stars = [];
			for (var i = 0; i < count; i++) {
				stars.push({
					x: Math.random() * canvas.width,
					y: Math.random() * canvas.height,
					r: Math.random() * 1.5 + 0.3,
					s: Math.random() * 0.22 + 0.04,
					a: Math.random()
				});
			}
		}

		function draw() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < stars.length; i++) {
				var st = stars[i];
				st.y -= st.s;
				st.a += 0.015;
				if (st.y < -2) { st.y = canvas.height + 2; st.x = Math.random() * canvas.width; }
				ctx.globalAlpha = 0.35 + Math.abs(Math.sin(st.a)) * 0.55;
				ctx.fillStyle = i % 7 === 0 ? '#00e5ff' : '#ffffff';
				ctx.fillRect(st.x, st.y, st.r, st.r);
			}
			ctx.globalAlpha = 1;
			raf = requestAnimationFrame(draw);
		}

		window.addEventListener('resize', resize);
		resize();
		draw();

		// Pausa el canvas cuando la pestaña no está visible
		doc.addEventListener('visibilitychange', function () {
			if (doc.hidden) {
				if (raf) { cancelAnimationFrame(raf); raf = null; }
			} else if (!raf) {
				draw();
			}
		});
	}

	/* ------------------------------------------------------------
	   Pantalla de arranque
	   ------------------------------------------------------------ */
	function initBoot() {
		var boot = doc.getElementById('boot');
		var log = doc.getElementById('boot-log');
		var btn = doc.getElementById('start-btn');
		if (!boot) return;

		var lines = [
			'AGSMAC SYSTEM v8.0',
			'Cargando patrullas............. OK',
			'Cargando bases................. OK',
			'Conectando con el rincón....... OK',
			'Espíritu scout................. 100%',
			'',
			'LISTO PARA INICIAR'
		];

		if (log) {
			if (reduceMotion) {
				log.textContent = lines.join('\n');
			} else {
				var li = 0, ci = 0;
				(function type() {
					if (li >= lines.length) return;
					var line = lines[li];
					if (ci <= line.length) {
						log.textContent = lines.slice(0, li).join('\n') +
							(li > 0 ? '\n' : '') + line.slice(0, ci) + '_';
						ci++;
						setTimeout(type, 16);
					} else {
						log.textContent = lines.slice(0, li + 1).join('\n');
						li++; ci = 0;
						setTimeout(type, 90);
					}
				})();
			}
		}

		var started = false;
		function start() {
			if (started) return;
			started = true;
			boot.classList.add('done');
			doc.body.classList.remove('locked');
			setTimeout(function () { boot.style.display = 'none'; }, 700);
		}

		if (btn) btn.addEventListener('click', start);
		boot.addEventListener('click', start);
		doc.addEventListener('keydown', function (e) {
			// No arrancar si el aviso de materiales está abierto encima
			var mat = doc.getElementById('mat-modal');
			if (mat && mat.classList.contains('open')) return;
			if (!started && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); start(); }
		});
	}

	/* ------------------------------------------------------------
	   Cuenta regresiva
	   ------------------------------------------------------------ */
	function initCountdown() {
		var d = doc.getElementById('cd-d');
		var h = doc.getElementById('cd-h');
		var m = doc.getElementById('cd-m');
		var s = doc.getElementById('cd-s');
		var box = doc.getElementById('countdown');
		if (!d || !h || !m || !s) return;

		function pad(n) { return n < 10 ? '0' + n : '' + n; }

		function tick() {
			var diff = EVENT_START.getTime() - Date.now();

			if (diff <= 0) {
				if (box) {
					box.innerHTML = '<div class="tbox" style="min-width:auto;padding:8px 14px">' +
						'<b style="color:var(--magenta)">¡EN CURSO!</b></div>';
				}
				return;
			}

			var sec = Math.floor(diff / 1000);
			d.textContent = pad(Math.floor(sec / 86400));
			h.textContent = pad(Math.floor(sec % 86400 / 3600));
			m.textContent = pad(Math.floor(sec % 3600 / 60));
			s.textContent = pad(sec % 60);

			setTimeout(tick, 1000);
		}

		tick();
	}

	/* ------------------------------------------------------------
	   Aparición de paneles al hacer scroll
	   ------------------------------------------------------------ */
	function initReveal() {
		var panels = doc.querySelectorAll('.panel');
		if (!panels.length) return;

		if (reduceMotion || !('IntersectionObserver' in window)) {
			for (var i = 0; i < panels.length; i++) panels[i].classList.add('visible');
			return;
		}

		var obs = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add('visible');
					obs.unobserve(entry.target);
				}
			});
		}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

		for (var j = 0; j < panels.length; j++) obs.observe(panels[j]);
	}

	/* ------------------------------------------------------------
	   Copiar datos bancarios
	   ------------------------------------------------------------ */
	function initCopy() {
		var toast = doc.getElementById('toast');
		var timer = null;

		function showToast(msg) {
			if (!toast) return;
			toast.textContent = msg;
			toast.classList.add('show');
			clearTimeout(timer);
			timer = setTimeout(function () { toast.classList.remove('show'); }, 1600);
		}

		function fallbackCopy(text) {
			var ta = doc.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			doc.body.appendChild(ta);
			ta.select();
			var ok = false;
			try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
			doc.body.removeChild(ta);
			return ok;
		}

		var btns = doc.querySelectorAll('.copy-btn');
		for (var i = 0; i < btns.length; i++) {
			btns[i].addEventListener('click', function () {
				var self = this;
				var text = self.getAttribute('data-target') || '';
				if (!text) return;

				function done(ok) {
					if (ok) {
						self.classList.add('ok');
						self.textContent = 'LISTO';
						showToast('COPIADO');
						setTimeout(function () {
							self.classList.remove('ok');
							self.textContent = 'COPIAR';
						}, 1600);
					} else {
						showToast('SELECCIÓNALO MANUALMENTE');
					}
				}

				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text)
						.then(function () { done(true); })
						.catch(function () { done(fallbackCopy(text)); });
				} else {
					done(fallbackCopy(text));
				}
			});
		}
	}

	/* ------------------------------------------------------------
	   Controles del HUD
	   ------------------------------------------------------------ */
	function initHudTools() {
		var fxBtn = doc.getElementById('fx-btn');

		if (fxBtn) {
			fxBtn.addEventListener('click', function () {
				var off = doc.documentElement.classList.toggle('no-fx');
				fxBtn.textContent = off ? 'FX: OFF' : 'FX: ON';
				fxBtn.setAttribute('aria-pressed', off ? 'false' : 'true');
			});
		}
	}

	/* ------------------------------------------------------------
	   Aviso emergente de materiales
	   ------------------------------------------------------------ */
	function initMaterialsModal() {
		var modal = doc.getElementById('mat-modal');
		if (!modal) return;

		var openBtn = doc.getElementById('mat-btn');
		var lastFocus = null;

		function open() {
			if (modal.classList.contains('open')) return;
			lastFocus = doc.activeElement;
			modal.hidden = false;
			doc.body.classList.add('locked');
			// Fuerza un reflow para que la transición de entrada corra
			void modal.offsetWidth;
			modal.classList.add('open');
			var ok = modal.querySelector('.mat-ok');
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

		var closers = modal.querySelectorAll('[data-mat-close]');
		for (var i = 0; i < closers.length; i++) {
			closers[i].addEventListener('click', close);
		}

		doc.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && modal.classList.contains('open')) close();
		});

		if (openBtn) openBtn.addEventListener('click', open);

		// Se despliega desde la pantalla de arranque, encima de ella
		setTimeout(open, 600);
	}

	/* ------------------------------------------------------------
	   Arranque
	   ------------------------------------------------------------ */
	function init() {
		initStars();
		initBoot();
		initCountdown();
		initReveal();
		initCopy();
		initHudTools();
		initMaterialsModal();
	}

	if (doc.readyState === 'loading') {
		doc.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

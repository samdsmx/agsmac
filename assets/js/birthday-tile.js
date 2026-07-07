/* Animación de cumpleaños embebida en el tile.
   - Reemplaza la animación original en Flash (birthday.swf).
   - Muestra los nombres apareciendo letra por letra mientras globos suben.
   - Fuente principal: Apps Script Web App (ver docs/apps-script-combinado.gs, ?tipo=cumpleanos).
   - Fallback: lista 'birthdays' inline en includes/data/cumpleanos.json.
   - Último recurso: mensaje genérico si nada carga.
*/
(function () {
	'use strict';

	// Mensaje genérico de último recurso (si falla incluso el JSON local).
	// No son cumpleañeros reales — solo evita que el tile se vea roto.
	var LAST_RESORT = [{ name: '¡Feliz cumpleaños!', group: '' }];

	var DEFAULT_RANGE_DAYS = 20;

	var BALLOON_COLORS = ['#f1c40f', '#e74c3c', '#3aa6ff', '#2ecc71', '#f39c12', '#ff5b8a', '#9b59b6'];

	// === Filtrado por ventana de fechas ===========================================
	function dayOfYear(date) {
		var start = new Date(date.getFullYear(), 0, 1);
		return Math.floor((date - start) / 86400000) + 1;
	}

	function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }
	function yearLength(y) { return isLeap(y) ? 366 : 365; }

	// Distancia mínima en días (circular en el año) entre hoy y un mes/día
	function daysDistance(month, day) {
		var now = new Date();
		// Soporta 29-feb en años no bisiestos colapsando a 28-feb.
		var bdDay = day;
		if (month === 2 && day === 29 && !isLeap(now.getFullYear())) bdDay = 28;
		var bday = new Date(now.getFullYear(), month - 1, bdDay);
		var todayDoy = dayOfYear(now);
		var bdayDoy = dayOfYear(bday);
		var diff = bdayDoy - todayDoy;
		var len = yearLength(now.getFullYear());
		// Tomar la distancia circular mínima
		if (diff > len / 2) diff -= len;
		else if (diff < -len / 2) diff += len;
		return diff; // positivo = en el futuro; negativo = en el pasado
	}

	function filterByWindow(entries, rangeDays) {
		var withDates = entries.filter(function (e) {
			return Number.isFinite(Number(e.month)) && Number.isFinite(Number(e.day));
		});
		if (!withDates.length) return entries; // sin fechas, devolver todo
		var inWindow = withDates.filter(function (e) {
			var d = daysDistance(Number(e.month), Number(e.day));
			return Math.abs(d) <= rangeDays;
		});
		// Ordenar por proximidad a hoy (los más próximos primero)
		inWindow.sort(function (a, b) {
			return Math.abs(daysDistance(a.month, a.day)) - Math.abs(daysDistance(b.month, b.day));
		});
		return inWindow;
	}

	// === Carga desde Apps Script Web App ==========================================
	function loadFromAppsScript(url) {
		return fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'follow' })
			.then(function (r) {
				if (!r.ok) throw new Error('Apps Script fetch failed: ' + r.status);
				return r.json();
			})
			.then(function (data) {
				var arr = Array.isArray(data) ? data : (data && data.birthdays) || [];
				return arr
					.map(function (e) {
						return { name: (e.name || '').trim(), group: (e.group || '').trim() };
					})
					.filter(function (e) { return e.name; });
			});
	}

	function shuffle(arr) {
		var a = arr.slice();
		for (var i = a.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
		}
		return a;
	}

	function formatEntry(e) {
		var name = (e.name || '').trim();
		var rawGroup = (e.group === 0 || e.group) ? String(e.group).trim() : '';
		if (!rawGroup) return name;
		// Prefijar "Gpo. " si solo viene el número/identificador.
		var group = /^(gpo\.?|grupo)\s/i.test(rawGroup) ? rawGroup : 'Gpo. ' + rawGroup;
		// El grupo siempre va en la segunda línea para consistencia visual.
		return name + '\n' + group;
	}

	function typeText(el, text, charMs) {
		return new Promise(function (resolve) {
			el.innerHTML = '';
			var i = 0;
			function step() {
				if (i >= text.length) { setTimeout(resolve, 200); return; }
				var ch = text.charAt(i++);
				if (ch === '\n') {
					el.appendChild(document.createElement('br'));
					setTimeout(step, Math.max(charMs, 120));
					return;
				}
				var span = document.createElement('span');
				span.className = 'bd-char';
				if (ch === ' ') {
					span.innerHTML = '&nbsp;';
					span.classList.add('bd-space');
				} else {
					span.textContent = ch;
				}
				el.appendChild(span);
				/* eslint-disable no-unused-expressions */
				span.offsetWidth;
				/* eslint-enable no-unused-expressions */
				span.classList.add('bd-in');
				setTimeout(step, charMs);
			}
			step();
		});
	}

	function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

	function fitTextSize(wrap, textEl, text) {
		var maxFont = 56;
		var minFont = 10;
		var available = wrap.clientWidth - 16;
		if (available <= 0) available = 260;
		var maxHeight = wrap.clientHeight;

		var probe = document.createElement('div');
		probe.className = 'bd-text bd-probe';
		probe.style.visibility = 'hidden';
		probe.style.position = 'absolute';
		probe.style.left = '-9999px';
		probe.style.whiteSpace = 'nowrap';
		var parts = String(text).split('\n');
		parts.forEach(function (p, i) {
			if (i > 0) probe.appendChild(document.createElement('br'));
			probe.appendChild(document.createTextNode(p));
		});
		wrap.appendChild(probe);

		var size = maxFont;
		while (size > minFont) {
			probe.style.fontSize = size + 'px';
			var fitsWidth  = probe.scrollWidth  <= available + 1;
			var fitsHeight = !maxHeight || maxHeight <= 0 || probe.scrollHeight <= maxHeight + 1;
			if (fitsWidth && fitsHeight) break;
			size -= 1;
		}
		var finalHeight = probe.scrollHeight;
		wrap.removeChild(probe);
		textEl.style.fontSize = size + 'px';
		textEl.style.minHeight = finalHeight + 'px';
	}

	function spawnBalloon(layer) {
		var stageH = layer.clientHeight || 180;
		var size = 18 + Math.random() * 22;            // 18-40 px
		var color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
		var leftPct = 5 + Math.random() * 90;
		var duration = 5 + Math.random() * 5;          // 5-10s
		var sway = (Math.random() * 30 + 10).toFixed(1);
		var rise = (stageH + size * 4).toFixed(0);

		var b = document.createElement('div');
		b.className = 'bd-balloon';
		b.style.left = leftPct + '%';
		b.style.setProperty('--bd-rise', '-' + rise + 'px');
		b.style.setProperty('--bd-sway', sway + 'px');
		b.style.setProperty('--bd-dur', duration + 's');
		b.innerHTML =
			'<svg viewBox="0 0 40 60" width="' + size + '" height="' + (size * 1.5) + '" aria-hidden="true">' +
				'<ellipse cx="20" cy="22" rx="16" ry="20" fill="' + color + '"/>' +
				'<path d="M16 41 L20 46 L24 41 Z" fill="' + color + '"/>' +
				'<path d="M20 46 Q22 52 19 58" stroke="rgba(255,255,255,0.55)" stroke-width="1" fill="none"/>' +
				'<ellipse cx="14" cy="14" rx="3" ry="5" fill="rgba(255,255,255,0.35)"/>' +
			'</svg>';
		layer.appendChild(b);
		setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, duration * 1000 + 200);
	}

	function startBalloons(backLayer, frontLayer) {
		function loop() {
			// ~30% al frente, 70% al fondo
			var layer = Math.random() < 0.3 ? frontLayer : backLayer;
			spawnBalloon(layer);
			setTimeout(loop, 350 + Math.random() * 800);
		}
		loop();
	}

	function startTyping(textEl, entries, wrap) {
		var queue = shuffle(entries);
		var idx = 0;
		(function next() {
			if (queue.length === 0) return;
			var entry = queue[idx % queue.length];
			idx++;
			if (idx % queue.length === 0) queue = shuffle(entries);
			var text = formatEntry(entry);
			fitTextSize(wrap, textEl, text);
			textEl.classList.remove('bd-fade-out');
			typeText(textEl, text, 70)
				.then(function () { return wait(2200); })
				.then(function () {
					textEl.classList.add('bd-fade-out');
					return wait(700);
				})
				.then(next);
		})();
	}

	function buildTile(tile) {
		tile.classList.add('birthday-tile');
		tile.innerHTML =
			'<div class="bd-stage">' +
				'<div class="bd-balloons bd-balloons-back" aria-hidden="true"></div>' +
				'<div class="bd-text-wrap">' +
					'<div class="bd-text" aria-live="polite"></div>' +
				'</div>' +
				'<div class="bd-balloons bd-balloons-front" aria-hidden="true"></div>' +
				'<div class="bd-label"><i class="fa fa-birthday-cake"></i>¡Feliz Cumpleaños!</div>' +
			'</div>';

		var textEl = tile.querySelector('.bd-text');
		var textWrap = tile.querySelector('.bd-text-wrap');
		var balloonsBack = tile.querySelector('.bd-balloons-back');
		var balloonsFront = tile.querySelector('.bd-balloons-front');

		function startWith(entries, rangeDays) {
			var filtered = filterByWindow(entries, rangeDays || DEFAULT_RANGE_DAYS);
			if (!filtered.length) filtered = entries; // si no hay nadie en la ventana, mostrar todos
			startTyping(textEl, filtered, textWrap);
			startBalloons(balloonsBack, balloonsFront);
		}

		fetch('includes/data/cumpleanos.json', { cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (cfg) {
				cfg = cfg || {};
				var rangeDays = Number(cfg.rangeDays) || DEFAULT_RANGE_DAYS;
				var inline = (Array.isArray(cfg.birthdays) && cfg.birthdays.length) ? cfg.birthdays : LAST_RESORT;

				if (cfg.appsScriptUrl) {
					loadFromAppsScript(cfg.appsScriptUrl)
						.then(function (entries) {
							var list = entries.length ? entries : filterByWindow(inline, rangeDays);
							if (!list.length) list = inline;
							startTyping(textEl, list, textWrap);
							startBalloons(balloonsBack, balloonsFront);
						})
						.catch(function (err) {
							if (window.console) console.warn('[birthday-tile] Falló carga de Apps Script, usando lista local:', err);
							startWith(inline, rangeDays);
						});
				} else {
					startWith(inline, rangeDays);
				}
			})
			.catch(function () { startWith(LAST_RESORT, DEFAULT_RANGE_DAYS); });
	}

	function ready(fn) {
		if (document.readyState !== 'loading') fn();
		else document.addEventListener('DOMContentLoaded', fn);
	}

	ready(function () {
		var tiles = document.querySelectorAll('[data-birthday-anim]');
		tiles.forEach(buildTile);
	});
})();

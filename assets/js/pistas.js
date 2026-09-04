/* ===== Marcadores de rastreo ===============================================
   Pequeños marcadores discretos repartidos por el sitio. Cada uno guarda un
   dato que se revela al tocarlo, y lleva un contador de cuántos van.

   El contenido va codificado en `data-pista-clave` (no en claro) para que no
   se pueda leer de un vistazo en el código fuente ni encontrarse buscando en
   el repositorio. Es solo ofuscación, no seguridad: al ser código de cliente
   siempre es reversible por alguien que se lo proponga. Lo que de verdad
   importa se valida en el servidor, nunca aquí.

   Detalles de implementación:
   - El click se atiende por DELEGACIÓN en `document`. Es obligatorio: los
     contenidos de las páginas internas se inyectan de forma asíncrona por el
     atributo `includedHtml` (ver assets/js/main.js), así que al cargar el
     script los marcadores todavía no existen en el DOM. Por lo mismo hay un
     MutationObserver.
   - Lo encontrado se guarda en localStorage para que el contador siga vivo
     al navegar entre páginas.
   - No cuelgues un marcador de un nodo que algún *.js reescriba con
     `innerHTML` o `textContent`: desaparecería al renderizar.

   Cómo agregar uno (la nota de mantenimiento con las claves se guarda fuera
   del repositorio):
     <span class="pista-oculta" data-pista-orden="9" data-pista-clave="xx"></span>
   ========================================================================== */
(function () {
	'use strict';

	var TOTAL_PISTAS = 8;
	var STORAGE_KEY = 'agsmac.pistas.encontradas';

	/* Inversa de: (codigoDelCaracter + orden * 13) expresado en base 36. */
	function descifrar(clave, orden) {
		var n = parseInt(String(clave || ''), 36);
		if (!isFinite(n)) return '';
		var c = n - orden * 13;
		if (c < 32 || c > 126) return '';
		return String.fromCharCode(c);
	}

	function leerEncontradas() {
		try {
			var raw = window.localStorage.getItem(STORAGE_KEY);
			var arr = raw ? JSON.parse(raw) : [];
			return Array.isArray(arr) ? arr : [];
		} catch (e) {
			return [];
		}
	}

	function guardarEncontrada(orden) {
		try {
			var arr = leerEncontradas();
			if (arr.indexOf(orden) === -1) {
				arr.push(orden);
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
			}
			return arr;
		} catch (e) {
			return [orden];
		}
	}

	function textoNota(orden, encontradas) {
		var n = encontradas.length;
		var base = 'señal ' + orden;
		if (n >= TOTAL_PISTAS) return base + ' · ¡las tienes todas!';
		return base + ' · llevas ' + n + '/' + TOTAL_PISTAS;
	}

	function revelar(el) {
		if (el.classList.contains('revelada')) return;

		var orden = Number(el.getAttribute('data-pista-orden')) || 0;
		var letra = descifrar(el.getAttribute('data-pista-clave'), orden);

		/* El CSS pinta el contenido con content: attr(data-pista-letra), así que
		   el atributo se escribe apenas al revelar: en el HTML que sirve GitHub
		   Pages nunca aparece en claro. */
		if (letra) el.setAttribute('data-pista-letra', letra);
		el.classList.add('revelada');

		if (!orden) return;

		var encontradas = guardarEncontrada(orden);
		var nota = document.createElement('span');
		nota.className = 'pista-oculta-nota';
		nota.textContent = textoNota(orden, encontradas);
		if (el.parentNode) el.parentNode.insertBefore(nota, el.nextSibling);
	}

	/* Marca como revelados los marcadores de esta página que ya se habían
	   encontrado antes, para que el estado no se pierda al recargar. */
	function restaurar() {
		var encontradas = leerEncontradas();
		if (!encontradas.length) return;
		var nodos = document.querySelectorAll('.pista-oculta');
		Array.prototype.forEach.call(nodos, function (el) {
			var orden = Number(el.getAttribute('data-pista-orden')) || 0;
			if (orden && encontradas.indexOf(orden) !== -1) revelar(el);
		});
	}

	document.addEventListener('click', function (e) {
		var el = e.target && e.target.closest && e.target.closest('.pista-oculta');
		if (!el) return;
		e.preventDefault();
		revelar(el);
	});

	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
		var el = document.activeElement;
		if (!el || !el.classList || !el.classList.contains('pista-oculta')) return;
		e.preventDefault();
		revelar(el);
	});

	function preparar() {
		var nodos = document.querySelectorAll('.pista-oculta:not([data-pista-lista])');
		if (!nodos.length) return;
		Array.prototype.forEach.call(nodos, function (el) {
			el.setAttribute('data-pista-lista', '1');
			el.setAttribute('role', 'button');
			el.setAttribute('tabindex', '0');
			el.setAttribute('aria-label', 'Marcador');
		});
		restaurar();
	}

	function iniciar() {
		preparar();
		if (window.MutationObserver) {
			new MutationObserver(preparar).observe(document.body, {
				childList: true, subtree: true
			});
		}
	}

	if (document.readyState !== 'loading') iniciar();
	else document.addEventListener('DOMContentLoaded', iniciar);
})();

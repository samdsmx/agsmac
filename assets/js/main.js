/* main.js */

/* Función de las peticiones asíncronas */
function includeHTML(elmnt) {
       var file = elmnt.getAttribute("includedHtml");
	if (file) {
		// Quitamos un eventual '/' inicial para que la URL sea relativa al
		// directorio donde se sirve el sitio (funciona tanto en localhost
		// como en GitHub Pages con o sin subruta).
		if (file.charAt(0) === '/') file = file.substring(1);
		return $.ajax({
			url: file,
			type:'get',
			success: function ( html ) {
				console.log("Se carga componente");
				elmnt.innerHTML = html;
			},
			error: function () {
				// TODO: Configuraciones de componente de muestra de error
			}
		});
	}
}

/* Funcion para la inclusión de html en los elementos marcados. */
function getAllIncludedHtml(){
	var promises = [];
	var elementos = $('[includedHtml]');
	for( var i = 0; i<elementos.length; i++){
		var dfrt = includeHTML(elementos[i]);
		promises.push( dfrt );
	}
	$.when.apply($,promises).done( function () {
		$.each( $('[includedHtml]'), function(i,e){
			e.setAttribute("includedHtml", undefined);
		} );
	}).then(function(){
		afterIncluded();
	});
}

// En esta función haremos lo que se espera que se haga en el script inicial.
function afterIncluded(){
	/*
    	Radius by TEMPLATED
    	templated.co @templatedco
    	Released for free under the Creative Commons Attribution 3.0 license (templated.co/license)
	*/
	skel.breakpoints({
		xlarge:	'(max-width: 1680px)',
		large:	'(max-width: 1280px)',
		medium:	'(max-width: 980px)',
		small:	'(max-width: 736px)',
		xsmall:	'(max-width: 480px)'
	});

	// Este arreglo tendra el registro de todos los divs emergentes
	// que hayan sido clickeados.
	// Aqui solo debe de albergar uno
	// esto con el fin de 	llevar el control para cuando se clicke en el documento
	var imagenesClick = [];

	var	$window = $(window),
		$body = $('body'),
		$header = $('#header'),
		$footer = $('#footer');

	// Disable animations/transitions until the page has loaded.
	$body.addClass('is-loading');

	$window.on('load', function() {
		window.setTimeout(function() {
			$body.removeClass('is-loading');
		}, 100);
	});

	// Fix: Placeholder polyfill.
	$('form').placeholder();

	// Prioritize "important" elements on medium.
	skel.on('+medium -medium', function() {
		$.prioritize(
			'.important\\28 medium\\29',
			skel.breakpoint('medium').active
		);
	});

	// Header.
	$header.each( function() {
		var t 		= jQuery(this),
			button 	= t.find('.button');

		// Si el usuario ya vio el círculo de bienvenida en esta sesión,
		// lo ocultamos de inmediato (evita que reaparezca al volver al Home).
		try {
			if (!t.hasClass('preview') && sessionStorage.getItem('agsmacWelcomeSeen')) {
				t.addClass('hide');
			}
		} catch (err) { /* sessionStorage puede no estar disponible */ }

		function marcarVisto() {
			try { sessionStorage.setItem('agsmacWelcomeSeen', '1'); } catch (err) {}
		}

		button.click(function(e) {
			t.toggleClass('hide');
			if (t.hasClass('hide')) { marcarVisto(); }
			if ( t.hasClass('preview') ) {
				return true;
			} else {
				e.preventDefault();
			}
		});

		// Permitir cerrar el círculo de bienvenida haciendo clic fuera de él.
		t.on('click', function(e) {
			if (t.hasClass('hide') || t.hasClass('preview')) { return; }
			if (!jQuery(e.target).closest('.inner').length) {
				t.addClass('hide');
				marcarVisto();
			}
		});
	});

	var $sectionBackdrop = $('<div class="section-dialog-backdrop" aria-hidden="true"></div>').appendTo('body');
	var $ultimoDisparadorSeccion = $();
	var sectionDialogTimer = null;

	function seleccionarPanelSeccion($circle, indice, direccion) {
		var $panels = $circle.find('.interno > .contenido > .section-dialog-panel');
		var $buttons = $circle.find('.section-dialog-nav button');
		var indiceActual = $buttons.index($buttons.filter('.is-active').first());
		if (!$panels.length) { return; }
		if (indice < 0 || indice >= $panels.length) { indice = 0; }
		if (indiceActual === indice && $panels.eq(indice).hasClass('is-active')) { return; }
		if (!direccion && indiceActual >= 0) { direccion = indice > indiceActual ? 1 : -1; }

		$buttons.removeClass('is-active').attr({
			'aria-selected': 'false',
			'tabindex': '-1'
		});
		$buttons.eq(indice).addClass('is-active').attr({
			'aria-selected': 'true',
			'tabindex': '0'
		});

		$panels
			.removeClass('is-active panel-enter-left panel-enter-right')
			.attr('hidden', 'hidden');
		$panels.eq(indice)
			.addClass('is-active' + (direccion ? (direccion > 0 ? ' panel-enter-right' : ' panel-enter-left') : ''))
			.removeAttr('hidden')
			.scrollTop(0);
	}

	function moverPanelSeccion($circle, direccion) {
		var $buttons = $circle.find('.section-dialog-nav button');
		var actual = $buttons.index($buttons.filter('.is-active').first());
		var siguiente;
		if (!$buttons.length) { return; }
		if (actual < 0) { actual = 0; }
		siguiente = (actual + direccion + $buttons.length) % $buttons.length;
		seleccionarPanelSeccion($circle, siguiente, direccion);
	}

	function finalizarCierreCirculos($circles, devolverFoco) {
		$circles
			.removeClass('show is-opening is-closing')
			.addClass('hide')
			.children('.content')
			.attr('aria-hidden', 'true');
		$body.removeClass('section-dialog-open');

		if (devolverFoco && $ultimoDisparadorSeccion.length) {
			window.setTimeout(function () {
				$ultimoDisparadorSeccion.trigger('focus');
			}, 0);
		}
	}

	function cerrarCirculos(devolverFoco, inmediato) {
		var $abiertos = $('.mostrarInfoH.show');
		if (!$abiertos.length) { return; }
		if (sectionDialogTimer) {
			window.clearTimeout(sectionDialogTimer);
			sectionDialogTimer = null;
		}
		$sectionBackdrop.removeClass('is-visible').attr('aria-hidden', 'true');
		if (inmediato) {
			finalizarCierreCirculos($abiertos, devolverFoco);
			return;
		}
		$abiertos.removeClass('is-opening').addClass('is-closing');
		sectionDialogTimer = window.setTimeout(function () {
			finalizarCierreCirculos($abiertos, devolverFoco);
			sectionDialogTimer = null;
		}, 560);
	}

	function abrirCirculo($circle) {
		cerrarCirculos(false, true);
		seleccionarPanelSeccion($circle, 0, 0);
		$circle.removeClass('hide is-closing').addClass('show is-opening');
		$circle.children('.content').attr('aria-hidden', 'false');
		$sectionBackdrop.addClass('is-visible').attr('aria-hidden', 'false');
		$body.addClass('section-dialog-open');
		window.setTimeout(function () {
			$circle.removeClass('is-opening');
		}, 720);
		window.setTimeout(function () {
			$circle.find('.circle-close').trigger('focus');
		}, 380);
	}

	$sectionBackdrop.on('click', function () {
		cerrarCirculos(true);
	});

	$(document).off('keydown.sectionDialog').on('keydown.sectionDialog', function (e) {
		var $circle = $('.mostrarInfoH.show').first();
		if (e.key === 'Escape' && $circle.length) {
			e.preventDefault();
			cerrarCirculos(true);
		} else if ($circle.length && e.key === 'ArrowLeft' && !$(e.target).is('input, textarea, select')) {
			e.preventDefault();
			moverPanelSeccion($circle, -1);
		} else if ($circle.length && e.key === 'ArrowRight' && !$(e.target).is('input, textarea, select')) {
			e.preventDefault();
			moverPanelSeccion($circle, 1);
		}
	});

	//Efecto imágenes laterales
	$('.mostrarInfoH').each( function(indiceCirculo) {
		var t 		= jQuery(this);
		var enlace 	= t.children('.mostrarMas').not('.interno');
		var $content = t.children('.content');
		var $title = $content.children('h2').first();
		var $interno = $content.children('.interno').first();
		var $panels = $interno.children('.contenido').children('div');
		var $leftArrow = $interno.children('.leftArrow').detach().appendTo($content);
		var $rightArrow = $interno.children('.rigthArrow').detach().appendTo($content);
		var $emblema = $panels.first().find('.seccion-decor').first().detach();
		var tituloId = 'section-dialog-title-' + indiceCirculo;
		var etiquetas = ['Información', 'Promesa y Ley', $content.hasClass('SD') ? 'Formación' : 'Adelanto'];

		if (!$title.length) { $title = $content.children('h1, h2').first(); }
		$title.attr('id', tituloId);
		$content.attr({
			'role': 'dialog',
			'aria-modal': 'true',
			'aria-labelledby': tituloId,
			'aria-hidden': 'true'
		});

		if ($title.length && !$title.find('.circle-close').length) {
			$title.append('<button type="button" class="circle-close" aria-label="Cerrar">&times;</button>');
		}
		if ($emblema.length) {
			$emblema
				.addClass('section-dialog-emblem')
				.attr('aria-hidden', 'true')
				.appendTo($content);
		}

		$panels.addClass('section-dialog-panel').each(function(indicePanel) {
			var panelId = 'section-dialog-panel-' + indiceCirculo + '-' + indicePanel;
			$(this).attr({
				'id': panelId,
				'role': 'tabpanel',
				'aria-labelledby': 'section-dialog-tab-' + indiceCirculo + '-' + indicePanel
			});
		});

		$leftArrow.add($rightArrow).attr({
			'role': 'button',
			'tabindex': '0'
		});
		$leftArrow.attr('aria-label', 'Contenido anterior');
		$rightArrow.attr('aria-label', 'Contenido siguiente');

		if ($interno.length && !$interno.children('.section-dialog-nav').length) {
			var $nav = $('<div class="section-dialog-nav" role="tablist" aria-label="Contenido de la sección"></div>');
			$panels.each(function(indicePanel) {
				var etiqueta = etiquetas[indicePanel] || ('Sección ' + (indicePanel + 1));
				var panelId = $(this).attr('id');
				$('<button type="button" role="tab"></button>')
					.text(etiqueta)
					.attr({
						'id': 'section-dialog-tab-' + indiceCirculo + '-' + indicePanel,
						'aria-controls': panelId
					})
					.on('click', function() {
						seleccionarPanelSeccion(t, indicePanel, 0);
					})
					.appendTo($nav);
			});
			$nav.insertBefore($interno.children('.contenido').first());
		}

		seleccionarPanelSeccion(t, 0, 0);

		$leftArrow
			.off('.sectionDialog')
			.on('click.sectionDialog', function() {
				moverPanelSeccion(t, -1);
			})
			.on('keydown.sectionDialog', function(e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					moverPanelSeccion(t, -1);
				}
			});
		$rightArrow
			.off('.sectionDialog')
			.on('click.sectionDialog', function() {
				moverPanelSeccion(t, 1);
			})
			.on('keydown.sectionDialog', function(e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					moverPanelSeccion(t, 1);
				}
			});

		$content.find('.circle-close').on('click', function(e){
			e.preventDefault();
			e.stopPropagation();
			cerrarCirculos(true);
		});
		enlace.on('click', function(e){
			e.preventDefault();
			e.stopPropagation();
			$ultimoDisparadorSeccion = $(this).find('a, button').first();
			if (!$ultimoDisparadorSeccion.length) { $ultimoDisparadorSeccion = $(this); }
			abrirCirculo(t);
		} );
	} );
	// Footer.
	$footer.each( function() {
		var t 		= jQuery(this),
			inner 	= t.find('.inner'),
			button 	= t.find('.info');
		button.click(function(e) {
			t.toggleClass('show');
			e.preventDefault();
		});
	});
	afterAfterInclude();
}

function afterAfterInclude(){
	$('.str3').liMarquee({
		direction: 'left',
		loop: -1,
		scrolldelay: 0,
		scrollamount: 100,
		circular: true,
		drag: true,
		touchEvent: true
	});
	// Seleccionar por default el primer tab (Promesa) en cada contenedorTabs
	$('.contenedorTabs').each(function () {
		var firstBtn = $(this).find('.tablinks').first();
		var firstContent = $(this).find('.tabcontent, .tabcontent-small').first();
		if (firstBtn.length && !firstBtn.hasClass('active')) {
			firstBtn.addClass('active');
		}
		if (firstContent.length) {
			firstContent.css('display', 'block');
		}
	});
	// declaramos el funcionamiento gral. del boton para esconder el dialog
	$("#panioletaSearcher").on('click', '.btn-cerrar', function(e){
		e.preventDefault();
		$("#panioletaSearcher").addClass('hide');
	});

	// Cerrar al hacer click sobre el fondo (fuera de la tarjeta)
	$("#panioletaSearcher").on('click', function(e){
		if (e.target === this) {
			$(this).addClass('hide');
		}
	});

	// --- Helpers para la tarjeta de grupo ---
	function findGrupoByKey(grupoKey){
		var found = null;
		if (!grupos) return null;
		$.each(grupos, function(estado, lista){
			$.each(lista, function(nombre, info){
				if (nombre === grupoKey) {
					found = { estado: estado, nombre: nombre, info: info };
					return false;
				}
			});
			if (found) return false;
		});
		return found;
	}

	function findEstadoOfGrupo(grupoKey){
		var match = findGrupoByKey(grupoKey);
		return match ? match.estado : null;
	}

	function rellenarSelectGrupos(estadoSeleccionado){
		$("#grupos").empty();
		$.each(grupos, function(estado){
			var sel = (estado === estadoSeleccionado) ? " selected" : "";
			$("#grupos").append("<option value='"+estado+"'"+sel+">"+estado+"</option>");
		});
	}

	function rellenarSelectSubgrupos(estado, grupoSeleccionado){
		$("#subgrupos").empty();
		if (!grupos || !grupos[estado]) return;
		var keys = Object.keys(grupos[estado]);
		// Si el estado tiene más de un grupo, agrega el placeholder de selección.
		if (keys.length > 1) {
			$("#subgrupos").append("<option value=''>-- Selecciona un grupo --</option>");
		}
		$.each(grupos[estado], function(nombre){
			var sel = (nombre === grupoSeleccionado) ? " selected" : "";
			$("#subgrupos").append("<option value='"+nombre+"'"+sel+">"+nombre+"</option>");
		});
	}

	// Si el estado tiene un solo grupo, devuélvelo; si no, null.
	function unicoGrupoDe(estado){
		if (!grupos || !grupos[estado]) return null;
		var keys = Object.keys(grupos[estado]);
		return keys.length === 1 ? keys[0] : null;
	}

	function escapeHtml(str){
		if (str == null) return "";
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function renderGrupoCard(estado, grupoKey){
		var $title = $("#grupoCardTitulo");
		var $lema = $("#grupoLema");
		var $estado = $("#grupoEstado");
		var $escudo = $("#grupoEscudo");
		var $body = $("#contenidoBanderin");

		if (!grupoKey || !grupos || !grupos[estado] || !grupos[estado][grupoKey]) {
			$title.text("Selecciona un grupo");
			$lema.text("");
			$estado.text(estado || "");
			$escudo.attr("src", "").attr("alt", "").parent().addClass("empty");
			$body.html('<p class="grupo-card-empty">Selecciona un estado y un grupo para ver su información.</p>');
			return;
		}

		var info = grupos[estado][grupoKey];
		$title.text(grupoKey);
		$lema.text(info.nombre ? info.nombre : "");
		$estado.text(estado);

		var escudoSrc = info.escudo || info.panioleta || "";
		if (escudoSrc) {
			$escudo.attr("src", escudoSrc).attr("alt", "Escudo " + grupoKey).parent().removeClass("empty");
		} else {
			$escudo.attr("src", "").attr("alt", "").parent().addClass("empty");
		}

		var rows = [];
		function row(icon, label, value, isLink, hrefOverride){
			if (!value) return;
			var safeVal = escapeHtml(value);
			var content = safeVal;
			if (isLink) {
				var href = hrefOverride || value;
				content = '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' + safeVal + '</a>';
			}
			rows.push(
				'<li class="grupo-info-row">' +
					'<span class="grupo-info-icon"><i class="fa ' + icon + '"></i></span>' +
					'<span class="grupo-info-label">' + label + '</span>' +
					'<span class="grupo-info-value">' + content + '</span>' +
				'</li>'
			);
		}

		row("fa-user", "Jefe de Grupo", info.jefe);
		if (info.direccion) {
			if (info.mapsUrl) {
				rows.push(
					'<li class="grupo-info-row">' +
						'<span class="grupo-info-icon"><i class="fa fa-map-marker"></i></span>' +
						'<span class="grupo-info-label">Dirección</span>' +
						'<span class="grupo-info-value">' +
							'<a href="' + escapeHtml(info.mapsUrl) + '" target="_blank" rel="noopener">' +
								escapeHtml(info.direccion) +
								' <i class="fa fa-external-link"></i>' +
							'</a>' +
						'</span>' +
					'</li>'
				);
			} else {
				row("fa-map-marker", "Dirección", info.direccion);
			}
		}
		row("fa-clock-o", "Horario", info.horario);
		if (info.telefono) {
			var telHref = "tel:" + String(info.telefono).replace(/[^+\d]/g, "");
			row("fa-phone", "Teléfono", info.telefono, true, telHref);
		}
		row("fa-envelope", "Correo", info.correo, true, "mailto:" + info.correo);

		// Redes sociales: renderiza solo las que estén presentes.
		var redes = [
			{ key: "facebook",  icon: "fa fa-facebook-official", label: "Facebook"  },
			{ key: "instagram", icon: "fa fa-instagram",         label: "Instagram" },
			{ key: "tiktok",    icon: "icon-tiktok",             label: "TikTok"    },
			{ key: "youtube",   icon: "fa fa-youtube-play",      label: "YouTube"   },
			{ key: "web",       icon: "fa fa-globe",             label: "Sitio web" }
		];
		redes.forEach(function(red){
			var url = info[red.key];
			if (!url) return;
			// Para mostrar un texto amigable usamos el host de la url.
			var display = url;
			try {
				var u = new URL(url);
				display = u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '');
			} catch (e) { /* mantén url tal cual */ }
			rows.push(
				'<li class="grupo-info-row">' +
					'<span class="grupo-info-icon"><i class="' + red.icon + '"></i></span>' +
					'<span class="grupo-info-label">' + red.label + '</span>' +
					'<span class="grupo-info-value">' +
						'<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
							escapeHtml(display) +
						'</a>' +
					'</span>' +
				'</li>'
			);
		});

		if (rows.length === 0) {
			$body.html(
				'<p class="grupo-card-empty">' +
					'Información próximamente. ¿Eres del ' + escapeHtml(grupoKey) + '? ' +
					'Contáctanos para completar esta ficha.' +
				'</p>'
			);
		} else {
			$body.html('<ul class="grupo-info-list">' + rows.join("") + '</ul>');
		}
	}

	function abrirTarjetaGrupo(grupoKey){
		var match = findGrupoByKey(grupoKey);
		var estado = match ? match.estado : Object.keys(grupos)[0];
		var grupoSel = match ? match.nombre : unicoGrupoDe(estado);
		rellenarSelectGrupos(estado);
		rellenarSelectSubgrupos(estado, grupoSel);
		renderGrupoCard(estado, grupoSel);
		$("#panioletaSearcher").removeClass('hide');
	}

	$("a.panioleta").click(function(event){
		event.preventDefault();
		var grupoKey = $(this).attr("data-grupo");
		if (grupos == null) {
			$.get('includes/data/grupos.json', function(dataPanioletas){
				grupos = dataPanioletas;
				abrirTarjetaGrupo(grupoKey);
			}).fail(function(){
				grupos = null;
			});
		} else {
			abrirTarjetaGrupo(grupoKey);
		}
	});

	$("#grupos").on('change', function(){
		var estado = $(this).val();
		var auto = unicoGrupoDe(estado);
		rellenarSelectSubgrupos(estado, auto);
		renderGrupoCard(estado, auto);
	});

	$("#subgrupos").on('change', function(){
		var estado = $("#grupos").val();
		var grupoKey = $(this).val();
		renderGrupoCard(estado, grupoKey);
	});
	$("a.detalles").click(function(e){
		e.preventDefault();
		if( !$('.mostrarInfoH').hasClass('show') ){
			// Entonces no hay ningun circulo abierto,
			// por lo que podemos abrir la nueva pagina.
			var pagina = $(this).attr("data");
			localStorage.setItem("page", pagina);
			window.location.href = "detail1.html";
		}
	});

	// --- Deep-link a una sección desde otra página (p. ej. Programa Scout) ---
	// Permite abrir directamente el círculo de una sección usando una URL
	// como index.html#seccion-CC (CC, MG, ML, TMS, SD, CR, CP, TS).
	function abrirSeccionDesdeHash(){
		var m = (window.location.hash || '').match(/^#seccion-([A-Za-z]+)/);
		if (!m) return;
		var code = m[1].toUpperCase();
		var $circle = $('.circle.mostrarInfoH').filter(function(){
			return $(this).children('.content').hasClass(code);
		}).first();
		if (!$circle.length) return;
		$ultimoDisparadorSeccion = $();
		abrirCirculo($circle);
	}
	abrirSeccionDesdeHash();
	$(window).off('hashchange.seccion').on('hashchange.seccion', abrirSeccionDesdeHash);

}
/* Declararemos un variable global para las panioletas*/
var grupos = null;
$(document).ready( function () {
	/*Llamaremos a la función que hace la insercion de todos los html*/
	getAllIncludedHtml();
	
});

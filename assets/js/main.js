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
	// Cerrar el círculo expandido sólo si el click ocurre fuera de cualquier
	// `.mostrarInfoH` (es decir, fuera del propio círculo). Cualquier click
	// dentro del círculo no debe cerrarlo — para eso está el botón X.
	$(document).on('click', function(e){
		var $target = jQuery(e.target);
		// Si el click es sobre el botón X o sobre el ícono interno, dejamos
		// que su propio handler lo cierre.
		if ($target.closest('.circle-close').length) { return; }
		// Si el click ocurre dentro de un círculo abierto o sobre los
		// disparadores (round / mostrarMas) no cerramos nada.
		if ($target.closest('.mostrarInfoH').length) { return; }
		var count = 0;
		$('.mostrarInfoH').each(function(){
			if( $(this).hasClass("show") )
			{
				$(this).removeClass("show");
				$(this).addClass("hide");
				count++;
			}
		});
		if (count !== 0) { e.preventDefault(); }
	});
	//Efecto imágenes laterales
	$('.mostrarInfoH').each( function() {
		var t 		= jQuery(this);
		var enlace 	= t.find('.mostrarMas');
		// Inyectamos un botón X de cerrar junto al título de la sección.
		var $content = t.children('.content');
		var $title = $content.children('h2').first();
		if (!$title.length) { $title = $content.children('h1, h2').first(); }
		if ($title.length && !$title.find('.circle-close').length) {
			$title.append('<a href="#" class="circle-close" aria-label="Cerrar"><i class="fa fa-times"></i></a>');
		}
		$content.find('.circle-close').on('click', function(e){
			e.preventDefault();
			e.stopPropagation();
			t.removeClass('show').addClass('hide');
		});
		enlace.click( function(){
			// Eliminamos todos los que tengan esta cla
			$('.mostrarInfoH').each(function(){
				if( $(this).hasClass("show") )
				{
					$(this).removeClass("show");
					$(this).addClass("hide");
				}
			});
			t.toggleClass('hide');
			t.toggleClass('show');
			/*if ( t.hasClass('preview') ) {
                return true;
            } else {
                e.preventDefault();
            }*/
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
	// Declararemos una funcion que nos ayudará a mostrar el content.
	$(".leftArrow").click(function () {
		// Primero tenemos que obtener el padre para obtener toda la info y manipularla
		$(this).animate({
			height:'15px',
			width:'25px'
		}, 100);
		var info = $(this).siblings('.contenido').children('div');
		var contador = 0;
		info.each(function(){
			if( $(this).is(':visible') ){
				$(this).hide();
				if( contador === 0 ){
					contador = info.length-1;
				} else {
					--contador;
				}
				$(info[contador]).show();
				return false;
			}
			contador++;
		});
		$(this).animate({
			height:'25px',
			width:'30px'
		}, 100);
	});

	// Declararemos una funcion que nos ayudará a mostrar el content.
	$(".rigthArrow").click(function () {
		$(this).animate({
			height:'15px',
			width:'25px'
		}, 100);
		// Primero tenemos que obtener el padre para obtener toda la info y manipularla
		var info = $(this).siblings('.contenido').children('div');
		var contador = 0;
		info.each(function(){
			contador++;
			if( $(this).is(':visible') ){
				$(this).hide();
				if( contador === info.length ){
					contador = 0;
				}
				$(info[contador]).show();
				return false;
			}
		});
		$(this).animate({
			height:'25px',
			width:'30px'
		}, 100);
	});
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
	$("#panioletaSearcher").find(".button").click( function(e){
		e.preventDefault();
		$("#panioletaSearcher").toggleClass('hide');
	} )
	$("a.panioleta").click(function(event){
		var data = $(this).attr("data");
		if( grupos == null ){
			var gruposRequest = $.get('includes/data/grupos.json', function(dataPanioletas){
				grupos = dataPanioletas;
				if ( grupos != null){
					// Limpiamos el selector.
					$("#grupos").empty();
					$("#subgrupos").empty();
					$.each(grupos, function(key, value){
						if( data == key ){
							$("#grupos").append("<option value='"+key+"' selected>"+key+"</option>");
							$("#subgrupos").append("<option value='' selected>-----</option>");
							$.each( value, function( i,v ){
								$("#subgrupos").append("<option value='"+i+"' subdata='"+v+"'>"+i+"</option>");
							} );
						} else {
							$("#grupos").append("<option value='"+key+"'>"+key+"</option>");
						}
					});	
				}
				$("#panioletaSearcher").toggleClass('hide');
			}).fail( function(){
				grupos = null;
			});
		} else {
			$("#grupos").empty();
			$("#subgrupos").empty();
			$.each(grupos, function(key, value){
				if( data == key ){
					$("#grupos").append("<option value='"+key+"' selected>"+key+"</option>");
					$("#subgrupos").append("<option value='' selected>-----</option>");
					$.each( value, function( i,v ){
						$("#subgrupos").append("<option value='"+i+"' subdata='"+v+"'>"+i+"</option>");
					} );
				} else {
					$("#grupos").append("<option value='"+key+"'>"+key+"</option>");
				}
			});
			$("#panioletaSearcher").toggleClass('hide');
		}
	});
	$("#subgrupos").on('change', function(event){
		var info = $('option:selected', this).attr('subdata');
		$("#contenidoBanderin").html(info);
	});
	$( "#grupos" ).on('change', function(event){
		var data = $("#grupos").children("option:selected").val();
		if( grupos == null ){
			var gruposRequest = $.get('includes/data/grupos.json', function(dataPanioletas){
				grupos = dataPanioletas;
			}).fail( function(){
				grupos = null;
			});
		} 
		if ( grupos != null){
			// Limpiamos el selector.
			$("#grupos").empty();
			$("#subgrupos").empty();
			$.each(grupos, function(key, value){
				if( data == key ){
					$("#grupos").append("<option value='"+key+"' selected>"+key+"</option>");
					$("#subgrupos").append("<option value='' selected>-----</option>");
					$.each( value, function( i,v ){
						$("#subgrupos").append("<option value='"+i+"' subdata='"+v+"'>"+i+"</option>");
					} );
				} else {
					$("#grupos").append("<option value='"+key+"'>"+key+"</option>");
				}
			});
		}	
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

}
/* Declararemos un variable global para las panioletas*/
var grupos = null;
$(document).ready( function () {
	/*Llamaremos a la función que hace la insercion de todos los html*/
	getAllIncludedHtml();
	
});

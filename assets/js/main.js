/* main.js */

/*Funcion de las peticiones asincrona*/
function includeHTML(elmnt) {
	var getUrl = window.location;
	var baseUrl = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
	var elmnt, file;
	file = elmnt.getAttribute("includedHtml");
	if (file) {
		return $.ajax({
			url: baseUrl+file,
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

		button.click(function(e) {
			t.toggleClass('hide');
			if ( t.hasClass('preview') ) {
				return true;
			} else {
				e.preventDefault();
			}
		});
	});
	// Inicializamos algunas cosas
	$(document).click(function(e){
		var claseIdentificadora = e.target.parentElement;
		claseIdentificadora = claseIdentificadora.parentElement.className;
		if(claseIdentificadora != "mostrarMas"
			&& claseIdentificadora.indexOf("right") === -1
			&& claseIdentificadora.indexOf("left") === -1
			&& claseIdentificadora.indexOf("content") === -1
			&& claseIdentificadora.indexOf("contenedorTabs") === -1
			&& claseIdentificadora.indexOf("contenido") === -1
			&& claseIdentificadora.indexOf("interno") === -1){
			var count = 0;

      $('.mostrarInfoH').each(function(){
				if( $(this).hasClass("show") )
				{
					$(this).removeClass("show");
					$(this).addClass("hide");
					count++;
				}
			});
		}
		if(count != 0) {
			e.preventDefault();
		}
	});
	//Efecto imágenes laterales
	$('.mostrarInfoH').each( function() {
		var t 		= jQuery(this);
		var enlace 	= t.find('.mostrarMas');
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

$(document).ready( function () {
	/*Llamaremos a la función que hace la insercion de todos los html*/
	getAllIncludedHtml();
});

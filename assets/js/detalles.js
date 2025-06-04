/* main.js */

/* Función de las peticiones asíncronas */
function includeHTML(elmnt) {
	var getUrl = window.location;
	var baseUrl = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
	var elmnt, file;
	file = elmnt.getAttribute("includedHtml");
	if (file) {
		return $.ajax(baseUrl+file);
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
	$.when(promises).done(function(data){
		$.each( data, function(i,e){
			e.done( function( html ){
				($('[includedHtml]')[i]).innerHTML = html;
			}).fail(function(){
				console.log("Hubo un erro en la ensercion de: "+$('[includedHtml]')[i] );
			});
		});
	}).fail( function(){
		console.log("Hubo un error en la carga de elementos");
	}).then(function(){
		$.each( $('[includedHtml]'), function(i,e){
			e.setAttribute("includedHtml", undefined);
		} );
	}).then(function(){
		afterIncluded();
	}).then( function () {
		setTimeout(function(){
			afterAfterInclude();
		}, 1000);
	} );
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

}

function afterAfterInclude(){
	$("#previo").click(function(e){
		e.preventDefault();
		var anterior = $(this).attr("data");
		localStorage.setItem("page", anterior);
		window.location.href = "detail1.html";
	});

	$("#sigue").click(function(e){
		e.preventDefault();
		var anterior = $(this).attr("data");
		localStorage.setItem("page", anterior);
		window.location.href = "detail1.html";
	});
}

$(document).ready( function () {
	// Primero obtendremos la pagina.
	var pagina = localStorage.getItem("page");
	var include = $("#mainInclude").attr('includedHtml');
	$("#mainInclude").attr("includedHtml", include+pagina);
	/*Llamaremos a la función que hace la insercion de todos los html*/
	getAllIncludedHtml();
});

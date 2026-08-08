/*
 * Abre los canales de las bases a su hora y publica el reto.
 *
 *   node helpers/discord/abrir-base.js            -> queda corriendo y abre cada base a su hora
 *   node helpers/discord/abrir-base.js 3          -> abre la base 3 ya, sin esperar
 *   node helpers/discord/abrir-base.js 3 --cerrar -> cierra la base 3 (deja de recibir entregas)
 *   node helpers/discord/abrir-base.js --estado   -> muestra qué está abierto y qué falta
 *
 * El modo automático hay que dejarlo corriendo durante el evento (una laptop
 * encendida basta). Si se cae, al volver a arrancarlo abre de golpe todas las
 * bases cuya hora ya pasó, así que no se pierde nada.
 */

'use strict';

const { P, perms, dormir, leerConfig, req } = require('./api');

const cfg = leerConfig();
const G = cfg.guildId;

const args = process.argv.slice(2);
const CERRAR = args.includes('--cerrar');
const ESTADO = args.includes('--estado');
const soloNum = args.find((a) => /^\d+$/.test(a));

const PARTICIPANTE = perms(
	P.VIEW_CHANNEL, P.SEND_MESSAGES, P.EMBED_LINKS, P.ATTACH_FILES,
	P.ADD_REACTIONS, P.READ_MESSAGE_HISTORY, P.USE_EXTERNAL_EMOJIS,
	P.SEND_MESSAGES_IN_THREADS
);
const VER_SIN_ESCRIBIR = perms(P.VIEW_CHANNEL, P.READ_MESSAGE_HISTORY, P.ADD_REACTIONS);
const NADA = '0';
const VER = perms(P.VIEW_CHANNEL);
const ESCRIBIR = perms(P.SEND_MESSAGES);

const hora = (d) => new Date(d).toLocaleString('es-MX', {
	weekday: 'short', day: '2-digit', month: 'short',
	hour: '2-digit', minute: '2-digit', hour12: true,
	// Siempre hora de la Ciudad de México, corra donde corra el script
	timeZone: 'America/Mexico_City'
});

async function canales() {
	return req('GET', '/guilds/' + G + '/channels');
}

async function buscarCanal(slug) {
	const todos = await canales();
	return todos.find((c) => c.name === slug);
}

/** ¿El canal está oculto para @everyone? */
function estaOculto(canal) {
	const ov = (canal.permission_overwrites || []).find((o) => o.id === G);
	if (!ov) return false;
	return (BigInt(ov.deny || '0') & BigInt(VER)) !== 0n;
}

function estaCerrado(canal) {
	const ov = (canal.permission_overwrites || []).find((o) => o.id === G);
	if (!ov) return false;
	return (BigInt(ov.deny || '0') & BigInt(ESCRIBIR)) !== 0n;
}

/* ============================================================
   ABRIR / CERRAR
   ============================================================ */

async function abrir(base) {
	const canal = await buscarCanal(base.slug);
	if (!canal) {
		console.log('  ! no encontré el canal #' + base.slug + '. ¿Corriste setup.js?');
		return false;
	}
	if (!estaOculto(canal)) {
		console.log('  · ' + base.nombre + ' ya estaba abierta');
		return false;
	}

	await req('PUT', '/channels/' + canal.id + '/permissions/' + G, {
		type: 0, allow: PARTICIPANTE, deny: NADA
	});

	console.log('  ✔ ABIERTA · ' + base.nombre + '  (' + hora(new Date()) + ')');

	if (base.reto && base.reto.trim()) {
		const texto = [
			'# 🎯 ' + base.nombre,
			base.responsable ? '**Responsable:** ' + base.responsable : '',
			'',
			base.reto,
			'',
			'---',
			'**Cómo entregan:** publican en el Instagram de su patrulla y pegan aquí el enlace de la publicación.',
			'La cuenta tiene que estar **pública** o no podremos verla.'
		].filter(Boolean).join('\n');

		const m = await req('POST', '/channels/' + canal.id + '/messages', { content: texto });
		await req('PUT', '/channels/' + canal.id + '/pins/' + m.id).catch(() => {});
		console.log('    reto publicado y fijado');
	} else {
		console.log('    (sin reto en config.json: el jefe de base lo escribe a mano)');
	}
	await dormir(400);
	return true;
}

async function cerrar(base) {
	const canal = await buscarCanal(base.slug);
	if (!canal) { console.log('  ! no encontré #' + base.slug); return; }
	if (estaCerrado(canal)) { console.log('  · ' + base.nombre + ' ya estaba cerrada'); return; }

	// Se sigue viendo, pero ya no se puede entregar
	await req('PUT', '/channels/' + canal.id + '/permissions/' + G, {
		type: 0, allow: VER_SIN_ESCRIBIR, deny: ESCRIBIR
	});
	await req('POST', '/channels/' + canal.id + '/messages', {
		content: '🔒 **Base cerrada.** Ya no se reciben entregas. Los jefes siguen retroalimentando aquí.'
	});
	console.log('  ✔ CERRADA · ' + base.nombre);
}

/* ============================================================
   ESTADO
   ============================================================ */

async function estado() {
	const todos = await canales();
	console.log('\n  ESTADO DE LAS BASES\n');
	for (const b of cfg.bases) {
		const c = todos.find((x) => x.name === b.slug);
		let e, nota;
		const falta = new Date(b.abre) - Date.now();
		if (!c) { e = 'SIN CANAL '; nota = 'corre setup.js'; }
		else if (estaCerrado(c)) { e = 'CERRADA   '; nota = 'ya no recibe entregas'; }
		else if (!estaOculto(c)) { e = 'ABIERTA   '; nota = 'recibiendo entregas'; }
		else { e = 'oculta    '; nota = falta > 0 ? 'abre en ' + humano(falta) : '¡su hora ya pasó!'; }
		console.log('   ' + e + String(b.num).padStart(2) + ' · ' + b.nombre.padEnd(22) + hora(b.abre) + '   ' + nota);
	}
	console.log('');
}

function humano(ms) {
	const min = Math.round(ms / 60000);
	if (min < 60) return min + ' min';
	const h = Math.floor(min / 60), m = min % 60;
	if (h < 24) return h + 'h ' + m + 'min';
	return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

/* ============================================================
   MODO AUTOMÁTICO
   ============================================================ */

async function automatico() {
	console.log('\n  MODO AUTOMÁTICO. Déjalo corriendo (Ctrl+C para salir).\n');

	// Al arrancar, abrir todo lo que ya debería estar abierto.
	// Así una caída a media madrugada no arruina el evento.
	const vencidas = cfg.bases.filter((b) => new Date(b.abre) <= Date.now());
	if (vencidas.length) {
		console.log('  Poniéndome al corriente con ' + vencidas.length + ' base(s):');
		for (const b of vencidas) await abrir(b);
		console.log('');
	}

	const pendientes = cfg.bases
		.filter((b) => new Date(b.abre) > Date.now())
		.sort((a, b) => new Date(a.abre) - new Date(b.abre));

	if (!pendientes.length) {
		console.log('  No queda ninguna base por abrir. Listo.\n');
		return;
	}

	console.log('  Pendientes:');
	pendientes.forEach((b) => console.log('   ' + hora(b.abre) + '  ' + b.nombre));
	console.log('');

	for (const b of pendientes) {
		let falta = new Date(b.abre) - Date.now();
		console.log('  Esperando ' + b.nombre + ' · ' + humano(falta) + ' (' + hora(b.abre) + ')');
		// En tramos de 60s: setTimeout largo pierde precisión si la máquina se suspende
		while (falta > 0) {
			await dormir(Math.min(falta, 60000));
			falta = new Date(b.abre) - Date.now();
		}
		await abrir(b);
	}

	console.log('\n  Todas las bases abiertas. Buen Rally.\n');
}

/* ============================================================ */

async function main() {
	if (ESTADO) return estado();

	if (soloNum !== undefined) {
		const b = cfg.bases.find((x) => String(x.num) === soloNum);
		if (!b) {
			console.error('  No hay ninguna base ' + soloNum + ' en config.json');
			process.exit(1);
		}
		console.log('');
		return CERRAR ? cerrar(b) : abrir(b);
	}

	return automatico();
}

main().catch((e) => {
	console.error('\n  ERROR: ' + e.message + '\n');
	process.exit(1);
});

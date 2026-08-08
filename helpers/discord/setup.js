/*
 * Arma el servidor de Discord del Rally Virtual: roles, categorías, canales,
 * permisos y mensajes fijos.
 *
 *   1. Crea el servidor a mano en Discord (tú tienes que ser el dueño, no el bot).
 *   2. Invita al bot con permiso de Administrador.
 *   3. Pon el guildId en config.json.
 *   4. $env:DISCORD_TOKEN = "..."   y luego   node helpers/discord/setup.js
 *
 * Se puede correr las veces que haga falta: sólo crea lo que falta, nunca duplica.
 * Con --dry se ve qué haría sin tocar nada.
 *
 * Guía completa en docs/discord-servidor.md
 */

'use strict';

const { P, TIPO, perms, color, dormir, leerConfig, guardarConfig, req } = require('./api');

const DRY = process.argv.includes('--dry');
const cfg = leerConfig();
const G = cfg.guildId;

let creados = 0, existentes = 0;

const log = (s) => console.log(s);
const nuevo = (q) => { creados++; log('   + ' + q); };
const yaEsta = (q) => { existentes++; log('   · ' + q + ' (ya existía)'); };

/* ============================================================
   PERMISOS POR PERFIL
   ============================================================ */

// Lo que puede hacer cualquier participante en un canal normal
const PARTICIPANTE = perms(
	P.VIEW_CHANNEL, P.SEND_MESSAGES, P.EMBED_LINKS, P.ATTACH_FILES,
	P.ADD_REACTIONS, P.READ_MESSAGE_HISTORY, P.USE_EXTERNAL_EMOJIS,
	P.SEND_MESSAGES_IN_THREADS
);

// Un jefe de base modera su canal, pero no toca la configuración del servidor
const JEFE_BASE = perms(
	P.VIEW_CHANNEL, P.SEND_MESSAGES, P.EMBED_LINKS, P.ATTACH_FILES,
	P.ADD_REACTIONS, P.READ_MESSAGE_HISTORY, P.USE_EXTERNAL_EMOJIS,
	P.MANAGE_MESSAGES, P.CREATE_PUBLIC_THREADS, P.SEND_MESSAGES_IN_THREADS,
	P.MANAGE_THREADS, P.MENTION_EVERYONE, P.MODERATE_MEMBERS,
	P.CONNECT, P.SPEAK, P.MUTE_MEMBERS, P.MOVE_MEMBERS
);

const SOLO_VER = perms(P.VIEW_CHANNEL, P.READ_MESSAGE_HISTORY, P.ADD_REACTIONS);
const VER = perms(P.VIEW_CHANNEL);
const ESCRIBIR = perms(P.SEND_MESSAGES);
const VOZ_PARTICIPANTE = perms(P.VIEW_CHANNEL, P.CONNECT, P.SPEAK, P.USE_VAD);

/* ============================================================
   ROLES
   ============================================================ */

async function rolesActuales() {
	return req('GET', '/guilds/' + G + '/roles');
}

async function crearRol(nombre, hex, permisos, mencionable) {
	if (DRY) { nuevo('rol ' + nombre); return { id: 'dry', name: nombre }; }
	const r = await req('POST', '/guilds/' + G + '/roles', {
		name: nombre,
		color: color(hex),
		permissions: permisos || '0',
		hoist: true,
		mentionable: mencionable !== false
	});
	nuevo('rol ' + nombre);
	await dormir(350);
	return r;
}

async function asegurarRoles() {
	log('\n▸ ROLES');
	const actuales = await rolesActuales();
	const porNombre = {};
	actuales.forEach((r) => { porNombre[r.name] = r; });

	// El rol de @everyone lleva el nombre del servidor y no se toca aquí
	const everyone = actuales.find((r) => r.id === G);

	const out = { everyone: everyone };

	// Comité: administra todo
	const nc = cfg.roles.comite.nombre;
	out.comite = porNombre[nc] || await crearRol(nc, cfg.roles.comite.color, perms(P.ADMINISTRATOR));
	if (porNombre[nc]) yaEsta('rol ' + nc);

	// Jefe de Base: modera, pero sin llaves del servidor
	const nj = cfg.roles.jefeBase.nombre;
	out.jefeBase = porNombre[nj] || await crearRol(nj, cfg.roles.jefeBase.color,
		perms(P.VIEW_AUDIT_LOG, P.MANAGE_NICKNAMES, P.MODERATE_MEMBERS, P.MANAGE_EVENTS));
	if (porNombre[nj]) yaEsta('rol ' + nj);

	// No hay rol por patrulla: cada quien se identifica con su apodo
	// (Nombre · Patrulla · Grupo). Menos administración y nada que repartir.

	return out;
}

/* ============================================================
   CANALES
   ============================================================ */

async function canalesActuales() {
	return req('GET', '/guilds/' + G + '/channels');
}

async function crearCanal(datos) {
	if (DRY) { nuevo((datos.type === TIPO.CATEGORIA ? 'categoría ' : 'canal ') + datos.name); return { id: 'dry', name: datos.name }; }
	const c = await req('POST', '/guilds/' + G + '/channels', datos);
	nuevo((datos.type === TIPO.CATEGORIA ? 'categoría ' : 'canal ') + datos.name);
	await dormir(350);
	return c;
}

/* ============================================================
   ARMADO
   ============================================================ */

async function main() {
	log('\n══════════════════════════════════════════');
	log('  SERVIDOR DE DISCORD · RALLY VIRTUAL');
	log('══════════════════════════════════════════');
	if (DRY) log('\n  MODO PRUEBA (--dry): no se va a crear nada.\n');

	// Verificar que el bot llegó al servidor y con qué permisos
	let guild;
	try {
		guild = await req('GET', '/guilds/' + G);
	} catch (e) {
		if (e.status === 403 || e.status === 404) {
			console.error('\n  El bot no está en ese servidor, o el guildId es incorrecto.');
			console.error('  Revisa el paso 3 de docs/discord-servidor.md\n');
			process.exit(1);
		}
		throw e;
	}
	log('\n  Servidor: ' + guild.name);

	const R = await asegurarRoles();

	const yaHay = await canalesActuales();
	const catPorNombre = {};
	const canPorNombre = {};
	yaHay.forEach((c) => {
		if (c.type === TIPO.CATEGORIA) catPorNombre[c.name] = c;
		else canPorNombre[c.name] = c;
	});

	async function categoria(nombre, overwrites) {
		if (catPorNombre[nombre]) { yaEsta('categoría ' + nombre); return catPorNombre[nombre]; }
		const c = await crearCanal({ name: nombre, type: TIPO.CATEGORIA, permission_overwrites: overwrites || [] });
		catPorNombre[nombre] = c;
		return c;
	}

	async function canal(nombre, padre, extra) {
		if (canPorNombre[nombre]) { yaEsta('canal ' + nombre); return canPorNombre[nombre]; }
		const datos = Object.assign({ name: nombre, type: TIPO.TEXTO, parent_id: padre.id }, extra || {});
		const c = await crearCanal(datos);
		canPorNombre[nombre] = c;
		return c;
	}

	// Un canal de solo lectura: todos ven, sólo el Comité escribe
	const soloLectura = [
		{ id: R.everyone.id, type: 0, allow: SOLO_VER, deny: ESCRIBIR },
		{ id: R.comite.id, type: 0, allow: PARTICIPANTE }
	];

	/* ---------- 1. INFORMACIÓN ---------- */
	log('\n▸ INFORMACIÓN');
	const cInfo = await categoria('📋 INFORMACIÓN');
	const chBienvenida = await canal('bienvenida', cInfo, { permission_overwrites: soloLectura, topic: 'Empieza aquí. Qué es el Rally y qué tienes que hacer.' });
	const chReglas = await canal('reglas', cInfo, { permission_overwrites: soloLectura, topic: 'Reglamento del Rally Virtual. Leerlo es obligatorio.' });
	await canal('avisos', cInfo, { permission_overwrites: soloLectura, topic: 'Avisos del Comité. Sólo nosotros escribimos aquí.' });
	await canal('tutoriales', cInfo, { permission_overwrites: soloLectura, topic: 'Cómo crear el Instagram, cómo entregar un reto, cómo funciona la Base 0.' });

	/* ---------- 2. GENERAL ---------- */
	log('\n▸ GENERAL');
	const cGeneral = await categoria('💬 GENERAL');
	await canal('presentaciones', cGeneral, { topic: 'Preséntense: nombre de la patrulla, grupo y quiénes son.' });
	await canal('dudas', cGeneral, { topic: '¿Algo no queda claro? Pregunten aquí, sin pena.' });
	await canal('convivencia', cGeneral, { topic: 'Para platicar entre patrullas. Con respeto, siempre.' });
	await canal('🔊 Voz General', cGeneral, {
		type: TIPO.VOZ,
		permission_overwrites: [
			{ id: R.everyone.id, type: 0, allow: VOZ_PARTICIPANTE },
			{ id: R.jefeBase.id, type: 0, allow: JEFE_BASE }
		]
	});

	/* ---------- 3. BASES (ocultas hasta su hora) ---------- */
	log('\n▸ ' + cfg.edicion + ' · BASES');
	const cBases = await categoria('🎯 ' + cfg.edicion);

	// Ocultas para todos; sólo Comité y Jefes de Base las ven antes de tiempo
	const ocultoParaTodos = [
		{ id: R.everyone.id, type: 0, deny: VER },
		{ id: R.comite.id, type: 0, allow: PARTICIPANTE },
		{ id: R.jefeBase.id, type: 0, allow: JEFE_BASE }
	];

	for (const b of cfg.bases) {
		const hora = new Date(b.abre).toLocaleString('es-MX', {
			weekday: 'short', day: '2-digit', month: 'short',
			hour: '2-digit', minute: '2-digit', hour12: true,
			// Siempre hora de la Ciudad de México, corra donde corra el script
			timeZone: 'America/Mexico_City'
		});
		await canal(b.slug, cBases, {
			permission_overwrites: ocultoParaTodos,
			topic: b.nombre + ' · abre ' + hora + (b.responsable ? ' · responsable: ' + b.responsable : '')
		});
	}

	/* ---------- 4. RESULTADOS ---------- */
	log('\n▸ RESULTADOS');
	const cRes = await categoria('🏅 RESULTADOS');
	await canal('tabla-de-posiciones', cRes, { permission_overwrites: soloLectura, topic: 'Cómo va cada patrulla.' });
	await canal('galería', cRes, { permission_overwrites: soloLectura, topic: 'Lo mejor de cada base, elegido por los jefes.' });

	/* ---------- 5. COMITÉ (privado) ---------- */
	log('\n▸ COMITÉ');
	const soloStaff = [
		{ id: R.everyone.id, type: 0, deny: VER },
		{ id: R.comite.id, type: 0, allow: PARTICIPANTE },
		{ id: R.jefeBase.id, type: 0, allow: JEFE_BASE }
	];
	const cCom = await categoria('🔒 COMITÉ', soloStaff);
	await canal('comité-general', cCom, { permission_overwrites: soloStaff, topic: 'Coordinación entre jefes.' });
	await canal('comité-calificaciones', cCom, { permission_overwrites: soloStaff, topic: 'Puntajes y acuerdos de evaluación.' });
	await canal('🔊 Voz Comité', cCom, { type: TIPO.VOZ, permission_overwrites: soloStaff });

	/* ---------- 6. Ajustes del servidor ---------- */
	await ajustesDelServidor(guild, chReglas);

	/* ---------- 7. Mensajes fijos ---------- */
	await mensajesFijos(chBienvenida, chReglas);

	log('\n══════════════════════════════════════════');
	log('  ' + creados + ' creados · ' + existentes + ' ya existían');
	log('══════════════════════════════════════════');
	if (!DRY) {
		log('\n  Falta a mano (no se puede por API):');
		log('   1. Crear el enlace de invitación permanente y ponerlo');
		log('      en includes/data/rally.json -> evento.discordInvite');
		log('   2. Darte el rol de Comité y repartir Jefe de Base.');
		log('   3. Revisar la pantalla de reglas en Ajustes -> Incorporación.');
		log('\n  Recuerda: no hay roles por patrulla. Cada quien se identifica');
		log('  con su apodo, "Nombre · Patrulla · Grupo". Está pedido en');
		log('  #bienvenida y en #reglas; conviene revisarlo en la Base 0.\n');
	}
}

/* ============================================================
   AJUSTES DEL SERVIDOR
   Modo Comunidad: habilita la pantalla de reglas y el filtro
   automático de contenido. Importante tratándose de menores.
   ============================================================ */
async function ajustesDelServidor(guild, chReglas) {
	log('\n▸ AJUSTES DEL SERVIDOR');
	if (DRY) { log('   + modo comunidad, filtro de contenido y verificación'); return; }

	const features = (guild.features || []).slice();
	if (features.indexOf('COMMUNITY') === -1) features.push('COMMUNITY');

	try {
		await req('PATCH', '/guilds/' + G, {
			features: features,
			rules_channel_id: chReglas.id,
			public_updates_channel_id: chReglas.id,
			// 1 = correo verificado. Suficiente para no ahuyentar a nadie
			verification_level: 1,
			// 2 = revisar los mensajes de todos, no sólo los de quien no tiene rol
			explicit_content_filter: 2,
			// 4 = pedir 2FA a los moderadores
			mfa_level: 1,
			default_message_notifications: 1
		});
		log('   + modo comunidad, filtro de contenido y verificación por correo');
	} catch (e) {
		log('   ! no pude activar el modo comunidad automáticamente');
		log('     Actívalo a mano: Ajustes del servidor → Habilitar comunidad.');
		log('     (' + String(e.message).split('\n')[0] + ')');
	}
}

/* ============================================================
   MENSAJES FIJOS
   Sólo se publican si el canal está vacío, para no duplicarlos
   cada vez que se corre el script.
   ============================================================ */
async function mensajesFijos(chBienvenida, chReglas) {
	log('\n▸ MENSAJES FIJOS');
	if (DRY) { log('   + bienvenida y reglamento'); return; }

	await publicarSiVacio(chBienvenida, [
		'# 🏕️ Bienvenidos al Rally Virtual',
		'',
		'Este es el **cuartel general**. Aquí se publican los retos y aquí entregan.',
		'',
		'## ⚠️ Lo primero: pon tu apodo',
		'**Aquí no hay roles de patrulla: tu apodo es tu identificación.** Si no lo cambias,',
		'los jefes no saben quién eres ni a qué patrulla le cuenta tu entrega.',
		'',
		'Ponlo exactamente así, con el nombre de tu patrulla y tu grupo:',
		'```',
		'Ana · Águilas · G54',
		'```',
		'Clic derecho sobre tu nombre → **Editar perfil del servidor** → Apodo.',
		'',
		'## Después',
		'**1.** Lee <#' + chReglas.id + '>.',
		'**2.** Salúdanos en **#presentaciones**: patrulla, grupo y quiénes son.',
		'**3.** Completen la **Base 0** antes del evento. Es un ensayo obligatorio.',
		'',
		'## Cómo se entrega un reto',
		'**1.** A su hora se abre el canal de la base con el reto.',
		'**2.** Lo resuelven en su rincón de patrulla.',
		'**3.** Publican la foto o el video **en el Instagram de su patrulla**.',
		'**4.** Copian el enlace de esa publicación y lo pegan en el canal de la base.',
		'**5.** El jefe de base les responde ahí mismo.',
		'',
		'> La cuenta de Instagram tiene que estar **pública** todo el evento, si no, no podemos verla.',
		'',
		'## ¿Dudas?',
		'Pregunten en **#dudas**. Siempre hay alguien del Comité pendiente.'
	].join('\n'));

	await publicarSiVacio(chReglas, [
		'# 📜 Reglamento',
		'',
		'**1.** Uniforme correctamente portado en todo momento, también frente a la cámara.',
		'**2.** Respeto y propiedad en toda acción, **también aquí en los chats**.',
		'**3.** La cuenta de Instagram de la patrulla permanece **pública** durante todo el evento.',
		'**4.** El rincón de patrulla queda **impecable y ordenado** al terminar.',
		'**5.** Cada reto se entrega **en su canal**. Entregado en otro lado, no cuenta.',
		'**6.** Se entrega **dentro del horario** de la base. Después ya no se recibe.',
		'**7.** El trabajo es **de la patrulla**. Que participen todos, no sólo uno.',
		'',
		'## En este servidor',
		'• **Tu apodo va como `Nombre · Patrulla · Grupo`.** Es obligatorio: es la única forma',
		'  que tenemos de saber a qué patrulla le cuenta cada entrega.',
		'• Nada de contenido ofensivo, ni en texto, ni en imagen, ni en audio.',
		'• No compartan datos personales: domicilio, teléfono ni escuela.',
		'• Discord exige **13 años cumplidos** para tener cuenta. Quien no los tenga participa desde la cuenta de un compañero de patrulla que sí los tenga.',
		'• Cualquier problema, repórtenlo al Comité de inmediato.',
		'',
		'> Incumplir estas bases puede costarle a la patrulla la baja del Rally.',
		'',
		'**Al entrar y participar aceptan este reglamento.**'
	].join('\n'));
}

async function publicarSiVacio(canal, texto) {
	const previos = await req('GET', '/channels/' + canal.id + '/messages?limit=1');
	if (previos && previos.length) { yaEsta('mensaje de #' + canal.name); return; }
	const m = await req('POST', '/channels/' + canal.id + '/messages', { content: texto });
	await req('PUT', '/channels/' + canal.id + '/pins/' + m.id).catch(() => {});
	nuevo('mensaje fijado en #' + canal.name);
	await dormir(400);
}

main().catch((e) => {
	console.error('\n  ERROR: ' + e.message + '\n');
	process.exit(1);
});

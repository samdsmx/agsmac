/*
 * Cliente mínimo de la API de Discord.
 * No usa dependencias: Node 18+ ya trae fetch. Lo comparten setup.js y abrir-base.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const API = 'https://discord.com/api/v10';
const CONFIG_PATH = path.join(__dirname, 'config.json');

/* ---------- Permisos (bitfield de Discord) ----------
   Son mayores que 2^31, así que se manejan con BigInt y se mandan como texto. */
const P = {
	CREATE_INSTANT_INVITE: 1n << 0n,
	KICK_MEMBERS: 1n << 1n,
	BAN_MEMBERS: 1n << 2n,
	ADMINISTRATOR: 1n << 3n,
	MANAGE_CHANNELS: 1n << 4n,
	MANAGE_GUILD: 1n << 5n,
	ADD_REACTIONS: 1n << 6n,
	VIEW_AUDIT_LOG: 1n << 7n,
	VIEW_CHANNEL: 1n << 10n,
	SEND_MESSAGES: 1n << 11n,
	MANAGE_MESSAGES: 1n << 13n,
	EMBED_LINKS: 1n << 14n,
	ATTACH_FILES: 1n << 15n,
	READ_MESSAGE_HISTORY: 1n << 16n,
	MENTION_EVERYONE: 1n << 17n,
	USE_EXTERNAL_EMOJIS: 1n << 18n,
	CONNECT: 1n << 20n,
	SPEAK: 1n << 21n,
	MUTE_MEMBERS: 1n << 22n,
	DEAFEN_MEMBERS: 1n << 23n,
	MOVE_MEMBERS: 1n << 24n,
	USE_VAD: 1n << 25n,
	CHANGE_NICKNAME: 1n << 26n,
	MANAGE_NICKNAMES: 1n << 27n,
	MANAGE_ROLES: 1n << 28n,
	MANAGE_EVENTS: 1n << 33n,
	MANAGE_THREADS: 1n << 34n,
	CREATE_PUBLIC_THREADS: 1n << 35n,
	SEND_MESSAGES_IN_THREADS: 1n << 38n,
	MODERATE_MEMBERS: 1n << 40n
};

/** Suma varios permisos y los devuelve como la cadena que espera la API. */
function perms() {
	var t = 0n;
	for (var i = 0; i < arguments.length; i++) t |= arguments[i];
	return t.toString();
}

const TIPO = { TEXTO: 0, VOZ: 2, CATEGORIA: 4, ANUNCIOS: 5, FORO: 15 };

/* ---------- Utilidades ---------- */

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function color(hex) {
	if (!hex) return 0;
	return parseInt(String(hex).replace('#', ''), 16);
}

function token() {
	const t = process.env.DISCORD_TOKEN;
	if (!t) {
		console.error('\n  Falta el token del bot.\n');
		console.error('  Windows PowerShell:  $env:DISCORD_TOKEN = "el-token-del-bot"');
		console.error('  Linux / macOS:       export DISCORD_TOKEN="el-token-del-bot"\n');
		console.error('  El token se saca de https://discord.com/developers/applications');
		console.error('  -> tu aplicación -> Bot -> Reset Token.\n');
		process.exit(1);
	}
	return t.trim();
}

function leerConfig() {
	if (!fs.existsSync(CONFIG_PATH)) {
		console.error('  No encontré helpers/discord/config.json');
		process.exit(1);
	}
	const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
	if (!cfg.guildId) {
		console.error('\n  Falta "guildId" en helpers/discord/config.json\n');
		console.error('  En Discord: Ajustes -> Avanzado -> Modo desarrollador ON,');
		console.error('  luego clic derecho sobre el servidor -> Copiar ID del servidor.\n');
		process.exit(1);
	}
	return cfg;
}

function guardarConfig(cfg) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

/* ---------- Llamadas a la API ----------
   Discord limita el ritmo de peticiones. Si responde 429 hay que esperar lo que
   diga y reintentar, si no el script se cae a media creación. */
async function req(metodo, ruta, cuerpo, intento) {
	intento = intento || 0;
	const res = await fetch(API + ruta, {
		method: metodo,
		headers: {
			Authorization: 'Bot ' + token(),
			'Content-Type': 'application/json',
			'X-Audit-Log-Reason': 'Rally Virtual AGSMAC'
		},
		body: cuerpo ? JSON.stringify(cuerpo) : undefined
	});

	if (res.status === 429) {
		const d = await res.json().catch(() => ({ retry_after: 5 }));
		const espera = Math.ceil((d.retry_after || 5) * 1000) + 250;
		console.log('    (límite de ritmo: espero ' + Math.round(espera / 1000) + 's)');
		await dormir(espera);
		return req(metodo, ruta, cuerpo, intento);
	}

	// 5xx: problema de Discord, no nuestro. Reintentar con espera creciente.
	if (res.status >= 500 && intento < 3) {
		await dormir(1000 * (intento + 1));
		return req(metodo, ruta, cuerpo, intento + 1);
	}

	if (!res.ok) {
		const txt = await res.text();
		const err = new Error('Discord ' + res.status + ' en ' + metodo + ' ' + ruta + '\n  ' + txt);
		err.status = res.status;
		throw err;
	}

	if (res.status === 204) return null;
	return res.json();
}

module.exports = {
	API, CONFIG_PATH, P, TIPO,
	perms, color, dormir, token, leerConfig, guardarConfig, req
};

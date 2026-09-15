// Quita los trazos rojos de una imagen — pensado para "desresolver" sopas de
// letras y crucigramas: la versión resuelta trae los hallazgos marcados en
// rojo y aquí se recupera la hoja limpia.
//
//   node helpers\quitarRojo.js Temp\VIIIRally\Sopa_Res.jpeg
//   node helpers\quitarRojo.js entrada.jpg salida.png
//
// Sin salida explícita escribe junto al original como <nombre>-sin-rojo.png.
// Siempre PNG: reguardar en JPEG volvería a meter halos de compresión.
//
// Cómo funciona: solo se tocan los píxeles con tinte ROJO (su canal rojo
// domina claramente sobre verde y azul). De esos:
//   - los de rojo vivo son el trazo sobre el papel  -> blanco
//   - los de rojo apagado son borde de letra teñido -> se les quita el color,
//     conservando su oscuridad, así que siguen siendo negros
// Todo lo demás —letras, dibujo, grises neutros— se queda exactamente igual.
// Este es el punto fino: un umbral que mire solo "¿tiene color?" también se
// come el antialias de las letras y las deja mordidas.
//
// Ojo con el umbral: se mide sobre el CANAL ROJO, no sobre la luminosidad.
// El rojo pleno de estos trazos (237,28,36) tiene luminosidad ~91, o sea que
// por luminosidad se clasificaría como "oscuro" y el trazo sobreviviría como
// una línea gris.
//
// El trazo va por debajo de las letras, así que estas quedan intactas. Si en
// algún original fuera al revés, donde el trazo cruce una letra quedará un
// corte blanco: eso no se puede recuperar, la información ya no está.
//
// No sirve sobre fotografías ni sobre dibujos donde el rojo sea parte del
// contenido: los borraría.
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

// Cuánto debe dominar el canal rojo sobre el más alto de los otros dos para
// considerar que el pixel es del trazo. Subirlo perdona halos rosados muy
// tenues; bajarlo empieza a morder el antialias de las letras.
const DOMINANCIA_ROJO = 28;
// Valor del canal rojo a partir del cual el pixel se toma por trazo pleno (y
// se blanquea). Por debajo se asume borde de letra teñido y solo se le quita
// el color, sin aclararlo.
const ROJO_VIVO = 150;
// Halo del trazo: el JPEG deja alrededor un rosa muy pálido que no alcanza
// DOMINANCIA_ROJO. Se limpia aparte, y solo si el pixel es casi blanco, para
// no acercarse nunca al antialias de las letras (que además es neutro).
const HALO_TINTE = 4;
const HALO_CLARO = 190;
// Un pixel se considera "letra" si es oscuro y neutro (sin tinte). Sirve para
// decidir qué hacer con los rojos apagados: los que tocan una letra son su
// borde teñido y hay que conservarlos; los que no, son borde del trazo.
const LETRA_OSCURA = 110;
const LETRA_NEUTRA = 24;

async function quitarRojo(src, dst) {
    const img = await Jimp.read(src);
    const w = img.width, h = img.height;
    const d = img.bitmap.data;

    // Mapa de letras, calculado ANTES de tocar nada.
    const esLetra = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) <= LETRA_NEUTRA &&
            Math.max(r, g, b) < LETRA_OSCURA) {
            esLetra[p] = 1;
        }
    }

    function tocaLetra(x, y) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                if (esLetra[ny * w + nx]) return true;
            }
        }
        return false;
    }

    let blanqueados = 0, desteñidos = 0, halos = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const i = p * 4;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const otros = Math.max(g, b);

            if (r - otros > DOMINANCIA_ROJO) {
                if (r >= ROJO_VIVO || !tocaLetra(x, y)) {
                    // Trazo pleno, o rojo apagado que no toca ninguna letra:
                    // es el borde del propio trazo.
                    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
                    blanqueados++;
                } else {
                    // Borde de letra teñido: se descarta el canal rojo (el
                    // contaminado) y se reconstruye un gris con los otros dos,
                    // así el pixel conserva su oscuridad.
                    const v = Math.round((g + b) / 2);
                    d[i] = v; d[i + 1] = v; d[i + 2] = v;
                    desteñidos++;
                }
            } else if (r - otros > HALO_TINTE && Math.min(g, b) > HALO_CLARO) {
                d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
                halos++;
            }
        }
    }

    await img.write(dst);
    return { blanqueados, desteñidos, halos };
}

(async () => {
    const src = process.argv[2];
    if (!src) {
        console.error('Uso: node helpers\\quitarRojo.js <entrada> [salida.png]');
        process.exitCode = 1;
        return;
    }
    if (!fs.existsSync(src)) {
        console.error(`No existe: ${src}`);
        process.exitCode = 1;
        return;
    }

    const info = path.parse(src);
    const dst = process.argv[3] || path.join(info.dir, info.name + '-sin-rojo.png');

    try {
        const r = await quitarRojo(src, dst);
        console.log(
            `${src} -> ${dst}\n` +
            `  trazo blanqueado: ${r.blanqueados} px · bordes desteñidos: ${r.desteñidos} px · ` +
            `halo limpiado: ${r.halos} px`
        );
    } catch (e) {
        console.error(`Error con ${src}:`, e.message);
        process.exitCode = 1;
    }
})();

// Procesa los escudos de grupo:
// - Redimensiona a max 400px lado mayor
// - Si las 4 esquinas son del mismo color claro (fondo uniforme), lo hace transparente
// - Exporta como PNG
const { Jimp, intToRGBA, rgbaToInt } = require('jimp');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'images', 'grupos', 'Escudos');
const outDir = srcDir;

const COLOR_TOLERANCE = 32; // distancia RGB para considerar un pixel "igual" al fondo
const CORNER_TOLERANCE = 55; // qué tan parecidas deben ser las 4 esquinas

function rgbDist(a, b) {
    return Math.sqrt(
        (a.r - b.r) ** 2 +
        (a.g - b.g) ** 2 +
        (a.b - b.b) ** 2
    );
}

async function processFile(file) {
    const fullSrc = path.join(srcDir, file);
    const base = path.parse(file).name;
    const fullDst = path.join(outDir, base + '.png');

    const img = await Jimp.read(fullSrc);

    // Redimensionar
    const maxSide = Math.max(img.width, img.height);
    if (maxSide > 400) {
        const scale = 400 / maxSide;
        img.resize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
    }

    // Detectar color de fondo a partir de las 4 esquinas
    const w = img.width, h = img.height;
    const corners = [
        intToRGBA(img.getPixelColor(0, 0)),
        intToRGBA(img.getPixelColor(w - 1, 0)),
        intToRGBA(img.getPixelColor(0, h - 1)),
        intToRGBA(img.getPixelColor(w - 1, h - 1))
    ];
    const avg = {
        r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
        g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
        b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4)
    };
    const cornersUniform = corners.every(c => rgbDist(c, avg) < CORNER_TOLERANCE);
    const isLight = (avg.r + avg.g + avg.b) / 3 > 200;

    let transparencyApplied = false;
    if (cornersUniform && isLight) {
        // Hacer transparente todo lo que esté cerca de ese color de fondo
        img.scan(0, 0, w, h, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const dist = rgbDist({ r, g, b }, avg);
            if (dist < COLOR_TOLERANCE) {
                this.bitmap.data[idx + 3] = 0; // alpha 0
            } else if (dist < COLOR_TOLERANCE * 1.8) {
                // borde suave
                const k = (dist - COLOR_TOLERANCE) / (COLOR_TOLERANCE * 0.8);
                this.bitmap.data[idx + 3] = Math.round(255 * k);
            }
        });
        transparencyApplied = true;
    }

    await img.write(fullDst);

    // Si el original no era .png y existía, elimínalo
    if (path.extname(file).toLowerCase() !== '.png') {
        try { fs.unlinkSync(fullSrc); } catch (e) {}
    }

    console.log(
        `${file} -> ${base}.png  (${w}x${h}, fondo=${avg.r},${avg.g},${avg.b}, ` +
        `transparencia=${transparencyApplied ? 'sí' : 'no'})`
    );
}

(async () => {
    const files = fs.readdirSync(srcDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    for (const f of files) {
        try {
            await processFile(f);
        } catch (e) {
            console.error(`Error con ${f}:`, e.message);
        }
    }
})();

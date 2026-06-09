#!/usr/bin/env node
/**
 * optimize-images.js
 *
 * Optimiza las imágenes del sitio (JPG/PNG) reduciendo su resolución y
 * recomprimiéndolas. Usa la librería `jimp` (ya presente en package.json),
 * por lo que no requiere dependencias nativas.
 *
 * Modo de uso:
 *   node scripts/optimize-images.js [--write] [--dir images]
 *
 *   --write   Sobrescribe las imágenes originales (hace backup previo en
 *             images/_originals/). Sin esta bandera sólo reporta qué haría.
 *   --dir     Carpeta a procesar (por defecto: images).
 *   --max-w   Ancho máximo en px (por defecto: 1600).
 *   --quality Calidad JPG 1-100 (por defecto: 80).
 *
 * Reglas:
 *   - Reduce el ancho si excede --max-w, conservando aspecto.
 *   - Re-codifica JPG con la calidad indicada.
 *   - Re-codifica PNG con compresión nivel 9 (sin pérdida).
 *   - Salta imágenes ya pequeñas (< 50 KB y < max-w de ancho).
 *   - Ignora carpetas: _originals, optimized, node_modules, .git.
 */

const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const argv = process.argv.slice(2);
const opts = {
    write: argv.includes('--write'),
    dir: getArg('--dir', 'images'),
    maxW: parseInt(getArg('--max-w', '1200'), 10),
    quality: parseInt(getArg('--quality', '75'), 10),
};

function getArg(name, def) {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

const EXCLUDED_DIRS = new Set(['_originals', 'optimized', 'node_modules', '.git']);
const EXT = /\.(jpe?g|png)$/i;
const SIZE_THRESHOLD = 50 * 1024;

function walk(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        if (EXCLUDED_DIRS.has(name)) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, files);
        else if (EXT.test(name)) files.push(full);
    }
    return files;
}

function backup(file) {
    const rel = path.relative(opts.dir, file);
    const dest = path.join(opts.dir, '_originals', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
}

async function processFile(file) {
    const before = fs.statSync(file).size;
    const img = await Jimp.read(file);
    const origW = img.bitmap.width;
    const origH = img.bitmap.height;

    let resized = false;
    if (origW > opts.maxW) {
        img.resize({ w: opts.maxW });
        resized = true;
    }

    const isJpg = /\.jpe?g$/i.test(file);
    const isPng = /\.png$/i.test(file);

    // Saltar si ya es pequeña y no necesita resize
    if (!resized && before < SIZE_THRESHOLD) {
        return { file, before, after: before, skipped: true };
    }

    // Generar buffer optimizado en memoria primero
    let buf;
    if (isJpg) {
        buf = await img.getBuffer('image/jpeg', { quality: opts.quality });
    } else if (isPng) {
        buf = await img.getBuffer('image/png', { deflateLevel: 9 });
    } else {
        return { file, before, after: before, skipped: true };
    }
    const after = buf.length;

    if (after >= before * 0.95) {
        // Mejora < 5%, no vale la pena
        return { file, before, after, skipped: true, reason: 'sin mejora' };
    }

    if (opts.write) {
        backup(file);
        fs.writeFileSync(file, buf);
    }
    return {
        file,
        before,
        after,
        resized,
        origW,
        origH,
        newW: img.bitmap.width,
        newH: img.bitmap.height,
    };
}

function fmt(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

(async () => {
    if (!fs.existsSync(opts.dir)) {
        console.error(`No existe la carpeta: ${opts.dir}`);
        process.exit(1);
    }
    const files = walk(opts.dir);
    console.log(`Procesando ${files.length} imágenes en ${opts.dir}\n`);

    let totalBefore = 0, totalAfter = 0, optimized = 0;
    for (const f of files) {
        try {
            const r = await processFile(f);
            totalBefore += r.before;
            totalAfter += r.after;
            const rel = path.relative('.', r.file);
            if (r.skipped) {
                if (r.reason) console.log(`  -  ${rel}  (${r.reason})`);
            } else {
                optimized++;
                const pct = ((1 - r.after / r.before) * 100).toFixed(0);
                const dims = r.resized
                    ? `  ${r.origW}x${r.origH} -> ${r.newW}x${r.newH}`
                    : '';
                console.log(`  ✓  ${rel}  ${fmt(r.before)} -> ${fmt(r.after)} (-${pct}%)${dims}`);
            }
        } catch (e) {
            console.warn(`  !  ${f}  (${e.message})`);
        }
    }

    console.log(`\nTotal: ${fmt(totalBefore)} -> ${fmt(totalAfter)}  ahorrado ${fmt(totalBefore - totalAfter)} en ${optimized} archivo(s).`);
    if (!opts.write) {
        console.log(`\n(Modo dry-run. Re-ejecuta con --write para sobrescribir.\n Las originales se respaldan en ${opts.dir}/_originals/.)`);
    }
})();

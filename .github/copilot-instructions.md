# Instrucciones para Copilot — AGSMAC

Sitio estático (HTML/CSS/jQuery) de la Asociación de Grupos de Scouts de México A.C., servido localmente con un servidor Node mínimo y publicado en GitHub Pages desde la rama principal.

El `README.md` es la fuente canónica de documentación del proyecto (estructura completa, esquema de datos, despliegue, etc.). Léelo antes de hacer cambios de mantenimiento. Este archivo solo resume lo que un agente necesita para no equivocarse.

## Comandos

Requisitos: Node.js 18+.

```powershell
npm install                              # una sola vez (connect, serve-static, jimp)
node server.js                           # sirve el sitio en http://localhost:8082
node helpers\procesarEscudos.js          # procesa images/grupos/Escudos/* -> PNG transparente
npm run optimize-images                  # dry-run de optimización de images/
npm run optimize-images:write            # aplica la optimización (hace backup en images/_originals/)
```

No hay paso de build, ni linter, ni suite de tests. Validar cambios = recargar el navegador.

## Arquitectura

- **Sin build, sin framework.** Todo se sirve tal cual desde la raíz del repo. Las páginas son `index.html`, `detail1.html`, `detail2.html`.
- **HTML modular vía atributo `includedHtml`.** Cualquier `<div includedHtml="/includes/X.html">` se rellena en runtime por `assets/js/main.js` con el contenido del archivo apuntado. Es el mecanismo principal de reutilización; no hay templating server-side.
- **Stack JS legacy:** jQuery 1.x + skel + plugins (`liMarquee`, `poptrox`). Mantener compatibilidad con ese estilo; evitar features de JS muy nuevas en `assets/js/main.js`. Un solo CSS global: `assets/css/main.css` (secciones marcadas con comentarios `/* nombreSeccion */`).
- **Datos del sitio en JSON estático bajo `includes/data/`:**
  - `grupos.json` — info de cada Grupo Scout que alimenta el popup de pañoletas. Estructura: `Estado → "Grupo NNN" → { campos }`. La clave del grupo **debe coincidir exactamente** con el atributo `data-grupo="Grupo NNN"` del `<a class="panioleta">` correspondiente en `index.html`. Campos vacíos se omiten en el render; URLs requieren `https://`.
  - `cumpleanos.json` — config del tile de cumpleaños (`assets/js/birthday-tile.js`). Cascada de fuentes: Apps Script (`appsScriptUrl`) → arreglo `birthdays` inline → mensaje genérico. `rangeDays` filtra ±N días alrededor de hoy.
- **Apps Script de cumpleaños:** el código vive en `docs/apps-script-cumpleanos.gs`. Editar el `.gs` del repo **no** actualiza el endpoint; hay que redeployar (Implementar → Administrar implementaciones → Nueva versión) para que la URL `/exec` sirva la versión nueva.
- **Imágenes:**
  - `images/grupos/<numero>.png` — pañoletas (PNG transparente, ya listas).
  - `images/grupos/Escudos/<numero>.png` — escudos. Cuando se agrega o reemplaza un archivo aquí, correr `helpers/procesarEscudos.js`, que redimensiona, detecta fondo claro por las 4 esquinas y lo vuelve transparente (umbrales: `COLOR_TOLERANCE`, `CORNER_TOLERANCE` al inicio del script). Si las esquinas son oscuras o dispares, deja la imagen opaca; en ese caso hay que editarla a mano.
  - `images/pic*.jpg` — mosaico de la home.
- **CI:** `.github/workflows/optimize-images.yml` corre `calibreapp/image-actions` en push/PR que tocan `images/**` y hace commit de las imágenes recomprimidas al branch. Ignora `images/_originals/**`. Por eso el script local `optimize-images.js` deja backup ahí.

## Convenciones específicas

- **No introducir tooling de build, bundler, ni TypeScript.** El sitio se sirve estático; cualquier dependencia nueva debe poder cargarse vía `<script>` o ejecutarse en Node sin transpilación.
- **Al agregar un grupo nuevo** hay que tocar 3 cosas en sincronía: bloque en `grupos.json`, archivo de pañoleta `images/grupos/<n>.png`, y un `<a class="panioleta" ... data-grupo="Grupo N">` en `index.html` (más el escudo procesado en `images/grupos/Escudos/`).
- **Convención de nombres de imágenes de grupo:** `<numero>.png` sin sufijos (`54.png`, `729.png`). Renombrar archivos tipo `133_2.png` antes de procesar.
- **Documentación del proyecto está en español** (README y comentarios). Mantener ese idioma en docs y mensajes orientados al mantenedor.
- **Pendientes y bugs conocidos:** `helpers/notes.txt`.

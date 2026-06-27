# AGSMAC — Guía de mantenimiento del sitio

Documento de referencia para quienes mantienen el sitio de la Asociación de Grupos de Scouts de México A.C. Incluye cómo correr el sitio localmente, dónde vive cada dato, y los scripts para procesar imágenes.

---

## 1. Correr el sitio localmente

Requisitos: Node.js 18+ y npm.

```powershell
# Una sola vez (instala dependencias mínimas: connect, serve-static)
npm install

# Levantar el servidor estático
node server.js
```

El sitio queda disponible en <http://localhost:8082>.

> Cualquier cambio en HTML/CSS/JS se refleja al recargar el navegador. No hay build.

---

## 2. Estructura general del repositorio

```
/
├── index.html              Página principal
├── detail1.html            Plantilla de páginas de detalle
├── server.js               Servidor estático local
├── assets/
│   ├── css/main.css        Estilos globales
│   └── js/main.js          Lógica JS (incluye popup de grupos)
├── includes/
│   ├── *.html              Fragmentos cargados con `includedHtml="…"`
│   └── data/
│       ├── grupos.json     Información de cada Grupo Scout
│       ├── cumpleanos.json Lista de cumpleaños
│       ├── biblioteca.json Catálogo de libros (base + secciones)
│       ├── cuadro-de-adelanto.json Cuadro de Honor (insignias máximas)
│       ├── album-fotografico.json  Álbumes de Google Photos (galería)
│       └── historia.json   Línea del tiempo (GENERADO — no editar a mano)
├── images/
│   ├── grupos/             Pañoletas (PNG transparentes)
│   │   └── Escudos/        Escudos de cada grupo (PNG transparentes)
│   ├── secciones/          Iconos animados de las secciones
│   ├── biblioteca/         Portadas de libros (base/ + secciones/)
│   ├── historia/           Imágenes de la línea del tiempo (<año>-agenda/cinta, etc.)
│   └── pic*.jpg            Imágenes del mosaico de la home
├── pdfs/
│   └── biblioteca/         PDFs descargables de la Biblioteca
├── scripts/
│   ├── optimize-images.js          Optimiza/redimensiona images/
│   └── generar-historia-json.js    Genera includes/data/historia.json
└── helpers/
    ├── procesarEscudos.js          Script de procesado de escudos
    └── generar_portadas_cards.py   Genera portadas-card de libros sin cover real
```

---

## 3. Información de los Grupos Scout

Toda la información que aparece en el popup de la pañoleta vive en  
`includes/data/grupos.json`.

### Esquema por grupo

```json
{
    "Ciudad de México": {
        "Grupo 54": {
            "numero":     "54",
            "nombre":     "Nautilus",
            "jefe":       "Kenia Jiménez",
            "direccion":  "Parque Justicia Social, Casas Alemán",
            "mapsUrl":    "https://maps.app.goo.gl/...",
            "horario":    "10:00 a 12:00 hrs.",
            "telefono":   "55 1234 5678",
            "correo":     "gpo54@agsmac.org",
            "web":        "",
            "facebook":   "https://www.facebook.com/...",
            "instagram":  "",
            "tiktok":     "",
            "youtube":    "",
            "escudo":     "images/grupos/Escudos/54.png",
            "panioleta":  "images/grupos/54.png"
        }
    }
}
```

### Reglas importantes

- **El primer nivel es el estado o ciudad.** El popup muestra el grupo, pero el filtro superior agrupa por este nivel.
- **La clave (`"Grupo 54"`) debe coincidir** con el `data-grupo="Grupo 54"` que está en `index.html` sobre la `<a class="panioleta">`. Si renombras el grupo, actualiza ambos.
- **Campos vacíos no se muestran.** Si un grupo no tiene Facebook pero sí Instagram, deja `facebook: ""` y llena `instagram`.
- **Las URLs deben llevar `https://`** para que los links abran correctamente en pestaña nueva.
- **`mapsUrl`** es opcional. Si está, la dirección se vuelve un link a Google Maps.
- **`telefono`** se muestra tal cual lo escribas, y se vuelve un link `tel:` (limpia automáticamente espacios y guiones para el discado).
- **`escudo`** y **`panioleta`** son rutas relativas desde la raíz del sitio. Si no hay imagen, deja la cadena vacía.

### Agregar un grupo nuevo

1. Añade el bloque al JSON dentro del estado correspondiente.
2. Coloca la pañoleta en `images/grupos/<numero>.png`.
4. Coloca el escudo crudo en `images/grupos/Escudos/<numero>.<ext>` y corre el script de procesado (sección 4).
5. Agrega un `<a class="panioleta" href="#popup1" data-grupo="Grupo XXX">` en `index.html` con su imagen.

---

## 4. Procesar escudos de grupo

Los escudos se muestran sin marco. Para que se vean bien sobre el fondo crema del popup, **deben ser PNG con fondo transparente** y tamaño razonable para web.

### Cuándo correr el script

Cada vez que agregues o reemplaces un archivo en `images/grupos/Escudos/`.

### Cómo correrlo

```powershell
# Desde la raíz del repo
node helpers\procesarEscudos.js
```

### Qué hace

Para cada imagen en `images/grupos/Escudos/`:

1. Redimensiona a máximo 400 px en el lado mayor (preservando proporción).
2. Mira los 4 píxeles de las esquinas. Si son de un color claro y uniforme entre sí (típicamente blanco), considera ese color como fondo y lo vuelve **transparente** con un anti-aliasing suave en el borde.
3. Si las esquinas son oscuras o muy distintas entre sí (caso: la imagen llena todo el cuadro), **no toca el fondo** y solo la convierte a PNG.
4. Exporta como `<nombre>.png`.
5. Elimina el original si no era `.png`.

### Salida típica

```
54.jpg  -> 54.png   (389x400, fondo=255,255,255, transparencia=sí)
50.jpeg -> 50.png   (400x399, fondo=124,155,167, transparencia=no)
```

### Si la transparencia no quedó bien

Causas comunes:

- **Fondo no uniforme** (foto con sombras, gradientes): el script lo deja sin transparencia. Edítalo a mano en Photoshop/GIMP/Photopea exportando PNG con fondo transparente y vuelve a meterlo.
- **El escudo toca los bordes**: el script asume que las esquinas son fondo. Si el escudo llega hasta el borde, recórtalo manualmente dejando un par de píxeles de margen y vuelve a procesarlo.
- **Tolerancia muy estricta/laxa**: ajusta las constantes al inicio de `helpers/procesarEscudos.js`:
  - `COLOR_TOLERANCE` (default 32): qué tan parecido a las esquinas para considerarse fondo.
  - `CORNER_TOLERANCE` (default 55): qué tan parecidas deben ser las 4 esquinas para activar la transparencia.

### Convención de nombres

`<numero-de-grupo>.png`, por ejemplo `54.png`, `729.png`. Sin prefijos ni sufijos. Si el archivo viene como `133_2.png`, renómbralo a `133.png` antes (o después) de procesar.

---

## 5. Pañoletas (carrusel horizontal)

Las pañoletas viven en `images/grupos/*.png` (mismo nombre que el grupo, ej. `54.png`). Son **PNG con fondo transparente** y se muestran en el carrusel marquee de la home.

No requieren script — solo asegúrate de que ya vengan con fondo transparente. Si necesitas procesarlas como los escudos, copia el script y apunta `srcDir` a `images/grupos`.

---

## 6. Cumpleaños

El azulejo de cumpleaños de la home muestra a los cumpleañeros próximos en una animación con globos y nombres letra por letra. La lógica está en `assets/js/birthday-tile.js` y la configuración en `includes/data/cumpleanos.json`.

### Fuentes de datos (en orden de prioridad)

1. **Google Apps Script Web App** — fuente principal. Lee una Google Sheet privada con los cumpleaños y devuelve solo los que están dentro de ±N días alrededor de hoy. La hoja nunca se expone públicamente, solo el endpoint del script.
2. **Lista `birthdays` inline en `cumpleanos.json`** — fallback si el Apps Script no responde.
3. **Mensaje genérico** — último recurso para que el tile nunca se vea roto.

### Archivo `includes/data/cumpleanos.json`

```json
{
    "appsScriptUrl": "https://script.google.com/macros/s/AKfyc.../exec",
    "rangeDays": 20,
    "birthdays": [
        { "name": "Ramirez Soto Stephani V.", "group": "136", "month": 5, "day": 3 },
        { "name": "Morales Murua Lily",       "group": "133", "month": 5, "day": 12 },
        { "name": "Gasca Lopez Mel",          "group": "5",   "month": 5, "day": 21 }
    ]
}
```

Campos:

- **`appsScriptUrl`**: URL pública (termina en `/exec`) del Web App de Apps Script. Si está vacía o no responde, se usa el fallback.
- **`rangeDays`**: ventana en días alrededor de hoy. Default `20`. Se aplica tanto al filtro del Apps Script como al fallback local.
- **`birthdays[]`**: lista inline para el fallback. `group` es solo el número (el JS antepone `Gpo.`), `month` y `day` son enteros (1-12 y 1-31).

### Configurar el Apps Script (primera vez o redeploy)

El código del script y los pasos completos viven en `docs/apps-script-cumpleanos.gs`. Resumen:

1. Abrir la Google Sheet privada con los cumpleaños.
2. Menú **Extensiones → Apps Script**.
3. Pegar el contenido de `docs/apps-script-cumpleanos.gs` en `Code.gs`.
4. Ajustar el objeto `CONFIG` (nombre exacto de la pestaña y columnas: `Nombres`, `Apellido Paterno`, etc.).
5. **Implementar → Nueva implementación → Aplicación web**, ejecutando "Como yo" y con acceso "Cualquier persona".
6. Copiar la URL `/exec` resultante y pegarla en `cumpleanos.json` → `appsScriptUrl`.
7. Autorizar permisos cuando Google los pida.

> **Cada vez que cambies el código del script**, no basta con guardar: hay que hacer **Implementar → Administrar implementaciones → Editar → Nueva versión** para que la URL pública sirva la versión nueva.

> **⚠️ Cumpleaños y Cuadro de Honor son scripts distintos.** Una implementación de Web App ejecuta el único `doGet(e)` del proyecto; **no** se elige el `.gs` por implementación. Si pegas ambos `doGet` en el mismo proyecto colisionan y las dos URLs devuelven lo mismo. Opciones: (a) **dos proyectos separados** (`apps-script-cumpleanos.gs` y `apps-script-cuadro-de-adelanto.gs`), cada uno con su URL; o (b) **un solo proyecto enrutador** con `docs/apps-script-combinado.gs`, que despacha por `?tipo=cumpleanos` / `?tipo=cuadro` (en ese caso los `appsScriptUrl` de los JSON terminan en `.../exec?tipo=cumpleanos` y `.../exec?tipo=cuadro`).

### Actualizar el fallback local

Si el Apps Script estará caído o quieres mostrar nombres específicos sin depender de la hoja, edita el arreglo `birthdays` directamente en `cumpleanos.json`. El JS los filtra a la misma ventana de `rangeDays`.

### Ajustes visuales

Los colores de los globos y comportamiento de la animación están en `assets/js/birthday-tile.js` (`BALLOON_COLORS`, `DEFAULT_RANGE_DAYS`). No requiere build — recargar el navegador.

---

## 7. Cuadro de Honor (galardonados con insignia máxima)

La sección "Cuadro de Honor" (tile en el home, página renderizada en `detail1.html` desde el fragmento `includes/cuadro-de-adelanto.html`) muestra a todas las personas que han recibido una insignia máxima en AGSMAC. La UI muestra **un año a la vez** (seleccionable con el `<select>`, por defecto el más reciente) más una opción **"Todos los años"** que exige tener una insignia seleccionada. Los chips de insignia funcionan como **selección única** (radio): al elegir uno se reemplaza la selección previa; al hacer click sobre el activo se deselecciona. El nombre de archivo `cuadro-de-adelanto.html` se conserva por compatibilidad de enlaces.

La lógica vive en `assets/js/cuadro-de-adelanto.js` y la configuración + datos en `includes/data/cuadro-de-adelanto.json`.

### Insignias soportadas

El orden en el JSON (`insignias`) es **fijo y por edad** y define el orden de despliegue en el timeline: Gran Castor Café → Arcoíris → Lobo Rampante → Ave Fénix → Rosa de los Vientos† → Caballero Scout Tigre† → Caballero Scout Águila → B.P. Precursora → B.P. Rover.

| Clave canónica (JSON) | Sección                   | Distintivo (`image`)                              | Cabecera de grupo (`titleImage`)                                            |
|-----------------------|---------------------------|---------------------------------------------------|------------------------------------------------------------------------------|
| `GRAN CASTOR CAFE`    | Colonia de Castores       | `images/insignias-maximas/GranCastorCafe.png`     | `images/secciones/Colonia de Castores/Gran Castor Cafe.png`                  |
| `ARCOIRIS`            | Manada de Gacelas         | `images/insignias-maximas/Arcoiris.png`           | `images/secciones/Manadas/Manada de Gacelas/Arcoiris.png`                    |
| `LOBO RAMPANTE`       | Manada de Lobatos         | `images/insignias-maximas/LoboRampante.png`       | `images/secciones/Manadas/Manada de Lobatos/Lobo Rampante.png`               |
| `AVE FENIX`           | Tropa de Muchachas Scouts | `images/insignias-maximas/AveFenix.png`           | `images/secciones/Tropas/Tropa de Muchachas Scouts/AveFenix.png`             |
| `ROSA DE LOS VIENTOS`†| Tropa de Muchachas Scouts | `images/insignias-maximas/RosaDeLosVientos.png`   | `images/secciones/Tropas/Tropa de Muchachas Scouts/RosaDeLosVientos.png`     |
| `SCOUT TIGRE`†        | Tropa Scout               | `images/insignias-maximas/CaballeroScoutTigre.png`| `images/secciones/Tropas/Tropa Scout/Caballero Scout Tigre.png`              |
| `SCOUT AGUILA`        | Tropa Scout               | `images/insignias-maximas/CaballeroScoutAguila.png` | `images/secciones/Tropas/Tropa Scout/Caballero Scout Aguila.png`           |
| `B.P. PRECURSORA`     | Clan de Precursoras       | `images/insignias-maximas/BPPrecursora.png`       | `images/secciones/Clanes/Clan de Precursoras/BP Precursora.png`              |
| `B.P. ROVER`          | Clan de Rovers            | `images/insignias-maximas/BPRover.png`            | `images/secciones/Clanes/Clan de Rovers/BPRover.png`                         |

>La clave canónica se normaliza siempre a **mayúsculas sin acentos**.
>
>† **Insignias históricas en desuso.** Llevan `"sinFiltro": true` en el JSON: no generan chip de filtro, pero **sí aparecen en el timeline** cuando hay certificados que las usan (existen registros de quienes las obtuvieron). Para ocultar también sus tarjetas bastaría con no incluir certificados con esa clave.

Cada insignia define dos imágenes: `image` (distintivo limpio, usado en chips de filtro y en las tarjetas) y `titleImage` (versión grande/decorativa, usada como cabecera del bloque de la insignia). Para agregar una insignia nueva, agrégala al mapa `insignias` con `label`, `image` y `titleImage`. Añade `"sinFiltro": true` si la insignia ya no se otorga y solo debe mostrarse cuando existan registros (sin chip de filtro propio).

### Fuentes de datos (en orden de prioridad)

1. **Google Apps Script Web App** — fuente principal. Lee una Google Sheet privada, recorta los nombres y devuelve los galardonados en JSON. La hoja nunca se expone públicamente.
2. **Arreglo `awards[]` inline en `cuadro-de-adelanto.json`** — fallback si el Apps Script no responde o si `appsScriptUrl` está vacío.
3. **Mensaje vacío** — último recurso para que el cuadro nunca se vea roto.

### Archivo `includes/data/cuadro-de-adelanto.json`

```jsonc
{
    "appsScriptUrl": "https://script.google.com/macros/s/AKfyc.../exec",
    "insignias": {
        "GRAN CASTOR CAFE": {
            "label":      "Gran Castor Café",
            "image":      "images/insignias-maximas/GranCastorCafe.png",
            "titleImage": "images/secciones/Colonia de Castores/Gran Castor Cafe.png"
        },
        // ... resto de insignias en orden por edad
    },
    "awards": [
        { "name": "Hernandez Ramirez Andrea Azul", "group": "136", "insignia": "ARCOIRIS", "year": 2026, "clave": "2026-07" }
    ]
}
```

Campos por galardón:

- **`name`**: nombre. En el fallback local puede venir en formato histórico `"Apellido1 Apellido2 Nombre1 [Nombre2 ...]"` (una sola cadena); el cliente lo recorta en runtime a `"PrimerNombre [Inicial2.] ApellidoPaterno [InicialMaterno.]"` (mismo formato que cumpleaños). Cuando los datos vienen del Apps Script, la hoja trae los campos separados (`Apellido Paterno`, `Apellido Materno`, `Nombres`) y el recorte se hace **en el servidor**: el nombre completo nunca sale de la hoja.
- **`group`**: número/identificador de grupo. El JS antepone `Gpo.` automáticamente.
- **`insignia`**: clave canónica (ver tabla arriba).
- **`year`**: año en que se otorgó.
- **`clave`**: identificador del certificado (ej. `2026-07`). Opcional.

> No se usa ningún campo `seccion` ni `date` en este modelo. Si la hoja trae fecha, el script solo extrae el año.

### Configurar el Apps Script (primera vez o redeploy)

El código y los pasos completos viven en `docs/apps-script-cuadro-de-adelanto.gs`. Resumen:

1. Abrir la Google Sheet privada con los galardonados. Columnas esperadas (mismo esquema que cumpleaños): **Apellido Paterno · Apellido Materno · Nombres · Fecha · Insignia · Grupo · Clave**.
2. Menú **Extensiones → Apps Script**.
3. Pegar el contenido de `docs/apps-script-cuadro-de-adelanto.gs` en `Code.gs`.
4. Ajustar `CONFIG` (nombre exacto de la pestaña y de cada columna si difieren). Si tu hoja usa la grafía correcta `B.P. PRECURSORA`, el alias en `INSIGNIA_ALIASES` ya la traduce al id del JSON.
5. **Implementar → Nueva implementación → Aplicación web** (ejecutando "Como yo", acceso "Cualquier persona").
6. Copiar la URL `/exec` y pegarla en `cuadro-de-adelanto.json` → `appsScriptUrl`.
7. Autorizar los permisos cuando Google los pida.

> Cada vez que cambies el código del script, hay que hacer **Implementar → Administrar implementaciones → Editar → Nueva versión** para que la URL pública sirva la versión nueva.

### Privacidad

El endpoint solo devuelve: nombre **recortado** (sin apellido materno completo), grupo, insignia (clave), año (sin día/mes) y clave. La fecha exacta y cualquier columna adicional de la hoja se quedan en privado.

### Caché

El Apps Script trae **todos los registros en una sola llamada** (~10 KB gzipped, despreciable) y se cachea en dos niveles para minimizar latencia y consumo de cuota:

- **Servidor (`CacheService` de Apps Script)**: TTL **6 horas**, clave `cuadro-honor-awards-v1`. Si actualizas la hoja y necesitas refrescar antes, ejecuta la función `clearCache()` desde el editor de Apps Script (Ejecutar → `clearCache`).
- **Cliente (`sessionStorage`)**: TTL **10 minutos**, clave `agsmac:cuadro-honor:v1`. Sobrevive a la navegación entre fragmentos pero se limpia al cerrar la pestaña. Para forzar recarga en el cliente: limpiar storage del sitio o esperar 10 min.

Los filtros (año, insignia) corren totalmente en memoria sobre el dataset cargado — no hacen llamadas adicionales.

### Agregar un galardonado

- **Vía Sheet (recomendado):** agrega una fila a la hoja privada con `Apellido Paterno`, `Apellido Materno`, `Nombres`, `Fecha`, `Insignia`, `Grupo`, `Clave`. Para Baden-Powell, escribe `B.P. PRECURSORA` o `B.P. ROVER` (o cualquier variante reconocida por `INSIGNIA_ALIASES`).
- **Vía fallback local:** agrega un objeto al arreglo `awards[]` del JSON. Puede llevar el nombre completo (el cliente lo recorta) o ya recortado — la función `shortenName` del JS es idempotente.

### Imagen de fondo del card del home

El tile del home (`index.html`) usa `images/insignias-maximas/max.jpg` (versión optimizada, ~187 KB). Si la reemplazas con un PNG grande, conviértelo con jimp o con `npm run optimize-images:write` para evitar subir varios MB al repo.

---

## 7.b. Álbum Fotográfico (galería de álbumes de Google Photos)

La sección **Álbum Fotográfico** (tile en el home, fragmento `includes/album-fotografico.html` renderizado por `assets/js/album-fotografico.js`) muestra los álbumes compartidos de Google Photos de la asociación. La UI permite filtrar por **año** (`<select>`, por defecto el más reciente) y por **sección** (chips, selección única). Cada tarjeta abre el álbum original en Google Photos en una pestaña nueva.

### Fuente de datos: `includes/data/album-fotografico.json`

Generado por el proyecto **[galeriaPublica](../galeriaPublica)** (repo separado, herramienta local). Estructura:

```jsonc
{
    "generatedAt": "2026-06-15T...",
    "albums": [
        {
            "title": "2024/07 Campamento Nacional TMS",   // título original en Google Photos
            "displayTitle": "Campamento Nacional TMS",     // sin prefijo de fecha
            "url": "https://photos.google.com/share/...",
            "thumbnail": "https://lh3.googleusercontent.com/...",
            "year": 2024,
            "month": 7,
            "sections": ["tropa-muchachas"]
        }
    ]
}
```

### Convención de títulos en Google Photos

El parser de `galeriaPublica/scripts/parseTitle.js` extrae:

- **Año y mes**: prefijo `YYYY/MM ` o `YYYY-MM ` al inicio del título. Si no, `year = null` (cae en "Sin año").
- **Sección**: keywords en el título, case-insensitive, con límites de palabra (`\b`).

| Keyword en el título               | Sección asignada                                                |
|------------------------------------|------------------------------------------------------------------|
| `CC` o `Castor(es)`                | `castores`                                                       |
| `TMS`                              | `tropa-muchachas`                                                |
| `TS` o `Tropa Scout`               | `tropa-scout`                                                    |
| `ML` o `Manada`                    | `manada`                                                         |
| `CCM` o `Comunidad`                | `comunidad`                                                      |
| `CR` o `Clan`                      | `clan`                                                           |
| `Tropas` (plural, sin TS/TMS)      | `tropa-muchachas` **y** `tropa-scout` (ambas)                    |
| Ninguna coincidencia               | `general`                                                        |

Para extender el vocabulario edita `SECTION_RULES` en `galeriaPublica/scripts/parseTitle.js` **y** `SECTION_LABELS`/`SECTION_ORDER` en `assets/js/album-fotografico.js` (deben mantenerse en sync).

### Workflow para publicar un álbum nuevo

1. Subes y editas las fotos en Google Photos (tu flujo habitual).
2. Marcas el álbum como compartido (link público) y le pones nombre con la convención `YYYY/MM Nombre [keywords]`.
3. En tu máquina, en el proyecto `galeriaPublica`:
   ```powershell
   cd ..\galeriaPublica
   npm run generar -- --output ..\agsmac\includes\data\album-fotografico.json --incremental
   ```
   - `--incremental` reusa miniaturas de álbumes ya conocidos (más rápido).
   - El script auto-scrollea Google Photos hasta cargar todos los álbumes (ya no requiere ENTER manual).
4. Vuelves al repo `agsmac`, commit + push de `includes/data/album-fotografico.json`.

### Mantenimiento

- **Cookies expiradas**: si el scraper de `galeriaPublica` deja de detectar álbumes, vuelve a exportar las cookies de `photos.google.com` con EditThisCookie y reemplaza `galeriaPublica/scripts/cookies.json`.
- **Selector de Google roto**: si el conteo da `0`, Google cambió el markup. Actualiza el selector `a.MTmRkb[data-shared="true"]` en `galeriaPublica/scripts/generarAlbums.js`.
- **API de Photos**: actualmente solo se usa como fallback de miniaturas (la mayor parte del API fue deprecada para apps de terceros en 2025). El thumbnail real viene de `og:image`.

---

## 7.c. Nuestra Historia (línea del tiempo)

La página **Nuestra Historia** (fragmento `includes/historia.html`, renderizado por `assets/js/historia-timeline.js`) muestra una línea del tiempo *master-detail* con los hitos de AGSMAC. Los datos viven en `includes/data/historia.json`, pero **ese archivo es generado: no se edita a mano.**

### Cómo funciona (fuente de verdad vs. salida)

- **Fuente de verdad:** `scripts/generar-historia-json.js`.
- **Salida generada:** `includes/data/historia.json` (se sobrescribe cada vez que corres el script).

El flujo siempre es: editas el `.js` (o agregas una imagen) → corres el script → se reescribe el `.json` → commiteas **ambos** archivos.

```powershell
# Desde la raíz del repo
node scripts/generar-historia-json.js
```

> **No es automático en el deploy.** El único workflow de CI (`optimize-images.yml`) sólo comprime imágenes; no regenera `historia.json`. Como GitHub Pages sirve la rama principal tal cual (sin build), el JSON se versiona ya generado. Corre el script **sólo cuando cambies algo de la historia** y commitea el resultado.

### El script combina dos tipos de hitos

1. **Hitos manuales** (`manualHitos` en el `.js`) — eventos institucionales/importantes: fundación, reconocimientos, jamborees, publicaciones, *in memoriam*. Se escriben a mano como objetos del arreglo.
2. **Hitos de memorabilia** (automáticos) — se generan solos por cada año que tenga archivos en `images/historia/<año>-agenda.{jpg,png}` y/o `images/historia/<año>-cinta.{jpg,png}`. No se escriben en el `.js`; basta con dejar la imagen con ese nombre y volver a correr el script.

### Esquema de un hito manual

```jsonc
{
    "id": "jamboree-2015",          // identificador único (kebab-case)
    "anio": 2015,                    // año numérico (obligatorio; ordena y agrupa)
    "fecha": "2015-07-28",           // opcional, texto libre mostrado como fecha
    "destacado": true,               // opcional, marcador más grande en el timeline
    "categoria": "evento",           // ver categorías abajo
    "titulo": "23.º Jamboree Mundial — Japón",
    "resumen": "Texto corto para la tarjeta del timeline.",
    "descripcion": "<p>HTML del panel de detalle…</p>",
    "imagenes": [
        { "src": "images/historia/2015-jamboree.jpg", "alt": "Descripción" }
    ],
    "enlaces": [
        { "tipo": "pdf", "label": "Documento (PDF)", "url": "documentos/historia/x.pdf" }
        // tipo: 'pdf' | 'externo'  · las URLs externas requieren https://
    ]
}
```

Para un hito *in memoriam* se añade además un objeto `persona` (`nombre`, `anios`, `rol`, `foto`, `bioUrl`).

### Categorías válidas

`institucional` · `evento` · `memorabilia` · `publicacion` · `memoriam`

(Definidas en `CATEGORIAS` dentro de `assets/js/historia-timeline.js`; si agregas una nueva, declárala también ahí.)

### Agregar / modificar un hito

- **Evento, reconocimiento o in memoriam:** edita el arreglo `manualHitos` en `scripts/generar-historia-json.js`, corre el script y commitea el `.js` + `historia.json`.
- **Agenda o cinta de un año nuevo:** coloca la imagen como `images/historia/<año>-agenda.jpg` (o `-cinta`), corre el script — la tarjeta de memorabilia se crea sola — y commitea la imagen + `historia.json`.
- **Corregir un texto existente:** edita el objeto correspondiente en el `.js` y regenera.

> Regla de oro: **nunca edites `historia.json` directamente**; los cambios se pierden en la siguiente regeneración.

---


La sección **Biblioteca** (`includes/biblioteca.html`, renderizada por
`assets/js/biblioteca.js`) muestra dos catálogos distintos a partir de un único
JSON:

- **`base`** — clásicos del escultismo (Baden-Powell, Kipling) traducidos por
  la AGSMAC. Cada uno tiene portada + descripción + botones de leer/descargar
  el PDF.
- **`secciones`** — manuales internos de la AGSMAC (Manual del Castor, Planes
  de Adelanto, Recorridos, etc.). **No** se publica el PDF: la card invita a
  pedir el material en físico al scouter.

Archivos:

| Pieza | Ubicación |
| --- | --- |
| Catálogo | `includes/data/biblioteca.json` |
| Render | `assets/js/biblioteca.js` (cargado desde `detail1.html`) |
| Layout + estilos | `includes/biblioteca.html` (con `<style>` scoped `.bib-*`) |
| PDFs descargables | `pdfs/biblioteca/<slug>.pdf` |
| Portadas libros base | `images/biblioteca/portadas-base/<slug>.{png,jpg}` |
| Portadas libros internos | `images/biblioteca/portadas-secciones/<slug>.{png,jpg}` |

### Cómo agregar un libro a la bibliografía base

1. Coloca el PDF en `pdfs/biblioteca/<slug>.pdf` (slug en kebab-case sin
   acentos ni espacios).
2. Coloca la portada en `images/biblioteca/portadas-base/<slug>.{png,jpg}`.
   - Si no consigues portada real, agrega una entrada al arreglo `BOOKS` de
     `helpers/generar_portadas_cards.py` y corre el script: genera una card
     estilizada (fondo + título + autor) con proporción 2:3.
3. Agrega un bloque al arreglo `base` de `biblioteca.json` con `slug`,
   `titulo`, `autor`, `anio`, `portada`, `pdf`, `descripcion`.

### Cómo agregar un libro de trabajo (sección AGSMAC)

1. Coloca la portada en `images/biblioteca/portadas-secciones/<slug>.{png,jpg}`.
2. Agrega un bloque al arreglo `secciones` con `slug`, `titulo`, `seccion`,
   `portada`, `descripcion`. **No** incluyas `pdf`.

### Sobre los derechos

Los libros base publicados son de Baden-Powell (m. 1941) y de R. Kipling
(m. 1936), por lo que sus obras de 1908–1941 están en dominio público en
México (vida + 100 años) y prácticamente toda jurisdicción. Las traducciones
fueron publicadas por la AGSMAC para uso del Movimiento. Antes de agregar
material moderno, verifica los derechos.

---

## 8.b. Pre-registro a Academias (ConCuScout 2026 — evento temporal)

Página de un solo uso para que los muchachos se pre-registren a **3 de las 7
academias** de la Convivencia Cultural Scout. No reutiliza el mecanismo de
`includedHtml`; es autocontenida y se puede borrar tras el evento.

### Archivos

| Archivo | Rol |
| ------- | --- |
| `concuscout.html` | Página del registro (comparte el link directo, p. ej. `…/concuscout.html`). |
| `assets/css/concuscout.css` | Estilos propios (no toca `main.css`). |
| `assets/js/concuscout.js` | Carga academias, muestra cupos en vivo y envía el registro. |
| `includes/data/academias.json` | Configuración: academias, talleres, cupo, secciones y `appsScriptUrl`. |
| `docs/apps-script-academias.gs` | Backend (Google Apps Script + Google Sheet). |

### Cómo funciona

- El chico ve 7 tarjetas (una por academia) con sus talleres, elige **exactamente
  3** y captura su **nombre en 3 campos** (Nombre(s), Apellido paterno —
  obligatorio—, Apellido materno —opcional—), **grupo** y **sección** (ambos
  desplegables, definidos en `academias.json` → `grupos` y `secciones`).
- **No se muestra** el número de lugares disponibles (para no inducir sesgo de
  registro); solo se marca una academia como **"Academia llena"** cuando alcanza
  el tope, y entonces deja de poder elegirse.
- El **control real** lo hace el Apps Script con `LockService` (atómico):
  rechaza duplicados (clave `nombre|grupo|sección` normalizada, sin acentos) y
  bloquea cualquier academia que ya tenga **60** (luego se divide en 3 bloques de
  20). El cupo se ajusta con `CONFIG.MAX` en el `.gs` y `cupoMaximo` en el JSON.
- **Cotejo difuso de nombres:** además del duplicado exacto, si el nombre se
  parece mucho a uno ya registrado en el **mismo grupo y sección** (acentos,
  typos, apellido faltante u orden distinto — Levenshtein + tokens en el `.gs`),
  el registro se pausa y se pregunta *"¿Eres tú?"*. El usuario elige **"Sí, soy
  yo"** (no se duplica) o **"No, soy otra persona"** (se registra igual, enviando
  `confirmDifferent`). Los umbrales viven en `nameSimilar()` del `.gs`.
- **Orden de las tarjetas por cupo disponible:** al cargar, las academias se
  ordenan mostrando primero las **menos llenas** (con desempate aleatorio cuando
  empatan, p. ej. todas en 0), para empujar una distribución pareja sin revelar
  números. El orden se **congela** en cuanto el muchacho elige su primera
  academia, para que las tarjetas no salten mientras decide (`reorderIfIdle()` en
  `concuscout.js`).
- **Caché de conteos (no es tiempo real):** los conteos se guardan en
  `localStorage` con un TTL (`countsCacheMinutes` en `academias.json`, por
  defecto **5 min**). Dentro de esa ventana las recargas usan el caché (carga
  instantánea, mismo orden, sin consultar el Apps Script); fuera de ella —o en
  otro dispositivo— se consulta de nuevo y el orden refleja la disponibilidad
  **aproximada** de ese momento. Al registrar con éxito, el caché se actualiza
  con los conteos que devuelve el servidor. Pon `countsCacheMinutes: 0` para
  desactivar el caché y consultar siempre.

### Configurar (primera vez)

1. Sigue los pasos al inicio de `docs/apps-script-academias.gs` (crear Sheet,
   pegar el script, correr `setup`, implementar como Web App "Cualquier persona").
2. Pega la URL `/exec` en `includes/data/academias.json` → `appsScriptUrl`.
   Mientras esté vacía, la página muestra un aviso y deshabilita el registro.
3. Tras cualquier cambio al `.gs`, **redeploy** (Administrar implementaciones →
   Nueva versión), igual que con el Apps Script de cumpleaños.

### Administrar cambios y cupos

- Una vez enviado, el participante **no** puede editar su elección. Si te lo
  piden verbalmente, edítalo tú en la hoja (columnas `Academia 1/2/3`) o borra la
  fila para liberar el lugar; los conteos se recalculan solos.
- Para ajustar talleres/colores/descripciones de las tarjetas, edita
  `includes/data/academias.json` (los `id` deben coincidir con `ACADEMY_IDS` del
  `.gs`).

### Talleres (descripción, material y preparación)

Cada elemento de `talleres` puede ser un **texto** simple o un **objeto** con más
detalle. En la tarjeta, cada taller es un chip tocable que abre su ficha:

```json
"talleres": [
  "Teatro",
  {
    "nombre": "Tallado",
    "descripcion": "Talla madera o jabón para crear piezas con tus manos.",
    "material": "Una barra de jabón blanco y un palito de madera.",
    "preparacion": "Trae las uñas cortas."
  }
]
```

- Solo `nombre` es obligatorio. `material` y `preparacion` se muestran únicamente
  si tienen contenido (bloques azul y naranja en la ficha del taller).
- El chip muestra un icono **ⓘ** cuando el taller tiene descripción/material/
  preparación. Conforme tengas la info de cada taller, llénala aquí; no requiere
  tocar el `.gs`.
- La página incluye un bloque **"¿Cómo funciona?"** que explica la dinámica: cada
  quien elige academias por los talleres que le interesan y hace **uno o varios**
  (no todos) dentro de cada academia. El texto vive en `concuscout.html`.

---

## 9. Convenciones de código

- **JS**: jQuery 1.x + skel. Sin transpilación. Mantén compatibilidad ES5 en lo posible (las funciones flecha y `const` ya se usan, pero evita features muy nuevas si las metes en `main.js`).
- **CSS**: un solo archivo `assets/css/main.css`. Las secciones están marcadas con comentarios `/* nombreSeccion */`.
- **HTML modular**: cualquier `<div includedHtml="/includes/X.html">` se rellena en runtime con el contenido del archivo. Útil para reutilizar bloques.

---

## 10. Despliegue

El sitio es 100% estático. Se publica en GitHub Pages desde la rama principal. Cualquier cambio en `main` se refleja en pocos minutos.

---

## 11. Pendientes / mejoras conocidas

Ver `helpers/notes.txt` para la lista actual de pendientes y bugs.

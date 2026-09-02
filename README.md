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
│       ├── calendario.json Calendario de Actividades (escudos bordados)
│       ├── trivia.json     Trivia del Rally (SOLO backend y textos, sin preguntas)
│       └── historia.json   Línea del tiempo (GENERADO — no editar a mano)
├── images/
│   ├── grupos/             Pañoletas (PNG transparentes)
│   │   └── Escudos/        Escudos de cada grupo (PNG transparentes)
│   ├── secciones/          Iconos animados de las secciones
│   ├── biblioteca/         Portadas de libros (base/ + secciones/)
│   ├── historia/           Imágenes de la línea del tiempo (<año>-agenda/cinta, etc.)
│   ├── trivia/             Imágenes de las preguntas de la trivia del Rally
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

El código del script y los pasos completos viven en `docs/apps-script-combinado.gs` (un solo proyecto enrutador que sirve cumpleaños **y** cuadro de honor). Resumen:

1. Abrir la Google Sheet privada con los cumpleaños.
2. Menú **Extensiones → Apps Script**.
3. Pegar el contenido de `docs/apps-script-combinado.gs` en `Code.gs`.
4. Ajustar el objeto `CUMPLE_CONFIG` (nombre exacto de la pestaña y columnas: `Nombres`, `Apellido Paterno`, etc.).
5. **Implementar → Nueva implementación → Aplicación web**, ejecutando "Como yo" y con acceso "Cualquier persona".
6. Copiar la URL `/exec` resultante y pegarla en `cumpleanos.json` → `appsScriptUrl`, **añadiendo** `?tipo=cumpleanos` al final.
7. Autorizar permisos cuando Google los pida.

> **Cada vez que cambies el código del script**, no basta con guardar: hay que hacer **Implementar → Administrar implementaciones → Editar → Nueva versión** para que la URL pública sirva la versión nueva.

> **⚠️ Cumpleaños y Cuadro de Honor los sirve un solo proyecto enrutador.** Una implementación de Web App ejecuta el único `doGet(e)` del proyecto; **no** se elige el `.gs` por implementación. Por eso ambos endpoints se sirven desde `docs/apps-script-combinado.gs`, que despacha por el parámetro `?tipo=`: los `appsScriptUrl` de los JSON usan la **misma** URL base `/exec` terminando en `.../exec?tipo=cumpleanos` y `.../exec?tipo=cuadro` respectivamente.

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

El código y los pasos completos viven en `docs/apps-script-combinado.gs` (el mismo proyecto enrutador que sirve cumpleaños). Resumen:

1. Abrir la Google Sheet privada con los galardonados. Columnas esperadas (mismo esquema que cumpleaños): **Apellido Paterno · Apellido Materno · Nombres · Fecha · Insignia · Grupo · Clave**.
2. Menú **Extensiones → Apps Script**.
3. Pegar el contenido de `docs/apps-script-combinado.gs` en `Code.gs` (si ya lo pegaste para cumpleaños, es el **mismo** archivo: no lo dupliques).
4. Ajustar `CUADRO_CONFIG` (nombre exacto de la pestaña y de cada columna si difieren).
5. **Implementar → Nueva implementación → Aplicación web** (ejecutando "Como yo", acceso "Cualquier persona").
6. Copiar la URL `/exec` y pegarla en `cuadro-de-adelanto.json` → `appsScriptUrl`, **añadiendo** `?tipo=cuadro` al final.
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

Para extender el vocabulario edita `SECTION_RULES` en `galeriaPublica/scripts/parseTitle.js` **y** el `SECTION_ORDER` (y, si es un slug nuevo, el índice `ALIASES` del catálogo compartido `assets/js/secciones.js`) en `assets/js/album-fotografico.js` (deben mantenerse en sync). Los nombres completos y emblemas de cada sección viven en `assets/js/secciones.js` (ver §9 → «Secciones (catálogo compartido)»).

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

## 7.d. Calendario de Actividades

La sección **Calendario de Actividades** (tile en el home, fragmento `includes/calendario.html` renderizado por `assets/js/calendario.js`) presenta el año scout con el diseño **"Escudos bordados"**: cada actividad es un escudo/parche que se cose a un tablero, y cada **fecha simbólica** es un pin de esmalte.

Decisiones de diseño (intencionales):

- **No se muestran fechas exactas de las actividades**, solo el mes. Las **efemérides sí** pueden llevar día (son fechas fijas). Los miembros conocen las fechas exactas por su grupo.
- Las **próximas** aparecen primero (escudos "sueltos", con listón **"Próxima"** en la primera actividad) y las **ya realizadas** después, en una fila aparte (escudos "cosidos" con punto cruz, atenuados y fijos). El reacomodo próxima/pasada es **automático** según el mes y año actuales.
- El **año** mostrado es el actual por defecto; puedes fijarlo con el campo `anio`.

### Fuente de datos: `includes/data/calendario.json`

Es el **único** archivo a editar. Estructura:

```jsonc
{
  "anio": 2026,                 // opcional; si se omite, usa el año en curso
  "intro": "Texto introductorio…",
  "actividades": [
    {
      "titulo": "Campamento Nacional",
      "mes": 8,                 // 1–12 (obligatorio; ordena y calcula próximas/pasadas)
      "icono": "fa-fire",       // clase de Font Awesome 4.5 (ver abajo)
      "descripcion": "Texto breve y opcional.",
      "secciones": "todas"      // "todas" o arreglo de secciones (ver abajo)
    },
    {
      "titulo": "Día del Pensamiento",
      "mes": 2,
      "dia": 22,                // SOLO efemérides: día del mes (fecha fija)
      "icono": "fa-globe",
      "descripcion": "…",
      "tipo": "efemeride"       // marca la fecha simbólica (pin de esmalte)
    }
  ]
}
```

Campos de cada entrada:

| Campo         | Obligatorio | Descripción |
|---------------|-------------|-------------|
| `titulo`      | Sí          | Nombre que se muestra en el escudo/pin. |
| `mes`         | Sí          | 1–12. Ordena las tarjetas y decide si es próxima o pasada. |
| `tipo`        | No          | `"actividad"` (por defecto) = escudo bordado; `"efemeride"` = pin de esmalte (fecha simbólica). |
| `dia`         | No          | Día del mes (1–31). **Solo tiene efecto en efemérides**; las actividades no muestran día. |
| `icono`       | No          | Clase de **Font Awesome 4.5** (p. ej. `fa-tree`, `fa-fire`, `fa-flag`, `fa-compass`, `fa-heart`, `fa-star`, `fa-globe`, `fa-birthday-cake`). Por defecto `fa-calendar`. Íconos de FA5+ **no** existen en esta versión. |
| `descripcion` | No          | Texto breve. Puede omitirse (el escudo se ve bien solo con título). |
| `secciones`   | No          | `"todas"` (emblema **General** → flor de lis azul) o un arreglo con los **acrónimos** de sección (ver abajo). Solo aplica a actividades. |
| `color`       | No          | Sobrescribe el degradado del escudo con cualquier valor CSS de `background` (p. ej. `"linear-gradient(135deg,#c0392b,#8e44ad)"`). Por defecto se asigna un color por mes. |

Acrónimos de sección válidos para `secciones` (deben coincidir **exactamente**; cada uno usa su emblema de `images/secciones/<ACRONIMO>.gif` y su nombre completo sale del catálogo compartido, ver §9 → «Secciones (catálogo compartido)»):

`CC`, `MG`, `ML`, `TMS`, `TS`, `CP`, `CR`, `J`.

### Agregar o editar una actividad

1. Abre `includes/data/calendario.json` y agrega un objeto al arreglo `actividades` con al menos `titulo` y `mes`.
2. Para una **fecha simbólica** (no actividad de asociación), añade `"tipo": "efemeride"` y, si quieres, `"dia"`.
3. Elige un `icono` de Font Awesome 4.5 y, opcionalmente, las `secciones` participantes.
4. Guarda y recarga el navegador (no hay build). El orden y el estado próxima/pasada se calculan solos.

> Al iniciar un nuevo ciclo, basta con actualizar la lista de `actividades` (y `anio` si lo fijaste); no hay que tocar el HTML/JS/CSS.

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
| `academias-jefes.html` | **Panel de Jefes**: consulta de registrados por grupo/sección + material (comparte `…/academias-jefes.html` solo con jefes). |
| `assets/css/academias-jefes.css` | Estilos del panel (reutiliza clases `cc-*` de `concuscout.css`). |
| `assets/js/academias-jefes.js` | Lógica del panel: pide grupo + clave y lista los registrados. |
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

### Ficha y material por academia (PDF)

Una academia puede tener, a nivel **academia** (no taller), dos campos opcionales
en `academias.json`:

```json
{
  "id": "escultura",
  "...": "...",
  "fichaPdf": "pdfs/concuscout/escultura.pdf",
  "material": {
    "porSeccion": {
      "Castores": "tijeras de punta roma y medio palo de escoba.",
      "Manadas": "costurero, tijeras, jabón Zote, ...",
      "Tropas": "costurero, gis, tijeras y tu bordón."
    },
    "general": "Duración del taller: 90 minutos."
  }
}
```

- `material` puede ser **texto** (general, se muestra igual para todos —p. ej.
  Gastronomía) **o** un **objeto** con `porSeccion` (cada sección ve su bloque
  etiquetado, con el aviso "Busca tu sección") y un `general` opcional al final.
  Así, si el requerimiento depende de la sección no se confunde a nadie.
- Si la academia tiene `fichaPdf` o `material`, su tarjeta muestra un botón
  **"📄 Material y ficha"** que abre un modal con: la descripción, el bloque de
  **material** y la **ficha completa** embebida en un `<iframe>` + un botón
  "Abrir en pantalla completa".
- Los **PDF** viven en `pdfs/concuscout/`. Para sumar la ficha de otra academia:
  pon el PDF ahí y agrega `fichaPdf`/`material` al objeto de esa academia.
- **Convertir docx→PDF** (como se hizo con Gastronomía): se usó Word
  (`ExportAsFixedFormat`). Los pósters/fichas se publican **tal cual los
  prepararon los dirigentes**; las correcciones de texto se hacen en el campo
  `material` (limpio), no en el PDF.
- Pendientes de material por confirmar: ver `helpers/notes.txt`.

### Panel de Jefes (consulta de registros)

Página aparte (`academias-jefes.html`) para que **cada jefe de grupo** consulte
quién de su grupo ya se registró —agrupado por sección— y a quiénes recordarles
el material que deben llevar.

- **Un enlace secreto por grupo (sin clave ni selector).** Cada grupo tiene un
  **token único e imposible de adivinar**; el jefe abre su URL privada
  `…/academias-jefes.html?g=<token>` y ve **solo** los registros de su grupo. No
  se elige grupo ni se escribe contraseña: el enlace único **es** el control de
  acceso, así que compártelo únicamente con el jefe de cada grupo.
- **El mapeo token→grupo vive solo en el servidor** (`CONFIG.GROUP_TOKENS` en
  `docs/apps-script-academias.gs`), **nunca** en un JSON del sitio. Así nadie
  puede leer ni adivinar los tokens de otros grupos. Pon un token largo y
  aleatorio por grupo (genera con `Utilities.getUuid()` o cualquier cadena larga)
  **en el editor de Apps Script**, no en el repo.
- **Endpoint.** El token viaja por **POST** `{action:'list', token}` al mismo
  `/exec` (por POST, para no exponerlo en la URL ni en los logs). Lo atiende
  `handleList()` en el `.gs`, que resuelve el grupo con `tokenToGroup()` y
  devuelve solo sus registros. Tras editar el `.gs`, **redeploy** (Nueva versión).
- **Dos vistas:**
  - **Por sección:** una **tabla** con los registrados del grupo agrupados por
    sección (nombres numerados). Junto a cada muchacho que requiere material
    aparece un botón **🧰** que abre un popup con **el material que le toca según
    su sección** (resuelto con `seccionRama` + el resolutor por tokens de
    `academias-jefes.js`, que entiende etiquetas compuestas como
    "Castores, Gacelas y Lobatos" o universales como "TODOS"). Pensada para verse
    en celular o imprimirse (estilos `@media print`; el botón 🧰 se oculta al
    imprimir).
  - **Recordatorios de material:** solo las academias con `material` (hoy
    Escultura y Gastronomía). Muestra la **lista completa de material de la
    academia** (todas las secciones, tal cual en `academias.json`) y debajo, en
    **una sola tabla con la sección como columna**, los inscritos del grupo (un
    nombre por fila). El jefe le dice a cada muchacho lo que le toca según su
    sección.
- No requiere datos nuevos: reutiliza `academias.json` (academias, `secciones`,
  `material`, `appsScriptUrl`) y la misma hoja de registros.

**Dar de alta un grupo en el panel:** agrega su entrada a `CONFIG.GROUP_TOKENS`
en el `.gs` (grupo → token), redeploy, y comparte `…/academias-jefes.html?g=<token>`
con su jefe.

---

## 8.c. VIII Rally Virtual (evento temporal, septiembre 2026)

Convocatoria como página estilo videojuego (`rally.html`) con registro integrado, más un
servidor de Discord que funciona como cuartel general del evento.

### Archivos

| Archivo | Para qué |
|---|---|
| `rally.html` | La convocatoria. **Fuente de verdad del contenido.** |
| `assets/js/rally-adventure.js` | Motor: modos de vista, tablero de cargos, registro. |
| `assets/js/rally.js`, `assets/css/rally*.css` | Efectos y estilos. |
| `includes/data/rally.json` | **Fuente única** de fechas, cargos, banco, tutoriales y `appsScriptUrl`. |
| `docs/apps-script-rally.gs` | Backend del registro (Apps Script + Google Sheet). |
| `helpers/discord/` | Scripts que arman y operan el servidor de Discord. |
| `docs/discord-servidor.md` | Guía del servidor de Discord (con script y a mano). |
| `Temp/VIIIRally/00-CONTEXTO.md` | Decisiones y acuerdos del evento. |
| `trivia.html` + `ranklist-trivia.html` | La trivia de la base de conocimientos y su ranklist (ver 8.d). |

### Servidor de Discord

Todo el detalle está en **`docs/discord-servidor.md`**. Resumen:

```powershell
$env:DISCORD_TOKEN = "el-token-del-bot"   # nunca en un archivo del repo

node helpers\discord\setup.js --dry       # ensayo, no toca nada
node helpers\discord\setup.js             # crea roles, canales y permisos
node helpers\discord\abrir-base.js        # durante el evento: abre cada base a su hora
node helpers\discord\abrir-base.js 3      # abrir la base 3 a mano
node helpers\discord\abrir-base.js --estado
```

- **Sin dependencias**: hablan directo con la API de Discord usando el `fetch` de Node 18+.
- **Idempotentes**: `setup.js` sólo crea lo que falta, así que se puede correr las veces
  que haga falta sin duplicar nada.
- La configuración (servidor, bases, horarios) vive en `helpers/discord/config.json`.
  **El token del bot no**: va por variable de entorno.
- Los canales de las bases nacen **ocultos** y se abren a su hora, porque los retos se
  revelan hora por hora.
- **No hay roles por patrulla.** Cada participante se identifica con su apodo,
  `Nombre · Patrulla · Grupo`. Sólo existen los roles **Comité** y **Jefe de Base**.

### La invitación de Discord

Se pone en `includes/data/rally.json` → `evento.discordInvite`. En cuanto tenga valor,
los botones «ENTRAR AL DISCORD» aparecen solos en `rally.html` (elementos marcados con
`data-discord`); mientras esté vacía se muestra un aviso de "próximamente" en su lugar.
**No hay que tocar el HTML.**

---

## 8.d. Trivia del Rally (base de conocimientos)

Trivia por niveles para una base del Rally: se presenta **una sola pregunta a la vez** y
hasta que la patrulla la responde correctamente se desbloquea la siguiente. Al acertar se
muestra un **dato curioso**. La respuesta es abierta (por lo general una o dos palabras).
El **ranklist en vivo** está en su propia página, para poder dejarlo abierto en otra
pantalla durante el evento.

Ambas páginas son internas: llevan `noindex` y **no están enlazadas desde ningún menú**. Se
comparten por el canal de la base en Discord.

### Archivos

| Archivo | Para qué |
|---|---|
| `trivia.html` | La trivia: acceso y juego. |
| `ranklist-trivia.html` | El ranklist, como página aparte. No pide identificarse. |
| `assets/js/trivia.js` | Motor del juego: acceso, pregunta actual, intentos. Sin jQuery. |
| `assets/js/trivia-ranklist.js` | Solo el ranklist: consulta, tabla y refresco automático. |
| `assets/css/trivia.css` | Estilos de ambas páginas. Hereda fondo y tipografías de `rally.css`. |
| `includes/data/trivia.json` | `appsScriptUrl` y los textos de la portada. **No contiene preguntas.** |
| `docs/apps-script-trivia.gs` | Backend **y banco de preguntas inicial** (Apps Script + Google Sheet). |
| `images/trivia/` | Imágenes de las preguntas ilustradas. |

### Por qué las respuestas NO viven en el repositorio

Todo lo que se publica en GitHub Pages es público: un JSON con las respuestas se lee con
«ver código fuente». Por eso las preguntas **y** sus respuestas viven en la Google Sheet
privada, y el sitio solo pide la pregunta del nivel en el que va la patrulla y manda el
intento al backend para que lo compare. Nunca se entrega la siguiente pregunta sin haber
resuelto la de en medio.

### Configurar (primera vez)

1. Crea una Google Sheet nueva → Extensiones → Apps Script.
2. Pega **todo** `docs/apps-script-trivia.gs` en `Code.gs`.
3. Ajusta `CONFIG` (sobre todo `APERTURA` y `CIERRE`).
4. Ejecuta la función `setup` una vez: crea las hojas `Preguntas`, `Avance` e `Intentos`
   y carga las **69 preguntas** iniciales.
5. Implementar → Nueva implementación → Aplicación web · Ejecutar como **yo** · Acceso
   **cualquier persona**.
6. Pega la URL `/exec` en `includes/data/trivia.json` → `appsScriptUrl`.

Mientras `appsScriptUrl` esté vacía, la página carga pero avisa que la trivia no está
habilitada y deshabilita el botón de entrar.

### Configurar las preguntas

Se editan **en la hoja `Preguntas`**, una fila por nivel. Los niveles se juegan en el orden
de la columna `Nivel`; poner `Activa = NO` saca una pregunta sin borrarla y los niveles se
renumeran solos.

| Columna | Qué va |
|---|---|
| `Nivel` | Orden. |
| `Activa` | `SI` / `NO`. |
| `Pista` | Palabra corta que encabeza la pregunta (`Nudo`, `Fundador`…). Puede ir vacía. |
| `Enunciado` | La pregunta. Puede ir vacía si la imagen se explica sola. |
| `Imagen` | `images/trivia/xxx.png` o URL completa. Vacío = pregunta de solo texto. |
| `Respuestas` | Respuestas aceptadas separadas por `\|`. |
| `Explicacion` | Dato curioso que se muestra al acertar. |

**Editar la hoja NO requiere volver a implementar el Apps Script** (se lee en vivo). Solo
cambiar el código `.gs` obliga a publicar una versión nueva.

### Cómo se compara una respuesta

Siempre se ignoran mayúsculas, acentos, signos, espacios de sobra y artículos iniciales
(`el`, `la`, `un`, `nudo de`, `insignia de`…). Además, cada opción de la columna
`Respuestas` admite un prefijo:

| Escribes | Significa |
|---|---|
| `ballestrinque` | Normal. Perdona erratas pequeñas según `CONFIG.TOLERANCIA`. |
| `=1908` | Exacta, sin tolerancia. **Úsalo siempre para números** (si no, `1918` pasaría por `1908`). |
| `~gilwell` | Acierta si la respuesta escrita contiene ese texto. |
| `#lealtad abnegacion pureza` | Deben aparecer todas esas palabras, en cualquier orden. |

Ejemplo: `rizo|nudo de rizo|llano|cuadrado`

### Ranklist y desempate

Vive en **`ranklist-trivia.html`**, aparte de la trivia, para poder proyectarlo o dejarlo
abierto en otra pantalla mientras las patrullas juegan. No pide identificarse: cualquiera
con el enlace lo ve. Si en ese navegador hay una sesión de trivia guardada, resalta la fila
de esa patrulla. Desde `trivia.html` se llega con el botón **VER RANKLIST**, que lo abre en
una pestaña nueva para no perder la partida.

Orden:

1. Más preguntas resueltas.
2. Menos tiempo entre que entró y su último acierto.
3. Menos intentos.

Los intentos fallidos **no penalizan**, solo se cuentan y sirven de desempate. Se refresca
solo cada `rankingRefrescoSegundos` (por defecto 45 s) y con el botón ACTUALIZAR.

### Identificación de la patrulla y PIN

La patrulla entra con **Grupo + nombre de patrulla + un PIN de 4 dígitos**. El PIN lo
inventan ellas mismas en su primer ingreso y queda guardado en la hoja `Avance`. Sin ese
PIN nadie puede entrar a su avance, aunque conozca el nombre y el grupo.

El nombre se normaliza antes de buscar: se ignoran mayúsculas, acentos, espacios de sobra
y los prefijos de `CONFIG.NOMBRE_PREFIJOS` (`los`, `las`, `la`, `el`, `patrulla de`). Así
`Los Chorlitos`, `chorlitos` y `Patrulla de los Chorlitos` son la misma patrulla y no
crean filas duplicadas con el avance en cero. Lo que **no** se aplica aquí es la
tolerancia a erratas, a propósito: `Lobos` y `Lobas` deben poder coexistir como patrullas
distintas del mismo grupo.

Tras `CONFIG.PIN_MAX_FALLOS` (5) PIN incorrectos seguidos, el reingreso de esa patrulla se
bloquea `CONFIG.PIN_BLOQUEO_MINUTOS` (10) minutos. Sin eso, un PIN de 4 dígitos se adivina
con un script en segundos.

El campo del PIN se muestra **en claro** (no como `password`) a propósito: con puntos no se
alcanza a ver si ya escribieron los 4 dígitos o les falta uno.

Columnas de la hoja `Avance`:

| Col | Campo | |
|---|---|---|
| A | `Token` | Credencial de sesión. Es lo que guarda el navegador, no el PIN. |
| B | `Patrulla` | Nombre tal como lo escribieron la primera vez. |
| C | `Grupo` | |
| D | `PIN` | 4 dígitos, en texto plano. Formateada como texto para no perder el cero inicial. |
| E | `Inicio` | Cuándo entró por primera vez. Base del desempate por tiempo. |
| F | `Nivel` | Siguiente nivel por resolver. |
| G–I | `Resueltas`, `Intentos`, `Fallos` | Contadores. |
| J–K | `Ultimo acierto`, `Ultimo intento` | |
| L | `Terminada` | Cuándo resolvió el último nivel. |
| M–N | `Fallos PIN`, `Bloqueo PIN` | Control del bloqueo por fuerza bruta. Vaciarlas desbloquea a mano. |

> El PIN está en texto plano **a propósito**: si una patrulla lo olvida en plena base, el
> Comité lo lee en la hoja y se los dice. No protege nada sensible, solo evita que otra
> patrulla se meta a su avance.

### Durante el evento

- Si una patrulla vuelve a entrar con los mismos datos (aunque sea desde otra computadora)
  recupera su avance: el progreso vive en el servidor, no en el navegador. En el mismo
  navegador ni siquiera tiene que teclear el PIN de nuevo, porque el token quedó guardado.
- **Olvidaron su PIN**: búscala en la hoja `Avance` y díselos, o cámbiale la celda `PIN`
  por uno nuevo. Toma efecto de inmediato.
- **Quedó bloqueada por PIN**: vacía sus celdas `Fallos PIN` y `Bloqueo PIN`.
- Hoja `Intentos`: bitácora de cada respuesta. Es la herramienta de oro para detectar una
  respuesta válida que se esté rechazando. Si ves que varias patrullas escriben lo mismo y
  falla, **agrégala como opción más** en la celda `Respuestas` de esa fila: toma efecto de
  inmediato.
- Hoja `Avance`: para reiniciar a una patrulla, borra su fila completa (perderá también su
  PIN, así que podrá elegir uno nuevo).
- `reiniciarAvance()` borra el avance y la bitácora de todas. Las preguntas no se tocan.

### Imágenes de las preguntas

Van en `images/trivia/` con nombre descriptivo en kebab-case
(`nudo-ballestrinque.png`, `identificativo-lobatos.gif`). Ojo: el workflow
`optimize-images.yml` recomprime `images/**` en cada push, así que se optimizan solas.

---

## 9. Convenciones de código

- **JS**: jQuery 1.x + skel. Sin transpilación. Mantén compatibilidad ES5 en lo posible (las funciones flecha y `const` ya se usan, pero evita features muy nuevas si las metes en `main.js`).
- **CSS**: un solo archivo `assets/css/main.css`. Las secciones están marcadas con comentarios `/* nombreSeccion */`.
- **HTML modular**: cualquier `<div includedHtml="/includes/X.html">` se rellena en runtime con el contenido del archivo. Útil para reutilizar bloques.

### Secciones (catálogo compartido)

El catálogo canónico de las secciones scout (Colonia de Castores, Manadas, Tropas, Clanes, Scouters) vive en un solo lugar: **`assets/js/secciones.js`**, expuesto como `window.AGSMAC_SECCIONES`. Debe cargarse (vía `<script>`) **antes** que los módulos que lo consumen (ver `detail1.html`).

- La **clave canónica** es el acrónimo, que coincide con el emblema `images/secciones/<ACRONIMO>.gif`: `CC`, `MG`, `ML`, `TMS`, `TS`, `CP`, `CR`, `J`.
- Cada entrada expone `nombre` (nombre completo para tooltips/`title`/`alt`) e `imagen` (ruta del emblema). El **orden por edad** (orden de inserción de `SECCIONES`) se expone vía `AGSMAC_SECCIONES.orden(clave)`, para que los consumidores ordenen sus filtros sin hardcodear su propia lista.
- Consumidores con esquemas de clave propios (heredados de sus JSON o de proyectos externos) resuelven vía el índice `ALIASES`:
  - **Calendario** (`calendario.js` / `calendario.json`) usa acrónimos directamente.
  - **Álbum Fotográfico** (`album-fotografico.js`) usa slugs (`castores`, `manada-gacelas`, …); `'general'` no es una sección real y se maneja localmente (flor de lis).
  - **Biblioteca** (`biblioteca.js`) usa nombres completos (idénticos a los canónicos) y ordena sus chips con `orden()`; `'Todas las secciones'` es universal (no genera chip).
- Usa `AGSMAC_SECCIONES.nombre(clave)` / `.imagen(clave)` / `.orden(clave)` (aceptan acrónimo, slug o nombre completo) o `.resolve(clave)` → `{ acr, nombre, imagen }`.

**Al agregar una sección o un alias nuevo**, edita únicamente `assets/js/secciones.js` (mapa `SECCIONES` y/o índice `ALIASES`). Los `data-filter`/`data-section` y los valores en los JSON siguen siendo la clave propia de cada módulo; solo el nombre mostrado y el emblema salen del catálogo.

---

## 10. Despliegue

El sitio es 100% estático. Se publica en GitHub Pages desde la rama principal. Cualquier cambio en `main` se refleja en pocos minutos.

---

## 11. Pendientes / mejoras conocidas

Ver `helpers/notes.txt` para la lista actual de pendientes y bugs.

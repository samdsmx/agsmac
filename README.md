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
│       └── cumpleanos.json Lista de cumpleaños
├── images/
│   ├── grupos/             Pañoletas (PNG transparentes)
│   │   └── Escudos/        Escudos de cada grupo (PNG transparentes)
│   ├── secciones/          Iconos animados de las secciones
│   └── pic*.jpg            Imágenes del mosaico de la home
└── helpers/
    └── procesarEscudos.js  Script de procesado de escudos
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

### Actualizar el fallback local

Si el Apps Script estará caído o quieres mostrar nombres específicos sin depender de la hoja, edita el arreglo `birthdays` directamente en `cumpleanos.json`. El JS los filtra a la misma ventana de `rangeDays`.

### Ajustes visuales

Los colores de los globos y comportamiento de la animación están en `assets/js/birthday-tile.js` (`BALLOON_COLORS`, `DEFAULT_RANGE_DAYS`). No requiere build — recargar el navegador.

---

## 7. Convenciones de código

- **JS**: jQuery 1.x + skel. Sin transpilación. Mantén compatibilidad ES5 en lo posible (las funciones flecha y `const` ya se usan, pero evita features muy nuevas si las metes en `main.js`).
- **CSS**: un solo archivo `assets/css/main.css`. Las secciones están marcadas con comentarios `/* nombreSeccion */`.
- **HTML modular**: cualquier `<div includedHtml="/includes/X.html">` se rellena en runtime con el contenido del archivo. Útil para reutilizar bloques.

---

## 8. Despliegue

El sitio es 100% estático. Se publica en GitHub Pages desde la rama principal. Cualquier cambio en `main` se refleja en pocos minutos.

---

## 9. Pendientes / mejoras conocidas

Ver `helpers/notes.txt` para la lista actual de pendientes y bugs.

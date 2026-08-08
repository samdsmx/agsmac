# Servidor de Discord del Rally Virtual

Guía para armar el **cuartel general** del Rally. Hay dos caminos:

- **[Camino A — con el script](#camino-a--con-el-script)**: 10 minutos, crea todo solo.
  Recomendado, son ~30 canales y ~20 roles.
- **[Camino B — a mano](#camino-b--a-mano)**: por si prefieres verlo todo o el script falla.

Cualquiera de los dos deja el mismo resultado. Al final está la
[estructura completa](#estructura-del-servidor) para consultarla.

---

## Antes de empezar

**Tú tienes que ser el dueño del servidor, no el bot.** Por eso el servidor se crea
siempre a mano, y el script sólo lo amuebla. Si el bot lo creara, perderías el control
el día que borres el bot.

Activa el **Modo desarrollador** una vez: Ajustes de usuario → Avanzado → Modo
desarrollador. Sin eso no puedes copiar los IDs.

---

## Camino A — con el script

### 1. Crear el servidor (1 min)

En Discord, botón **+** de la barra izquierda → **Crear mi propia** → **Para mí y mis
amigos**.

- Nombre: `Rally Virtual AGSMAC`
- Ícono: el logo de la AGSMAC

Clic derecho sobre el servidor → **Copiar ID del servidor**.

### 2. Crear el bot (3 min)

1. Entra a <https://discord.com/developers/applications> con tu cuenta.
2. **New Application** → nómbrala `Ayudante del Rally` → **Create**.
3. Menú izquierdo → **Bot** → **Reset Token** → **Copiar**.
   **Ese token es una contraseña: no lo pegues en ningún archivo del repositorio ni se lo
   mandes a nadie.** Si se te escapa, vuelve a darle Reset y el viejo deja de servir.
4. En la misma pantalla, baja a **Privileged Gateway Intents** y activa
   **Server Members Intent**.

### 3. Meter el bot al servidor (1 min)

1. Menú izquierdo → **OAuth2** → **URL Generator**.
2. En *Scopes* marca **bot**.
3. En *Bot Permissions* marca **Administrator**.
4. Copia la URL de hasta abajo, ábrela en el navegador y elige tu servidor.

> El bot sólo necesita ser Administrador mientras armas el servidor. Cuando termines
> puedes bajarle los permisos o sacarlo; lo creado se queda.

### 4. Llenar la configuración (2 min)

Abre `helpers/discord/config.json` y pon:

- **`guildId`** — el ID que copiaste en el paso 1.
- **`bases`** — revisa el horario. Viene una propuesta de 10 bases cada hora y media,
  con descanso de 00:30 a 07:00. El campo `reto` es el mensaje que se publica al abrir
  el canal; si lo dejas vacío, el canal se abre y el jefe de base escribe a mano.

Y ya. **No hay que dar de alta a las patrullas**: no se usan roles por patrulla, cada
quien se identifica con su apodo.

### 5. Correr el script (1 min)

```powershell
# El token vive en la sesión de PowerShell, nunca en un archivo
$env:DISCORD_TOKEN = "el-token-que-copiaste"

cd C:\Users\semarque\Proyects\agsmac
node helpers\discord\setup.js --dry    # ensayo: enseña qué haría, sin tocar nada
node helpers\discord\setup.js          # de verdad
```

Se puede correr **las veces que quieras**: lo que ya existe lo respeta.

### 6. Lo que queda a mano (3 min)

El script no puede hacer estas tres cosas:

1. **El enlace de invitación.** Clic derecho en el canal `#bienvenida` → **Invitar
   gente** → engrane → **Que no expire nunca**, usos ilimitados → copiar.
   Ese enlace va en `includes/data/rally.json` → `evento.discordInvite`.
   En cuanto lo pongas, el botón «ENTRAR AL DISCORD» aparece solo en `rally.html`.
2. **Repartir los roles de adulto.** Date a ti mismo **Comité** y a cada jefe su rol de
   **Jefe de Base**: Ajustes del servidor → Miembros → los tres puntos → Roles.
3. **Revisar la pantalla de reglas.** Ajustes del servidor → **Incorporación**. El script
   ya dejó `#reglas` como canal de reglas, pero conviene que le eches un ojo.

---

## Durante el evento

Los canales de las bases nacen **ocultos**. Se abren así:

```powershell
$env:DISCORD_TOKEN = "el-token"

node helpers\discord\abrir-base.js --estado    # qué está abierto y qué falta
node helpers\discord\abrir-base.js             # automático: abre cada base a su hora
node helpers\discord\abrir-base.js 3           # abrir la base 3 ya
node helpers\discord\abrir-base.js 3 --cerrar  # cerrar la base 3 (deja de recibir)
```

El **modo automático** hay que dejarlo corriendo durante las 22 horas: basta una laptop
encendida. Al abrir cada base publica el reto y lo fija.

**Si se cae o apagas la máquina, no pasa nada:** al volver a arrancarlo abre de golpe
todas las bases cuya hora ya pasó y sigue con las que faltan. Aun así, ten a la mano el
comando manual (`abrir-base.js 3`) por si la computadora del Comité se queda sin internet.

Al **cerrar** una base el canal se queda visible pero ya no se puede escribir, así que
las entregas quedan como registro y los jefes pueden seguir retroalimentando.

---

## Camino B — a mano

Sigue los pasos 1 y 6 del Camino A (crear el servidor y el enlace de invitación); el bot
no hace falta. Todo lo demás se hace desde la interfaz de Discord.

### Roles

Ajustes del servidor → **Roles** → **Crear rol**. Son sólo dos:

| Rol | Color | Permisos |
|---|---|---|
| **Comité** | dorado `#ffcc33` | Administrador |
| **Jefe de Base** | azul `#4ea8ff` | Ver registro de auditoría, Gestionar apodos, Expulsar temporalmente, Gestionar eventos |

**No hay rol por patrulla.** Cada quien se identifica con su apodo,
`Nombre · Patrulla · Grupo`. Por eso es importante que **@everyone conserve el permiso
Cambiar apodo**, y que los Jefes de Base tengan **Gestionar apodos** para corregir a
quien lo ponga mal.

En **@everyone** quita **Crear invitación** (que sólo el Comité reparta el enlace) y
**Mencionar a @everyone**.

Marca **Mostrar por separado** en Comité y Jefe de Base para que se vea quién es quién.

### Modo comunidad

Ajustes del servidor → **Habilitar comunidad**. Es importante con menores porque activa
la pantalla de reglas y el filtro automático de contenido. Configura:

- Nivel de verificación: **Bajo** (correo verificado)
- Filtro de contenido: **Analizar los mensajes de todos**
- Canal de reglas: `#reglas`

### Canales

Crea las categorías y dentro los canales de la tabla de abajo. Los permisos se ponen en
el canal → engrane → **Permisos**.

Tres configuraciones se repiten:

- **Sólo lectura** (`#bienvenida`, `#reglas`, `#avisos`, `#tutoriales`,
  `#tabla-de-posiciones`, `#galería`): en @everyone quita **Enviar mensajes**.
- **Oculto** (todas las bases): en @everyone quita **Ver canal**; agrega **Comité** y
  **Jefe de Base** con Ver canal permitido. Para abrir la base a su hora, sólo le
  devuelves **Ver canal** a @everyone.
- **Privado** (categoría 🔒 COMITÉ): en @everyone quita **Ver canal**; agrega Comité y
  Jefe de Base. Los canales de adentro heredan solos.

---

## Estructura del servidor

```
📋 INFORMACIÓN                      (sólo lectura)
   #bienvenida              qué es esto y qué hacer primero
   #reglas                  el reglamento
   #avisos                  comunicados del Comité
   #tutoriales              Instagram, entregas, Base 0

💬 GENERAL
   #presentaciones          quién es quién
   #dudas                   preguntas de las patrullas
   #convivencia             plática libre entre patrullas
   🔊 Voz General           apertura, clausura, explicaciones en vivo

🎯 VIII RALLY 2026                  (ocultos hasta su hora)
   #base-00-ensayo          la Base 0, del 30 de agosto al 4 de septiembre
   #base-01 … #base-10      una por base

🏅 RESULTADOS                       (sólo lectura)
   #tabla-de-posiciones
   #galería                 lo mejor de cada base

🔒 COMITÉ                           (privado)
   #comité-general
   #comité-calificaciones
   🔊 Voz Comité
```

### Por qué así

- **Un canal por base, no uno por patrulla.** Con 18 patrullas y 10 bases, un canal por
  patrulla serían 180 conversaciones que nadie alcanza a leer. Además, que todas vean el
  trabajo de las demás era parte de la gracia del Rally.
- **El jefe responde en un hilo**, colgado del mensaje de la patrulla. Así la
  retroalimentación no se pierde entre las demás entregas.
- **Sin roles por patrulla.** Serían ~18 roles que alguien tendría que repartir a mano
  conforme se registran, y para nada: el apodo `Nombre · Patrulla · Grupo` ya dice todo
  lo que hay que saber. Menos administración y una cosa menos que se puede olvidar.
- **Los canales nacen ocultos** porque los retos se revelan hora por hora. Si estuvieran
  visibles desde el principio se acabaría la sorpresa.
- **La categoría lleva el año** (`🎯 VIII RALLY 2026`). El año que viene se crea otra y
  las viejas se quedan como archivo: el historial es justo lo que hace valioso tener un
  servidor permanente.

---

## El apodo es la identificación

Como no hay roles por patrulla, **el apodo es la única forma de saber de quién es cada
entrega**. El formato es:

```
Ana · Águilas · G54
```

Está pedido en `#bienvenida` (lo primero que se lee) y en `#reglas` (como obligación).
Aun así, alguien lo va a olvidar. Los **Jefes de Base** tienen el permiso **Gestionar
apodos** justo para eso: se lo corrigen y siguen.

**Vale la pena revisarlo durante la Base 0**, que para eso es el ensayo: si alguien llega
al evento sin apodo, su entrega no se le puede acreditar a nadie.

---

## Cosas que conviene tener presentes

**La edad.** Discord pide **13 años cumplidos** y la Tropa va de 11 a 15, así que parte
de los muchachos no puede tener cuenta. Por eso la convocatoria dice que **basta con que
un integrante tenga cuenta**: normalmente el Guía o el Subguía, que son los mayores. El
reglamento que publica el script lo dice explícitamente.

**Todo queda registrado.** El modo comunidad guarda el historial de moderación. Si algo
pasa, hay evidencia. La voz **no** deja registro: si te preocupa, usa los canales de voz
sólo para las ceremonias, con un adulto presente.

**El token no va al repositorio.** Se pasa por `$env:DISCORD_TOKEN` y vive sólo en esa
ventana de PowerShell. Si alguna vez lo pegas por error en un archivo, entra al portal y
dale **Reset Token**.

**Cierra la puerta al terminar.** Cuando acabe el Rally, quítale el Administrador al bot
o sácalo del servidor. Lo que creó se queda.

---

## Si algo sale mal

| Qué ves | Qué pasa |
|---|---|
| `Falta el token del bot` | No corriste `$env:DISCORD_TOKEN = "..."` en **esa misma** ventana de PowerShell. Se borra al cerrarla. |
| `Falta "guildId"` | No pusiste el ID del servidor en `config.json`. |
| `El bot no está en ese servidor` | Faltó el paso 3, o el `guildId` es de otro servidor. |
| `Discord 403` | El bot no tiene permiso de Administrador, o su rol está por debajo del que quiere tocar. Súbelo en Ajustes → Roles. |
| `Discord 401` | El token está mal o le diste Reset. Copia el nuevo. |
| `límite de ritmo: espero Ns` | Normal, Discord frena las peticiones. El script espera solo, no lo interrumpas. |
| No pudo activar el modo comunidad | Actívalo a mano: Ajustes del servidor → Habilitar comunidad. Lo demás sí quedó. |

---

*Archivos: `helpers/discord/config.json` (configuración), `setup.js` (arma el servidor),
`abrir-base.js` (abre las bases), `api.js` (cliente compartido). No usan dependencias:
Node 18+ ya trae todo lo necesario.*

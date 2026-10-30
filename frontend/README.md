# SaludPlus · Frontend

React + TypeScript + Vite. Incluye, según el diseño de Figma:

- **Tótem de autogestión** `/totem` (K01–K15), responsive desde celular hasta la pantalla vertical de 1080×1920.
- **Vista del profesional** `/profesional` (P01–P06), pensada para tablet 1024×768 y responsive.
- **Panel de secretaría** `/secretaria` (S01–S06), pensado para escritorio 1440×900; en celular la tabla pasa a tarjetas.
- **Pantalla de sala de espera** `/sala` (T01–T05), para TV 1920×1080 y legible a 8 metros; también se adapta a pantallas chicas.
- **Lámina de componentes** `/componentes`: paleta, tipografía, botones, campos, estados, alertas e íconos (manual de marca B.4).
- **Inicio de sesión** `/ingresar` y **menú principal** `/inicio` para el personal (correcciones del 26/10: #47 y #48).

No hay backend ni base de datos: todo funciona con datos de ejemplo guardados en el navegador.

## Cómo correrlo

Requiere Node.js 18 o superior.

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173: pide usuario y contraseña (ver abajo). El tótem (`/totem`) y la sala (`/sala`) se abren sin usuario.

- `npm run build`: compila para producción (carpeta `dist/`).
- `npm test`: corre las pruebas (tolerancia, tiempos de espera, usuarios y permisos, llamado fuera de orden y atajos de teclado).

## Usuarios de prueba (ficticios)

Contraseña para todos: `saludplus`. En la pantalla de ingreso, los botones "Admisión", "Profesional" y "Dirección" cargan un usuario de prueba con un toque, y "Ver todos los usuarios de prueba" muestra la lista completa.

| Usuario | Rol | Qué ve en el menú |
|---|---|---|
| `jbenitez` | Admisión (secretaría) | Admisión y sala de espera; abre el tótem y la sala en otra pestaña |
| `lferrer` | Profesional, consultorio 4 | Su consultorio y la pantalla de sala |
| `tvidal` | Profesional, consultorio 2 | Ídem |
| `prios` | Profesional, consultorio 6 | Ídem |
| `direccion` | Dirección | Todas las pantallas, incluidos los tres consultorios |

- Cada rol abre solo sus pantallas: si una secretaria entra a `/profesional`, vuelve al menú con un aviso.
- La sesión se cierra sola después de 15 minutos sin uso y desde el menú con "Cerrar sesión".
- `/ingresar?error=1` simula una falla del servicio de ingreso.

## Datos de demostración (ficticios)

El proveedor de turnos está **simulado** en `src/servicios/turnos.ts`. Los horarios se calculan a partir de la hora actual, así que la demo siempre funciona igual.

| DNI | Afiliado | Qué muestra |
|---|---|---|
| 30111222 | 100200300 | Turno válido → Confirmación → Llegada registrada (A023). Si lo ingresás de nuevo: "Ya está en espera". |
| 28444555 | 100200301 | Turno de hace 25 minutos → **Tolerancia vencida** |
| 25666777 | 100200302 | Llegada ya registrada (A019) |
| 33888999 | 100200303 | Falla el primer registro (**Error de registro**); al tocar Reintentar, funciona |
| 27123456 | | Afiliada **sin turno** (Elena T.): para probar "No tengo turno" |
| 31555666 | | Afiliado **sin turno** (Pablo Q.) |
| cualquier otro | | Turno no encontrado / afiliado no encontrado |

### Tótem: con turno y sin turno (DEV-32 y DEV-33)

La primera pantalla pregunta **"Tengo turno"** o **"No tengo turno"**. Después el paciente elige el **servicio** (Clínica médica, Cardiología o Pediatría) con botones grandes, y recién ahí ingresa el número.

- **Con turno:** DNI o afiliado → verificación → regla de 15 minutos, igual que antes. El servicio elegido se usa para validar el turno: si Marta (30111222, turno de Clínica médica) elige Cardiología, el tótem avisa "Su turno es de otro servicio" y deja seguir con su turno o elegir otro servicio. Si el número no aparece, ofrece pasar a "No tengo turno".
- **Sin turno:** solo DNI → confirmación de datos → queda registrado como **demanda espontánea** del servicio elegido, con número de orden y **sin profesional**. Probalo con 27123456 (Elena T.).
- **No se duplican admisiones:** si el mismo DNI vuelve a anotarse, el tótem muestra "Ya está en espera" con el mismo número. Si dice no tener turno pero tiene uno hoy (33888999), lo manda al camino "con turno"; si su turno venció (28444555), lo deriva a secretaría para un contraturno.
- "Volver" retrocede un paso en cada pantalla. El tótem vuelve solo al inicio después de 45 segundos sin uso y en ese momento borra el servicio y el número cargados.

En **secretaría**, la demanda del tótem aparece en la tabla como "Sin asignar · servicio" y con un aviso arriba. **Asignar profesional** muestra primero a los profesionales de ese servicio; al confirmar, el paciente conserva su número y su hora de llegada y le aparece al profesional. El filtro de profesional tiene la opción "Sin asignar".

Para ver la pantalla **Sin conexión**, agregá `?offline=1` a la dirección (por ejemplo `/totem?offline=1` o `/profesional?offline=1`) o desconectá la red.

### Vista del profesional

Con `lferrer` muestra el consultorio 4 (Dra. Lucía Ferrer); con `direccion` se elige el consultorio en el menú o con `?consultorio=2`. Al empezar hay dos pacientes de demo esperando (A021 y A022).

1. Abrí `/profesional` en una pestaña y `/totem` en otra.
2. "Llamar al siguiente" pasa al paciente a **en atención**; "Finalizar atención" lo cierra y muestra al próximo.
   - **Llamar nuevamente** (#41) repite el llamado en la sala sin cambiar el orden de la cola y muestra cuántas veces se llamó.
   - **No se presentó** se habilita después de 2 llamados: el paciente queda **ausente** y la secretaría lo ve en la cola.
   - Arriba se ven los pacientes esperando y la **mayor espera** (#46).
3. Si registrás a Marta (DNI 30111222) en el tótem, aparece en el profesional como A023 sin recargar la página.

### Tabla de pacientes y uso con teclado (DEV-31 y DEV-38)

A la derecha (abajo en tablet vertical y celular) está la tabla **Pacientes en espera** con número, nombre abreviado, horario del turno, hora de llegada y tiempo en espera. Se actualiza sola cuando llegan pacientes desde el tótem o la secretaría.

- Cada fila tiene **Llamar**; el botón **Llamar al siguiente** sigue disponible.
- Si hay un paciente en atención, primero pide **finalizarlo** ("Finalizar y llamar a A0xx").
- Llamar a alguien que no es el próximo pide confirmación y queda registrado (quién, cuándo, a qué paciente y a quién se salteó) en `saludplus.auditoria` del navegador. Los registros solo se agregan: no se editan ni se borran, ni siquiera con `?reset=1`.
- **Atajos:** `N` llamar al siguiente, `R` llamar nuevamente, `F` finalizar atención, `L` ir a la lista. En la lista, flechas ↑ ↓ (e Inicio/Fin) para elegir paciente y `Enter` para llamarlo. Se muestran en pantalla y no se activan mientras se escribe en un campo, con Ctrl/Alt/Cmd ni con un diálogo o el menú abiertos.
- Con el teclado se piden **las mismas confirmaciones** que con el mouse (usan las mismas funciones). En el diálogo, el foco empieza en "Cancelar" y Escape lo cierra.
- Todos los botones se recorren con Tab y muestran el foco; la fila elegida se marca con borde y fondo.

Otros estados: `/profesional?error=1` (error de consulta) y `/profesional?offline=1` (sin conexión). La pantalla "Consultando…" aparece al cargar. Se actualiza sola cada 5 segundos.

### Panel de secretaría

Al abrir `/secretaria?reset=1` se ve la cola del centro con pacientes de demo, una alerta de demora de la Dra. Ferrer (más de 15 minutos), un turno cancelado por tolerancia (Carolina V.) y un ausente (Jorge P.).

- **Registrar llegada** con DNI, para pacientes que no usan el tótem: 30111222 registra a Marta; 28444555 (Jorge) avisa que el turno se canceló por tolerancia y ofrece **Registrar contraturno**.
- **Registrar contraturno**: elige el profesional y el motivo; el paciente vuelve a la cola con el estado "Contraturno" y le aparece al médico.
- **Demanda espontánea**: incorpora a un paciente sin turno a la cola del profesional elegido.
- Filtros por profesional y por estado.
- Estados: `/secretaria?error=1` (error de consulta) y `/secretaria?offline=1` o cortar la red (muestra la última cola guardada y bloquea los registros).

Las tres pantallas comparten la misma cola: lo que hace la secretaría lo ve el profesional y viceversa.

### Pantalla de sala

Muestra el número llamado y el consultorio en grande, los últimos 4 llamados, la espera estimada por especialidad y un aviso cuando hay demora. Nunca muestra nombres ni datos de salud.

- Abrí `/sala` en una pestaña y `/profesional` en otra: cuando el médico toca **Llamar al siguiente** o **Llamar nuevamente**, el número ocupa toda la pantalla durante 8 segundos y suena un aviso (#45). Un llamado repetido dice "Llamando nuevamente".
- El botón **Sonido activado / silenciado** del encabezado prende o apaga el aviso sonoro. Los navegadores bloquean el sonido hasta que alguien toca la pantalla: en ese caso aparece un botón para habilitarlo.
- La espera estimada se calcula como pacientes en espera × 10 minutos por consulta, más 5 si el profesional está atendiendo (supuesto a confirmar con SaludPlus).
- Estados: `/sala?error=1` (error) y `/sala?offline=1` o cortar la red (muestra los datos anteriores aclarando que no son un llamado en vivo). "Actualizando llamados…" aparece al cargar.

Para volver la demo al estado inicial, agregá `?reset=1` a cualquier dirección (por ejemplo `/profesional?reset=1`).

La cola se guarda en el navegador (localStorage) para que el tótem y el profesional compartan datos entre pestañas. Con el backend NestJS esto pasará al servidor.

## Reglas implementadas

- **Tolerancia de 15 minutos (RF-07):** hasta 15:00 de demora se acepta; desde 15:01 el turno queda cancelado y el tótem deriva a secretaría para un contraturno (`src/servicios/tolerancia.ts`, con pruebas).
- Registrar dos veces el mismo turno no duplica la admisión (RF-02).
- Contraturno (RF-11) solo para turnos cancelados por tolerancia y sin duplicados; demanda espontánea (RF-05); alerta de demora cuando un profesional supera 15 minutos (RF-06).
- El profesional llama en un solo toque (RF-04) y no puede llamar a otro mientras tiene un paciente en atención. Orden de atención: horario del turno y, si empatan, hora de llegada.
- El tótem vuelve solo a la bienvenida tras 45 segundos sin uso.
- **Tiempo de espera en todas las pantallas (#46):** el tótem informa la espera estimada y cuántos pacientes hay antes; secretaría y profesional muestran los minutos que lleva esperando cada paciente; la sala, la espera estimada por especialidad. Desde 30 minutos se marca "espera larga" con color y texto (`src/servicios/espera.ts`, con pruebas).
- **Inicio de sesión y menú por rol (#47, #48):** usuarios ficticios en `src/servicios/usuarios.ts`; la sesión vive en el navegador hasta que exista la autenticación del backend.
- Accesibilidad: foco visible, foco en el título de cada pantalla, mensajes anunciados a lectores de pantalla, botones de 64 px o más y contraste del manual de marca.

## Limitaciones y pendientes (DEV-31, DEV-32, DEV-33 y DEV-38)

- Los servicios del centro salen de la lista simulada de profesionales; con el backend vendrán de la configuración de cada centro.
- La identificación sin turno usa un **padrón simulado** (`padron()` en `turnos.ts`). Falta definir con SaludPlus qué hacer si el DNI no figura: hoy se deriva a secretaría.
- La demanda espontánea del tótem guarda el DNI ficticio solo para evitar duplicados y nunca se muestra. Con el backend, el control de duplicados debe hacerse en el servidor.
- La auditoría de llamados fuera de orden vive en el navegador; sin backend no es realmente inalterable (RF-09 queda pendiente para el servidor). Todavía no hay una pantalla para consultarla.
- Si dos profesionales llaman al mismo paciente a la vez, el segundo ve "Ese paciente ya no está en espera"; la garantía real necesita el backend.
- Los atajos usan letras sueltas (N, R, F, L). Falta validarlos con profesionales reales y con lectores de pantalla.
- Probado en Chrome (escritorio 1440 px, tablet 1024 y 768 px, celular 390 px). Falta probar en el tótem físico.

## Estructura

Ordenada igual que las láminas de Figma:

```
src/
  pantallas/
    totem/          01 Tótem de autogestión (K01–K15)
    secretaria/     02 Panel de secretaría (S01–S06) y sus ventanas modales
    profesional/    03 Vista del profesional (P01–P06)
    sala/           04 Pantalla de sala de espera (T01–T05)
    lamina/         05 Lámina de componentes reutilizables
    ingreso/        Inicio de sesión del personal
    inicio/         Menú principal según el rol
  componentes/      Piezas compartidas: Logo, Icon, Button, StatusChip, Alerta, MenuUsuario, TiempoEspera, RutaProtegida
  estilos/          Tokens del manual de marca, estilos globales y de componentes
  servicios/        Turnos y cola simulados, tolerancia, espera, llamados y atajos, sesión, usuarios y sonido (con pruebas)
  utilidades/       Formato de horas y fechas
  App.tsx           Rutas de cada pantalla
  main.tsx          Punto de entrada
```

## Adaptación a pantallas

Todas las pantallas se revisaron en 360, 390, 768, 1024, 1440 y 1920 px de ancho, sin desplazamiento horizontal (#80):

- **Inicio de sesión:** en escritorio, panel de marca a la izquierda y formulario a la derecha; en tablet, franja de marca arriba y formulario en tarjeta; en celular, franja compacta y formulario a todo el ancho.
- **Secretaría:** en notebook chica la tabla se desplaza dentro de su tarjeta; en tablet pasa a tarjetas de a dos; en celular, de a una, con el logo y el menú en la misma fila.


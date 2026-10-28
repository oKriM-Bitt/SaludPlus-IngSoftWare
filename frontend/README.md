# SaludPlus · Frontend

React + TypeScript + Vite. Incluye, según el diseño de Figma:

- **Tótem de autogestión** `/totem` (K01–K10), responsive desde celular hasta la pantalla vertical de 1080×1920.
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
- `npm test`: corre las pruebas (tolerancia, tiempos de espera, usuarios y permisos).

## Usuarios de prueba (ficticios)

Contraseña para todos: `saludplus`. En la pantalla de ingreso, "Usuarios de prueba" permite elegirlos con un toque.

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
| cualquier otro | | Turno no encontrado |

Para ver la pantalla **Sin conexión**, agregá `?offline=1` a la dirección (por ejemplo `/totem?offline=1` o `/profesional?offline=1`) o desconectá la red.

### Vista del profesional

Con `lferrer` muestra el consultorio 4 (Dra. Lucía Ferrer); con `direccion` se elige el consultorio en el menú o con `?consultorio=2`. Al empezar hay dos pacientes de demo esperando (A021 y A022).

1. Abrí `/profesional` en una pestaña y `/totem` en otra.
2. "Llamar al siguiente" pasa al paciente a **en atención**; "Finalizar atención" lo cierra y muestra al próximo.
   - **Llamar nuevamente** (#41) repite el llamado en la sala sin cambiar el orden de la cola y muestra cuántas veces se llamó.
   - **No se presentó** se habilita después de 2 llamados: el paciente queda **ausente** y la secretaría lo ve en la cola.
   - Arriba se ven los pacientes esperando y la **mayor espera** (#46).
3. Si registrás a Marta (DNI 30111222) en el tótem, aparece en el profesional como A023 sin recargar la página.

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

## Estructura

Ordenada igual que las láminas de Figma:

```
src/
  pantallas/
    totem/          01 Tótem de autogestión (K01–K10)
    secretaria/     02 Panel de secretaría (S01–S06) y sus ventanas modales
    profesional/    03 Vista del profesional (P01–P06)
    sala/           04 Pantalla de sala de espera (T01–T05)
    lamina/         05 Lámina de componentes reutilizables
    ingreso/        Inicio de sesión del personal
    inicio/         Menú principal según el rol
  componentes/      Piezas compartidas: Logo, Icon, Button, StatusChip, Alerta, MenuUsuario, TiempoEspera, RutaProtegida
  estilos/          Tokens del manual de marca, estilos globales y de componentes
  servicios/        Turnos y cola simulados, tolerancia, espera, sesión, usuarios y sonido (con pruebas)
  utilidades/       Formato de horas y fechas
  App.tsx           Rutas de cada pantalla
  main.tsx          Punto de entrada
```

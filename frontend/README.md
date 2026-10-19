# SaludPlus · Frontend

React + TypeScript + Vite. Incluye, según el diseño de Figma:

- **Tótem de autogestión** `/totem` (K01–K10), responsive desde celular hasta la pantalla vertical de 1080×1920.
- **Vista del profesional** `/profesional` (P01–P06), pensada para tablet 1024×768 y responsive.
- **Panel de secretaría** `/secretaria` (S01–S06), pensado para escritorio 1440×900; en celular la tabla pasa a tarjetas.
- **Lámina de componentes** `/componentes`: paleta, tipografía, botones, campos, estados, alertas e íconos (manual de marca B.4).

## Cómo correrlo

Requiere Node.js 18 o superior.

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173/totem, /profesional, /secretaria y /componentes

- `npm run build`: compila para producción (carpeta `dist/`).
- `npm test`: corre las pruebas de la regla de tolerancia.

## Datos de demostración (ficticios)

El proveedor de turnos está **simulado** en `src/services/turnos.ts`. Los horarios se calculan a partir de la hora actual, así que la demo siempre funciona igual.

| DNI | Afiliado | Qué muestra |
|---|---|---|
| 30111222 | 100200300 | Turno válido → Confirmación → Llegada registrada (A023). Si lo ingresás de nuevo: "Ya está en espera". |
| 28444555 | 100200301 | Turno de hace 25 minutos → **Tolerancia vencida** |
| 25666777 | 100200302 | Llegada ya registrada (A019) |
| 33888999 | 100200303 | Falla el primer registro (**Error de registro**); al tocar Reintentar, funciona |
| cualquier otro | | Turno no encontrado |

Para ver la pantalla **Sin conexión**, agregá `?offline=1` a la dirección (por ejemplo `/totem?offline=1` o `/profesional?offline=1`) o desconectá la red.

### Vista del profesional

Muestra el consultorio 4 (Dra. Lucía Ferrer). Al empezar hay dos pacientes de demo esperando (A021 y A022).

1. Abrí `/profesional` en una pestaña y `/totem` en otra.
2. "Llamar al siguiente" pasa al paciente a **en atención**; "Finalizar atención" lo cierra y muestra al próximo.
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

Para volver la demo al estado inicial, agregá `?reset=1` a cualquier dirección (por ejemplo `/profesional?reset=1`).

La cola se guarda en el navegador (localStorage) para que el tótem y el profesional compartan datos entre pestañas. Con el backend NestJS esto pasará al servidor.

## Reglas implementadas

- **Tolerancia de 15 minutos (RF-07):** hasta 15:00 de demora se acepta; desde 15:01 el turno queda cancelado y el tótem deriva a secretaría para un contraturno (`src/services/tolerancia.ts`, con pruebas).
- Registrar dos veces el mismo turno no duplica la admisión (RF-02).
- Contraturno (RF-11) solo para turnos cancelados por tolerancia y sin duplicados; demanda espontánea (RF-05); alerta de demora cuando un profesional supera 15 minutos (RF-06).
- El profesional llama en un solo toque (RF-04) y no puede llamar a otro mientras tiene un paciente en atención. Orden de atención: horario del turno y, si empatan, hora de llegada.
- El tótem vuelve solo a la bienvenida tras 45 segundos sin uso.
- Accesibilidad: foco visible, foco en el título de cada pantalla, mensajes anunciados a lectores de pantalla, botones de 64 px o más y contraste del manual de marca.

## Estructura

```
src/
  components/        Logo, Icon, Button, StatusChip, Alerta (reutilizables)
  features/totem/        Pantallas y estilos del tótem
  features/profesional/  Vista del profesional
  features/secretaria/   Panel de secretaría y modales
  features/componentes/  Lámina de componentes
  services/          Proveedor de turnos y cola simulados, regla de tolerancia
  utils/             Formato de horas y fechas
  styles/            Tokens del manual de marca y estilos globales
```

Próxima pantalla: `/sala` (pantalla de la sala de espera).

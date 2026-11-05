# Collectionner: sistema visual

Un tablero que se ve como una película de producto: la cámara sigue a quien está trabajando, y tú puedes tomar el control en cualquier momento. El lenguaje de movimiento parte de las piezas de Prompt Motion; las tarjetas, del Kanban Board de uvain en 21st.dev.

## Color

Blanco y negro más un acento. Cada sprint es un momento del día: el Sprint 1 de día, el Sprint 2 de noche.

| Token | Sprint 1 | Sprint 2 | Uso |
|---|---|---|---|
| `canvas` | `#EDEBE6` | `#0E0E10` | Lienzo |
| `card` | `#FFFFFF` | `#1A1A1E` | Tarjetas y barras flotantes |
| `ink` | `#111111` | `#F3F2EE` | Texto |
| `--accent` | `#E8501C` | `#FF6A2B` | Urgente, cursor de texto, foco, WIP lleno |

## Tipografía

Geist en todo. Titulares con espaciado -0.035em.

## Composición

- **Lienzo a pantalla completa:** el tablero es un mundo que la cámara recorre. No hay barra de desplazamiento.
- **Controles flotantes:** arriba, marca y pestañas de sprint, con un indicador cuyo borde delantero se estira. Abajo, el mapa de carriles.
- **Subtítulos:** cada movimiento se narra abajo, como en una película.
- **Lienzo de puntos:** se mueve con la cámara, para que se sienta el espacio.
- **Flujo acumulado:** la gráfica clásica de Kanban en la cabecera, dibujada con lo que pasa de verdad en el tablero.

## Cámara

- Planos: general, seguimiento de una nota y primer plano de una nota en trabajo.
- Rápida: 0.5 s por viaje, sale de golpe y frena suave. Se adelanta: encuadra la nota en cuanto el agente decide llevarla.
- Los carriles fuera de foco se atenúan.
- Cualquier gesto tuyo (arrastrar, rueda, un clic en el mapa) le quita el control durante 7 s.
- Sin `will-change` en lo que la cámara escala, para que el texto no se vea borroso.

## Movimiento

- Muelles con muy poco rebote. Sin partículas ni brillos.
- Cada cursor solo mueve las notas de su persona y se posa sobre su retrato.
- Cambio de sprint, sin cortes: un círculo se abre desde la pestaña con el color del sprint nuevo, la frase entra palabra por palabra (una cada 70 ms, subiendo 16 px desde un desenfoque de 12 px), se va hacia arriba y el tablero aparece en perspectiva sobre ese mismo color. Cada palabra ocupa su lugar desde el primer cuadro, así nada se reacomoda.
- Notificaciones: la isla es una sola forma negra. No está si no hay nada que contar; aparece desde una rayita y se abre para decir quién hizo qué. Quienes actúan a la vez salen juntos, con sus caras una al lado de otra, y el ancho crece con ellas. Cada aviso se queda 4.5 s; regresos, entregas y carriles llenos pasan primero, y el puntero encima lo detiene.
- Historial: la misma forma crece hasta el alto justo de sus filas y se encoge al quitar. Se puede filtrar por persona, saltar a la nota, quitar una fila o limpiar todo. La cámara encuadra en el espacio que queda libre.
- Rendimiento: las capas se cruzan sin blur en la isla y los puntos del fondo solo se trasladan. Si el equipo no da abasto, la calidad ligera quita desenfoques, puntos y gestos; se puede forzar con ?calidad=alta o ?calidad=ligera.
- `prefers-reduced-motion`: sin entrada, sin cámara y con los agentes apagados.

## Tiempo y Clawd

- Reloj: hora real, cada dígito rueda por su cuenta. El saludo de la entrada sale de esa hora (días, tardes, noches).
- Notas: fecha, hora de inicio y hora planificada, con estado real (a tiempo, por vencer, atrasada). Al entregar, cuánto sobró o cuánto se pasó. Lo planificado es 3 min más 40 s por punto, a la escala de los agentes de la demo.
- Clawd (dibujo de clawd-md, MIT, Jamey Prüfert) no da avisos: los avisos son solo de la isla. Hay uno dentro de la isla, siempre el mismo, que cambia de gesto con cada aviso, y otro sobre el mapa de carriles, cuyo ánimo sale del estado del sprint: trabaja con laptop, baila al entregar a tiempo, se inquieta si regresa una nota, revisa con lentes si hay atrasos, duerme con los agentes en pausa y lleva corona con todo entregado. Cada gesto parte del reposo y vuelve a él, sin cortes.

## Guion compartido

- Todas las pantallas calculan la misma película a partir de la hora, sin servidor: 12 minutos, 6 por sprint. Quien entra cae en el segundo exacto, y las notas, manos, isla, cámara y gráfica coinciden.
- Lo propio de cada pantalla: la entrada, mirar otro sprint un momento, mover la cámara, y quitar filas del historial.
- Notas propias: se crean con el botón +, piden responsable, tipo, esfuerzo y fecha si aplica, empiezan a moverse solas y se guardan en este navegador. Solo las ve quien las crea. Si una nota del guion necesita el sitio, la propia cede, para que el WIP siempre se respete.

## Manos

- Cada persona mueve sus notas con una mano de cursor clásico, pixelada, de contorno negro y relleno blanco, dibujada para este tablero. Abierta al viajar, señalando con rayitas de clic al trabajar y hecha puño al llevar una nota. La etiqueta lleva el color de la persona.
- Agarrar: llega, cierra la mano, levanta la nota unos píxeles y recién entonces viaja. Soltar: acompaña la nota hasta su sitio, abre la mano y se aparta un poco.
- Si dos notas llegan a la vez al mismo carril, la que aterriza antes va arriba y la otra debajo. Cada lugar reservado lleva el color de su dueño y dice qué nota va ahí, así nunca se mezclan.

## Estados

- Cada nota lleva su estado con cabecera de color, tarjeta teñida y etiqueta rellena con el nombre, y cambia solo según lo que le pasa. No hay un estándar único de colores: la base es la de Jira (gris por hacer, azul en curso, verde hecho) y el ámbar y el rojo son para lo que pide atención.
- Sin iniciar (gris): sigue en el primer carril. En curso (azul): avanza dentro de lo planificado. Regular (ámbar): por vencer, regresó o espera lugar. Crítico (rojo): pasó de la hora planificada. Completo (verde): entregada.
- La tarjeta "Estados de las notas" junto al objetivo explica cada color y cuenta las notas en vivo. El mapa marca con un punto rojo los carriles con notas críticas.
- Mapa de carriles: cada cara se mueve solo cuando su persona empieza a trabajar una nota o la entrega en otro carril. Tiene un lugar fijo dentro del carril, así quien llega no mueve a los demás.

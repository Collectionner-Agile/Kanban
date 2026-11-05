# Collectionner

Tablero Kanban diseñado con STATIK. Solo diseño: los datos viven en memoria y no hay backend.

Es el tablero de Collectionner, con el backlog de backlog_kanban_collectioneer.xlsx. Sprint 1 (2 al 13 de noviembre): MVP, 61 puntos. Sprint 2 (16 al 27 de noviembre): compra, intercambio, reputación, notificaciones y valorización con IA, 64 puntos.

```bash
npm install
npm run dev
```

## Qué incluye

- Sprint 1 (MVP) y Sprint 2 (incremento) en la misma página, con 10 carriles cada uno. `?sprint=2` abre el segundo.
- Límite WIP arriba de cada carril. Un carril lleno rechaza la nota.
- Cámara automática que sigue a los agentes como una película de producto. Se apaga con el interruptor Cámara, y cualquier gesto tuyo le quita el control.
- Cambio de sprint: un círculo abre el día o la noche desde la pestaña, con una frase que entra palabra por palabra y no se repite hasta agotar las de ese sprint.
- Actividad: una isla negra cuenta quién hizo qué y junta a quienes actúan a la vez. Al tocarla se abre el historial, que crece con cada fila; se puede filtrar por persona, saltar a la nota y quitar filas. Sin notificaciones, la isla desaparece.
- Tiempo real: reloj en vivo, saludo según la hora y notas con fecha, hora, meta y si cumplen lo planificado.
- Estados: cada nota cambia sola entre Sin iniciar, En curso, Regular, Crítico y Completo, con color y en palabras, y una tarjeta explica cada color.
- Guion compartido: todas las pantallas ven lo mismo en el mismo momento, sin base de datos, en un bucle de 12 minutos.
- Notas propias: el botón + crea una nota con responsable y fecha de hoy, que se mueve sola y queda guardada en este navegador. Solo la ve quien la crea.
- Clawd: la mascota de Claude Code camina por el mapa y reacciona al estado del proyecto. Dibujo basado en [clawd-md](https://github.com/jaameypr/clawd-md) (MIT, © 2026 Jamey Prüfert).
- Retratos de Diego, Luis, Jose Diego, Brenda y Beth en sus notas: sonríen si avanzan y se ponen tristes si regresan.
- Un cursor agéntico por persona: solo mueve las notas de esa persona, según su estado y a paso lento. Se apagan con el interruptor Agentes.
- Arrastre con ratón y con dedo (pulsación larga), flechas en la nota y flechas del teclado.

## Tecnología

Vite, React 19, TypeScript, Motion y Tailwind CSS 4.

Referencias: el lenguaje de movimiento parte de piezas de Prompt Motion. De 21st.dev: el aspecto del tablero y las tarjetas parte del Kanban Board de uvain; la inclinación del cursor, del Cursor de unlumen.
Revisado con las skills Impeccable, frontend-design, web-design-guidelines, better-ui, interface-design e improve-animations (`.claude/skills`). Sistema visual en `DESIGN.md`.

## Publicar

El sitio vive en Cloudflare Workers: https://statik-kanban.diegosotoquispe9876.workers.dev

Para publicar cambios: `npm run deploy` (compila y sube `dist` con Wrangler). La primera vez en otro equipo hace falta `npx wrangler login`.

## Medición y app móvil

El botón Medición abre las gráficas de WIP, burndown, flujo y escenarios, y las actividades alineadas con [Collectionner-Agile/Mobile](https://github.com/Collectionner-Agile/Mobile). Los datos están en `src/data/backlog.ts` y `src/data/mobile.ts`.

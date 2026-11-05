# Collectionner

Tablero Kanban diseñado con STATIK. Solo diseño: los datos viven en memoria y no hay backend.

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

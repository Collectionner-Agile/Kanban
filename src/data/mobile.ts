/**
 * Dónde cae cada cartilla en la app móvil. Sale de cruzar el Excel con Collectionner_Contexto_Backlog.docx
 * (2 de noviembre de 2026) y la rama main de Collectionner-Agile/Mobile (commit 64cd0f9).
 */
export type MobileState = 'Hecho' | 'A medias' | 'Por crear' | 'Por decidir'
export type MobileLink = { where: string; route: string; state: MobileState; note: string }

export const MOBILE_SOURCE = 'Collectionner-Agile/Mobile, commit 64cd0f9, y contexto del 2 de noviembre'

export const MOBILE: Record<string, MobileLink> = {
  'MVP-01': { where: 'lib/app/router, lib/core/network', route: '5 pestañas', state: 'Hecho', note: 'Arquitectura y cliente listos. El repositorio todavía no tiene CI.' },
  'MVP-02': { where: 'lib/app/theme, lib/l10n', route: 'Toda la app', state: 'Hecho', note: 'Probado de 320 por 568 a 915 por 412, claro y oscuro, español e inglés.' },
  'MVP-03': { where: 'lib/features/auth', route: '/auth/login, /auth/register, /auth/forgot-password', state: 'A medias', note: 'El correo de recuperación nunca sale: no hay proveedor conectado.' },
  'MVP-04': { where: 'lib/features/profile', route: '/profile, /profile/edit, /settings/change-password', state: 'Hecho', note: 'Pantallas listas contra la API de usuarios.' },
  'MVP-05': { where: 'lib/features/catalog, search, categories', route: '/catalog, /search, /categories', state: 'Hecho', note: 'Corre con datos de muestra: el backend no está desplegado.' },
  'MVP-06': { where: 'lib/features/catalog', route: '/catalog/item/:id', state: 'Hecho', note: 'Galería, visor con zoom, reseñas y comentarios.' },
  'MVP-07': { where: 'lib/features/catalog, lib/core/media', route: '/catalog/new', state: 'Hecho', note: 'Sin EXIF en el teléfono. Riesgo P1: las fotos van en base64 dentro de la base.' },
  'MVP-08': { where: 'lib/features/auctions', route: '/auctions, /auctions/:id', state: 'Hecho', note: 'Riesgo P1: pujas simultáneas sin probar contra PostgreSQL.' },
  'MVP-09': { where: 'lib/features/communities', route: '/communities, /posts/:id', state: 'Hecho', note: 'Riesgo P2: se pueden crear comentarios sobre destinos inexistentes.' },
  'MVP-10': { where: 'lib/features/recognition', route: '/scan, /scan/camera, /scan/result', state: 'A medias', note: 'Sin GEMINI_API_KEY el servidor no responde. Falta probarlo de punta a punta en el teléfono.' },
  'MVP-11': { where: 'test, integration_test', route: 'Pruebas', state: 'Hecho', note: 'La doc registra 85 pruebas que pasan y 1 de integración, sin CI.' },
  'MVP-12': { where: 'lib/features/trending, compare, help, collectors', route: 'Unas 20 pantallas fuera del informe', state: 'Por decidir', note: 'El PO decide cuáles se mantienen.' },
  'INC-01': { where: 'lib/features/categories, lib/core/demo', route: '/categories', state: 'A medias', note: 'Las categorías existen. Falta alinearlas con las del informe.' },
  'INC-02': { where: 'lib/features/auth', route: '/auth/login', state: 'A medias', note: 'google_sign_in no está en main: el código sigue sin subir y OAuth está apagado en el servidor.' },
  'INC-03': { where: 'Backend Spring, contexto nuevo', route: 'API de compra', state: 'Por crear', note: 'Solo existe en la API simulada de la web.' },
  'INC-04': { where: 'lib/features/catalog', route: '/catalog/item/:id', state: 'Por crear', note: 'La doc dice que no hay compra a precio fijo; el Excel la pide en HU05.' },
  'INC-05': { where: 'App y backend', route: 'Estado de la operación', state: 'Por crear', note: 'Sin pagos ni envío: la pasarela queda fuera de alcance.' },
  'INC-06': { where: 'Backend Spring, contexto nuevo', route: 'API de intercambio', state: 'Por crear', note: 'Solo existe en la API simulada de la web.' },
  'INC-07': { where: 'lib/features/catalog', route: '/catalog/item/:id', state: 'Por crear', note: 'Se agrega al detalle de la pieza.' },
  'INC-08': { where: 'App y backend', route: 'Perfil del usuario', state: 'Por crear', note: 'La reputación no existe. Depende de una operación completada.' },
  'INC-09': { where: 'lib/features/notifications', route: '/notifications', state: 'Por crear', note: 'Los avisos de hoy son locales y Firebase no está en el proyecto.' },
  'INC-10': { where: 'Toda la app', route: 'Registro, búsqueda, publicación y compra', state: 'Por crear', note: 'Necesita el backend en línea: hoy la app usa datos de muestra.' },
  'INC-11': { where: 'Backend, contexto recognition', route: 'API de valorización', state: 'Por crear', note: 'El reconocimiento existe, la valorización no. El entrenamiento propio en ml/ tiene 0 imágenes.' },
  'INC-12': { where: 'lib/features/recognition', route: '/scan', state: 'Por crear', note: 'El flujo de escaneo existe; falta activar y mostrar la valorización.' },
}

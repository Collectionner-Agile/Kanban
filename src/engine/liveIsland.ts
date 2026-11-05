import { useSyncExternalStore } from 'react'
import { LANE, SPRINTS } from '../data/board'
import { PERSON } from '../data/team'
import { serverNow } from './clock'
import { HARDWARE_ISLAND } from './device'
import { activeSprint, clockAt, localTime, scriptFor, type ScriptEvent } from './script'

/**
 * Al salir de la página, lo único que una web puede dejar en la Dynamic Island es su reproductor.
 * Con permiso de quien toca el botón, un audio en silencio mantiene la sesión abierta y su título
 * lleva el último movimiento del tablero. Sale del guion, así que no necesita servidor.
 */
export const canFollowOutside = Boolean(HARDWARE_ISLAND) && 'mediaSession' in navigator

let audio: HTMLAudioElement | null = null
let on = false
let lastTitle = ''
const listeners = new Set<() => void>()

function setOn(value: boolean) {
  on = value
  listeners.forEach((listener) => listener())
}

/** Un archivo WAV de 30 segundos, todo silencio. Se arma aquí para no descargar nada. */
function silence() {
  const rate = 8000
  const samples = rate * 30
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(buffer, 44).fill(128)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

function sentence(event: ScriptEvent) {
  const who = PERSON[event.who].name
  if (event.kind === 'done') return `${who} entregó ${event.title}`
  if (event.kind === 'back') return `${event.title} regresó a ${LANE[event.to].name}`
  if (event.kind === 'full') return `${who} espera lugar en ${LANE[event.to].name}`
  return `${who} llevó ${event.title} a ${LANE[event.to].name}`
}

function publish() {
  if (!on) return
  const now = serverNow()
  const sprint = activeSprint(clockAt(now).T)
  const local = localTime(sprint, now)
  const { events } = scriptFor(sprint)
  let latest: ScriptEvent | null = null
  for (const event of events) {
    if (event.at > local) break
    latest = event
  }
  const title = latest ? sentence(latest) : `${SPRINTS[sprint].name} en marcha`
  if (title === lastTitle) return
  lastTitle = title
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: `${SPRINTS[sprint].name}, ${SPRINTS[sprint].tag}`,
    album: 'Collectionner',
    artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  })
}

export function stopFollowing() {
  setOn(false)
  audio?.pause()
  navigator.mediaSession.metadata = null
  lastTitle = ''
}

/** Tiene que llamarse desde un toque: Safari no deja sonar nada sin un gesto. */
export async function startFollowing() {
  if (!audio) {
    audio = new Audio(silence())
    audio.loop = true
    audio.addEventListener('timeupdate', publish)
    audio.addEventListener('pause', () => {
      if (on) setOn(false)
    })
    audio.addEventListener('play', () => {
      if (!on) setOn(true)
    })
  }
  try {
    await audio.play()
    setOn(true)
    publish()
    navigator.mediaSession.setActionHandler('pause', stopFollowing)
    navigator.mediaSession.setActionHandler('play', () => void audio?.play())
  } catch {
    setOn(false)
  }
}

export const useFollowingOutside = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => on,
  )

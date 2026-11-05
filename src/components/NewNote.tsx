import { useEffect, useRef, useState } from 'react'
import { CLASSES, SPRINTS, type ServiceClass } from '../data/board'
import { TEAM, type PersonId } from '../data/team'
import { longDayText, hourText, useClock } from '../engine/clock'
import { MAX_NOTES, NOTE_MAX, TITLE_MAX, checkDraft, createNote, localCount, storageAvailable, todayISO, type Draft, type DraftErrors } from '../engine/localNotes'
import { useBoard } from '../store/board'
import { Portrait } from './Portrait'
import { Close } from './icons'

const EMPTY: Draft = { title: '', owner: null, cls: 'standard', points: 2, note: '', due: '' }
const POINTS = [1, 2, 3, 5]
const CLASS_ORDER: ServiceClass[] = ['standard', 'urgent', 'date', 'improve']

const Field = ({ error, id }: { error?: string; id: string }) =>
  error ? (
    <p id={id} role="alert" className="mt-1.5 text-[12.5px] leading-[1.3] font-medium text-[var(--accent)]">
      {error}
    </p>
  ) : null

/** Crear una nota: de quién es, qué tipo, cuánto esfuerzo. Lo escrito no se pierde si se cierra sin querer. */
export function NewNote({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<DraftErrors>({})
  const sprintId = useBoard((s) => s.sprint)
  const liveSprint = useBoard((s) => s.liveSprint)
  const scene = useBoard((s) => s.scene)
  const time = useClock((now) => `${longDayText(now)}, ${hourText(now)}`)
  const sprint = SPRINTS[sprintId]
  const busy = scene !== 'live'
  const peeking = sprintId !== liveSprint
  const full = localCount() >= MAX_NOTES

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      titleInput.current?.focus()
    } else if (!open && el.open) el.close()
  }, [open])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }))
  }

  const submit = () => {
    const found = checkDraft(draft, sprintId)
    setErrors(found)
    if (Object.keys(found).length) {
      if (found.title) titleInput.current?.focus()
      else if (found.owner) dialog.current?.querySelector<HTMLElement>('[data-owner-pick]')?.focus()
      return
    }
    createNote(draft, sprintId)
    setDraft(EMPTY)
    setErrors({})
    onClose()
  }

  const cancel = () => {
    setDraft(EMPTY)
    setErrors({})
    onClose()
  }

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${on ? 'bg-ink text-card' : 'bg-lane text-soft hover:text-ink'}`

  return (
    <dialog
      ref={dialog}
      aria-labelledby="new-note-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-24px)] w-[min(460px,calc(100vw-24px))] overflow-y-auto rounded-[22px] bg-card p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-black/45"
    >
      <form
        noValidate
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="new-note-title" className="text-[18px] font-semibold tracking-[-0.015em]">
              Nueva nota
            </h2>
            <p className="mt-0.5 text-[13px] text-soft">
              Entra a {sprint.lanes[0].name}, {sprint.name}. Hoy es {time}.
            </p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-lane">
            <Close size={12} />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="note-title" className="text-[13px] font-medium">
              Título
            </label>
            <span className={`text-[12px] tabular-nums ${draft.title.length > TITLE_MAX ? 'text-[var(--accent)]' : 'text-faint'}`}>
              {draft.title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            ref={titleInput}
            id="note-title"
            name="note-title"
            autoComplete="off"
            value={draft.title}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'note-title-error' : undefined}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Por ejemplo, pago con billetera digital…"
            className="mt-1.5 w-full rounded-[12px] bg-lane px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus-visible:shadow-[0_0_0_2px_var(--accent)] aria-invalid:shadow-[0_0_0_1.5px_var(--accent)]"
          />
          <Field id="note-title-error" error={errors.title} />
        </div>

        <fieldset className="mt-4">
          <legend className="text-[13px] font-medium">¿Quién se hace cargo?</legend>
          <div className="mt-2 grid grid-cols-5 gap-1" role="radiogroup" aria-label="Responsable" aria-describedby={errors.owner ? 'note-owner-error' : undefined}>
            {TEAM.map((person, i) => {
              const on = draft.owner === person.id
              return (
                <button
                  key={person.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-owner-pick={i === 0 ? true : undefined}
                  onClick={() => set('owner', person.id as PersonId)}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-[14px] py-2 transition-colors duration-150 ${on ? 'bg-ink text-card' : 'hover:bg-lane'}`}
                >
                  <Portrait person={person} face={on ? 'happy' : 'idle'} size={40} index={i} still />
                  <span className="w-full truncate px-0.5 text-center text-[11.5px] leading-[1.25] font-medium">{person.name}</span>
                </button>
              )
            })}
          </div>
          <Field id="note-owner-error" error={errors.owner} />
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-[13px] font-medium">Tipo</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CLASS_ORDER.map((cls) => (
              <button key={cls} type="button" aria-pressed={draft.cls === cls} onClick={() => set('cls', cls)} className={chip(draft.cls === cls)}>
                {CLASSES[cls].label}
              </button>
            ))}
          </div>
        </fieldset>

        {draft.cls === 'date' && (
          <div className="mt-4">
            <label htmlFor="note-due" className="text-[13px] font-medium">
              Fecha de entrega
            </label>
            <input
              id="note-due"
              name="note-due"
              type="date"
              min={todayISO()}
              value={draft.due}
              aria-invalid={!!errors.due}
              aria-describedby={errors.due ? 'note-due-error' : undefined}
              onChange={(e) => set('due', e.target.value)}
              className="mt-1.5 w-full rounded-[12px] bg-lane px-3 py-2.5 text-[14px] outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)] aria-invalid:shadow-[0_0_0_1.5px_var(--accent)]"
            />
            <Field id="note-due-error" error={errors.due} />
          </div>
        )}

        <fieldset className="mt-4">
          <legend className="text-[13px] font-medium">Esfuerzo</legend>
          <div className="mt-2 flex gap-1.5">
            {POINTS.map((p) => (
              <button key={p} type="button" aria-pressed={draft.points === p} aria-label={`${p} ${p === 1 ? 'punto' : 'puntos'}`} onClick={() => set('points', p)} className={`${chip(draft.points === p)} min-w-10`}>
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="note-detail" className="text-[13px] font-medium">
            Detalle <span className="font-normal text-faint">(opcional)</span>
          </label>
          <input
            id="note-detail"
            name="note-detail"
            autoComplete="off"
            maxLength={NOTE_MAX}
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
            className="mt-1.5 w-full rounded-[12px] bg-lane px-3 py-2.5 text-[14px] outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
          />
        </div>

        <p className="mt-4 text-[12.5px] leading-[1.35] text-soft">
          {storageAvailable()
            ? 'Solo aparece en tu pantalla y queda guardada en este navegador. Los demás siguen viendo el tablero compartido.'
            : 'Solo aparece en tu pantalla. Este navegador no permite guardar, así que se perderá al recargar.'}
        </p>
        {errors.form && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-[var(--accent)]">
            {errors.form}
          </p>
        )}
        {peeking && !busy && <p className="mt-2 text-[12.5px] font-medium text-soft">Este sprint no está en vivo: la nota empezará a moverse cuando le toque.</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={cancel} className="rounded-full px-4 py-2 text-[13.5px] font-medium text-soft hover:bg-lane hover:text-ink">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || full}
            className="rounded-full bg-ink px-4 py-2 text-[13.5px] font-medium text-card transition-transform duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Cambiando de sprint…' : full ? `Límite de ${MAX_NOTES} notas` : 'Crear nota'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

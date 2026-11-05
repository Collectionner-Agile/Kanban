import { TEAM } from '../data/team'
import { EYE_PATH } from './portraitShapes'

/** Degradados compartidos: una sola copia para todos los retratos de la página. */
export function PortraitDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        {TEAM.map((p) => (
          <g key={p.id}>
            <radialGradient id={`bg-${p.id}`} cx="0.35" cy="0.25" r="0.95">
              <stop offset="0" stopColor={p.tint} />
              <stop offset="1" stopColor={p.tintDeep} />
            </radialGradient>
            <linearGradient id={`skin-${p.id}`} x1="0.1" y1="0.1" x2="0.9" y2="0.9">
              <stop offset="0" stopColor={p.skinLight} />
              <stop offset="0.6" stopColor={p.skin} />
              <stop offset="1" stopColor={p.skinShade} />
            </linearGradient>
            <linearGradient id={`hair-${p.id}`} x1="0.15" y1="0" x2="0.75" y2="1">
              <stop offset="0" stopColor={p.hairLight} />
              <stop offset="0.5" stopColor={p.hair} />
            </linearGradient>
            <linearGradient id={`shirt-${p.id}`} x1="0.1" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor={p.shirtLight} />
              <stop offset="0.55" stopColor={p.shirt} />
              <stop offset="1" stopColor={p.shirtDeep} />
            </linearGradient>
            <linearGradient id={`neck-${p.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.skinDeep} />
              <stop offset="0.65" stopColor={p.skinShade} />
            </linearGradient>
          </g>
        ))}
        <radialGradient id="warm-cheek">
          <stop offset="0" stopColor="#D9604E" stopOpacity="0.3" />
          <stop offset="1" stopColor="#D9604E" stopOpacity="0" />
        </radialGradient>
        <clipPath id="eye-l">
          <path d={EYE_PATH.l} />
        </clipPath>
        <clipPath id="eye-r">
          <path d={EYE_PATH.r} />
        </clipPath>
      </defs>
    </svg>
  )
}

import type { CSSProperties } from 'react'

type SliderProps = {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  label?: string
  labelledBy?: string
  valueText?: string
  className?: string
}

/** A native range input, dressed up; keeps keyboard, VoiceOver and TalkBack for free. */
export function Slider({ value, min, max, step = 1, onChange, label, labelledBy, valueText, className = '' }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      type="range"
      className={`slider ${className}`}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-valuetext={valueText}
      style={{ '--fill': `${fill}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function Segmented<V extends string | number>({
  value,
  options,
  onChange,
  label,
  className = '',
}: {
  value: V
  options: { value: V; label: string; sub?: string; aria?: string }[]
  onChange: (v: V) => void
  label: string
  className?: string
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div
      className={`segmented ${className}`}
      role="group"
      aria-label={label}
      style={{ '--count': options.length, '--index': index } as CSSProperties}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          aria-label={o.aria}
          onClick={() => onChange(o.value)}
        >
          <span className="seg-main">{o.label}</span>
          {o.sub && <span className="seg-sub">{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

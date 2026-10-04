import { EMAIL_HUE, EMAIL_LABEL_NAME, STATUS_HUE, STATUS_LABEL, STATUSES, type Status } from '@/lib/constants'

type HueStyle = React.CSSProperties & { '--h': number }
export const hue = (h: number): HueStyle => ({ '--h': h })

export default function StatusChip({ status, size }: { status: Status; size?: 'sm' | 'md' }) {
  return (
    <span className={`chip-h${size ? ` ${size}` : ''}`} style={hue(STATUS_HUE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function EmailLabelChip({ category }: { category: string }) {
  return (
    <span className="chip-h sm" style={hue(EMAIL_HUE[category] ?? 250)}>
      {EMAIL_LABEL_NAME[category] ?? 'Reply'}
    </span>
  )
}

export function StageDot({ status }: { status: Status }) {
  return <span className="stage-dot" style={hue(STATUS_HUE[status])} />
}

/** Inline select styled as a coloured status pill. */
export function StatusSelect({ value, onChange, label }: { value: Status; onChange: (s: Status) => void; label: string }) {
  return (
    <select
      className="status-select"
      style={hue(STATUS_HUE[value])}
      value={value}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as Status)}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )
}

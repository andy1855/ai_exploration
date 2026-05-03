import type { ButtonHTMLAttributes } from 'react'
import styles from './Chip.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  label: string
}

export function Chip({ active = false, label, className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={[styles.chip, active ? styles.active : '', className ?? ''].join(' ')}
      {...rest}
    >
      {label}
    </button>
  )
}

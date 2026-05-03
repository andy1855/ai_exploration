import styles from './Toggle.module.css'

interface Props {
  checked: boolean
  onChange: (val: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={[styles.toggle, checked ? styles.on : ''].join(' ')}
      onClick={() => onChange(!checked)}
    />
  )
}

import styles from './Checkbox.module.css'

interface Props {
  checked: boolean
  onChange: () => void
  label?: string
}

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? '标记未完成' : '标记完成')}
      className={[styles.checkbox, checked ? styles.checked : ''].join(' ')}
      onClick={onChange}
    />
  )
}

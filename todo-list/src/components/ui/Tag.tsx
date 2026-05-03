import styles from './Tag.module.css'

interface Props {
  label: string
  onRemove?: () => void
}

export function Tag({ label, onRemove }: Props) {
  return (
    <span className={styles.tag}>
      {label}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`移除标签 ${label}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

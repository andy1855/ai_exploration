import type { Priority } from '@/types'
import styles from './PriorityDot.module.css'

const LABELS: Record<Priority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
}

interface Props {
  priority: Priority
}

export function PriorityDot({ priority }: Props) {
  return (
    <span
      className={[styles.dot, styles[priority]].join(' ')}
      title={LABELS[priority]}
      aria-label={LABELS[priority]}
    />
  )
}

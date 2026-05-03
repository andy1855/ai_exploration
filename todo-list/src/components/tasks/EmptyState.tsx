import { useStore } from '@/store'
import { Button } from '@/components/ui/Button'
import styles from './EmptyState.module.css'

interface Props {
  filtered?: boolean
}

export function EmptyState({ filtered = false }: Props) {
  const openTaskForm = useStore((s) => s.openTaskForm)

  return (
    <div className={styles.wrap} role="status">
      <div className={styles.illustration} aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="30" width="80" height="12" rx="6" fill="var(--color-border)" />
          <rect x="20" y="52" width="60" height="10" rx="5" fill="var(--color-border)" />
          <rect x="20" y="70" width="70" height="10" rx="5" fill="var(--color-border)" />
          <circle cx="90" cy="86" r="22" fill="var(--color-accent-subtle)" />
          <polyline
            points="81,86 88,93 99,79"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className={styles.title}>
        {filtered ? '该筛选下没有任务' : '暂无任务'}
      </h2>
      <p className={styles.hint}>
        {filtered
          ? '尝试调整筛选条件'
          : '点击下方按钮，创建你的第一个任务'}
      </p>

      {!filtered && (
        <Button variant="primary" onClick={() => openTaskForm()}>
          ＋ 新建任务
        </Button>
      )}
    </div>
  )
}

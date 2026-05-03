import { useStore } from '@/store'
import { useBadgeCounts } from '@/hooks/useFilteredTasks'
import type { ListId } from '@/types'
import styles from './Sidebar.module.css'

interface NavItem {
  id: ListId
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inbox', label: '收件箱', icon: '📥' },
  { id: 'today', label: '今天', icon: '☀️' },
  { id: 'upcoming', label: '即将到期', icon: '📅' },
  { id: 'archive', label: '已完成', icon: '✅' },
]

interface Props {
  className?: string
}

export function Sidebar({ className }: Props) {
  const currentListId = useStore((s) => s.currentListId)
  const setCurrentListId = useStore((s) => s.setCurrentListId)
  const badges = useBadgeCounts()

  return (
    <aside className={[styles.sidebar, className ?? ''].join(' ')} aria-label="导航">
      <nav>
        <div className={styles.sectionLabel}>列表</div>
        <ul role="list" className={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const count = badges[item.id]
            const active = currentListId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={[styles.navItem, active ? styles.active : ''].join(' ')}
                  onClick={() => setCurrentListId(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.navIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={styles.navLabel}>{item.label}</span>
                  {count > 0 && (
                    <span className={styles.badge} aria-label={`${count} 项`}>
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

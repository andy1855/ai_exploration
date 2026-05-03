import { useState } from 'react'
import { useFilteredTasks } from '@/hooks/useFilteredTasks'
import { useStore } from '@/store'
import { TaskCard } from './TaskCard'
import { EmptyState } from './EmptyState'
import { Chip } from '@/components/ui/Chip'
import type { Priority } from '@/types'
import styles from './TaskList.module.css'

type PriorityFilter = 'all' | Priority

const PRIORITY_CHIPS: { id: PriorityFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'high', label: '🔴 高优先级' },
  { id: 'medium', label: '🟡 中优先级' },
  { id: 'low', label: '⚫ 低优先级' },
]

const LIST_TITLES: Record<string, string> = {
  inbox: '收件箱',
  today: '今天',
  upcoming: '即将到期',
  archive: '已完成',
}

const LIST_HINTS: Record<string, string> = {
  inbox: '所有未完成任务',
  today: '截止日期为今天的任务',
  upcoming: '未来 7 天内截止的任务',
  archive: '已标记为完成的任务',
}

export function TaskList() {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const currentListId = useStore((s) => s.currentListId)
  const maxTags = useStore((s) => s.config.ui.maxVisibleTags)
  const tasks = useFilteredTasks()

  const filtered =
    priorityFilter === 'all' ? tasks : tasks.filter((t) => t.priority === priorityFilter)

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>{LIST_TITLES[currentListId]}</h1>
          <p className={styles.hint}>{LIST_HINTS[currentListId]}</p>
        </div>
        <div
          className={styles.chips}
          role="group"
          aria-label="优先级筛选"
        >
          {PRIORITY_CHIPS.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={priorityFilter === c.id}
              onClick={() => setPriorityFilter(c.id)}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState filtered={priorityFilter !== 'all' || tasks.length > 0} />
      ) : (
        <ul role="list" className={styles.list}>
          {filtered.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} maxTags={maxTags} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

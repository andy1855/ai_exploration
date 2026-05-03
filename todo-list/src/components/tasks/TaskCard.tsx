import { useState } from 'react'
import type { Task } from '@/types'
import { useStore } from '@/store'
import { Checkbox } from '@/components/ui/Checkbox'
import { PriorityDot } from '@/components/ui/PriorityDot'
import { Tag } from '@/components/ui/Tag'
import { Button } from '@/components/ui/Button'
import styles from './TaskCard.module.css'

function formatDueDate(dueDate: string | null): { label: string; className: string } | null {
  if (!dueDate) return null
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  if (dueDate < today) {
    const [, m, dd] = dueDate.split('-')
    return { label: `已逾期 · ${m}/${dd}`, className: styles.overdue }
  }
  if (dueDate === today) return { label: '今天', className: styles.today }
  if (dueDate === tomorrow) return { label: '明天', className: '' }
  const [, m, dd] = dueDate.split('-')
  return { label: `${m}/${dd}`, className: '' }
}

interface Props {
  task: Task
  maxTags?: number
}

export function TaskCard({ task, maxTags = 3 }: Props) {
  const [expanded, setExpanded] = useState(false)
  const toggleTask = useStore((s) => s.toggleTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const openTaskForm = useStore((s) => s.openTaskForm)
  const toggleSubtask = useStore((s) => s.toggleSubtask)

  const due = formatDueDate(task.dueDate)
  const visibleTags = task.tags.slice(0, maxTags)
  const hiddenCount = task.tags.length - visibleTags.length

  const doneSubtasks = task.subtasks.filter((s) => s.done).length
  const totalSubtasks = task.subtasks.length

  return (
    <article
      className={[styles.card, task.done ? styles.done : ''].join(' ')}
      aria-label={task.title}
    >
      <div className={styles.main}>
        <Checkbox checked={task.done} onChange={() => toggleTask(task.id)} />

        <div className={styles.body} onClick={() => setExpanded((v) => !v)}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{task.title}</h2>
            {totalSubtasks > 0 && (
              <span className={styles.subtaskBadge}>
                {doneSubtasks}/{totalSubtasks}
              </span>
            )}
          </div>

          <div className={styles.meta}>
            <PriorityDot priority={task.priority} />
            {due && (
              <span className={[styles.due, due.className].join(' ')}>
                {due.label}
              </span>
            )}
            {visibleTags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
            {hiddenCount > 0 && (
              <span className={styles.moreTags}>+{hiddenCount}</span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            icon={<span>✏️</span>}
            onClick={() => openTaskForm(task.id)}
            aria-label="编辑任务"
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<span>🗑</span>}
            onClick={() => deleteTask(task.id)}
            aria-label="删除任务"
          />
        </div>
      </div>

      {expanded && (
        <div className={styles.expanded}>
          {task.description && (
            <p className={styles.description}>{task.description}</p>
          )}

          {totalSubtasks > 0 && (
            <ul className={styles.subtaskList} role="list">
              {task.subtasks.map((st) => (
                <li key={st.id} className={styles.subtaskItem}>
                  <Checkbox
                    checked={st.done}
                    onChange={() => toggleSubtask(task.id, st.id)}
                    label={st.title}
                  />
                  <span className={[styles.subtaskTitle, st.done ? styles.subtaskDone : ''].join(' ')}>
                    {st.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}

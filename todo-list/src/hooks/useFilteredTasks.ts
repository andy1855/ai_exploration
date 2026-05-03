import { useMemo } from 'react'
import { useStore } from '@/store'
import type { Task, ListId, Priority } from '@/types'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function upcomingRange() {
  const today = new Date()
  const end = new Date()
  end.setDate(today.getDate() + 7)
  return {
    start: today.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function sortTasks(tasks: Task[], primary: string, direction: 'asc' | 'desc'): Task[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0
    if (primary === 'dueDate') {
      const da = a.dueDate ?? '9999-12-31'
      const db = b.dueDate ?? '9999-12-31'
      cmp = da < db ? -1 : da > db ? 1 : 0
    } else if (primary === 'priority') {
      cmp = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    } else if (primary === 'createdAt') {
      cmp = a.createdAt < b.createdAt ? -1 : 1
    }
    return direction === 'asc' ? cmp : -cmp
  })
}

export function useFilteredTasks(listId?: ListId) {
  const tasks = useStore((s) => s.tasks)
  const currentListId = useStore((s) => s.currentListId)
  const sort = useStore((s) => s.config.sort)

  const id = listId ?? currentListId
  const today = todayStr()
  const { start, end } = upcomingRange()

  return useMemo(() => {
    let filtered: Task[]
    if (id === 'inbox') {
      filtered = tasks.filter((t) => !t.done)
    } else if (id === 'today') {
      filtered = tasks.filter((t) => !t.done && t.dueDate === today)
    } else if (id === 'upcoming') {
      filtered = tasks.filter(
        (t) => !t.done && t.dueDate != null && t.dueDate >= start && t.dueDate <= end,
      )
    } else {
      // archive
      filtered = tasks.filter((t) => t.done)
    }
    return sortTasks(filtered, sort.primary, sort.direction)
  }, [tasks, id, today, start, end, sort])
}

export function useBadgeCounts() {
  const tasks = useStore((s) => s.tasks)
  const today = todayStr()
  const { start, end } = upcomingRange()

  return useMemo(
    () => ({
      inbox: tasks.filter((t) => !t.done).length,
      today: tasks.filter((t) => !t.done && t.dueDate === today).length,
      upcoming: tasks.filter(
        (t) => !t.done && t.dueDate != null && t.dueDate >= start && t.dueDate <= end,
      ).length,
      archive: tasks.filter((t) => t.done).length,
    }),
    [tasks, today, start, end],
  )
}

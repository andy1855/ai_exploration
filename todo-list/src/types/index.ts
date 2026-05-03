export type Priority = 'low' | 'medium' | 'high'
export type ListId = 'inbox' | 'today' | 'upcoming' | 'archive'
export type ThemeOption = 'light' | 'dark' | 'system'
export type LocaleOption = 'zh-CN' | 'en-US'
export type DensityOption = 'comfortable' | 'compact'
export type SortField = 'dueDate' | 'priority' | 'createdAt' | 'manual'

export interface SubTask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  done: boolean
  priority: Priority
  dueDate: string | null   // "YYYY-MM-DD"
  tags: string[]
  listId: string
  createdAt: string        // ISO timestamp
  completedAt: string | null
  subtasks: SubTask[]
}

export interface AppConfig {
  version: string
  theme: ThemeOption
  locale: LocaleOption
  features: {
    subtasks: boolean
    dueReminders: boolean
    dragReorder: boolean
    archiveCompleted: boolean
    showSidebar: boolean
  }
  defaults: {
    newTaskPriority: Priority
    dueDateOffsetDays: number
    defaultListId: string
  }
  reminders: {
    enabled: boolean
    minutesBeforeDue: number[]
    quietHours: {
      enabled: boolean
      start: string
      end: string
    }
  }
  storage: {
    localKeyPrefix: string
    syncEndpoint: string | null
  }
  ui: {
    sidebarExpanded: boolean
    sidebarWidthPx: number
    pageSize: number
    maxVisibleTags: number
    animationDurationMs: number
    density: DensityOption
  }
  sort: {
    primary: SortField
    direction: 'asc' | 'desc'
  }
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, AppConfig, ListId } from '@/types'
import { defaultConfig } from '@/config/defaults'

function uid(): string {
  // crypto.randomUUID() 仅在 HTTPS 下可用，HTTP 下回退到 Math.random
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const SEED_TASKS: Task[] = [
  {
    id: uid(),
    title: '整理试卷 OCR 管线验收标准',
    description: '补充题干完整性、题号保留、底部清洁三项指标的量化说明',
    done: false,
    priority: 'high',
    dueDate: todayStr(),
    tags: ['工作', '文档'],
    listId: 'inbox',
    createdAt: new Date().toISOString(),
    completedAt: null,
    subtasks: [
      { id: uid(), title: '量化题干完整性阈值', done: false },
      { id: uid(), title: '补充图形保留判定规则', done: true },
    ],
  },
  {
    id: uid(),
    title: '实现 reminders.quietHours 浏览器通知联调',
    description: '',
    done: false,
    priority: 'medium',
    dueDate: offsetDate(7),
    tags: ['工作', '开发'],
    listId: 'inbox',
    createdAt: new Date().toISOString(),
    completedAt: null,
    subtasks: [],
  },
  {
    id: uid(),
    title: '补充深色主题对比度自检',
    description: 'WCAG AA 最低 4.5:1',
    done: false,
    priority: 'low',
    dueDate: offsetDate(-2),
    tags: ['设计'],
    listId: 'inbox',
    createdAt: new Date().toISOString(),
    completedAt: null,
    subtasks: [],
  },
  {
    id: uid(),
    title: '核对 config.schema.json 字段与 UI 绑定',
    description: '',
    done: true,
    priority: 'medium',
    dueDate: offsetDate(-1),
    tags: ['开发'],
    listId: 'inbox',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    subtasks: [],
  },
  {
    id: uid(),
    title: '阅读《深度学习》第 5 章',
    description: '',
    done: false,
    priority: 'low',
    dueDate: offsetDate(3),
    tags: ['学习'],
    listId: 'inbox',
    createdAt: new Date().toISOString(),
    completedAt: null,
    subtasks: [],
  },
]

interface StoreState {
  tasks: Task[]
  config: AppConfig
  currentListId: ListId
  isTaskFormOpen: boolean
  editingTaskId: string | null
  isSettingsOpen: boolean

  // Task actions
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => void
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void

  // Navigation
  setCurrentListId: (id: ListId) => void

  // UI state
  openTaskForm: (editId?: string) => void
  closeTaskForm: () => void
  openSettings: () => void
  closeSettings: () => void

  // Config
  updateConfig: <K extends keyof AppConfig>(section: K, value: AppConfig[K]) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      tasks: SEED_TASKS,
      config: defaultConfig,
      currentListId: 'inbox',
      isTaskFormOpen: false,
      editingTaskId: null,
      isSettingsOpen: false,

      addTask: (data) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              ...data,
              id: uid(),
              createdAt: new Date().toISOString(),
              completedAt: null,
            },
          ],
        })),

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  done: !t.done,
                  completedAt: !t.done ? new Date().toISOString() : null,
                }
              : t,
          ),
        })),

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addSubtask: (taskId, title) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: [...t.subtasks, { id: uid(), title, done: false }],
                }
              : t,
          ),
        })),

      toggleSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((st) =>
                    st.id === subtaskId ? { ...st, done: !st.done } : st,
                  ),
                }
              : t,
          ),
        })),

      setCurrentListId: (id) => set({ currentListId: id }),

      openTaskForm: (editId) =>
        set({ isTaskFormOpen: true, editingTaskId: editId ?? null }),
      closeTaskForm: () =>
        set({ isTaskFormOpen: false, editingTaskId: null }),

      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),

      updateConfig: (section, value) =>
        set((s) => ({ config: { ...s.config, [section]: value } })),
    }),
    {
      name: 'todolist:v1:store',
      partialize: (s) => ({ tasks: s.tasks, config: s.config }),
    },
  ),
)

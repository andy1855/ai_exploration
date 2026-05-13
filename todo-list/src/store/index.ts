import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, AppConfig, ListId } from '@/types'
import { defaultConfig } from '@/config/defaults'
import { api } from '@/api'

interface StoreState {
  tasks: Task[]
  config: AppConfig
  loading: boolean
  error: string | null
  currentListId: ListId
  isTaskFormOpen: boolean
  editingTaskId: string | null
  isSettingsOpen: boolean

  // Data loading
  fetchTasks: () => Promise<void>
  fetchConfig: () => Promise<void>

  // Task actions
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => Promise<void>
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>

  // Navigation
  setCurrentListId: (id: ListId) => void

  // UI state
  openTaskForm: (editId?: string) => void
  closeTaskForm: () => void
  openSettings: () => void
  closeSettings: () => void

  // Config
  updateConfig: <K extends keyof AppConfig>(section: K, value: AppConfig[K]) => void
  syncConfig: () => Promise<void>
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      config: defaultConfig,
      loading: true,
      error: null,
      currentListId: 'inbox',
      isTaskFormOpen: false,
      editingTaskId: null,
      isSettingsOpen: false,

      // ── 数据加载 ─────────────────────────────────────
      fetchTasks: async () => {
        try {
          set({ loading: true, error: null })
          const tasks = await api.fetchTasks()
          set({ tasks, loading: false })
        } catch (e) {
          set({ error: (e as Error).message, loading: false })
        }
      },

      fetchConfig: async () => {
        try {
          const serverConfig = await api.fetchConfig()
          // 合并服务器配置与默认值，服务器返回空 {} 时不会丢失默认字段
          set({ config: { ...defaultConfig, ...serverConfig } })
        } catch {
          // 服务器无配置时忽略，用默认值
        }
      },

      // ── 任务 CRUD ────────────────────────────────────
      addTask: async (data) => {
        try {
          set({ error: null })
          const task = await api.createTask(data)
          set((s) => ({ tasks: [task, ...s.tasks] }))
        } catch (e) {
          set({ error: (e as Error).message })
        }
      },

      updateTask: async (id, patch) => {
        const prev = get().tasks
        // 乐观更新
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }))
        try {
          await api.updateTask(id, patch)
        } catch (e) {
          set({ tasks: prev, error: (e as Error).message })
        }
      },

      toggleTask: async (id) => {
        const prev = get().tasks
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
        }))
        try {
          await api.toggleTask(id)
        } catch (e) {
          set({ tasks: prev, error: (e as Error).message })
        }
      },

      deleteTask: async (id) => {
        const prev = get().tasks
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
        try {
          await api.deleteTask(id)
        } catch (e) {
          set({ tasks: prev, error: (e as Error).message })
        }
      },

      addSubtask: async (taskId, title) => {
        try {
          set({ error: null })
          const updated = await api.addSubtask(taskId, title)
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
          }))
        } catch (e) {
          set({ error: (e as Error).message })
        }
      },

      toggleSubtask: async (taskId, subtaskId) => {
        try {
          set({ error: null })
          const updated = await api.toggleSubtask(taskId, subtaskId)
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
          }))
        } catch (e) {
          set({ error: (e as Error).message })
        }
      },

      // ── 导航 ─────────────────────────────────────────
      setCurrentListId: (id) => set({ currentListId: id }),

      // ── UI ────────────────────────────────────────────
      openTaskForm: (editId) =>
        set({ isTaskFormOpen: true, editingTaskId: editId ?? null }),
      closeTaskForm: () =>
        set({ isTaskFormOpen: false, editingTaskId: null }),

      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),

      // ── 配置 ─────────────────────────────────────────
      updateConfig: (section, value) =>
        set((s) => ({ config: { ...s.config, [section]: value } })),

      syncConfig: async () => {
        try {
          await api.saveConfig(get().config)
        } catch (e) {
          set({ error: (e as Error).message })
        }
      },
    }),
    {
      name: 'todolist:v2:store',
      partialize: (s) => ({ tasks: s.tasks, config: s.config }),
      version: 2,
      migrate: (persisted, version) => {
        if (version !== 2) return { tasks: [], config: defaultConfig }
        return persisted as { tasks: Task[]; config: AppConfig }
      },
    },
  ),
)

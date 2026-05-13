import type { Task, AppConfig } from '@/types'

// 后端 API 地址 — 部署时与前端同域，开发时用 localhost
const BASE = import.meta.env.DEV
  ? 'http://localhost:3000'
  : ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

export const api = {
  // ─── Tasks ──────────────────────────────────────────────
  fetchTasks(): Promise<Task[]> {
    return request<Task[]>('/tasks')
  },

  createTask(data: Omit<Task, 'id' | 'createdAt' | 'completedAt'>): Promise<Task> {
    return request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        subtasks: data.subtasks ?? [],
      }),
    })
  },

  updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
    return request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
  },

  toggleTask(id: string): Promise<Task> {
    return request<Task>(`/tasks/${id}/toggle`, { method: 'PATCH' })
  },

  deleteTask(id: string): Promise<{ ok: boolean }> {
    return request(`/tasks/${id}`, { method: 'DELETE' })
  },

  addSubtask(taskId: string, title: string): Promise<Task> {
    return request<Task>(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
  },

  toggleSubtask(taskId: string, subtaskId: string): Promise<Task> {
    return request<Task>(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH',
    })
  },

  // ─── Config ─────────────────────────────────────────────
  fetchConfig(): Promise<AppConfig> {
    return request<AppConfig>('/config')
  },

  saveConfig(config: AppConfig): Promise<{ ok: boolean }> {
    return request('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  },
}

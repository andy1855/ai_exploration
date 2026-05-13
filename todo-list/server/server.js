import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ─── 路径配置 ─────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = '/var/data'            // 统一数据目录
const DB_PATH = join(DATA_DIR, 'todo-list.db')
const STATIC_DIR = join(__dirname, '..', 'dist')   // 前端构建产物

// 确保数据目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// ─── 数据库初始化 ─────────────────────────────────────────
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT DEFAULT '',
    done          INTEGER DEFAULT 0,
    priority      TEXT DEFAULT 'medium',
    due_date      TEXT,
    tags          TEXT DEFAULT '[]',
    list_id       TEXT DEFAULT 'inbox',
    created_at    TEXT NOT NULL,
    completed_at  TEXT,
    subtasks      TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// ─── 辅助函数 ─────────────────────────────────────────────
function rowToTask(row) {
  return {
    ...row,
    done: !!row.done,
    tags: JSON.parse(row.tags || '[]'),
    subtasks: JSON.parse(row.subtasks || '[]'),
  }
}

// ─── Express 应用 ────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// ==== API 路由 ============================================

// GET /api/tasks — 获取所有任务
app.get('/api/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all()
  res.json(rows.map(rowToTask))
})

// POST /api/tasks — 创建任务
app.post('/api/tasks', (req, res) => {
  const {
    title, description = '', done = false, priority = 'medium',
    dueDate = null, tags = [], listId = 'inbox', subtasks = [],
  } = req.body
  const id = randomUUID()
  const now = new Date().toISOString()
  const completedAt = done ? now : null

  db.prepare(`
    INSERT INTO tasks (id, title, description, done, priority, due_date, tags, list_id, created_at, completed_at, subtasks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description, done ? 1 : 0, priority, dueDate,
    JSON.stringify(tags), listId, now, completedAt, JSON.stringify(subtasks))

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  res.status(201).json(rowToTask(row))
})

// PUT /api/tasks/:id — 更新任务
app.put('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const {
    title, description, done, priority, dueDate,
    tags, listId, list_id, subtasks,
  } = req.body

  const fields = []
  const values = []

  if (title !== undefined) { fields.push('title = ?'); values.push(title) }
  if (description !== undefined) { fields.push('description = ?'); values.push(description) }
  if (done !== undefined) { fields.push('done = ?'); values.push(done ? 1 : 0) }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority) }
  if (dueDate !== undefined) { fields.push('due_date = ?'); values.push(dueDate) }
  if (tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(tags)) }
  if (subtasks !== undefined) { fields.push('subtasks = ?'); values.push(JSON.stringify(subtasks)) }

  const targetListId = listId ?? list_id
  if (targetListId !== undefined) { fields.push('list_id = ?'); values.push(targetListId) }

  if (done === true) {
    fields.push('completed_at = ?')
    values.push(new Date().toISOString())
  } else if (done === false) {
    fields.push('completed_at = ?')
    values.push(null)
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' })

  values.push(req.params.id)
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  res.json(rowToTask(row))
})

// PATCH /api/tasks/:id/toggle — 切换完成状态
app.patch('/api/tasks/:id/toggle', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const newDone = !existing.done
  const completedAt = newDone ? new Date().toISOString() : null
  db.prepare('UPDATE tasks SET done = ?, completed_at = ? WHERE id = ?')
    .run(newDone ? 1 : 0, completedAt, req.params.id)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  res.json(rowToTask(row))
})

// DELETE /api/tasks/:id — 删除任务
app.delete('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/tasks/:id/subtasks — 添加子任务
app.post('/api/tasks/:id/subtasks', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const { title } = req.body
  if (!title) return res.status(400).json({ error: 'Subtask title is required' })

  const subtasks = JSON.parse(existing.subtasks || '[]')
  subtasks.push({ id: randomUUID(), title, done: false })
  db.prepare('UPDATE tasks SET subtasks = ? WHERE id = ?')
    .run(JSON.stringify(subtasks), req.params.id)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  res.status(201).json(rowToTask(row))
})

// PATCH /api/tasks/:id/subtasks/:subtaskId/toggle — 切换子任务
app.patch('/api/tasks/:id/subtasks/:subtaskId/toggle', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const subtasks = JSON.parse(existing.subtasks || '[]')
  const idx = subtasks.findIndex(s => s.id === req.params.subtaskId)
  if (idx === -1) return res.status(404).json({ error: 'Subtask not found' })

  subtasks[idx].done = !subtasks[idx].done
  db.prepare('UPDATE tasks SET subtasks = ? WHERE id = ?')
    .run(JSON.stringify(subtasks), req.params.id)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  res.json(rowToTask(row))
})

// GET /api/config — 获取配置
app.get('/api/config', (req, res) => {
  const rows = db.prepare('SELECT * FROM config').all()
  const config = {}
  for (const row of rows) {
    config[row.key] = JSON.parse(row.value)
  }
  res.json(config)
})

// PUT /api/config — 保存配置
app.put('/api/config', (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const transaction = db.transaction((config) => {
    for (const [key, value] of Object.entries(config)) {
      upsert.run(key, JSON.stringify(value))
    }
  })
  transaction(req.body)
  res.json({ ok: true })
})

// ==== 静态文件服务（前端） ==================================
app.use(express.static(STATIC_DIR))

// SPA 回退 — 所有非 API 路由返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' })
  }
  res.sendFile(join(STATIC_DIR, 'index.html'))
})

// ─── 启动 ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Todo List API running at http://0.0.0.0:${PORT}`)
  console.log(`📁 Database: ${DB_PATH}`)
  console.log(`📦 Static:   ${STATIC_DIR}`)
})

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useStore } from '@/store'
import type { Priority, Task } from '@/types'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Tag'
import styles from './TaskForm.module.css'

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: '🔴 高' },
  { value: 'medium', label: '🟡 中' },
  { value: 'low', label: '⚫ 低' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function buildInitial(task: Task | undefined, defaultPriority: Priority) {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? defaultPriority,
    dueDate: task?.dueDate ?? '',
    tags: task?.tags ?? [],
    listId: task?.listId ?? 'inbox',
  }
}

export function TaskForm() {
  const isOpen = useStore((s) => s.isTaskFormOpen)
  const editingId = useStore((s) => s.editingTaskId)
  const closeTaskForm = useStore((s) => s.closeTaskForm)
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)
  const tasks = useStore((s) => s.tasks)
  const defaultPriority = useStore((s) => s.config.defaults.newTaskPriority)

  const editingTask = editingId ? tasks.find((t) => t.id === editingId) : undefined
  const isEdit = !!editingTask

  const [form, setForm] = useState(() => buildInitial(editingTask, defaultPriority))
  const [tagInput, setTagInput] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitial(editingTask, defaultPriority))
      setTagInput('')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [isOpen, editingId]) // eslint-disable-line react-hooks/exhaustive-deps

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag] }))
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      dueDate: form.dueDate || null,
      tags: form.tags,
      listId: form.listId,
      done: editingTask?.done ?? false,
      subtasks: editingTask?.subtasks ?? [],
    }

    if (isEdit && editingId) {
      updateTask(editingId, payload)
    } else {
      addTask(payload)
    }
    closeTaskForm()
  }

  if (!isOpen) return null

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && closeTaskForm()}
      role="presentation"
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="taskform-title"
      >
        <div className={styles.header}>
          <h2 id="taskform-title" className={styles.heading}>
            {isEdit ? '编辑任务' : '新建任务'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            icon={<span>✕</span>}
            onClick={closeTaskForm}
            aria-label="关闭"
          />
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Title */}
          <div className={styles.field}>
            <label htmlFor="tf-title" className={styles.label}>
              标题 <span className={styles.required}>*</span>
            </label>
            <input
              ref={titleRef}
              id="tf-title"
              className={styles.input}
              placeholder="任务名称"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label htmlFor="tf-desc" className={styles.label}>
              备注
            </label>
            <textarea
              id="tf-desc"
              className={[styles.input, styles.textarea].join(' ')}
              placeholder="补充说明（可选）"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className={styles.row2}>
            {/* Priority */}
            <div className={styles.field}>
              <label htmlFor="tf-priority" className={styles.label}>优先级</label>
              <select
                id="tf-priority"
                className={styles.select}
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as Priority }))
                }
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div className={styles.field}>
              <label htmlFor="tf-due" className={styles.label}>截止日期</label>
              <input
                id="tf-due"
                type="date"
                className={styles.input}
                min={todayStr()}
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label htmlFor="tf-tags" className={styles.label}>标签</label>
            <div className={styles.tagWrap}>
              {form.tags.map((t) => (
                <Tag key={t} label={t} onRemove={() => removeTag(t)} />
              ))}
              <input
                id="tf-tags"
                className={styles.tagInput}
                placeholder="输入后按 Enter 添加"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(tagInput)
                  }
                }}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <Button type="button" variant="ghost" onClick={closeTaskForm}>
              取消
            </Button>
            <Button type="submit" variant="primary">
              {isEdit ? '保存' : '创建'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

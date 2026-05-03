import type { ReactNode } from 'react'
import { useStore } from '@/store'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import type { ThemeOption, LocaleOption, DensityOption, SortField } from '@/types'
import styles from './SettingsPanel.module.css'

interface RowProps {
  label: string
  hint?: string
  children: ReactNode
}

function FormRow({ label, hint, children }: RowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {hint && <span className={styles.rowHint}>{hint}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

export function SettingsPanel() {
  const isOpen = useStore((s) => s.isSettingsOpen)
  const closeSettings = useStore((s) => s.closeSettings)
  const config = useStore((s) => s.config)
  const updateConfig = useStore((s) => s.updateConfig)

  if (!isOpen) return null

  function setTheme(v: ThemeOption) {
    updateConfig('theme', v)
  }

  function setLocale(v: LocaleOption) {
    updateConfig('locale', v)
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && closeSettings()}
      role="presentation"
    >
      <aside
        className={styles.panel}
        role="complementary"
        aria-label="设置面板"
      >
        <div className={styles.header}>
          <h2 className={styles.heading}>设置</h2>
          <Button
            variant="ghost"
            size="sm"
            icon={<span>✕</span>}
            onClick={closeSettings}
            aria-label="关闭设置"
          />
        </div>

        <div className={styles.body}>
          {/* 外观 */}
          <section>
            <div className={styles.sectionLabel}>外观</div>

            <FormRow label="主题" hint="theme">
              <select
                className={styles.select}
                value={config.theme}
                onChange={(e) => setTheme(e.target.value as ThemeOption)}
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select>
            </FormRow>

            <FormRow label="语言" hint="locale">
              <select
                className={styles.select}
                value={config.locale}
                onChange={(e) => setLocale(e.target.value as LocaleOption)}
              >
                <option value="zh-CN">中文（简体）</option>
                <option value="en-US">English (US)</option>
              </select>
            </FormRow>

            <FormRow label="列表密度" hint="ui.density">
              <select
                className={styles.select}
                value={config.ui.density}
                onChange={(e) =>
                  updateConfig('ui', { ...config.ui, density: e.target.value as DensityOption })
                }
              >
                <option value="comfortable">舒适</option>
                <option value="compact">紧凑</option>
              </select>
            </FormRow>
          </section>

          {/* 功能 */}
          <section>
            <div className={styles.sectionLabel}>功能</div>

            <FormRow label="子任务" hint="features.subtasks">
              <Toggle
                checked={config.features.subtasks}
                onChange={(v) =>
                  updateConfig('features', { ...config.features, subtasks: v })
                }
              />
            </FormRow>

            <FormRow label="截止提醒" hint="features.dueReminders">
              <Toggle
                checked={config.features.dueReminders}
                onChange={(v) =>
                  updateConfig('features', { ...config.features, dueReminders: v })
                }
              />
            </FormRow>

            <FormRow label="拖拽排序" hint="features.dragReorder">
              <Toggle
                checked={config.features.dragReorder}
                onChange={(v) =>
                  updateConfig('features', { ...config.features, dragReorder: v })
                }
              />
            </FormRow>

            <FormRow label="完成后自动归档" hint="features.archiveCompleted">
              <Toggle
                checked={config.features.archiveCompleted}
                onChange={(v) =>
                  updateConfig('features', { ...config.features, archiveCompleted: v })
                }
              />
            </FormRow>

            <FormRow label="显示侧栏" hint="features.showSidebar">
              <Toggle
                checked={config.features.showSidebar}
                onChange={(v) =>
                  updateConfig('features', { ...config.features, showSidebar: v })
                }
              />
            </FormRow>
          </section>

          {/* 默认值 */}
          <section>
            <div className={styles.sectionLabel}>默认值</div>

            <FormRow label="新任务默认优先级" hint="defaults.newTaskPriority">
              <select
                className={styles.select}
                value={config.defaults.newTaskPriority}
                onChange={(e) =>
                  updateConfig('defaults', {
                    ...config.defaults,
                    newTaskPriority: e.target.value as 'low' | 'medium' | 'high',
                  })
                }
              >
                <option value="high">🔴 高</option>
                <option value="medium">🟡 中</option>
                <option value="low">⚫ 低</option>
              </select>
            </FormRow>
          </section>

          {/* 排序 */}
          <section>
            <div className={styles.sectionLabel}>排序</div>

            <FormRow label="主排序字段" hint="sort.primary">
              <select
                className={styles.select}
                value={config.sort.primary}
                onChange={(e) =>
                  updateConfig('sort', {
                    ...config.sort,
                    primary: e.target.value as SortField,
                  })
                }
              >
                <option value="dueDate">截止日期</option>
                <option value="priority">优先级</option>
                <option value="createdAt">创建时间</option>
                <option value="manual">手动排序</option>
              </select>
            </FormRow>

            <FormRow label="排序方向" hint="sort.direction">
              <select
                className={styles.select}
                value={config.sort.direction}
                onChange={(e) =>
                  updateConfig('sort', {
                    ...config.sort,
                    direction: e.target.value as 'asc' | 'desc',
                  })
                }
              >
                <option value="asc">升序</option>
                <option value="desc">降序</option>
              </select>
            </FormRow>
          </section>

          {/* 界面 */}
          <section>
            <div className={styles.sectionLabel}>界面</div>

            <FormRow label="最多显示标签数" hint="ui.maxVisibleTags">
              <input
                type="number"
                className={styles.numberInput}
                min={0}
                max={10}
                value={config.ui.maxVisibleTags}
                onChange={(e) =>
                  updateConfig('ui', {
                    ...config.ui,
                    maxVisibleTags: Number(e.target.value),
                  })
                }
              />
            </FormRow>

            <FormRow label="动画时长 (ms)" hint="ui.animationDurationMs">
              <input
                type="number"
                className={styles.numberInput}
                min={0}
                max={500}
                step={20}
                value={config.ui.animationDurationMs}
                onChange={(e) =>
                  updateConfig('ui', {
                    ...config.ui,
                    animationDurationMs: Number(e.target.value),
                  })
                }
              />
            </FormRow>
          </section>

          {/* Reminders */}
          <section>
            <div className={styles.sectionLabel}>提醒</div>

            <FormRow label="启用截止提醒" hint="reminders.enabled">
              <Toggle
                checked={config.reminders.enabled}
                onChange={(v) =>
                  updateConfig('reminders', { ...config.reminders, enabled: v })
                }
              />
            </FormRow>

            <FormRow label="免打扰时段" hint="reminders.quietHours.enabled">
              <Toggle
                checked={config.reminders.quietHours.enabled}
                onChange={(v) =>
                  updateConfig('reminders', {
                    ...config.reminders,
                    quietHours: { ...config.reminders.quietHours, enabled: v },
                  })
                }
              />
            </FormRow>

            {config.reminders.quietHours.enabled && (
              <div className={styles.quietHoursRow}>
                <label className={styles.inlineLabel}>
                  开始
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={config.reminders.quietHours.start}
                    onChange={(e) =>
                      updateConfig('reminders', {
                        ...config.reminders,
                        quietHours: {
                          ...config.reminders.quietHours,
                          start: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <span className={styles.rangeDash}>—</span>
                <label className={styles.inlineLabel}>
                  结束
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={config.reminders.quietHours.end}
                    onChange={(e) =>
                      updateConfig('reminders', {
                        ...config.reminders,
                        quietHours: {
                          ...config.reminders.quietHours,
                          end: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

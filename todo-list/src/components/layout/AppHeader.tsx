import { useStore } from '@/store'
import { Button } from '@/components/ui/Button'
import styles from './AppHeader.module.css'

const THEME_ICONS: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  system: '◐',
}

const NEXT_THEME: Record<string, 'light' | 'dark' | 'system'> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const THEME_LABELS: Record<string, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

export function AppHeader() {
  const theme = useStore((s) => s.config.theme)
  const updateConfig = useStore((s) => s.updateConfig)
  const openTaskForm = useStore((s) => s.openTaskForm)
  const openSettings = useStore((s) => s.openSettings)

  function cycleTheme() {
    updateConfig('theme', NEXT_THEME[theme])
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <svg
          className={styles.logo}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="28" height="28" rx="8" fill="var(--color-accent)" />
          <polyline
            points="8,14 12,18 20,10"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.name}>Todo List</span>
      </div>

      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          icon={<span>{THEME_ICONS[theme]}</span>}
          onClick={cycleTheme}
          aria-label={`当前：${THEME_LABELS[theme]}，点击切换`}
          title={`当前：${THEME_LABELS[theme]}`}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<span>⚙</span>}
          onClick={openSettings}
          aria-label="设置"
          title="设置"
        />
        <Button
          variant="primary"
          size="sm"
          icon={<span>＋</span>}
          onClick={() => openTaskForm()}
        >
          新建任务
        </Button>
      </div>
    </header>
  )
}

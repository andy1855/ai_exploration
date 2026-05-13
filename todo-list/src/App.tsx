import { useEffect, type ComponentType } from 'react'
import { useStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { AppHeader } from '@/components/layout/AppHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { TaskForm } from '@/components/tasks/TaskForm'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { InboxPage } from '@/pages/InboxPage'
import { TodayPage } from '@/pages/TodayPage'
import { UpcomingPage } from '@/pages/UpcomingPage'
import { ArchivePage } from '@/pages/ArchivePage'
import type { ListId } from '@/types'
import styles from './App.module.css'

const PAGES: Record<ListId, ComponentType> = {
  inbox: InboxPage,
  today: TodayPage,
  upcoming: UpcomingPage,
  archive: ArchivePage,
}

export default function App() {
  useTheme()

  const currentListId = useStore((s) => s.currentListId)
  const showSidebar = useStore((s) => s.config.features.showSidebar)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const fetchTasks = useStore((s) => s.fetchTasks)
  const fetchConfig = useStore((s) => s.fetchConfig)

  useEffect(() => {
    fetchTasks()
    fetchConfig()
  }, [fetchTasks, fetchConfig])

  const Page = PAGES[currentListId]

  return (
    <div className={styles.app}>
      <AppHeader />
      {error && <div className={styles.errorBanner}>{error}</div>}
      {loading && <div className={styles.loadingBar} />}
      <div className={styles.body}>
        {showSidebar && <Sidebar />}
        <main className={styles.main}>
          <Page />
        </main>
      </div>
      <TaskForm />
      <SettingsPanel />
    </div>
  )
}

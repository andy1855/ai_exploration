import type { ComponentType } from 'react'
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

  const Page = PAGES[currentListId]

  return (
    <div className={styles.app}>
      <AppHeader />
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

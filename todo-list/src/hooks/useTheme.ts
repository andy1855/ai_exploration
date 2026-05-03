import { useEffect } from 'react'
import { useStore } from '@/store'

export function useTheme() {
  const theme = useStore((s) => s.config.theme)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    function apply() {
      if (theme === 'system') {
        root.setAttribute('data-theme', media.matches ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', theme)
      }
    }

    apply()
    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [theme])
}

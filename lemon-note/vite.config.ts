import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 构建产物目录：默认 `dist`（本地）；生产可设 `LEMON_NOTE_OUT_DIR` 直接写入 Web 目录，例如 `/var/www/lemon-note`。
 * 推荐使用 `npm run build:www`（Linux/macOS 服务器）。
 */
const resolvedOutDir = (() => {
  const raw = process.env.LEMON_NOTE_OUT_DIR?.trim()
  if (!raw) return 'dist'
  return path.isAbsolute(raw) ? raw : path.resolve(__dirname, raw)
})()

export default defineConfig({
  plugins: [react()],
  base: '/lemon-note/',
  build: {
    outDir: resolvedOutDir,
    // 输出到项目目录外（如 /var/www/...）时 Vite 要求显式清空目标目录
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

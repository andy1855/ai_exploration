import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'web'),
  server: { port: 5175 },
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
})

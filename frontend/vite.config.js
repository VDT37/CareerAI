import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api goes to FastAPI on 8000, so the browser sees one origin and no CORS setup is needed
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})

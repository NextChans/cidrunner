import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Deployed to GitHub Pages under /cidrunner/ (see ADR 0007); local dev stays at /.
  base: process.env.NODE_ENV === 'production' ? '/cidrunner/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

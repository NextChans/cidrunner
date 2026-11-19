import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves under /cidrunner/ (ADR 0007); Vercel serves at the domain
  // root (ADR 0068) and sets VERCEL=1 during its build. Local dev stays at /.
  base:
    process.env.NODE_ENV === 'production' && !process.env.VERCEL ? '/cidrunner/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Code-splitting (ADR 0029): pull React Flow — by far the heaviest dep —
    // into its own chunk, and the remaining node_modules into a `vendor` chunk,
    // so no single bundle trips the 500 kB warning. Groups are matched
    // top-to-bottom, so the React Flow rule must precede the catch-all vendor.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-flow', test: /[\\/]node_modules[\\/]@xyflow[\\/]/ },
            // Catch-all vendor, but leave JSZip out so its dynamic import in
            // terraform.ts stays a lazy chunk fetched only on export (ADR 0029).
            {
              name: 'vendor',
              test: (id) =>
                /[\\/]node_modules[\\/]/.test(id) &&
                !/[\\/]node_modules[\\/]jszip[\\/]/.test(id),
            },
          ],
        },
      },
    },
  },
})

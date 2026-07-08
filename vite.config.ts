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

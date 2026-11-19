// The playground (README.md §10): one page with every component, on the package's own source.
// `npm run dev`, then open the printed URL.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
})

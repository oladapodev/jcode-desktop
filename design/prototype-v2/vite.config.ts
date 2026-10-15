import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 },
})

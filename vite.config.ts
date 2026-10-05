import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

const port = Number(process.env.PORT) || 5173

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
})

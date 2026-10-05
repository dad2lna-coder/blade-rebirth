import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

const port = Number(process.env.PORT) || 5173
const base = process.env.GITHUB_PAGES === 'true' ? '/blade-rebirth/' : '/'

export default defineConfig({
  base,
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

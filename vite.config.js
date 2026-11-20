import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La build finisce direttamente in apps/english-sprint (index.html + assets/ + content/), servita da Apache con le API PHP.
// In locale: http://localhost/gianlucadario/apps/english-sprint/ (login del portale /apps/).
// Con `npm run dev` le chiamate a api/ vanno all'Apache locale (proxy qui sotto).
export default defineConfig(({ command }) => {
  if (command === 'build') process.env.NODE_ENV = 'production'
  return {
    plugins: [react()],
    base: './',
    server: {
      proxy: { '/api': { target: 'http://localhost', rewrite: p => '/gianlucadario/apps/english-sprint' + p } },
    },
    build: { outDir: '..', emptyOutDir: false, chunkSizeWarningLimit: 900 },
  }
})

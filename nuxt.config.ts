const backendUrl = process.env.NUXT_DEV_BACKEND_URL ?? 'http://localhost:8000'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  app: {
    head: { title: 'BCM Tools' },
  },
  nitro: {
    devProxy: {
      '/api': { target: `${backendUrl}/api`, changeOrigin: true },
      '/auth': { target: `${backendUrl}/auth`, changeOrigin: true },
    },
  },
  vite: {
    server: {
      // Bind-mounted sources on Docker Desktop for Windows don't emit file events.
      watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true' },
    },
  },
})

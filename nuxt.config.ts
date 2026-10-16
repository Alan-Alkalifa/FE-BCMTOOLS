const backendUrl = process.env.NUXT_DEV_BACKEND_URL ?? 'http://localhost:8000'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      title: 'BCM Tools',
      htmlAttrs: { lang: 'en' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
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
  eslint: {
    config: {
      stylistic: {
        semi: false,
        quotes: 'single',
        commaDangle: 'always-multiline',
        arrowParens: true,
        braceStyle: '1tbs',
      },
    },
  },
})

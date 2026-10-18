const backendUrl = process.env.NUXT_DEV_BACKEND_URL ?? 'http://localhost:8000'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      title: 'BCM Tools',
      htmlAttrs: { lang: 'en' },
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
  css: ['@fontsource-variable/inter', '~/assets/css/main.css'],
  ui: {
    // @nuxt/fonts downloads from Google Fonts; Inter is self-hosted via @fontsource instead.
    fonts: false,
    colorMode: false,
  },
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
  icon: {
    // The static build has no Nuxt server, and nginx sends every /api path to the backend,
    // so all icons must be in the client bundle rather than fetched from /api/_nuxt_icon.
    provider: 'none',
    // The scan only sees icon names in our source; Nuxt UI's loading spinner is set in its own config.
    clientBundle: {
      scan: true,
      icons: [
        'lucide:loader-circle',
        'lucide:octagon-alert',
        'lucide:circle-dot',
        'lucide:circle-minus',
        'lucide:chart-column',
        'lucide:siren',
        'lucide:clipboard-check',
        'lucide:clock',
      ],
    },
  },
})

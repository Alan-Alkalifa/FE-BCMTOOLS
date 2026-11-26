import posthog from 'posthog-js'
import type { PostHog } from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const { public: publicConfig } = useRuntimeConfig()
  const { projectToken, host } = publicConfig.posthog

  if (!projectToken || !host) {
    if (import.meta.dev) {
      const missingVariable = projectToken
        ? 'NUXT_PUBLIC_POSTHOG_HOST'
        : 'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN'
      throw new Error(`${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`)
    }

    return { provide: { posthog: undefined as PostHog | undefined } }
  }

  const posthogClient = posthog.init(projectToken, {
    api_host: host,
    logs: {
      serviceName: 'bcm-frontend',
      environment: import.meta.env.MODE,
    },
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  })

  nuxtApp.hook('vue:error', (error) => {
    posthogClient.captureException(error)
  })

  return {
    provide: {
      posthog: posthogClient as PostHog,
    },
  }
})

<script setup lang="ts">
definePageMeta({ public: true, layout: false })

useHead({ title: 'Sign in · BCM Tools' })

const route = useRoute()
const redirecting = ref(false)
const year = new Date().getFullYear()

const loginHref = computed(() => {
  const next = route.query.redirect
  return typeof next === 'string' ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login'
})

// A loading UButton is disabled and cancels its own link, so navigate explicitly.
function signIn() {
  redirecting.value = true
  window.location.assign(loginHref.value)
}

// Reset the spinner when the user comes back via the browser's back/forward cache.
function resetRedirecting() {
  redirecting.value = false
}
onMounted(() => window.addEventListener('pageshow', resetRedirecting))
onBeforeUnmount(() => window.removeEventListener('pageshow', resetRedirecting))
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-default">
    <!-- Brand panel: raw cimb palette is intentional here (brand surface, see docs/design-system.md). -->
    <aside class="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-linear-to-br from-cimb-950 via-cimb-900 to-cimb-700">
      <div
        aria-hidden="true"
        class="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-size-[22px_22px]"
      />
      <div
        aria-hidden="true"
        class="absolute -right-32 -bottom-32 size-[28rem] rounded-full border-[3rem] border-white/5"
      />

      <div class="relative flex items-center gap-3">
        <img
          src="/cimb-niaga-logo.svg"
          alt="CIMB Niaga"
          class="size-11 rounded-sm ring-1 ring-white/20"
        >
        <div class="leading-tight">
          <p class="font-semibold">
            CIMB Niaga
          </p>
          <p class="text-sm text-white/70">
            Business Continuity Management
          </p>
        </div>
      </div>

      <div class="relative max-w-md space-y-4">
        <h2 class="text-4xl font-semibold tracking-tight">
          BCM Tools
        </h2>
        <p class="text-lg text-white/80">
          Plan, test and maintain business continuity across CIMB Niaga.
        </p>
      </div>

      <p class="relative text-xs text-white/60">
        © {{ year }} PT Bank CIMB Niaga Tbk
      </p>
    </aside>

    <main class="flex flex-col">
      <div class="flex-1 flex items-center justify-center px-6 py-12">
        <div class="w-full max-w-sm space-y-8">
          <div class="lg:hidden flex items-center gap-3">
            <img
              src="/cimb-niaga-logo.svg"
              alt="CIMB Niaga"
              class="size-10 rounded-sm"
            >
            <div class="leading-tight">
              <p class="font-semibold text-highlighted">
                BCM Tools
              </p>
              <p class="text-sm text-muted">
                CIMB Niaga
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
              Sign in
            </h1>
            <p class="text-sm text-muted">
              Use your CIMB Niaga Microsoft account to continue.
            </p>
          </div>

          <UAlert
            v-if="route.query.error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Sign-in failed. Please try again."
            description="If this keeps happening, contact the IT Service Desk."
          />

          <UAlert
            v-else-if="route.query.signed_out"
            color="success"
            variant="subtle"
            icon="i-lucide-circle-check"
            title="You've signed out of BCM Tools."
            description="You're still signed in to your Microsoft account, so signing in again won't ask for your password."
          />

          <UButton
            :to="loginHref"
            external
            block
            size="xl"
            color="neutral"
            variant="outline"
            label="Sign in with Microsoft"
            :loading="redirecting"
            class="justify-center font-semibold"
            @click.prevent="signIn"
          >
            <template #leading>
              <UIcon
                v-if="redirecting"
                name="i-lucide-loader-circle"
                class="size-5 animate-spin"
              />
              <svg
                v-else
                aria-hidden="true"
                viewBox="0 0 21 21"
                class="size-5"
              >
                <rect
                  x="1"
                  y="1"
                  width="9"
                  height="9"
                  fill="#f25022"
                />
                <rect
                  x="11"
                  y="1"
                  width="9"
                  height="9"
                  fill="#7fba00"
                />
                <rect
                  x="1"
                  y="11"
                  width="9"
                  height="9"
                  fill="#00a4ef"
                />
                <rect
                  x="11"
                  y="11"
                  width="9"
                  height="9"
                  fill="#ffb900"
                />
              </svg>
            </template>
          </UButton>

          <div class="flex gap-3 rounded-md border border-default bg-muted p-3 text-xs text-muted">
            <UIcon
              name="i-lucide-shield-check"
              class="size-4 shrink-0 text-primary"
            />
            <p>
              For authorised CIMB Niaga employees only. Access and activity are logged and may be monitored.
            </p>
          </div>
        </div>
      </div>

      <footer class="px-6 py-4 text-xs text-muted flex flex-wrap justify-center gap-x-2 lg:justify-end">
        <span class="lg:hidden">© {{ year }} PT Bank CIMB Niaga Tbk ·</span>
        <span>Internal use only</span>
      </footer>
    </main>
  </div>
</template>

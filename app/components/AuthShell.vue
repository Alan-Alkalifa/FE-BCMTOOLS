<script setup lang="ts">
/** The brand panel and centred card shared by sign-in, forgot, reset and set-password pages. */
defineProps<{ title: string, description?: string }>()

const year = new Date().getFullYear()
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-default">
    <!-- Brand panel: raw cimb palette is intentional here (brand surface, see docs/design-system.md). -->
    <aside class="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-linear-to-br from-cimb-950 via-cimb-900 to-cimb-800">
      <div
        aria-hidden="true"
        class="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-size-[22px_22px]"
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
          <p class="text-sm text-white/75">
            Business Continuity Management
          </p>
        </div>
      </div>

      <div class="relative max-w-md space-y-6">
        <h2 class="text-4xl font-semibold tracking-tight">
          BCM Tools
        </h2>
        <p class="text-lg text-white/85">
          Plan, test and maintain business continuity across CIMB Niaga.
        </p>
        <ul class="space-y-3 text-sm text-white/85">
          <li class="flex items-center gap-3">
            <UIcon
              name="i-lucide-shield-check"
              class="size-5 shrink-0"
            />
            System criticality categorisation (SCCA)
          </li>
          <li class="flex items-center gap-3">
            <UIcon
              name="i-lucide-badge-check"
              class="size-5 shrink-0"
            />
            Risk Assessment HO & Branch (RA)
          </li>
          <li class="flex items-center gap-3">
            <UIcon
              name="i-lucide-file-spreadsheet"
              class="size-5 shrink-0"
            />
            Official PDF and Excel reports
          </li>
        </ul>
      </div>

      <p class="relative text-xs text-white/70">
        © {{ year }} PT Bank CIMB Niaga Tbk
      </p>
    </aside>

    <main class="flex flex-col bg-muted/40">
      <div class="flex-1 flex items-center justify-center px-6 py-12">
        <div class="w-full max-w-md space-y-8">
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

          <div class="rounded-lg border border-default bg-default p-8 shadow-sm space-y-6">
            <div class="space-y-1.5">
              <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
                {{ title }}
              </h1>
              <p
                v-if="description"
                class="text-sm text-muted"
              >
                {{ description }}
              </p>
            </div>
            <slot />
          </div>

          <div class="flex gap-3 text-xs text-muted">
            <UIcon
              name="i-lucide-lock"
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

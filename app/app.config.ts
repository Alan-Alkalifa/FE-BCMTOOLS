export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cimb',
      secondary: 'slate',
      success: 'green',
      info: 'blue',
      warning: 'amber',
      error: 'rose',
      neutral: 'slate',
    },
    table: {
      slots: {
        th: 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted bg-muted',
        td: 'px-3 py-2 text-sm text-default tabular-nums',
      },
    },
  },
})

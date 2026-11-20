declare module '#app' {
  interface PageMeta {
    /** Reachable without signing in (sign-in, forgot and reset password). */
    public?: boolean
    /** Permission code(s) needed to open the page; any of them is enough. */
    permission?: string | string[]
    /** false: never opens as an in-app tab (redirect stubs and record resolvers). */
    tab?: false
  }
}

export {}

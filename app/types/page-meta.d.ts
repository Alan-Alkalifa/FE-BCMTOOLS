declare module '#app' {
  interface PageMeta {
    /** Reachable without signing in (sign-in, forgot and reset password). */
    public?: boolean
    /** Permission code(s) needed to open the page; any of them is enough. */
    permission?: string | string[]
  }
}

export {}

/**
 * Vercel only (Routing Middleware; the Docker image uses nginx instead): forwards `/api/*` to the
 * backend named by the `BACKEND_URL` environment variable of the Vercel project, e.g.
 * `https://<name>.ngrok-free.dev`. The browser keeps calling its own origin, so the session cookie,
 * CSRF and sealed passwords work exactly as behind nginx.
 *
 * `ngrok-skip-browser-warning` keeps ngrok's free-plan warning page out of API answers, images
 * (`/api/me/photo`) and downloads (reports, Excel exports); other backends ignore it.
 */
import { next, rewrite } from '@vercel/functions/middleware'

export const config = { matcher: '/api/:path*' }

export default function middleware(request: Request) {
  const backend = process.env.BACKEND_URL?.replace(/\/+$/, '')
  if (!backend) return next()
  const url = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.set('ngrok-skip-browser-warning', '1')
  headers.set('x-forwarded-host', url.host)
  return rewrite(`${backend}${url.pathname}${url.search}`, { request: { headers } })
}

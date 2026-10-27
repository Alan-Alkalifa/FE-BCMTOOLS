/**
 * Sealed secrets: passwords go to the backend encrypted inside the request body, so they never
 * appear as readable text in the payload (developer tools, proxy or WAF logs, a captured request).
 * HTTPS still protects the whole request; this is a second layer on top of it.
 *
 * Hybrid encryption with the browser's Web Crypto API: the fields are encrypted with a fresh
 * AES-256-GCM key, and that key is wrapped with the server's RSA-OAEP (SHA-256) public key.
 * Each envelope carries a one-time nonce from the server and the endpoint's purpose, so it can't
 * be replayed or reused elsewhere. See backend `services/auth/sealing.py`.
 */

export type SealPurpose = 'login' | 'change_password' | 'reset_password' | 'user_password' | 'smtp_password'

export interface SealedEnvelope {
  v: 1
  kid: string
  key: string
  iv: string
  data: string
}

interface SealKey {
  v: 1
  kid: string
  public_key: string
  algorithm: string
  nonce: string
  expires_in: number
}

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let text = ''
  for (const byte of view) text += String.fromCharCode(byte)
  return btoa(text)
}

function fromBase64(value: string) {
  const text = atob(value)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

/** Web Crypto exists only on HTTPS pages and on localhost. */
function subtle() {
  const api = globalThis.crypto?.subtle
  if (!api) {
    throw new Error('This page must be opened over HTTPS (or on localhost) to send a password securely.')
  }
  return api
}

/** Encrypts `fields` for one request to the endpoint named by `purpose`. */
export async function sealSecrets(purpose: SealPurpose, fields: Record<string, string>): Promise<SealedEnvelope> {
  const crypto = subtle()
  const key = await $fetch<SealKey>('/api/auth/seal-key', { cache: 'no-store' })
  const publicKey = await crypto.importKey(
    'spki',
    fromBase64(key.public_key),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const aes = await crypto.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify({ purpose, nonce: key.nonce, fields }))
  const data = await crypto.encrypt({ name: 'AES-GCM', iv }, aes, plain)
  const wrapped = await crypto.encrypt({ name: 'RSA-OAEP' }, publicKey, await crypto.exportKey('raw', aes))
  return { v: 1, kid: key.kid, key: toBase64(wrapped), iv: toBase64(iv), data: toBase64(data) }
}

function sealExpired(error: unknown) {
  return (error as { data?: { error?: string } })?.data?.error === 'sealed_invalid'
}

/**
 * POSTs (or PUTs…) `body` with its secret fields sealed. A key that rotated in between, or a
 * nonce that expired while the form was open, is retried once with a fresh key.
 */
export async function sealedFetch<T>(
  url: string,
  purpose: SealPurpose,
  secrets: Record<string, string>,
  options: { method?: 'POST' | 'PUT' | 'PATCH', body?: Record<string, unknown> } = {},
): Promise<T> {
  const send = async () => $fetch<T>(url, {
    method: options.method ?? 'POST',
    body: { ...options.body, sealed: await sealSecrets(purpose, secrets) },
  })
  try {
    return await send()
  } catch (error) {
    if (!sealExpired(error)) throw error
    return await send()
  }
}

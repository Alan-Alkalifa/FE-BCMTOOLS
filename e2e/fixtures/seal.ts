import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from 'node:crypto'
import type { Page } from '@playwright/test'

/** A test key pair standing in for the backend's sealing key (backend services/auth/sealing.py). */
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PUBLIC_DER = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
let nonces = 0

/** Answers GET /api/auth/seal-key with the test public key and a fresh nonce. */
export async function mockSealKey(page: Page) {
  await page.route('**/api/auth/seal-key', (route) => route.fulfill({
    json: { v: 1, kid: 'test-key', public_key: PUBLIC_DER, algorithm: 'RSA-OAEP-256+A256GCM', nonce: `nonce-${++nonces}`, expires_in: 300 },
  }))
}

interface Envelope { v: 1, kid: string, key: string, iv: string, data: string }

/** Opens a sealed body the way the backend does: `{ ...rest, ...fields }`, plus `purpose`. */
export function unseal<T = Record<string, unknown>>(body: unknown): T & { purpose?: string } {
  const { sealed, ...rest } = (body ?? {}) as { sealed?: Envelope } & Record<string, unknown>
  if (!sealed) return rest as T
  const aes = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(sealed.key, 'base64'))
  const data = Buffer.from(sealed.data, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', aes, Buffer.from(sealed.iv, 'base64'))
  decipher.setAuthTag(data.subarray(data.length - 16))
  const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()])
  const content = JSON.parse(plain.toString('utf8')) as { purpose: string, fields: Record<string, string> }
  return { ...rest, ...content.fields, purpose: content.purpose } as T & { purpose?: string }
}

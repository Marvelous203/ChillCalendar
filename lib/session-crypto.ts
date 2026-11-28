import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from './auth';

export const SEALED_SESSION_COOKIE = 'cwm_session';

export interface SealedSession {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: AuthUser;
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'cwm-local-dev-fallback-secret-key';
  return createHash('sha256').update(secret).digest();
}

export function sealSession(payload: SealedSession): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function unsealSession(raw: string | undefined): SealedSession | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;

  try {
    const [ivB64, tagB64, dataB64] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString('utf8')) as Partial<SealedSession>;
    if (
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string' &&
      parsed.user &&
      typeof parsed.user.id === 'string' &&
      typeof parsed.user.email === 'string'
    ) {
      return parsed as SealedSession;
    }
    return null;
  } catch {
    return null;
  }
}

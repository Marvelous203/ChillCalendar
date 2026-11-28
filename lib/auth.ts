import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { SEALED_SESSION_COOKIE, unsealSession } from './session-crypto';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

export const DEV_AUTH_COOKIE = 'cwm_dev_user';

export function isDevAuthMode(): boolean {
  return process.env.AUTH_MODE === 'dev';
}

export function hashParticipantToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSecretToken(): string {
  return randomBytes(24).toString('base64url');
}

function parseDevCookie(raw: string | undefined): AuthUser | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<AuthUser>;
    if (typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return { id: parsed.id, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeDevCookie(user: AuthUser): string {
  return Buffer.from(JSON.stringify(user), 'utf8').toString('base64url');
}

/** Lấy thông tin chủ sự kiện hiện tại từ cookie phiên hoặc dev cookie. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();

  if (isDevAuthMode()) {
    return parseDevCookie(cookieStore.get(DEV_AUTH_COOKIE)?.value);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  // 1. Ưu tiên cookie HttpOnly đã mã hóa AES-256-GCM
  const sealed = unsealSession(cookieStore.get(SEALED_SESSION_COOKIE)?.value);
  if (sealed) {
    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser(sealed.accessToken);
    if (!error && data.user?.email) {
      const meta = data.user.user_metadata as Record<string, unknown> | undefined;
      const displayName =
        (typeof meta?.display_name === 'string' && meta.display_name) ||
        (typeof meta?.full_name === 'string' && meta.full_name) ||
        (typeof meta?.name === 'string' && meta.name) ||
        undefined;
      return { id: data.user.id, email: data.user.email, displayName };
    }
    if (sealed.refreshToken) {
      const refreshed = await sb.auth.refreshSession({
        refresh_token: sealed.refreshToken,
      });
      if (!refreshed.error && refreshed.data.user?.email) {
        const meta = refreshed.data.user.user_metadata as Record<string, unknown> | undefined;
        const displayName =
          (typeof meta?.display_name === 'string' && meta.display_name) ||
          (typeof meta?.full_name === 'string' && meta.full_name) ||
          (typeof meta?.name === 'string' && meta.name) ||
          undefined;
        return {
          id: refreshed.data.user.id,
          email: refreshed.data.user.email,
          displayName,
        };
      }
    }
    return null;
  }

  // 2. Fallback tương thích ngược cho phiên Supabase SSR cũ (nếu còn)
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Read-only trong Route Handlers GET / Server Components
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.email) return null;
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  const displayName =
    (typeof meta?.display_name === 'string' && meta.display_name) ||
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.name === 'string' && meta.name) ||
    undefined;
  return { id: data.user.id, email: data.user.email, displayName };
}

export function getParticipantTokenFromRequest(req: Request): string | null {
  const raw = req.headers.get('x-participant-token')?.trim();
  return raw && raw.length >= 8 ? raw : null;
}

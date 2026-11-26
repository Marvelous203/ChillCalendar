'use client';

const keyFor = (code: string) => `cwm_pt_${code.toUpperCase()}`;

export function getParticipantToken(code: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(keyFor(code));
  } catch {
    return null;
  }
}

export function setParticipantToken(code: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(code), token);
  } catch {
    // Bỏ qua khi bị chặn storage trong một số WebView
  }
}

export function clearParticipantToken(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(code));
  } catch {
    // Bỏ qua
  }
}

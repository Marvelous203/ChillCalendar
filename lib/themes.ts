'use client';

import { useSyncExternalStore } from 'react';

export type ThemeId = 'dark' | 'light' | 't1';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  shortLabel: string;
  icon: string;
  swatch: string;
  isDark: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    label: 'Tối mặc định',
    shortLabel: 'Tối',
    icon: '🌙',
    swatch: '#3DD0C6',
    isDark: true,
  },
  {
    id: 'light',
    label: 'Sáng nhẹ nhàng',
    shortLabel: 'Sáng',
    icon: '☀️',
    swatch: '#0FA3A3',
    isDark: false,
  },
  {
    id: 't1',
    label: 'T1 Đỏ rực',
    shortLabel: 'T1',
    icon: '🔥',
    swatch: '#E4002B',
    isDark: true,
  },
];

export const DEFAULT_THEME: ThemeId = 'dark';
const STORAGE_KEY = 'cwm_theme';
const THEME_EVENT = 'cwm-theme';

export function isValidTheme(value: string | null): value is ThemeId {
  return value === 'dark' || value === 'light' || value === 't1';
}

export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isValidTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setSavedTheme(theme: ThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new Event(THEME_EVENT));
  } catch {
    // Bỏ qua nếu bị chặn storage
  }
}

export function subscribeTheme(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const def = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  root.dataset.theme = def.id;
  root.classList.toggle('dark', def.isDark);
  root.classList.toggle('light', !def.isDark);
}

export function useAppTheme(): [ThemeId, (next: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribeTheme, getSavedTheme, () => DEFAULT_THEME);
  return [theme, setSavedTheme];
}

const BLOSSOM_KEY = 'cwm_blossom';
const BLOSSOM_EVENT = 'cwm-blossom';

export function getSavedBlossom(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(BLOSSOM_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setSavedBlossom(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BLOSSOM_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(BLOSSOM_EVENT));
  } catch {
    // Bỏ qua nếu bị chặn storage
  }
}

function subscribeBlossom(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(BLOSSOM_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(BLOSSOM_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useBlossomEffect(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeBlossom, getSavedBlossom, () => false);
  return [enabled, setSavedBlossom];
}

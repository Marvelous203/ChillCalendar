'use client';

import { createContext, useContext } from 'react';
import useSWR from 'swr';

export interface AuthMeUser {
  id: string;
  email: string;
}

export interface AuthMeState {
  user: AuthMeUser | null;
  authMode: 'dev' | 'supabase';
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
}

interface MeApiResponse {
  user: AuthMeUser | null;
  authMode: 'dev' | 'supabase';
}

const AuthContext = createContext<AuthMeState>({
  user: null,
  authMode: 'supabase',
  isLoading: true,
  refreshAuth: async () => {},
});

const fetchMe = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<MeApiResponse>);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR<MeApiResponse>('/api/auth/me', fetchMe, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 600_000,
  });

  async function refreshAuth() {
    await mutate();
  }

  return (
    <AuthContext.Provider
      value={{
        user: data?.user ?? null,
        authMode: data?.authMode ?? 'supabase',
        isLoading,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthMeState {
  return useContext(AuthContext);
}

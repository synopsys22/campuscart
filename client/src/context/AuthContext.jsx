import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { authApi, onSessionEnded, tokenStore } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.get()));

  const { data: user = null, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        // An expired or rejected token means the visitor is simply logged out.
        if (error.status === 401 || error.status === 403) {
          tokenStore.clear();
          setHasToken(false);
          return null;
        }
        throw error;
      }
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // For example, the demo data was reset, or an admin deactivated this account.
  useEffect(
    () =>
      onSessionEnded(() => {
        setHasToken(false);
        queryClient.clear();
        toast.error('Your session has ended. Please log in again.');
      }),
    [queryClient],
  );

  const startSession = useCallback(
    ({ token, user: account }) => {
      tokenStore.set(token);
      // Nothing cached from a previous account may carry over.
      queryClient.clear();
      queryClient.setQueryData(['me'], account);
      setHasToken(true);
      return account;
    },
    [queryClient],
  );

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === 'admin',
      isLoading: hasToken && isLoading,
      login: async (credentials) => startSession(await authApi.login(credentials)),
      register: async (details) => startSession(await authApi.register(details)),
      logout: () => {
        tokenStore.clear();
        setHasToken(false);
        // Clears cart, orders and everything else belonging to this account.
        queryClient.clear();
      },
      setUser: (account) => queryClient.setQueryData(['me'], account),
    }),
    [user, hasToken, isLoading, startSession, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

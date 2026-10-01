import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@forkcast/shared';
import { api, ApiRequestError } from './api';
import { getToken, setToken, subscribeToken } from './token';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export interface AuthState {
  token: string | null;
  user: UserDto | null;
  /** True while the stored token is being verified. */
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (input: LoginInput) => Promise<AuthResponse>;
  register: (input: RegisterInput) => Promise<AuthResponse>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...ME_QUERY_KEY, token],
    queryFn: () => api.get<UserDto>('/api/auth/me'),
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });

  // An invalid/expired token is dropped so that the UI goes back to the logged-out state.
  useEffect(() => {
    if (query.error instanceof ApiRequestError && query.error.status === 401) setToken(null);
  }, [query.error]);

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthResponse>('/api/auth/login', input),
    onSuccess: (res) => {
      setToken(res.token);
      queryClient.setQueryData([...ME_QUERY_KEY, res.token], res.user);
    },
  });
  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => api.post<AuthResponse>('/api/auth/register', input),
    onSuccess: (res) => {
      setToken(res.token);
      queryClient.setQueryData([...ME_QUERY_KEY, res.token], res.user);
    },
  });

  const logout = useCallback(() => {
    setToken(null);
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ['trees'] });
  }, [queryClient]);

  const user = token !== null ? (query.data ?? null) : null;
  return {
    token,
    user,
    isLoading: token !== null && query.isPending,
    isLoggedIn: user !== null,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
  };
}

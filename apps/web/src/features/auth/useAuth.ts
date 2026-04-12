import { createContext, useContext } from 'react';
import { type User } from '@finance/shared/schemas/auth';

export type { User };

export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Returns the current auth context: { user, accessToken, isAuthenticated, login, logout }.
 *
 * Auth state is held in React Context (not localStorage directly) and kept in sync
 * with localStorage by AuthProvider — so this is the single source of truth for
 * auth state across the app.
 *
 * Must be called inside <AuthProvider> (i.e. inside <RouterWrapper> in main.tsx).
 * Throws if used outside the provider tree.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

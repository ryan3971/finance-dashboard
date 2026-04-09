import { AuthContext, type User } from '@/features/auth/useAuth';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { userSchema } from '@finance/shared';

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  );
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    if (!stored) return null;
    const result = userSchema.safeParse(JSON.parse(stored));
    return result.success ? result.data : null;
  });

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    setAccessToken(token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    setAccessToken(null);
    setUser(null);
  }, []);

  const contextValue = useMemo(
    () => ({ user, accessToken, login, logout, isAuthenticated: !!accessToken }),
    [user, accessToken, login, logout]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

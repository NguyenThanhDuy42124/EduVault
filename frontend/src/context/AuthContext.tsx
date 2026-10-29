import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, UserRole } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  quickLogin: (role: 'ADMIN' | 'BORROWER') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('eduvault_token'));
  const [role, setRole] = useState<UserRole | null>(() => (localStorage.getItem('eduvault_role') as UserRole) || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem('eduvault_token');
    localStorage.removeItem('eduvault_role');
    localStorage.removeItem('eduvault_user');
    setToken(null);
    setRole(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const storedToken = localStorage.getItem('eduvault_token');
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await authService.getMe();
      setUser(profile);
      setRole(profile.role);
      localStorage.setItem('eduvault_role', profile.role);
      localStorage.setItem('eduvault_user', JSON.stringify(profile));
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshProfile();

    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('eduvault_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('eduvault_auth_expired', handleAuthExpired);
  }, [refreshProfile, logout]);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authService.login(identifier, password);
      localStorage.setItem('eduvault_token', data.access_token);
      localStorage.setItem('eduvault_role', data.role);
      setToken(data.access_token);
      setRole(data.role);

      const profile = await authService.getMe();
      setUser(profile);
      localStorage.setItem('eduvault_user', JSON.stringify(profile));
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (targetRole: 'ADMIN' | 'BORROWER') => {
    if (targetRole === 'ADMIN') {
      await login('admin@eduvault.local', 'admin123');
    } else {
      await login('sv001@eduvault.local', 'student123');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        quickLogin,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

// API 기본 URL 설정 (api.ts와 동일한 로직)
const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');
};

const API_BASE_URL = getApiBaseUrl();

interface User {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  /** 비밀번호 로그인 가능 여부(Google 전용 계정이면 false). /api/auth/me 가 채운다. */
  hasPassword?: boolean;
}

interface AuthConfig {
  oauthEnabled: boolean;
  localAuthEnabled: boolean;
  skipEmailVerification?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  authConfig: AuthConfig | null;
  login: (token: string) => void;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ email: string; token?: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const checkAuthConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/config`);
        const config = await response.json();
        setAuthConfig(config);

        // Check for stored token
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
          setToken(storedToken);
          await fetchUserInfo(storedToken);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Failed to check auth config');
        setAuthConfig({ oauthEnabled: false, localAuthEnabled: true });
        setIsLoading(false);
      }
    };

    checkAuthConfig();
  }, []);

  // Check for token in URL (from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      handleLogin(tokenFromUrl);
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchUserInfo = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token invalid, clear it
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    fetchUserInfo(newToken);
  };

  const loginWithCredentials = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    localStorage.setItem('auth_token', result.token);
    setToken(result.token);
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await api.register(email, password, name);
    if (result.token && result.user) {
      setUser(result.user);
      localStorage.setItem('auth_token', result.token);
      setToken(result.token);
    }
    return { email: result.email, token: result.token };
  };

  const verifyEmail = async (email: string, code: string) => {
    const result = await api.verifyEmail(email, code);
    setUser(result.user);
    localStorage.setItem('auth_token', result.token);
    setToken(result.token);
  };

  const resendVerification = async (email: string) => {
    await api.resendVerification(email);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentOrganizationId');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authConfig,
        login: handleLogin,
        loginWithCredentials,
        register,
        verifyEmail,
        resendVerification,
        updateUser,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

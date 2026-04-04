import { useCallback, useEffect, useState } from "react";

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    email: null,
    isLoading: true,
  });

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      const data = await res.json();
      setState({
        isAuthenticated: data.authenticated,
        email: data.email || null,
        isLoading: false,
      });
    } catch {
      setState({ isAuthenticated: false, email: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const login = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setState({ isAuthenticated: false, email: null, isLoading: false });
  }, []);

  return { ...state, login, logout };
}

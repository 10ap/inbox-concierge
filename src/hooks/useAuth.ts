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

  useEffect(() => {
    const controller = new AbortController();

    async function checkStatus() {
      try {
        const res = await fetch("/api/auth/status", {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json();
        setState({
          isAuthenticated: data.authenticated,
          email: data.email ?? null,
          isLoading: false,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ isAuthenticated: false, email: null, isLoading: false });
      }
    }

    checkStatus();

    // Clean up auth query param from URL after OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.has("auth")) {
      params.delete("auth");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }

    return () => controller.abort();
  }, []);

  const login = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState({ isAuthenticated: false, email: null, isLoading: false });
  }, []);

  return { ...state, login, logout };
}

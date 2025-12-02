import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getUser,
  getToken,
  verifyToken,
  logout as authLogout,
  type AuthUser,
} from "@/lib/auth";

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check for existing token and verify it
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        // Verify token is still valid
        const verifiedUser = await verifyToken();
        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          // Token invalid, clear it
          setUser(null);
        }
      } else {
        // Try to get user from localStorage (may be stale)
        const storedUser = getUser();
        if (storedUser) {
          // Verify if we have a token
          const verified = await verifyToken();
          setUser(verified);
        }
      }
      setLoading(false);
    };

    initAuth();

    // Listen for storage changes (e.g., login/logout in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token" || e.key === "auth_user") {
        const newUser = getUser();
        setUser(newUser);
        queryClient.invalidateQueries();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await authLogout();
    setUser(null);
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Refresh user state (useful after login)
  const refreshUser = useCallback(() => {
    const currentUser = getUser();
    setUser(currentUser);
  }, []);

  const isAdminUser = user?.isAdmin || 
    (!!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: isAdminUser,
    signOut,
    refreshUser,
  };
}

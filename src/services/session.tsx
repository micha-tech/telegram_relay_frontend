"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { authService, authErrorMessage } from "./auth";
import type { User, AuthService } from "./auth";

interface Session {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  service: AuthService;
}
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({
  children,
  service = authService,
}: {
  children: ReactNode;
  service?: AuthService;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUser(await service.getSession());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [service]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <SessionContext.Provider
      value={{ user, loading, error, setUser, refresh, service }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is required");
  return session;
}

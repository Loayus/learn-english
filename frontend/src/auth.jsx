import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = chargement

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api("/me").then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const login = useCallback(async (endpoint, username, password) => {
    const { user } = await api(endpoint, { method: "POST", body: { username, password } });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await api("/logout", { method: "POST", body: {} });
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

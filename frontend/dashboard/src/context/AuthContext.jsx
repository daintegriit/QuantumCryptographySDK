import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function getToken() {
  return localStorage.getItem("qsentry_token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/status`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      setUser(data.authenticated ? data.user : null);
      if (!data.authenticated) localStorage.removeItem("qsentry_token");
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    localStorage.removeItem("qsentry_token");
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshAuth: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

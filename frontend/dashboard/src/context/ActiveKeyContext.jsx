// src/context/ActiveKeyContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { apiGet } from "../services/apiClient";

const ActiveKeyContext = createContext(null);

export function ActiveKeyProvider({ children }) {
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshActiveKey() {
    try {
      const res = await apiGet("/api/keys/active");
      setActiveKey(res?.active ? res.key : null);
    } catch {
      setActiveKey(null);
    }
  }

  useEffect(() => {
    refreshActiveKey().finally(() => setLoading(false));
  }, []);

  return (
    <ActiveKeyContext.Provider
      value={{ activeKey, refreshActiveKey, loading }}
    >
      {children}
    </ActiveKeyContext.Provider>
  );
}

export function useActiveKey() {
  return useContext(ActiveKeyContext);
}
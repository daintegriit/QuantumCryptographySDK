import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { THEMES } from "../styles/themes";

// ==========================
// Context
// ==========================

const ThemeContext = createContext(null);
const STORAGE_KEY = "qs_theme";
const DEFAULT_THEME = "apple";

// ==========================
// Provider
// ==========================

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && THEMES[saved] ? saved : DEFAULT_THEME;
  });

  const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME];

  useEffect(() => {
    const root = document.documentElement;

    // Persist selection
    localStorage.setItem(STORAGE_KEY, themeName);

    // Remove all previous theme-* classes
    Object.keys(THEMES).forEach((key) => {
      root.classList.remove(`theme-${key}`);
    });

    // Apply active theme
    root.classList.add(`theme-${themeName}`);

    // Optional Tailwind dark-mode sync (safe to remove later)
    if (theme.dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [themeName]); // 🔑 depend ONLY on themeName

  const value = useMemo(
    () => ({
      themeName,
      setThemeName,
      theme,
    }),
    [themeName]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ==========================
// Hook
// ==========================

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Return default theme when used outside ThemeProvider
    const { THEMES } = require("../styles/themes");
    return { theme: THEMES["apple"], themeName: "apple", setThemeName: () => {} };
  }
  return ctx;
}
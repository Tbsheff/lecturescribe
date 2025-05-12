"use client";

import { useEffect } from "react";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Initialize theme from localStorage
  useEffect(() => {
    const root = window.document.documentElement;
    const storedTheme = localStorage.getItem("theme");

    // Handle system preference
    if (!storedTheme || storedTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(storedTheme);
    }
  }, []);

  return children;
}

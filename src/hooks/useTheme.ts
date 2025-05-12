import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check if theme is stored in localStorage
    const storedTheme = localStorage.getItem("theme");
    if (
      storedTheme &&
      (storedTheme === "light" || storedTheme === "dark" ||
        storedTheme === "system")
    ) {
      return storedTheme as Theme;
    }

    // Default to system preference
    return "system";
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);

    applyTheme(newTheme);
  };

  // Apply theme to document
  const applyTheme = (currentTheme: Theme) => {
    const root = window.document.documentElement;
    const systemTheme =
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    const resolvedTheme = currentTheme === "system"
      ? systemTheme
      : currentTheme;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  };

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Initial application of theme
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    resolvedTheme: theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
      : theme,
  };
};

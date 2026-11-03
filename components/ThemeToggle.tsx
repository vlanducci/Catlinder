
"use client";

import { useEffect, useSyncExternalStore } from "react";

const themeChangeEvent = "catlinder-theme-change";

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(themeChangeEvent, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(themeChangeEvent, onChange);
  };
}

function getThemeSnapshot() {
  return localStorage.getItem("catlinder-theme") === "light";
}

function getServerThemeSnapshot() {
  return false;
}

export default function ThemeToggle() {
  const isLight = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  useEffect(() => {
    document.documentElement.classList.toggle("light", isLight);
  }, [isLight]);

  const toggleTheme = () => {
    const nextIsLight = !isLight;

    localStorage.setItem("catlinder-theme", nextIsLight ? "light" : "dark");
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
      aria-pressed={isLight}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--foreground)] transition hover:opacity-80"
    >
      {isLight ? "☀️" : "🌙"}
    </button>
  );
}

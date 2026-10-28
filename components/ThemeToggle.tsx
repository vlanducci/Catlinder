
"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("catlinder-theme");
    const dark = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", dark);
    setIsDark(dark);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;

    document.documentElement.classList.toggle("dark", nextIsDark);
    localStorage.setItem("catlinder-theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--foreground)] transition hover:opacity-80"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

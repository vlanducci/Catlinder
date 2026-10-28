
"use client";

import { signIn } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Catlinder
        </h1>

        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Sign in to access your calendar.
        </p>

        <button
          onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/" })}
          className="mt-8 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700"
        >
          Continue with Microsoft
        </button>
      </div>
    </main>
  );
}


"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Catlinder</h1>
        <p className="mt-3 text-sm text-gray-500">
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

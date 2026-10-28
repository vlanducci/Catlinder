
import CalendarLoader from "@/components/CalendarLoader";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

async function AuthenticatedHome() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return <CalendarLoader />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AuthenticatedHome />
    </Suspense>
  );
}

import CalendarLoader from "@/components/CalendarLoader";
import ThemeToggle from "@/components/ThemeToggle";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return <CalendarLoader />;
}
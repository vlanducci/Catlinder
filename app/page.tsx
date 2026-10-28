
import CalendarLoader from "@/components/CalendarLoader";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] transition-colors sm:p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Catlinder</h1>
        <ThemeToggle />
      </header>

      <CalendarLoader />
    </main>
  );
}
